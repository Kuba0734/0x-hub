//! Single background OCR worker fed by a queue, so OCR never competes with itself.

use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db::{documents, search};
use crate::error::AppResult;
use crate::state::AppState;
use crate::vault;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrProgress {
    pub document_id: String,
    pub done: u32,
    pub total: u32,
    pub status: String,
}

pub struct OcrQueue {
    tx: Mutex<Sender<String>>,
}

impl OcrQueue {
    pub fn enqueue(&self, id: String) {
        if let Ok(tx) = self.tx.lock() {
            let _ = tx.send(id);
        }
    }

    /// Re-queues everything still pending, e.g. after unlock.
    pub fn resume(&self, state: &AppState) -> AppResult<()> {
        for id in documents::ids_needing_ocr(&state.db())? {
            self.enqueue(id);
        }
        Ok(())
    }
}

pub fn spawn(app: AppHandle, state: Arc<AppState>) -> OcrQueue {
    let (tx, rx) = channel::<String>();
    std::thread::Builder::new()
        .name("0x-hub-ocr".into())
        .spawn(move || {
            super::init_thread();
            while let Ok(id) = rx.recv() {
                let status = match process(&app, &state, &id) {
                    Ok(s) => s,
                    Err(e) => {
                        eprintln!("OCR failed for {id}: {e}");
                        let _ = documents::set_ocr_status(&state.db(), &id, "failed");
                        "failed"
                    }
                };
                let _ = app.emit(
                    "progress://ocr",
                    OcrProgress {
                        document_id: id,
                        done: 1,
                        total: 1,
                        status: status.into(),
                    },
                );
                let _ = app.emit("documents://changed", ());
            }
        })
        .ok();
    OcrQueue { tx: Mutex::new(tx) }
}

fn process(app: &AppHandle, state: &AppState, id: &str) -> AppResult<&'static str> {
    // Locked: leave it pending; it is re-queued on the next unlock.
    let Ok(key) = state.key() else {
        return Ok("pending");
    };
    let doc = documents::get(&state.db(), &key, id)?;
    if doc.deleted_at.is_some() || !(doc.kind == "image" || doc.kind == "pdf") {
        return Ok("none");
    }
    documents::set_ocr_status(&state.db(), id, "running")?;
    let bytes = vault::read(&state.paths, &key, id)?;
    let text = if doc.kind == "pdf" {
        super::pdf_text(&bytes, |done, total| {
            let _ = app.emit(
                "progress://ocr",
                OcrProgress {
                    document_id: id.into(),
                    done,
                    total,
                    status: "running".into(),
                },
            );
        })?
    } else {
        super::image_text(&bytes)?
    };
    let conn = state.db();
    documents::set_ocr(&conn, &key, id, Some(text.trim()), "done")?;
    if state.is_unlocked() {
        search::index_document(&conn, &key, &doc)?;
    }
    Ok("done")
}
