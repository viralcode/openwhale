# SSH Connections

Connect to remote servers and run commands.

## Capabilities

- Connect to SSH servers
- Execute remote commands
- Transfer files
- Manage connections

## Basic Commands

### Run command
```
SSH into server.example.com and check disk usage
```

### Server status
```
Check if nginx is running on my production server
```

### File operations
```
List files in /var/log on server.example.com
```

## Examples

### Monitoring
```
SSH to all my servers and report memory usage
```

### Deployment
```
Connect to production, pull latest code, and restart the app
```

### Log analysis
```
Get the last 100 lines of error logs from the web server
```

### Maintenance
```
Update packages on my Ubuntu server
```

## Configuration

SSH uses your `~/.ssh/config` for host configurations:

```
Host prod
  HostName server.example.com
  User deploy
  IdentityFile ~/.ssh/deploy_key
```

Then:
```
SSH to prod and run uptime
```

## Tips

- Uses system SSH config
- Key-based auth recommended
- Connection pooling for speed
- Timeouts are configurable
