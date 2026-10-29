//! Commands that hand out decrypted content. Every one checks the per-document lock.

use serde::Serialize;
use tauri::ipc::Response;
use tauri::AppHandle;

use super::documents::ensure_access;
use super::{blocking, St};
use crate::db::documents;
use crate::error::{AppError, AppResult};
use crate::{auth, hello, ocr, vault};

/// Decrypted file bytes for in-app preview, sent as a raw ArrayBuffer.
#[tauri::command]
pub async fn document_content(state: St<'_>, id: String) -> AppResult<Response> {
    let s = state.inner().clone();
    let bytes = blocking(move || {
        let key = s.key()?;
        ensure_access(&s, &id)?;
        vault::read(&s.paths, &key, &id)
    })
    .await?;
    Ok(Response::new(bytes))
}

/// Upright JPEG rendition for images the WebView can't show natively (HEIC, TIFF),
/// generated in memory. `max` caps the longer side (thumbnails use a small value).
#[tauri::command]
pub async fn document_preview_image(state: St<'_>, id: String, max: u32) -> AppResult<Response> {
    let s = state.inner().clone();
    let jpeg = blocking(move || {
        ocr::init_thread();
        let key = s.key()?;
        ensure_access(&s, &id)?;
        let bytes = vault::read(&s.paths, &key, &id)?;
        crate::imaging::to_jpeg(&bytes, max.clamp(64, 4096))
    })
    .await?;
    Ok(Response::new(jpeg))
}

#[tauri::command]
pub fn document_ocr_text(state: St<'_>, id: String) -> AppResult<Option<String>> {
    let key = state.key()?;
    ensure_access(&state, &id)?;
    documents::ocr_text(&state.db(), &key, &id)
}

#[tauri::command]
pub async fn document_export(state: St<'_>, id: String, target: String) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || {
        let key = s.key()?;
        ensure_access(&s, &id)?;
        vault::export_to(&s.paths, &key, &id, std::path::Path::new(&target))
    })
    .await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportManyResult {
    exported: usize,
    /// Titles of locked documents that were skipped.
    skipped: Vec<String>,
}

/// Exports decrypted copies of several documents into `folder` (names de-duplicated).
#[tauri::command]
pub async fn documents_export_many(
    state: St<'_>,
    ids: Vec<String>,
    folder: String,
) -> AppResult<ExportManyResult> {
    let s = state.inner().clone();
    blocking(move || {
        let key = s.key()?;
        let dir = std::path::Path::new(&folder);
        let mut result = ExportManyResult {
            exported: 0,
            skipped: vec![],
        };
        for id in &ids {
            let doc = documents::get(&s.db(), &key, id)?;
            if ensure_access(&s, id).is_err() {
                result.skipped.push(doc.title);
                continue;
            }
            let target = vault::unique_path(dir, &doc.filename);
            vault::export_to(&s.paths, &key, id, &target)?;
            result.exported += 1;
        }
        Ok(result)
    })
    .await
}

#[tauri::command]
pub async fn document_open_external(state: St<'_>, id: String) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || {
        let key = s.key()?;
        ensure_access(&s, &id)?;
        let doc = documents::get(&s.db(), &key, &id)?;
        vault::open_externally(&s.paths, &key, &id, &doc.filename).map(|_| ())
    })
    .await
}

/// Opens a locked document for a few minutes after re-confirming identity:
/// with `password`, or with Windows Hello when no password is given.
#[tauri::command]
pub async fn document_reveal(
    app: AppHandle,
    state: St<'_>,
    id: String,
    password: Option<String>,
) -> AppResult<()> {
    let s = state.inner().clone();
    let hwnd = match password {
        Some(_) => None,
        None => Some(super::auth::main_hwnd(&app)?),
    };
    blocking(move || {
        match (password, hwnd) {
            (Some(pw), _) => auth::verify_password(&s, &pw)?,
            (None, Some(hwnd)) => {
                ocr::init_thread();
                s.key()?;
                if !hello::is_available() {
                    return Err(AppError::HelloUnavailable);
                }
                hello::verify(hwnd, "Open a locked document in 0x-hub")?;
            }
            (None, None) => return Err(AppError::HelloUnavailable),
        }
        s.reveal(&id);
        Ok(())
    })
    .await
}
