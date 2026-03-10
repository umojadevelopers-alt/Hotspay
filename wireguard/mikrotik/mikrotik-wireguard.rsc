# -----------------------------------------------
# MikroTik WireGuard Client Configuration
# RouterOS v7.x+ (WireGuard requires v7+)
# 
# Connect your MikroTik router to Hotspay Server
# Server: hotspay.vps.webdock.cloud (92.113.146.43)
# -----------------------------------------------

# ======= CONFIGURATION - CHANGE THESE VALUES =======
:local wgInterfaceName "wg-hotspay"
:local wgListenPort 13231
:local wgClientIP "10.10.10.2/24"
:local serverPublicKey "SERVER_PUBLIC_KEY_HERE"
:local serverEndpoint "92.113.146.43"
:local serverPort 51820
:local hotspotNetwork "192.168.88.0/24"
# ===================================================

# Step 1: Generate WireGuard keys on router (run manually first to get public key)
# /interface wireguard print
# Copy the public-key and send to server admin

# Step 2: Create WireGuard interface
/interface wireguard
add name=$wgInterfaceName listen-port=$wgListenPort comment="Hotspay VPN Tunnel"

# Step 3: Get the generated public key (note this for server config)
:local pubKey [/interface wireguard get $wgInterfaceName public-key]
:put "Router Public Key: $pubKey"
:put "Send this key to your Hotspay server admin!"

# Step 4: Assign IP to WireGuard interface
/ip address
add address=$wgClientIP interface=$wgInterfaceName comment="Hotspay WG IP"

# Step 5: Add WireGuard Peer (Hotspay Server)
/interface wireguard peers
add interface=$wgInterfaceName \
    public-key=$serverPublicKey \
    endpoint-address=$serverEndpoint \
    endpoint-port=$serverPort \
    allowed-address=10.10.10.0/24 \
    persistent-keepalive=25 \
    comment="Hotspay Server"

# Step 6: Firewall - Allow WireGuard UDP traffic
/ip firewall filter
add chain=input protocol=udp dst-port=$wgListenPort action=accept \
    comment="Allow WireGuard Hotspay" place-before=0

# Step 7: NAT for hotspot clients through WireGuard (optional - only if routing all traffic)
# /ip firewall nat
# add chain=srcnat out-interface=$wgInterfaceName action=masquerade \
#     comment="NAT Hotspot via Hotspay WG"

# Step 8: Route management traffic to server via WireGuard
/ip route
add dst-address=10.10.10.1/32 gateway=$wgInterfaceName comment="Hotspay Server Route"

# -----------------------------------------------
# VERIFICATION COMMANDS (run after setup):
# -----------------------------------------------
# Check interface status:
#   /interface wireguard print
#
# Check peer connection:
#   /interface wireguard peers print
#
# Ping server:
#   /ping 10.10.10.1
#
# Check handshake (should show recent timestamp):
#   /interface wireguard peers print detail
# -----------------------------------------------
