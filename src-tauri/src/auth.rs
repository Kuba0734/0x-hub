//! Master password, recovery key and lock/unlock flow.

use serde::Serialize;
use zeroize::Zeroizing;

use crate::crypto::{self, SecretKey, SALT_LEN};
use crate::db::{self, keystore, search};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub const MIN_PASSWORD_LEN: usize = 8;

const CHECK_PLAINTEXT: &[u8] = b"0x-hub";
const CHECK_AAD: &[u8] = b"0x-hub:dek-check:v1";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub hello_enabled: bool,
    pub retry_after_ms: u64,
}

pub fn status(state: &AppState) -> AppResult<VaultStatus> {
    let row = keystore::get(&state.db())?;
    Ok(VaultStatus {
        initialized: row.is_some(),
        unlocked: state.is_unlocked(),
        hello_enabled: row.as_ref().is_some_and(|r| r.hello_blob.is_some()),
        retry_after_ms: row.map(|r| remaining_backoff(&r)).unwrap_or(0),
    })
}

fn remaining_backoff(row: &keystore::KeystoreRow) -> u64 {
    let wait = keystore::backoff_ms(row.failed_attempts) as i64;
    let since = db::now_ms() - row.last_failed_at.unwrap_or(0);
    (wait - since).max(0) as u64
}

fn check_password_rules(password: &str) -> AppResult<()> {
    if password.chars().count() < MIN_PASSWORD_LEN {
        return Err(AppError::Invalid(format!(
            "Use at least {MIN_PASSWORD_LEN} characters"
        )));
    }
    Ok(())
}

/// First-run setup. Returns the recovery key, which is shown to the user exactly once.
pub fn setup(state: &AppState, password: &str) -> AppResult<Zeroizing<String>> {
    check_password_rules(password)?;
    if keystore::get(&state.db())?.is_some() {
        return Err(AppError::AlreadyInitialized);
    }
    let salt: [u8; SALT_LEN] = crypto::random_bytes();
    let kek = crypto::derive_kek(password.as_bytes(), &salt, state.kdf)?;
    let dek = SecretKey::generate();
    let recovery = crypto::generate_recovery_key();
    let row = keystore::KeystoreRow {
        kdf_salt: salt.to_vec(),
        kdf: state.kdf,
        wrapped_dek: crypto::wrap_key(&kek, &dek)?,
        recovery_wrapped_dek: crypto::wrap_key(&recovery, &dek)?,
        dek_check: crypto::encrypt(&dek, CHECK_PLAINTEXT, CHECK_AAD)?,
        hello_blob: None,
        failed_attempts: 0,
        last_failed_at: None,
    };
    {
        let conn = state.db();
        keystore::insert(&conn, &row)?;
        search::rebuild(&conn, &dek)?;
    }
    state.set_key(Some(dek));
    state.touch();
    Ok(crypto::format_recovery_key(&recovery))
}

fn finish_unlock(state: &AppState, dek: SecretKey) -> AppResult<()> {
    {
        let conn = state.db();
        keystore::reset_failures(&conn)?;
        search::rebuild(&conn, &dek)?;
    }
    state.set_key(Some(dek));
    state.touch();
    Ok(())
}

fn fail(state: &AppState) -> AppError {
    match keystore::record_failure(&state.db(), db::now_ms()) {
        Ok(n) => AppError::WrongPassword {
            retry_after_ms: keystore::backoff_ms(n),
        },
        Err(e) => e,
    }
}

pub fn unlock_with_password(state: &AppState, password: &str) -> AppResult<()> {
    let row = keystore::get(&state.db())?.ok_or(AppError::NotInitialized)?;
    let wait = remaining_backoff(&row);
    if wait > 0 {
        return Err(AppError::Backoff {
            retry_after_ms: wait,
        });
    }
    let kek = crypto::derive_kek(password.as_bytes(), &row.kdf_salt, row.kdf)?;
    match crypto::unwrap_key(&kek, &row.wrapped_dek) {
        Ok(dek) => finish_unlock(state, dek),
        Err(_) => Err(fail(state)),
    }
}

/// Unlocks with the recovery key and immediately sets a new master password.
pub fn recover(state: &AppState, recovery_key: &str, new_password: &str) -> AppResult<()> {
    check_password_rules(new_password)?;
    let row = keystore::get(&state.db())?.ok_or(AppError::NotInitialized)?;
    let wait = remaining_backoff(&row);
    if wait > 0 {
        return Err(AppError::Backoff {
            retry_after_ms: wait,
        });
    }
    let rk = crypto::parse_recovery_key(recovery_key)?;
    let dek = match crypto::unwrap_key(&rk, &row.recovery_wrapped_dek) {
        Ok(d) => d,
        Err(_) => return Err(fail(state)),
    };
    rewrap_password(state, &dek, new_password)?;
    finish_unlock(state, dek)
}

