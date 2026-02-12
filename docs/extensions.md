# Extensions (Self-Extension System)

OpenWhale can extend itself! Create custom automations via chat that persist and run on schedules.

---

## Overview

The AI generates extension code on the fly. Just ask:

- *"Create an extension that checks Bitcoin price every hour and sends it to WhatsApp"*
- *"Make an extension that reminds me to drink water"*
- *"Create a daily standup summary extension"*

Extensions support cron scheduling, multi-channel output, and persist across restarts.

Implementation: `src/tools/extend.ts`, `src/tools/extension-loader.ts`, `src/tools/extension-secrets.ts`

---

## Storage

Extensions are stored as TypeScript files in `~/.openwhale/extensions/`

---

## Extension Structure

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

---

## Managing Extensions

| Action | What It Does |
|--------|-------------|
| `create` | Create a new extension with code and optional schedule |
| `list` | List all extensions |
| `get` | View an extension's code |
| `update` | Modify an extension |
| `delete` | Remove an extension |
| `enable` / `disable` | Toggle an extension on/off |
| `run` | Execute an extension manually |

---

## Scheduled Extensions

Use cron expressions for scheduled execution:

| Expression | Meaning |
|------------|---------|
| `0 9 * * *` | Daily at 9 AM |
| `0 */2 * * *` | Every 2 hours |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `*/30 * * * *` | Every 30 minutes |

---

## Example

```javascript
// Extension code (runs daily)
const response = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
const data = await response.json();
return `Bitcoin price: $${data.data.amount}`;
```

Extensions automatically send their return value to configured channels!

---

## Extension Secrets

Extensions can securely access secrets (API keys, tokens) through the extension secrets system (`src/tools/extension-secrets.ts`). This keeps sensitive data out of extension code.

---

## Hot Loading

The extension loader (`src/tools/extension-loader.ts`) hot-loads persistent extensions at startup, so scheduled extensions resume automatically after a server restart.
