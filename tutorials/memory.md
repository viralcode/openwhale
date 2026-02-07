# Persistent Memory

Store and recall information across conversations.

## How It Works

OpenWhale has a memory system that persists across sessions. Memory is stored locally in SQLite.

## Basic Commands

### Store memory
```
Remember that my project deadline is March 15th
```

### Recall memory
```
What did I tell you about my project deadline?
```

### List memories
```
What things do you remember about me?
```

## Examples

### Preferences
```
Remember that I prefer dark mode and use VS Code
```

### Context
```
Remember that when I say "deploy", I mean push to production on heroku
```

### Notes
```
Remember: Server password is in 1Password under "Production Server"
```

## Automatic Memory

OpenWhale also learns from conversations:
- Your tech stack
- Common commands you use
- Project preferences
- Communication style

## Memory Categories

| Type | Example |
|------|---------|
| Facts | "Remember my birthday is May 5" |
| Preferences | "I prefer TypeScript over JavaScript" |
| Context | "When I say 'client', I mean Acme Corp" |
| Procedures | "To deploy, I run ./deploy.sh" |

## Managing Memory

### Clear specific
```
Forget what I told you about the deadline
```

### Clear all
```
Clear all your memories about me
```

## Tips

- Memory persists across restarts
- Stored in `.openwhale/memory.db`
- Searchable and categorized
- Privacy: all local, nothing sent externally
