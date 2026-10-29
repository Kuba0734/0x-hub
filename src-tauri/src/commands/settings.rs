use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

use super::St;
use crate::db::settings::{self, AppSettings};
use crate::error::{AppError, AppResult};
use crate::hotkey;

#[tauri::command]
pub fn settings_get(state: St<'_>) -> AppResult<AppSettings> {
    settings::get(&state.db())
}

/// Applies a partial update and its side effects (hotkey, autostart).
#[tauri::command]
pub fn settings_update(
    app: AppHandle,
    state: St<'_>,
    patch: serde_json::Value,
) -> AppResult<AppSettings> {
    let before = settings::get(&state.db())?;
    let mut next = settings::patch(&state.db(), patch)?;

    if next.hotkey != before.hotkey {
        if let Err(e) = hotkey::register(&app, &next.hotkey) {
            // Roll back to the previous working shortcut.
            let _ = hotkey::register(&app, &before.hotkey);
            next.hotkey = before.hotkey.clone();
            settings::put(&state.db(), &next)?;
            return Err(e);
        }
    }

    if next.autostart != before.autostart {
        let launcher = app.autolaunch();
        let r = if next.autostart {
            launcher.enable()
        } else {
            launcher.disable()
        };
        r.map_err(|e| AppError::Tauri(e.to_string()))?;
    }
    Ok(next)
}
