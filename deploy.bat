@echo off
rem ---------------------------------------------------------------------------
rem  deploy.bat - commit, tag and push a new 0x-hub release.
rem
rem    deploy.bat                         bump the patch version (0.1.0 -> 0.1.1)
rem    deploy.bat 1.2.0                   release exactly this version
rem    deploy.bat "Starry sky"            patch bump, with a message on top of the notes
rem    deploy.bat 1.2.0 "Starry sky"      this version, with a message
rem
rem  Release notes = your message (optional) + the feat/fix/perf commits since the
rem  previous tag (scripts\release-notes.mjs). They become the release commit's message
rem  and the tag annotation, and GitHub shows them on the release page and in the app's
rem  update dialog.
rem
rem  Set SKIP_CHECKS=1 to skip typecheck/lint/tests/clippy.
rem  Set DRY_RUN=1 to only print the version and release notes (changes nothing).
rem
rem  Pushing the v* tag starts .github/workflows/release.yml, which builds the
rem  NSIS + MSI installers, signs the updater artifacts and creates the GitHub
rem  release with latest.json.
rem ---------------------------------------------------------------------------
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

where git >nul 2>nul || (echo [deploy] git is not installed. & exit /b 1)
where node >nul 2>nul || (echo [deploy] node is not installed. & exit /b 1)
where pnpm >nul 2>nul || (echo [deploy] pnpm is not installed. & exit /b 1)

for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "CURRENT=%%v"

rem First argument: a version, or (when it isn't one) the message.
set "VERSION="
set "MESSAGE="
set "ARG1=%~1"
if defined ARG1 (
  rem version / bad (looks like a version but isn't x.y.z, e.g. "1.2") / message.
  rem No "!" in the script: delayed expansion would eat it.
  for /f "delims=" %%k in ('node -e "const v=process.argv[1];console.log(/^\d+\.\d+\.\d+$/.test(v)?'version':/^[\d.]+$/.test(v)?'bad':'message')" "%ARG1%"') do set "KIND=%%k"
)
if "%KIND%"=="bad" (
  echo [deploy] "%ARG1%" is not a valid x.y.z version.
  exit /b 1
)
if "%KIND%"=="version" (
  set "VERSION=%ARG1%"
  set "MESSAGE=%~2"
)
if "%KIND%"=="message" set "MESSAGE=%ARG1%"
if not defined VERSION (
  for /f "delims=" %%v in ('node -e "const [a,b,c]=process.argv[1].split('.').map(Number);console.log(a+'.'+b+'.'+(c+1))" "%CURRENT%"') do set "VERSION=%%v"
)

set "TAG=v%VERSION%"
git rev-parse -q --verify "refs/tags/%TAG%" >nul 2>nul && (
  echo [deploy] Tag %TAG% already exists.
  exit /b 1
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set "BRANCH=%%b"
echo.
echo [deploy] Releasing %CURRENT% -^> %VERSION% from branch %BRANCH%
echo.

set "NOTES=%TEMP%\0x-hub-release-notes.txt"

if "%DRY_RUN%"=="1" (
  echo [deploy] DRY_RUN: would commit and tag %TAG% with:
  echo.
  node scripts\release-notes.mjs "%VERSION%" "%NOTES%" "!MESSAGE!" || exit /b 1
  del "%NOTES%" >nul 2>nul
  exit /b 0
)

if not "%SKIP_CHECKS%"=="1" (
  echo [deploy] Running checks...
  call pnpm typecheck || goto :failed
  call pnpm lint || goto :failed
  call pnpm test || goto :failed
  pushd src-tauri
  cargo clippy -- -D warnings || (popd & goto :failed)
  cargo test || (popd & goto :failed)
  popd
)

rem Notes are written before the version bump, so they list only the real changes.
echo [deploy] Release notes:
echo.
node scripts\release-notes.mjs "%VERSION%" "%NOTES%" "!MESSAGE!" || goto :failed
echo.

echo [deploy] Bumping version...
call pnpm version:bump %VERSION% || goto :failed
rem Refresh Cargo.lock with the new package version.
cargo metadata --format-version 1 --manifest-path src-tauri\Cargo.toml >nul || goto :failed

echo [deploy] Committing...
git add -A || goto :failed
git commit -F "%NOTES%" || goto :failed
git tag -a "%TAG%" -F "%NOTES%" || goto :failed
del "%NOTES%" >nul 2>nul

echo [deploy] Pushing %BRANCH% and %TAG%...
git push origin "%BRANCH%" || goto :failed
git push origin "%TAG%" || goto :failed

for /f "delims=" %%u in ('git remote get-url origin') do set "REMOTE=%%u"
set "REMOTE=%REMOTE:.git=%"
echo.
echo [deploy] Done. GitHub Actions is now building %TAG%.
echo          Progress: %REMOTE%/actions
echo          Release:  %REMOTE%/releases/tag/%TAG%
exit /b 0

:failed
echo.
echo [deploy] Failed. Nothing was pushed unless the push step itself failed.
exit /b 1
