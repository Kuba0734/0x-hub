//! `.0xbackup` export/import: a ZIP holding a consistent DB snapshot and the encrypted
//! vault blobs. Nothing is decrypted, so a backup is exactly as safe as the vault itself.

use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::crypto;
use crate::db::{self, keystore, settings};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub mod verify;

pub const EXTENSION: &str = "0xbackup";
const MANIFEST: &str = "manifest.json";
const DB_ENTRY: &str = "hub.db";
const AUTO_PREFIX: &str = "0x-hub-auto-";
const AUTO_KEEP: usize = 10;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    app: String,
    format: u32,
    app_version: String,
    created_at: i64,
}

pub fn export(state: &AppState, target: &Path) -> AppResult<()> {
    let work = tempdir_in(&state.paths.root)?;
    let snapshot = work.join(DB_ENTRY);
    {
        let conn = state.db();
        conn.execute("VACUUM main INTO ?1", [snapshot.to_string_lossy().as_ref()])?;
    }
    let result = write_archive(state, &snapshot, target);
    let _ = std::fs::remove_dir_all(&work);
    result
}

fn write_archive(state: &AppState, snapshot: &Path, target: &Path) -> AppResult<()> {
    let tmp_target = target.with_extension("partial");
    let mut zip = ZipWriter::new(File::create(&tmp_target)?);
    let deflate = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let stored = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Stored)
        .large_file(true);

    let manifest = Manifest {
        app: "0x-hub".into(),
        format: 1,
        app_version: env!("CARGO_PKG_VERSION").into(),
        created_at: db::now_ms(),
    };
    zip.start_file(MANIFEST, deflate)?;
    zip.write_all(&serde_json::to_vec_pretty(&manifest)?)?;

    zip.start_file(DB_ENTRY, deflate)?;
    zip.write_all(&std::fs::read(snapshot)?)?;

    for entry in std::fs::read_dir(&state.paths.vault)? {
        let path = entry?.path();
        if path.extension().is_some_and(|e| e == "bin") {
            let name = path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            zip.start_file(format!("vault/{name}"), stored)?;
            let mut f = File::open(&path)?;
            std::io::copy(&mut f, &mut zip)?;
        }
    }
    zip.finish()?;
    std::fs::rename(&tmp_target, target)?;
    Ok(())
}

fn tempdir_in(root: &Path) -> AppResult<PathBuf> {
    let dir = root.join(format!("tmp-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Accepts only `vault/<name>.bin` with a plain file name.
fn vault_entry_name(name: &str) -> Option<&str> {
    let file = name.strip_prefix("vault/")?;
    let valid = file.ends_with(".bin")
        && !file.contains(['/', '\\'])
        && !file.contains("..")
        && file.len() <= 64;
    valid.then_some(file)
}

/// Restores a backup, replacing the current vault. `password` must be the master
/// password that was active when the backup was made. Leaves the vault unlocked.
pub fn import(state: &AppState, source: &Path, password: &str) -> AppResult<()> {
    let mut archive = ZipArchive::new(File::open(source)?)?;
    let manifest: Manifest = {
        let mut s = String::new();
        archive.by_name(MANIFEST)?.read_to_string(&mut s)?;
        serde_json::from_str(&s)
            .map_err(|_| AppError::Backup("This is not a 0x-hub backup".into()))?
    };
    if manifest.app != "0x-hub" || manifest.format != 1 {
        return Err(AppError::Backup(
            "This backup format is not supported".into(),
        ));
    }

    let work = tempdir_in(&state.paths.root)?;
    let result = (|| -> AppResult<()> {
        let db_path = work.join(DB_ENTRY);
        std::io::copy(
            &mut archive.by_name(DB_ENTRY)?,
            &mut File::create(&db_path)?,
        )?;

        // Verify the password against the backup's own keystore before touching anything.
        let dek = {
            let conn = db::open(&db_path)?;
            let row = keystore::get(&conn)?
                .ok_or_else(|| AppError::Backup("The backup has no keystore".into()))?;
            let kek = crypto::derive_kek(password.as_bytes(), &row.kdf_salt, row.kdf)?;
            crypto::unwrap_key(&kek, &row.wrapped_dek)
                .map_err(|_| AppError::WrongPassword { retry_after_ms: 0 })?
        };

        let staged_vault = work.join("vault");
        std::fs::create_dir_all(&staged_vault)?;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i)?;
            let name = entry.name().to_string();
            if let Some(file) = vault_entry_name(&name) {
                std::io::copy(&mut entry, &mut File::create(staged_vault.join(file))?)?;
            }
        }

        crate::auth::lock(state)?;
        state.detach_db()?;
        for suffix in ["", "-wal", "-shm"] {
            let p = PathBuf::from(format!("{}{suffix}", state.paths.db.display()));
            if p.exists() {
                std::fs::remove_file(p)?;
            }
        }
        std::fs::copy(&db_path, &state.paths.db)?;
        std::fs::remove_dir_all(&state.paths.vault)?;
        std::fs::rename(&staged_vault, &state.paths.vault)?;
        state.reopen_db()?;
        {
            let conn = state.db();
            keystore::reset_failures(&conn)?;
            db::search::rebuild(&conn, &dek)?;
        }
        state.set_key(Some(dek));
        state.touch();
        Ok(())
    })();
    let _ = std::fs::remove_dir_all(&work);
    result
}

/// Writes a scheduled backup if one is due. Works while locked (no decryption needed).
pub fn run_auto_backup(state: &AppState) -> AppResult<Option<PathBuf>> {
    let s = settings::get(&state.db())?;
    let ab = &s.auto_backup;
    let Some(folder) = ab.folder.as_ref().filter(|_| ab.enabled) else {
        return Ok(None);
    };
    if keystore::get(&state.db())?.is_none() {
        return Ok(None);
    }
    let interval = ab.interval_days.max(1) as i64 * 24 * 60 * 60 * 1000;
    if ab.last_run_at.is_some_and(|t| db::now_ms() - t < interval) {
        return Ok(None);
    }
    let folder = PathBuf::from(folder);
    std::fs::create_dir_all(&folder)?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let target = folder.join(format!("{AUTO_PREFIX}{stamp}.{EXTENSION}"));
    export(state, &target)?;
    settings::patch(
        &state.db(),
        serde_json::json!({ "autoBackup": { "lastRunAt": db::now_ms() } }),
    )?;
    prune_auto_backups(&folder)?;
    Ok(Some(target))
}

/// Automatic backups in `folder`, oldest first.
pub fn auto_backup_files(folder: &Path) -> AppResult<Vec<PathBuf>> {
    let mut files: Vec<PathBuf> = std::fs::read_dir(folder)?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .map(|n| n.to_string_lossy().starts_with(AUTO_PREFIX))
                .unwrap_or(false)
                && p.extension().is_some_and(|e| e == EXTENSION)
        })
        .collect();
    files.sort();
    Ok(files)
}

