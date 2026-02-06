---
name: smtp-send
description: Send emails via SMTP with support for plain text, HTML, and attachments. Use when the user asks to send an email, email someone, or compose and send a message. Supports single recipients and can include file attachments. Works with Gmail, Outlook, Yahoo, QQ Mail, 163 Mail, and any SMTP server.
---

# SMTP Send

Send emails via SMTP with support for text, HTML formatting, and file attachments. Works with Gmail, Outlook, Yahoo, QQ Mail, 163 Mail, and any SMTP server.

## Quick Start

Send a simple email:

```bash
python3 scripts/send_email.py \
  --to recipient@example.com \
  --subject "Meeting Tomorrow" \
  --body "Hi, let's meet at 2pm tomorrow."
```

Send HTML email:

```bash
python3 scripts/send_email.py \
  --to recipient@example.com \
  --subject "Weekly Report" \
  --body "<h1>Report</h1><p>Here are the updates...</p>" \
  --html
```

Send with attachments:

```bash
python3 scripts/send_email.py \
  --to recipient@example.com \
  --subject "Documents" \
  --body "Please find the attached files." \
  --attachments report.pdf,data.csv
```

## Setup

**One-time configuration required.** Create `~/.smtp_config`:

```json
{
  "host": "smtp.gmail.com",
  "port": 587,
  "user": "your-email@gmail.com",
  "password": "your-app-password",
  "from": "your-email@gmail.com",
  "use_ssl": false
}
```

**For Gmail users:** Must use App Password (not regular password). See [setup.md](references/setup.md) for detailed instructions on generating app passwords for Gmail, Yahoo, QQ Mail, 163 Mail, and other providers.

Alternatively, use environment variables (see [setup.md](references/setup.md)).

## Parameters

- `--to`: Recipient email address (required)
- `--subject`: Email subject line (required)
- `--body`: Email body content (required)
- `--html`: Send as HTML email (optional flag)
- `--attachments`: Comma-separated file paths (optional)

## Common Patterns

### User provides recipient and content

When the user says "email john@example.com about the meeting," extract the recipient and compose appropriate subject/body.

### User provides only content

If the user says "send an email saying the report is ready" without specifying a recipient, ask who to send it to.

### File attachments

When the user mentions "attach the file" or "send the document," use `--attachments` with the file path. Multiple files can be separated by commas.

### HTML formatting

Use `--html` when the user wants formatted content (headings, lists, emphasis) or explicitly asks for HTML email.

## Error Handling

**Missing config**: If `~/.smtp_config` not found and environment variables not set, the script will print an example config and exit. Guide the user to create the config file with their SMTP settings.

**Authentication failed**: Usually means incorrect password or need to use app password. Direct user to [setup.md](references/setup.md) for provider-specific instructions.

**Missing attachments**: Script warns but continues sending email without that attachment.

**Connection timeout**: Check SMTP host/port settings or network connectivity.

## Security

- Credentials stored in `~/.smtp_config` (file permissions should be 600)
- Or use environment variables for better security
- App passwords recommended over regular passwords
- Config file should not be committed to version control
