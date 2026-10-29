use super::St;
use crate::db::search::{self, SearchHit};
use crate::error::AppResult;

#[tauri::command]
pub fn search_all(state: St<'_>, query: String) -> AppResult<Vec<SearchHit>> {
    state.key()?;
    let q = query.trim();
    if q.is_empty() || q.len() > 200 {
        return Ok(vec![]);
    }
    search::query(&state.db(), q, 30)
}
