# Getting Started with OpenWhale

This guide will help you install and run OpenWhale for the first time.

## Prerequisites

- **Node.js 18+** (recommended: 20+)
- **npm** or **pnpm**
- macOS, Linux, or Windows

## Installation

```bash
# Clone the repository
git clone https://github.com/viralcode/openwhale.git
cd openwhale

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## Configuration

Edit your `.env` file with at least one AI provider:

```env
# Required: At least one AI provider
ANTHROPIC_API_KEY=your-key-here
# OR
OPENAI_API_KEY=your-key-here
# OR
GOOGLE_API_KEY=your-key-here
```

## Running OpenWhale

### Option 1: Web Dashboard
```bash
npm run dev
```

Then open **http://localhost:18789/dashboard**

Default login:
- Username: `admin`
- Password: `123456`

> ⚠️ Change the default password immediately in Settings!

### Option 2: CLI Mode
```bash
npm start
```

This opens an interactive CLI where you can chat directly with the AI.

## First Commands

Try these in the chat:

1. **Check system status:**
   ```
   What tools are available?
   ```

2. **Test file access:**
   ```
   List the files in my current directory
   ```

3. **Test browser:**
   ```
   Open google.com and take a screenshot
   ```

4. **Test memory:**
   ```
   Remember that my favorite color is blue
   ```

## Next Steps

- [Configure AI Providers](ai-providers.md)
- [Connect WhatsApp](whatsapp.md)
- [Connect Telegram](telegram.md)
- [Learn about browser automation](browser-automation.md)

## Troubleshooting

### Port already in use
```bash
# Kill the process using port 18789
lsof -i :18789 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### SQLite errors
```bash
# Rebuild native modules
npm rebuild better-sqlite3
```

### Node version issues
```bash
# Check Node version
node -v

# Should be 18+ for OpenWhale
```
