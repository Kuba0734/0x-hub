use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use super::St;
use crate::error::AppResult;
use crate::ocr::jobs::OcrQueue;
use crate::phone::{Notify, PhoneEvent, PhoneUploads, SessionInfo};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Received {
    name: String,
}

/// Starts the local-Wi-Fi upload server and returns the QR code for the phone.
#[tauri::command]
pub fn phone_upload_start(
    app: AppHandle,
    state: St<'_>,
    uploads: State<'_, PhoneUploads>,
) -> AppResult<SessionInfo> {
    let notify: Notify = Arc::new(move |event| match event {
        PhoneEvent::Received { name, id } => {
            if let Some(queue) = app.try_state::<OcrQueue>() {
                queue.enqueue(id);
            }
            let _ = app.emit("phone://received", Received { name });
            let _ = app.emit("documents://changed", ());
        }
        // Carries the URL so the UI can ignore a previous session ending late.
        PhoneEvent::Stopped { url } => {
            let _ = app.emit("phone://stopped", url);
        }
    });
    uploads.start(state.inner().clone(), notify)
}

#[tauri::command]
pub fn phone_upload_stop(uploads: State<'_, PhoneUploads>) {
    uploads.stop();
}
