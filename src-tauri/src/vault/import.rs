//! Document import: read → encrypt into the vault → insert row → queue OCR.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db::{self, documents, search, settings};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

use super::MAX_FILE_BYTES;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgress {
    pub done: usize,
    pub total: usize,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportFailure {
    pub name: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<String>,
    pub failed: Vec<ImportFailure>,
}

fn title_from(filename: &str) -> String {
    let stem = filename
        .rsplit_once('.')
        .map(|(s, _)| s)
        .unwrap_or(filename);
    let t = stem.replace(['_', '-'], " ").trim().to_string();
    if t.is_empty() {
        filename.to_string()
    } else {
        t
    }
}

pub fn import_one(state: &AppState, path: &str, category_id: Option<&str>) -> AppResult<String> {
    let key = state.key()?;
    let p = std::path::Path::new(path);
    let filename = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| AppError::Invalid("Not a file".into()))?;
    let size = std::fs::metadata(p)?.len();
    if size > MAX_FILE_BYTES {
        return Err(AppError::Invalid(
            "Files larger than 512 MB are not supported".into(),
        ));
    }
    let bytes = std::fs::read(p)?;
    let (kind, mime) = documents::classify(&filename);
    let id = db::new_id();
    super::store(&state.paths, &key, &id, &bytes)?;

    let conn = state.db();
    let offsets = settings::get(&conn)?.default_reminder_offsets;
    let doc = documents::NewDocument {
        id: id.clone(),
        kind: kind.into(),
        size: size as i64,
        meta: documents::DocumentMeta {
            title: title_from(&filename),
            filename,
            mime: mime.into(),
            tags: vec![],
            description: String::new(),
        },
        category_id: category_id.map(str::to_string),
        reminder_offsets: offsets,
    };
    if let Err(e) = documents::insert(&conn, &key, &doc, db::now_ms()) {
        let _ = super::remove(&state.paths, &id);
        return Err(e);
    }
    if kind == "image" || kind == "pdf" {
        documents::set_ocr_status(&conn, &id, "pending")?;
    }
    let full = documents::get(&conn, &key, &id)?;
    search::index_document(&conn, &key, &full)?;
    Ok(id)
}

pub fn import_files(
    app: &AppHandle,
    state: &AppState,
    paths: &[String],
    category_id: Option<&str>,
) -> ImportResult {
    let mut result = ImportResult::default();
    let total = paths.len();
    for (i, path) in paths.iter().enumerate() {
        let name = std::path::Path::new(path)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.clone());
        let _ = app.emit(
            "progress://import",
            ImportProgress {
                done: i,
                total,
                name: name.clone(),
            },
        );
        match import_one(state, path, category_id) {
            Ok(id) => result.imported.push(id),
            Err(e) => result.failed.push(ImportFailure {
                name,
                message: e.to_string(),
            }),
        }
    }
    let _ = app.emit(
        "progress://import",
        ImportProgress {
            done: total,
            total,
            name: String::new(),
        },
    );
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titles_from_filenames() {
        assert_eq!(title_from("tax_return-2025.pdf"), "tax return 2025");
        assert_eq!(title_from("noext"), "noext");
        assert_eq!(title_from(".pdf"), ".pdf");
    }

    #[test]
    fn import_one_encrypts_and_indexes() {
        let dir = tempfile::tempdir().unwrap();
        let paths = crate::paths::Paths::at(dir.path().join("d"), dir.path().join("o"));
        let state = AppState::open(paths, crate::crypto::test_params()).unwrap();
        crate::auth::setup(&state, "import password").unwrap();
        let src = dir.path().join("Health_Insurance.png");
        std::fs::write(&src, b"not really a png").unwrap();
        let id = import_one(&state, &src.to_string_lossy(), Some("insurance")).unwrap();
        let key = state.key().unwrap();
        let doc = documents::get(&state.db(), &key, &id).unwrap();
        assert_eq!(doc.title, "Health Insurance");
        assert_eq!(doc.kind, "image");
        assert_eq!(doc.ocr_status, "pending");
        assert_eq!(doc.reminder_offsets, vec![90, 30, 7, 1]);
        assert_eq!(search::query(&state.db(), "health", 5).unwrap().len(), 1);
    }
}
