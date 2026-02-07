# Twitter/X Integration

OpenWhale can monitor and respond to Twitter mentions using cookie-based auth.

## How It Works

Uses the **bird CLI** which authenticates via browser cookies (no API keys needed!).

## Prerequisites

1. **bird CLI** installed: https://github.com/viralcode/bird
2. Twitter/X account logged in via browser

## Step 1: Install bird CLI

```bash
npm install -g bird-cli
```

## Step 2: Export Cookies

```bash
bird auth
```

This exports your browser cookies for Twitter authentication.

## Step 3: Configure OpenWhale

### Via Dashboard

1. Go to **Channels** tab
2. Enable **Twitter** channel
3. Click **Connect**

### Via .env File

```env
TWITTER_ENABLED=true
```

## How It Works

OpenWhale polls for:
- **Mentions** (@your_username)
- **Direct Messages**

When detected, the AI responds automatically.

## Usage

Others tweet at you:
```
@your_username What's the weather in NYC?
```

OpenWhale responds with the answer.

## Posting Tweets

In OpenWhale chat:
```
Post a tweet saying "Hello world from OpenWhale!"
```

## Skill Integration

The Twitter skill provides additional capabilities:
- Search tweets
- Get timeline
- Follow/unfollow users
- Get trending topics

## Tips

- **Rate limits** apply — don't spam tweets
- **Cookie auth** may expire; re-run `bird auth` periodically
- Monitor responses to avoid unintended replies

## Troubleshooting

### "Not authenticated"
Run `bird auth` again to refresh cookies.

### Missing replies
Check polling interval in settings. Default is every 60 seconds.
