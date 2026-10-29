//! Explorer integration (per user, no admin rights):
//! - "Send to → 0x-hub" shortcut in `%APPDATA%\Microsoft\Windows\SendTo`
//! - "Add to 0x-hub" context-menu verb for all files under `HKCU\Software\Classes\*\shell`
//!
//! Both start the app with `--import <files>`; a running instance receives them through
//! the single-instance plugin. The NSIS uninstaller removes both (windows/hooks.nsh).

use std::path::{Path, PathBuf};

use windows::core::{w, Interface, HSTRING, PCWSTR};
use windows::Win32::System::Com::{CoCreateInstance, IPersistFile, CLSCTX_INPROC_SERVER};
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegDeleteTreeW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
    KEY_WRITE, REG_OPTION_NON_VOLATILE, REG_SZ,
};
use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

use crate::error::{AppError, AppResult};

pub const IMPORT_ARG: &str = "--import";
const VERB_KEY: &str = r"Software\Classes\*\shell\0x-hub";
const VERB_LABEL: &str = "Add to 0x-hub";

fn sendto_shortcut() -> AppResult<PathBuf> {
    let appdata = std::env::var_os("APPDATA")
        .ok_or_else(|| AppError::Invalid("%APPDATA% is not set".into()))?;
    Ok(PathBuf::from(appdata).join(r"Microsoft\Windows\SendTo\0x-hub.lnk"))
}

fn set_string(subkey: &str, name: Option<&str>, value: &str) -> AppResult<()> {
    let mut hkey = HKEY::default();
    unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            &HSTRING::from(subkey),
            0,
            PCWSTR::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_WRITE,
            None,
            &mut hkey,
            None,
        )
        .ok()?;
        let data: Vec<u8> = value
            .encode_utf16()
            .chain(std::iter::once(0))
            .flat_map(|c| c.to_le_bytes())
            .collect();
        let name = name.map(HSTRING::from).unwrap_or_default();
        let result = RegSetValueExW(hkey, &name, 0, REG_SZ, Some(&data)).ok();
        let _ = RegCloseKey(hkey);
        result?;
    }
    Ok(())
}

fn create_shortcut(exe: &Path, target: &Path) -> AppResult<()> {
    unsafe {
        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
        link.SetPath(&HSTRING::from(exe.as_os_str()))?;
        link.SetArguments(&HSTRING::from(IMPORT_ARG))?;
        link.SetDescription(w!("Add to 0x-hub"))?;
        link.SetIconLocation(&HSTRING::from(exe.as_os_str()), 0)?;
        let file: IPersistFile = link.cast()?;
        file.Save(&HSTRING::from(target.as_os_str()), true)?;
    }
    Ok(())
}

/// Installs (or refreshes, e.g. after the app moved) both entry points.
pub fn enable() -> AppResult<()> {
    let exe = std::env::current_exe()?;
    let shortcut = sendto_shortcut()?;
    if let Some(dir) = shortcut.parent() {
        std::fs::create_dir_all(dir)?;
    }
    create_shortcut(&exe, &shortcut)?;
    let exe_str = exe.display().to_string();
    set_string(VERB_KEY, None, VERB_LABEL)?;
    set_string(VERB_KEY, Some("Icon"), &format!("\"{exe_str}\",0"))?;
    set_string(
        &format!(r"{VERB_KEY}\command"),
        None,
        &format!("\"{exe_str}\" {IMPORT_ARG} \"%1\""),
    )
}

pub fn disable() -> AppResult<()> {
    let shortcut = sendto_shortcut()?;
    if shortcut.exists() {
        std::fs::remove_file(shortcut)?;
    }
    // A missing key is fine.
    let _ = unsafe { RegDeleteTreeW(HKEY_CURRENT_USER, &HSTRING::from(VERB_KEY)) };
    Ok(())
}

/// Files passed on the command line after `--import`. `args[0]` is the executable.
pub fn paths_from_args(args: &[String]) -> Vec<String> {
    if !args.iter().any(|a| a == IMPORT_ARG) {
        return vec![];
    }
    args.iter()
        .skip(1)
        .filter(|a| !a.starts_with("--"))
        .filter(|a| Path::new(a).is_file())
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn collects_existing_files_after_import_flag() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("a.pdf");
        std::fs::write(&a, b"x").unwrap();
        let a = a.to_string_lossy().into_owned();
        let missing = dir
            .path()
            .join("missing.pdf")
            .to_string_lossy()
            .into_owned();
        let folder = dir.path().to_string_lossy().into_owned();
        let args = vec![
            "app.exe".into(),
            IMPORT_ARG.into(),
            a.clone(),
            missing,
            folder,
        ];
        assert_eq!(paths_from_args(&args), vec![a.clone()]);
        assert!(paths_from_args(&["app.exe".into(), a]).is_empty());
    }
}
