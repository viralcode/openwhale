# Troubleshooting

Common issues and their fixes.

---

## `better-sqlite3` bindings error

```
Error: Could not locate the bindings file.
```

This happens when using `npm` instead of `pnpm`, or when native modules weren't built properly.

**Fix:**
```bash
# Remove existing node_modules
rm -rf node_modules package-lock.json

# Use pnpm instead
pnpm install
pnpm approve-builds   # Select all packages when prompted
pnpm run dev
```

---

## Docker build fails with "pnpm-lock.yaml is absent"

Make sure you pulled the latest version of the repository which includes the lockfile:

```bash
git pull origin main
```

---

## Native module build errors on macOS

Some packages (like `better-sqlite3`, `node-llama-cpp`) require Xcode Command Line Tools:

```bash
xcode-select --install
```

---

## Port already in use

If you see `EADDRINUSE` errors, the server tries to automatically kill processes on the port. If that fails:

```bash
# Find what's using the port
lsof -ti:7777

# Kill it
kill -9 <PID>
```

---

## WhatsApp QR code not appearing

1. Make sure no other WhatsApp Web session is interfering
2. Try `npm run cli whatsapp logout` first, then `npm run cli whatsapp login`
3. Clear the auth folder: `rm -rf ~/.openwhale/whatsapp-auth/`

---

## iMessage not working

1. **macOS only** — iMessage is not available on other platforms
2. Ensure **Full Disk Access** is granted to your terminal (System Settings → Privacy & Security → Full Disk Access)
3. Ensure `imsg` CLI is installed: `brew install steipete/tap/imsg`
4. Make sure Messages.app is signed in with your Apple ID

---

## Twitter/X mentions not being detected

1. Verify `bird` CLI is installed: `bird check`
2. Test authentication: `bird whoami`
3. Ensure cookies are fresh — log into Twitter/X in your browser
4. Check `.env` has `TWITTER_ENABLED=true`

---

## Ollama models not loading

1. Make sure Ollama is running: `ollama serve`
2. Verify the host in `.env`:
   ```bash
   OLLAMA_HOST=http://localhost:11434
   ```
3. Pull a model: `ollama pull llama3`

---

## Vector memory not working

The local embedding model (~300MB) downloads automatically on first use. If it fails:

1. Check you have enough disk space
2. Ensure `node-llama-cpp` is properly installed: `pnpm approve-builds`
3. Fall back to OpenAI or Gemini embeddings by setting the corresponding API key

---

## Dashboard shows blank page

1. Check the server is running at the correct port
2. Try a hard refresh (`Cmd+Shift+R`)
3. Clear browser cache for localhost
4. Check the terminal for server errors
