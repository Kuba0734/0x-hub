//! Integrity check: every vault blob and encrypted DB field must decrypt (AES-GCM proves
//! it is complete and unmodified), sizes must match, the database must pass SQLite's own
//! check, and the automatic backups must be readable. Nothing is repaired automatically;
//! the report says what is wrong so the user can restore from a good backup.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

use crate::backup;
use crate::crypto::{self, SecretKey};
use crate::db::{self, documents, folders, integrity as repo, notes, settings, signatures};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProblemKind {
    /// A document's vault file is gone.
    MissingFile,
    /// A vault file exists but does not decrypt (damaged or modified).
    DamagedFile,
    /// The decrypted file is not as large as recorded.
    SizeMismatch,
    /// An encrypted database field (title, OCR text, note, signature) does not decrypt.
    DamagedRecord,
    /// A vault file no document refers to.
    OrphanFile,
    /// SQLite reports structural damage in the database.
    DatabaseDamaged,
    BackupUnreadable,
    BackupDamaged,
    BackupIncomplete,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Problem {
    pub kind: ProblemKind,
    /// Document, note or signature id.
    pub item_id: Option<String>,
    /// File path for orphaned files and backups.
    pub path: Option<String>,
    /// Technical detail, for support.
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupStatus {
    pub path: String,
    pub ok: bool,
    /// Contents were decrypted, not only checksummed.
    pub decrypted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub ran_at: i64,
    pub duration_ms: i64,
    pub documents: usize,
    pub notes: usize,
    pub signatures: usize,
    pub backups: Vec<BackupStatus>,
    pub problems: Vec<Problem>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub done: usize,
    pub total: usize,
}

static RUNNING: AtomicBool = AtomicBool::new(false);

/// Clears the running flag when a check ends, also on panic.
struct RunGuard;

impl RunGuard {
    fn acquire() -> AppResult<RunGuard> {
        if RUNNING.swap(true, Ordering::SeqCst) {
            return Err(AppError::Invalid(
                "An integrity check is already running".into(),
            ));
        }
        Ok(RunGuard)
    }
}

impl Drop for RunGuard {
    fn drop(&mut self) {
        RUNNING.store(false, Ordering::SeqCst);
    }
}

fn item(kind: ProblemKind, id: &str, detail: Option<String>) -> Problem {
    Problem {
        kind,
        item_id: Some(id.to_string()),
        path: None,
        detail,
    }
}

/// Checks the vault itself. `progress(done, total)` is called per item; stops with
/// `AppError::Locked` if the vault locks meanwhile.
pub fn check_vault(
    state: &AppState,
    key: &SecretKey,
    mut progress: impl FnMut(usize, usize),
) -> AppResult<Report> {
    let started = db::now_ms();
    let (docs, note_rows, sig_rows, folder_rows, quick) = {
        let conn = state.db();
        (
            repo::document_rows(&conn)?,
            repo::sealed_rows(&conn, "notes")?,
            repo::sealed_rows(&conn, "signatures")?,
            repo::sealed_rows(&conn, "folders")?,
            repo::quick_check(&conn)?,
        )
    };
    let mut problems = vec![];
    if quick != "ok" {
        problems.push(Problem {
            kind: ProblemKind::DatabaseDamaged,
            item_id: None,
            path: None,
            detail: Some(quick),
        });
    }

    let total = docs.len() + note_rows.len() + sig_rows.len() + folder_rows.len();
    let mut done = 0;
    for d in &docs {
        if !state.is_unlocked() {
            return Err(AppError::Locked);
        }
        let meta_ok = crypto::decrypt(key, &d.meta, &documents::meta_aad(&d.id)).is_ok();
        let ocr_ok = d.ocr.as_ref().map_or(true, |o| {
            crypto::decrypt(key, o, &documents::ocr_aad(&d.id)).is_ok()
        });
        if !meta_ok || !ocr_ok {
            let field = if meta_ok { "ocr" } else { "meta" };
            problems.push(item(ProblemKind::DamagedRecord, &d.id, Some(field.into())));
        }
        if let Some(p) = check_file(state, key, &d.id, d.size) {
            problems.push(p);
        }
        done += 1;
        progress(done, total);
    }
    for (id, data) in &note_rows {
        if crypto::decrypt(key, data, &notes::aad(id)).is_err() {
            problems.push(item(ProblemKind::DamagedRecord, id, Some("note".into())));
        }
        done += 1;
        progress(done, total);
    }
    for (id, data) in &sig_rows {
        if crypto::decrypt(key, data, &signatures::aad(id)).is_err() {
            problems.push(item(
                ProblemKind::DamagedRecord,
                id,
                Some("signature".into()),
            ));
        }
        done += 1;
        progress(done, total);
    }

    for (id, name) in &folder_rows {
        if crypto::decrypt(key, name, &folders::aad(id)).is_err() {
            problems.push(item(ProblemKind::DamagedRecord, id, Some("folder".into())));
        }
        done += 1;
        progress(done, total);
    }

    let known: HashSet<&str> = docs.iter().map(|d| d.id.as_str()).collect();
    for path in orphan_files(&state.paths.vault, &known)? {
        problems.push(Problem {
            kind: ProblemKind::OrphanFile,
            item_id: None,
            path: Some(path.to_string_lossy().into_owned()),
            detail: None,
        });
    }

    Ok(Report {
        ran_at: started,
        duration_ms: db::now_ms() - started,
        documents: docs.len(),
        notes: note_rows.len(),
        signatures: sig_rows.len(),
        backups: vec![],
        problems,
    })
}

fn check_file(state: &AppState, key: &SecretKey, id: &str, size: i64) -> Option<Problem> {
    let sealed = match std::fs::read(state.paths.vault_file(id)) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Some(item(ProblemKind::MissingFile, id, None));
        }
        Err(e) => return Some(item(ProblemKind::DamagedFile, id, Some(e.to_string()))),
    };
    match crypto::decrypt(key, &sealed, &documents::file_aad(id)) {
        Ok(plain) if plain.len() as i64 == size => None,
        Ok(plain) => Some(item(
            ProblemKind::SizeMismatch,
            id,
            Some(format!("{} bytes, expected {size}", plain.len())),
        )),
        Err(_) => Some(item(ProblemKind::DamagedFile, id, None)),
    }
}

