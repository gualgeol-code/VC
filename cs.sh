#!/bin/bash

set -e

echo "[1/7] Update system..."
sudo dnf update -y

echo "[2/7] Install EPEL..."
sudo dnf install -y epel-release

echo "[3/7] Install minimal MATE desktop..."
sudo dnf install -y \
    mate-desktop \
    mate-session-manager \
    mate-panel \
    mate-terminal \
    caja \
    marco \
    atril \
    pluma

echo "[4/7] Install X11 dependencies..."
sudo dnf install -y \
    xorg-x11-server-Xorg \
    xorg-x11-xauth \
    xorg-x11-utils \
    xorg-x11-fonts-Type1 \
    wget

echo "[5/7] Download Chrome Remote Desktop..."
wget -q https://dl.google.com/linux/direct/chrome-remote-desktop_current_x86_64.rpm

echo "[6/7] Install Chrome Remote Desktop..."
sudo dnf install -y chrome-remote-desktop_current_x86_64.rpm

echo "[7/7] Configure session..."
echo "exec /usr/bin/mate-session" > ~/.chrome-remote-desktop-session
chmod +x ~/.chrome-remote-desktop-session

# Disable Wayland / GDM (important)
sudo systemctl disable gdm 2>/dev/null || true
sudo systemctl stop gdm 2>/dev/null || true

# Enable CRD service
sudo systemctl enable chrome-remote-desktop@$USER

echo "=========================================="
echo "✅ INSTALLATION COMPLETE"
echo ""
echo "➡ Reboot now:"
echo "   sudo reboot"
echo ""
echo "➡ After reboot, open:"
echo "   https://remotedesktop.google.com/headless"
echo "=========================================="
