# Docker Management

Manage Docker containers directly from OpenWhale.

## Capabilities

- List containers
- Start/stop containers
- View logs
- Execute commands
- Manage images

## Basic Commands

### List containers
```
Show me all running Docker containers
```

### Container logs
```
Show the last 50 lines of logs from the postgres container
```

### Start/stop
```
Stop the redis container
```

## Examples

### Status check
```
Which containers are running and what ports are they using?
```

### Debugging
```
Why is my nginx container crashing? Show me the logs
```

### Deployment
```
Pull the latest postgres:15 image and run it on port 5432
```

### Cleanup
```
Remove all stopped containers and unused images
```

## Advanced

### Exec into container
```
Run bash in the web-app container and check the /app directory
```

### Resource usage
```
Show CPU and memory usage for all containers
```

### Docker Compose
```
What services are defined in my docker-compose.yml?
```

## Tips

- Docker must be installed and running
- Works with Docker Desktop and raw Docker
- Compose commands supported
- Images can be pulled on demand
