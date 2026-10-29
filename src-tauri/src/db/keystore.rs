use rusqlite::{params, Connection, OptionalExtension};

use crate::crypto::KdfParams;
use crate::error::AppResult;

#[derive(Debug, Clone)]
pub struct KeystoreRow {
    pub kdf_salt: Vec<u8>,
    pub kdf: KdfParams,
    pub wrapped_dek: Vec<u8>,
    pub recovery_wrapped_dek: Vec<u8>,
    pub dek_check: Vec<u8>,
    pub hello_blob: Option<Vec<u8>>,
    pub failed_attempts: u32,
    pub last_failed_at: Option<i64>,
}

pub fn get(conn: &Connection) -> AppResult<Option<KeystoreRow>> {
    Ok(conn
        .query_row(
            "SELECT kdf_salt, kdf_m, kdf_t, kdf_p, wrapped_dek, recovery_wrapped_dek, dek_check,
                    hello_blob, failed_attempts, last_failed_at
             FROM keystore WHERE id = 1",
            [],
            |r| {
                Ok(KeystoreRow {
                    kdf_salt: r.get(0)?,
                    kdf: KdfParams {
                        m_cost_kib: r.get(1)?,
                        t_cost: r.get(2)?,
                        p_cost: r.get(3)?,
                    },
                    wrapped_dek: r.get(4)?,
                    recovery_wrapped_dek: r.get(5)?,
                    dek_check: r.get(6)?,
                    hello_blob: r.get(7)?,
                    failed_attempts: r.get(8)?,
                    last_failed_at: r.get(9)?,
                })
            },
        )
        .optional()?)
}

pub fn insert(conn: &Connection, row: &KeystoreRow) -> AppResult<()> {
    conn.execute(
        "INSERT INTO keystore (id, kdf_salt, kdf_m, kdf_t, kdf_p, wrapped_dek, recovery_wrapped_dek, dek_check)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            row.kdf_salt,
            row.kdf.m_cost_kib,
            row.kdf.t_cost,
            row.kdf.p_cost,
            row.wrapped_dek,
            row.recovery_wrapped_dek,
            row.dek_check
        ],
    )?;
    Ok(())
}

pub fn update_password_wrap(
    conn: &Connection,
    salt: &[u8],
    kdf: KdfParams,
    wrapped_dek: &[u8],
) -> AppResult<()> {
    conn.execute(
        "UPDATE keystore SET kdf_salt = ?1, kdf_m = ?2, kdf_t = ?3, kdf_p = ?4, wrapped_dek = ?5 WHERE id = 1",
        params![salt, kdf.m_cost_kib, kdf.t_cost, kdf.p_cost, wrapped_dek],
    )?;
    Ok(())
}

pub fn set_hello_blob(conn: &Connection, blob: Option<&[u8]>) -> AppResult<()> {
    conn.execute(
        "UPDATE keystore SET hello_blob = ?1 WHERE id = 1",
        params![blob],
    )?;
    Ok(())
}

pub fn record_failure(conn: &Connection, now: i64) -> AppResult<u32> {
    conn.execute(
        "UPDATE keystore SET failed_attempts = failed_attempts + 1, last_failed_at = ?1 WHERE id = 1",
        params![now],
    )?;
    Ok(conn.query_row(
        "SELECT failed_attempts FROM keystore WHERE id = 1",
        [],
        |r| r.get(0),
    )?)
}

pub fn reset_failures(conn: &Connection) -> AppResult<()> {
    conn.execute(
        "UPDATE keystore SET failed_attempts = 0, last_failed_at = NULL WHERE id = 1",
        [],
    )?;
    Ok(())
}

/// Exponential backoff: the first 3 attempts are free, then 1s, 2s, 4s, ... capped at 5 minutes.
pub fn backoff_ms(failed_attempts: u32) -> u64 {
    if failed_attempts < 3 {
        return 0;
    }
    let exp = (failed_attempts - 3).min(16);
    (1000u64 << exp).min(5 * 60 * 1000)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_grows_and_caps() {
        assert_eq!(backoff_ms(0), 0);
        assert_eq!(backoff_ms(2), 0);
        assert_eq!(backoff_ms(3), 1000);
        assert_eq!(backoff_ms(4), 2000);
        assert_eq!(backoff_ms(6), 8000);
        assert_eq!(backoff_ms(40), 300_000);
    }

    #[test]
    fn failure_counter_round_trip() {
        let conn = crate::db::open_in_memory().unwrap();
        insert(
            &conn,
            &KeystoreRow {
                kdf_salt: vec![1; 16],
                kdf: KdfParams::default(),
                wrapped_dek: vec![2; 60],
                recovery_wrapped_dek: vec![3; 60],
                dek_check: vec![4; 40],
                hello_blob: None,
                failed_attempts: 0,
                last_failed_at: None,
            },
        )
        .unwrap();
        assert_eq!(record_failure(&conn, 1).unwrap(), 1);
        assert_eq!(record_failure(&conn, 2).unwrap(), 2);
        reset_failures(&conn).unwrap();
        assert_eq!(get(&conn).unwrap().unwrap().failed_attempts, 0);
    }
}
