use super::St;
use crate::db::categories::{self, Category};
use crate::error::AppResult;

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
