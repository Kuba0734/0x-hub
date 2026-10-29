//! Thin `#[tauri::command]` handlers: validate → call a service → map errors.

pub mod app;
pub mod auth;
pub mod backup;
pub mod categories;
pub mod document_files;
pub mod documents;
pub mod notes;
pub mod search;
pub mod settings;

use std::sync::Arc;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub type St<'a> = tauri::State<'a, Arc<AppState>>;

/// Runs CPU- or IO-heavy work off the IPC thread.
pub async fn blocking<T, F>(f: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> AppResult<T> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| AppError::Tauri(e.to_string()))?
}
