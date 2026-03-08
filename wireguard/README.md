# WireGuard VPN – MikroTik ↔ Ubuntu Server

This directory contains configuration files to set up a WireGuard VPN tunnel between a **MikroTik router** (acting as the hotspot gateway / client) and an **Ubuntu Linux server** (acting as the VPN listener). All hotspot client traffic is routed through the tunnel.

---

## Network Topology

```
[Hotspot Clients 192.168.88.0/24]
          |
    [MikroTik Router]  ── WireGuard tunnel (10.0.0.2) ──→  [Ubuntu Server (10.0.0.1)]
          |                                                         |
       ether1                                                    eth0 / ens3
    (WAN – UDP 13231)                                       (Public Internet – UDP 51820)
```

| Setting | Value |
|---|---|
| Server Public IP | `YOUR_SERVER_PUBLIC_IP` |
| WireGuard listen port (server) | `51820` |
| WireGuard listen port (MikroTik) | `13231` |
| Tunnel subnet | `10.0.0.0/30` |
| Server tunnel IP | `10.0.0.1` |
| MikroTik tunnel IP | `10.0.0.2` |
| MikroTik hotspot subnet | `192.168.88.0/24` |
| MikroTik WAN interface | `ether1` |

---

## Files

| File | Purpose |
|---|---|
| `server/wg0.conf` | WireGuard config for the Ubuntu server |
| `server/setup-server.sh` | One-shot install & configure script for Ubuntu |
| `mikrotik/mikrotik-wireguard.rsc` | RouterOS v7.x script for the MikroTik router |

---

## Step-by-Step Setup

### Step 1 – Run the server setup script

Copy `server/setup-server.sh` to your Ubuntu server and run it as root:

```bash
chmod +x setup-server.sh
sudo ./setup-server.sh
```

The script will:
1. Install `wireguard` and `wireguard-tools`.
2. Generate a server key pair and save it to `/etc/wireguard/`.
3. Enable IP forwarding permanently via `/etc/sysctl.conf`.
4. Write `/etc/wireguard/wg0.conf` with the generated private key.
5. Enable and start the `wg-quick@wg0` systemd service.

> **Note the server public key** printed to the console – you will need it in Step 3.

---

### Step 2 – Replace placeholder values in `server/wg0.conf`

If you prefer to configure the server manually instead of using the script, edit
`server/wg0.conf` and replace:

| Placeholder | Replace with |
|---|---|
| `SERVER_PRIVATE_KEY` | Output of `wg genkey` run on the server |
| `MIKROTIK_PUBLIC_KEY` | MikroTik public key obtained in Step 4 |

Also check that the outbound internet interface in `PostUp`/`PostDown` matches your
server's interface (commonly `eth0` or `ens3`).

---

### Step 3 – Run the MikroTik script

Open a **terminal** session on your MikroTik router (via SSH or Winbox Terminal) and
paste the contents of `mikrotik/mikrotik-wireguard.rsc`, after replacing the
placeholders below:

| Placeholder | Replace with |
|---|---|
| `MIKROTIK_PRIVATE_KEY` | Output of `/interface wireguard print` after creating the interface, or generate externally with `wg genkey` |
| `SERVER_PUBLIC_KEY` | Server public key from Step 1 |
| `YOUR_SERVER_PUBLIC_IP` | The actual public IPv4 address of your Ubuntu server |

Alternatively, import the file directly:
```routeros
/import file=mikrotik-wireguard.rsc
```

---

### Step 4 – Retrieve the MikroTik public key

On the MikroTik terminal, run:

```routeros
/interface wireguard print
```

Copy the **public-key** value shown for the `wg0` interface.

---

### Step 5 – Add the MikroTik public key to the server

Edit `/etc/wireguard/wg0.conf` on the Ubuntu server and add (or uncomment) the
`[Peer]` block:

```ini
[Peer]
# MikroTik Router
PublicKey = <MIKROTIK_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32, 192.168.88.0/24
```

---

### Step 6 – Restart WireGuard on the server

```bash
sudo systemctl restart wg-quick@wg0
```

---

### Step 7 – Test connectivity

From the Ubuntu server, ping the MikroTik tunnel IP:

```bash
ping 10.0.0.2
```

From the MikroTik terminal, ping the server tunnel IP:

```routeros
/ping 10.0.0.1
```

---

## Generating Keys Manually

### On Ubuntu (OpenWRT / Linux)

```bash
# Generate private key
wg genkey > private.key
chmod 600 private.key

# Derive public key
wg pubkey < private.key > public.key

cat private.key   # use as PRIVATE_KEY
cat public.key    # use as PUBLIC_KEY
```

### On MikroTik (RouterOS v7.x)

WireGuard keys are generated automatically when you create the interface. Retrieve them with:

```routeros
/interface wireguard print
```

You can also generate a key pair on any Linux system (see above) and paste the
private key into the MikroTik script.

---

## Troubleshooting

### Tunnel does not come up

- **Check firewall on the server** – UDP port `51820` must be open inbound:
  ```bash
  sudo ufw allow 51820/udp
  # or for iptables:
  sudo iptables -A INPUT -p udp --dport 51820 -j ACCEPT
  ```
- **Check MikroTik firewall** – the script already adds a rule to allow UDP `13231`
  on `ether1`. Verify with:
  ```routeros
  /ip firewall filter print
  ```

### Key mismatch

Ensure that:
- The **server's** `wg0.conf` `[Peer] PublicKey` matches the MikroTik's **public** key.
- The MikroTik script's `SERVER_PUBLIC_KEY` matches the Ubuntu server's **public** key.

A wrong key causes the handshake to silently fail. Check the WireGuard status:

```bash
sudo wg show        # on the server – look for "latest handshake"
```

### Traffic not routing / no internet on hotspot clients

1. Confirm IP forwarding is active on the server:
   ```bash
   sysctl net.ipv4.ip_forward   # should be 1
   ```
2. Verify the NAT rule is in place:
   ```bash
   sudo iptables -t nat -L POSTROUTING -n -v
   ```
3. If your server's outbound interface is **not** `eth0` (e.g. `ens3`, `ens18`), update
   the `PostUp`/`PostDown` lines in `wg0.conf` accordingly and restart:
   ```bash
   sudo systemctl restart wg-quick@wg0
   ```
4. On MikroTik, verify the default route via the tunnel exists:
   ```routeros
   /ip route print
   ```
   and that the NAT masquerade rule is active:
   ```routeros
   /ip firewall nat print
   ```

### WireGuard service fails to start

Check the journal for errors:

```bash
sudo journalctl -u wg-quick@wg0 -e
```

Common causes:
- Malformed private key in `wg0.conf`.
- `iptables` not installed – install with `apt install iptables`.
- Port already in use – choose a different `ListenPort`.
