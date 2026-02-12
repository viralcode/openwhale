# CLI Reference

OpenWhale's CLI (`src/cli.ts`) lets you interact with the system from the terminal.

---

## Running Commands

```bash
# Server mode — runs dashboard, API, and all channels
pnpm run dev

# CLI commands
npm run cli <command>

# Quick chat shortcut
npm run chat
```

---

## Commands

### Chat

```bash
npm run chat                    # Start interactive chat
npm run cli chat                # Same as above
```

Interactive AI chat in the terminal with full tool support.

---

### Providers

```bash
npm run cli providers           # List all configured AI providers and status
```

Shows which providers are active, their available models, and connection status.

---

### Tools

```bash
npm run cli tools               # List all registered tools
```

---

### Channels

```bash
npm run cli channels            # Check messaging channel status
```

---

### Skills

```bash
npm run cli skills              # See skill status (which are active/configured)
```

---

### WhatsApp

```bash
npm run cli whatsapp login      # Scan QR code to connect
npm run cli whatsapp status     # Check connection status
npm run cli whatsapp logout     # Disconnect
```

---

### Browser

```bash
npm run cli browser install     # Auto-install BrowserOS
npm run cli browser status      # Check available backends and status
npm run cli browser use browseros    # Switch to BrowserOS
npm run cli browser use playwright   # Switch to Playwright (default)
npm run cli browser tools       # List available browser automation tools
```

---

### Daemon (Background Service)

```bash
npm run cli daemon install      # Install as system service (launchd on macOS)
npm run cli daemon start        # Start background daemon
npm run cli daemon status       # Check if running
npm run cli daemon stop         # Stop daemon
```

The daemon (`src/daemon/`) runs OpenWhale as a background service using launchd on macOS (`src/daemon/launchd.ts`). It keeps the server running after your terminal closes.

---

### Test

```bash
npm run cli test                # Run CLI tests
```

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run chat` | Quick interactive chat |
| `npm run cli <cmd>` | Run any CLI command |
| `npm run build` | Build TypeScript to dist/ |
| `npm run start` | Run production build |
| `npm run test` | Run tests (Vitest) |
| `npm run lint` | Lint source code (ESLint) |
| `npm run typecheck` | TypeScript type checking |
| `npm run setup` | Install BrowserOS |
| `npm run docker:build` | Build Docker image |
| `npm run docker:up` | Start Docker containers |
| `npm run docker:down` | Stop Docker containers |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Drizzle Studio |
