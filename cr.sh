#!/bin/bash

set -e

echo "[1/8] Update system..."
sudo dnf update -y

echo "[2/8] Install EPEL..."
sudo dnf install -y epel-release

echo "[3/8] Install MATE Desktop (lightweight)..."
sudo dnf install -y \
    mate-desktop \
    mate-session-manager \
    mate-panel \
    mate-terminal \
    caja \
    marco \
    atril \
    pluma

echo "[4/8] Install TigerVNC & noVNC..."
sudo dnf install -y \
    tigervnc-server \
    novnc \
    python3-websockify

echo "[5/8] Configure VNC session..."
mkdir -p ~/.vnc

cat <<EOF > ~/.vnc/xstartup
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec mate-session &
EOF

chmod +x ~/.vnc/xstartup

echo "[6/8] Set VNC password"
vncpasswd

echo "[7/8] Start VNC server (:1)"
vncserver -create :1

echo "[8/8] Start noVNC web server (port 6080)"
nohup websockify --web=/usr/share/novnc/ 6080 localhost:5901 >/dev/null 2>&1 &

# Firewall
sudo firewall-cmd --add-port=6080/tcp --permanent
sudo firewall-cmd --add-port=5901/tcp --permanent
sudo firewall-cmd --reload

echo "=========================================="
echo "✅ noVNC READY"
echo ""
echo "🌐 Access via browser:"
echo "   http://<SERVER-IP>:6080"
echo ""
echo "🔐 VNC Password = password yang kamu buat"
echo "=========================================="
