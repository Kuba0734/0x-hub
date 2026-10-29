use tauri::{AppHandle, Emitter};

use super::{blocking, St};
use crate::backup;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn backup_export(state: St<'_>, target: String) -> AppResult<()> {
    let s = state.inner().clone();
    if !target
        .to_lowercase()
        .ends_with(&format!(".{}", backup::EXTENSION))
    {
        return Err(AppError::Invalid(
            "Backups use the .0xbackup extension".into(),
        ));
    }
    blocking(move || backup::export(&s, std::path::Path::new(&target))).await
}

#[tauri::command]
pub async fn backup_import(
    app: AppHandle,
    state: St<'_>,
    source: String,
    password: String,
) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || backup::import(&s, std::path::Path::new(&source), &password)).await?;
    let _ = app.emit("vault://restored", ());
    Ok(())
}

/// Runs the scheduled backup now if it is configured. Returns the written path.
#[tauri::command]
pub async fn backup_run_auto(state: St<'_>) -> AppResult<Option<String>> {
    let s = state.inner().clone();
    blocking(move || {
        crate::db::settings::patch(
            &s.db(),
            serde_json::json!({ "autoBackup": { "lastRunAt": null } }),
        )?;
        Ok(backup::run_auto_backup(&s)?.map(|p| p.to_string_lossy().into_owned()))
    })
    .await
}
