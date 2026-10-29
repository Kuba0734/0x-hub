use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::crypto::{self, SecretKey};
use crate::error::{AppError, AppResult};

pub const KINDS: [&str; 3] = ["markdown", "checklist", "sticky"];

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct ChecklistItem {
    pub id: String,
    pub text: String,
    pub done: bool,
}

/// Encrypted note body. `content` is HTML for markdown notes and plain text for stickies;
/// `plain` is a text-only copy used for search and previews.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct NoteData {
    pub title: String,
    pub content: String,
    pub plain: String,
    pub items: Vec<ChecklistItem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub kind: String,
    pub shade: u8,
    pub pinned: bool,
    #[serde(flatten)]
    pub data: NoteData,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub linked_document_ids: Vec<String>,
    /// Content requires re-confirming identity before it is returned.
    pub locked: bool,
    /// Locked, but re-confirmed recently (set by the command layer from AppState).
    pub revealed: bool,
}

impl Note {
    /// Fills `revealed` and blanks the body of locked notes that aren't revealed.
    pub fn with_access(mut self, revealed: bool) -> Self {
        self.revealed = self.locked && revealed;
        if self.locked && !revealed {
            self.data.content.clear();
            self.data.plain.clear();
            self.data.items.clear();
        }
        self
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct NotePatch {
    pub title: Option<String>,
    pub content: Option<String>,
    pub plain: Option<String>,
    pub items: Option<Vec<ChecklistItem>>,
    pub shade: Option<u8>,
    pub pinned: Option<bool>,
    pub locked: Option<bool>,
}

impl NotePatch {
    /// Changes the note body (needs access when the note is locked).
    pub fn touches_body(&self) -> bool {
        self.content.is_some() || self.plain.is_some() || self.items.is_some()
    }
}

pub fn aad(id: &str) -> Vec<u8> {
    format!("note:{id}").into_bytes()
}

pub fn create(
    conn: &Connection,
    key: &SecretKey,
    kind: &str,
    data: NoteData,
    now: i64,
) -> AppResult<Note> {
    if !KINDS.contains(&kind) {
        return Err(AppError::Invalid(format!("Unknown note type: {kind}")));
    }
    let id = super::new_id();
    let sealed = crypto::seal_json(key, &data, &aad(&id))?;
    conn.execute(
        "INSERT INTO notes (id, kind, data, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, kind, sealed, now],
    )?;
    get(conn, key, &id)
}

const COLUMNS: &str = "id, kind, shade, data, pinned, created_at, updated_at, deleted_at, locked";

struct RawRow {
    id: String,
    kind: String,
    shade: u8,
    data: Vec<u8>,
    pinned: bool,
    created_at: i64,
    updated_at: i64,
    deleted_at: Option<i64>,
    locked: bool,
}

fn raw(r: &Row) -> rusqlite::Result<RawRow> {
    Ok(RawRow {
        id: r.get(0)?,
        kind: r.get(1)?,
        shade: r.get(2)?,
        data: r.get(3)?,
        pinned: r.get(4)?,
        created_at: r.get(5)?,
        updated_at: r.get(6)?,
        deleted_at: r.get(7)?,
        locked: r.get(8)?,
    })
}

fn hydrate(key: &SecretKey, r: RawRow, links: Vec<String>) -> AppResult<Note> {
    let data: NoteData = crypto::open_json(key, &r.data, &aad(&r.id))?;
    Ok(Note {
        id: r.id,
        kind: r.kind,
        shade: r.shade,
        pinned: r.pinned,
        data,
        created_at: r.created_at,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
        linked_document_ids: links,
        locked: r.locked,
        revealed: false,
    })
}

fn links_by_note(conn: &Connection) -> AppResult<HashMap<String, Vec<String>>> {
    let mut stmt = conn.prepare(
        "SELECT l.note_id, l.document_id FROM links l JOIN documents d ON d.id = l.document_id
         WHERE d.deleted_at IS NULL",
    )?;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for row in stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))? {
        let (note, doc) = row?;
        map.entry(note).or_default().push(doc);
    }
    Ok(map)
}

pub fn list(conn: &Connection, key: &SecretKey, trashed: bool) -> AppResult<Vec<Note>> {
    let filter = if trashed {
        "deleted_at IS NOT NULL"
    } else {
        "deleted_at IS NULL"
    };
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM notes WHERE {filter} ORDER BY pinned DESC, updated_at DESC"
    ))?;
    let rows: Vec<RawRow> = stmt.query_map([], raw)?.collect::<Result<_, _>>()?;
    let mut links = links_by_note(conn)?;
    rows.into_iter()
        .map(|r| {
            let l = links.remove(&r.id).unwrap_or_default();
            hydrate(key, r, l)
        })
        .collect()
}

pub fn get(conn: &Connection, key: &SecretKey, id: &str) -> AppResult<Note> {
    let r = conn
        .query_row(
            &format!("SELECT {COLUMNS} FROM notes WHERE id = ?1"),
            [id],
            raw,
        )
        .optional()?
        .ok_or(AppError::NotFound)?;
    let links = links_by_note(conn)?.remove(id).unwrap_or_default();
    hydrate(key, r, links)
}

