use serde::Serialize;
use tauri::AppHandle;

use super::St;
use crate::db::{documents, notes};
use crate::error::{AppError, AppResult};
use crate::popups;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    version: String,
    data_dir: String,
}

#[tauri::command]
pub fn app_info(state: St<'_>) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").into(),
        data_dir: state.paths.root.to_string_lossy().into_owned(),
    }
}

/// Called (throttled) by the frontend on user input; drives idle auto-lock.
#[tauri::command]
pub fn touch_activity(state: St<'_>) {
    state.touch();
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverviewStats {
    documents: i64,
    notes: i64,
    storage_bytes: i64,
    expiring_soon: i64,
}

#[tauri::command]
pub fn overview_stats(state: St<'_>) -> AppResult<OverviewStats> {
    state.key()?;
    let conn = state.db();
    let today = chrono::Local::now().date_naive();
    let horizon = today + chrono::Duration::days(30);
    let expiring_soon: i64 = conn.query_row(
        "SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL AND expires_on IS NOT NULL
         AND expires_on >= ?1 AND expires_on <= ?2",
        [today.to_string(), horizon.to_string()],
        |r| r.get(0),
    )?;
    let docs: i64 = conn.query_row(
        "SELECT COUNT(*) FROM documents WHERE deleted_at IS NULL",
        [],
        |r| r.get(0),
    )?;
    Ok(OverviewStats {
        documents: docs,
        notes: notes::count(&conn)?,
        storage_bytes: documents::storage_used(&conn)?,
        expiring_soon,
    })
}

#[tauri::command]
pub fn open_quick_note(app: AppHandle) -> AppResult<()> {
    popups::open_quick_note(&app)
}

#[tauri::command]
pub fn open_sticky_window(app: AppHandle, note_id: String) -> AppResult<()> {
    popups::open_sticky(&app, &note_id)
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) {
    popups::show_main(&app);
}

/// Files Explorer handed to the app; the UI imports them once the vault is unlocked.
#[tauri::command]
pub fn take_pending_imports(state: St<'_>) -> Vec<String> {
    state.take_imports()
}

/// Saves the recovery key to a `.txt` path the user picked in a save dialog.
#[tauri::command]
pub fn save_text_file(path: String, contents: String) -> AppResult<()> {
    if !path.to_lowercase().ends_with(".txt") {
        return Err(AppError::Invalid(
            "Only .txt files can be saved here".into(),
        ));
    }
    std::fs::write(path, contents)?;
    Ok(())
}
