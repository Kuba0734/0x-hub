mod auth;
mod backup;
mod commands;
mod crypto;
mod db;
mod error;
mod hello;
mod hotkey;
mod ocr;
mod paths;
mod popups;
mod reminders;
mod session_watch;
mod state;
mod tray;
mod vault;

use std::sync::Arc;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

use crate::state::AppState;

const MINIMIZED_ARG: &str = "--minimized";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Must be first: a second launch focuses the running instance instead.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            popups::show_main(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .with_denylist(&[popups::QUICK_NOTE])
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![MINIMIZED_ARG]),
        ))
        .setup(|app| {
            // Startup is the one place where failing hard is acceptable.
            let paths = paths::Paths::resolve()?;
            paths.wipe_open_temp();
            let state = Arc::new(AppState::open(paths, crypto::KdfParams::default())?);
            app.manage(state.clone());

            let handle = app.handle().clone();
            app.manage(ocr::jobs::spawn(handle.clone(), state.clone()));
            reminders::spawn(handle.clone(), state.clone());
            tray::create(&handle)?;

            let settings = db::settings::get(&state.db())?;
            if let Err(e) = hotkey::register(&handle, &settings.hotkey) {
                eprintln!("could not register hotkey: {e}");
            }

            if let Some(main) = app.get_webview_window(popups::MAIN) {
                popups::apply_glass(&main);
                session_watch::install(&handle);
                let start_hidden = std::env::args().any(|a| a == MINIMIZED_ARG);
                if !start_hidden {
                    main.show()?;
                    main.set_focus()?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != popups::MAIN {
                    return;
                }
                let app = window.app_handle();
                let state = app.state::<Arc<AppState>>();
                let to_tray = db::settings::get(&state.db())
                    .map(|s| s.close_to_tray)
                    .unwrap_or(true);
                if to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    app.exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_info,
            commands::app::touch_activity,
            commands::app::overview_stats,
            commands::app::open_quick_note,
            commands::app::open_sticky_window,
            commands::app::show_main_window,
            commands::app::save_text_file,
            commands::auth::vault_status,
            commands::auth::vault_setup,
            commands::auth::vault_unlock,
            commands::auth::vault_recover,
            commands::auth::vault_lock,
            commands::auth::vault_change_password,
            commands::auth::hello_available,
            commands::auth::hello_enable,
            commands::auth::hello_disable,
            commands::auth::hello_unlock,
            commands::documents::documents_list,
            commands::documents::document_get,
            commands::documents::documents_import,
            commands::documents::document_update,
            commands::documents::document_trash,
            commands::documents::document_restore,
            commands::documents::document_delete_forever,
            commands::documents::document_content,
            commands::documents::document_ocr_text,
            commands::documents::document_rerun_ocr,
            commands::documents::document_export,
            commands::documents::document_open_external,
            commands::documents::categories_list,
            commands::documents::category_create,
            commands::documents::category_rename,
            commands::documents::category_delete,
            commands::notes::notes_list,
            commands::notes::note_get,
            commands::notes::note_create,
            commands::notes::note_update,
            commands::notes::note_trash,
            commands::notes::note_restore,
            commands::notes::note_delete_forever,
            commands::notes::link_create,
            commands::notes::link_delete,
            commands::search::search_all,
            commands::settings::settings_get,
            commands::settings::settings_update,
            commands::backup::backup_export,
            commands::backup::backup_import,
            commands::backup::backup_run_auto,
        ])
        .build(tauri::generate_context!())
        .expect("error while building 0x-hub");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<Arc<AppState>>() {
                state.set_key(None);
                state.paths.wipe_open_temp();
            }
        }
    });
}
