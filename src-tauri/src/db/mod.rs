pub mod documents;
pub mod folders;
pub mod integrity;
pub mod keystore;
mod migrations;
pub mod notes;
pub mod search;
pub mod settings;
pub mod signatures;

use std::path::Path;

use rusqlite::Connection;

use crate::error::AppResult;

pub use migrations::migrations;

/// Opens (or creates) the database, applies pragmas and migrations, and attaches the
/// in-memory database that holds the plaintext search index while the vault is unlocked.
pub fn open(path: &Path) -> AppResult<Connection> {
    let mut conn = Connection::open(path)?;
    configure(&mut conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> AppResult<Connection> {
    let mut conn = Connection::open_in_memory()?;
    configure(&mut conn)?;
    Ok(conn)
}

fn configure(conn: &mut Connection) -> AppResult<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "secure_delete", "ON")?;
    migrations().to_latest(conn)?;
    conn.execute_batch("ATTACH DATABASE ':memory:' AS mem;")?;
    Ok(())
}

/// Work that needs the DEK right after setup, unlock or restore: converts old
/// categories into folders and rebuilds the in-memory search index.
pub fn on_unlock(conn: &Connection, key: &crate::crypto::SecretKey) -> AppResult<()> {
    folders::adopt_categories(conn, key, now_ms())?;
    search::rebuild(conn, key)
}

pub fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}
