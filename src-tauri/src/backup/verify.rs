//! Read-only verification of a `.0xbackup`: every ZIP entry must read back with a valid
//! checksum, the DB snapshot must pass SQLite's own check, and every document needs its
//! vault blob. With the current DEK (unchanged unless a different vault was restored), each
//! blob is also decrypted, which proves it is complete and untampered.

use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::path::Path;

use rusqlite::{Connection, OpenFlags, OptionalExtension};
use zip::ZipArchive;

use super::{tempdir_in, vault_entry_name, Manifest, DB_ENTRY, MANIFEST};
use crate::crypto::{self, SecretKey};
use crate::db::documents::file_aad;
use crate::integrity::{Problem, ProblemKind};

/// What was found in one backup file.
pub struct BackupCheck {
    pub problems: Vec<Problem>,
    /// Whether blob contents were decrypted (the backup uses the current key).
    pub decrypted: bool,
}

fn problem(kind: ProblemKind, path: &Path, detail: impl Into<String>) -> Problem {
    Problem {
        kind,
        item_id: None,
        path: Some(path.to_string_lossy().into_owned()),
        detail: Some(detail.into()),
    }
}

/// Never fails: anything that goes wrong is reported as a problem with the file.
pub fn verify(path: &Path, work_root: &Path, key: Option<&SecretKey>) -> BackupCheck {
    let mut out = BackupCheck {
        problems: vec![],
        decrypted: false,
    };
    let mut archive = match File::open(path)
        .map_err(|e| e.to_string())
        .and_then(|f| ZipArchive::new(f).map_err(|e| e.to_string()))
    {
        Ok(a) => a,
        Err(e) => {
            out.problems
                .push(problem(ProblemKind::BackupUnreadable, path, e));
            return out;
        }
    };
    let manifest_ok = archive
        .by_name(MANIFEST)
        .ok()
        .and_then(|mut m| {
            let mut s = String::new();
            m.read_to_string(&mut s).ok()?;
            serde_json::from_str::<Manifest>(&s).ok()
        })
        .is_some_and(|m| m.app == "0x-hub");
    if !manifest_ok {
        out.problems.push(problem(
            ProblemKind::BackupUnreadable,
            path,
            "not a 0x-hub backup",
        ));
        return out;
    }

    let Ok(work) = tempdir_in(work_root) else {
        out.problems.push(problem(
            ProblemKind::BackupUnreadable,
            path,
            "no temporary folder",
        ));
        return out;
    };
    let db_path = work.join(DB_ENTRY);
    let snapshot = std::io::copy(
        &mut match archive.by_name(DB_ENTRY) {
            Ok(e) => e,
            Err(e) => {
                out.problems
                    .push(problem(ProblemKind::BackupDamaged, path, e.to_string()));
                let _ = std::fs::remove_dir_all(&work);
                return out;
            }
        },
        &mut match File::create(&db_path) {
            Ok(f) => f,
            Err(e) => {
                out.problems
                    .push(problem(ProblemKind::BackupUnreadable, path, e.to_string()));
                let _ = std::fs::remove_dir_all(&work);
                return out;
            }
        },
    );
    let (doc_ids, same_key) = match snapshot
        .map_err(|e| e.to_string())
        .and_then(|_| inspect_snapshot(&db_path, key).map_err(|e| e.to_string()))
    {
        Ok(v) => v,
        Err(e) => {
            out.problems.push(problem(
                ProblemKind::BackupDamaged,
                path,
                format!("{DB_ENTRY}: {e}"),
            ));
            (HashSet::new(), false)
        }
    };
    let _ = std::fs::remove_dir_all(&work);
    let key = key.filter(|_| same_key);
    out.decrypted = key.is_some();

    let mut blobs = HashSet::new();
    for i in 0..archive.len() {
        let mut entry = match archive.by_index(i) {
            Ok(e) => e,
            Err(e) => {
                out.problems
                    .push(problem(ProblemKind::BackupDamaged, path, e.to_string()));
                continue;
            }
        };
        let name = entry.name().to_string();
        let id = vault_entry_name(&name).map(|f| f.trim_end_matches(".bin").to_string());
        // Reading to the end makes the zip reader verify the entry's CRC-32.
        let result = match (&id, key) {
            (Some(id), Some(key)) => {
                let mut sealed = Vec::new();
                entry
                    .read_to_end(&mut sealed)
                    .map_err(|e| e.to_string())
                    .and_then(|_| {
                        crypto::decrypt(key, &sealed, &file_aad(id))
                            .map(|_| ())
                            .map_err(|_| "does not decrypt".to_string())
                    })
            }
            _ => std::io::copy(&mut entry, &mut std::io::sink())
                .map(|_| ())
                .map_err(|e| e.to_string()),
        };
        match result {
            Ok(()) => {
                if let Some(id) = id {
                    blobs.insert(id);
                }
            }
            Err(e) => out.problems.push(problem(
                ProblemKind::BackupDamaged,
                path,
                format!("{name}: {e}"),
            )),
        }
    }

    let missing = doc_ids.difference(&blobs).count();
    if missing > 0 {
        out.problems.push(problem(
            ProblemKind::BackupIncomplete,
            path,
            format!("{missing} document file(s) missing or unreadable"),
        ));
    }
    out
}

