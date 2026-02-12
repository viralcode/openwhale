# macOS Native App

OpenWhale includes a native macOS menu bar app built with SwiftUI. It gives you quick access to chat, status, and controls without opening a browser.

---

## Features

- **Menu Bar Popover** — Quick chat, connection status, and channel toggles from the menu bar
- **Full Chat Window** — Dedicated chat interface with tool call display, Markdown rendering, and streaming responses
- **Dashboard Matching UI** — Tool calls show as expandable chips with live status (spinner → ✓)
- **System Integration** — Runs as a proper macOS app with custom icon

---

## Prerequisites

- **macOS 14+** (Sonoma or later)
- **Swift 5.9+** — Comes with Xcode 15+
- **OpenWhale server running** — The app connects to `http://localhost:7777`

---

## Build & Run

```bash
cd OpenwhaleMacApp

# Build and launch
bash build.sh && open .build/OpenWhale.app
```

---

## Install to Applications

```bash
cp -R .build/OpenWhale.app /Applications/
```

> 💡 **Tip:** The app auto-connects to the local OpenWhale server. Make sure the server is running (`npm run dev`) before launching.

---

## Installer

A guided SwiftUI installer that sets up everything automatically — clones the repo, installs dependencies, starts the server, configures providers/channels/skills, and installs the menu bar app.

```bash
cd OpenwhaleMacApp/Installer
bash build.sh
open .build/OpenWhaleInstaller.app
```

---

## Source

The macOS app lives in `OpenwhaleMacApp/` at the project root:

```
OpenwhaleMacApp/
├── Views/
│   └── Pages/         # ChatPage, etc.
├── Models/
│   └── AppState.swift # App state management
├── Services/
│   └── OpenWhaleClient.swift  # API client
├── Installer/         # SwiftUI installer app
└── build.sh           # Build script
```
