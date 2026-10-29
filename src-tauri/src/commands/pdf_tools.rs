//! PDF tools: page edits, signatures, text and form marks, images → PDF, redacted export.
//! Like every content command, each one checks the per-document lock first.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use windows::Graphics::Imaging::BitmapAlphaMode;

use super::documents::ensure_access;
use super::{blocking, St};
use crate::db::documents::{self, DocumentPatch};
use crate::db::{self, search, signatures};
use crate::error::{AppError, AppResult};
use crate::imaging::{self, Format};
use crate::ocr::{self, jobs::OcrQueue};
use crate::pdf::edit::{self, PageOp};
use crate::pdf::geometry::NormRect;
use crate::pdf::marks::{Mark, MarkKind};
use crate::pdf::{build, redact};
use crate::state::AppState;
use crate::vault;

/// Most images combined into one PDF at a time.
const MAX_COMBINE: usize = 100;

/// Something to place on a page of the edited result (0-based `page`).
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ItemRequest {
    #[serde(rename_all = "camelCase")]
    Signature {
        page: usize,
        rect: NormRect,
        signature_id: String,
    },
    /// `font_size` is a fraction of the displayed page height.
    #[serde(rename_all = "camelCase")]
    Text {
        page: usize,
        rect: NormRect,
        text: String,
        font_size: f64,
    },
    Check {
        page: usize,
        rect: NormRect,
    },
    Cross {
        page: usize,
        rect: NormRect,
    },
    Cover {
        page: usize,
        rect: NormRect,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfProgress {
    pub document_id: String,
    pub done: u32,
    pub total: u32,
}

fn changed(app: &AppHandle) {
    let _ = app.emit("documents://changed", ());
}

/// Stores `pdf` as a new document that inherits category, tags and lock from `like`.
fn store_copy(
    state: &AppState,
    like: &documents::Document,
    title: &str,
    pdf: &[u8],
) -> AppResult<String> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::Invalid("A title is required".into()));
    }
    let filename = format!("{}.pdf", vault::safe_filename(title));
    let id = vault::import::import_bytes(state, &filename, pdf, like.category_id.as_deref())?;
    let key = state.key()?;
    let conn = state.db();
    let doc = documents::update(
        &conn,
        &key,
        &id,
        DocumentPatch {
            title: Some(title.to_string()),
            tags: Some(like.tags.clone()),
            locked: Some(like.locked),
            ..Default::default()
        },
        db::now_ms(),
    )?;
    search::index_document(&conn, &key, &doc)?;
    Ok(id)
}

/// Rewrites a PDF with the given page list and placed items. With `copy_title` the
/// result is saved as a new document; otherwise it replaces the original. Returns the id.
#[tauri::command]
pub async fn document_pdf_edit(
    app: AppHandle,
    state: St<'_>,
    queue: State<'_, OcrQueue>,
    id: String,
    pages: Vec<PageOp>,
    items: Vec<ItemRequest>,
    copy_title: Option<String>,
) -> AppResult<String> {
    let s = state.inner().clone();
    let result = blocking(move || {
        ocr::init_thread();
        let key = s.key()?;
        ensure_access(&s, &id)?;
        let doc = documents::get(&s.db(), &key, &id)?;
        if doc.kind != "pdf" {
            return Err(AppError::Invalid("Only PDFs can be edited".into()));
        }
        let bytes = vault::read(&s.paths, &key, &id)?;

        // Decode each signature once, however often it is placed.
        let mut index: HashMap<String, usize> = HashMap::new();
        let mut images = vec![];
        let mut placed = vec![];
        for item in items {
            let (page, rect, kind) = match item {
                ItemRequest::Signature {
                    page,
                    rect,
                    signature_id,
                } => {
                    let i = match index.get(&signature_id) {
                        Some(i) => *i,
                        None => {
                            let png = signatures::image(&s.db(), &key, &signature_id)?;
                            images.push(imaging::decode_pixels(
                                &png,
                                None,
                                BitmapAlphaMode::Straight,
                            )?);
                            index.insert(signature_id, images.len() - 1);
                            images.len() - 1
                        }
                    };
                    (page, rect, MarkKind::Image(i))
                }
                ItemRequest::Text {
                    page,
                    rect,
                    text,
                    font_size,
                } => (
                    page,
                    rect,
                    MarkKind::Text {
                        text,
                        size: font_size,
                    },
                ),
                ItemRequest::Check { page, rect } => (page, rect, MarkKind::Check),
                ItemRequest::Cross { page, rect } => (page, rect, MarkKind::Cross),
                ItemRequest::Cover { page, rect } => (page, rect, MarkKind::Cover),
            };
            placed.push(Mark { page, rect, kind });
        }
        let out = edit::edit(&bytes, &pages, &placed, &images)?;

        if let Some(title) = copy_title {
            return store_copy(&s, &doc, &title, &out);
        }
        vault::store(&s.paths, &key, &id, &out)?;
        let conn = s.db();
        documents::replace_file(&conn, &id, out.len() as i64, db::now_ms())?;
        search::index_document(&conn, &key, &documents::get(&conn, &key, &id)?)?;
        Ok(id)
    })
    .await?;
    queue.enqueue(result.clone());
    changed(&app);
    Ok(result)
}

