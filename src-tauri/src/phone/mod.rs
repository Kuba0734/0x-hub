//! Phone upload over the local Wi-Fi — the one deliberate network exception besides the
//! update check (see CLAUDE.md). A tiny HTTP server runs only while the user keeps the
//! "Receive from phone" dialog open:
//! - bound to the PC's private LAN address only, random port,
//! - every URL carries a random 128-bit one-time token,
//! - stops after 10 minutes, when the dialog closes, or when the vault locks,
//! - files are encrypted into the vault straight from memory.
//!
//! Traffic is plain HTTP inside the LAN (iOS rejects self-signed certificates), so the UI
//! tells the user to use it on trusted networks only.

mod http;
mod scan;

use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::crypto;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub const SESSION_TTL: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub url: String,
    pub qr_svg: String,
    pub expires_at: i64,
}

/// What the server reports back to the app (events, OCR queue).
pub enum PhoneEvent {
    /// A file was imported as document `id`.
    Received { name: String, id: String },
    /// The session with this URL ended (timeout, stop, or vault locked).
    Stopped { url: String },
}

pub type Notify = Arc<dyn Fn(PhoneEvent) + Send + Sync>;

#[derive(Default)]
pub struct PhoneUploads {
    stop: Mutex<Option<Arc<AtomicBool>>>,
}

impl PhoneUploads {
    pub fn start(&self, state: Arc<AppState>, notify: Notify) -> AppResult<SessionInfo> {
        state.key()?;
        self.stop();
        let ip = lan_ip()?;
        let server = tiny_http::Server::http(SocketAddr::new(IpAddr::V4(ip), 0))
            .map_err(|e| AppError::Invalid(format!("Couldn't start the upload server: {e}")))?;
        let port = server
            .server_addr()
            .to_ip()
            .map(|a| a.port())
            .ok_or_else(|| AppError::Invalid("No port assigned".into()))?;
        let token = hex(&crypto::random_bytes::<16>());
        let url = format!("http://{ip}:{port}/{token}/");
        let qr_svg = qr_svg(&url)?;

        let stop = Arc::new(AtomicBool::new(false));
        *self.stop.lock().unwrap_or_else(|e| e.into_inner()) = Some(stop.clone());
        let deadline = Instant::now() + SESSION_TTL;
        let session_url = url.clone();
        std::thread::Builder::new()
            .name("0x-hub-phone-upload".into())
            .spawn(move || {
                crate::ocr::init_thread();
                while !stop.load(Ordering::Relaxed)
                    && Instant::now() < deadline
                    && state.is_unlocked()
                {
                    if let Ok(Some(req)) = server.recv_timeout(Duration::from_millis(400)) {
                        http::handle(req, &token, &state, &notify);
                    }
                }
                notify(PhoneEvent::Stopped { url: session_url });
            })?;

        Ok(SessionInfo {
            url,
            qr_svg,
            expires_at: crate::db::now_ms() + SESSION_TTL.as_millis() as i64,
        })
    }

