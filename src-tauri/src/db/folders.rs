//! Folders ("document packages"): nested, with encrypted names. They replace the old flat
//! categories, which are converted once after unlock (`adopt_categories`).

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::crypto::{self, SecretKey};
use crate::error::{AppError, AppResult};

/// Deepest allowed nesting (top level = 1).
pub const MAX_DEPTH: usize = 8;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: String,
    pub parent_id: Option<String>,
    pub name: String,
    pub sort: i64,
    pub created_at: i64,
    /// Documents directly inside (not in subfolders), trash excluded.
    pub document_count: i64,
}

pub fn aad(id: &str) -> Vec<u8> {
    format!("folder:{id}").into_bytes()
}

fn clean_name(name: &str) -> AppResult<String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(AppError::Invalid(
            "Folder names need 1 to 60 characters".into(),
        ));
    }
    Ok(name.to_string())
}

pub fn list(conn: &Connection, key: &SecretKey) -> AppResult<Vec<Folder>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.parent_id, f.name, f.sort, f.created_at,
                (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id AND d.deleted_at IS NULL)
         FROM folders f",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, Option<String>>(1)?,
            r.get::<_, Vec<u8>>(2)?,
            r.get::<_, i64>(3)?,
            r.get::<_, i64>(4)?,
            r.get::<_, i64>(5)?,
        ))
    })?;
    let mut out = Vec::new();
    for row in rows {
        let (id, parent_id, sealed, sort, created_at, document_count) = row?;
        let name = String::from_utf8(crypto::decrypt(key, &sealed, &aad(&id))?)
            .map_err(|_| AppError::Crypto)?;
        out.push(Folder {
            id,
            parent_id,
            name,
            sort,
            created_at,
            document_count,
        });
    }
    out.sort_by(|a, b| {
        a.sort
            .cmp(&b.sort)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(out)
}

fn parents(conn: &Connection) -> AppResult<HashMap<String, Option<String>>> {
    let mut stmt = conn.prepare("SELECT id, parent_id FROM folders")?;
    let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

fn exists(conn: &Connection, id: &str) -> AppResult<bool> {
    Ok(conn
        .query_row("SELECT 1 FROM folders WHERE id = ?1", [id], |_| Ok(()))
        .optional()?
        .is_some())
}

/// Depth of `id` (top level = 1), following parents.
fn depth(map: &HashMap<String, Option<String>>, id: &str) -> usize {
    let mut d = 0;
    let mut cur = Some(id.to_string());
    while let Some(c) = cur {
        d += 1;
        if d > MAX_DEPTH + 1 {
            break;
        }
        cur = map.get(&c).cloned().flatten();
    }
    d
}

/// Height of the subtree under `id` (a folder without subfolders = 1).
fn height(map: &HashMap<String, Option<String>>, id: &str) -> usize {
    1 + map
        .iter()
        .filter(|(_, p)| p.as_deref() == Some(id))
        .map(|(child, _)| height(map, child))
        .max()
        .unwrap_or(0)
}

fn check_parent(conn: &Connection, parent: Option<&str>) -> AppResult<()> {
    if let Some(p) = parent {
        if !exists(conn, p)? {
            return Err(AppError::NotFound);
        }
    }
    Ok(())
}

fn too_deep() -> AppError {
    AppError::Invalid(format!("Folders can be nested up to {MAX_DEPTH} levels"))
}

pub fn create(
    conn: &Connection,
    key: &SecretKey,
    name: &str,
    parent: Option<&str>,
    now: i64,
) -> AppResult<Folder> {
    let name = clean_name(name)?;
    check_parent(conn, parent)?;
    if let Some(p) = parent {
        if depth(&parents(conn)?, p) >= MAX_DEPTH {
            return Err(too_deep());
        }
    }
    let id = super::new_id();
    let sort: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort), -1) + 1 FROM folders WHERE parent_id IS ?1",
        [parent],
        |r| r.get(0),
    )?;
    let sealed = crypto::encrypt(key, name.as_bytes(), &aad(&id))?;
    conn.execute(
        "INSERT INTO folders (id, parent_id, name, sort, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, parent, sealed, sort, now],
    )?;
    Ok(Folder {
        id,
        parent_id: parent.map(str::to_string),
        name,
        sort,
        created_at: now,
        document_count: 0,
    })
}

