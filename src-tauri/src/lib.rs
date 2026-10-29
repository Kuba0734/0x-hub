mod auth;
mod backup;
mod commands;
mod crypto;
mod db;
mod error;
mod hello;
mod hotkey;
mod imaging;
mod integrity;
mod ocr;
mod paths;
mod pdf;
mod phone;
mod popups;
mod reminders;
mod session_watch;
mod shell_integration;
mod state;
mod tray;
mod vault;

use std::sync::Arc;

use tauri::{Emitter, Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

use crate::state::AppState;

const MINIMIZED_ARG: &str = "--minimized";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Must be first: a second launch focuses the running instance instead.
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let paths = shell_integration::paths_from_args(&args);
            if !paths.is_empty() {
                if let Some(state) = app.try_state::<Arc<AppState>>() {
                    state.queue_imports(paths);
                    let _ = app.emit("import://requested", ());
                }
            }
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
            app.manage(phone::PhoneUploads::default());
            reminders::spawn(handle.clone(), state.clone());
            tray::create(&handle)?;

            let args: Vec<String> = std::env::args().collect();
            state.queue_imports(shell_integration::paths_from_args(&args));

            let settings = db::settings::get(&state.db())?;
            if settings.explorer_integration {
                // Refresh the entries in case the app was reinstalled elsewhere.
                if let Err(e) = shell_integration::enable() {
                    eprintln!("explorer integration: {e}");
                }
            }
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
            commands::app::take_pending_imports,
            commands::phone::phone_upload_start,
            commands::phone::phone_upload_stop,
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
            commands::auth::item_conceal,
            commands::documents::documents_list,
            commands::documents::document_get,
            commands::documents::documents_import,
            commands::documents::document_update,
            commands::documents::document_trash,
            commands::documents::document_restore,
            commands::documents::document_delete_forever,
            commands::documents::document_rerun_ocr,
            commands::document_files::document_content,
            commands::document_files::document_preview_image,
            commands::document_files::document_ocr_text,
            commands::document_files::document_export,
            commands::document_files::documents_export_many,
            commands::document_files::document_open_external,
            commands::document_files::document_reveal,
            commands::pdf_tools::document_pdf_edit,
            commands::pdf_tools::documents_combine_images,
            commands::pdf_tools::document_export_redacted,
            commands::signatures::signatures_list,
            commands::signatures::signature_image,
            commands::signatures::signature_create,
            commands::signatures::signature_import,
            commands::signatures::signature_delete,
            commands::categories::categories_list,
            commands::categories::category_create,
            commands::categories::category_rename,
            commands::categories::category_delete,
            commands::notes::notes_list,
            commands::notes::note_get,
            commands::notes::note_create,
            commands::notes::note_update,
            commands::notes::note_reveal,
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
            commands::integrity::integrity_run,
            commands::integrity::integrity_last_report,
            commands::integrity::integrity_check_backup,
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
