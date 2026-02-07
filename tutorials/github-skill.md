# GitHub Skill

Manage GitHub repositories, issues, and pull requests.

## Configuration

Add to your `.env`:
```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

Create a token at: https://github.com/settings/tokens

Required scopes: `repo`, `read:user`

## Capabilities

- List repositories
- Create/read/update issues
- Manage pull requests
- Search code
- View commits and branches

## Examples

### Repository management
```
List my GitHub repositories
```

### Issues
```
Create an issue in myrepo titled "Bug: Login fails" with details about the error
```

```
Close issue #42 in my-project with comment "Fixed in latest release"
```

### Pull requests
```
List open PRs in viralcode/openwhale
```

```
Create a PR from feature/auth to main with description of the changes
```

### Code search
```
Search for "TODO" comments in my repository
```

### Commits
```
Show the last 5 commits on the main branch
```

## Tips

- Works with both personal and org repos
- Fine-grained tokens supported
- Rate limits apply (5000/hour)
- Integrates with Git tool for local operations