pub fn rename(conn: &Connection, key: &SecretKey, id: &str, name: &str) -> AppResult<()> {
    let name = clean_name(name)?;
    let sealed = crypto::encrypt(key, name.as_bytes(), &aad(id))?;
    let n = conn.execute(
        "UPDATE folders SET name = ?1 WHERE id = ?2",
        params![sealed, id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound);
    }
    Ok(())
}

/// Moves a folder under `parent` (None = top level). A folder can't go into itself or one
/// of its own subfolders, and the result must stay within `MAX_DEPTH`.
pub fn move_to(conn: &Connection, id: &str, parent: Option<&str>) -> AppResult<()> {
    if !exists(conn, id)? {
        return Err(AppError::NotFound);
    }
    check_parent(conn, parent)?;
    let map = parents(conn)?;
    if let Some(p) = parent {
        let mut cur = Some(p.to_string());
        while let Some(c) = cur {
            if c == id {
                return Err(AppError::Invalid(
                    "A folder can't be moved into itself".into(),
                ));
            }
            cur = map.get(&c).cloned().flatten();
        }
    }
    let base = parent.map_or(0, |p| depth(&map, p));
    if base + height(&map, id) > MAX_DEPTH {
        return Err(too_deep());
    }
    conn.execute(
        "UPDATE folders SET parent_id = ?1 WHERE id = ?2",
        params![parent, id],
    )?;
    Ok(())
}

/// Removes a folder. Nothing inside is lost: its documents and subfolders move up to the
/// folder's parent (or the top level).
pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    let parent: Option<String> = conn
        .query_row("SELECT parent_id FROM folders WHERE id = ?1", [id], |r| {
            r.get(0)
        })
        .optional()?
        .ok_or(AppError::NotFound)?;
    conn.execute(
        "UPDATE documents SET folder_id = ?1 WHERE folder_id = ?2",
        params![parent, id],
    )?;
    conn.execute(
        "UPDATE folders SET parent_id = ?1 WHERE parent_id = ?2",
        params![parent, id],
    )?;
    conn.execute("DELETE FROM folders WHERE id = ?1", [id])?;
    Ok(())
}

