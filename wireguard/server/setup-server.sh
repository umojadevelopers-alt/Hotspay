#!/bin/bash
# -----------------------------------------------
# WireGuard Server Setup Script for Ubuntu
# -----------------------------------------------

set -e

echo "==> Updating system..."
apt update && apt upgrade -y

echo "==> Installing WireGuard..."
apt install -y wireguard wireguard-tools

echo "==> Generating server keys..."
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
chmod 600 /etc/wireguard/server_private.key

SERVER_PRIVATE_KEY=$(cat /etc/wireguard/server_private.key)
SERVER_PUBLIC_KEY=$(cat /etc/wireguard/server_public.key)

echo ""
echo "==> Server Public Key (add this to MikroTik peer):"
echo "$SERVER_PUBLIC_KEY"
echo ""

echo "==> Enabling IP forwarding..."
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
sysctl --system

echo "==> Writing WireGuard config..."
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.0.0.1/30
ListenPort = 51820
PrivateKey = ${SERVER_PRIVATE_KEY}

PostUp = sysctl -w net.ipv4.ip_forward=1; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# [Peer] - MikroTik will be added after you get its public key
# [Peer]
# PublicKey = MIKROTIK_PUBLIC_KEY
# AllowedIPs = 10.0.0.2/32, 192.168.88.0/24
EOF

chmod 600 /etc/wireguard/wg0.conf

echo "==> Starting WireGuard..."
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

echo ""
echo "==> Done! WireGuard is running."
echo "==> Remember to add the MikroTik public key as a [Peer] in /etc/wireguard/wg0.conf"
echo "==> Then run: systemctl restart wg-quick@wg0"
