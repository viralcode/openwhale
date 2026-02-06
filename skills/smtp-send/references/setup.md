# SMTP Configuration Guide

## Setup Methods

You can configure SMTP credentials in two ways:

### Method 1: Config File (Recommended)

Create `~/.smtp_config` with your SMTP settings:

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

### Method 2: Environment Variables

Set these environment variables:

```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
export SMTP_FROM="your-email@gmail.com"
export SMTP_USE_SSL="false"
```

Environment variables override the config file if both are present.

## Common SMTP Providers

### Gmail

**Settings:**
- Host: `smtp.gmail.com`
- Port: `587` (TLS) or `465` (SSL)
- Use SSL: `false` for 587, `true` for 465

**Important:** You must use an App Password, not your regular Gmail password:
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Step Verification if not already enabled
3. Go to [App Passwords](https://myaccount.google.com/apppasswords)
4. Generate a new app password for "Mail"
5. Use this 16-character password in your config

### Outlook/Office 365

**Settings:**
- Host: `smtp.office365.com`
- Port: `587`
- Use SSL: `false`
- User: Your full Outlook email address
- Password: Your Outlook password

### Yahoo Mail

**Settings:**
- Host: `smtp.mail.yahoo.com`
- Port: `587` (TLS) or `465` (SSL)
- Use SSL: `false` for 587, `true` for 465
- User: Your full Yahoo email address
- Password: App password (not regular password)

Generate Yahoo app password:
1. Go to [Yahoo Account Security](https://login.yahoo.com/account/security)
2. Generate app password
3. Use this password in your config

### QQ Mail (腾讯邮箱)

**Settings:**
- Host: `smtp.qq.com`
- Port: `587` (TLS) or `465` (SSL)
- Use SSL: `false` for 587, `true` for 465
- User: Your QQ email address
- Password: Authorization code (授权码, not QQ password)

Get QQ authorization code:
1. Login to QQ Mail web interface
2. Go to Settings → Accounts
3. Enable POP3/SMTP service
4. Generate authorization code
5. Use this code as password

### 163 Mail (网易邮箱)

**Settings:**
- Host: `smtp.163.com`
- Port: `465` (SSL recommended)
- Use SSL: `true`
- User: Your 163 email address
- Password: Authorization code (not 163 password)

Get 163 authorization code:
1. Login to 163 Mail web interface
2. Go to Settings → POP3/SMTP/IMAP
3. Enable SMTP service
4. Generate authorization code

## Port Selection

- **Port 587 (TLS/STARTTLS)**: Standard submission port, requires `use_ssl: false`
- **Port 465 (SSL/TLS)**: Legacy SSL port, requires `use_ssl: true`
- **Port 25**: Usually blocked by ISPs, not recommended

## Troubleshooting

**Authentication failed:**
- Check if you're using an app password (not regular password) for Gmail/Yahoo
- Verify username is correct (usually full email address)
- Check if 2FA/less secure apps setting is enabled

**Connection timeout:**
- Verify the host and port are correct
- Check firewall/network restrictions
- Try switching between port 587 and 465

**"SMTP AUTH extension not supported":**
- Make sure you're using the correct port
- Try switching `use_ssl` setting

**Gmail "Username and Password not accepted":**
- You must use App Password, not your Google account password
- Ensure 2-Step Verification is enabled first
