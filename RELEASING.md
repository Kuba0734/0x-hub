# Releasing 0x-hub

Releases are built by GitHub Actions (`.github/workflows/release.yml`) when a `vX.Y.Z` tag is pushed.
The workflow builds the NSIS and MSI installers, signs the updater artifacts, creates the GitHub
release and uploads `latest.json`, which installed apps poll for updates.

## One-time setup

1. **Updater signing key.** The key pair lives outside the repo:
   - private key: `%USERPROFILE%\.tauri\0x-hub.key`
   - its password: `%USERPROFILE%\.tauri\0x-hub.key.password.txt`
   - public key: already in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`

   Never commit the private key. Back it up somewhere safe (password manager): if it is lost,
   installed apps can no longer verify updates and users must reinstall manually.

2. **GitHub secrets** (repo → Settings → Secrets and variables → Actions → New repository secret):
   - `TAURI_SIGNING_PRIVATE_KEY` — the full contents of `0x-hub.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the contents of `0x-hub.key.password.txt`

   Afterwards, move the password into your password manager and delete the `.txt` file.

3. **Workflow permissions:** repo → Settings → Actions → General → Workflow permissions →
   "Read and write permissions" (needed to create releases).

4. The repository must be **public** so installed apps can download
   `https://github.com/Kuba0734/0x-hub/releases/latest/download/latest.json`.

## Every release

The quick way:

```bat
deploy.bat                          :: bumps the patch version, e.g. 0.1.0 -> 0.1.1
deploy.bat 0.2.0                    :: or an explicit version
deploy.bat "Starry sky and scanner" :: patch bump with a message on top of the notes
deploy.bat 0.2.0 "Big update"       :: explicit version with a message
```

`deploy.bat` runs the checks, writes the release notes, bumps the version, commits everything
and pushes branch and tag. The notes are your optional message plus the `feat`/`fix`/`perf`
commits since the last tag, grouped under "New", "Fixes" and "Faster" (other types such as
`chore` or `refactor` are left out; see `scripts/release-notes.mjs`). They are used as the
release commit's message and the tag annotation, and the workflow publishes them as the
GitHub release body, which the in-app update dialog shows. `set DRY_RUN=1` first to preview
the version and notes without changing anything; `set SKIP_CHECKS=1` to skip the checks.

The same steps by hand:

1. Bump the version everywhere: `pnpm version:bump 0.2.0`
   (updates `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`).
2. Write the notes: `node scripts/release-notes.mjs 0.2.0 notes.txt "optional message"`
3. Commit and tag with them: `git commit -a -F notes.txt` and `git tag -a v0.2.0 -F notes.txt`
   (the first line, `v0.2.0`, is the subject; the release body starts after the blank line).
4. Push: `git push origin main` then `git push origin v0.2.0`
5. Verify:
   - Actions tab: the "Release" run is green.
   - Releases page: `0x-hub v0.2.0` has `0x-hub_0.2.0_x64-setup.exe`, the `.msi`,
     the `.sig` files and `latest.json`.
   - Open `https://github.com/Kuba0734/0x-hub/releases/latest/download/latest.json` — it shows
     the new version.
   - An installed older version shows the update pill within a few seconds of unlocking
     (or via Settings → Updates → Check for updates).

## Authenticode (optional, later)

Code signing the installer reduces SmartScreen warnings. When you have a certificate, follow the
comments on the disabled "Import Authenticode certificate" step in `release.yml`.
