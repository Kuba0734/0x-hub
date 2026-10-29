use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::error::{AppError, AppResult};
use crate::popups;

/// Replaces the registered quick-note hotkey. An empty string disables it.
pub fn register(app: &AppHandle, accelerator: &str) -> AppResult<()> {
    let gs = app.global_shortcut();
    gs.unregister_all()
        .map_err(|e| AppError::Tauri(e.to_string()))?;
    if accelerator.trim().is_empty() {
        return Ok(());
    }
    gs.on_shortcut(accelerator, |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            let _ = popups::open_quick_note(app);
        }
    })
    .map_err(|e| AppError::Invalid(format!("This shortcut can't be used: {e}")))
}
