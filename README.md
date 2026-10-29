# 0x-hub

A Windows desktop hub for important documents and notes — encrypted on your PC, in a dark,
monochrome liquid-glass interface.

- **Documents vault** — drag & drop or pick files; every file is encrypted (AES-256-GCM) before it
  is stored. Categories, tags, expiry dates with Windows reminders, PDF/image preview, OCR with the
  built-in Windows engine, full-text search, trash with 30-day purge.
- **Notes** — Markdown notes (TipTap), checklists, and sticky notes that pop out as small
  always-on-top windows. Link notes and documents both ways.
- **Overview** — greeting and clock, live stats, recent and pinned items, upcoming expiries.
- **System** — tray icon, global quick-note hotkey (default `Ctrl+Alt+Space`), start with Windows,
  encrypted `.0xbackup` export/restore and scheduled backups, `Ctrl+K` command palette.
- **Security** — master password (Argon2id) protecting a random data key; optional Windows Hello;
  auto-lock on inactivity and when Windows locks; printable recovery key. No password reset exists.
- **Private** — no telemetry, no cloud. The only network request is the update check against
  GitHub Releases.

Windows 10 (1809+) and Windows 11 only.

## Install

Download `0x-hub_x.y.z_x64-setup.exe` (or the `.msi`) from
[Releases](https://github.com/Kuba0734/0x-hub/releases). Until the installer is code-signed,
SmartScreen may warn: choose "More info" → "Run anyway". The app updates itself afterwards.

## Develop

Requirements: Node (LTS), pnpm, Rust (stable, MSVC), WebView2 (preinstalled on Windows 11).

```bash
pnpm install
pnpm tauri dev        # run the app
pnpm tauri build      # installers in src-tauri/target/release/bundle/
```

Checks (all must pass before a change is done):

```bash
pnpm typecheck && pnpm lint && pnpm test
cd src-tauri && cargo clippy -- -D warnings && cargo test
```

UI review without the Rust side: `pnpm dev`, then open
`http://localhost:1420/?mock=unlocked` (or `?mock=locked`, `?mock=onboarding`) — a dev-only fake
backend with sample data. `#/playground` shows every glass primitive and animation.

Data lives in `%APPDATA%\0x-hub\` (`hub.db` + `vault\*.bin`, all sensitive content encrypted).
Project conventions are in [CLAUDE.md](CLAUDE.md); releasing is in [RELEASING.md](RELEASING.md).

## Clean-VM install checklist

1. Fresh Windows 11 (and Windows 10 22H2) VM, no dev tools.
2. Run the setup `.exe` — it installs per-user without admin; WebView2 is bootstrapped if missing.
3. Start menu → 0x-hub: splash, then onboarding. Set a password, save the recovery key.
4. Drop a PDF and a phone photo of a document: both appear, OCR finishes, search finds words
   from the scan via `Ctrl+K`.
5. Set an expiry 3 days out → a Windows notification appears (also with the window closed to tray).
6. `Win+L` and back → the app is locked. Unlock with password and with Windows Hello.
7. Press the quick-note hotkey from another app → popup → `Ctrl+Enter` saves a sticky.
8. Settings → Backup → export; uninstall; reinstall; finish onboarding; restore → data is back.
9. Turn on "Start with Windows", reboot → app is in the tray, window hidden.
10. Install an older version, publish a newer release → update pill → "Install & restart".
11. Settings → Appearance → Reduce motion on: only fades remain, no refraction or blobs.
12. Uninstall: Apps → 0x-hub → Uninstall. (`%APPDATA%\0x-hub` is kept on purpose; delete it to
    wipe all data.)
