# CLAUDE.md — 0x-hub

This file gives Claude Code the context it needs to work on this repository. Read it fully before making changes.

## Project overview

**0x-hub** is a Windows-only desktop hub app for storing important documents, writing different kinds of notes, and seeing everything at a glance on an overview dashboard. It is distributed as a Windows installer (NSIS `.exe` setup, optionally `.msi`) and updates itself automatically via **GitHub Releases**.

- Platform: **Windows 10 (1809+) and Windows 11 only**. Do not add macOS/Linux code paths, configs, or CI jobs.
- UI language: **English** only. All user-facing strings live in `src/lib/strings.ts` (single source, no hardcoded UI text in components).
- Data: **100% local**. No telemetry, no cloud sync, no network calls except the update check against GitHub Releases — and the user-started phone upload on the local Wi-Fi (see "Phone upload" under Security).

## Tech stack

| Layer | Choice |
|---|---|
| Shell | **Tauri 2** (Rust backend, WebView2 frontend) |
| Frontend | **React 19 + TypeScript (strict) + Vite** |
| Styling | **Tailwind CSS v4** + CSS variables for design tokens |
| Animation | **Motion** (`motion/react`, formerly Framer Motion) |
| State | **Zustand** (UI/app state), **TanStack Query** (data from Tauri commands) |
| Routing | **TanStack Router** or React Router (pick one, keep it) |
| Editor | **TipTap** (Markdown-capable rich text, task lists) |
| Command palette | **cmdk** |
| Icons | **lucide-react** |
| PDF preview | **pdf.js** (`pdfjs-dist`) |
| Database | **SQLite** via `rusqlite` (bundled) in the Rust backend, migrations with `rusqlite_migration` |
| Crypto | `aes-gcm` (AES-256-GCM), `argon2` (Argon2id), `zeroize`, `rand` |
| Search | SQLite **FTS5** |
| OCR | Windows built-in OCR (`Windows.Media.Ocr`) via the `windows` crate |
| Windows Hello | `Windows.Security.Credentials.UI.UserConsentVerifier` via the `windows` crate |
| Window effects | `window-vibrancy` (Mica/Acrylic) + transparent, frameless window |
| Tauri plugins | `updater`, `process`, `notification`, `global-shortcut`, `autostart`, `dialog`, `fs`, `single-instance`, `window-state` |
| Phone upload | `tiny_http` (LAN-only server while the dialog is open), `qrcode` (SVG) |

Do not introduce other UI frameworks, CSS-in-JS libraries, or a second animation library.

## Commands

```bash
pnpm install              # install deps
pnpm tauri dev            # run app in dev mode
pnpm tauri build          # build release installer (NSIS + MSI) into src-tauri/target/release/bundle/
pnpm lint                 # eslint
pnpm typecheck            # tsc --noEmit
pnpm test                 # vitest (frontend)
cd src-tauri && cargo test   # Rust tests
cd src-tauri && cargo clippy -- -D warnings
```

Before saying a task is done: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `cargo clippy`, and `cargo test` must all pass.

## Repository layout

```
0x-hub/
├─ src/                         # React frontend
│  ├─ app/                      # App shell, router, providers
│  ├─ components/
│  │  ├─ glass/                 # Liquid-glass primitives (GlassPanel, GlassButton, GlassInput, ...)
│  │  ├─ motion/                # Reusable motion wrappers (PageTransition, StaggerList, AnimatedNumber)
│  │  └─ ui/                    # Generic UI (Dialog, Tooltip, Toast, ContextMenu, ...)
│  ├─ features/
│  │  ├─ overview/              # Dashboard
│  │  ├─ documents/             # Vault: upload, preview, tags, expiry, OCR
│  │  ├─ notes/                 # Markdown notes, checklists, sticky notes
│  │  ├─ search/                # Command palette + global search
│  │  ├─ settings/              # Security, backup, appearance, updates, about
│  │  └─ lock/                  # Lock screen / unlock flow
│  ├─ lib/
│  │  ├─ ipc.ts                 # Typed wrappers around Tauri invoke() — the ONLY place invoke() is called
│  │  ├─ strings.ts             # All UI strings
│  │  └─ tokens.ts              # Design tokens mirrored from CSS
│  ├─ stores/                   # Zustand stores
│  └─ styles/
│     ├─ globals.css            # Tailwind + tokens
│     └─ glass.css              # Liquid-glass effects, SVG filter hookups
├─ src-tauri/
│  ├─ src/
│  │  ├─ main.rs / lib.rs       # Tauri builder, plugin registration
│  │  ├─ commands/              # #[tauri::command] handlers, one file per feature
│  │  ├─ db/                    # Connection, migrations, repositories
│  │  ├─ crypto/                # Key derivation, encrypt/decrypt, key wrapping
│  │  ├─ vault/                 # Encrypted file storage on disk
│  │  ├─ ocr/                   # Windows OCR integration
│  │  ├─ hello/                 # Windows Hello integration
│  │  ├─ reminders/             # Expiry scheduler + notifications
│  │  ├─ backup/                # Export/import ZIP
│  │  ├─ tray.rs                # Tray icon + menu
│  │  └─ error.rs               # AppError (thiserror), serialized to frontend
│  ├─ capabilities/             # Tauri 2 permission capabilities
│  ├─ icons/
│  └─ tauri.conf.json
├─ .github/workflows/release.yml
└─ CLAUDE.md
```

