#!/bin/bash

set -e

echo "[1/8] Update system..."
sudo dnf update -y

echo "[2/8] Install EPEL..."
sudo dnf install -y epel-release

echo "[3/8] Install minimal MATE desktop..."
sudo dnf install -y \
    mate-desktop \
    mate-session-manager \
    mate-panel \
    mate-terminal \
    caja \
    marco \
    atril \
    pluma

echo "[4/8] Install X11 dependencies..."
sudo dnf install -y \
    xorg-x11-server-Xorg \
    xorg-x11-xauth \
    xorg-x11-utils \
    xorg-x11-fonts-Type1 \
    wget \
    curl

echo "[5/8] Add Google Chrome Remote Desktop repo..."
sudo tee /etc/yum.repos.d/google-chrome-remote-desktop.repo > /dev/null <<EOF
[google-chrome-remote-desktop]
name=Google Chrome Remote Desktop
baseurl=https://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF

echo "[6/8] Install Chrome Remote Desktop..."
sudo dnf install -y chrome-remote-desktop

echo "[7/8] Configure session..."
echo "exec /usr/bin/mate-session" > ~/.chrome-remote-desktop-session
chmod +x ~/.chrome-remote-desktop-session

# Disable Wayland / GDM
sudo systemctl disable gdm 2>/dev/null || true
sudo systemctl stop gdm 2>/dev/null || true

# Enable CRD service
sudo systemctl enable chrome-remote-desktop@$USER

echo "=========================================="
echo "✅ INSTALLATION COMPLETE"
echo ""
echo "➡ Reboot:"
echo "   sudo reboot"
echo ""
echo "➡ Setup access:"
echo "   https://remotedesktop.google.com/headless"
echo "=========================================="
