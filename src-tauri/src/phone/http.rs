//! Request handling for the phone upload server. Only two routes exist, both behind the
//! session token: `GET /<token>/` (upload page) and `POST /<token>/upload` (one file).

use std::io::Read;
use std::sync::Arc;

use tiny_http::{Header, Method, Request, Response};

use super::{Notify, PhoneEvent};
use crate::state::AppState;
use crate::vault::{import::import_bytes, MAX_FILE_BYTES};

const PAGE: &str = include_str!("page.html");

fn header(name: &str, value: &str) -> Option<Header> {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).ok()
}

fn send(req: Request, status: u16, content_type: &str, body: String) {
    let mut res = Response::from_string(body).with_status_code(status);
    for h in [
        header("Content-Type", content_type),
        header("Cache-Control", "no-store"),
        header("X-Content-Type-Options", "nosniff"),
        header("Referrer-Policy", "no-referrer"),
        header(
            "Content-Security-Policy",
            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
        ),
    ]
    .into_iter()
    .flatten()
    {
        res.add_header(h);
    }
    let _ = req.respond(res);
}

fn json(req: Request, status: u16, body: serde_json::Value) {
    send(req, status, "application/json", body.to_string());
}

/// Decodes `encodeURIComponent` output; invalid sequences are kept literally.
pub fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn handle(mut req: Request, token: &str, state: &Arc<AppState>, notify: &Notify) {
    let base = format!("/{token}/");
    let url = req.url().to_string();
    if !url.starts_with(&base) {
        return send(req, 404, "text/plain", "Not found".into());
    }
    let route = &url[base.len()..];
    match (req.method(), route) {
        (Method::Get, "") => send(req, 200, "text/html; charset=utf-8", PAGE.into()),
        (Method::Post, "upload") => {
            if !state.is_unlocked() {
                return json(req, 423, serde_json::json!({ "error": "0x-hub is locked" }));
            }
            let name = req
                .headers()
                .iter()
                .find(|h| h.field.equiv("X-Filename"))
                .map(|h| percent_decode(h.value.as_str()))
                .filter(|n| !n.trim().is_empty())
                .unwrap_or_else(|| "upload".into());
            if req.body_length().is_some_and(|n| n as u64 > MAX_FILE_BYTES) {
                return json(
                    req,
                    413,
                    serde_json::json!({ "error": "File is larger than 512 MB" }),
                );
            }
            let mut body = Vec::new();
            if req
                .as_reader()
                .take(MAX_FILE_BYTES + 1)
                .read_to_end(&mut body)
                .is_err()
            {
                return json(
                    req,
                    400,
                    serde_json::json!({ "error": "Upload interrupted" }),
                );
            }
            match import_bytes(state, &name, &body, None) {
                Ok(id) => {
                    notify(PhoneEvent::Received { name, id });
                    json(req, 200, serde_json::json!({ "ok": true }))
                }
                Err(e) => json(req, 400, serde_json::json!({ "error": e.to_string() })),
            }
        }
        _ => send(req, 404, "text/plain", "Not found".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_uri_components() {
        assert_eq!(percent_decode("IMG_0042.HEIC"), "IMG_0042.HEIC");
        assert_eq!(
            percent_decode("Steuer%20%C3%BCbersicht.pdf"),
            "Steuer übersicht.pdf"
        );
        assert_eq!(percent_decode("bad%zz%"), "bad%zz%");
    }
}
