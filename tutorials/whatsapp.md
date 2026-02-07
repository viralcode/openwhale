# WhatsApp Integration

Connect your personal WhatsApp account to OpenWhale via QR code.

## How It Works

OpenWhale uses **Baileys** (an unofficial WhatsApp Web API) to connect. Your messages are processed locally — no data is sent to third-party servers.

## Setup

### Via Dashboard

1. Go to **http://localhost:18789/dashboard**
2. Click **Channels** in sidebar
3. Find the **WhatsApp** card
4. Click **Connect**
5. Scan the QR code with your phone's WhatsApp app

### Via CLI

```bash
npm start
# Then type: connect whatsapp
```

## Usage

Once connected, you can message your OpenWhale number (your own number):

**Example prompts to send via WhatsApp:**
```
What's the weather in New York?
```
```
Create a PDF summary of my last meeting notes
```
```
Take a screenshot of google.com
```

## Tips

- **First message** greets you with available capabilities
- **Images** are processed with vision AI
- **Voice notes** are transcribed automatically
- **Group chats** can trigger the AI using mentions

## Reconnecting

If WhatsApp disconnects:
1. Go to Dashboard → Channels
2. Click **Disconnect** then **Connect**
3. Re-scan the QR code

## Troubleshooting

### QR Code doesn't appear
```bash
# Delete WhatsApp auth folder and restart
rm -rf .openwhale-whatsapp-auth
npm run dev
```

### "Already Connected" error
Your session is cached. Logout from Dashboard first.

### Rate limiting
WhatsApp may rate-limit if too many messages are sent quickly. Add delays between bulk operations.