/// Opens the snapshot read-only (no migrations): integrity check, document ids, and
/// whether `key` is the backup's DEK.
fn inspect_snapshot(
    db_path: &Path,
    key: Option<&SecretKey>,
) -> rusqlite::Result<(HashSet<String>, bool)> {
    let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let check: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
    if check != "ok" {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let mut stmt = conn.prepare("SELECT id FROM documents")?;
    let ids = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<Result<HashSet<_>, _>>()?;
    let dek_check: Option<Vec<u8>> = conn
        .query_row("SELECT dek_check FROM keystore WHERE id = 1", [], |r| {
            r.get(0)
        })
        .optional()?;
    let same = match (key, dek_check) {
        (Some(k), Some(c)) => crate::auth::key_matches(k, &c),
        _ => false,
    };
    Ok((ids, same))
}

#[cfg(test)]
mod tests {
    use super::super::{export, tests::state_in};
    use super::*;
    use crate::db::documents::{self, DocumentMeta, NewDocument};
    use crate::{auth, vault};

    #[test]
    fn healthy_backup_passes_and_damage_is_found() {
        let dir = tempfile::tempdir().unwrap();
        let a = state_in(dir.path(), "a");
        auth::setup(&a, "backup password").unwrap();
        let key = a.key().unwrap();
        let doc = NewDocument {
            id: "d1".into(),
            kind: "text".into(),
            size: 5,
            meta: DocumentMeta::default(),
            folder_id: None,
            reminder_offsets: vec![],
        };
        documents::insert(&a.db(), &key, &doc, 1).unwrap();
        vault::store(&a.paths, &key, "d1", &vec![7u8; 4096]).unwrap();
        let file = dir.path().join("ok.0xbackup");
        export(&a, &file).unwrap();

        let ok = verify(&file, dir.path(), Some(&key));
        assert!(ok.problems.is_empty(), "{:?}", ok.problems);
        assert!(ok.decrypted);
        // Without the key only the structure is checked.
        let other = SecretKey::generate();
        let structural = verify(&file, dir.path(), Some(&other));
        assert!(structural.problems.is_empty() && !structural.decrypted);

        // Flip bytes inside the stored (uncompressed) vault blob.
        let mut bytes = std::fs::read(&file).unwrap();
        let blob = std::fs::read(a.paths.vault_file("d1")).unwrap();
        let at = bytes
            .windows(32)
            .position(|w| w == &blob[100..132])
            .unwrap();
        bytes[at + 10] ^= 0xFF;
        let bad = dir.path().join("bad.0xbackup");
        std::fs::write(&bad, &bytes).unwrap();
        let found = verify(&bad, dir.path(), Some(&key));
        assert!(found
            .problems
            .iter()
            .any(|p| p.kind == ProblemKind::BackupDamaged));
        assert!(found
            .problems
            .iter()
            .any(|p| p.kind == ProblemKind::BackupIncomplete));

        let junk = dir.path().join("junk.0xbackup");
        std::fs::write(&junk, b"nope").unwrap();
        assert_eq!(
            verify(&junk, dir.path(), None).problems[0].kind,
            ProblemKind::BackupUnreadable
        );
    }
}
