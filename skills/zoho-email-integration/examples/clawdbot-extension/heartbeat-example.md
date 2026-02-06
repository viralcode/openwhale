# Zoho Email Integration with Clawdbot Heartbeat

This guide shows how to integrate the zoho-email skill with Clawdbot's heartbeat/cron system for automated email briefings.

## Quick Start: Morning Email Summary

Add this to your Clawdbot heartbeat configuration:

```bash
# In your Clawdbot config or cron job (every day at 7:00 AM)
python3 /path/to/zoho-email/scripts/clawdbot_extension.py summary
```

This will output something like:
```
📭 No unread emails
```

Or if you have unread messages:
```
📧 3 unread emails
```

## Integration Example 1: Morning Briefing (Cron)

Create a cron job that includes email status in your morning briefing:

```bash
#!/bin/bash
# morning-briefing.sh - Add to your cron scheduler

# Get email summary
EMAIL_SUMMARY=$(python3 /path/to/zoho-email/scripts/clawdbot_extension.py summary)

# Build briefing
BRIEFING="🌅 Good Morning!

$EMAIL_SUMMARY

🌤️ Weather: [your weather command here]
✅ Tasks: [your tasks command here]
"

# Send to Clawdbot messaging system
# (adjust based on your Clawdbot configuration)
echo "$BRIEFING" | clawdbot send-to-telegram
```

Then schedule with cron:
```bash
0 7 * * * /path/to/morning-briefing.sh
```

## Integration Example 2: Email Monitoring (Heartbeat Loop)

Create a script that runs every 5 minutes and alerts on new unread emails:

```bash
#!/bin/bash
# email-monitor.sh

STATE_FILE="/tmp/email-unread-count"
CURRENT=$(python3 /path/to/zoho-email/scripts/clawdbot_extension.py unread | grep -oP '\d+(?= message)')

if [ -f "$STATE_FILE" ]; then
  PREVIOUS=$(cat "$STATE_FILE")
  if [ "$CURRENT" -gt "$PREVIOUS" ]; then
    NEW_COUNT=$((CURRENT - PREVIOUS))
    echo "🔔 $NEW_COUNT new email(s)" | clawdbot send-to-telegram
  fi
fi

echo "$CURRENT" > "$STATE_FILE"
```

Schedule with cron:
```bash
*/5 * * * * /path/to/email-monitor.sh
```

## Integration Example 3: Clawdbot Cron Job (Native)

If you're using Clawdbot's native cron system:

```yaml
# In your Clawdbot cron config
jobs:
  - name: morning-email-summary
    schedule:
      kind: cron
      expr: "0 7 * * *"  # 7 AM daily
      tz: UTC
    payload:
      kind: systemEvent
      text: "📧 Email status: "  # Triggered message
```

Then in your Clawdbot session, add a handler:
```python
import subprocess

def handle_email_check(message):
    result = subprocess.run(
        ['python3', '/path/to/scripts/clawdbot_extension.py', 'summary'],
        capture_output=True,
        text=True
    )
    return result.stdout.strip()
```

## Integration Example 4: Search Monitoring

Monitor for specific keywords and alert when found:

```bash
#!/bin/bash
# alert-on-invoice.sh

SEARCH_QUERY="invoice"
LAST_CHECK="/tmp/email-invoice-check"

python3 /path/to/zoho-email/scripts/clawdbot_extension.py search "$SEARCH_QUERY" > /tmp/invoice-search.txt

# Compare with previous result
if [ -f "$LAST_CHECK" ]; then
  if ! diff -q "$LAST_CHECK" /tmp/invoice-search.txt > /dev/null; then
    echo "📬 New invoice email found!" | clawdbot send-to-telegram
  fi
fi

cp /tmp/invoice-search.txt "$LAST_CHECK"
```

## Integration Example 5: Bulk Action (Cleanup)

Combine with Clawdbot for scheduled email cleanup:

```bash
#!/bin/bash
# weekly-cleanup.sh - Run every Sunday

echo "🧹 Email cleanup starting..."

# Mark old newsletters as read
python3 /path/to/zoho-email/scripts/zoho_email.py bulk-action \
  --folder INBOX \
  --search 'SUBJECT "newsletter"' \
  --action mark-read \
  --dry-run

echo "✅ Cleanup complete"
```

## Environment Setup

Make sure these are set before any command:

```bash
export ZOHO_EMAIL="your-email@domain.com"

# Option A: OAuth2 (recommended)
export ZOHO_TOKEN_FILE="~/.clawdbot/zoho-mail-tokens.json"

# Option B: App password
export ZOHO_PASSWORD="your-app-password"
```

## Clawdbot Command Handler Integration

If you want `/email` commands to work directly in Telegram/Discord:

1. **Copy the extension handler to your Clawdbot skills:**
   ```bash
   cp examples/clawdbot-extension/email_command.py \
      ~/.clawdbot/skills/email_command.py
   ```

2. **Register in Clawdbot config:**
   ```yaml
   skills:
     email:
       enabled: true
       handler: email_command.handle_email_command
   ```

3. **Now use in Telegram/Discord:**
   ```
   /email unread
   /email search invoice
   /email send user@example.com "Subject" "Body"
   ```

## Testing

Test the extension without Clawdbot:

```bash
# Check unread count
python3 scripts/clawdbot_extension.py unread

# Search emails
python3 scripts/clawdbot_extension.py search "invoice"

# Verify setup
python3 scripts/clawdbot_extension.py doctor

# Get help
python3 scripts/clawdbot_extension.py help
```

## Troubleshooting

### Command times out
- Check if ZOHO_EMAIL is set correctly
- Verify OAuth2 tokens are fresh: `python3 scripts/oauth-setup.py`
- Check connectivity: `python3 scripts/zoho_email.py doctor`

### Permission denied
- Make scripts executable: `chmod +x scripts/*.py`
- Check file permissions in heartbeat scripts

### Output format issues
- The extension outputs plain text by default
- For structured data, use JSON output from the main script

## Real-World Example: Complete Morning Briefing

```bash
#!/bin/bash
# morning-briefing.sh

set -e
cd /path/to/zoho-email

# Export credentials
source ~/.clawdbot/credentials.sh

# Build briefing
cat << EOF
🌅 **Morning Briefing** — $(date '+%A, %B %d')

📧 **Email Status**
$(python3 scripts/clawdbot_extension.py summary)

🌤️ **Weather**
$(curl -s "wttr.in/London?format=3")

✅ **To-Do List**
- Build Morning Briefing System
- Update GitHub documentation

🖥️ **Server Health**
Disk: $(df -h / | tail -1 | awk '{print $5}' $1)

---
Generated at $(date '+%H:%M %Z')
EOF
```

Then schedule:
```bash
0 7 * * * /path/to/morning-briefing.sh | clawdbot send-to-telegram
```

## Next Steps

- ✅ [Set up OAuth2](../OAUTH2_SETUP.md) for REST API mode
- 📚 [Full SKILL.md documentation](../SKILL.md)
- 🚀 [Additional examples](.)

