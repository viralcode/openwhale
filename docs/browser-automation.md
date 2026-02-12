# Browser Automation

OpenWhale supports **two browser automation backends** — choose based on your needs.

---

## Overview

| Backend | Best For | Source |
|---------|----------|--------|
| **Playwright** (Default) | Simple scraping, headless automation, zero setup | `src/tools/browser.ts` |
| **BrowserOS** (Recommended) | Real browser with your extensions, cookies, and logins | `src/tools/browser-os.ts` |

---

## Playwright (Default)

Built-in headless Chrome browser. Works out of the box.

- ✅ **Zero setup** — just works
- ✅ **Headless** — runs in background
- ✅ **Fast** — optimized for automation
- ❌ No extensions
- ❌ No saved logins/cookies

**Best for:** Simple web scraping, screenshots, form filling

---

## BrowserOS (Recommended for AI Agents)

A real Chrome browser with AI automation superpowers. The AI controls *your* actual browser.

- ✅ **Your extensions** — AdBlock, 1Password, etc. all work
- ✅ **Your logins** — Already signed into sites? AI can use them
- ✅ **Visible browser** — Watch what the AI does in real-time
- ✅ **Privacy-first** — Runs locally, no cloud
- ✅ **Anti-detection** — Looks like a real user, not a bot
- ✅ **Local AI support** — Works with Ollama models
- ✅ **Visual workflows** — See and debug AI actions

**Best for:** Complex tasks, logged-in services, anything requiring real browser behavior

---

## Comparison

| Scenario | Playwright | BrowserOS |
|----------|------------|-----------|
| Scrape public website | ✅ Great | ✅ Great |
| Login to your email | ❌ Need to re-auth | ✅ Use existing session |
| Book a flight | ❌ Often blocked | ✅ Works like real user |
| Use site with 2FA | ❌ Can't handle | ✅ Already authenticated |
| Debug AI actions | ❌ Headless | ✅ Watch in real-time |
| Use adblocker | ❌ No extensions | ✅ All extensions work |

---

## Quick Setup

```bash
# Install BrowserOS automatically
npm run setup

# Or manually
npm run cli browser install

# Check status
npm run cli browser status

# Switch backends
npm run cli browser use browseros   # Use BrowserOS
npm run cli browser use playwright  # Use Playwright (default)
```

---

## Enabling BrowserOS MCP Server

After installing BrowserOS, you need to enable the MCP server for OpenWhale to control it:

1. **Open BrowserOS**
2. **Navigate to** `chrome://browseros/mcp` in the address bar
3. **Enable the MCP server** toggle
4. The MCP server runs at `http://127.0.0.1:9000/mcp` by default

Then verify and switch to BrowserOS:

```bash
# Check if BrowserOS MCP is running
npm run cli browser status

# Should show: BrowserOS ● Running at http://127.0.0.1:9000
#              Tools: 42 available

# Switch to BrowserOS backend
npm run cli browser use browseros

# List available tools
npm run cli browser tools
```

---

## BrowserOS Tools (42)

When using BrowserOS, you get access to 42+ browser automation tools:

- `browser_navigate` — Navigate to URLs
- `browser_click_element` — Click on page elements
- `browser_type_text` — Type text into inputs
- `browser_get_screenshot` — Capture screenshots
- `browser_get_page_content` — Extract page HTML/text
- `browser_execute_javascript` — Run custom JS
- `browser_search_history` — Search browser history
- Plus 35 more for tabs, bookmarks, network, console, etc.
