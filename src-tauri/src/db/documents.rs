use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::crypto::{self, SecretKey};
use crate::error::{AppError, AppResult};

pub const TRASH_RETENTION_MS: i64 = 30 * 24 * 60 * 60 * 1000;

/// Sensitive document fields, stored encrypted in `documents.meta`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DocumentMeta {
    pub title: String,
    pub filename: String,
    pub mime: String,
    pub tags: Vec<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub title: String,
    pub filename: String,
    pub mime: String,
    pub kind: String,
    pub size: i64,
    pub category_id: Option<String>,
    pub tags: Vec<String>,
    pub description: String,
    pub expires_on: Option<String>,
    pub reminder_offsets: Vec<u32>,
    pub pinned: bool,
    pub ocr_status: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub deleted_at: Option<i64>,
    pub linked_note_ids: Vec<String>,
}

/// Partial update. Empty strings for `category_id` / `expires_on` clear the value.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct DocumentPatch {
    pub title: Option<String>,
    pub category_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub description: Option<String>,
    pub expires_on: Option<String>,
    pub reminder_offsets: Option<Vec<u32>>,
    pub pinned: Option<bool>,
}

pub struct NewDocument {
    pub id: String,
    pub kind: String,
    pub size: i64,
    pub meta: DocumentMeta,
    pub category_id: Option<String>,
    pub reminder_offsets: Vec<u32>,
}

pub fn meta_aad(id: &str) -> Vec<u8> {
    format!("doc-meta:{id}").into_bytes()
}
pub fn ocr_aad(id: &str) -> Vec<u8> {
    format!("doc-ocr:{id}").into_bytes()
}
pub fn file_aad(id: &str) -> Vec<u8> {
    format!("doc-file:{id}").into_bytes()
}

/// Maps a filename to `(kind, mime)`.
pub fn classify(filename: &str) -> (&'static str, &'static str) {
    let ext = filename
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "pdf" => ("pdf", "application/pdf"),
        "png" => ("image", "image/png"),
        "jpg" | "jpeg" => ("image", "image/jpeg"),
        "webp" => ("image", "image/webp"),
        "gif" => ("image", "image/gif"),
        "bmp" => ("image", "image/bmp"),
        "heic" => ("image", "image/heic"),
        "heif" => ("image", "image/heif"),
        "tif" | "tiff" => ("image", "image/tiff"),
        "docx" => (
            "office",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        "xlsx" => (
            "office",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
        "pptx" => (
            "office",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ),
        "doc" | "xls" | "ppt" | "odt" | "ods" | "odp" => ("office", "application/octet-stream"),
        "txt" | "md" | "csv" | "log" | "json" => ("text", "text/plain"),
        _ => ("generic", "application/octet-stream"),
    }
}

pub fn insert(conn: &Connection, key: &SecretKey, d: &NewDocument, now: i64) -> AppResult<()> {
    let meta = crypto::seal_json(key, &d.meta, &meta_aad(&d.id))?;
    conn.execute(
        "INSERT INTO documents (id, category_id, kind, size, meta, reminder_offsets, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)",
        params![
            d.id,
            d.category_id,
            d.kind,
            d.size,
            meta,
            serde_json::to_string(&d.reminder_offsets)?,
            now
        ],
    )?;
    Ok(())
}

const COLUMNS: &str = "id, category_id, kind, size, meta, ocr_status, expires_on, reminder_offsets,
                       pinned, created_at, updated_at, deleted_at";

struct RawRow {
    id: String,
    category_id: Option<String>,
    kind: String,
    size: i64,
    meta: Vec<u8>,
    ocr_status: String,
    expires_on: Option<String>,
    reminder_offsets: String,
    pinned: bool,
    created_at: i64,
    updated_at: i64,
    deleted_at: Option<i64>,
}

fn raw(r: &Row) -> rusqlite::Result<RawRow> {
    Ok(RawRow {
        id: r.get(0)?,
        category_id: r.get(1)?,
        kind: r.get(2)?,
        size: r.get(3)?,
        meta: r.get(4)?,
        ocr_status: r.get(5)?,
        expires_on: r.get(6)?,
        reminder_offsets: r.get(7)?,
        pinned: r.get(8)?,
        created_at: r.get(9)?,
        updated_at: r.get(10)?,
        deleted_at: r.get(11)?,
    })
}

fn hydrate(key: &SecretKey, r: RawRow, links: Vec<String>) -> AppResult<Document> {
    let meta: DocumentMeta = crypto::open_json(key, &r.meta, &meta_aad(&r.id))?;
    Ok(Document {
        title: meta.title,
        filename: meta.filename,
        mime: meta.mime,
        tags: meta.tags,
        description: meta.description,
        id: r.id,
        kind: r.kind,
        size: r.size,
        category_id: r.category_id,
        expires_on: r.expires_on,
        reminder_offsets: serde_json::from_str(&r.reminder_offsets).unwrap_or_default(),
        pinned: r.pinned,
        ocr_status: r.ocr_status,
        created_at: r.created_at,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
        linked_note_ids: links,
    })
}

fn links_by_document(conn: &Connection) -> AppResult<HashMap<String, Vec<String>>> {
    let mut stmt = conn.prepare(
        "SELECT l.document_id, l.note_id FROM links l JOIN notes n ON n.id = l.note_id
         WHERE n.deleted_at IS NULL",
    )?;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for row in stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))? {
        let (doc, note) = row?;
        map.entry(doc).or_default().push(note);
    }
    Ok(map)
}

