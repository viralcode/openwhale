#!/bin/bash
# Setup stable VNC for computer-use skill
# Run once to install systemd services for flicker-free VNC desktop

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="$SKILL_DIR/systemd"
USER=$(whoami)

echo "=== Computer Use VNC Setup ==="
echo "User: $USER"
echo "Skill dir: $SKILL_DIR"
echo ""

# Install packages
echo "[1/6] Installing packages..."
sudo apt update -qq
sudo apt install -y xvfb xfce4 xfce4-terminal xdotool scrot imagemagick dbus-x11 x11vnc novnc websockify xdotool

# Copy minimal-desktop.sh to a stable location
echo "[2/6] Installing watchdog script..."
sudo mkdir -p /opt/computer-use
sudo cp "$SCRIPT_DIR/minimal-desktop.sh" /opt/computer-use/
sudo chmod +x /opt/computer-use/minimal-desktop.sh

# Install systemd services (with variable substitution)
echo "[3/6] Installing systemd services..."
sudo cp "$SYSTEMD_DIR/xvfb.service" /etc/systemd/system/

# xfce-minimal needs path and user substitution
sed "s|%USER%|$USER|g; s|%SCRIPT_PATH%|/opt/computer-use|g" "$SYSTEMD_DIR/xfce-minimal.service" | sudo tee /etc/systemd/system/xfce-minimal.service > /dev/null

sudo cp "$SYSTEMD_DIR/x11vnc.service" /etc/systemd/system/
sudo cp "$SYSTEMD_DIR/novnc.service" /etc/systemd/system/

# Mask xfdesktop to prevent flickering
echo "[4/6] Masking xfdesktop (prevents flicker)..."
if [ -f /usr/bin/xfdesktop ] && [ ! -f /usr/bin/xfdesktop.real ]; then
    sudo mv /usr/bin/xfdesktop /usr/bin/xfdesktop.real
    echo '#!/bin/bash
# Masked - xfdesktop causes VNC flickering on Xvfb
exit 0' | sudo tee /usr/bin/xfdesktop > /dev/null
    sudo chmod +x /usr/bin/xfdesktop
    echo "  xfdesktop masked (original at /usr/bin/xfdesktop.real)"
else
    echo "  xfdesktop already masked or not found"
fi

# Enable and start services
echo "[5/6] Enabling services..."
sudo systemctl daemon-reload
sudo systemctl enable xvfb xfce-minimal x11vnc novnc

echo "[6/6] Starting services..."
sudo systemctl start xvfb
sleep 2
sudo systemctl start xfce-minimal
sleep 3
sudo systemctl start x11vnc
sleep 1
sudo systemctl start novnc

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Services running:"
systemctl is-active xvfb xfce-minimal x11vnc novnc | paste - - - - | awk '{print "  xvfb: "$1"  xfce-minimal: "$2"  x11vnc: "$3"  novnc: "$4}'
echo ""
echo "Access VNC:"
echo "  1. SSH tunnel: ssh -L 6080:localhost:6080 $(hostname)"
echo "  2. Open: http://localhost:6080/vnc.html"
echo ""
echo "Or add to ~/.ssh/config:"
echo "  Host $(hostname)"
echo "    LocalForward 6080 127.0.0.1:6080"
