//! Encrypted file storage: `%APPDATA%\0x-hub\vault\<uuid>.bin`.

pub mod import;

use std::path::{Path, PathBuf};

use windows::core::{HSTRING, PCWSTR};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

use crate::crypto::{self, SecretKey};
use crate::db::documents::file_aad;
use crate::error::{AppError, AppResult};
use crate::paths::Paths;

/// Files above this size are rejected; they are encrypted in one piece in memory.
pub const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;

pub fn store(paths: &Paths, key: &SecretKey, id: &str, plaintext: &[u8]) -> AppResult<()> {
    let sealed = crypto::encrypt(key, plaintext, &file_aad(id))?;
    let target = paths.vault_file(id);
    let tmp = target.with_extension("bin.tmp");
    std::fs::write(&tmp, sealed)?;
    std::fs::rename(&tmp, &target)?;
    Ok(())
}

pub fn read(paths: &Paths, key: &SecretKey, id: &str) -> AppResult<Vec<u8>> {
    let sealed = std::fs::read(paths.vault_file(id)).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => AppError::NotFound,
        _ => AppError::Io(e),
    })?;
    crypto::decrypt(key, &sealed, &file_aad(id))
}

pub fn remove(paths: &Paths, id: &str) -> AppResult<()> {
    match std::fs::remove_file(paths.vault_file(id)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

/// Strips characters Windows does not allow in file names.
pub fn safe_filename(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if "<>:\"/\\|?*".contains(c) || c.is_control() {
                '_'
            } else {
                c
            }
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.').to_string();
    if trimmed.is_empty() {
        "document".into()
    } else {
        trimmed
    }
}

/// `dir/filename`, or `dir/stem (2).ext`, `(3)`, ... if that name is taken.
pub fn unique_path(dir: &Path, filename: &str) -> PathBuf {
    let name = safe_filename(filename);
    let first = dir.join(&name);
    if !first.exists() {
        return first;
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (name.clone(), String::new()),
    };
    (2..)
        .map(|n| dir.join(format!("{stem} ({n}){ext}")))
        .find(|p| !p.exists())
        .unwrap_or(first)
}

pub fn export_to(paths: &Paths, key: &SecretKey, id: &str, target: &Path) -> AppResult<()> {
    let data = read(paths, key, id)?;
    std::fs::write(target, data)?;
    Ok(())
}

/// Writes a decrypted copy into a private temp folder and opens it with the default app.
/// The folder is wiped on lock, on quit and on the next start.
pub fn open_externally(
    paths: &Paths,
    key: &SecretKey,
    id: &str,
    filename: &str,
) -> AppResult<PathBuf> {
    let dir = paths.open_temp.join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&dir)?;
    let file = dir.join(safe_filename(filename));
    std::fs::write(&file, read(paths, key, id)?)?;
    shell_open(&file)?;
    Ok(file)
}

pub fn shell_open(path: &Path) -> AppResult<()> {
    let target = HSTRING::from(path.as_os_str());
    let result = unsafe {
        ShellExecuteW(
            None,
            &HSTRING::from("open"),
            &target,
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    // ShellExecute returns a value > 32 on success.
    if result.0 as isize <= 32 {
        return Err(AppError::Windows(
            "No app is registered to open this file type".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_read_remove() {
        let dir = tempfile::tempdir().unwrap();
        let paths = Paths::at(dir.path().join("d"), dir.path().join("o"));
        paths.ensure().unwrap();
        let key = SecretKey::generate();
        store(&paths, &key, "abc", b"%PDF-1.7 hello").unwrap();
        let on_disk = std::fs::read(paths.vault_file("abc")).unwrap();
        assert!(!on_disk.windows(5).any(|w| w == b"hello"));
        assert_eq!(read(&paths, &key, "abc").unwrap(), b"%PDF-1.7 hello");
        // Files are bound to their id: a renamed blob does not decrypt.
        std::fs::copy(paths.vault_file("abc"), paths.vault_file("xyz")).unwrap();
        assert!(read(&paths, &key, "xyz").is_err());
        remove(&paths, "abc").unwrap();
        remove(&paths, "abc").unwrap();
        assert!(matches!(read(&paths, &key, "abc"), Err(AppError::NotFound)));
    }

    #[test]
    fn unique_paths_do_not_collide() {
        let dir = tempfile::tempdir().unwrap();
        let a = unique_path(dir.path(), "scan.pdf");
        std::fs::write(&a, b"1").unwrap();
        let b = unique_path(dir.path(), "scan.pdf");
        assert_eq!(b.file_name().unwrap(), "scan (2).pdf");
        std::fs::write(&b, b"2").unwrap();
        assert_eq!(
            unique_path(dir.path(), "scan.pdf").file_name().unwrap(),
            "scan (3).pdf"
        );
    }

    #[test]
    fn filenames_are_sanitized() {
        assert_eq!(safe_filename("a<b>:c.pdf"), "a_b__c.pdf");
        assert_eq!(safe_filename("  ...  "), "document");
    }
}
