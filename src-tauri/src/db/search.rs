//! Full-text search. The FTS5 index lives in the attached in-memory database (`mem`), so
//! plaintext never touches the disk. It is rebuilt on unlock and dropped on lock.

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::crypto::SecretKey;
use crate::error::AppResult;

use super::{documents, notes};

/// Snippet highlight markers; the frontend splits on these.
pub const MARK_START: &str = "\u{2}";
pub const MARK_END: &str = "\u{3}";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub kind: String,
    pub id: String,
    pub title: String,
    pub snippet: String,
    pub sub_kind: String,
}

pub fn create_index(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS mem.search_index USING fts5(
            kind UNINDEXED, ref_id UNINDEXED, sub_kind UNINDEXED, title, body,
            tokenize = 'unicode61 remove_diacritics 2'
        );",
    )?;
    Ok(())
}

pub fn drop_index(conn: &Connection) -> AppResult<()> {
    conn.execute_batch("DROP TABLE IF EXISTS mem.search_index;")?;
    Ok(())
}

pub fn upsert(
    conn: &Connection,
    kind: &str,
    id: &str,
    sub_kind: &str,
    title: &str,
    body: &str,
) -> AppResult<()> {
    remove(conn, id)?;
    conn.execute(
        "INSERT INTO mem.search_index (kind, ref_id, sub_kind, title, body) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![kind, id, sub_kind, title, body],
    )?;
    Ok(())
}

pub fn remove(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM mem.search_index WHERE ref_id = ?1", [id])?;
    Ok(())
}

/// Locked documents are only findable by title, filename and tags: their notes and OCR
/// text stay out of the index so search snippets can't reveal content.
pub fn document_body(doc: &documents::Document, ocr: Option<&str>) -> String {
    if doc.locked {
        return format!("{} {}", doc.filename, doc.tags.join(" "));
    }
    let mut body = format!(
        "{} {} {}",
        doc.filename,
        doc.tags.join(" "),
        doc.description
    );
    if let Some(t) = ocr {
        body.push(' ');
        body.push_str(t);
    }
    body
}

pub fn note_body(note: &notes::Note) -> String {
    let mut body = note.data.plain.clone();
    for item in &note.data.items {
        body.push(' ');
        body.push_str(&item.text);
    }
    body
}

pub fn index_document(
    conn: &Connection,
    key: &SecretKey,
    doc: &documents::Document,
) -> AppResult<()> {
    let ocr = documents::ocr_text(conn, key, &doc.id)?;
    upsert(
        conn,
        "document",
        &doc.id,
        &doc.kind,
        &doc.title,
        &document_body(doc, ocr.as_deref()),
    )
}

pub fn index_note(conn: &Connection, note: &notes::Note) -> AppResult<()> {
    upsert(
        conn,
        "note",
        &note.id,
        &note.kind,
        &note.data.title,
        &note_body(note),
    )
}

/// Drops and rebuilds the whole index from decrypted data.
pub fn rebuild(conn: &Connection, key: &SecretKey) -> AppResult<()> {
    drop_index(conn)?;
    create_index(conn)?;
    for doc in documents::list(conn, key, false)? {
        index_document(conn, key, &doc)?;
    }
    for note in notes::list(conn, key, false)? {
        index_note(conn, &note)?;
    }
    Ok(())
}

/// Turns user input into a safe FTS5 query: every term quoted and prefix-matched, AND-joined.
pub fn build_query(input: &str) -> Option<String> {
    let terms: Vec<String> = input
        .split_whitespace()
        .map(|t| t.replace('"', ""))
        .filter(|t| !t.is_empty())
        .map(|t| format!("\"{t}\"*"))
        .collect();
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

pub fn query(conn: &Connection, input: &str, limit: u32) -> AppResult<Vec<SearchHit>> {
    let Some(q) = build_query(input) else {
        return Ok(vec![]);
    };
    let mut stmt = conn.prepare(
        "SELECT kind, ref_id, sub_kind, title,
                snippet(search_index, 4, ?2, ?3, '…', 14)
         FROM mem.search_index WHERE search_index MATCH ?1
         ORDER BY bm25(search_index, 0, 0, 0, 4.0, 1.0) LIMIT ?4",
    )?;
    let rows = stmt.query_map(params![q, MARK_START, MARK_END, limit], |r| {
        Ok(SearchHit {
            kind: r.get(0)?,
            id: r.get(1)?,
            sub_kind: r.get(2)?,
            title: r.get(3)?,
            snippet: r.get(4)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn locked_documents_hide_content_from_index() {
        use super::documents::{self, DocumentMeta, DocumentPatch, NewDocument};
        let conn = crate::db::open_in_memory().unwrap();
        create_index(&conn).unwrap();
        let key = SecretKey::generate();
        let new = NewDocument {
            id: "d1".into(),
            kind: "pdf".into(),
            size: 1,
            meta: DocumentMeta {
                title: "Bank letter".into(),
                description: "pin 4711".into(),
                ..Default::default()
            },
            category_id: None,
            reminder_offsets: vec![],
        };
        documents::insert(&conn, &key, &new, 1).unwrap();
        documents::set_ocr(&conn, &key, "d1", Some("IBAN DE89"), "done").unwrap();
        let patch = DocumentPatch {
            locked: Some(true),
            ..Default::default()
        };
        let doc = documents::update(&conn, &key, "d1", patch, 2).unwrap();
        index_document(&conn, &key, &doc).unwrap();
        assert!(query(&conn, "4711", 5).unwrap().is_empty());
        assert!(query(&conn, "DE89", 5).unwrap().is_empty());
        assert_eq!(query(&conn, "bank", 5).unwrap().len(), 1);
        assert!(documents::is_locked(&conn, "d1").unwrap());
        let hidden = doc.with_access(false);
        assert!(hidden.description.is_empty() && !hidden.revealed);
    }

    #[test]
    fn query_builder_escapes() {
        assert_eq!(build_query("  "), None);
        assert_eq!(
            build_query("tax 2026").as_deref(),
            Some("\"tax\"* \"2026\"*")
        );
        assert_eq!(
            build_query("a\" OR b").as_deref(),
            Some("\"a\"* \"OR\"* \"b\"*")
        );
    }

    #[test]
    fn index_is_in_memory_and_searchable() {
        let conn = crate::db::open_in_memory().unwrap();
        create_index(&conn).unwrap();
        upsert(
            &conn,
            "note",
            "n1",
            "markdown",
            "Holiday plans",
            "Flights to Lisbon in May",
        )
        .unwrap();
        upsert(
            &conn,
            "document",
            "d1",
            "pdf",
            "Insurance",
            "policy number 4711",
        )
        .unwrap();
        let hits = query(&conn, "lisb", 10).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "n1");
        assert!(hits[0].snippet.contains(MARK_START));
        assert_eq!(query(&conn, "4711", 10).unwrap()[0].id, "d1");
        remove(&conn, "d1").unwrap();
        assert!(query(&conn, "4711", 10).unwrap().is_empty());
        let main_tables: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM main.sqlite_master WHERE name LIKE 'search_index%'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(main_tables, 0);
    }
}
