# Getting Started

Get OpenWhale up and running in under 5 minutes.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 22+ | Required runtime |
| **pnpm** | Latest | Recommended package manager (handles native modules better than npm) |

```bash
# Install pnpm if you don't have it
npm install -g pnpm
```

> 🪟 **Windows users:** See the dedicated **[Windows Installation Guide](windows-setup.md)** for step-by-step instructions, prerequisites, and Windows-specific troubleshooting.

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/viralcode/openwhale.git
cd openwhale

# Install dependencies (use pnpm, not npm!)
pnpm install

# Allow native modules to build (important!)
pnpm approve-builds

# Start the server (Dashboard + CLI API)
pnpm run dev
```

That's it. OpenWhale is now running at `http://localhost:7777`.

---

## First-Time Setup

1. Open **http://localhost:7777/dashboard**
2. Log in with the default credentials:
   ```
   Username: admin
   Password: admin
   ```
3. Go to **Settings** or **Providers** to add your AI API keys
4. Configure messaging channels, skills, and preferences

> ⚠️ **Change the default password** after first login!

> 💾 **Settings are saved automatically** to `data/openwhale.db`. You don't need to edit `.env` files for most configuration.

### Setup Wizard

First time running? The dashboard walks you through:
1. Checking prerequisites (Node, Python, FFmpeg)
2. Adding your AI provider keys
3. Connecting messaging channels
4. Enabling skills

---

## Running Modes

OpenWhale has two modes:

### 1. Server Mode (Recommended)

Runs the web dashboard, API, and all messaging channels.

```bash
pnpm run dev
```

This starts everything — dashboard, WhatsApp, Telegram, Discord, and all other connected services.

### 2. CLI Mode

Run standalone commands without the full server.

```bash
npm run cli chat                    # Interactive chat
npm run cli browser install         # Install BrowserOS
npm run cli browser status          # Check browser backends
npm run cli whatsapp login          # Connect WhatsApp
npm run cli providers               # List AI providers
```

> ⚠️ CLI commands that need the server (like `browser use`) will call the server API, so make sure the server is running first.

---

## Docker (Recommended for Production)

```bash
# Build and start
docker-compose up -d

# Verify it's running
curl http://localhost:7777/health
```

### Docker Commands

```bash
# Build the image
npm run docker:build

# Start containers
npm run docker:up

# Stop containers
npm run docker:down
```

---

## Next Steps

- [Configure AI Providers](providers.md) — Add API keys for Claude, GPT, Gemini, etc.
- [Connect Channels](channels.md) — Set up WhatsApp, Telegram, Discord, and more
- [Explore Tools](tools.md) — See what OpenWhale can do out of the box
- [Dashboard Guide](dashboard.md) — Learn the web interface
