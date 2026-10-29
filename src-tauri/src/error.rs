use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Every error that crosses the IPC boundary. Serialized as `{ code, message, retryAfterMs }`.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("The vault is locked")]
    Locked,
    #[error("The vault is not set up yet")]
    NotInitialized,
    #[error("The vault is already set up")]
    AlreadyInitialized,
    #[error("Wrong password")]
    WrongPassword { retry_after_ms: u64 },
    #[error("Too many attempts. Wait a moment and try again")]
    Backoff { retry_after_ms: u64 },
    #[error("Not found")]
    NotFound,
    #[error("This document is locked. Confirm it's you to open it")]
    DocumentLocked,
    #[error("{0}")]
    Invalid(String),
    #[error("Windows Hello is not available")]
    HelloUnavailable,
    #[error("Windows Hello verification was cancelled")]
    HelloCancelled,
    #[error("Decryption failed")]
    Crypto,
    #[error("Database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("Migration error: {0}")]
    Migration(#[from] rusqlite_migration::Error),
    #[error("File error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Data error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Backup error: {0}")]
    Backup(String),
    #[error("Windows error: {0}")]
    Windows(String),
    #[error("App error: {0}")]
    Tauri(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Locked => "locked",
            AppError::NotInitialized => "not_initialized",
            AppError::AlreadyInitialized => "already_initialized",
            AppError::WrongPassword { .. } => "wrong_password",
            AppError::Backoff { .. } => "backoff",
            AppError::NotFound => "not_found",
            AppError::DocumentLocked => "document_locked",
            AppError::Invalid(_) => "invalid",
            AppError::HelloUnavailable => "hello_unavailable",
            AppError::HelloCancelled => "hello_cancelled",
            AppError::Crypto => "crypto",
            AppError::Db(_) | AppError::Migration(_) => "db",
            AppError::Io(_) => "io",
            AppError::Json(_) => "data",
            AppError::Backup(_) => "backup",
            AppError::Windows(_) => "windows",
            AppError::Tauri(_) => "app",
        }
    }

    fn retry_after_ms(&self) -> Option<u64> {
        match self {
            AppError::WrongPassword { retry_after_ms } | AppError::Backoff { retry_after_ms } => {
                Some(*retry_after_ms)
            }
            _ => None,
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 3)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.serialize_field("retryAfterMs", &self.retry_after_ms())?;
        s.end()
    }
}

impl From<windows::core::Error> for AppError {
    fn from(e: windows::core::Error) -> Self {
        AppError::Windows(e.message().to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(e: tauri::Error) -> Self {
        AppError::Tauri(e.to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(e: zip::result::ZipError) -> Self {
        AppError::Backup(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
