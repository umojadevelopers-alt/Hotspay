#!/bin/bash
# =====================================================
# Add MikroTik Router to WireGuard Server
# Usage: bash add-router.sh <router-name> <public-key> <lan-network>
# Example: bash add-router.sh MainRouter ABC123== 192.168.88.0/24
# =====================================================

set -e

WG_CONF="/etc/wireguard/wg0.conf"

# Validate arguments
if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <router-name> <public-key> [lan-network]"
    echo ""
    echo "Example:"
    echo "  $0 MainRouter ABC123publickey== 192.168.88.0/24"
    echo ""
    echo "Get router public key from MikroTik:"
    echo "  /interface wireguard print"
    exit 1
fi

ROUTER_NAME="$1"
PUBLIC_KEY="$2"
LAN_NETWORK="${3:-}"

# Get next available IP
LAST_IP=$(grep -oP 'AllowedIPs = 10\.10\.10\.\K[0-9]+' $WG_CONF 2>/dev/null | sort -n | tail -1)
if [ -z "$LAST_IP" ]; then
    NEXT_IP=2
else
    NEXT_IP=$((LAST_IP + 1))
fi

ROUTER_WG_IP="10.10.10.$NEXT_IP/32"

# Build AllowedIPs
if [ -n "$LAN_NETWORK" ]; then
    ALLOWED_IPS="$ROUTER_WG_IP, $LAN_NETWORK"
else
    ALLOWED_IPS="$ROUTER_WG_IP"
fi

echo "Adding router: $ROUTER_NAME"
echo "  WireGuard IP: 10.10.10.$NEXT_IP"
echo "  AllowedIPs: $ALLOWED_IPS"

# Add peer to config
cat >> $WG_CONF << EOF

[Peer]
# Router: $ROUTER_NAME
PublicKey = $PUBLIC_KEY
AllowedIPs = $ALLOWED_IPS
PersistentKeepalive = 25
EOF

# Reload WireGuard without restarting
wg syncconf wg0 <(wg-quick strip wg0)

echo ""
echo "Router added successfully!"
echo ""
echo "Configure MikroTik router with these settings:"
echo "================================================"
echo "WireGuard IP for router: 10.10.10.$NEXT_IP/24"
echo "Server endpoint: $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):51820"
echo "Server public key: $(cat /etc/wireguard/server_public.key)"
echo "Allowed addresses: 10.10.10.0/24"
echo "================================================"
echo ""
echo "MikroTik commands:"
echo "/interface wireguard peers add interface=wg-hotspay \\"
echo "    public-key=\"$(cat /etc/wireguard/server_public.key)\" \\"
echo "    endpoint-address=$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP') \\"
echo "    endpoint-port=51820 \\"
echo "    allowed-address=10.10.10.0/24 \\"
echo "    persistent-keepalive=25"
echo ""
echo "/ip address add address=10.10.10.$NEXT_IP/24 interface=wg-hotspay"
