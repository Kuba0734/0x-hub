//! Main window helpers, the quick-note popup and sticky-note pop-out windows.

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::error::AppResult;

pub const MAIN: &str = "main";
pub const QUICK_NOTE: &str = "quicknote";

/// Mica on Windows 11, Acrylic fallback on Windows 10.
pub fn apply_glass(window: &WebviewWindow) {
    if window_vibrancy::apply_mica(window, Some(true)).is_err() {
        let _ = window_vibrancy::apply_acrylic(window, Some((12, 12, 12, 200)));
    }
}

/// Brings the main window up (tray, second launch, hotkey popups). When it was hidden or
/// minimized, the frontend hears `app://shown`, e.g. to check for updates.
pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN) {
        let was_away = !w.is_visible().unwrap_or(true) || w.is_minimized().unwrap_or(false);
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        if was_away {
            let _ = w.emit("app://shown", ());
        }
    }
}

fn popup(app: &AppHandle, label: &str, title: &str, size: (f64, f64)) -> AppResult<WebviewWindow> {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(w);
    }
    let w = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title(title)
        .inner_size(size.0, size.1)
        .min_inner_size(260.0, 180.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(true)
        .center()
        .build()?;
    apply_glass(&w);
    Ok(w)
}

pub fn open_quick_note(app: &AppHandle) -> AppResult<()> {
    popup(app, QUICK_NOTE, "Quick note", (420.0, 300.0)).map(|_| ())
}

pub fn open_sticky(app: &AppHandle, note_id: &str) -> AppResult<()> {
    // Labels may only contain a-zA-Z0-9-/:_ ; note ids are UUIDs.
    let label = format!("sticky-{note_id}");
    popup(app, &label, "Sticky note", (300.0, 300.0)).map(|_| ())
}
