# File Operations

Read, write, and manage files on your system.

## Capabilities

- Read any file
- Write/create files
- List directories
- Search for files
- Move/copy/delete

## Basic Commands

### Read a file
```
Read the contents of ~/Documents/notes.txt
```

### Write a file
```
Create a file called todo.md with my shopping list: milk, eggs, bread
```

### List directory
```
What files are in my Downloads folder?
```

### Search files
```
Find all PDF files in my Documents folder
```

## Examples

### Code review
```
Read my package.json and tell me what dependencies I have
```

### File organization
```
List all files larger than 100MB in my home directory
```

### Backup
```
Copy my important-doc.pdf to the backup folder
```

### Cleanup
```
Find and list all .log files older than 30 days
```

## Working with Code

```
Read src/index.ts and explain what it does
```

```
Add error handling to the function in utils.js
```

## Tips

- **Relative paths** resolve from OpenWhale's working directory
- **Home directory** can be referenced with `~`
- Binary files (images, PDFs) are handled separately
- Large files are chunked for processing

## Safety

OpenWhale asks for confirmation before:
- Deleting files
- Overwriting existing files
- Modifying system files

## Troubleshooting

### "Permission denied"
Check file permissions or run with elevated privileges.

### Large file errors
Files over 10MB may be truncated. Use targeted reads:
```
Read lines 1-100 of that large log file
```
