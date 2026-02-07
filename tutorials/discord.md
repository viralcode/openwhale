# Discord Bot Integration

Add an AI assistant to your Discord server.

## Step 1: Create a Discord App

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it (e.g., "OpenWhale")
4. Go to **Bot** section
5. Click **Add Bot**
6. Copy the **Token**

## Step 2: Set Permissions

In the Bot section, enable:
- ✅ **Message Content Intent** (required!)
- ✅ Send Messages
- ✅ Read Message History
- ✅ Attach Files

## Step 3: Invite to Server

1. Go to **OAuth2 → URL Generator**
2. Select scopes: `bot`, `applications.commands`
3. Select permissions: Send Messages, Read Message History, Attach Files
4. Copy the generated URL
5. Open it and add to your server

## Step 4: Configure OpenWhale

### Via Dashboard

1. Go to **Channels** tab
2. Find **Discord** card
3. Paste the Bot Token
4. Click **Save**

### Via .env File

```env
DISCORD_BOT_TOKEN=your-bot-token-here
```

## Usage

Mention the bot or DM it:

```
@OpenWhale What's the weather?
```
```
@OpenWhale Create a summary of this PDF
```

## Tips

- **Mentions** are required in servers (or DM the bot)
- **Images** and **files** are processed automatically
- Bot responds in the same channel

## Troubleshooting

### Bot is offline
- Verify token is correct
- Check that Message Content Intent is enabled
- Restart OpenWhale

### "Missing Permissions"
Re-invite the bot with proper permissions.

### Not responding to messages
Ensure **Message Content Intent** is enabled in Developer Portal.
