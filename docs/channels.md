# Messaging Channels

OpenWhale can send and receive messages through **6 platforms** — unified inbox, one AI brain.

---

## Overview

| Channel | How It Works | Source |
|---------|--------------|--------|
| **WhatsApp** | Scan QR code, uses your personal account | `whatsapp-baileys.ts` |
| **Telegram** | Create a bot with @BotFather | `telegram.ts` |
| **Discord** | Add bot to your server | `discord.ts` |
| **Slack** | Slack app integration | `slack.ts` |
| **Twitter/X** | Auto-reply to mentions via bird CLI (cookie auth, no API!) | `twitter.ts` |
| **iMessage** | macOS native — read and send iMessages via `imsg` CLI | `imessage/` |

All channels share a common AI processor (`src/channels/shared-ai-processor.ts`) so responses are consistent regardless of which platform a message arrives on.

---

## WhatsApp

The easiest to set up — works with your personal WhatsApp account via the Baileys library.

### Via Dashboard
1. Go to `http://localhost:7777/dashboard`
2. Navigate to **Channels → WhatsApp**
3. Click **Connect**
4. Scan the QR code with your phone (WhatsApp → Linked Devices → Link a Device)
5. Done! Messages to your number will be handled by the AI

### Via CLI
```bash
npm run cli whatsapp login    # Shows QR code in terminal
npm run cli whatsapp status   # Check if connected
npm run cli whatsapp logout   # Disconnect
```

Your session is saved in `~/.openwhale/whatsapp-auth/` so you don't need to scan again.

---

## Telegram

1. Create a bot with [@BotFather](https://t.me/botfather) on Telegram
2. Copy the bot token
3. Add to `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=your-bot-token
   ```
4. Restart OpenWhale
5. Message your bot — the AI will respond

---

## Discord

1. Create a bot at [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable **Message Content Intent** under Bot settings
3. Copy the bot token
4. Add to `.env`:
   ```bash
   DISCORD_BOT_TOKEN=your-bot-token
   ```
5. Invite the bot to your server using the OAuth2 URL generator
6. Restart OpenWhale

---

## Slack

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Configure bot permissions and event subscriptions
3. Install the app to your workspace
4. Add to `.env`:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-bot-token
   SLACK_APP_TOKEN=xapp-your-app-token
   ```
5. Restart OpenWhale

---

## Twitter/X

OpenWhale uses the **bird CLI** for Twitter/X integration — no API keys needed! It uses cookie-based authentication.

### Install bird
```bash
# npm (cross-platform)
npm install -g @steipete/bird

# Homebrew (macOS)
brew install steipete/tap/bird
```

### Setup
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

### How It Works
- Polls for mentions every 60 seconds (configurable)
- Auto-replies to mentions using AI
- Can post tweets, reply to threads, and read timelines

> ⚠️ **Note:** Twitter/X may rate-limit or flag automated posting. Use with caution on accounts you care about.

---

## iMessage (macOS only)

OpenWhale can read and send iMessages natively on macOS using the `imsg` CLI.

### Prerequisites
- macOS (iMessage is not available on other platforms)
- Messages.app signed in with your Apple ID
- Full Disk Access granted to your terminal (System Settings → Privacy & Security → Full Disk Access)
- Automation permission for Messages.app

### Install imsg CLI
```bash
brew install steipete/tap/imsg
```

### Via Dashboard
1. Go to `http://localhost:7777/dashboard`
2. Navigate to **Channels**
3. Find the **iMessage** card
4. Click **⬇️ Install imsg CLI** (if not already installed)
5. Click **📱 Connect iMessage**

### What AI Can Do with iMessage
- **List chats** — See your recent iMessage conversations
- **Read messages** — Read message history from any chat
- **Send messages** — Send iMessages to any phone number or email

### Example Prompts
- *"Show me my recent iMessage conversations"*
- *"Read my latest messages from Mom"*
- *"Send an iMessage to +1234567890 saying I'll be there in 10 minutes"*

> ⚠️ **Note:** iMessage requires macOS. On other platforms, the iMessage card will show as unavailable. The connection persists across server restarts.

---

## Architecture

Channels are implemented in `src/channels/`:

| File | Purpose |
|------|---------|
| `base.ts` | Base channel interface |
| `index.ts` | Channel registry, initialization, and lifecycle management |
| `shared-ai-processor.ts` | Shared AI processing pipeline for all channels |
| `whatsapp-baileys.ts` | WhatsApp via Baileys library |
| `whatsapp.ts` | WhatsApp connection management |
| `telegram.ts` | Telegram bot adapter |
| `discord.ts` | Discord bot adapter |
| `slack.ts` | Slack app adapter |
| `twitter.ts` | Twitter/X polling and auto-reply |
| `imessage/` | iMessage integration (macOS native) |
| `web.ts` | Web/dashboard chat channel |
