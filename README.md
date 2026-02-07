<p align="center">
  <img src="images/logo.png" alt="OpenWhale" width="200" />
</p>

<h1 align="center">OpenWhale</h1>

<p align="center">
  <strong>Self-Extensible AI Assistant 🐋</strong>
</p>

<p align="center">
  Built for folks who want their AI to actually <em>do things</em> — not just chat.
</p>

<p align="center">
  <strong>🚧 Active Development</strong> — This project is being actively built. Expect frequent updates!<br/>
  <strong>🐢 Long-Running Tasks</strong> — Handles complex, multi-step tasks that run for hours<br/>
  <strong>🌐 OpenWhale Website</strong> — Coming soon<br/>
  <strong>☁️ OpenWhale Hosting</strong> — Managed hosting coming soon
</p>

---

<p align="center">
  <a href="FEATURES.md"><strong>📋 View Full Features List</strong></a> &nbsp;|&nbsp;
  <a href="tutorials/"><strong>📚 Tutorials</strong></a>
</p>

---

## What is OpenWhale?

OpenWhale is a **self-extensible AI assistant** that doesn't just chat — it takes action. Connect it to multiple AI models, let it talk on your behalf through WhatsApp/Telegram/Discord/Twitter/iMessage, browse the web with real browser automation, execute code, manage your calendar, send emails, and basically do whatever you need it to do.

Think of it as **Claude, GPT-4, or DeepSeek with arms and legs**.

<p align="center">
  <img src="images/mainpage.png" alt="OpenWhale Dashboard" width="800" />
</p>

---

## ✨ Core Features

### 🤖 8 AI Providers
Switch between any major AI model on the fly. One assistant, unlimited model choices.

| Provider | Top Models |
|----------|------------|
| **Anthropic** | Claude Sonnet 5, Opus 4.5, Sonnet 4.5 |
| **OpenAI** | GPT-5.2, GPT-5, GPT-4o, o4-mini |
| **Google Gemini** | Gemini 3 Pro, Gemini 2.5 Pro |
| **Qwen** | Qwen3-Max, QwQ-Plus, Qwen3-Coder |
| **DeepSeek** | DeepSeek Chat, DeepSeek Coder, DeepSeek Reasoner |
| **Groq** | Llama 3.3 70B, Mixtral 8x7B |
| **Together AI** | Any open-source model |
| **Ollama** | Local models (Llama, Mistral, Phi) — no API key! |

<p align="center">
  <img src="images/aiproviders.png" alt="AI Providers" width="600" />
</p>

---

### 🐢 Long-Horizon Reasoning
Capable of handling long-running, complex tasks with multi-step reasoning. It plans, executes, and verifies its own work, autonomously overcoming errors and obstacles.

---

### 💬 6 Messaging Channels
Your AI responds across all platforms — unified inbox, one brain.

| Channel | How it Works |
|---------|--------------|
| **WhatsApp** | Scan QR code, uses your personal account |
| **Telegram** | Create a bot with @BotFather |
| **Discord** | Add bot to your server |
| **Slack** | Slack app integration |
| **Twitter/X** | Auto-reply to mentions via bird CLI (cookie auth, no API!) |
| **iMessage** | macOS native — read and send iMessages via `imsg` CLI |

---

### 🛠️ 33+ Built-in Tools
The AI can actually DO things, not just talk about them.