fn rewrap_password(state: &AppState, dek: &SecretKey, password: &str) -> AppResult<()> {
    let salt: [u8; SALT_LEN] = crypto::random_bytes();
    let kek = crypto::derive_kek(password.as_bytes(), &salt, state.kdf)?;
    let wrapped = crypto::wrap_key(&kek, dek)?;
    keystore::update_password_wrap(&state.db(), &salt, state.kdf, &wrapped)
}

pub fn change_password(state: &AppState, current: &str, next: &str) -> AppResult<()> {
    check_password_rules(next)?;
    let row = keystore::get(&state.db())?.ok_or(AppError::NotInitialized)?;
    let kek = crypto::derive_kek(current.as_bytes(), &row.kdf_salt, row.kdf)?;
    let dek = crypto::unwrap_key(&kek, &row.wrapped_dek)
        .map_err(|_| AppError::WrongPassword { retry_after_ms: 0 })?;
    rewrap_password(state, &dek, next)
}

/// Unlocks with a DEK obtained another way (Windows Hello), after checking it against
/// the canary stored at setup.
pub fn unlock_with_dek(state: &AppState, dek: SecretKey) -> AppResult<()> {
    let row = keystore::get(&state.db())?.ok_or(AppError::NotInitialized)?;
    match crypto::decrypt(&dek, &row.dek_check, CHECK_AAD) {
        Ok(v) if v == CHECK_PLAINTEXT => finish_unlock(state, dek),
        _ => Err(AppError::Crypto),
    }
}

pub fn lock(state: &AppState) -> AppResult<()> {
    state.set_key(None);
    search::drop_index(&state.db())?;
    state.paths.wipe_open_temp();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::Paths;

    fn temp_state() -> (tempfile::TempDir, AppState) {
        let dir = tempfile::tempdir().unwrap();
        let paths = Paths::at(dir.path().join("data"), dir.path().join("open"));
        let state = AppState::open(paths, crypto::test_params()).unwrap();
        (dir, state)
    }

    #[test]
    fn setup_lock_unlock_cycle() {
        let (_d, state) = temp_state();
        assert!(!status(&state).unwrap().initialized);
        assert!(setup(&state, "short").is_err());
        let recovery = setup(&state, "correct horse battery").unwrap();
        assert!(state.is_unlocked());
        assert!(matches!(
            setup(&state, "another password"),
            Err(AppError::AlreadyInitialized)
        ));

        lock(&state).unwrap();
        assert!(!state.is_unlocked());
        assert!(matches!(
            unlock_with_password(&state, "wrong password"),
            Err(AppError::WrongPassword { .. })
        ));
        unlock_with_password(&state, "correct horse battery").unwrap();
        assert!(state.is_unlocked());

        lock(&state).unwrap();
        recover(&state, &recovery, "brand new password").unwrap();
        lock(&state).unwrap();
        assert!(unlock_with_password(&state, "correct horse battery").is_err());
    }

    #[test]
    fn backoff_after_repeated_failures() {
        let (_d, state) = temp_state();
        setup(&state, "correct horse battery").unwrap();
        lock(&state).unwrap();
        for _ in 0..3 {
            let _ = unlock_with_password(&state, "nope nope");
        }
        assert!(matches!(
            unlock_with_password(&state, "correct horse battery"),
            Err(AppError::Backoff { .. })
        ));
        assert!(status(&state).unwrap().retry_after_ms > 0);
    }

    #[test]
    fn change_password_keeps_data_key() {
        let (_d, state) = temp_state();
        setup(&state, "first password").unwrap();
        let before = state.key().unwrap();
        change_password(&state, "first password", "second password").unwrap();
        lock(&state).unwrap();
        unlock_with_password(&state, "second password").unwrap();
        assert_eq!(state.key().unwrap().as_bytes(), before.as_bytes());
        assert!(change_password(&state, "wrong", "third password").is_err());
    }

    #[test]
    fn unlock_with_dek_checks_canary() {
        let (_d, state) = temp_state();
        setup(&state, "first password").unwrap();
        let dek = state.key().unwrap();
        lock(&state).unwrap();
        assert!(unlock_with_dek(&state, SecretKey::generate()).is_err());
        assert!(!state.is_unlocked());
        unlock_with_dek(&state, dek).unwrap();
        assert!(state.is_unlocked());
    }
}
