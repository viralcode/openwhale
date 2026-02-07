# Telegram Bot Integration

Create a Telegram bot that connects to OpenWhale.

## Prerequisites

- Telegram account
- Telegram app installed

## Step 1: Create a Bot

1. Open Telegram
2. Search for **@BotFather**
3. Send `/newbot`
4. Follow prompts to name your bot
5. Copy the **API Token** (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## Step 2: Configure OpenWhale

### Via Dashboard

1. Go to **Channels** tab
2. Find the **Telegram** card
3. Paste your Bot Token
4. Click **Save**

### Via .env File

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
```

## Step 3: Start Chatting

1. Open Telegram
2. Search for your bot's username
3. Press **Start**
4. Send any message!

## Usage Examples

```
Create a QR code for my website https://example.com
```
```
Analyze this image [attach photo]
```
```
What files are in my home directory?
```

## Bot Commands

You can set these in BotFather with `/setcommands`:

```
start - Start the bot
help - Show available commands
status - Show system status
clear - Clear conversation history
```

## Tips

- **Images** are processed with vision AI
- **Documents** (PDFs, images) can be analyzed
- **Voice messages** are transcribed
- Use `/clear` to reset conversation context

## Troubleshooting

### Bot not responding
- Check that the token is correct
- Verify OpenWhale is running
- Check terminal logs for errors

### "Conflict: terminated by other getUpdates request"
Another instance of the bot is running. Kill other OpenWhale processes.
