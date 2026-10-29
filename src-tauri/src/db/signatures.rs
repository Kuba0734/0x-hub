//! Stored signatures: transparent PNGs, encrypted with the DEK.

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::crypto::{self, SecretKey};
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Signature {
    pub id: String,
    pub width: u32,
    pub height: u32,
    pub created_at: i64,
}

pub fn aad(id: &str) -> Vec<u8> {
    format!("signature:{id}").into_bytes()
}

pub fn insert(
    conn: &Connection,
    key: &SecretKey,
    png: &[u8],
    width: u32,
    height: u32,
    now: i64,
) -> AppResult<Signature> {
    let id = super::new_id();
    let sealed = crypto::encrypt(key, png, &aad(&id))?;
    conn.execute(
        "INSERT INTO signatures (id, data, width, height, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, sealed, width, height, now],
    )?;
    Ok(Signature {
        id,
        width,
        height,
        created_at: now,
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Signature>> {
    let mut stmt = conn
        .prepare("SELECT id, width, height, created_at FROM signatures ORDER BY created_at DESC")?;
    let rows = stmt.query_map([], |r| {
        Ok(Signature {
            id: r.get(0)?,
            width: r.get(1)?,
            height: r.get(2)?,
            created_at: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Decrypted PNG bytes.
pub fn image(conn: &Connection, key: &SecretKey, id: &str) -> AppResult<Vec<u8>> {
    let sealed: Vec<u8> = conn
        .query_row("SELECT data FROM signatures WHERE id = ?1", [id], |r| {
            r.get(0)
        })
        .optional()?
        .ok_or(AppError::NotFound)?;
    crypto::decrypt(key, &sealed, &aad(id))
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    conn.execute("DELETE FROM signatures WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn insert_list_read_delete() {
        let conn = crate::db::open_in_memory().unwrap();
        let key = SecretKey::generate();
        let sig = insert(&conn, &key, b"png bytes", 300, 100, 5).unwrap();
        let raw: Vec<u8> = conn
            .query_row("SELECT data FROM signatures", [], |r| r.get(0))
            .unwrap();
        assert!(!raw.windows(3).any(|w| w == b"png"));
        assert_eq!(list(&conn).unwrap().len(), 1);
        assert_eq!(image(&conn, &key, &sig.id).unwrap(), b"png bytes");
        assert!(image(&conn, &SecretKey::generate(), &sig.id).is_err());
        delete(&conn, &sig.id).unwrap();
        assert!(matches!(
            image(&conn, &key, &sig.id),
            Err(AppError::NotFound)
        ));
    }
}
