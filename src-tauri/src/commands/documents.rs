use tauri::ipc::Response;
use tauri::{AppHandle, Emitter, State};

use super::{blocking, St};
use crate::db::categories::{self, Category};
use crate::db::documents::{self, Document, DocumentPatch};
use crate::db::{self, search};
use crate::error::AppResult;
use crate::ocr::jobs::OcrQueue;
use crate::vault::{self, import::ImportResult};

#[tauri::command]
pub fn documents_list(state: St<'_>, trashed: Option<bool>) -> AppResult<Vec<Document>> {
    let key = state.key()?;
    documents::list(&state.db(), &key, trashed.unwrap_or(false))
}

#[tauri::command]
pub fn document_get(state: St<'_>, id: String) -> AppResult<Document> {
    let key = state.key()?;
    documents::get(&state.db(), &key, &id)
}

#[tauri::command]
pub async fn documents_import(
    app: AppHandle,
    state: St<'_>,
    queue: State<'_, OcrQueue>,
    paths: Vec<String>,
    category_id: Option<String>,
) -> AppResult<ImportResult> {
    state.key()?;
    let s = state.inner().clone();
    let a = app.clone();
    let result = blocking(move || {
        Ok(vault::import::import_files(
            &a,
            &s,
            &paths,
            category_id.as_deref(),
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
    let conn = state.db();
    let doc = documents::update(&conn, &key, &id, patch, db::now_ms())?;
    search::index_document(&conn, &key, &doc)?;
    Ok(doc)
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

/// Decrypted file bytes for in-app preview, sent as a raw ArrayBuffer.
#[tauri::command]
pub async fn document_content(state: St<'_>, id: String) -> AppResult<Response> {
    let s = state.inner().clone();
    let bytes = blocking(move || {
        let key = s.key()?;
        vault::read(&s.paths, &key, &id)
    })
    .await?;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub fn document_ocr_text(state: St<'_>, id: String) -> AppResult<Option<String>> {
    let key = state.key()?;
    documents::ocr_text(&state.db(), &key, &id)
}

#[tauri::command]
pub fn document_rerun_ocr(state: St<'_>, queue: State<'_, OcrQueue>, id: String) -> AppResult<()> {
    state.key()?;
    documents::set_ocr_status(&state.db(), &id, "pending")?;
    queue.enqueue(id);
    Ok(())
}

#[tauri::command]
pub async fn document_export(state: St<'_>, id: String, target: String) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || {
        let key = s.key()?;
        vault::export_to(&s.paths, &key, &id, std::path::Path::new(&target))
    })
    .await
}

#[tauri::command]
pub async fn document_open_external(state: St<'_>, id: String) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || {
        let key = s.key()?;
        let doc = documents::get(&s.db(), &key, &id)?;
        vault::open_externally(&s.paths, &key, &id, &doc.filename).map(|_| ())
    })
    .await
}

#[tauri::command]
pub fn categories_list(state: St<'_>) -> AppResult<Vec<Category>> {
    state.key()?;
    categories::list(&state.db())
}

#[tauri::command]
pub fn category_create(state: St<'_>, name: String) -> AppResult<Category> {
    state.key()?;
    categories::create(&state.db(), &name)
}

#[tauri::command]
pub fn category_rename(state: St<'_>, id: String, name: String) -> AppResult<()> {
    state.key()?;
    categories::rename(&state.db(), &id, &name)
}

#[tauri::command]
pub fn category_delete(state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    categories::delete(&state.db(), &id)
}
