---
name: giphy-gif
description: Search and send contextual GIFs from Giphy in Discord conversations. Use when the user wants to react with a GIF, express emotions with a GIF, or when you determine a GIF would enhance the conversation (celebrations, reactions, emotions, humor). Triggers on requests like "send a GIF", "show me a GIF", or when context suggests a GIF reaction would be appropriate.
---

# Giphy GIF Search

This skill enables searching for and sending contextually appropriate GIFs from Giphy's library in Discord conversations.

## Setup

Before using this skill, you need a Giphy API key:

1. Go to [Giphy Developers Dashboard](https://developers.giphy.com/dashboard/)
2. Sign up or log in
3. Create a new app (select "API" not "SDK")
4. Copy your API key
5. Add to OpenClaw config or set environment variable: `export GIPHY_API_KEY="your-api-key-here"`

### OpenClaw Config (Recommended)

Add to `~/.openclaw/openclaw.json`:
```json
{
  "skills": {
    "entries": {
      "giphy-gif": {
        "apiKey": "your-api-key-here"
      }
    }
  }
}
```

## Usage

### Search and Send a GIF

Use this one-liner to search and get a Giphy URL:

```bash
# Basic search
exec("QUERY='excited'; API_KEY=$(jq -r '.skills.entries.\"giphy-gif\".apiKey // env.GIPHY_API_KEY' ~/.openclaw/openclaw.json 2>/dev/null || echo \"$GIPHY_API_KEY\"); curl -s \"https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=$(printf '%s' \"$QUERY\" | jq -sRr @uri)&limit=1&rating=g\" | jq -r '.data[0].url // empty'")
```

### Practical Example

```bash
# 1. Define your search query
query="happy dance"

# 2. Get GIF URL using the helper function below
gif_url=$(exec("QUERY='$query'; API_KEY=$(jq -r '.skills.entries.\"giphy-gif\".apiKey // env.GIPHY_API_KEY' ~/.openclaw/openclaw.json 2>/dev/null || echo \"$GIPHY_API_KEY\"); curl -s \"https://api.giphy.com/v1/gifs/search?api_key=${API_KEY}&q=$(printf '%s' \"$QUERY\" | jq -sRr @uri)&limit=1&rating=g\" | jq -r '.data[0].url // empty'"))

# 3. Send to Discord
message(action="send", message=gif_url)
```

### Simplified Helper Command

For easier use, create this helper in your commands:

```bash
# Function to search GIF (copy this pattern)
search_gif() {
  local query="$1"
  local api_key
  
  # Try OpenClaw config first, then env var
  api_key=$(jq -r '.skills.entries."giphy-gif".apiKey // empty' ~/.openclaw/openclaw.json 2>/dev/null)
  [[ -z "$api_key" ]] && api_key="$GIPHY_API_KEY"
  
  if [[ -z "$api_key" ]]; then
    echo "Error: GIPHY_API_KEY not configured" >&2
    return 1
  fi
  
  # URL encode and search
  local encoded_query=$(printf '%s' "$query" | jq -sRr @uri)
  curl -s "https://api.giphy.com/v1/gifs/search?api_key=${api_key}&q=${encoded_query}&limit=1&rating=g&lang=en" | jq -r '.data[0].url // empty'
}

# Usage:
# gif_url=$(search_gif "excited")
# message(action="send", message="$gif_url")
```

### Discord Auto-Embed

When you send a Giphy URL to Discord, it will automatically embed as an animated GIF. No additional steps needed.

## When to Use

Send GIFs in these situations:

- **User requests**: "send me a GIF", "show me something funny"
- **Celebrations**: achievements, good news, milestones
- **Reactions**: surprise, shock, agreement, disagreement
- **Emotions**: happy, sad, excited, confused, thinking
- **Humor**: to lighten the mood or add comedic timing
- **Emphasis**: to reinforce a point with visual impact

## Context-Aware Sending

Be thoughtful about when to send GIFs to maintain natural conversation flow:

- **Direct requests**: Always send when explicitly asked
- **GIF exchange initiated by user**: If the user sends a GIF, match naturally 1-2 times, then resume normal chat
- **Standalone reactions**: Only for significant moments (big celebrations, major news, strong emotional beats)
- **Normal conversation**: Default to text responses; GIFs should be occasional spice, not the main dish
- **Topic shift**: If conversation moves to serious/informational topics, return to text-only mode

**Goal**: Make GIF usage feel natural and contextual, not automatic or overwhelming.

## Best Practices

1. **Match the context**: Choose search terms that match the conversation tone
2. **Keep it appropriate**: The script uses 'g' rating (safe for work) by default
3. **Don't overuse**: GIFs are most effective when used sparingly
4. **Search terms matter**: Use specific, descriptive terms for better results
   - Good: "celebration dance", "facepalm reaction", "mind blown"
   - Poor: "thing", "stuff", "it"
5. **Read the room**: If the conversation becomes more serious or informational, stick to text

## Common Search Terms

- Reactions: `thumbs up`, `facepalm`, `eye roll`, `shocked`, `confused`
- Emotions: `excited`, `happy`, `sad`, `angry`, `love`, `crying`
- Actions: `dance`, `clap`, `wave`, `thinking`, `working`
- Celebrations: `party`, `celebrate`, `success`, `winner`
- Humor: `funny`, `lol`, `wtf`, `awkward`, `fail`

## Technical Details

- API: Giphy v1
- Rate limits: 
  - Beta keys: 100 requests per hour
  - Production keys: Higher limits available
- Response format: Giphy page URLs (Discord auto-embeds)
- Dependencies: `bash`, `curl`, `jq` (standard on Linux/macOS/WSL)
- Default rating: 'g' (safe for work)
- API key priority: OpenClaw config → Environment variable

## API Key Tiers

- **Beta Key** (Free): 100 requests/hour, good for personal use
- **Production Key**: Higher limits, requires approval for specific use cases

Get started with a free beta key at [developers.giphy.com](https://developers.giphy.com/).

## Troubleshooting

**"Unauthorized" error:**
- Check API key is set correctly in `~/.openclaw/openclaw.json` or `$GIPHY_API_KEY`
- Verify key is valid at Giphy dashboard

**No GIF returned:**
- Try a different search term
- Check API rate limits (100/hour for beta keys)

**jq not found:**
- Install jq: `sudo apt install jq` (Linux) or `brew install jq` (macOS)