| Tool | Capability |
|------|------------|
| **exec** | Run any shell command on your machine |
| **file** | Read, write, list files and directories |
| **browser** | Full web automation — navigate, click, type, screenshot |
| **screenshot** | Capture your screen, AI analyzes what it sees |
| **code_exec** | Run Python/JavaScript/TypeScript code on-the-fly |
| **web_fetch** | Fetch any URL, parse APIs and web pages |
| **memory** | Remember things across conversations forever |
| **cron** | Schedule tasks to run at specific times |
| **canvas** | Generate and manipulate images |
| **tts** | Text-to-speech (AI speaks out loud) |
| **image** | Analyze and process images with vision |
| **nodes** | Structured data and knowledge graphs |
| **camera** | Take photos/video from connected cameras |
| **imessage** | Read and send iMessages on macOS |
| **extend** | Create self-extensions for automated workflows |
| **pdf** | Create, read, merge PDFs with text/images/tables |
| **slides** | Generate PowerPoint/PDF presentations |
| **spreadsheet** | Create and edit Excel/CSV files |
| **git** | Repository management, commits, branches, PRs |
| **docker** | Container management and orchestration |
| **ssh** | Remote server connections and commands |
| **db_query** | SQL database queries (SQLite, PostgreSQL, MySQL) |
| **email_send** | Send emails via SMTP |
| **zip** | Compress and extract archives |
| **qr_code** | Generate QR codes |
| **system_info** | System diagnostics and monitoring |
| **clipboard** | Read/write system clipboard |
| **shortcuts** | Run Apple Shortcuts (macOS) |
| **calendar_event** | Create calendar events (.ics) |
| **planning** | Multi-step task planning |
| **skill_creator** | Create custom markdown skills |

<p align="center">
  <img src="images/tools.png" alt="Available Tools" width="800" />
</p>

---

### 🔌 9 API Skills (External Integrations)
Connect to your favorite services — the AI handles the API calls.

| Skill | What it Does |
|-------|--------------|
| **GitHub** | Manage repos, issues, PRs, commits |
| **Notion** | Search, create, update pages and databases |
| **Google Calendar** | View and create events |
| **Gmail** | Read, send, and search emails |
| **Google Drive** | Upload, download, list files |
| **Google Tasks** | Manage your to-do lists |
| **Weather** | Current conditions and forecasts |
| **Spotify** | Control playback, search music, manage playlists |
| **Trello** | Manage boards, lists, and cards |
| **1Password** | Securely fetch passwords and secrets |
| **Apple Notes/Reminders** | Native macOS integration |
| **Twitter/X** | Post, search, timeline, mentions, follow |

<p align="center">
  <img src="images/api-skills.png" alt="API Skills" width="800" />
</p>

---

