# Google Services

Access Google Calendar, Gmail, Drive, and Tasks.

## Setup

### Step 1: Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project or select existing
3. Enable APIs: Calendar, Gmail, Drive, Tasks
4. Create OAuth 2.0 credentials (Desktop app type)
5. Download the JSON credentials

### Step 2: Configure OpenWhale

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:18789/auth/google/callback
```

Or place `credentials.json` in the OpenWhale root.

### Step 3: Authenticate

1. Open Dashboard → Skills → Google Calendar
2. Click **Connect**
3. Complete the OAuth flow in browser

## Google Calendar

```
What's on my calendar today?
```

```
Schedule a meeting with John tomorrow at 2pm for 1 hour
```

```
Find a free slot this week for a 30-minute meeting
```

## Gmail

```
Show my unread emails
```

```
Search for emails from boss@company.com this week
```

```
Send an email to team@company.com about the project update
```

## Google Drive

```
List files in my Drive root folder
```

```
Upload report.pdf to my "Work" folder
```

```
Download the Q4 Report from Drive
```

## Google Tasks

```
What tasks do I have due today?
```

```
Add a task: "Review proposal" due Friday
```

```
Mark the "Send invoice" task as complete
```

## Tips

- OAuth tokens are cached locally
- Refresh tokens auto-renew
- Scopes are minimal by default
- All data stays local
