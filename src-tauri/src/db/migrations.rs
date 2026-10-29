use rusqlite_migration::{Migrations, M};

/// Numbered schema migrations. Never edit an existing entry; append a new one.
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        // 1: core schema
        M::up(
            r#"
            CREATE TABLE keystore (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                kdf_salt BLOB NOT NULL,
                kdf_m INTEGER NOT NULL,
                kdf_t INTEGER NOT NULL,
                kdf_p INTEGER NOT NULL,
                wrapped_dek BLOB NOT NULL,
                recovery_wrapped_dek BLOB NOT NULL,
                dek_check BLOB NOT NULL,
                hello_blob BLOB,
                failed_attempts INTEGER NOT NULL DEFAULT 0,
                last_failed_at INTEGER
            );

            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sort INTEGER NOT NULL
            );

            CREATE TABLE documents (
                id TEXT PRIMARY KEY,
                category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
                kind TEXT NOT NULL,
                size INTEGER NOT NULL,
                meta BLOB NOT NULL,
                ocr BLOB,
                ocr_status TEXT NOT NULL DEFAULT 'none',
                expires_on TEXT,
                reminder_offsets TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                deleted_at INTEGER
            );
            CREATE INDEX idx_documents_expires ON documents(expires_on) WHERE deleted_at IS NULL;

            CREATE TABLE notes (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                shade INTEGER NOT NULL DEFAULT 0,
                data BLOB NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                deleted_at INTEGER
            );

            CREATE TABLE links (
                note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                PRIMARY KEY (note_id, document_id)
            );

            CREATE TABLE reminder_log (
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                offset_days INTEGER NOT NULL,
                expires_on TEXT NOT NULL,
                sent_at INTEGER NOT NULL,
                PRIMARY KEY (document_id, offset_days, expires_on)
            );
            "#,
        ),
        // 2: default categories
        M::up(
            r#"
            INSERT INTO categories (id, name, sort) VALUES
                ('ids', 'IDs', 0),
                ('contracts', 'Contracts', 1),
                ('insurance', 'Insurance', 2),
                ('taxes', 'Taxes', 3),
                ('medical', 'Medical', 4),
                ('finance', 'Finance', 5),
                ('other', 'Other', 6);
            "#,
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_valid() {
        assert!(migrations().validate().is_ok());
    }

    #[test]
    fn migrations_apply_to_fresh_db() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        migrations().to_latest(&mut conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 7);
        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 2);
    }
}
