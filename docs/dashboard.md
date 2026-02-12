# Dashboard

OpenWhale comes with a web dashboard for managing everything without touching the terminal.

---

## Access

**URL:** `http://localhost:7777/dashboard`

Implementation: `src/dashboard/`

---

## Features

| Feature | Description |
|---------|-------------|
| **Chat** | Talk to the AI with full tool support, streaming responses, and tool call display |
| **Channels** | Connect/disconnect WhatsApp, Telegram, Discord, iMessage by scanning QR codes or adding tokens |
| **Providers** | Add and manage AI API keys for all 8 providers |
| **Skills** | Enable/disable API skills and browse Markdown skills |
| **Agents** | View agents, coordination panel with shared contexts and active locks |
| **Message History** | See all conversations across channels |
| **Extensions** | Manage self-extensions and scheduled automations |
| **Settings** | Configure heartbeat, security, and system preferences |
| **System Monitor** | Check connected channels, active sessions, audit logs |

---

## Setup Wizard

First time running? The dashboard walks you through:

1. Checking prerequisites (Node, Python, FFmpeg)
2. Adding your AI provider keys
3. Connecting messaging channels
4. Enabling skills

---

## Authentication

The dashboard is protected by JWT-based authentication.

### Default Credentials

```
Username: admin
Password: admin
```

> ⚠️ **Change the default password** after first login!

### Features

- Session-based auth with 7-day expiry
- Admin can create additional users
- Password change in Settings
- Logout button in sidebar

Implementation: `src/auth/`

---

## Dashboard Routes

The dashboard is served via Hono routes (`src/dashboard/routes.ts`) with static files for the frontend.

Configuration data (provider keys, channel settings, skill configs) is persisted in the SQLite database and loaded at startup via `loadConfigsFromDB()`.