fn prune_auto_backups(folder: &Path) -> AppResult<()> {
    let files = auto_backup_files(folder)?;
    if files.len() > AUTO_KEEP {
        for old in &files[..files.len() - AUTO_KEEP] {
            let _ = std::fs::remove_file(old);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::documents::{self, DocumentMeta, NewDocument};
    use crate::paths::Paths;
    use crate::{auth, vault};

    pub(super) fn state_in(dir: &Path, name: &str) -> AppState {
        let paths = Paths::at(dir.join(name), dir.join(format!("{name}-open")));
        AppState::open(paths, crypto::test_params()).unwrap()
    }

    #[test]
    fn export_import_round_trip() {
        let dir = tempfile::tempdir().unwrap();
        let a = state_in(dir.path(), "a");
        auth::setup(&a, "backup password").unwrap();
        let key = a.key().unwrap();
        let doc = NewDocument {
            id: "d1".into(),
            kind: "text".into(),
            size: 5,
            meta: DocumentMeta {
                title: "Tax 2025".into(),
                ..Default::default()
            },
            category_id: Some("taxes".into()),
            reminder_offsets: vec![],
        };
        documents::insert(&a.db(), &key, &doc, 1).unwrap();
        vault::store(&a.paths, &key, "d1", b"hello").unwrap();

        let file = dir.path().join("test.0xbackup");
        export(&a, &file).unwrap();

        let b = state_in(dir.path(), "b");
        auth::setup(&b, "other password").unwrap();
        assert!(matches!(
            import(&b, &file, "wrong password"),
            Err(AppError::WrongPassword { .. })
        ));
        // A failed import leaves the target untouched.
        assert!(b.is_unlocked());

        import(&b, &file, "backup password").unwrap();
        let key_b = b.key().unwrap();
        assert_eq!(key_b.as_bytes(), key.as_bytes());
        assert_eq!(
            documents::get(&b.db(), &key_b, "d1").unwrap().title,
            "Tax 2025"
        );
        assert_eq!(vault::read(&b.paths, &key_b, "d1").unwrap(), b"hello");
        let hits = db::search::query(&b.db(), "tax", 5).unwrap();
        assert_eq!(hits.len(), 1);

        auth::lock(&b).unwrap();
        auth::unlock_with_password(&b, "backup password").unwrap();
    }

    #[test]
    fn rejects_unsafe_entry_names() {
        assert_eq!(vault_entry_name("vault/abc.bin"), Some("abc.bin"));
        assert_eq!(vault_entry_name("vault/../evil.bin"), None);
        assert_eq!(vault_entry_name("vault/a/b.bin"), None);
        assert_eq!(vault_entry_name("hub.db"), None);
    }

    #[test]
    fn auto_backup_respects_settings_and_prunes() {
        let dir = tempfile::tempdir().unwrap();
        let s = state_in(dir.path(), "s");
        auth::setup(&s, "backup password").unwrap();
        assert!(run_auto_backup(&s).unwrap().is_none());
        let folder = dir.path().join("backups");
        settings::patch(
            &s.db(),
            serde_json::json!({ "autoBackup": { "enabled": true, "folder": folder.to_string_lossy() } }),
        )
        .unwrap();
        assert!(run_auto_backup(&s).unwrap().is_some());
        // Not due again until the interval passes.
        assert!(run_auto_backup(&s).unwrap().is_none());

        for i in 0..12 {
            std::fs::write(
                folder.join(format!("{AUTO_PREFIX}2000{i:02}.{EXTENSION}")),
                b"x",
            )
            .unwrap();
        }
        prune_auto_backups(&folder).unwrap();
        assert_eq!(std::fs::read_dir(&folder).unwrap().count(), AUTO_KEEP);
    }
}
