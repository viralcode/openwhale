# Self-Extensibility

OpenWhale can create its own extensions and automations.

## How It Works

The AI can write code that becomes part of its own toolset. These extensions persist and can be triggered by schedule or conditions.

## Creating Extensions

### Simple automation
```
Create an extension that checks my emails every morning at 8am and summarizes them
```

### Monitoring
```
Create an extension that monitors server.example.com and alerts me if it goes down
```

### Scheduled reports
```
Create an extension that generates a weekly sales summary every Monday at 9am
```

## Extension Types

| Type | Description |
|------|-------------|
| **Scheduled** | Runs on a cron schedule |
| **Triggered** | Runs when conditions are met |
| **On-demand** | Runs when explicitly called |

## Management

### List extensions
```
What extensions do I have installed?
```

### Disable
```
Disable the daily email summary extension
```

### Delete
```
Remove the server monitoring extension
```

## Examples

### Daily standup prep
```
Create an extension that every morning:
1. Checks my calendar for meetings
2. Gets unread Slack messages
3. Summarizes yesterday's GitHub activity
```

### Smart notifications
```
Create an extension that monitors my inbox and alerts me immediately 
when I get an email from my boss or containing "urgent"
```

### Data pipeline
```
Create an extension that every hour:
1. Fetches data from the API
2. Processes it with Python
3. Updates the dashboard spreadsheet
```

## Technical Details

Extensions are stored in `extensions/` folder as JavaScript/TypeScript files.

Structure:
```
extensions/
  daily-summary/
    extension.json    # Metadata
    handler.ts        # Extension code
```

## Tips

- Extensions have full tool access
- Use cron syntax for schedules
- Test before enabling
- Monitor logs for errors
