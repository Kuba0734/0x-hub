use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppResult;

const KEY: &str = "app";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AutoBackup {
    pub enabled: bool,
    pub folder: Option<String>,
    pub interval_days: u32,
    pub last_run_at: Option<i64>,
}

impl Default for AutoBackup {
    fn default() -> Self {
        AutoBackup {
            enabled: false,
            folder: None,
            interval_days: 7,
            last_run_at: None,
        }
    }
}

/// Non-sensitive app settings, stored as one JSON value.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub auto_lock_minutes: u32,
    pub lock_on_session_lock: bool,
    pub close_to_tray: bool,
    /// `None` follows the Windows "Show animations" setting.
    pub reduce_motion: Option<bool>,
    pub glass_intensity: f32,
    pub sidebar_collapsed: bool,
    pub notifications_enabled: bool,
    pub default_reminder_offsets: Vec<u32>,
    pub hotkey: String,
    pub autostart: bool,
    pub auto_backup: AutoBackup,
    pub skip_version: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            auto_lock_minutes: 10,
            lock_on_session_lock: true,
            close_to_tray: true,
            reduce_motion: None,
            glass_intensity: 1.0,
            sidebar_collapsed: false,
            notifications_enabled: true,
            default_reminder_offsets: vec![90, 30, 7, 1],
            hotkey: "Ctrl+Alt+Space".into(),
            autostart: false,
            auto_backup: AutoBackup::default(),
            skip_version: None,
        }
    }
}

pub fn get(conn: &Connection) -> AppResult<AppSettings> {
    let raw: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", [KEY], |r| {
            r.get(0)
        })
        .optional()?;
    Ok(match raw {
        Some(json) => serde_json::from_str(&json).unwrap_or_default(),
        None => AppSettings::default(),
    })
}

pub fn put(conn: &Connection, s: &AppSettings) -> AppResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![KEY, serde_json::to_string(s)?],
    )?;
    Ok(())
}

/// Applies a partial JSON patch (top-level keys, `autoBackup` merged one level deep).
pub fn patch(conn: &Connection, patch: serde_json::Value) -> AppResult<AppSettings> {
    let current = get(conn)?;
    let mut value = serde_json::to_value(&current)?;
    if let (Some(obj), Some(p)) = (value.as_object_mut(), patch.as_object()) {
        for (k, v) in p {
            match (obj.get_mut(k), v) {
                (Some(serde_json::Value::Object(inner)), serde_json::Value::Object(pv)) => {
                    for (ik, iv) in pv {
                        inner.insert(ik.clone(), iv.clone());
                    }
                }
                _ => {
                    obj.insert(k.clone(), v.clone());
                }
            }
        }
    }
    let next: AppSettings = serde_json::from_value(value)?;
    put(conn, &next)?;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_then_patch() {
        let conn = crate::db::open_in_memory().unwrap();
        assert_eq!(get(&conn).unwrap(), AppSettings::default());
        let s = patch(
            &conn,
            serde_json::json!({ "autoLockMinutes": 5, "autoBackup": { "enabled": true } }),
        )
        .unwrap();
        assert_eq!(s.auto_lock_minutes, 5);
        assert!(s.auto_backup.enabled);
        assert_eq!(s.auto_backup.interval_days, 7);
        assert_eq!(get(&conn).unwrap(), s);
    }
}