/// One-time conversion of the old categories into top-level folders (same ids, names now
/// encrypted); documents move into the folder of their category. Idempotent: converted
/// categories are removed.
pub fn adopt_categories(conn: &Connection, key: &SecretKey, now: i64) -> AppResult<()> {
    let mut stmt = conn.prepare("SELECT id, name, sort FROM categories")?;
    let cats = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    if cats.is_empty() {
        return Ok(());
    }
    let tx = conn.unchecked_transaction()?;
    for (id, name, sort) in &cats {
        if !exists(&tx, id)? {
            let sealed = crypto::encrypt(key, name.as_bytes(), &aad(id))?;
            tx.execute(
                "INSERT INTO folders (id, parent_id, name, sort, created_at) VALUES (?1, NULL, ?2, ?3, ?4)",
                params![id, sealed, sort, now],
            )?;
        }
        tx.execute(
            "UPDATE documents SET folder_id = ?1, category_id = NULL WHERE category_id = ?1",
            [id],
        )?;
        tx.execute("DELETE FROM categories WHERE id = ?1", [id])?;
    }
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::documents::{self, DocumentMeta, NewDocument};

    fn setup() -> (Connection, SecretKey) {
        (crate::db::open_in_memory().unwrap(), SecretKey::generate())
    }

    fn add_doc(conn: &Connection, key: &SecretKey, id: &str, folder: Option<&str>) {
        let doc = NewDocument {
            id: id.into(),
            kind: "text".into(),
            size: 1,
            meta: DocumentMeta::default(),
            folder_id: folder.map(str::to_string),
            reminder_offsets: vec![],
        };
        documents::insert(conn, key, &doc, 1).unwrap();
    }

    fn folder_of(conn: &Connection, doc: &str) -> Option<String> {
        conn.query_row(
            "SELECT folder_id FROM documents WHERE id = ?1",
            [doc],
            |r| r.get(0),
        )
        .unwrap()
    }

    #[test]
    fn categories_become_folders_once() {
        let (conn, key) = setup();
        add_doc(&conn, &key, "d1", None);
        conn.execute(
            "UPDATE documents SET category_id = 'taxes' WHERE id = 'd1'",
            [],
        )
        .unwrap();
        adopt_categories(&conn, &key, 5).unwrap();
        let folders = list(&conn, &key).unwrap();
        assert_eq!(folders.len(), 7);
        assert_eq!(folders[0].name, "IDs");
        let taxes = folders.iter().find(|f| f.id == "taxes").unwrap();
        assert_eq!(taxes.document_count, 1);
        assert_eq!(folder_of(&conn, "d1").as_deref(), Some("taxes"));
        // Names are not stored in plain text.
        let raw: Vec<u8> = conn
            .query_row("SELECT name FROM folders WHERE id = 'taxes'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(!raw.windows(5).any(|w| w == b"Taxes"));
        // Running again changes nothing.
        adopt_categories(&conn, &key, 6).unwrap();
        assert_eq!(list(&conn, &key).unwrap(), folders);
    }

    #[test]
    fn nesting_moving_and_cycles() {
        let (conn, key) = setup();
        let a = create(&conn, &key, " Car ", None, 1).unwrap();
        let b = create(&conn, &key, "Insurance", Some(&a.id), 1).unwrap();
        let c = create(&conn, &key, "2026", Some(&b.id), 1).unwrap();
        assert_eq!(a.name, "Car");
        assert!(move_to(&conn, &a.id, Some(&c.id)).is_err());
        assert!(move_to(&conn, &a.id, Some(&a.id)).is_err());
        move_to(&conn, &c.id, None).unwrap();
        rename(&conn, &key, &c.id, "Archive").unwrap();
        let all = list(&conn, &key).unwrap();
        let c2 = all.iter().find(|f| f.id == c.id).unwrap();
        assert_eq!(
            (c2.parent_id.as_deref(), c2.name.as_str()),
            (None, "Archive")
        );
        assert!(create(&conn, &key, "  ", None, 1).is_err());
        assert!(create(&conn, &key, "x", Some("missing"), 1).is_err());
    }

    #[test]
    fn depth_is_limited() {
        let (conn, key) = setup();
        let mut parent: Option<String> = None;
        for i in 0..MAX_DEPTH {
            parent = Some(
                create(&conn, &key, &format!("L{i}"), parent.as_deref(), 1)
                    .unwrap()
                    .id,
            );
        }
        assert!(create(&conn, &key, "too deep", parent.as_deref(), 1).is_err());
        // Moving a two-level subtree under the deepest folder would exceed the limit too.
        let top = create(&conn, &key, "T", None, 1).unwrap();
        create(&conn, &key, "T2", Some(&top.id), 1).unwrap();
        assert!(move_to(&conn, &top.id, parent.as_deref()).is_err());
    }

    #[test]
    fn deleting_moves_content_up() {
        let (conn, key) = setup();
        let a = create(&conn, &key, "A", None, 1).unwrap();
        let b = create(&conn, &key, "B", Some(&a.id), 1).unwrap();
        let c = create(&conn, &key, "C", Some(&b.id), 1).unwrap();
        add_doc(&conn, &key, "d1", Some(&b.id));
        delete(&conn, &b.id).unwrap();
        assert_eq!(folder_of(&conn, "d1").as_deref(), Some(a.id.as_str()));
        let all = list(&conn, &key).unwrap();
        assert_eq!(all.len(), 2);
        let c2 = all.iter().find(|f| f.id == c.id).unwrap();
        assert_eq!(c2.parent_id.as_deref(), Some(a.id.as_str()));
        delete(&conn, &a.id).unwrap();
        assert_eq!(folder_of(&conn, "d1"), None);
    }
}
