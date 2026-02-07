# Git Operations

Manage Git repositories from OpenWhale.

## Capabilities

- Clone repositories
- Commit and push changes
- Manage branches
- Create pull requests
- View history

## Basic Commands

### Status
```
What's the git status of my current project?
```

### Commit
```
Commit all changes with message "Add user authentication"
```

### Branch
```
Create a new branch called feature/payments
```

## Examples

### Daily workflow
```
Add all changed files, commit with a good message, and push to origin
```

### Review changes
```
Show me what files changed in the last 5 commits
```

### Branch management
```
List all branches and tell me which ones are merged into main
```

### Conflict resolution
```
I have merge conflicts in app.js, help me resolve them
```

## Advanced

### PR creation
```
Create a pull request from my current branch to main
```

### History search
```
Find the commit where the login function was introduced
```

### Stash management
```
Stash my current changes, switch to main, and then pop the stash
```

## Tips

- Works with any Git remote (GitHub, GitLab, Bitbucket)
- SSH and HTTPS remotes supported
- Credential caching uses your system config
- Integrates with GitHub skill for PR management
