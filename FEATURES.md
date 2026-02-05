# OpenWhale Features

A complete list of everything OpenWhale can do.

---

## 🎯 Use Cases

### Personal Productivity
- **Smart Reminders** — "Remind me to call mom every Sunday at 5pm via WhatsApp"
- **Daily Briefings** — Get weather, calendar, and tasks sent to Telegram each morning
- **Note Taking** — "Add to my notes: project deadline moved to Friday"
- **Quick Research** — "What's the best restaurant near me?" with web browsing

### Developer Workflows
- **GitHub Automation** — "Create an issue for the login bug I found"
- **Code Execution** — "Run this Python script and show me the output"
- **Server Monitoring** — "Check if my server is running and restart if needed"
- **Documentation** — "Summarize the changes in the last 5 commits"

### Home Automation
- **Scheduled Tasks** — "Turn off all smart lights at midnight"
- **Status Checks** — "Is my Raspberry Pi still online?"
- **File Management** — "Backup my downloads folder to Drive every week"

### Communication
- **Cross-Platform Messaging** — Receive on WhatsApp, respond via Discord
- **Auto-Responses** — "If anyone asks about pricing, send them the PDF"
- **Group Updates** — "Send the daily standup summary to #team-updates"

### Business Use
- **Lead Tracking** — "Add this contact to Notion and create a Trello card"
- **Email Drafts** — "Draft a reply to the last email from John"
- **Meeting Prep** — "What's on my calendar tomorrow? Summarize the documents"
- **Expense Tracking** — "Log this receipt and add it to my expenses spreadsheet"

### Creative Work
- **Image Generation** — "Create a logo concept for my project"
- **Music Control** — "Play my focus playlist on Spotify"
- **Content Ideas** — "Search my notes for blog post ideas"

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

| Tool | Description | Example |
|------|-------------|---------|
| **exec** | Run shell commands | "List all running Docker containers" |
| **file** | Read, write, list files | "Show me my .env file" |
| **browser** | Web interaction | "Take a screenshot of hacker news" |
| **screenshot** | Capture screen | "Screenshot my desktop" |
| **code_exec** | Run code in sandbox | "Calculate 2^100 in Python" |
| **web_fetch** | Fetch URLs | "Get the weather API response" |
| **memory** | Persistent memory | "Remember my API key is xyz" |
| **cron** | Schedule tasks | "Run this every Monday at 9am" |
| **canvas** | Image manipulation | "Resize this image to 500px" |
| **tts** | Text-to-speech | "Say good morning out loud" |
| **image** | Image analysis | "What's in this screenshot?" |
| **nodes** | Knowledge graphs | "Create a node for this project" |

---

## 🧠 Memory System

- **Long-term Memory** — Remembers facts and preferences across conversations
- **Daily Notes** — Automatic daily logging
- **Vector Search** — Find related content by meaning, not just keywords
- **Local Embeddings** — Works offline with no API key
- **Session Persistence** — Continue conversations after restarts

---

## ⚡ Self-Extension System

- **Create Extensions via Chat** — "Create an extension that checks Bitcoin price daily"
- **Scheduled Tasks** — Run extensions on cron schedules
- **Multi-Channel Output** — Extensions can send to WhatsApp, Telegram, Discord
- **Enable/Disable** — Toggle extensions on and off
- **Custom Automations** — Build your own workflows

---

## 🔌 Skills (External Integrations)

| Skill | Description | Example |
|-------|-------------|---------|
| **GitHub** | Repos, issues, PRs | "Show my open pull requests" |
| **Notion** | Pages and databases | "Add this to my reading list" |
| **Google Calendar** | Events | "What meetings do I have today?" |
| **Gmail** | Email | "Send an email to john@example.com" |
| **Google Drive** | Files | "Upload this to my Drive" |
| **Google Tasks** | To-do lists | "Add 'buy milk' to my tasks" |
| **Weather** | Forecasts | "Will it rain tomorrow?" |
| **Spotify** | Music control | "Play my liked songs" |
| **Trello** | Boards and cards | "Move this card to Done" |
| **1Password** | Secrets | "Get my AWS credentials" |
| **Apple Notes** | Notes (macOS) | "Add to my grocery list" |
| **Apple Reminders** | Reminders (macOS) | "Remind me at 3pm" |

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
