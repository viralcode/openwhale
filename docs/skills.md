# Skills

OpenWhale has two types of skills: **API Skills** (external service integrations with API keys) and **Markdown Skills** (community-built knowledge files).

---

## API Skills

API skills connect OpenWhale to external services. They need API keys to work and are implemented in `src/skills/`.

### GitHub

Manage repos, issues, pull requests, and commits.

```bash
GITHUB_TOKEN=ghp_your_token
```
Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

**Source:** `src/skills/github.ts`

---

### Notion

Search, create, and update pages and databases.

```bash
NOTION_API_KEY=secret_your_key
```
Create an integration at [notion.so/my-integrations](https://www.notion.so/my-integrations).

**Source:** `src/skills/notion.ts`

---

### Google Services (Calendar, Gmail, Drive, Tasks)

All Google integrations use a single OAuth flow.

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Calendar, Gmail, Drive, and Tasks APIs
3. Create OAuth credentials (Desktop app)
4. Download `credentials.json` to `~/.openwhale/google/credentials.json`
5. Run OpenWhale and visit the Google auth URL shown in logs
6. Authorize access — tokens are saved automatically

**Source:** `src/integrations/google/`

---

### Weather

Current conditions and forecasts.

```bash
OPENWEATHERMAP_API_KEY=your_key
```
Get a free key at [openweathermap.org](https://openweathermap.org/api).

**Source:** `src/skills/weather.ts`

---

### Twitter/X

Full Twitter integration using cookie-based auth — no API keys needed!

| Tool | Description |
|------|-------------|
| `twitter_timeline` | Get your home timeline |
| `twitter_mentions` | Get tweets mentioning you |
| `twitter_post` | Post a new tweet |
| `twitter_reply` | Reply to a tweet |
| `twitter_search` | Search for tweets |
| `twitter_user` | Get info about a user |
| `twitter_follow` | Follow a user |
| `twitter_bookmarks` | Get your bookmarked tweets |

Requires the `bird` CLI installed separately. See [Channels → Twitter/X](channels.md#twitterx) for setup.

**Source:** `src/skills/twitter.ts`

---

### Spotify

Control playback, search music, manage playlists.

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```
Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard).

**Source:** `src/skills/spotify.ts`

---

### Trello

Manage boards, lists, and cards.

```bash
TRELLO_API_KEY=your_key
TRELLO_TOKEN=your_token
```
Get keys at [trello.com/app-key](https://trello.com/app-key).

**Source:** `src/skills/trello.ts`

---

### 1Password

Securely fetch passwords and secrets.

```bash
OP_CONNECT_TOKEN=your_connect_token
OP_CONNECT_HOST=http://localhost:8080
```
Requires [1Password Connect](https://developer.1password.com/docs/connect/) server.

**Source:** `src/skills/onepassword.ts`

---

### Apple Notes & Reminders (macOS only)

Works automatically on Mac — no config needed. The AI can read/write your Notes and Reminders.

**Source:** `src/skills/apple.ts`

---

### ElevenLabs

Text-to-speech with high-quality AI voices.

**Source:** `src/skills/elevenlabs.ts`

---

### Twilio

SMS and voice call integration.

**Source:** `src/skills/twilio.ts`

---

## Markdown Skills (OpenClaw Community)

OpenWhale includes **50+ community-built skills** from the [OpenClaw](https://github.com/VoltAgent/awesome-openclaw-skills) project. These are `SKILL.md` files that give the AI specialized knowledge and capabilities.

### Location
Skills are stored in `skills/` in the repo (or `~/.openwhale/skills/`).

Loaded by `src/skills/markdown-loader.ts` which parses SKILL.md frontmatter and content.

### Available Skills (50+)

| Category | Skills |
|----------|--------|
| **Frontend** | `frontend-design`, `ui-ux-master`, `ui-ux-pro-max`, `human-optimized-frontend`, `ui-design-system`, `deliberate-frontend-redesign` |
| **Backend** | `backend-patterns`, `senior-fullstack`, `nextjs-expert`, `vercel-react-best-practices` |
| **Integrations** | `slack`, `discord`, `github`, `zoho-email-integration`, `telegram-reaction-prober` |
| **AI/Video** | `computer-use`, `comfyui-runner`, `comfy-ai`, `remotion-video-toolkit`, `vision-sandbox` |
| **Platform** | `apple-hig`, `xcodebuildmcp`, `linux-service-triage`, `niri-ipc` |
| **Productivity** | `resume-builder`, `react-email-skills`, `artifacts-builder`, `giphy` |

### Managing Skills

From the Dashboard:
1. Go to **Skills** → **MD Skills** tab
2. View all 50+ installed skills
3. Click **Edit** to view or modify any skill

### Credits
Skills are sourced from [VoltAgent/awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) — a community collection for AI assistants.