fn orphan_files(vault: &Path, known: &HashSet<&str>) -> AppResult<Vec<PathBuf>> {
    let mut out = vec![];
    for entry in std::fs::read_dir(vault)? {
        let path = entry?.path();
        let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned());
        let is_blob = path.extension().is_some_and(|e| e == "bin");
        if let (true, Some(stem)) = (is_blob, stem) {
            if !known.contains(stem.as_str()) {
                out.push(path);
            }
        }
    }
    Ok(out)
}

/// Verifies the automatic backups (if a backup folder is configured).
pub fn check_auto_backups(
    state: &AppState,
    key: &SecretKey,
) -> AppResult<(Vec<BackupStatus>, Vec<Problem>)> {
    let folder = settings::get(&state.db())?.auto_backup.folder;
    let Some(folder) = folder.map(PathBuf::from).filter(|f| f.is_dir()) else {
        return Ok((vec![], vec![]));
    };
    let mut statuses = vec![];
    let mut problems = vec![];
    for file in backup::auto_backup_files(&folder)? {
        let check = backup::verify::verify(&file, &state.paths.root, Some(key));
        statuses.push(BackupStatus {
            path: file.to_string_lossy().into_owned(),
            ok: check.problems.is_empty(),
            decrypted: check.decrypted,
        });
        problems.extend(check.problems);
    }
    Ok((statuses, problems))
}

/// Full check: vault, then (optionally) backups. Saves the report and notifies on problems.
pub fn run(app: &AppHandle, state: &AppState) -> AppResult<Report> {
    let _guard = RunGuard::acquire()?;
    let key = state.key()?;
    let include_backups = settings::get(&state.db())?.integrity.include_backups;
    let emit = |done, total| {
        let _ = app.emit("progress://integrity", Progress { done, total });
    };
    let mut report = check_vault(state, &key, emit)?;
    if include_backups {
        let (backups, problems) = check_auto_backups(state, &key)?;
        report.backups = backups;
        report.problems.extend(problems);
    }
    report.duration_ms = db::now_ms() - report.ran_at;
    {
        let conn = state.db();
        repo::save_report(&conn, &report)?;
        settings::patch(
            &conn,
            serde_json::json!({ "integrity": { "lastRunAt": report.ran_at } }),
        )?;
    }
    let _ = app.emit("integrity://finished", &report);
    notify(app, state, &report);
    Ok(report)
}