## Design system — "Liquid Glass, monochrome"

The look is **dark, monochrome liquid glass**: black, white and greys only. **No colored accents anywhere**, except semantic states (see below), and even those are desaturated.

### Color tokens (CSS variables in `globals.css`)

```css
--bg-0: #000000;          /* app background */
--bg-1: #0A0A0A;          /* base surface */
--bg-2: #141414;          /* raised surface */
--glass-fill: rgba(255,255,255,0.04);
--glass-fill-hover: rgba(255,255,255,0.07);
--glass-stroke: rgba(255,255,255,0.10);
--glass-highlight: rgba(255,255,255,0.22);   /* top-edge specular */
--text-1: #FFFFFF;        /* primary */
--text-2: #A1A1A1;        /* secondary */
--text-3: #5C5C5C;        /* muted / disabled */
--line: rgba(255,255,255,0.06);
--focus-ring: rgba(255,255,255,0.55);
/* semantic, desaturated */
--danger: #D4D4D4; --danger-bg: rgba(255,255,255,0.08);   /* communicate via icon + text, not color */
```

Expiry/urgency is communicated with **brightness, weight, icons and motion** (e.g. a soft white pulse), never with red/green/yellow.

### Liquid glass rules

Every surface (sidebar, cards, dialogs, palette, title bar, toasts) is built from `components/glass/` primitives. Never hand-roll glass styles in feature code.

A liquid-glass surface consists of:
1. **Backdrop blur + saturation:** `backdrop-filter: blur(24px) saturate(140%)`.
2. **Refraction:** an inline SVG filter (`feTurbulence` + `feDisplacementMap`, low scale) applied to the backdrop layer for the "liquid" distortion at edges. WebView2 is Chromium, so `backdrop-filter: url(#liquid)` is allowed. Keep displacement subtle (scale 8–20).
3. **Specular highlight:** a 1px top inner highlight (`--glass-highlight`) plus a soft radial highlight that **follows the cursor** on hover (CSS variables `--mx/--my` updated on pointermove, throttled with rAF).
4. **Edge:** 1px `--glass-stroke` border, large radius (`16px` cards, `24px` panels, `999px` pills).
5. **Depth:** layered shadows, black only: `0 1px 0 rgba(255,255,255,0.05) inset, 0 20px 50px rgba(0,0,0,0.6)`.

Behind the content, the window uses **Mica** (Win 11) or **Acrylic** fallback (Win 10) via `window-vibrancy`, plus a very slow-moving, low-contrast grey **ambient gradient blob layer** so the glass has something to refract. It must stay GPU-cheap (transform/opacity only).

### Typography
- Font: **Geist** (fallback Inter, Segoe UI Variable). Mono: **Geist Mono**.
- Sizes: 12 / 13 / 14 (body) / 16 / 20 / 28 / 40 (hero numbers).
- Headings: weight 600, letter-spacing -0.02em. Body: 400.

### Motion rules
Animations are a core feature, not decoration — but they must feel **fast and physical**.

