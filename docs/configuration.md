# Configuration

All settings go in `.env` at the project root. Most settings can also be configured from the dashboard.

---

## Server

```bash
# Port and host
GATEWAY_PORT=7777
GATEWAY_HOST=0.0.0.0
```

---

## Database

SQLite by default (zero-config). PostgreSQL available for production/multi-instance setups.

```bash
# SQLite (default)
DATABASE_URL=file:./data/openwhale.db

# PostgreSQL (optional)
DATABASE_URL=postgresql://user:pass@localhost:5432/openwhale
```

Implementation: `src/db/` using [Drizzle ORM](https://orm.drizzle.team/) for type-safe database access.

### Database Commands

```bash
npm run db:generate   # Generate migration files
npm run db:migrate    # Run migrations
npm run db:studio     # Open Drizzle Studio (visual DB explorer)
```

---

## Security

```bash
# JWT secret — CHANGE THIS in production!
JWT_SECRET=change-me-to-something-random-at-least-32-chars

# Security mode
SECURITY_MODE=local    # 'local' for dev, 'strict' for production
```

See [Security](security.md) for full details.

---

## AI Providers

```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
DASHSCOPE_API_KEY=...
DEEPSEEK_API_KEY=...
GROQ_API_KEY=...
TOGETHER_API_KEY=...
OLLAMA_HOST=http://localhost:11434
```

See [Providers](providers.md) for full details.

---

## Messaging Channels

```bash
# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# Discord
DISCORD_BOT_TOKEN=your-bot-token

# Slack
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token

# Twitter/X
TWITTER_ENABLED=true
TWITTER_POLL_INTERVAL=60000
```

See [Channels](channels.md) for full setup instructions.

---

## Skills

```bash
# GitHub
GITHUB_TOKEN=ghp_your_token

# Notion
NOTION_API_KEY=secret_your_key

# Weather
OPENWEATHERMAP_API_KEY=your_key

# 1Password
OP_CONNECT_TOKEN=your_connect_token
OP_CONNECT_HOST=http://localhost:8080

# Spotify
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Trello
TRELLO_API_KEY=your_key
TRELLO_TOKEN=your_token
```

See [Skills](skills.md) for full details.

---

## Logging

```bash
LOG_LEVEL=info    # debug, info, warn, error
```

---

## Dashboard Settings

> 💾 Most settings can be configured from the dashboard at **Settings**. Dashboard settings are saved to the database and take priority over `.env` values for provider keys, channel configs, and skill configurations.
