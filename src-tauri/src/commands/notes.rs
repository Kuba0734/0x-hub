use tauri::{AppHandle, Emitter};

use super::St;
use crate::db::notes::{self, Note, NoteData, NotePatch};
use crate::db::{self, documents, search};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

fn with_access(state: &AppState, note: Note) -> Note {
    let revealed = state.is_revealed(&note.id);
    note.with_access(revealed)
}

fn changed(app: &AppHandle, id: &str) {
    // Lets other windows (sticky pop-outs, quick note) refresh.
    let _ = app.emit("notes://changed", id.to_string());
}

#[tauri::command]
pub fn notes_list(state: St<'_>, trashed: Option<bool>) -> AppResult<Vec<Note>> {
    let key = state.key()?;
    let list = notes::list(&state.db(), &key, trashed.unwrap_or(false))?;
    Ok(list.into_iter().map(|n| with_access(&state, n)).collect())
}

#[tauri::command]
pub fn note_get(state: St<'_>, id: String) -> AppResult<Note> {
    let key = state.key()?;
    let note = notes::get(&state.db(), &key, &id)?;
    Ok(with_access(&state, note))
}

#[tauri::command]
pub fn note_create(
    app: AppHandle,
    state: St<'_>,
    kind: String,
    data: Option<NoteData>,
) -> AppResult<Note> {
    let key = state.key()?;
    let conn = state.db();
    let note = notes::create(&conn, &key, &kind, data.unwrap_or_default(), db::now_ms())?;
    search::index_note(&conn, &note)?;
    changed(&app, &note.id);
    Ok(note)
}

#[tauri::command]
pub fn note_update(app: AppHandle, state: St<'_>, id: String, patch: NotePatch) -> AppResult<Note> {
    let key = state.key()?;
    // Editing the body of, or unlocking, a locked note needs access; locking never does.
    if (patch.touches_body() || patch.locked == Some(false))
        && notes::is_locked(&state.db(), &id)?
        && !state.is_revealed(&id)
    {
        return Err(AppError::DocumentLocked);
    }
    let conn = state.db();
    let note = notes::update(&conn, &key, &id, patch, db::now_ms())?;
    search::index_note(&conn, &note)?;
    drop(conn);
    changed(&app, &id);
    Ok(with_access(&state, note))
}

/// Opens a locked note for a few minutes (see `auth::reveal_item`).
#[tauri::command]
pub async fn note_reveal(
    app: AppHandle,
    state: St<'_>,
    id: String,
    password: Option<String>,
) -> AppResult<()> {
    super::auth::reveal_item(&app, state.inner().clone(), id, password).await
}

#[tauri::command]
pub fn note_trash(app: AppHandle, state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    let conn = state.db();
    notes::trash(&conn, &id, db::now_ms())?;
    search::remove(&conn, &id)?;
    changed(&app, &id);
    Ok(())
}

#[tauri::command]
pub fn note_restore(app: AppHandle, state: St<'_>, id: String) -> AppResult<()> {
    let key = state.key()?;
    let conn = state.db();
    notes::restore(&conn, &id)?;
    search::index_note(&conn, &notes::get(&conn, &key, &id)?)?;
    changed(&app, &id);
    Ok(())
}

#[tauri::command]
pub fn note_delete_forever(state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    let conn = state.db();
    notes::delete_row(&conn, &id)?;
    search::remove(&conn, &id)
}

#[tauri::command]
pub fn link_create(state: St<'_>, note_id: String, document_id: String) -> AppResult<()> {
    state.key()?;
    documents::link(&state.db(), &note_id, &document_id)
}

#[tauri::command]
pub fn link_delete(state: St<'_>, note_id: String, document_id: String) -> AppResult<()> {
    state.key()?;
    documents::unlink(&state.db(), &note_id, &document_id)
}
