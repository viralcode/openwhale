# iMessage Integration (macOS)

Read and send iMessages directly from OpenWhale on macOS.

## Requirements

- **macOS only** (Sonoma 14+ recommended)
- **imsg CLI** installed
- Full Disk Access permission

## Step 1: Install imsg CLI

```bash
# Using Homebrew
brew tap viralcode/tap
brew install imsg
```

Or build from source: https://github.com/viralcode/imsg

## Step 2: Grant Permissions

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Add **Terminal** (or your terminal app)
3. Add **imsg** binary

## Step 3: Configure OpenWhale

### Via Dashboard

1. Go to **Channels** tab
2. Enable **iMessage** channel

### Via .env File

```env
IMESSAGE_ENABLED=true
```

## How It Works

OpenWhale:
1. Polls your iMessage database for new messages
2. Processes incoming messages with AI
3. Sends responses back via iMessage

## Usage

Send yourself an iMessage:
```
What's my schedule for today?
```

OpenWhale reads, processes, and responds via iMessage.

## In Chat

You can also send iMessages from OpenWhale:
```
Send an iMessage to John saying "Running 10 minutes late"
```

## Tips

- **Group chats** are supported (mention-based trigger)
- **Images** received can be analyzed with vision
- Response times depend on polling interval (default: 5 seconds)

## Troubleshooting

### "Permission denied"
Grant Full Disk Access to Terminal and imsg.

### Messages not detected
```bash
# Test imsg directly
imsg list
```

### Sending fails
Ensure Messages.app is configured and signed in with your iCloud account.
