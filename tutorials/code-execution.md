# Code Execution

Run Python, JavaScript, and TypeScript code directly.

## Supported Languages

| Language | Runtime |
|----------|---------|
| Python | System Python (3.x) |
| JavaScript | Node.js |
| TypeScript | ts-node |

## Basic Commands

### Run Python
```
Calculate the factorial of 20 using Python
```

### Run JavaScript
```
Run this JS: console.log(Array.from({length: 10}, (_, i) => i * i))
```

### Data analysis
```
Read sales.csv and calculate the total revenue using Python pandas
```

## Examples

### Quick calculations
```
What's 2^100 in Python?
```

### Data processing
```
Parse this JSON and extract all email addresses:
{"users": [{"email": "a@b.com"}, {"email": "c@d.com"}]}
```

### API testing
```
Write Python to call the JSONPlaceholder API and fetch 5 posts
```

### Algorithm implementation
```
Implement quicksort in Python and sort [3,1,4,1,5,9,2,6]
```

## Package Usage

### Python
```
Use matplotlib to create a line chart of [1,4,2,5,3] and save it
```

### JavaScript
```
Use axios to fetch data from the GitHub API
```

## Tips

- Code runs in a **sandboxed environment**
- Output is captured and returned
- Files can be created/read during execution
- Errors are caught and explained

## Working Directory

Code executes in `.openwhale-temp/` by default.

Files created there can be accessed:
```
Run Python to create a report.csv, then read it
```

## Safety

- No system modification without approval
- Network access is allowed
- File system access is scoped
- Infinite loops are terminated after timeout
