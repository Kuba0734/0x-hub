use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

use crate::error::AppResult;
use crate::popups;
use crate::state::AppState;

pub fn create(app: &AppHandle) -> AppResult<()> {
    let open = MenuItem::with_id(app, "open", "Open 0x-hub", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick-note", "Quick note", true, None::<&str>)?;
    let lock = MenuItem::with_id(app, "lock", "Lock", true, None::<&str>)?;
    let updates = MenuItem::with_id(app, "updates", "Check for updates", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&open, &quick, &sep, &lock, &updates, &sep2, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main")
        .tooltip("0x-hub")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => popups::show_main(app),
            "quick-note" => {
                let _ = popups::open_quick_note(app);
            }
            "lock" => {
                let state = app.state::<std::sync::Arc<AppState>>();
                if crate::auth::lock(&state).is_ok() {
                    let _ = app.emit("vault://locked", "tray");
                }
            }
            "updates" => {
                popups::show_main(app);
                let _ = app.emit("updates://check", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                popups::show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