- Use **spring** transitions by default: `{ type: "spring", stiffness: 380, damping: 32 }`. Shared presets live in `components/motion/presets.ts`. Do not invent ad-hoc timings in feature code.
- Durations for tween fallbacks: 120ms (micro), 220ms (standard), 420ms (page/hero). Never above 600ms for anything blocking interaction.
- **Only animate `transform`, `opacity` and `filter`.** Never animate width/height/top/left; use `layout` animations from Motion instead.
- Required animated moments:
  - Splash screen on launch (logo morph `0x` → wordmark, then dissolve into the app)
  - Page transitions (slide + fade + slight blur, direction-aware)
  - Sidebar collapse/expand with `layout` and a moving active-indicator (`layoutId`)
  - Staggered list/grid entrance (30–40ms stagger)
  - Card hover: lift (−2px), cursor-follow specular, slight scale (1.01)
  - Drag & drop: drop zone "liquid" ripple + glow on enter, files fly into the grid on drop
  - Command palette: scale-in from 0.96 + blur-out backdrop
  - Animated numbers on the overview (count-up)
  - Checkbox/task completion micro-animation (stroke draw)
  - Toasts: spring in from bottom-right, swipe to dismiss
  - Lock/unlock: glass "frost" over the app, clears on unlock
  - Update available: subtle pill in the title bar, expands into an update dialog with a progress bar
- **Respect "Reduce motion"**: a settings toggle that defaults to the Windows setting (`prefers-reduced-motion`). When on, replace movement with plain opacity fades and disable the displacement filter and ambient blobs.
- Target 60 fps on an integrated GPU. If an effect drops frames, simplify it.

### Window chrome
- `decorations: false`, `transparent: true`, custom title bar with drag region (`data-tauri-drag-region`), custom minimize/maximize/close buttons in glass style, Windows snap layouts must keep working.
- Remember window size/position (`window-state` plugin). Minimum size 1024×680.

## Features (scope)

### Overview (dashboard)
Greeting with time of day + date, live clock; stats cards (documents, notes, storage used, items expiring soon) with count-up; recently edited; pinned items; upcoming reminders/expiries timeline; quick actions (new note, upload document, quick sticky).

### Documents (vault)
- Drag & drop + file picker upload; supported: PDF, PNG/JPG/WEBP, DOCX/XLSX/PPTX, TXT, any other file as "generic".
- Preview: PDF (pdf.js), images (zoom/pan), Office files show metadata + "Open externally".
- Categories (defaults: IDs, Contracts, Insurance, Taxes, Medical, Finance, Other — user-editable) and free tags.
- **Expiry date** per document with reminder offsets (e.g. 90/30/7/1 days) → Windows toast notifications, also when the app is in the tray.
- **Encryption at rest**: every stored file and sensitive DB field is encrypted (see Security).
- **Full-text search** across title, tags, notes and OCR text (FTS5).
- **OCR** for images and scanned PDFs using Windows OCR, run in a background task with progress; result stored encrypted and indexed.
- Actions: rename, recategorize, retag, link to notes, pin, export (decrypted copy to a chosen folder), delete (moves to Trash, purged after 30 days).

### Notes
Three types, all in one list with filters:
- **Markdown notes** (TipTap, Markdown shortcuts, code blocks, headings, links)
- **Checklists** (tasks with completion animation, progress bar)
- **Sticky notes** (small, grey-shade variants, can be popped out as small always-on-top glass windows)

Shared: pin, grey "shade" label instead of color (5 greyscale tones), link to documents, autosave (debounced 500ms), trash.

### Search & command palette
`Ctrl+K` opens cmdk palette: search everything, jump to pages, run actions (new note, upload, lock, backup, check updates).

### System
- **Tray icon** with menu: Open, Quick note, Lock, Check for updates, Quit. Closing the window minimizes to tray (configurable).
- **Global hotkey** (default `Ctrl+Alt+Space`, configurable) opens a quick-note popup.
- **Autostart** with Windows (opt-in), starts minimized to tray.
- **Single instance**: a second launch focuses the existing window.
- **Backup & restore**: export the whole vault (still encrypted) + DB as a `.0xbackup` ZIP; import with password check. Optional scheduled auto-backup to a chosen folder.
- **Auto-update** via GitHub Releases (see below).

## Security