/// Combines images (in the given order) into a new PDF document. Returns its id.
#[tauri::command]
pub async fn documents_combine_images(
    app: AppHandle,
    state: St<'_>,
    queue: State<'_, OcrQueue>,
    ids: Vec<String>,
    title: String,
) -> AppResult<String> {
    if ids.is_empty() || ids.len() > MAX_COMBINE {
        return Err(AppError::Invalid(format!(
            "Choose between 1 and {MAX_COMBINE} images"
        )));
    }
    let s = state.inner().clone();
    let a = app.clone();
    let id = blocking(move || {
        ocr::init_thread();
        let key = s.key()?;
        let mut pages = vec![];
        let mut first = None;
        let mut any_locked = false;
        let total = ids.len() as u32;
        for (n, id) in ids.iter().enumerate() {
            ensure_access(&s, id)?;
            let doc = documents::get(&s.db(), &key, id)?;
            if doc.kind != "image" {
                return Err(AppError::Invalid(format!("{} is not an image", doc.title)));
            }
            any_locked |= doc.locked;
            let bytes = vault::read(&s.paths, &key, id)?;
            pages.push(build::image_page(&bytes)?);
            first.get_or_insert(doc);
            let _ = a.emit(
                "progress://pdf",
                PdfProgress {
                    document_id: String::new(),
                    done: n as u32 + 1,
                    total,
                },
            );
        }
        let pdf = build::jpeg_pages_to_pdf(&pages)?;
        let mut like = first.ok_or(AppError::NotFound)?;
        // One locked source page makes the whole PDF locked.
        like.locked = any_locked;
        like.tags.clear();
        store_copy(&s, &like, &title, &pdf)
    })
    .await?;
    queue.enqueue(id.clone());
    changed(&app);
    Ok(id)
}

/// Exports a flattened copy with black boxes burned in. PDFs stay PDFs; images are written
/// as PNG when `target` ends in .png, otherwise as JPEG.
#[tauri::command]
pub async fn document_export_redacted(
    app: AppHandle,
    state: St<'_>,
    id: String,
    target: String,
    boxes: Vec<redact::RedactBox>,
) -> AppResult<()> {
    let s = state.inner().clone();
    blocking(move || {
        ocr::init_thread();
        let key = s.key()?;
        ensure_access(&s, &id)?;
        let doc = documents::get(&s.db(), &key, &id)?;
        let bytes = vault::read(&s.paths, &key, &id)?;
        let out = match doc.kind.as_str() {
            "pdf" => redact::redact_pdf(&bytes, &boxes, |done, total| {
                let _ = app.emit(
                    "progress://redact",
                    PdfProgress {
                        document_id: id.clone(),
                        done,
                        total,
                    },
                );
            })?,
            "image" => {
                let png = target.to_lowercase().ends_with(".png");
                let format = if png { Format::Png } else { Format::Jpeg };
                redact::redact_image(&bytes, &boxes, format)?
            }
            _ => {
                return Err(AppError::Invalid(
                    "Only PDFs and images can be redacted".into(),
                ))
            }
        };
        std::fs::write(&target, out)?;
        Ok(())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn items_deserialize_from_frontend_json() {
        let json = serde_json::json!([
            { "kind": "signature", "page": 0, "signatureId": "s1",
              "rect": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.1 } },
            { "kind": "text", "page": 1, "text": "Berlin", "fontSize": 0.014,
              "rect": { "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.02 } },
            { "kind": "check", "page": 0, "rect": { "x": 0.5, "y": 0.5, "w": 0.03, "h": 0.02 } },
            { "kind": "cross", "page": 0, "rect": { "x": 0.5, "y": 0.5, "w": 0.03, "h": 0.02 } },
            { "kind": "cover", "page": 0, "rect": { "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.05 } },
        ]);
        let items: Vec<ItemRequest> = serde_json::from_value(json).unwrap();
        assert_eq!(items.len(), 5);
        assert!(
            matches!(&items[0], ItemRequest::Signature { signature_id, .. } if signature_id == "s1")
        );
        assert!(matches!(&items[1], ItemRequest::Text { font_size, .. } if *font_size == 0.014));
        assert!(matches!(items[4], ItemRequest::Cover { .. }));
    }
}
