# OpenWhale Features

A complete list of everything OpenWhale can do.

---

## 🤖 AI Capabilities

- **Multi-Model Support** — Use Claude, GPT-4/5, Gemini, DeepSeek, Groq, Qwen, Together AI, or Ollama
- **Automatic Failover** — Seamlessly switches between providers if one fails
- **8 AI Providers** — Anthropic, OpenAI, Google, Qwen, DeepSeek, Groq, Together AI, Ollama
- **Local AI** — Run models locally with Ollama (no API key needed)

---

## 💬 Messaging Channels

- **WhatsApp** — Connect your personal account via QR code
- **Telegram** — Create a bot and connect with a token
- **Discord** — Add a bot to your server
- **Unified Inbox** — All messages from all channels in one place

---

## 🛠️ Built-in Tools

| Tool | Description |
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

## 🧠 Memory System

- **Long-term Memory** — Remembers facts and preferences across conversations
- **Daily Notes** — Automatic daily logging
- **Vector Search** — Find related content by meaning, not just keywords
- **Local Embeddings** — Works offline with no API key
- **Session Persistence** — Continue conversations after restarts

---

## ⚡ Self-Extension System

- **Create Extensions via Chat** — Just describe what you want
- **Scheduled Tasks** — Run extensions on cron schedules
- **Multi-Channel Output** — Extensions can send to WhatsApp, Telegram, Discord
- **Enable/Disable** — Toggle extensions on and off
- **Custom Automations** — Build your own workflows

---

## 🔌 Skills (External Integrations)

| Skill | Description |
|-------|-------------|
| **GitHub** | Access repositories, issues, pull requests |
| **Notion** | Manage pages and databases |
| **Google Calendar** | Create and manage events |
| **Gmail** | Read and send emails |
| **Google Drive** | Access files and folders |
| **Google Tasks** | Manage to-do lists |
| **Weather** | Current conditions and forecasts |
| **Spotify** | Control playback, search music, manage playlists |
| **Trello** | Manage boards, lists, and cards |
| **1Password** | Securely fetch passwords and secrets |
| **Apple Notes** | Read and write notes (macOS) |
| **Apple Reminders** | Manage reminders (macOS) |

---

## 🖥️ Dashboard

- **Web-Based UI** — Manage everything from your browser
- **Chat Interface** — Talk to the AI with full tool support
- **Channel Management** — Connect/disconnect messaging platforms
- **Provider Config** — Add and manage AI API keys
- **Skills Toggle** — Enable/disable integrations
- **Message History** — View all conversations across channels
- **System Monitor** — Check connected channels and sessions
- **Setup Wizard** — Guided first-time configuration

---

## 🔒 Security

- **JWT Authentication** — Secure token-based auth
- **API Key Management** — Safe storage for credentials
- **Rate Limiting** — Prevent abuse
- **Audit Logs** — Track all actions
- **Session Management** — 7-day expiry with manual logout
- **Multi-User Support** — Admin can create additional users

---

## 🔧 CLI Commands

| Command | Description |
|---------|-------------|
| `npm run chat` | Start interactive chat |
| `npm run cli providers` | Check AI providers |
| `npm run cli tools` | List available tools |
| `npm run cli channels` | Check messaging channels |
| `npm run cli skills` | See skill status |
| `npm run cli whatsapp login` | Connect WhatsApp (QR code) |
| `npm run cli daemon install` | Install as system service |
| `npm run cli daemon start` | Start background daemon |

---

## 🌐 API

- **OpenAI-Compatible** — Works with existing tools expecting OpenAI format
- **REST Endpoints** — Health check, auth, chat, providers, channels
- **Bearer Token Auth** — Secure API access

---

## 🚀 Deployment

- **Docker** — One command deployment with docker-compose
- **Bare Metal** — Run directly with Node.js
- **Background Daemon** — Runs as a system service (launchd on macOS)
- **Raspberry Pi** — Lightweight enough for edge deployment

---

## 📦 Database

- **SQLite** — Default, zero-config local database
- **PostgreSQL** — Optional for production/multi-instance
- **Drizzle ORM** — Type-safe database access