- **Master password** set on first run (onboarding flow). Key derivation: **Argon2id** (m=64 MiB, t=3, p=1, 16-byte random salt) → Key Encryption Key (KEK).
- A random 256-bit **Data Encryption Key (DEK)** encrypts all data with **AES-256-GCM** (unique 96-bit nonce per encryption). The DEK is stored wrapped by the KEK. Changing the password only re-wraps the DEK.
- **Windows Hello** (optional): after a successful password unlock, the DEK can additionally be protected with DPAPI (`CryptProtectData`, current user) and released only after a `UserConsentVerifier` check. Password always remains a fallback.
- The DEK lives only in Rust memory, wrapped in `zeroize`-on-drop types. **Never send keys or plaintext secrets to the frontend.** The frontend only receives decrypted content it explicitly requests for display.
- **Auto-lock** after configurable inactivity (default 10 min) and on Windows session lock.
- Files live in `%APPDATA%\0x-hub\vault\` as `<uuid>.bin` (encrypted). Original filenames are stored encrypted in the DB.
- Wrong password: exponential backoff on retries. No password recovery — make this very clear in onboarding and offer a recovery-key export (printable).
- Tauri capabilities: grant the minimum permissions per window. No `shell:allow-execute`. File system access only through Rust commands, not the `fs` plugin from the frontend, except for dialogs.

### Phone upload (the only inbound network feature)
- Started only by the user ("From phone" on Documents); the server runs while that dialog is open.
- Binds to the PC's private LAN IPv4 address only (never 0.0.0.0), on a random port.
- Every URL contains a random 128-bit token; anything else gets 404. Two routes: the upload page and `POST upload`.
- Stops after 10 minutes, when the dialog closes, or when the vault locks. Files are encrypted into the vault straight from memory.
- Plain HTTP inside the LAN (iOS rejects self-signed certificates); the dialog says to use it on trusted Wi-Fi only.
- Do not add further network features without the user explicitly asking.

### Per-item lock
- Documents and notes can be locked: content, OCR text, notes/body, export and "open externally" are only served after re-confirming with the master password or Windows Hello. Access lasts only while the item is open: closing its view locks it again (`item_conceal`), and so does locking the vault (`AppState::reveal`).
- Locked items keep only title/filename/tags in the search index.

## Auto-update via GitHub Releases

- Use `tauri-plugin-updater` + `tauri-plugin-process` (relaunch).
- Endpoint in `tauri.conf.json`:
  `https://github.com/<OWNER>/0x-hub/releases/latest/download/latest.json`
- Updates are signed with a Tauri updater key (`pnpm tauri signer generate`). The **public key** goes into `tauri.conf.json` (`plugins.updater.pubkey`); the **private key** and its password are GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Never commit the private key.
- Windows install mode: `passive`.
- App behavior: check on startup (after unlock, delayed ~5s) and every 6 hours; show a title-bar pill → update dialog with release notes (from the release body), download progress, "Install & restart". Also a manual "Check for updates" in Settings and tray. Optional "skip this version".
- `.github/workflows/release.yml`: triggered on tags `v*.*.*`, runs on `windows-latest`, uses `tauri-apps/tauri-action` to build NSIS (+ MSI), sign update artifacts, create the GitHub release and upload `latest.json`.
- Versioning: SemVer. Version must be identical in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json` — a script `pnpm version:bump <x.y.z>` updates all three.
- Optional later: Authenticode code signing of the installer to reduce SmartScreen warnings (secrets `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`). Leave hooks in the workflow but keep it disabled until a certificate exists.

## Coding conventions

### General
- Small, focused files. Components > 200 lines get split.
- No `any` in TypeScript. No `unwrap()`/`expect()` in Rust outside tests and startup — use `AppError`.
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:` ...).

### Frontend
- Function components + hooks only. Feature code imports glass and motion primitives; it does not write raw `backdrop-filter` or spring configs.
- All IPC goes through `src/lib/ipc.ts` with typed request/response types that mirror Rust structs (keep them in sync; consider `specta`/`tauri-specta` for generation).
- Every interactive element is keyboard reachable, has a visible white focus ring, and an `aria-label` where there is no text.
- Contrast: text on glass must meet WCAG AA. If a glass surface is too transparent for readable text, increase fill opacity, don't lower text contrast.

### Rust
- Commands are thin: validate input → call service in `db/`, `vault/`, `crypto/` → map errors.
- Long work (OCR, encryption of large files, backup) runs in `tauri::async_runtime::spawn_blocking` and reports progress via events (`app.emit("progress://<task>", ...)`).
- DB access through repository functions; all schema changes via numbered migrations. Never edit an old migration.
- Unit tests for crypto round-trips, key wrapping, migrations, and backup import/export.

## Things to avoid
- Colored accents, emojis in the UI, or stock illustrations — the identity is strict monochrome glass.
- Heavy effects that hurt performance (stacked blurs > 2 levels deep, animating blur radius on large areas, displacement filters on scrolling lists).
- Storing anything unencrypted on disk (including thumbnails and OCR text) — thumbnails are generated in memory or cached encrypted.
- Any network access other than the GitHub update endpoint and the phone-upload server described under Security.
- Adding non-Windows targets.