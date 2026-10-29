use tauri::{AppHandle, Emitter, State};

use super::{blocking, St};
use crate::db::documents::{self, Document, DocumentPatch};
use crate::db::{self, search};
use crate::error::{AppError, AppResult};
use crate::ocr::jobs::OcrQueue;
use crate::state::AppState;
use crate::vault::{self, import::ImportResult};

/// Locked documents need a recent re-confirmation (password or Windows Hello).
pub(super) fn ensure_access(state: &AppState, id: &str) -> AppResult<()> {
    let locked = documents::is_locked(&state.db(), id)?;
    if locked && !state.is_revealed(id) {
        return Err(AppError::DocumentLocked);
    }
    Ok(())
}

fn with_access(state: &AppState, doc: Document) -> Document {
    let revealed = state.is_revealed(&doc.id);
    doc.with_access(revealed)
}

#[tauri::command]
pub fn documents_list(state: St<'_>, trashed: Option<bool>) -> AppResult<Vec<Document>> {
    let key = state.key()?;
    let docs = documents::list(&state.db(), &key, trashed.unwrap_or(false))?;
    Ok(docs.into_iter().map(|d| with_access(&state, d)).collect())
}

#[tauri::command]
pub fn document_get(state: St<'_>, id: String) -> AppResult<Document> {
    let key = state.key()?;
    let doc = documents::get(&state.db(), &key, &id)?;
    Ok(with_access(&state, doc))
}

#[tauri::command]
pub async fn documents_import(
    app: AppHandle,
    state: St<'_>,
    queue: State<'_, OcrQueue>,
    paths: Vec<String>,
    folder_id: Option<String>,
) -> AppResult<ImportResult> {
    state.key()?;
    let s = state.inner().clone();
    let a = app.clone();
    let result = blocking(move || {
        Ok(vault::import::import_files(
            &a,
            &s,
            &paths,
            folder_id.as_deref(),
        ))
    })
    .await?;
    for id in &result.imported {
        queue.enqueue(id.clone());
    }
    let _ = app.emit("documents://changed", ());
    Ok(result)
}

#[tauri::command]
pub fn document_update(state: St<'_>, id: String, patch: DocumentPatch) -> AppResult<Document> {
    let key = state.key()?;
    // Removing the lock or editing the (hidden) notes requires access; locking never does.
    if patch.locked == Some(false) || patch.description.is_some() {
        ensure_access(&state, &id)?;
    }
    let conn = state.db();
    let doc = documents::update(&conn, &key, &id, patch, db::now_ms())?;
    search::index_document(&conn, &key, &doc)?;
    drop(conn);
    Ok(with_access(&state, doc))
}

#[tauri::command]
pub fn document_trash(state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    let conn = state.db();
    documents::trash(&conn, &id, db::now_ms())?;
    search::remove(&conn, &id)
}

#[tauri::command]
pub fn document_restore(state: St<'_>, id: String) -> AppResult<()> {
    let key = state.key()?;
    let conn = state.db();
    documents::restore(&conn, &id)?;
    let doc = documents::get(&conn, &key, &id)?;
    search::index_document(&conn, &key, &doc)
}

#[tauri::command]
pub fn document_delete_forever(state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    vault::remove(&state.paths, &id)?;
    let conn = state.db();
    documents::delete_row(&conn, &id)?;
    search::remove(&conn, &id)
}

#[tauri::command]
pub fn document_rerun_ocr(state: St<'_>, queue: State<'_, OcrQueue>, id: String) -> AppResult<()> {
    state.key()?;
    documents::set_ocr_status(&state.db(), &id, "pending")?;
    queue.enqueue(id);
    Ok(())
}
