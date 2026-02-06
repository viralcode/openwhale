---
name: computer-use
description: Full desktop computer use for headless Linux servers and VPS. Creates a virtual display (Xvfb + XFCE) to control GUI applications without a physical monitor. Screenshots, mouse clicks, keyboard input, scrolling, dragging — all 17 standard actions. Includes flicker-free VNC setup for live remote viewing. Model-agnostic, works with any LLM.
version: 1.2.0
---

# Computer Use Skill

Full desktop GUI control for headless Linux servers. Creates a virtual display (Xvfb + XFCE) so you can run and control desktop applications on VPS/cloud instances without a physical monitor.

## Environment

- **Display**: `:99`
- **Resolution**: 1024x768 (XGA, Anthropic recommended)
- **Desktop**: XFCE4 (minimal — xfwm4 + panel only)

## Quick Setup

Run the setup script to install everything (systemd services, flicker-free VNC):

```bash
./scripts/setup-vnc.sh
```

This installs:
- Xvfb virtual display on `:99`
- Minimal XFCE desktop (xfwm4 + panel, no xfdesktop)
- x11vnc with stability flags
- noVNC for browser access

All services auto-start on boot and auto-restart on crash.

## Actions Reference

| Action | Script | Arguments | Description |
|--------|--------|-----------|-------------|
| screenshot | `screenshot.sh` | — | Capture screen → base64 PNG |
| cursor_position | `cursor_position.sh` | — | Get current mouse X,Y |
| mouse_move | `mouse_move.sh` | x y | Move mouse to coordinates |
| left_click | `click.sh` | x y left | Left click at coordinates |
| right_click | `click.sh` | x y right | Right click |
| middle_click | `click.sh` | x y middle | Middle click |
| double_click | `click.sh` | x y double | Double click |
| triple_click | `click.sh` | x y triple | Triple click (select line) |
| left_click_drag | `drag.sh` | x1 y1 x2 y2 | Drag from start to end |
| left_mouse_down | `mouse_down.sh` | — | Press mouse button |
| left_mouse_up | `mouse_up.sh` | — | Release mouse button |
| type | `type_text.sh` | "text" | Type text (50 char chunks, 12ms delay) |
| key | `key.sh` | "combo" | Press key (Return, ctrl+c, alt+F4) |
| hold_key | `hold_key.sh` | "key" secs | Hold key for duration |
| scroll | `scroll.sh` | dir amt [x y] | Scroll up/down/left/right |
| wait | `wait.sh` | seconds | Wait then screenshot |
| zoom | `zoom.sh` | x1 y1 x2 y2 | Cropped region screenshot |

## Usage Examples

```bash
export DISPLAY=:99

# Take screenshot
./scripts/screenshot.sh

# Click at coordinates
./scripts/click.sh 512 384 left

# Type text
./scripts/type_text.sh "Hello world"

# Press key combo
./scripts/key.sh "ctrl+s"

# Scroll down
./scripts/scroll.sh down 5
```

## Workflow Pattern

1. **Screenshot** — Always start by seeing the screen
2. **Analyze** — Identify UI elements and coordinates
3. **Act** — Click, type, scroll
4. **Screenshot** — Verify result
5. **Repeat**

## Tips

- Screen is 1024x768, origin (0,0) at top-left
- Click to focus before typing in text fields
- Use `ctrl+End` to jump to page bottom in browsers
- Most actions auto-screenshot after 2 sec delay
- Long text is chunked (50 chars) with 12ms keystroke delay

## Live Desktop Viewing (VNC)

Watch the desktop in real-time via browser or VNC client.

### Connect via Browser

```bash
# SSH tunnel (run on your local machine)
ssh -L 6080:localhost:6080 your-server

# Open in browser
http://localhost:6080/vnc.html
```

### Connect via VNC Client

```bash
# SSH tunnel
ssh -L 5900:localhost:5900 your-server

# Connect VNC client to localhost:5900
```

### SSH Config (recommended)

Add to `~/.ssh/config` for automatic tunneling:

```
Host your-server
  HostName your.server.ip
  User your-user
  LocalForward 6080 127.0.0.1:6080
  LocalForward 5900 127.0.0.1:5900
```

Then just `ssh your-server` and VNC is available.

## System Services

```bash
# Check status
systemctl status xvfb xfce-minimal x11vnc novnc

# Restart if needed
sudo systemctl restart xvfb xfce-minimal x11vnc novnc
```

### Service Chain

```
xvfb → xfce-minimal → x11vnc → novnc
```

- **xvfb**: Virtual display :99 (1024x768x24)
- **xfce-minimal**: Watchdog that runs xfwm4+panel, kills xfdesktop
- **x11vnc**: VNC server with `-noxdamage` for stability
- **novnc**: WebSocket proxy with heartbeat for connection stability

## Opening Applications

```bash
export DISPLAY=:99
google-chrome --no-sandbox &    # Chrome (recommended)
xfce4-terminal &                # Terminal
thunar &                        # File manager
```

**Note**: Snap browsers (Firefox, Chromium) have sandbox issues on headless servers. Use Chrome `.deb` instead:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f
```

## Manual Setup

If you prefer manual setup instead of `setup-vnc.sh`:

```bash
# Install packages
sudo apt install -y xvfb xfce4 xfce4-terminal xdotool scrot imagemagick dbus-x11 x11vnc novnc websockify

# Copy service files
sudo cp systemd/*.service /etc/systemd/system/

# Edit xfce-minimal.service: replace %USER% and %SCRIPT_PATH%
sudo nano /etc/systemd/system/xfce-minimal.service

# Mask xfdesktop (prevents VNC flickering)
sudo mv /usr/bin/xfdesktop /usr/bin/xfdesktop.real
echo -e '#!/bin/bash\nexit 0' | sudo tee /usr/bin/xfdesktop
sudo chmod +x /usr/bin/xfdesktop

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable --now xvfb xfce-minimal x11vnc novnc
```

## Troubleshooting

### VNC shows black screen
- Check if xfwm4 is running: `pgrep xfwm4`
- Restart desktop: `sudo systemctl restart xfce-minimal`

### VNC flickering/flashing
- Ensure xfdesktop is masked (check `/usr/bin/xfdesktop`)
- xfdesktop causes flicker due to clear→draw cycles on Xvfb

### VNC disconnects frequently
- Check noVNC has `--heartbeat 30` flag
- Check x11vnc has `-noxdamage` flag

### x11vnc crashes (SIGSEGV)
- Add `-noxdamage -noxfixes` flags
- The DAMAGE extension causes crashes on Xvfb

## Requirements

Installed by `setup-vnc.sh`:
```bash
xvfb xfce4 xfce4-terminal xdotool scrot imagemagick dbus-x11 x11vnc novnc websockify
```
