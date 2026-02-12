# Built-in Tools

OpenWhale registers **40+ tools** that the AI can use autonomously. You don't need to configure anything — they work out of the box.

All tools are implemented in `src/tools/` and registered in `src/tools/index.ts`.

---

## System & Execution

| Tool | File | What It Does |
|------|------|-------------|
| **exec** | `exec.ts` | Run any shell command on your machine |
| **code_exec** | `code-exec.ts` | Run Python/JavaScript/TypeScript code in a sandbox |
| **system_info** | `system-info.ts` | System diagnostics and monitoring |
| **clipboard** | `clipboard.ts` | Read/write system clipboard |
| **shortcuts** | `apple-shortcuts.ts` | Run Apple Shortcuts (macOS) |
| **location** | `location.ts` | Get current geolocation data |

---

## Files & Data

| Tool | File | What It Does |
|------|------|-------------|
| **file** | `file.ts` | Read, write, list files and directories |
| **git** | `git.ts` | Repository management, commits, branches, PRs |
| **zip** | `zip.ts` | Compress and extract archives |
| **codebase** | `codebase.ts` | Codebase search and analysis |
| **db_query** | `db-query.ts` | SQL database queries (SQLite, PostgreSQL, MySQL) |

---

## Document Creation

| Tool | File | What It Does |
|------|------|-------------|
| **pdf** | `pdf.ts` | Create, read, merge PDFs with text/images/tables |
| **slides** | `slides.ts` | Generate PowerPoint/PDF presentations |
| **spreadsheet** | `spreadsheet.ts` | Create and edit Excel/CSV files |

---

## Web & Browser

| Tool | File | What It Does |
|------|------|-------------|
| **browser** | `browser.ts` | Full web automation via Playwright — navigate, click, type, screenshot |
| **browser_os** | `browser-os.ts` | BrowserOS integration — control your real browser with extensions and logins |
| **web_fetch** | `web-fetch.ts` | Fetch any URL, parse APIs and web pages |

> See [Browser Automation](browser-automation.md) for a detailed comparison of Playwright vs BrowserOS.

---

## Media & Vision

| Tool | File | What It Does |
|------|------|-------------|
| **screenshot** | `screenshot.ts` | Capture your screen, AI analyzes what it sees |
| **camera** | `camera.ts` | Take photos/video from connected cameras |
| **canvas** | `canvas.ts` | Generate and manipulate images |
| **image** | `image.ts` | Analyze and process images with vision |
| **tts** | `tts.ts` | Text-to-speech (AI speaks out loud) |
| **screen_record** | `screen-record-tool.ts` | Record screen activity |
| **qr_code** | `qr-code.ts` | Generate QR codes |

---

## Communication

| Tool | File | What It Does |
|------|------|-------------|
| **email_send** | `email-send.ts` | Send emails via Gmail API |
| **imessage** | `imessage.ts` | Read and send iMessages on macOS |
| **calendar_event** | `calendar-event.ts` | Create calendar events (.ics) |

---

## Infrastructure

| Tool | File | What It Does |
|------|------|-------------|
| **docker** | `docker.ts` | Container management and orchestration |
| **ssh** | `ssh.ts` | Remote server connections and commands |

---

## Memory & Planning

| Tool | File | What It Does |
|------|------|-------------|
| **memory** | `memory.ts` | Remember things across conversations forever |
| **nodes** | `nodes.ts` | Structured data and knowledge graphs |
| **planning** | `planning-tool.ts` | Multi-step task planning |
| **logs** | `logs.ts` | View and search system logs |

---

## Automation

| Tool | File | What It Does |
|------|------|-------------|
| **cron** | `cron.ts` | Schedule tasks to run at specific times |
| **extend** | `extend.ts` | Create self-extensions for automated workflows |
| **skill_creator** | `skill-creator.ts` | Create custom Markdown skills |

> See [Extensions](extensions.md) for more on the self-extension system.

---

## Multi-Agent Coordination

These tools are used by the orchestrator during fan-out operations:

| Tool | File | What It Does |
|------|------|-------------|
| **agents_list** | `agents-list-tool.ts` | List all registered agents |
| **sessions_list** | `sessions-list-tool.ts` | List active sessions |
| **sessions_send** | `sessions-send-tool.ts` | Send messages between sessions |
| **sessions_history** | `sessions-history-tool.ts` | View session message history |
| **sessions_fanout** | `sessions-fanout-tool.ts` | Spawn parallel agent sessions |
| **shared_context_write** | `shared-context-tools.ts` | Write to inter-agent shared context |
| **shared_context_read** | `shared-context-tools.ts` | Read from inter-agent shared context |
| **shared_context_delete** | `shared-context-tools.ts` | Delete from inter-agent shared context |
| **file_lock** | `conflict-tools.ts` | Acquire/release advisory file locks |
| **conflicts** | `conflict-tools.ts` | View and resolve file conflicts |

> See [Multi-Agent Orchestration](multi-agent.md) for details on how these coordination tools work together.
