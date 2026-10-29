//! Locks the vault when the Windows session is locked (Win+L), by subclassing the main
//! window and listening for `WM_WTSSESSION_CHANGE`.

use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::RemoteDesktop::{
    WTSRegisterSessionNotification, NOTIFY_FOR_THIS_SESSION,
};
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{WM_WTSSESSION_CHANGE, WTS_SESSION_LOCK};

use crate::db::settings;
use crate::state::AppState;

const SUBCLASS_ID: usize = 0x0bad_c0de;

unsafe extern "system" fn subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    data: usize,
) -> LRESULT {
    if msg == WM_WTSSESSION_CHANGE && wparam.0 as u32 == WTS_SESSION_LOCK {
        // SAFETY: `data` is the leaked AppHandle from `install`, valid for the process lifetime.
        let app = &*(data as *const AppHandle);
        let state = app.state::<Arc<AppState>>();
        let enabled = settings::get(&state.db())
            .map(|s| s.lock_on_session_lock)
            .unwrap_or(true);
        if enabled && state.is_unlocked() && crate::auth::lock(&state).is_ok() {
            let _ = app.emit("vault://locked", "session");
        }
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

/// Must run on the main thread (the thread that owns the window).
pub fn install(app: &AppHandle) {
    let Some(window) = app.get_webview_window(crate::popups::MAIN) else {
        return;
    };
    let Ok(raw) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(raw.0 as _);
    let data = Box::into_raw(Box::new(app.clone())) as usize;
    unsafe {
        let _ = WTSRegisterSessionNotification(hwnd, NOTIFY_FOR_THIS_SESSION);
        let _ = SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, data);
    }
}