fn notify(app: &AppHandle, state: &AppState, report: &Report) {
    let enabled = settings::get(&state.db())
        .map(|s| s.notifications_enabled)
        .unwrap_or(false);
    let n = report.problems.len();
    if !enabled || n == 0 {
        return;
    }
    let title = if n == 1 {
        "Integrity check found 1 problem".to_string()
    } else {
        format!("Integrity check found {n} problems")
    };
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body("Open Settings › Integrity in 0x-hub for details.")
        .show();
}

/// Starts a background check when one is due. Called by the scheduler.
pub fn run_if_due(app: &AppHandle, state: std::sync::Arc<AppState>) -> AppResult<()> {
    if !state.is_unlocked() || RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }
    let s = settings::get(&state.db())?.integrity;
    let interval = s.interval_days.max(1) as i64 * 24 * 60 * 60 * 1000;
    if !s.enabled || s.last_run_at.is_some_and(|t| db::now_ms() - t < interval) {
        return Ok(());
    }
    let app = app.clone();
    std::thread::Builder::new()
        .name("0x-hub-integrity".into())
        .spawn(move || {
            if let Err(e) = run(&app, &state) {
                eprintln!("integrity check failed: {e}");
            }
        })
        .map(|_| ())
        .map_err(AppError::Io)
}

pub fn last_report(state: &AppState) -> AppResult<Option<Report>> {
    repo::last_report(&state.db())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::documents::{DocumentMeta, NewDocument};
    use crate::paths::Paths;
    use crate::{auth, vault};

    fn add_doc(state: &AppState, key: &SecretKey, id: &str, body: &[u8]) {
        let doc = NewDocument {
            id: id.into(),
            kind: "text".into(),
            size: body.len() as i64,
            meta: DocumentMeta::default(),
            folder_id: None,
            reminder_offsets: vec![],
        };
        documents::insert(&state.db(), key, &doc, 1).unwrap();
        vault::store(&state.paths, key, id, body).unwrap();
    }

    #[test]
    fn finds_missing_damaged_resized_and_orphaned_files() {
        let dir = tempfile::tempdir().unwrap();
        let state = AppState::open(
            Paths::at(dir.path().join("d"), dir.path().join("o")),
            crypto::test_params(),
        )
        .unwrap();
        auth::setup(&state, "integrity password").unwrap();
        let key = state.key().unwrap();
        for id in ["good", "gone", "flipped", "resized"] {
            add_doc(&state, &key, id, b"hello world");
        }
        signatures::insert(&state.db(), &key, b"png", 1, 1, 1).unwrap();

        let clean = check_vault(&state, &key, |_, _| {}).unwrap();
        assert!(clean.problems.is_empty(), "{:?}", clean.problems);
        assert_eq!((clean.documents, clean.signatures), (4, 1));

        std::fs::remove_file(state.paths.vault_file("gone")).unwrap();
        let f = state.paths.vault_file("flipped");
        let mut b = std::fs::read(&f).unwrap();
        let last = b.len() - 1;
        b[last] ^= 1;
        std::fs::write(&f, b).unwrap();
        vault::store(&state.paths, &key, "resized", b"hello").unwrap();
        std::fs::write(state.paths.vault_file("stray"), b"x").unwrap();

        let mut calls = 0;
        let r = check_vault(&state, &key, |_, _| calls += 1).unwrap();
        // 4 documents, 1 signature and the 7 default folders created at setup.
        assert_eq!(calls, 12);
        let kind_of = |id: &str| {
            r.problems
                .iter()
                .find(|p| p.item_id.as_deref() == Some(id))
                .map(|p| p.kind)
        };
        assert_eq!(kind_of("good"), None);
        assert_eq!(kind_of("gone"), Some(ProblemKind::MissingFile));
        assert_eq!(kind_of("flipped"), Some(ProblemKind::DamagedFile));
        assert_eq!(kind_of("resized"), Some(ProblemKind::SizeMismatch));
        assert!(r.problems.iter().any(|p| p.kind == ProblemKind::OrphanFile
            && p.path.as_deref().is_some_and(|x| x.ends_with("stray.bin"))));

        repo::save_report(&state.db(), &r).unwrap();
        assert_eq!(last_report(&state).unwrap().unwrap().problems, r.problems);

        auth::lock(&state).unwrap();
        assert!(matches!(
            check_vault(&state, &key, |_, _| {}),
            Err(AppError::Locked)
        ));
    }

    #[test]
    fn only_one_run_at_a_time() {
        let g = RunGuard::acquire().unwrap();
        assert!(RunGuard::acquire().is_err());
        drop(g);
        assert!(RunGuard::acquire().is_ok());
    }
}
