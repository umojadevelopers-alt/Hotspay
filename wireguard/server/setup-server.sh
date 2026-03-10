#!/bin/bash
# =====================================================
# Hotspay WireGuard Server Setup Script
# For Ubuntu/Debian VPS
# Run as root: sudo bash setup-server.sh
# =====================================================

set -e

echo "=========================================="
echo "  Hotspay WireGuard Server Setup"
echo "=========================================="

# Configuration
WG_INTERFACE="wg0"
WG_PORT=51820
WG_SERVER_IP="10.10.10.1/24"
WG_DIR="/etc/wireguard"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root (sudo bash setup-server.sh)"
    exit 1
fi

# Step 1: Install WireGuard
echo "[1/6] Installing WireGuard..."
apt update
apt install -y wireguard wireguard-tools qrencode

# Step 2: Enable IP forwarding
echo "[2/6] Enabling IP forwarding..."
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# Step 3: Generate server keys
echo "[3/6] Generating WireGuard keys..."
mkdir -p $WG_DIR
chmod 700 $WG_DIR

if [ ! -f "$WG_DIR/server_private.key" ]; then
    wg genkey | tee $WG_DIR/server_private.key | wg pubkey > $WG_DIR/server_public.key
    chmod 600 $WG_DIR/server_private.key
    echo "New keys generated!"
else
    echo "Using existing keys."
fi

SERVER_PRIVATE_KEY=$(cat $WG_DIR/server_private.key)
SERVER_PUBLIC_KEY=$(cat $WG_DIR/server_public.key)

# Step 4: Detect network interface
MAIN_INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
echo "[4/6] Detected main interface: $MAIN_INTERFACE"

# Step 5: Create WireGuard config
echo "[5/6] Creating WireGuard configuration..."
cat > $WG_DIR/$WG_INTERFACE.conf << EOF
[Interface]
# Hotspay WireGuard Server
Address = $WG_SERVER_IP
ListenPort = $WG_PORT
PrivateKey = $SERVER_PRIVATE_KEY

# Enable IP forwarding and NAT
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o $MAIN_INTERFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o $MAIN_INTERFACE -j MASQUERADE

# =====================================================
# ADD MIKROTIK ROUTER PEERS BELOW
# Run: bash add-router.sh <router-name> <router-public-key> <router-lan>
# =====================================================

EOF

chmod 600 $WG_DIR/$WG_INTERFACE.conf

# Step 6: Configure firewall
echo "[6/6] Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow $WG_PORT/udp comment "WireGuard"
    ufw reload 2>/dev/null || true
fi

# Enable and start WireGuard
systemctl enable wg-quick@$WG_INTERFACE
systemctl start wg-quick@$WG_INTERFACE || systemctl restart wg-quick@$WG_INTERFACE

echo ""
echo "=========================================="
echo "  WireGuard Server Setup Complete!"
echo "=========================================="
echo ""
echo "Server Public Key (copy this to MikroTik routers):"
echo ""
echo "  $SERVER_PUBLIC_KEY"
echo ""
echo "Server Endpoint:"
echo "  $(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP"):$WG_PORT"
echo ""
echo "To add a router peer, use:"
echo "  bash add-router.sh <name> <public-key> <lan-network>"
echo ""
echo "Example:"
echo "  bash add-router.sh MainRouter ABC123key== 192.168.88.0/24"
echo ""
echo "Check WireGuard status: wg show"
echo "==========================================" 
