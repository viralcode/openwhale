<p align="center">
  <img src="docs/logo.png" alt="OpenWhale" width="200" />
</p>

<h1 align="center">OpenWhale</h1>

<p align="center">
  <strong>Your friendly neighborhood AI assistant 🐋</strong>
</p>

<p align="center">
  Built for folks who want their AI to actually <em>do things</em> — not just chat.
</p>

---

## What is this?

OpenWhale is an AI assistant that can take action. It connects to multiple AI models, talks on your behalf through WhatsApp/Telegram/Discord, browses the web, executes code, manages your calendar, and basically does whatever you need it to do.

Think of it as Claude, GPT-4, or DeepSeek with arms and legs.

## Why OpenWhale?

- **It's agentic** — not just a chatbot. It can use tools, run commands, send messages, and interact with the real world.
- **Use any model** — Claude, GPT-4, DeepSeek, Groq, Gemini, Ollama. Switch whenever you want.
- **Runs anywhere** — Docker, bare metal, your Raspberry Pi. Whatever works for you.
- **Actually secure** — JWT auth, API keys, rate limiting, audit logs. The boring stuff that matters.

---

## Getting Started

```bash
# Clone it
git clone https://github.com/viralcode/openwhale.git
cd openwhale

# Install dependencies
npm install

# Set up your environment
cp .env.example .env
# Add your API keys to .env

# Run it
npm run dev
```

Or if you're a Docker person:

```bash
docker-compose up -d
```

That's it. Hit `http://localhost:18789/health` to make sure it's alive.

---

## Dashboard

OpenWhale comes with a web dashboard for managing everything without touching the terminal.

**Access it at:** `http://localhost:18789/dashboard`

### What you can do from the dashboard:

- **Chat** — Talk to the AI with full tool support
- **Connect channels** — Link WhatsApp, Telegram, Discord by scanning QR codes or adding tokens
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

---

## Skills

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

Add the keys for whichever AI services you want to use. You can use multiple.

```bash
# Anthropic Claude (recommended)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI GPT-4
OPENAI_API_KEY=sk-...

# Google Gemini
GOOGLE_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=...

# Groq (fast inference)
GROQ_API_KEY=...

# Ollama (local models, no key needed)
OLLAMA_HOST=http://localhost:11434
```

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
  <sub>Made with ☕ and questionable sleep schedules</sub>
</p>