### 📝 50+ Markdown Skills (Community)
Community-built skills from [OpenClaw](https://github.com/VoltAgent/awesome-openclaw-skills) — instant expertise in any domain.

- **Frontend**: UI/UX design, React best practices, design systems
- **Backend**: Architecture patterns, NextJS, Vercel deployment
- **AI/Video**: ComfyUI, Remotion video toolkit, vision models
- **Platform**: Apple HIG, Linux service management, Xcode builds
- **Productivity**: Resume builder, email templates, artifact creation

<p align="center">
  <img src="images/mdskills.png" alt="Markdown Skills" width="800" />
</p>

Create your own skills with the built-in Skill Creator:

<p align="center">
  <img src="images/skill-creator.png" alt="Skill Creator" width="800" />
</p>

---

### ⚡ Self-Extension System
The AI can create its own automations. Just ask.

- *"Create an extension that checks Bitcoin price every hour and sends it to WhatsApp"*
- *"Make an extension that reminds me to drink water"*
- *"Create a daily standup summary extension"*

Extensions support cron scheduling, multi-channel output, and persist across restarts.

<p align="center">
  <img src="images/extensions.png" alt="Extensions" width="600" />
</p>

---

### 🌐 Browser Automation
Two backends to choose from:

| Backend | Best For |
|---------|----------|
| **Playwright** | Simple scraping, headless automation, zero setup |
| **BrowserOS** | Real browser with your extensions, cookies, and logins |

BrowserOS lets the AI control YOUR actual browser — including logged-in sessions, AdBlock, 1Password, and everything else.

---

### 🧠 Persistent Memory
OpenWhale remembers everything, even after restarts.

- **Long-term Memory** — Facts and preferences in MEMORY.md
- **Daily Notes** — Automatic daily logging
- **Vector Search** — Find related content by meaning (local embeddings, no API needed!)
- **Session Persistence** — Continue conversations across restarts

---

### 🔒 Enterprise Security
Production-ready security out of the box.

- JWT authentication with session management
- API key protection
- Rate limiting
- Audit logs
- Multi-user support
- Sandboxed code execution

---

## Why OpenWhale?

| Feature | OpenWhale | ChatGPT | Claude | Typical Chatbot |
|---------|-----------|---------|--------|-----------------|
| **Multi-model support** | ✅ 8 providers | ❌ GPT only | ❌ Claude only | ❌ Single model |
| **Run shell commands** | ✅ Full access | ❌ No | ❌ No | ❌ No |
| **Browser automation** | ✅ Playwright + BrowserOS | ❌ Limited | ✅ Limited | ❌ No |
| **WhatsApp/Telegram/Discord** | ✅ All channels | ❌ No | ❌ No | ❌ Maybe one |
| **iMessage (macOS)** | ✅ Native | ❌ No | ❌ No | ❌ No |
| **Twitter integration** | ✅ Full API | ❌ No | ❌ No | ❌ No |
| **Self-extensible** | ✅ Creates own tools | ❌ No | ❌ No | ❌ No |
| **Runs locally** | ✅ Your machine | ❌ Cloud only | ❌ Cloud only | ❌ Usually cloud |
| **Open source** | ✅ MIT license | ❌ Closed | ❌ Closed | ❌ Varies |
| **Persistent memory** | ✅ Vector search | ✅ Limited | ✅ Limited | ❌ Usually no |

---

## Getting Started

### Prerequisites

- **Node.js 22+** — Required for the runtime
- **pnpm** — Recommended package manager (handles native modules better)

```bash
# Install pnpm if you don't have it
npm install -g pnpm
```

### Quick Start

```bash
# Clone it
git clone https://github.com/viralcode/openwhale.git
cd openwhale

# Install dependencies (use pnpm, not npm!)
pnpm install

# Allow native modules to build (important!)
pnpm approve-builds

# Set up your environment
cp .env.example .env
# Add your API keys to .env

# Start the server
pnpm run dev
```

### Running Commands

OpenWhale has two modes:

1. **Server mode** (`npm run dev`) - Runs the web dashboard, API, and all channels
2. **CLI mode** (`npm run cli <command>`) - Run standalone commands

```bash
# Server (runs dashboard, WhatsApp, Telegram, Discord, etc.)
npm run dev

# CLI commands (use when server is NOT needed)
npm run cli chat                    # Interactive chat
npm run cli browser install         # Install BrowserOS
npm run cli browser status          # Check browser backends
npm run cli whatsapp login          # Connect WhatsApp
npm run cli providers               # List AI providers
```

> ⚠️ **Note:** CLI commands that need the server (like `browser use`) will call the server API, so make sure the server is running first!

### Docker (Recommended for Production)

```bash
docker-compose up -d
```

That's it. Hit `http://localhost:18789/health` to make sure it's alive.

---

## Troubleshooting

### `better-sqlite3` bindings error

```
Error: Could not locate the bindings file.
```

This happens when using `npm` instead of `pnpm`, or when native modules weren't built properly.

**Fix:**
```bash
# Remove existing node_modules
rm -rf node_modules package-lock.json

# Use pnpm instead
pnpm install
pnpm approve-builds   # Select all packages when prompted
pnpm run dev
```

### Docker build fails with "pnpm-lock.yaml is absent"

Make sure you pulled the latest version of the repository which includes the lockfile:
```bash
git pull origin main
```

### Native module build errors on macOS

Some packages require Xcode Command Line Tools:
```bash
xcode-select --install
```

---

## Dashboard

OpenWhale comes with a web dashboard for managing everything without touching the terminal.

**Access it at:** `http://localhost:18789/dashboard`

### What you can do from the dashboard:

- **Chat** — Talk to the AI with full tool support
- **Connect channels** — Link WhatsApp, Telegram, Discord, iMessage by scanning QR codes or adding tokens
- **Manage providers** — Add API keys for Claude, GPT-4, Gemini, etc.
- **Configure skills** — Enable GitHub, Notion, Weather, Google services
- **View message history** — See all conversations across channels
- **Monitor system** — Check connected channels, active sessions, audit logs

### Setup Wizard

First time running? The dashboard walks you through:
1. Checking prerequisites (Node, Python, FFmpeg)
2. Adding your AI provider keys
3. Connecting messaging channels
4. Enabling skills

### Authentication

The dashboard is protected by authentication.

**Default credentials:**
```
Username: admin
Password: admin
```

> ⚠️ **Security Note:** Change the default password after first login!

**Features:**
- Session-based auth with 7-day expiry
- Admin can create additional users
- Password change in Settings
- Logout button in sidebar

---

## Connecting Channels

OpenWhale can send and receive messages through multiple platforms. Here's how to set them up:

### WhatsApp

The easiest one — works with your personal WhatsApp account.

**Via Dashboard:**
1. Go to `http://localhost:18789/dashboard`
2. Navigate to Channels → WhatsApp
3. Click "Connect"
4. Scan the QR code with your phone (WhatsApp → Linked Devices → Link a Device)
5. Done! Messages to your number will be handled by the AI

**Via CLI:**
```bash
npm run cli whatsapp login    # Shows QR code in terminal
npm run cli whatsapp status   # Check if connected
npm run cli whatsapp logout   # Disconnect
```

Your session is saved in `~/.openwhale/whatsapp-auth/` so you don't need to scan again.

### Telegram

1. Create a bot with [@BotFather](https://t.me/botfather) on Telegram
2. Copy the bot token
3. Add to `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=your-bot-token
   ```
4. Restart OpenWhale
5. Message your bot — the AI will respond

### Discord

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable "Message Content Intent" under Bot settings
3. Copy the bot token
4. Add to `.env`:
   ```bash
   DISCORD_BOT_TOKEN=your-bot-token
   ```
5. Invite bot to your server using the OAuth2 URL generator
6. Restart OpenWhale

### Twitter/X

OpenWhale uses the **bird CLI** for Twitter/X integration — no API keys needed! It uses cookie-based authentication.

**Install bird:**
```bash
# npm (cross-platform)
npm install -g @steipete/bird

# Homebrew (macOS)
brew install steipete/tap/bird
```

**Setup:**
1. Open your browser and log into X/Twitter
2. Run `bird check` to verify cookie detection
3. Test with `bird whoami` — should show your username
4. Add to `.env`:
   ```bash
   TWITTER_ENABLED=true
   TWITTER_POLL_INTERVAL=60000  # Poll every 60 seconds
   ```
5. Restart OpenWhale
6. The AI will respond to mentions of your account

**How it works:**
- Polls for mentions every 60 seconds (configurable)
- Auto-replies to mentions using AI
- Can post tweets, reply to threads, and read timelines

> ⚠️ **Note:** Twitter/X may rate-limit or flag automated posting. Use with caution on accounts you care about.

### iMessage (macOS only)

OpenWhale can read and send iMessages natively on macOS using the `imsg` CLI.

**Prerequisites:**
- macOS (iMessage is not available on other platforms)
- Messages.app signed in with your Apple ID
- Full Disk Access granted to your terminal (System Settings → Privacy & Security → Full Disk Access)
- Automation permission for Messages.app

**Install imsg CLI:**
```bash
brew install steipete/tap/imsg
```

**Via Dashboard:**
1. Go to `http://localhost:18789/dashboard`
2. Navigate to **Channels**
3. Find the **iMessage** card
4. Click **⬇️ Install imsg CLI** (if not already installed)
5. Click **📱 Connect iMessage**
6. Done! The AI can now read and send iMessages

**What the AI can do with iMessage:**
- **List chats** — See your recent iMessage conversations
- **Read messages** — Read message history from any chat
- **Send messages** — Send iMessages to any phone number or email

**Example prompts:**
- *"Show me my recent iMessage conversations"*
- *"Read my latest messages from Mom"*
- *"Send an iMessage to +1234567890 saying I'll be there in 10 minutes"*

> ⚠️ **Note:** iMessage requires macOS. On other platforms, the iMessage card will show as unavailable. The connection persists across server restarts.

---

## Tools

These are the built-in capabilities the AI can use. You don't need to configure anything — they just work.

| Tool | What it does |
|------|-------------|
| **exec** | Run shell commands on your machine |
| **file** | Read, write, list files and directories |
| **browser** | Open URLs, take screenshots, interact with web pages |
| **screenshot** | Capture your screen or specific windows |
| **code_exec** | Run Python/JavaScript code in a sandbox |
| **web_fetch** | Fetch content from URLs (APIs, web pages) |
| **memory** | Remember things across conversations |
| **cron** | Schedule tasks to run at specific times |
| **canvas** | Generate and manipulate images |
| **tts** | Text-to-speech (say things out loud) |
| **image** | Analyze and process images |
| **nodes** | Work with structured data and knowledge graphs |
| **camera** | Take photos or record video from connected cameras |
| **location** | Get current geolocation data |
| **imessage** | Read and send iMessages on macOS via `imsg` CLI |
| **extend** | Create self-extensions for automated workflows |

---

## Browser Automation

OpenWhale supports **two browser automation backends** — choose based on your needs:

### 1. Playwright (Default)

Built-in headless Chrome browser. Works out of the box.

- ✅ **Zero setup** — just works
- ✅ **Headless** — runs in background
- ✅ **Fast** — optimized for automation
- ❌ No extensions
- ❌ No saved logins/cookies

**Best for:** Simple web scraping, screenshots, form filling

### 2. BrowserOS (Recommended for AI Agents)

A real Chrome browser with AI automation superpowers. The AI controls *your* actual browser.

- ✅ **Your extensions** — AdBlock, 1Password, etc. all work
- ✅ **Your logins** — Already signed into sites? AI can use them
- ✅ **Visible browser** — Watch what the AI does in real-time
- ✅ **Privacy-first** — Runs locally, no cloud
- ✅ **Anti-detection** — Looks like a real user, not a bot
- ✅ **Local AI support** — Works with Ollama models
- ✅ **Visual workflows** — See and debug AI actions

**Best for:** Complex tasks, logged-in services, anything requiring real browser behavior

### Quick Setup

```bash
# Install BrowserOS automatically
npm run setup

# Or manually
npm run cli browser install

# Check status
npm run cli browser status

# Switch backends
npm run cli browser use browseros  # Use BrowserOS
npm run cli browser use playwright  # Use Playwright (default)
```

### Why BrowserOS?

| Scenario | Playwright | BrowserOS |
|----------|------------|-----------|
| Scrape public website | ✅ Great | ✅ Great |
| Login to your email | ❌ Need to re-auth | ✅ Use existing session |
| Book a flight | ❌ Often blocked | ✅ Works like real user |
| Use site with 2FA | ❌ Can't handle | ✅ Already authenticated |
| Debug AI actions | ❌ Headless | ✅ Watch in real-time |
| Use adblocker | ❌ No extensions | ✅ All extensions work |

### Enabling BrowserOS MCP Server

After installing BrowserOS, you need to enable the MCP server for OpenWhale to control it:

1. **Open BrowserOS**
2. **Navigate to** `chrome://browseros/mcp` in the address bar
3. **Enable the MCP server** toggle
4. The MCP server runs at `http://127.0.0.1:9000/mcp` by default

Then verify and switch to BrowserOS:
```bash
# Check if BrowserOS MCP is running
npm run cli browser status

# Should show: BrowserOS ● Running at http://127.0.0.1:9000
#              Tools: 42 available

# Switch to BrowserOS backend
npm run cli browser use browseros

# List available tools
npm run cli browser tools
```

**Available Tools (42):**
- `browser_navigate` - Navigate to URLs
- `browser_click_element` - Click on page elements
- `browser_type_text` - Type text into inputs
- `browser_get_screenshot` - Capture screenshots
- `browser_get_page_content` - Extract page HTML/text
- `browser_execute_javascript` - Run custom JS
- `browser_search_history` - Search browser history
- Plus 35 more for tabs, bookmarks, network, console...

## Memory System

OpenWhale has a powerful memory system (inspired by OpenClaw) that remembers context across conversations and restarts.

### Storage Location
```
~/.openwhale/memory/
├── MEMORY.md           # Long-term facts
├── 2024-01-15.md       # Daily notes  
└── vector.db           # Vector embeddings for semantic search
```

### Slash Commands
| Command | What it does |
|---------|-------------|
| `/memory` | View your memory files |
| `/status` | Show session info |
| `/reset` | Clear session, start fresh |
| `/history` | Show recent messages |

### Embeddings (Vector Search)

OpenWhale supports **semantic search** over your memories — find related content by meaning, not just keywords.

**Three embedding providers (just like OpenClaw):**

1. **Local (no API key!)** — Uses `node-llama-cpp` with a 300MB GGUF model
   - Downloads automatically on first use
   - Runs entirely on your machine
   - Model: `embeddinggemma-300M-Q8_0`

2. **OpenAI** — If `OPENAI_API_KEY` is set
   - Model: `text-embedding-3-small`
   - Best accuracy, requires API key

3. **Gemini** — If `GOOGLE_API_KEY` is set
   - Model: `text-embedding-004`
   - Good free alternative

**Auto-selection order:** Local → OpenAI → Gemini

### Using Memory via Chat

Ask the AI to:
- *"Remember that my favorite color is blue"* → Saves to MEMORY.md
- *"Add to today's notes: meeting at 3pm"* → Saves to daily log
- *"Search my memory for project ideas"* → Vector search
- *"Index my memory files"* → Re-index for search
- *"Show memory status"* → See embedding provider info

### Session Persistence

Conversations are saved to JSONL transcripts, so you can:
- Continue where you left off after restarts
- Keep context across multiple messages
- Review past conversations

---

## Extensions

OpenWhale can extend itself! Create custom automations via chat that persist and run on schedules.

### Storage
Extensions are stored as TypeScript files in `~/.openwhale/extensions/`

### Creating Extensions via Chat

Just ask the AI:
- *"Create an extension that reminds me to drink water every hour"*
- *"Make an extension that checks Bitcoin price at 9 AM and sends it to WhatsApp"*
- *"Create a daily standup reminder extension"*

### Extension Actions

| Action | What it does |
|--------|-------------|
| `create` | Create a new extension with code and optional schedule |
| `list` | List all extensions |
| `get` | View an extension's code |
| `update` | Modify an extension |
| `delete` | Remove an extension |
| `enable/disable` | Toggle an extension |
| `run` | Execute an extension manually |

### Extension Structure

Each extension has:
```json
{
  "name": "daily_reminder",
  "description": "Sends a daily reminder",
  "version": "1.0.0",
  "enabled": true,
  "schedule": "0 9 * * *",
  "channels": ["whatsapp"]
}
```

### Scheduled Extensions

Use cron expressions for scheduled execution:
- `0 9 * * *` — Daily at 9 AM
- `0 */2 * * *` — Every 2 hours
- `0 9 * * 1-5` — Weekdays at 9 AM

### Example

```javascript
// Extension code (runs daily)
const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
const data = await response.json();
return `Bitcoin price: $${data.data.amount}`;
```

Extensions automatically send their return value to configured channels!

---

## Markdown Skills (OpenClaw Community)

OpenWhale includes **50+ community-built skills** from the [OpenClaw](https://github.com/VoltAgent/awesome-openclaw-skills) project. These are SKILL.md files that give the AI specialized knowledge and capabilities.

### Location
Skills are stored in `~/.openwhale/skills/` (or `skills/` in the repo).

### Available Skills (50+)
| Category | Skills |
|----------|--------|
| **Frontend** | `frontend-design`, `ui-ux-master`, `ui-ux-pro-max`, `human-optimized-frontend`, `ui-design-system`, `deliberate-frontend-redesign` |
| **Backend** | `backend-patterns`, `senior-fullstack`, `nextjs-expert`, `vercel-react-best-practices` |
| **Integrations** | `slack`, `discord`, `github`, `zoho-email-integration`, `telegram-reaction-prober` |
| **AI/Video** | `computer-use`, `comfyui-runner`, `comfy-ai`, `remotion-video-toolkit`, `vision-sandbox` |
| **Platform** | `apple-hig`, `xcodebuildmcp`, `linux-service-triage`, `niri-ipc` |
| **Productivity** | `resume-builder`, `react-email-skills`, `artifacts-builder`, `giphy` |

### Managing Skills
From the Dashboard:
1. Go to **Skills** → **MD Skills** tab
2. View all 50+ installed skills
3. Click **Edit** to view or modify any skill

### Credits
Skills are sourced from [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) — a community collection for AI assistants. Thank you to all contributors! 🙏

---

Skills are integrations with external services. They need API keys to work.

### GitHub
Access repositories, issues, pull requests.
```bash
GITHUB_TOKEN=ghp_your_token
```
Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

### Weather
Current conditions and forecasts.
```bash
OPENWEATHERMAP_API_KEY=your_key
```
Get a free key at [openweathermap.org](https://openweathermap.org/api).

### Notion
Manage pages and databases.
```bash
NOTION_API_KEY=secret_your_key
```
Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations).

### Google Services
Calendar, Gmail, Drive, and Tasks — all in one.

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Calendar, Gmail, Drive, and Tasks APIs
3. Create OAuth credentials (Desktop app)
4. Download `credentials.json` to `~/.openwhale/google/credentials.json`
5. Run OpenWhale and visit the Google auth URL shown in logs
6. Authorize access — tokens are saved automatically

### 1Password
Securely fetch passwords and secrets.
```bash
OP_CONNECT_TOKEN=your_connect_token
OP_CONNECT_HOST=http://localhost:8080
```
Requires [1Password Connect](https://developer.1password.com/docs/connect/) server.

### Apple Notes & Reminders (macOS only)
Works automatically on Mac — no config needed. The AI can read/write your Notes and Reminders.

### Spotify
Control playback, search music, manage playlists.
```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```
Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard).

### Trello
Manage boards, lists, and cards.
```bash
TRELLO_API_KEY=your_key
TRELLO_TOKEN=your_token
```
Get keys at [trello.com/app-key](https://trello.com/app-key).

---

## AI Providers

OpenWhale supports **8 AI providers** with automatic failover. Add the keys for whichever services you want to use.

| Provider | Env Variable | Top Models (Feb 2026) |
|----------|--------------|----------------------|
| **Anthropic** | `ANTHROPIC_API_KEY` | `claude-sonnet-5-20260203`, `claude-opus-4-5`, `claude-sonnet-4-5` |
| **OpenAI** | `OPENAI_API_KEY` | `gpt-5.2`, `gpt-5`, `gpt-4o`, `o4-mini` |
| **Google Gemini** | `GOOGLE_API_KEY` | `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro` |
| **Qwen** | `DASHSCOPE_API_KEY` | `qwen3-max`, `qwq-plus`, `qwen3-coder-plus`, `qwen3-vl-plus` |
| **DeepSeek** | `DEEPSEEK_API_KEY` | `deepseek-chat`, `deepseek-coder`, `deepseek-reasoner` |
| **Groq** | `GROQ_API_KEY` | `llama-3.3-70b-versatile`, `mixtral-8x7b-32768` |
| **Together AI** | `TOGETHER_API_KEY` | Any open-source model |
| **Ollama** | `OLLAMA_HOST` | Local models (no API key needed) |

```bash
# Example .env configuration
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DASHSCOPE_API_KEY=...  # or QWEN_API_KEY
DEEPSEEK_API_KEY=...
GROQ_API_KEY=...
OLLAMA_HOST=http://localhost:11434
```

**Fallback Order:** Anthropic → OpenAI → Google → Qwen → DeepSeek → Groq → Together → Ollama

Switch models on the fly in the dashboard or CLI.

---

## CLI

The CLI is where the magic happens:

```bash
# Start an interactive chat
npm run chat

# Check your setup
npm run cli providers  # See which AI providers are connected
npm run cli tools      # List available tools
npm run cli channels   # Check messaging channels
npm run cli skills     # See skill status

# WhatsApp management
npm run cli whatsapp login   # Scan QR code
npm run cli whatsapp status  # Check connection
npm run cli whatsapp logout  # Disconnect

# Browser automation
npm run cli browser install  # Auto-install BrowserOS
npm run cli browser status   # Check available backends
npm run cli browser use browseros   # Switch to BrowserOS
npm run cli browser use playwright  # Switch to Playwright (default)

# Background daemon (keeps running after terminal closes)
npm run cli daemon install   # Install as system service
npm run cli daemon start     # Start daemon
npm run cli daemon status    # Check if running
npm run cli daemon stop      # Stop daemon
```

---

## API

OpenWhale exposes an OpenAI-compatible API, so you can plug it into existing tools:

```bash
# Chat completion
curl -X POST http://localhost:18789/api/agent/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `POST /auth/register` | Create account |
| `POST /auth/login` | Get access token |
| `POST /api/agent/chat/completions` | Chat (with tools) |
| `GET /api/providers` | List AI providers |
| `GET /api/channels` | List channels |
| `GET /dashboard` | Web dashboard |

---

## Project Structure

```
src/
├── agents/      # Multi-agent routing and orchestration
├── auth/        # JWT, API keys, sessions
├── channels/    # WhatsApp, Telegram, Discord, Slack adapters
├── cli.ts       # Interactive terminal interface
├── daemon/      # Background service (launchd on macOS)
├── dashboard/   # Web admin panel
├── db/          # SQLite/PostgreSQL with Drizzle ORM
├── gateway/     # Hono-based HTTP API
├── integrations/# Google APIs (Calendar, Gmail, Drive, Tasks)
├── providers/   # Anthropic, OpenAI, Google, Groq, Ollama
├── security/    # Rate limiting, RBAC, audit logs, sandboxing
├── sessions/    # Persistent conversation history
├── skills/      # GitHub, Notion, Spotify, Weather, Apple, etc.
└── tools/       # File, browser, code execution, screenshots
```

---

## Configuration

All settings go in `.env`:

```bash
# Server
GATEWAY_PORT=18789
GATEWAY_HOST=0.0.0.0

# Database (SQLite by default)
DATABASE_URL=file:./data/openwhale.db
# Or PostgreSQL:
# DATABASE_URL=postgresql://user:pass@localhost:5432/openwhale

# Security — CHANGE THIS!
JWT_SECRET=change-me-to-something-random-at-least-32-chars
SECURITY_MODE=local  # or 'strict' for production

# Logging
LOG_LEVEL=info
```

---

## Contributing

PRs welcome! If you find a bug or have an idea, open an issue. Keep it friendly.

## License

MIT — do whatever you want with it.

---

<p align="center">
  Built with ❤️ by <a href="https://jijojohn.me">Jijo John</a>
</p>