/// Lists active documents, or only trashed ones when `trashed` is true.
pub fn list(conn: &Connection, key: &SecretKey, trashed: bool) -> AppResult<Vec<Document>> {
    let filter = if trashed {
        "deleted_at IS NOT NULL"
    } else {
        "deleted_at IS NULL"
    };
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLUMNS} FROM documents WHERE {filter} ORDER BY updated_at DESC"
    ))?;
    let rows: Vec<RawRow> = stmt.query_map([], raw)?.collect::<Result<_, _>>()?;
    let mut links = links_by_document(conn)?;
    rows.into_iter()
        .map(|r| {
            let l = links.remove(&r.id).unwrap_or_default();
            hydrate(key, r, l)
        })
        .collect()
}

pub fn get(conn: &Connection, key: &SecretKey, id: &str) -> AppResult<Document> {
    let r = conn
        .query_row(
            &format!("SELECT {COLUMNS} FROM documents WHERE id = ?1"),
            [id],
            raw,
        )
        .optional()?
        .ok_or(AppError::NotFound)?;
    let links = links_by_document(conn)?.remove(id).unwrap_or_default();
    hydrate(key, r, links)
}

fn validate_date(s: &str) -> AppResult<()> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| AppError::Invalid("Dates must look like 2026-12-31".into()))
}

pub fn update(
    conn: &Connection,
    key: &SecretKey,
    id: &str,
    p: DocumentPatch,
    now: i64,
) -> AppResult<Document> {
    let current = get(conn, key, id)?;
    if p.title.is_some() || p.tags.is_some() || p.description.is_some() {
        let meta = DocumentMeta {
            title: p
                .title
                .map(|t| t.trim().to_string())
                .unwrap_or(current.title),
            filename: current.filename,
            mime: current.mime,
            tags: p.tags.map(normalize_tags).unwrap_or(current.tags),
            description: p.description.unwrap_or(current.description),
        };
        if meta.title.is_empty() {
            return Err(AppError::Invalid("A title is required".into()));
        }
        let sealed = crypto::seal_json(key, &meta, &meta_aad(id))?;
        conn.execute(
            "UPDATE documents SET meta = ?1 WHERE id = ?2",
            params![sealed, id],
        )?;
    }
    if let Some(cat) = p.category_id {
        let v = if cat.is_empty() { None } else { Some(cat) };
        conn.execute(
            "UPDATE documents SET category_id = ?1 WHERE id = ?2",
            params![v, id],
        )?;
    }
    if let Some(exp) = p.expires_on {
        let v = if exp.is_empty() {
            None
        } else {
            validate_date(&exp)?;
            Some(exp)
        };
        conn.execute(
            "UPDATE documents SET expires_on = ?1 WHERE id = ?2",
            params![v, id],
        )?;
    }
    if let Some(mut offsets) = p.reminder_offsets {
        offsets.sort_unstable_by(|a, b| b.cmp(a));
        offsets.dedup();
        conn.execute(
            "UPDATE documents SET reminder_offsets = ?1 WHERE id = ?2",
            params![serde_json::to_string(&offsets)?, id],
        )?;
    }
    if let Some(pinned) = p.pinned {
        conn.execute(
            "UPDATE documents SET pinned = ?1 WHERE id = ?2",
            params![pinned, id],
        )?;
    }
    conn.execute(
        "UPDATE documents SET updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    get(conn, key, id)
}

pub fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for t in tags {
        let t = t.trim().trim_start_matches('#').to_lowercase();
        if !t.is_empty() && t.chars().count() <= 32 && !out.contains(&t) {
            out.push(t);
        }
    }
    out
}

