# Heartbeat (Proactive Agent)

The AI wakes up periodically to check on things — you don't have to ask.

---

## How It Works

1. A `node-cron` scheduler fires at your chosen interval (default: every 30 minutes)
2. The AI reads `~/.openwhale/HEARTBEAT.md` if it exists for task context
3. It runs a full agent turn with tool access — can check inboxes, run commands, etc.
4. If nothing needs attention, it replies `HEARTBEAT_OK` (suppressed, you won't see it)
5. If something needs your attention, the alert appears in your dashboard chat

Implementation: `src/heartbeat/`

---

## Setup

From the Dashboard:
1. Go to **Settings**
2. Find the **💓 Heartbeat** card
3. Check **Enable Heartbeat**
4. Choose your interval, model, and active hours
5. Click **Save Heartbeat Settings**

---

## HEARTBEAT.md

Create `~/.openwhale/HEARTBEAT.md` with tasks for the AI to monitor:

```markdown
# Heartbeat Tasks

- [ ] Check if the staging server is still running
- [ ] Look for new GitHub issues on my repo
- [ ] Remind me about the meeting at 3pm
```

The AI reads this file every heartbeat tick and acts on it. If the file is empty or only has headers, the tick is skipped to save API calls.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| **Enabled** | Off | Toggle heartbeat on/off |
| **Interval** | 30m | 5m, 10m, 15m, 30m, 1h, 2h |
| **Model** | Default | Use a cheaper model to save costs |
| **Active Hours** | Always | e.g., 08:00–24:00 to skip overnight |
| **Custom Prompt** | (built-in) | Override the default heartbeat instructions |

---

## Smart Suppression

When the AI has nothing to report, it responds with `HEARTBEAT_OK`. These replies are automatically suppressed so you only see alerts when something actually needs your attention. This keeps your dashboard clean and saves you from notification fatigue.
