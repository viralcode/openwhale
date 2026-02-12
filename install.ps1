<#
.SYNOPSIS
    OpenWhale Windows Installer
.DESCRIPTION
    Automated setup script for OpenWhale on Windows.
    Clones the repository, checks/installs prerequisites, installs dependencies, and starts the server.
.NOTES
    Run this script in PowerShell as Administrator for best results.
    Usage: Right-click > Run with PowerShell, or: powershell -ExecutionPolicy Bypass -File install.ps1
#>

param(
    [string]$InstallDir = "$env:USERPROFILE\openwhale",
    [switch]$SkipStart
)

$ErrorActionPreference = "Stop"

# ── Colors & Helpers ──────────────────────────────────────────────────────────

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║                                                      ║" -ForegroundColor Cyan
    Write-Host "  ║          🐋  OpenWhale Windows Installer  🐋         ║" -ForegroundColor Cyan
    Write-Host "  ║                                                      ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "  ▶ $Message" -ForegroundColor Yellow
    Write-Host "  $('─' * 56)" -ForegroundColor DarkGray
}

function Write-Success {
    param([string]$Message)
    Write-Host "    ✅ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "    ℹ️  $Message" -ForegroundColor DarkCyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "    ⚠️  $Message" -ForegroundColor DarkYellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "    ❌ $Message" -ForegroundColor Red
}

function Test-CommandExists {
    param([string]$Command)
    $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Banner

$resolvedDir = [System.IO.Path]::GetFullPath($InstallDir)
Write-Host "  📁 Install location: " -NoNewline -ForegroundColor White
Write-Host "$resolvedDir" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Check Git ─────────────────────────────────────────────────────────

Write-Step "Checking Git..."

if (Test-CommandExists "git") {
    $gitVersion = (git --version) -replace "git version ", ""
    Write-Success "Git found: v$gitVersion"
} else {
    Write-Warn "Git not found. Attempting install via winget..."
    if (Test-CommandExists "winget") {
        winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        if (Test-CommandExists "git") {
            Write-Success "Git installed successfully!"
        } else {
            Write-Fail "Git installation failed. Please install manually from https://git-scm.com/download/win"
            Write-Host "    Then re-run this script." -ForegroundColor Gray
            exit 1
        }
    } else {
        Write-Fail "Git is not installed and winget is not available."
        Write-Host "    Please install Git from: https://git-scm.com/download/win" -ForegroundColor Gray
        exit 1
    }
}

# ── Step 2: Check Node.js ─────────────────────────────────────────────────────

Write-Step "Checking Node.js..."

if (Test-CommandExists "node") {
    $nodeVersion = (node -v).TrimStart("v")
    $nodeMajor = [int]($nodeVersion.Split(".")[0])
    if ($nodeMajor -ge 22) {
        Write-Success "Node.js found: v$nodeVersion"
    } else {
        Write-Warn "Node.js v$nodeVersion found, but v22+ is required."
        Write-Info "Attempting upgrade via winget..."
        if (Test-CommandExists "winget") {
            winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        } else {
            Write-Fail "Please upgrade Node.js manually from https://nodejs.org/"
            exit 1
        }
    }
} else {
    Write-Warn "Node.js not found. Attempting install via winget..."
    if (Test-CommandExists "winget") {
        winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        if (Test-CommandExists "node") {
            Write-Success "Node.js installed successfully!"
        } else {
            Write-Fail "Node.js installation failed. Please install manually from https://nodejs.org/"
            exit 1
        }
    } else {
        Write-Fail "Node.js is not installed and winget is not available."
        Write-Host "    Please install Node.js 22+ from: https://nodejs.org/" -ForegroundColor Gray
        exit 1
    }
}

# ── Step 3: Check/Install pnpm ────────────────────────────────────────────────

Write-Step "Checking pnpm..."

if (Test-CommandExists "pnpm") {
    $pnpmVersion = (pnpm -v)
    Write-Success "pnpm found: v$pnpmVersion"
} else {
    Write-Info "Installing pnpm..."
    # Try corepack first (built into Node 22+, avoids execution policy issues)
    try {
        corepack enable 2>$null
        corepack prepare pnpm@latest --activate 2>$null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    } catch {}

    if (-not (Test-CommandExists "pnpm")) {
        Write-Info "Corepack method unavailable, trying npm install..."
        # Temporarily bypass execution policy for this process
        try { Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force } catch {}
        npm install -g pnpm
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    }

    if (Test-CommandExists "pnpm") {
        Write-Success "pnpm installed successfully!"
    } else {
        Write-Fail "pnpm installation failed."
        Write-Host "    Fix: Run this command first, then re-run the installer:" -ForegroundColor Gray
        Write-Host "    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor White
        exit 1
    }
}

# ── Step 4: Clone Repository ──────────────────────────────────────────────────

Write-Step "Cloning OpenWhale repository..."

if (Test-Path "$resolvedDir\.git") {
    Write-Info "Repository already exists at $resolvedDir"
    Write-Info "Pulling latest changes..."
    Push-Location $resolvedDir
    git pull origin main
    Pop-Location
    Write-Success "Repository updated!"
} else {
    Write-Info "Cloning to: $resolvedDir"
    git clone https://github.com/viralcode/openwhale.git "$resolvedDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to clone repository. Check your internet connection."
        exit 1
    }
    Write-Success "Repository cloned successfully!"
}

# ── Step 5: Install Dependencies ──────────────────────────────────────────────

Write-Step "Installing dependencies..."

Push-Location $resolvedDir
Write-Info "Running pnpm install (this may take a few minutes)..."
pnpm install

if ($LASTEXITCODE -ne 0) {
    Write-Warn "pnpm install had issues. Trying with npm fallback..."
    npm install
}

# ── Step 6: Approve Native Module Builds ──────────────────────────────────────

Write-Step "Building native modules..."

Write-Info "Running pnpm approve-builds (select all when prompted)..."
pnpm approve-builds

Write-Success "Native modules built!"

# ── Step 7: Setup Environment ─────────────────────────────────────────────────

Write-Step "Setting up environment..."

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Success "Created .env from .env.example"
        Write-Info "Edit .env to add your AI provider API keys."
    } else {
        Write-Warn "No .env.example found — you may need to create .env manually."
    }
} else {
    Write-Success ".env already exists — skipping."
}

Pop-Location

# ── Done ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║                                                      ║" -ForegroundColor Green
Write-Host "  ║        ✅  OpenWhale installed successfully!  ✅      ║" -ForegroundColor Green
Write-Host "  ║                                                      ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  📁 Location:  $resolvedDir" -ForegroundColor White
Write-Host "  🌐 Dashboard: http://localhost:7777/dashboard" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "    1. cd $resolvedDir" -ForegroundColor Gray
Write-Host "    2. Edit .env and add your AI API keys" -ForegroundColor Gray
Write-Host "    3. pnpm run dev" -ForegroundColor Gray
Write-Host "    4. Open http://localhost:7777/dashboard" -ForegroundColor Gray
Write-Host "    5. Login with admin / admin" -ForegroundColor Gray
Write-Host ""

if (-not $SkipStart) {
    $startNow = Read-Host "  🚀 Start OpenWhale now? (Y/n)"
    if ($startNow -ne "n" -and $startNow -ne "N") {
        Write-Host ""
        Write-Info "Starting OpenWhale..."
        Write-Info "Press Ctrl+C to stop the server."
        Write-Host ""
        Push-Location $resolvedDir
        pnpm run dev
        Pop-Location
    }
}
