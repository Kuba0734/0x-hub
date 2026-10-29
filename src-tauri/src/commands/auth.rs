use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager};

use super::{blocking, St};
use crate::auth::{self, VaultStatus};
use crate::crypto::SecretKey;
use crate::db::keystore;
use crate::error::{AppError, AppResult};
use crate::ocr::jobs::OcrQueue;
use crate::state::AppState;
use crate::{hello, ocr, popups};

fn after_unlock(app: &AppHandle) {
    if let (Some(queue), Some(state)) = (
        app.try_state::<OcrQueue>(),
        app.try_state::<Arc<AppState>>(),
    ) {
        let _ = queue.resume(&state);
    }
    let _ = app.emit("vault://unlocked", ());
}

#[tauri::command]
pub fn vault_status(state: St<'_>) -> AppResult<VaultStatus> {
    auth::status(&state)
}

/// Returns the recovery key to show once during onboarding.
#[tauri::command]
pub async fn vault_setup(app: AppHandle, state: St<'_>, password: String) -> AppResult<String> {
    let s = state.inner().clone();
    let key = blocking(move || auth::setup(&s, &password).map(|k| k.to_string())).await?;
    after_unlock(&app);
    Ok(key)
}

#[tauri::command]
pub async fn vault_unlock(app: AppHandle, state: St<'_>, password: String) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || auth::unlock_with_password(&s, &password)).await?;
    after_unlock(&app);
    Ok(())
}

#[tauri::command]
pub async fn vault_recover(
    app: AppHandle,
    state: St<'_>,
    recovery_key: String,
    new_password: String,
) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || auth::recover(&s, &recovery_key, &new_password)).await?;
    after_unlock(&app);
    Ok(())
}

#[tauri::command]
pub fn vault_lock(app: AppHandle, state: St<'_>) -> AppResult<()> {
    auth::lock(&state)?;
    let _ = app.emit("vault://locked", "manual");
    Ok(())
}

#[tauri::command]
pub async fn vault_change_password(state: St<'_>, current: String, next: String) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || auth::change_password(&s, &current, &next)).await
}

#[tauri::command]
pub async fn hello_available() -> AppResult<bool> {
    blocking(|| {
        ocr::init_thread();
        Ok(hello::is_available())
    })
    .await
}

pub(super) fn main_hwnd(app: &AppHandle) -> AppResult<isize> {
    let w = app
        .get_webview_window(popups::MAIN)
        .ok_or(AppError::NotFound)?;
    Ok(w.hwnd()?.0 as isize)
}

/// Requires an unlocked vault and a successful Hello check, then stores a DPAPI copy of the DEK.
#[tauri::command]
pub async fn hello_enable(app: AppHandle, state: St<'_>) -> AppResult<()> {
    let s = state.inner().clone();
    let hwnd = main_hwnd(&app)?;
    blocking(move || {
        ocr::init_thread();
        let key = s.key()?;
        if !hello::is_available() {
            return Err(AppError::HelloUnavailable);
        }
        hello::verify(hwnd, "Turn on Windows Hello for 0x-hub")?;
        let blob = hello::protect(key.as_bytes())?;
        keystore::set_hello_blob(&s.db(), Some(&blob))
    })
    .await
}

#[tauri::command]
pub fn hello_disable(state: St<'_>) -> AppResult<()> {
    keystore::set_hello_blob(&state.db(), None)
}

#[tauri::command]
pub async fn hello_unlock(app: AppHandle, state: St<'_>) -> AppResult<()> {
    let s = state.inner().clone();
    let hwnd = main_hwnd(&app)?;
    blocking(move || {
        ocr::init_thread();
        let row = keystore::get(&s.db())?.ok_or(AppError::NotInitialized)?;
        let blob = row.hello_blob.ok_or(AppError::HelloUnavailable)?;
        hello::verify(hwnd, "Unlock 0x-hub")?;
        let raw = hello::unprotect(&blob)?;
        auth::unlock_with_dek(&s, SecretKey::from_slice(&raw)?)
    })
    .await?;
    after_unlock(&app);
    Ok(())
}

/// Re-confirms identity for a locked document or note and opens it until its view closes:
/// with `password`, or with Windows Hello when no password is given.
/// Locks a document or note again because its view was closed. Other windows still
/// showing it (e.g. a sticky pop-out) hide it too.
#[tauri::command]
pub fn item_conceal(app: AppHandle, state: St<'_>, id: String) {
    if state.conceal(&id) {
        let _ = app.emit("items://relocked", vec![id]);
    }
}

pub(super) async fn reveal_item(
    app: &AppHandle,
    state: Arc<AppState>,
    id: String,
    password: Option<String>,
) -> AppResult<()> {
    let hwnd = match password {
        Some(_) => None,
        None => Some(main_hwnd(app)?),
    };
    blocking(move || {
        match (password, hwnd) {
            (Some(pw), _) => auth::verify_password(&state, &pw)?,
            (None, Some(hwnd)) => {
                ocr::init_thread();
                state.key()?;
                if !hello::is_available() {
                    return Err(AppError::HelloUnavailable);
                }
                hello::verify(hwnd, "Open a locked item in 0x-hub")?;
            }
            (None, None) => return Err(AppError::HelloUnavailable),
        }
        state.reveal(&id);
        Ok(())
    })
    .await
}