pub fn set_ocr(
    conn: &Connection,
    key: &SecretKey,
    id: &str,
    text: Option<&str>,
    status: &str,
) -> AppResult<()> {
    let sealed = match text {
        Some(t) => Some(crypto::encrypt(key, t.as_bytes(), &ocr_aad(id))?),
        None => None,
    };
    conn.execute(
        "UPDATE documents SET ocr = COALESCE(?1, ocr), ocr_status = ?2 WHERE id = ?3",
        params![sealed, status, id],
    )?;
    Ok(())
}

pub fn set_ocr_status(conn: &Connection, id: &str, status: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE documents SET ocr_status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn ocr_text(conn: &Connection, key: &SecretKey, id: &str) -> AppResult<Option<String>> {
    let blob: Option<Vec<u8>> = conn
        .query_row("SELECT ocr FROM documents WHERE id = ?1", [id], |r| {
            r.get(0)
        })
        .optional()?
        .flatten();
    match blob {
        Some(b) => {
            let bytes = crypto::decrypt(key, &b, &ocr_aad(id))?;
            Ok(Some(String::from_utf8_lossy(&bytes).into_owned()))
        }
        None => Ok(None),
    }
}

pub fn trash(conn: &Connection, id: &str, now: i64) -> AppResult<()> {
    conn.execute(
        "UPDATE documents SET deleted_at = ?1, pinned = 0 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn restore(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE documents SET deleted_at = NULL WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn delete_row(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;
    Ok(())
}

/// Ids of trashed documents older than the retention window.
pub fn expired_trash(conn: &Connection, now: i64) -> AppResult<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT id FROM documents WHERE deleted_at IS NOT NULL AND deleted_at < ?1")?;
    let ids = stmt.query_map([now - TRASH_RETENTION_MS], |r| r.get(0))?;
    Ok(ids.collect::<Result<_, _>>()?)
}

pub fn ids_needing_ocr(conn: &Connection) -> AppResult<Vec<String>> {
    let mut stmt = conn.prepare(
        "SELECT id FROM documents WHERE deleted_at IS NULL AND ocr_status IN ('pending', 'running')
         AND kind IN ('image', 'pdf')",
    )?;
    let ids = stmt.query_map([], |r| r.get(0))?;
    Ok(ids.collect::<Result<_, _>>()?)
}

/// Plaintext columns only, so the reminder scheduler can run while the vault is locked.
pub struct ExpiryRow {
    pub id: String,
    pub expires_on: String,
    pub offsets: Vec<u32>,
}

pub fn with_expiry(conn: &Connection) -> AppResult<Vec<ExpiryRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, expires_on, reminder_offsets FROM documents
         WHERE deleted_at IS NULL AND expires_on IS NOT NULL",
    )?;
    let rows = stmt.query_map([], |r| {
        let offsets: String = r.get(2)?;
        Ok(ExpiryRow {
            id: r.get(0)?,
            expires_on: r.get(1)?,
            offsets: serde_json::from_str(&offsets).unwrap_or_default(),
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

pub fn reminder_sent(
    conn: &Connection,
    id: &str,
    offset: u32,
    expires_on: &str,
) -> AppResult<bool> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM reminder_log WHERE document_id = ?1 AND offset_days = ?2 AND expires_on = ?3",
        params![id, offset, expires_on],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

pub fn log_reminder(
    conn: &Connection,
    id: &str,
    offset: u32,
    expires_on: &str,
    now: i64,
) -> AppResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO reminder_log (document_id, offset_days, expires_on, sent_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, offset, expires_on, now],
    )?;
    Ok(())
}

pub fn storage_used(conn: &Connection) -> AppResult<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(SUM(size), 0) FROM documents WHERE deleted_at IS NULL",
        [],
        |r| r.get(0),
    )?)
}

