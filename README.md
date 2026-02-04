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
- **Use any model** — Claude, GPT-4, DeepSeek, Groq, Ollama, you name it. Switch whenever you want.
- **Runs anywhere** — Docker, bare metal, your Raspberry Pi. Whatever works for you.
- **Actually secure** — JWT auth, API keys, rate limiting, audit logs. The boring stuff that matters.

## Getting Started

```bash
# Clone it
git clone https://github.com/yourname/openwhale.git
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

## What can it do?

### Chat with any model
Talk to Claude, GPT-4, DeepSeek, or Groq through one unified interface. Switch models mid-conversation if you want.

### Message people for you
Connect WhatsApp, Telegram, Discord, or Slack. Have the AI respond to messages, send notifications, or just handle your DMs while you're busy.

### Use real tools
- 📁 Read and write files
- 💻 Execute code and shell commands
- 🌐 Browse the web and take screenshots
- 📅 Manage calendars and tasks
- 🎵 Control Spotify
- 📝 Interact with Notion, Trello, GitHub
- 🔐 Fetch secrets from 1Password
- ...and more

### Skills system
Modular skills for different services. GitHub, Gmail, Calendar, Weather — each skill handles authentication and gives the AI new abilities.

## Configuration

Put your API keys in `.env`:

```bash
# Pick your AI providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=...
GROQ_API_KEY=...
GOOGLE_API_KEY=...

# Auth
JWT_SECRET=your-secret-here-at-least-32-characters

# Database (SQLite works great for starters)
DATABASE_URL=file:./data/openwhale.db

# Optional: Use PostgreSQL instead
# DATABASE_URL=postgresql://user:pass@localhost:5432/openwhale
```

## CLI

The CLI is where the magic happens:

```bash
# Start an interactive chat
npm run chat

# Check your setup
npm run cli providers  # See which AI providers are connected
npm run cli tools      # List available tools
npm run cli channels   # Check messaging channels

# Connect WhatsApp
npm run cli whatsapp login   # Scan the QR code
npm run cli whatsapp status  # Check connection
```

## API

OpenWhale exposes an OpenAI-compatible API, so you can plug it into existing tools:

```bash
# Chat completion
curl -X POST http://localhost:18789/api/agent/chat/completions \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

There's also a dashboard at `http://localhost:18789/dashboard` for managing users, API keys, and seeing what's going on.

## Project Structure

```
src/
├── agents/      # Multi-agent routing
├── auth/        # JWT, API keys, sessions
├── channels/    # WhatsApp, Telegram, Discord, Slack
├── cli.ts       # Interactive terminal interface
├── dashboard/   # Web admin panel
├── db/          # SQLite/PostgreSQL with Drizzle
├── gateway/     # Hono-based HTTP API
├── providers/   # Anthropic, OpenAI, DeepSeek, Groq, Ollama
├── security/    # Rate limiting, RBAC, audit logs
├── skills/      # GitHub, Notion, Spotify, Calendar, etc.
├── sessions/    # Persistent conversation history
└── tools/       # File, browser, code execution, screenshots
```

## Contributing

PRs welcome! If you find a bug or have an idea, open an issue. Keep it friendly.

## License

MIT — do whatever you want with it.

---

<p align="center">
  <sub>Made with ☕ and questionable sleep schedules</sub>
</p>
