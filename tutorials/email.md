# Email Sending

Send emails via SMTP.

## Configuration

Add to your `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### Gmail Setup
1. Enable 2FA on your Google account
2. Create App Password: https://myaccount.google.com/apppasswords
3. Use the app password in SMTP_PASS

## Basic Commands

### Simple email
```
Send an email to john@example.com with subject "Meeting Tomorrow" and body about the 2pm meeting
```

### With formatting
```
Send a professional email to the team about our Q4 goals
```

## Examples

### Report delivery
```
Generate a sales report PDF and email it to manager@company.com
```

### Notifications
```
Send an email alert about the server status check results
```

### Bulk emails
```
Send personalized emails to all contacts in contacts.csv
```

## Tips

- HTML formatting supported
- Attachments can be included
- CC/BCC supported
- Rate limiting recommended for bulk sends
