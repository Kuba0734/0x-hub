//! Background scheduler: expiry reminders, idle auto-lock, trash purge and auto-backup.
//! Runs in its own thread for the whole app lifetime, also while the window is in the tray.

use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, NaiveDate};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;

use crate::db::{self, documents, notes, settings};
use crate::error::AppResult;
use crate::state::AppState;
use crate::{auth, backup, vault};

const TICK: Duration = Duration::from_secs(20);
const SLOW_EVERY_TICKS: u32 = 90; // ~30 minutes

#[derive(Debug, Clone, PartialEq)]
pub struct DueReminder {
    pub document_id: String,
    pub expires_on: String,
    pub days_left: i64,
    /// All offsets that are now due; they are logged together so the user gets one toast.
    pub offsets: Vec<u32>,
}

/// Pure due-date computation, separated for testing.
pub fn due_reminders(
    rows: &[documents::ExpiryRow],
    today: NaiveDate,
    already_sent: impl Fn(&str, u32, &str) -> bool,
) -> Vec<DueReminder> {
    let mut out = Vec::new();
    for row in rows {
        let Ok(expires) = NaiveDate::parse_from_str(&row.expires_on, "%Y-%m-%d") else {
            continue;
        };
        let days_left = (expires - today).num_days();
        if days_left < 0 {
            continue;
        }
        let due: Vec<u32> = row
            .offsets
            .iter()
            .copied()
            .filter(|&o| days_left <= o as i64 && !already_sent(&row.id, o, &row.expires_on))
            .collect();
        if !due.is_empty() {
            out.push(DueReminder {
                document_id: row.id.clone(),
                expires_on: row.expires_on.clone(),
                days_left,
                offsets: due,
            });
        }
    }
    out
}

pub fn spawn(app: AppHandle, state: Arc<AppState>) {
    std::thread::Builder::new()
        .name("0x-hub-scheduler".into())
        .spawn(move || {
            let mut tick: u32 = 0;
            loop {
                if let Err(e) = auto_lock(&app, &state) {
                    eprintln!("auto-lock failed: {e}");
                }
                if tick % SLOW_EVERY_TICKS == 0 {
                    for (name, result) in [
                        ("reminders", send_reminders(&app, &state)),
                        ("trash purge", purge_trash(&state)),
                        ("auto-backup", backup::run_auto_backup(&state).map(|_| ())),
                    ] {
                        if let Err(e) = result {
                            eprintln!("{name} failed: {e}");
                        }
                    }
                }
                tick = tick.wrapping_add(1);
                std::thread::sleep(TICK);
            }
        })
        .ok();
}

fn auto_lock(app: &AppHandle, state: &AppState) -> AppResult<()> {
    if !state.is_unlocked() {
        return Ok(());
    }
    let minutes = settings::get(&state.db())?.auto_lock_minutes;
    if minutes > 0 && state.idle_ms() > minutes as i64 * 60_000 {
        auth::lock(state)?;
        let _ = app.emit("vault://locked", "idle");
    }
    Ok(())
}

pub fn send_reminders(app: &AppHandle, state: &AppState) -> AppResult<()> {
    let conn = state.db();
    if !settings::get(&conn)?.notifications_enabled {
        return Ok(());
    }
    let rows = documents::with_expiry(&conn)?;
    let today = Local::now().date_naive();
    let due = due_reminders(&rows, today, |id, o, exp| {
        documents::reminder_sent(&conn, id, o, exp).unwrap_or(true)
    });
    let key = state.key().ok();
    for r in due {
        let title = key
            .as_ref()
            .and_then(|k| documents::get(&conn, k, &r.document_id).ok())
            .map(|d| d.title)
            .unwrap_or_else(|| "A document".into());
        let body = match r.days_left {
            0 => format!("{title} expires today."),
            1 => format!("{title} expires tomorrow."),
            n => format!("{title} expires in {n} days ({}).", r.expires_on),
        };
        let _ = app
            .notification()
            .builder()
            .title("Expiry reminder")
            .body(body)
            .show();
        for o in &r.offsets {
            documents::log_reminder(&conn, &r.document_id, *o, &r.expires_on, db::now_ms())?;
        }
    }
    Ok(())
}

fn purge_trash(state: &AppState) -> AppResult<()> {
    let now = db::now_ms();
    let conn = state.db();
    for id in documents::expired_trash(&conn, now)? {
        vault::remove(&state.paths, &id)?;
        documents::delete_row(&conn, &id)?;
    }
    notes::purge_expired(&conn, now)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str, exp: &str, offsets: Vec<u32>) -> documents::ExpiryRow {
        documents::ExpiryRow {
            id: id.into(),
            expires_on: exp.into(),
            offsets,
        }
    }

    #[test]
    fn computes_due_offsets() {
        let today = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let rows = vec![
            row("far", "2026-12-31", vec![90, 30]),
            row("soon", "2026-01-06", vec![90, 30, 7, 1]),
            row("past", "2025-12-01", vec![30]),
            row("bad", "not-a-date", vec![30]),
        ];
        let due = due_reminders(&rows, today, |_, _, _| false);
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].document_id, "soon");
        assert_eq!(due[0].days_left, 5);
        assert_eq!(due[0].offsets, vec![90, 30, 7]);

        let due = due_reminders(&rows, today, |_, o, _| o != 7);
        assert_eq!(due[0].offsets, vec![7]);
        assert!(due_reminders(&rows, today, |_, _, _| true).is_empty());
    }
}
