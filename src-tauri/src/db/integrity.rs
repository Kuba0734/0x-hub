//! Raw encrypted rows for the integrity check, and the last check's report.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppResult;
use crate::integrity::Report;

const REPORT_KEY: &str = "integrity_report";

pub struct DocumentRow {
    pub id: String,
    pub size: i64,
    pub meta: Vec<u8>,
    pub ocr: Option<Vec<u8>>,
}

/// All documents, trashed ones included (they are still restorable).
pub fn document_rows(conn: &Connection) -> AppResult<Vec<DocumentRow>> {
    let mut stmt = conn.prepare("SELECT id, size, meta, ocr FROM documents")?;
    let rows = stmt.query_map([], |r| {
        Ok(DocumentRow {
            id: r.get(0)?,
            size: r.get(1)?,
            meta: r.get(2)?,
            ocr: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// `(id, sealed blob)` pairs of a table with an `id` and a `data` column.
pub fn sealed_rows(conn: &Connection, table: &str) -> AppResult<Vec<(String, Vec<u8>)>> {
    let sql = match table {
        "notes" => "SELECT id, data FROM notes",
        _ => "SELECT id, data FROM signatures",
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// SQLite's own structural check of the main database ("ok" when healthy).
pub fn quick_check(conn: &Connection) -> AppResult<String> {
    Ok(conn.query_row("PRAGMA main.quick_check", [], |r| r.get(0))?)
}

pub fn save_report(conn: &Connection, report: &Report) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![REPORT_KEY, serde_json::to_string(report)?],
    )?;
    Ok(())
}

pub fn last_report(conn: &Connection) -> AppResult<Option<Report>> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [REPORT_KEY],
            |r| r.get(0),
        )
        .optional()?;
    Ok(raw.and_then(|r| serde_json::from_str(&r).ok()))
}
