# -----------------------------------------------
# MikroTik WireGuard Client Configuration
# RouterOS v7.x
# -----------------------------------------------

# 1. Add WireGuard Interface
/interface wireguard
add name=wg0 listen-port=13231 private-key="MIKROTIK_PRIVATE_KEY"

# 2. Assign IP to WireGuard Interface
/ip address
add address=10.0.0.2/30 interface=wg0

# 3. Add WireGuard Peer (Ubuntu Server)
/interface wireguard peers
add interface=wg0 \
    public-key="SERVER_PUBLIC_KEY" \
    endpoint-address=YOUR_SERVER_PUBLIC_IP \
    endpoint-port=51820 \
    allowed-address=0.0.0.0/0 \
    persistent-keepalive=25

# 4. Route all hotspot traffic through the WireGuard tunnel
/ip route
add dst-address=0.0.0.0/0 gateway=10.0.0.1 routing-table=main distance=2

# 5. NAT masquerade for hotspot clients going through wg0
/ip firewall nat
add chain=srcnat out-interface=wg0 action=masquerade comment="WireGuard NAT for Hotspot"

# 6. Firewall: Allow WireGuard traffic on WAN
/ip firewall filter
add chain=input in-interface=ether1 protocol=udp dst-port=13231 action=accept comment="Allow WireGuard"
