# Desktop Screenshot Skill

A skill for capturing comprehensive desktop screenshots with window detection and management.

## Commands

### `screenshot full`
Capture a full desktop screenshot and send via WhatsApp.

### `screenshot windows`
List all visible windows and their positions before capturing.

### `screenshot app [app_name]`
Capture a specific application window.

### `screenshot region [x1] [y1] [x2] [y2]`
Capture a specific region of the screen.

## Implementation Details

This skill uses macOS screencapture command with various options:
- `-x` - disable sound
- `-t` - specify format (png, jpg, pdf)
- `-R` - capture region (x,y,w,h)
- `-l` - capture window by window ID

## Window Detection

To get visible windows:
```bash
osascript -e 'tell application "System Events" to get name of every process whose visible is true'
```

To get window positions:
```bash
osascript -e 'tell application "System Events" to get properties of windows of processes where visible is true'
```