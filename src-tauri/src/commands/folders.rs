use super::St;
use crate::db::{
    self,
    folders::{self, Folder},
};
use crate::error::AppResult;

#[tauri::command]
pub fn folders_list(state: St<'_>) -> AppResult<Vec<Folder>> {
    let key = state.key()?;
    folders::list(&state.db(), &key)
}

/// `parent_id` None = top level.
#[tauri::command]
pub fn folder_create(state: St<'_>, name: String, parent_id: Option<String>) -> AppResult<Folder> {
    let key = state.key()?;
    folders::create(&state.db(), &key, &name, parent_id.as_deref(), db::now_ms())
}

#[tauri::command]
pub fn folder_rename(state: St<'_>, id: String, name: String) -> AppResult<()> {
    let key = state.key()?;
    folders::rename(&state.db(), &key, &id, &name)
}

#[tauri::command]
pub fn folder_move(state: St<'_>, id: String, parent_id: Option<String>) -> AppResult<()> {
    state.key()?;
    folders::move_to(&state.db(), &id, parent_id.as_deref())
}

/// Documents and subfolders inside move up one level; nothing is deleted.
#[tauri::command]
pub fn folder_delete(state: St<'_>, id: String) -> AppResult<()> {
    state.key()?;
    folders::delete(&state.db(), &id)
}
