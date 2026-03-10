# Hotspay WireGuard VPN Setup

Connect MikroTik routers to your Hotspay server via secure WireGuard VPN tunnel.

## Network Topology

```
┌─────────────────┐         WireGuard Tunnel         ┌─────────────────┐
│ Hotspay Server  │◄────────────────────────────────►│ MikroTik Router │
│ 10.10.10.1      │         UDP port 51820           │ 10.10.10.x      │
│ 92.113.146.43   │                                   │ LAN: 192.168.x.x│
└─────────────────┘                                   └─────────────────┘
        │                                                      │
        │                                               ┌──────┴──────┐
        │                                               │   Hotspot   │
        └── API Access to router ──────────────────────►│   Users     │
                                                        └─────────────┘
```

## Quick Start

### Step 1: Setup Server (VPS)

```bash
cd ~/hotspay/wireguard/server
sudo bash setup-server.sh
```

This will:
- Install WireGuard
- Generate server keys
- Configure firewall (port 51820/UDP)
- Start WireGuard service

**Save the Server Public Key** displayed at the end!

### Step 2: Create WireGuard Interface on MikroTik

On MikroTik terminal (Winbox or SSH):
```routeros
/interface wireguard add name=wg-hotspay listen-port=13231
/interface wireguard print
```

**Copy the `public-key` value** - you'll need it next.

### Step 3: Add Router to Server

On your VPS:
```bash
cd ~/hotspay/wireguard/server
sudo bash add-router.sh "MyRouter" "ROUTER_PUBLIC_KEY_HERE" "192.168.88.0/24"
```

The script outputs the router's WireGuard IP and configuration commands.

### Step 4: Configure MikroTik Peer

Run these commands on MikroTik (replace with your actual values):

```routeros
# Assign IP to WireGuard interface (use IP from Step 3)
/ip address add address=10.10.10.2/24 interface=wg-hotspay

# Add Hotspay server as peer
/interface wireguard peers add interface=wg-hotspay \
    public-key="SERVER_PUBLIC_KEY_HERE" \
    endpoint-address=92.113.146.43 \
    endpoint-port=51820 \
    allowed-address=10.10.10.0/24 \
    persistent-keepalive=25

# Allow WireGuard UDP traffic
/ip firewall filter add chain=input protocol=udp dst-port=13231 action=accept comment="WireGuard Hotspay"
```

Or import the full script:
```routeros
/import file=mikrotik-wireguard.rsc
```

### Step 5: Verify Connection

**On MikroTik:**
```routeros
/ping 10.10.10.1
/interface wireguard peers print detail
```

**On Server:**
```bash
wg show
ping 10.10.10.2
```

## IP Allocation

| Device | WireGuard IP | LAN Network |
|--------|-------------|-------------|
| Server | 10.10.10.1 | - |
| Router 1 | 10.10.10.2 | 192.168.88.0/24 |
| Router 2 | 10.10.10.3 | 192.168.89.0/24 |
| Router 3 | 10.10.10.4 | 192.168.90.0/24 |

## Files

| File | Purpose |
|------|---------|
| `server/setup-server.sh` | Initial server setup |
| `server/add-router.sh` | Add new router to server |
| `server/wg0.conf` | Server config template |
| `mikrotik/mikrotik-wireguard.rsc` | Full MikroTik setup script |

## Troubleshooting

### No handshake / connection timeout
1. Check server firewall: `sudo ufw status` - port 51820/UDP must be open
2. Verify public keys match on both sides
3. Check endpoint IP is correct

### Handshake OK but can't ping
1. Verify IP addresses are configured correctly
2. Check `AllowedIPs` includes the peer's network

### View status
```bash
# Server
sudo wg show

# MikroTik
/interface wireguard peers print detail
```

### Restart WireGuard
```bash
# Server
sudo systemctl restart wg-quick@wg0

# MikroTik
/interface wireguard disable wg-hotspay
/interface wireguard enable wg-hotspay
```