pub fn update(
    conn: &Connection,
    key: &SecretKey,
    id: &str,
    p: NotePatch,
    now: i64,
) -> AppResult<Note> {
    let current = get(conn, key, id)?;
    if p.title.is_some() || p.content.is_some() || p.plain.is_some() || p.items.is_some() {
        let data = NoteData {
            title: p.title.unwrap_or(current.data.title),
            content: p.content.unwrap_or(current.data.content),
            plain: p.plain.unwrap_or(current.data.plain),
            items: p.items.unwrap_or(current.data.items),
        };
        let sealed = crypto::seal_json(key, &data, &aad(id))?;
        conn.execute(
            "UPDATE notes SET data = ?1 WHERE id = ?2",
            params![sealed, id],
        )?;
    }
    if let Some(shade) = p.shade {
        conn.execute(
            "UPDATE notes SET shade = ?1 WHERE id = ?2",
            params![shade.min(4), id],
        )?;
    }
    if let Some(locked) = p.locked {
        conn.execute(
            "UPDATE notes SET locked = ?1 WHERE id = ?2",
            params![locked, id],
        )?;
    }
    if let Some(pinned) = p.pinned {
        conn.execute(
            "UPDATE notes SET pinned = ?1 WHERE id = ?2",
            params![pinned, id],
        )?;
    }
    conn.execute(
        "UPDATE notes SET updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    get(conn, key, id)
}

pub fn is_locked(conn: &Connection, id: &str) -> AppResult<bool> {
    conn.query_row("SELECT locked FROM notes WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(AppError::NotFound)
}

pub fn trash(conn: &Connection, id: &str, now: i64) -> AppResult<()> {
    conn.execute(
        "UPDATE notes SET deleted_at = ?1, pinned = 0 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn restore(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE notes SET deleted_at = NULL WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn delete_row(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn purge_expired(conn: &Connection, now: i64) -> AppResult<usize> {
    Ok(conn.execute(
        "DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
        params![now - super::documents::TRASH_RETENTION_MS],
    )?)
}

pub fn count(conn: &Connection) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL",
        [],
        |r| r.get(0),
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_update_list_and_encryption() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        let n = create(
            &conn,
            &key,
            "checklist",
            NoteData {
                title: "Groceries".into(),
                ..Default::default()
            },
            1,
        )
        .unwrap();
        let raw: Vec<u8> = conn
            .query_row("SELECT data FROM notes WHERE id = ?1", [&n.id], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(!String::from_utf8_lossy(&raw).contains("Groceries"));

        let items = vec![ChecklistItem {
            id: "a".into(),
            text: "Milk".into(),
            done: true,
        }];
        let n = update(
            &conn,
            &key,
            &n.id,
            NotePatch {
                items: Some(items.clone()),
                shade: Some(9),
                pinned: Some(true),
                ..Default::default()
            },
            2,
        )
        .unwrap();
        assert_eq!(n.data.items, items);
        assert_eq!(n.data.title, "Groceries");
        assert_eq!(n.shade, 4);
        assert!(n.pinned);
        assert_eq!(list(&conn, &key, false).unwrap().len(), 1);
        assert!(create(&conn, &key, "drawing", NoteData::default(), 3).is_err());
    }

    #[test]
    fn locked_notes_hide_their_body() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        let data = NoteData {
            title: "Bank".into(),
            content: "<p>PIN 1234</p>".into(),
            plain: "PIN 1234".into(),
            items: vec![],
        };
        let n = create(&conn, &key, "markdown", data, 1).unwrap();
        let patch = NotePatch {
            locked: Some(true),
            ..Default::default()
        };
        assert!(!patch.touches_body());
        let n = update(&conn, &key, &n.id, patch, 2).unwrap();
        assert!(is_locked(&conn, &n.id).unwrap());
        assert_eq!(crate::db::search::note_body(&n), "");
        let hidden = n.clone().with_access(false);
        assert_eq!((hidden.data.plain.as_str(), hidden.revealed), ("", false));
        assert_eq!(hidden.data.title, "Bank");
        let shown = n.with_access(true);
        assert_eq!(
            (shown.data.plain.as_str(), shown.revealed),
            ("PIN 1234", true)
        );
    }

    #[test]
    fn links_are_bidirectional() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        let n = create(&conn, &key, "markdown", NoteData::default(), 1).unwrap();
        let doc = super::super::documents::NewDocument {
            id: "d1".into(),
            kind: "pdf".into(),
            size: 1,
            meta: Default::default(),
            folder_id: None,
            reminder_offsets: vec![],
        };
        super::super::documents::insert(&conn, &key, &doc, 1).unwrap();
        super::super::documents::link(&conn, &n.id, "d1").unwrap();
        assert_eq!(
            get(&conn, &key, &n.id).unwrap().linked_document_ids,
            vec!["d1"]
        );
        let d = super::super::documents::get(&conn, &key, "d1").unwrap();
        assert_eq!(d.linked_note_ids, vec![n.id.clone()]);
        super::super::documents::unlink(&conn, &n.id, "d1").unwrap();
        assert!(get(&conn, &key, &n.id)
            .unwrap()
            .linked_document_ids
            .is_empty());
    }
}
