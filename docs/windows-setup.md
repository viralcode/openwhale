# Installing & Running OpenWhale on Windows

A step-by-step guide to get OpenWhale running on Windows 10/11.

---

## 🚀 One-Command Install (Recommended)

The fastest way to get started — the installer handles everything automatically:

### Option A: PowerShell (Recommended)

Open **PowerShell** and run:

```powershell
irm https://raw.githubusercontent.com/viralcode/openwhale/main/install.ps1 | iex
```

Or if you've already downloaded the repo:

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

### Option B: Batch File (Double-Click)

Download and double-click **`install.bat`** — or run from Command Prompt:

```cmd
install.bat
```

Both scripts will:
1. ✅ Check and install **Git**, **Node.js 22+**, and **pnpm** via `winget`
2. ✅ Clone the repository to `%USERPROFILE%\openwhale`
3. ✅ Run `pnpm install` and build native modules
4. ✅ Create your `.env` config file
5. ✅ Offer to start OpenWhale immediately

> [!TIP]
> Run as **Administrator** for automatic prerequisite installation. Without admin, it will tell you what to install manually.

---

## Manual Installation

## Prerequisites

| Requirement | Version | How to Get It |
|-------------|---------|---------------|
| **Node.js** | 22+ | [nodejs.org](https://nodejs.org/) — use the Windows installer (`.msi`) |
| **pnpm** | Latest | `npm install -g pnpm` (after installing Node.js) |
| **Git** | Latest | [git-scm.com](https://git-scm.com/download/win) — use the Windows installer |

> [!TIP]
> Use **Windows Terminal** or **PowerShell** instead of the legacy Command Prompt for the best experience.

### Optional (for full feature support)

| Tool | Purpose | How to Get It |
|------|---------|---------------|
| **Python 3.10+** | Code execution tool | [python.org](https://www.python.org/downloads/) — check "Add to PATH" during install |
| **FFmpeg** | Camera, screen recording, media tools | `winget install ffmpeg` or [ffmpeg.org](https://ffmpeg.org/download.html) |
| **Docker Desktop** | Container management | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Visual Studio Build Tools** | Native module compilation | `npm install -g windows-build-tools` or install from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/) |

---

## Step 1: Install Node.js

1. Download the **LTS** installer from [nodejs.org](https://nodejs.org/) (v22 or later)
2. Run the `.msi` installer — accept the defaults
3. **Important:** Check the box for **"Automatically install the necessary tools"** if prompted (this installs Python and build tools)
4. Verify the installation:

```powershell
node -v    # Should show v22.x.x or higher
npm -v     # Should show 10.x.x or higher
```

---

## Step 2: Install pnpm and Git

```powershell
# Install pnpm globally
npm install -g pnpm

# Verify pnpm
pnpm -v

# If Git isn't installed, download from https://git-scm.com/download/win
git --version
```

---

## Step 3: Clone and Install OpenWhale

```powershell
# Clone the repository
git clone https://github.com/viralcode/openwhale.git

# Navigate into the project
cd openwhale

# Install dependencies (always use pnpm, not npm!)
pnpm install

# Allow native modules to build (select all when prompted)
pnpm approve-builds
```

> [!IMPORTANT]
> If `pnpm approve-builds` fails with compilation errors, you likely need Visual Studio Build Tools. Run:
> ```powershell
> npm install -g windows-build-tools
> ```
> Then re-run `pnpm install` and `pnpm approve-builds`.

---

## Step 4: Configure Environment

```powershell
# Copy the example environment file
copy .env.example .env
```

Edit `.env` in your preferred editor (Notepad, VS Code, etc.) and add at least one AI provider key:

```env
ANTHROPIC_API_KEY=your-key-here
# OR
OPENAI_API_KEY=your-key-here
# OR
GOOGLE_API_KEY=your-key-here
```

> [!TIP]
> Most configuration can be done through the web dashboard after first launch — you don't need to edit `.env` for everything.

---

## Step 5: Start OpenWhale

```powershell
pnpm run dev
```

You should see output like:

```
🐋 OpenWhale server running at http://localhost:7777
📊 Dashboard: http://localhost:7777/dashboard
```

Open your browser to **http://localhost:7777/dashboard**.

---

## Step 6: First-Time Setup

1. Log in with the default credentials:
   - **Username:** `admin`
   - **Password:** `admin`
2. Go to **Settings** → **Providers** to add your AI API keys
3. Configure messaging channels and skills as needed

> [!WARNING]
> Change the default password immediately after first login!

---

## Windows-Specific Notes

### What Works on Windows

| Feature | Status | Notes |
|---------|--------|-------|
| **Web Dashboard** | ✅ Full support | |
| **All AI Providers** | ✅ Full support | |
| **Shell Execution** | ✅ Uses `cmd.exe` | PowerShell commands work too |
| **Code Execution** | ✅ Python & JS | Ensure Python is in PATH |
| **Browser Automation** | ✅ Playwright + BrowserOS | |
| **File Operations** | ✅ Full support | |
| **WhatsApp / Telegram / Discord / Slack** | ✅ Full support | |
| **Twitter/X** | ✅ Full support | |
| **Camera & Screenshot** | ✅ Uses `ffmpeg` | Requires FFmpeg in PATH |
| **Screen Recording** | ✅ Uses `ffmpeg` | Requires FFmpeg in PATH |
| **Clipboard** | ✅ Uses `clip.exe` / `powershell` | |
| **Docker Tools** | ✅ Full support | Requires Docker Desktop |
| **Daemon (auto-start)** | ✅ Uses Startup folder | `pnpm run cli daemon install` |
| **Memory & Vector Search** | ✅ Full support | |

### What Does NOT Work on Windows

| Feature | Reason |
|---------|--------|
| **iMessage** | macOS only — requires Apple Messages.app |
| **Apple Notes / Reminders** | macOS only — requires AppleScript |
| **Apple Shortcuts** | macOS only |
| **macOS Menu Bar App** | macOS only — SwiftUI native app |

---

## Running as a Background Service

OpenWhale can auto-start with Windows using the Startup folder:

```powershell
# Install as a startup service
pnpm run cli daemon install

# Check daemon status
pnpm run cli daemon status

# Remove from startup
pnpm run cli daemon uninstall
```

---

## Docker on Windows

If you prefer running OpenWhale in Docker:

```powershell
# Make sure Docker Desktop is running

# Build and start
docker-compose up -d

# Verify it's running
curl http://localhost:7777/health

# Stop
docker-compose down
```

---

## Troubleshooting

### `better-sqlite3` build errors

```powershell
# Install build tools
npm install -g windows-build-tools

# Clean and reinstall
rmdir /s /q node_modules
del pnpm-lock.yaml
pnpm install
pnpm approve-builds
```

### `ENOENT: python` or `node-gyp` errors

Ensure Python is installed and in your PATH:

```powershell
python --version   # Should show 3.10+
```

If not found, reinstall Python from [python.org](https://www.python.org/downloads/) and check **"Add Python to PATH"**.

### Port already in use

```powershell
# Find what's using port 7777
netstat -ano | findstr :7777

# Kill the process (replace <PID> with the actual process ID)
taskkill /PID <PID> /F
```

### PowerShell execution policy errors

If scripts won't run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### FFmpeg not found

Install via `winget`:

```powershell
winget install ffmpeg
```

Or download from [ffmpeg.org](https://ffmpeg.org/download.html), extract, and add the `bin` folder to your system PATH.

---

## Next Steps

- [Configure AI Providers](providers.md) — Add API keys for Claude, GPT, Gemini, etc.
- [Connect Channels](channels.md) — Set up WhatsApp, Telegram, Discord, and more
- [Explore Tools](tools.md) — See what OpenWhale can do out of the box
- [Dashboard Guide](dashboard.md) — Learn the web interface
- [Troubleshooting](troubleshooting.md) — More common fixes
