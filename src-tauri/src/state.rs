use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::crypto::{KdfParams, SecretKey};
use crate::db;
use crate::error::{AppError, AppResult};
use crate::paths::Paths;

/// Shared backend state. The DEK only ever lives here, never in the frontend.
pub struct AppState {
    pub paths: Paths,
    pub kdf: KdfParams,
    db: Mutex<Connection>,
    dek: Mutex<Option<SecretKey>>,
    last_activity: AtomicI64,
}

fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    // A panic while holding the lock must not brick the app; the data is still consistent
    // because every write is a single SQL statement or an atomic swap.
    m.lock().unwrap_or_else(|e| e.into_inner())
}

impl AppState {
    pub fn open(paths: Paths, kdf: KdfParams) -> AppResult<Self> {
        paths.ensure()?;
        let conn = db::open(&paths.db)?;
        Ok(AppState {
            paths,
            kdf,
            db: Mutex::new(conn),
            dek: Mutex::new(None),
            last_activity: AtomicI64::new(db::now_ms()),
        })
    }

    pub fn db(&self) -> MutexGuard<'_, Connection> {
        lock(&self.db)
    }

    /// Replaces the database connection, e.g. after a backup restore.
    pub fn reopen_db(&self) -> AppResult<()> {
        let conn = db::open(&self.paths.db)?;
        *lock(&self.db) = conn;
        Ok(())
    }

    /// Closes the database file so it can be replaced, by swapping in an in-memory connection.
    pub fn detach_db(&self) -> AppResult<()> {
        *lock(&self.db) = db::open_in_memory()?;
        Ok(())
    }

    pub fn key(&self) -> AppResult<SecretKey> {
        lock(&self.dek).clone().ok_or(AppError::Locked)
    }

    pub fn is_unlocked(&self) -> bool {
        lock(&self.dek).is_some()
    }

    pub fn set_key(&self, key: Option<SecretKey>) {
        *lock(&self.dek) = key;
    }

    pub fn touch(&self) {
        self.last_activity.store(db::now_ms(), Ordering::Relaxed);
    }

    pub fn idle_ms(&self) -> i64 {
        db::now_ms() - self.last_activity.load(Ordering::Relaxed)
    }
}
