# Email Sending

Send emails via Gmail API (not SMTP).

## Setup

Email uses your Google credentials - the same ones used for Calendar, Drive, etc.

1. Go to **Dashboard → Skills → Gmail**
2. Paste your Google credentials JSON
3. Complete the OAuth authorization

> **Note**: OpenWhale uses Gmail API, not SMTP. You need Google OAuth configured.

## Basic Commands

### Simple email
```
Send an email to john@example.com with subject "Meeting Tomorrow" and body about the 2pm meeting
```

### With HTML formatting
```
Send a professional HTML email to the team about our Q4 goals
```

## Examples

### Report delivery
```
Generate a sales report PDF and email it to manager@company.com
```

### With attachments
```
Email the quarterly-report.pdf to finance@company.com with subject "Q4 Report"
```

### Notifications
```
Send an email alert about the server status check results
```

## Supported Features

- HTML and plain text emails
- CC and BCC recipients
- File attachments
- Automatic formatting

## Tips

- Uses your Gmail account (the one you authorized)
- Attachments can be any local file
- HTML formatting supported for professional emails
- Rate limits apply (Gmail API quotas)

## Troubleshooting

### "Gmail not configured"
Set up Google OAuth in the Dashboard → Skills → Gmail section first.

### "Invalid credentials"
Re-paste your credentials JSON and re-authorize.
