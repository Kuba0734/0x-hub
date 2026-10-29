use tauri::ipc::Response;

use super::{blocking, St};
use crate::db::{
    self,
    signatures::{self, Signature},
};
use crate::error::{AppError, AppResult};
use crate::imaging::{self, ink, Format};
use crate::ocr;
use crate::state::AppState;

/// Larger uploads are not signatures.
const MAX_SIGNATURE_BYTES: usize = 15 * 1024 * 1024;

#[tauri::command]
pub fn signatures_list(state: St<'_>) -> AppResult<Vec<Signature>> {
    state.key()?;
    signatures::list(&state.db())
}

/// Transparent PNG for display.
#[tauri::command]
pub fn signature_image(state: St<'_>, id: String) -> AppResult<Response> {
    let key = state.key()?;
    Ok(Response::new(signatures::image(&state.db(), &key, &id)?))
}

fn store(state: &AppState, image: &[u8]) -> AppResult<Signature> {
    if image.len() > MAX_SIGNATURE_BYTES {
        return Err(AppError::Invalid("This image is too large".into()));
    }
    ocr::init_thread();
    let key = state.key()?;
    let ink = ink::to_ink(image)?;
    let png = imaging::encode_pixels(&ink, Format::Png)?;
    signatures::insert(&state.db(), &key, &png, ink.width, ink.height, db::now_ms())
}

/// Stores a drawn signature (PNG bytes from the canvas), converted to black ink.
#[tauri::command]
pub async fn signature_create(state: St<'_>, image: Vec<u8>) -> AppResult<Signature> {
    let s = state.inner().clone();
    blocking(move || store(&s, &image)).await
}

/// Stores a photo or scan of a signature on paper; the paper becomes transparent.
#[tauri::command]
pub async fn signature_import(state: St<'_>, path: String) -> AppResult<Signature> {
    let s = state.inner().clone();
    blocking(move || {
        let p = std::path::Path::new(&path);
        if std::fs::metadata(p)?.len() > MAX_SIGNATURE_BYTES as u64 {
            return Err(AppError::Invalid("This image is too large".into()));
        }
        store(&s, &std::fs::read(p)?)
    })
    .await
}

#[tauri::command]
pub fn signature_delete(state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    signatures::delete(&state.db(), &id)
}
