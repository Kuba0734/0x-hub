use std::path::PathBuf;

use crate::error::{AppError, AppResult};

/// Filesystem locations. Everything lives under `%APPDATA%\0x-hub\`.
#[derive(Debug, Clone)]
pub struct Paths {
    pub root: PathBuf,
    pub db: PathBuf,
    pub vault: PathBuf,
    /// Short-lived decrypted copies for "Open externally". Wiped on lock, quit and startup.
    pub open_temp: PathBuf,
}

impl Paths {
    pub fn resolve() -> AppResult<Self> {
        let appdata = std::env::var_os("APPDATA")
            .map(PathBuf::from)
            .ok_or_else(|| AppError::Invalid("%APPDATA% is not set".into()))?;
        Ok(Self::at(
            appdata.join("0x-hub"),
            std::env::temp_dir().join("0x-hub-open"),
        ))
    }

    pub fn at(root: PathBuf, open_temp: PathBuf) -> Self {
        Paths {
            db: root.join("hub.db"),
            vault: root.join("vault"),
            root,
            open_temp,
        }
    }

    pub fn ensure(&self) -> AppResult<()> {
        std::fs::create_dir_all(&self.root)?;
        std::fs::create_dir_all(&self.vault)?;
        Ok(())
    }

    pub fn vault_file(&self, id: &str) -> PathBuf {
        self.vault.join(format!("{id}.bin"))
    }

    /// Best-effort removal of decrypted temp copies. Files still open in another app are skipped.
    pub fn wipe_open_temp(&self) {
        if self.open_temp.exists() {
            let _ = std::fs::remove_dir_all(&self.open_temp);
        }
    }
}