pub fn link(conn: &Connection, note_id: &str, document_id: &str) -> AppResult<()> {
    conn.execute(
        "INSERT OR IGNORE INTO links (note_id, document_id) VALUES (?1, ?2)",
        params![note_id, document_id],
    )?;
    Ok(())
}

pub fn unlink(conn: &Connection, note_id: &str, document_id: &str) -> AppResult<()> {
    conn.execute(
        "DELETE FROM links WHERE note_id = ?1 AND document_id = ?2",
        params![note_id, document_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(id: &str) -> NewDocument {
        NewDocument {
            id: id.into(),
            kind: "pdf".into(),
            size: 1234,
            meta: DocumentMeta {
                title: "Passport".into(),
                filename: "passport.pdf".into(),
                mime: "application/pdf".into(),
                tags: vec!["travel".into()],
                description: String::new(),
            },
            category_id: Some("ids".into()),
            reminder_offsets: vec![90, 30],
        }
    }

    #[test]
    fn insert_get_update_and_meta_is_encrypted() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        insert(&conn, &key, &sample("d1"), 1).unwrap();

        let raw_meta: Vec<u8> = conn
            .query_row("SELECT meta FROM documents WHERE id='d1'", [], |r| r.get(0))
            .unwrap();
        assert!(!String::from_utf8_lossy(&raw_meta).contains("Passport"));

        let doc = get(&conn, &key, "d1").unwrap();
        assert_eq!(doc.title, "Passport");
        assert_eq!(doc.reminder_offsets, vec![90, 30]);

        let patch = DocumentPatch {
            title: Some("Passport (renewed)".into()),
            tags: Some(vec!["#Travel".into(), "id".into(), "travel".into()]),
            expires_on: Some("2030-01-31".into()),
            category_id: Some(String::new()),
            ..Default::default()
        };
        let doc = update(&conn, &key, "d1", patch, 2).unwrap();
        assert_eq!(doc.title, "Passport (renewed)");
        assert_eq!(doc.tags, vec!["travel", "id"]);
        assert_eq!(doc.expires_on.as_deref(), Some("2030-01-31"));
        assert_eq!(doc.category_id, None);

        let bad = DocumentPatch {
            expires_on: Some("31.01.2030".into()),
            ..Default::default()
        };
        assert!(update(&conn, &key, "d1", bad, 3).is_err());
    }

    #[test]
    fn trash_restore_and_purge_window() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        insert(&conn, &key, &sample("d1"), 1).unwrap();
        trash(&conn, "d1", 1000).unwrap();
        assert_eq!(list(&conn, &key, false).unwrap().len(), 0);
        assert_eq!(list(&conn, &key, true).unwrap().len(), 1);
        assert!(expired_trash(&conn, 1000 + TRASH_RETENTION_MS - 1)
            .unwrap()
            .is_empty());
        assert_eq!(
            expired_trash(&conn, 1001 + TRASH_RETENTION_MS).unwrap(),
            vec!["d1"]
        );
        restore(&conn, "d1").unwrap();
        assert_eq!(list(&conn, &key, false).unwrap().len(), 1);
    }

    #[test]
    fn ocr_text_round_trip() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        insert(&conn, &key, &sample("d1"), 1).unwrap();
        assert_eq!(ocr_text(&conn, &key, "d1").unwrap(), None);
        set_ocr(&conn, &key, "d1", Some("REPUBLIC OF NOWHERE"), "done").unwrap();
        assert_eq!(
            ocr_text(&conn, &key, "d1").unwrap().as_deref(),
            Some("REPUBLIC OF NOWHERE")
        );
    }

    #[test]
    fn classify_by_extension() {
        assert_eq!(classify("a.PDF").0, "pdf");
        assert_eq!(classify("photo.jpeg").0, "image");
        assert_eq!(classify("sheet.xlsx").0, "office");
        assert_eq!(classify("readme").0, "generic");
        assert_eq!(classify("IMG_0042.HEIC"), ("image", "image/heic"));
    }
}
