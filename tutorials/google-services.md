# Google Services

Access Google Calendar, Gmail, Drive, and Tasks.

## Setup

All Google services use the same credentials. You only need to set this up once.

### Step 1: Create Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services → Library**
4. Enable these APIs:
   - Google Calendar API
   - Gmail API  
   - Google Drive API
   - Google Tasks API
5. Go to **APIs & Services → Credentials**
6. Click **Create Credentials → OAuth client ID**
7. Choose **Web application** type
8. Add authorized redirect URI: `http://localhost:18789/auth/google/callback`
9. Click **Create** and download the JSON

### Step 2: Configure in Dashboard

1. Open **http://localhost:18789/dashboard**
2. Go to **Skills** tab
3. Find any Google skill (Calendar, Gmail, etc.)
4. Click **Configure**
5. **Paste the entire credentials JSON** into the text area
6. Click **Save**
7. Click **Authorize** and complete the Google login

That's it! All Google services will now work.

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

## Troubleshooting

### "Not configured"
Paste your credentials JSON in Dashboard → Skills → [any Google skill].

### "Token expired"
Click **Re-authorize** in the Dashboard to refresh your token.

### "API not enabled"
Go to Google Cloud Console and enable the required API.
