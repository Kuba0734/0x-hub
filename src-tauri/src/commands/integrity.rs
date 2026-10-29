use serde::Serialize;
use tauri::AppHandle;

use super::{blocking, St};
use crate::backup;
use crate::error::AppResult;
use crate::integrity::{self, Problem, Report};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupCheckResult {
    problems: Vec<Problem>,
    decrypted: bool,
}

/// Runs the full check now (also verifies automatic backups if enabled in settings).
#[tauri::command]
pub async fn integrity_run(app: AppHandle, state: St<'_>) -> AppResult<Report> {
    let s = state.inner().clone();
    blocking(move || integrity::run(&app, &s)).await
}

#[tauri::command]
pub fn integrity_last_report(state: St<'_>) -> AppResult<Option<Report>> {
    state.key()?;
    integrity::last_report(&state)
}

/// Verifies one backup file the user picked.
#[tauri::command]
pub async fn integrity_check_backup(state: St<'_>, path: String) -> AppResult<BackupCheckResult> {
    let s = state.inner().clone();
    blocking(move || {
        let key = s.key()?;
        let check = backup::verify::verify(std::path::Path::new(&path), &s.paths.root, Some(&key));
        Ok(BackupCheckResult {
            problems: check.problems,
            decrypted: check.decrypted,
        })
    })
    .await
}
