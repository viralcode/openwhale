@echo off
setlocal enabledelayedexpansion

:: ══════════════════════════════════════════════════════════════════════════════
::  OpenWhale Windows Installer (Batch)
::  Usage: Double-click this file, or run from Command Prompt
::  For best results, run as Administrator
:: ══════════════════════════════════════════════════════════════════════════════

title OpenWhale Installer

echo.
echo   ================================================================
echo   =                                                              =
echo   =           OpenWhale Windows Installer                        =
echo   =                                                              =
echo   ================================================================
echo.

:: Default install directory
set "INSTALL_DIR=%USERPROFILE%\openwhale"
echo   Install location: %INSTALL_DIR%
echo.

:: ── Step 1: Check Git ────────────────────────────────────────────────────────

echo   [1/7] Checking Git...
git --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=3" %%v in ('git --version') do echo          Found: Git %%v
) else (
    echo          Git not found. Installing via winget...
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo          ERROR: Could not install Git.
        echo          Please install manually from https://git-scm.com/download/win
        pause
        exit /b 1
    )
    :: Refresh PATH
    call refreshenv >nul 2>&1
    set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    echo          Git installed!
)

:: ── Step 2: Check Node.js ────────────────────────────────────────────────────

echo.
echo   [2/7] Checking Node.js...
node -v >nul 2>&1
if %errorlevel% equ 0 (
    for /f %%v in ('node -v') do echo          Found: Node.js %%v
) else (
    echo          Node.js not found. Installing via winget...
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo          ERROR: Could not install Node.js.
        echo          Please install manually from https://nodejs.org/
        pause
        exit /b 1
    )
    call refreshenv >nul 2>&1
    echo          Node.js installed!
)

:: ── Step 3: Check pnpm ──────────────────────────────────────────────────────

echo.
echo   [3/7] Checking pnpm...
pnpm -v >nul 2>&1
if %errorlevel% equ 0 (
    for /f %%v in ('pnpm -v') do echo          Found: pnpm %%v
) else (
    echo          Installing pnpm...
    call npm install -g pnpm
    echo          pnpm installed!
)

:: ── Step 4: Clone Repository ─────────────────────────────────────────────────

echo.
echo   [4/7] Cloning OpenWhale repository...
echo          Target: %INSTALL_DIR%

if exist "%INSTALL_DIR%\.git" (
    echo          Repository already exists. Pulling latest...
    pushd "%INSTALL_DIR%"
    git pull origin main
    popd
    echo          Updated!
) else (
    git clone https://github.com/viralcode/openwhale.git "%INSTALL_DIR%"
    if %errorlevel% neq 0 (
        echo          ERROR: Clone failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo          Cloned successfully!
)

:: ── Step 5: Install Dependencies ─────────────────────────────────────────────

echo.
echo   [5/7] Installing dependencies (this may take a few minutes)...
pushd "%INSTALL_DIR%"
call pnpm install
if %errorlevel% neq 0 (
    echo          pnpm install had issues, trying npm fallback...
    call npm install
)

:: ── Step 6: Build Native Modules ─────────────────────────────────────────────

echo.
echo   [6/7] Building native modules...
echo          Select all packages when prompted.
call pnpm approve-builds

:: ── Step 7: Setup Environment ────────────────────────────────────────────────

echo.
echo   [7/7] Setting up environment...
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo          Created .env from template.
        echo          Edit .env to add your AI API keys.
    ) else (
        echo          No .env.example found. Create .env manually.
    )
) else (
    echo          .env already exists, skipping.
)

popd

:: ── Done ─────────────────────────────────────────────────────────────────────

echo.
echo   ================================================================
echo   =                                                              =
echo   =        OpenWhale installed successfully!                     =
echo   =                                                              =
echo   ================================================================
echo.
echo   Location:  %INSTALL_DIR%
echo   Dashboard: http://localhost:7777/dashboard
echo.
echo   Next steps:
echo     1. cd %INSTALL_DIR%
echo     2. Edit .env and add your AI API keys
echo     3. pnpm run dev
echo     4. Open http://localhost:7777/dashboard
echo     5. Login with admin / admin
echo.

set /p START_NOW="  Start OpenWhale now? (Y/n): "
if /i "%START_NOW%" neq "n" (
    echo.
    echo   Starting OpenWhale...
    echo   Press Ctrl+C to stop the server.
    echo.
    pushd "%INSTALL_DIR%"
    call pnpm run dev
    popd
)

pause