    pub fn stop(&self) {
        if let Some(flag) = self.stop.lock().unwrap_or_else(|e| e.into_inner()).take() {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

/// The PC's address on the local network. Connecting a UDP socket sends no packets; it
/// only asks Windows which interface would route to that (TEST-NET) address.
fn lan_ip() -> AppResult<Ipv4Addr> {
    let not_on_lan =
        || AppError::Invalid("This PC isn't connected to a local network (Wi-Fi or LAN).".into());
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.connect("192.0.2.1:9").map_err(|_| not_on_lan())?;
    match socket.local_addr()?.ip() {
        IpAddr::V4(ip) if ip.is_private() => Ok(ip),
        IpAddr::V4(ip) if ip.is_link_local() => Ok(ip),
        _ => Err(not_on_lan()),
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn qr_svg(url: &str) -> AppResult<String> {
    use qrcode::render::svg;
    let code = qrcode::QrCode::new(url.as_bytes())
        .map_err(|e| AppError::Invalid(format!("QR code: {e}")))?;
    Ok(code
        .render::<svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(true)
        .dark_color(svg::Color("#000000"))
        .light_color(svg::Color("#ffffff"))
        .build())
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::io::{Read, Write};
    use std::net::TcpStream;

    /// Minimal HTTP/1.1 client: returns (status, body).
    fn request(url: &str, method: &str, path: &str, headers: &str, body: &[u8]) -> (u16, String) {
        let host = url.trim_start_matches("http://").split('/').next().unwrap();
        let mut s = TcpStream::connect(host).unwrap();
        write!(
            s,
            "{method} {path} HTTP/1.1\r\nHost: {host}\r\nContent-Length: {}\r\nConnection: close\r\n{headers}\r\n",
            body.len()
        )
        .unwrap();
        s.write_all(body).unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        let status = out[9..12].parse().unwrap();
        let body = out.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
        (status, body)
    }

    /// End-to-end over a real socket. Needs a LAN interface, so it's opt-in:
    /// `cargo test -- --ignored phone_upload_end_to_end`
    #[test]
    #[ignore]
    fn phone_upload_end_to_end() {
        let dir = tempfile::tempdir().unwrap();
        let paths = crate::paths::Paths::at(dir.path().join("d"), dir.path().join("o"));
        let state = Arc::new(AppState::open(paths, crate::crypto::test_params()).unwrap());
        crate::auth::setup(&state, "phone password").unwrap();
        let received = Arc::new(Mutex::new(Vec::<String>::new()));
        let sink = received.clone();
        let notify: Notify = Arc::new(move |e| {
            if let PhoneEvent::Received { name, .. } = e {
                sink.lock().unwrap().push(name);
            }
        });
        let uploads = PhoneUploads::default();
        let info = uploads.start(state.clone(), notify).unwrap();
        let path = info
            .url
            .split_once("://")
            .unwrap()
            .1
            .split_once('/')
            .unwrap()
            .1;
        let path = format!("/{path}");

        let (status, page) = request(&info.url, "GET", &path, "", b"");
        assert_eq!(status, 200);
        assert!(page.contains("Send to 0x-hub"));

        assert_eq!(request(&info.url, "GET", "/wrong-token/", "", b"").0, 404);

        let (status, _) = request(
            &info.url,
            "POST",
            &format!("{path}upload"),
            "X-Filename: Kassenbon%20M%C3%A4rz.txt\r\n",
            b"hello from the phone",
        );
        assert_eq!(status, 200);
        let key = state.key().unwrap();
        let docs = crate::db::documents::list(&state.db(), &key, false).unwrap();
        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].filename, "Kassenbon März.txt");
        assert_eq!(
            *received.lock().unwrap(),
            vec!["Kassenbon März.txt".to_string()]
        );
        assert_eq!(
            crate::vault::read(&state.paths, &key, &docs[0].id).unwrap(),
            b"hello from the phone"
        );

        // A two-page scan becomes one PDF document.
        let page = crate::imaging::encode_pixels(
            &crate::imaging::Pixels {
                width: 40,
                height: 56,
                bgra: vec![240; 40 * 56 * 4],
            },
            crate::imaging::Format::Jpeg,
        )
        .unwrap();
        let mut body = page.clone();
        body.extend_from_slice(&page);
        let (status, _) = request(
            &info.url,
            "POST",
            &format!("{path}scan"),
            &format!(
                "X-Filename: Mietvertrag\r\nX-Scan-Pages: {},{}\r\n",
                page.len(),
                page.len()
            ),
            &body,
        );
        assert_eq!(status, 200);
        let docs = crate::db::documents::list(&state.db(), &key, false).unwrap();
        let scan = docs
            .iter()
            .find(|d| d.filename == "Mietvertrag.pdf")
            .unwrap();
        assert_eq!(scan.kind, "pdf");
        let pdf = crate::vault::read(&state.paths, &key, &scan.id).unwrap();
        assert_eq!(crate::pdf::edit::page_count(&pdf).unwrap(), 2);
        // Mismatched page lengths are rejected.
        let (status, _) = request(
            &info.url,
            "POST",
            &format!("{path}scan"),
            "X-Scan-Pages: 5,5\r\n",
            b"short",
        );
        assert_eq!(status, 400);

        // Locking the vault ends the session.
        crate::auth::lock(&state).unwrap();
        std::thread::sleep(Duration::from_millis(900));
        assert!(
            TcpStream::connect(
                info.url
                    .trim_start_matches("http://")
                    .split('/')
                    .next()
                    .unwrap()
            )
            .is_err()
                || request(&info.url, "GET", &path, "", b"").0 != 200
        );
        uploads.stop();
    }

    #[test]
    fn hex_and_qr() {
        assert_eq!(hex(&[0, 15, 255]), "000fff");
        let svg = qr_svg("http://192.168.1.20:5000/abc/").unwrap();
        assert!(svg.starts_with("<?xml") && svg.contains("<svg"));
    }
}
