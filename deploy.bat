@echo off
rem ---------------------------------------------------------------------------
rem  deploy.bat - commit, tag and push a new 0x-hub release.
rem
rem    deploy.bat            bump the patch version (0.1.0 -> 0.1.1)
rem    deploy.bat 1.2.0      release exactly this version
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

set "VERSION=%~1"
if "%VERSION%"=="" (
  for /f "delims=" %%v in ('node -e "const [a,b,c]=process.argv[1].split('.').map(Number);console.log(a+'.'+b+'.'+(c+1))" "%CURRENT%"') do set "VERSION=%%v"
)

node -e "process.exit(/^\d+\.\d+\.\d+$/.test(process.argv[1])?0:1)" "%VERSION%" || (
  echo [deploy] "%VERSION%" is not a valid x.y.z version.
  exit /b 1
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

if "%DRY_RUN%"=="1" (
  echo [deploy] DRY_RUN: would tag %TAG% with these notes:
  set "PREV="
  for /f "delims=" %%t in ('git describe --tags --abbrev^=0 2^>nul') do set "PREV=%%t"
  if defined PREV (git log "!PREV!..HEAD" --no-merges --pretty=format:"- %%s") else (git log --no-merges --pretty=format:"- %%s")
  echo.
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

echo [deploy] Bumping version...
call pnpm version:bump %VERSION% || goto :failed
rem Refresh Cargo.lock with the new package version.
cargo metadata --format-version 1 --manifest-path src-tauri\Cargo.toml >nul || goto :failed

rem Release notes = commit subjects since the previous tag.
set "NOTES=%TEMP%\0x-hub-release-notes.txt"
set "PREV="
for /f "delims=" %%t in ('git describe --tags --abbrev^=0 2^>nul') do set "PREV=%%t"
> "%NOTES%" echo 0x-hub %VERSION%
>> "%NOTES%" echo.
if defined PREV (
  git log "%PREV%..HEAD" --no-merges --pretty=format:"- %%s" >> "%NOTES%"
) else (
  git log --no-merges --pretty=format:"- %%s" >> "%NOTES%"
)

echo [deploy] Committing...
git add -A || goto :failed
git commit -m "chore(release): %TAG%" || goto :failed
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
