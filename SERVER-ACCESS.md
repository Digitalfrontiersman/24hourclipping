# How to access the 24 Hour Clipping server

The live app runs on an **OVH VPS** that is **only reachable over a WireGuard tunnel**
(public SSH port 22 is firewalled off — that's intentional, not broken). So you can't
SSH to the public IP directly; you first join the WireGuard mesh, then SSH to the box's
**internal** tunnel IP.

## The facts

| Thing | Value |
|---|---|
| Public IP (WireGuard endpoint only) | `142.44.240.184` |
| **Internal tunnel IP (SSH to this)** | **`10.8.0.2`** |
| SSH user | `ubuntu` |
| App directory | `/opt/24hourclipping` |
| Live URLs | https://24hourclipping.com · https://clip42.duckdns.org |
| WireGuard config file | `C:\Users\bilal\clip24-wg.conf` (interface name `rivals-mesh`) |

Docker needs `sudo` on this box (the `ubuntu` user isn't in the docker group).

---

## Step 1 — Bring up the WireGuard tunnel (on your PC)

You must be connected to WireGuard **before** SSH will work.

**Windows (WireGuard app):**
1. Open the **WireGuard** app.
2. Make sure the tunnel from `clip24-wg.conf` is **imported** and shows **Active**.
   (If it's not imported: WireGuard app → *Import tunnel(s) from file* → pick
   `C:\Users\bilal\clip24-wg.conf`, then **Activate**.)

**Verify the tunnel routes to the box** (Git Bash / PowerShell):
```bash
ssh -o ConnectTimeout=8 ubuntu@10.8.0.2 'echo TUNNEL_OK && hostname'
```
If you get `TUNNEL_OK … vps-55983430`, you're in. If it **times out**, the WireGuard
tunnel isn't up — go back and activate it.

---

## Step 2 — SSH into the box

```bash
ssh ubuntu@10.8.0.2
```

- **Key-based login** is set up for the deploy key `wca-deploy@claude`
  (`~/.ssh/wca_deploy` on this PC). If SSH asks for a password instead of logging you
  straight in, your machine is using a different key — either use the deploy key
  explicitly: `ssh -i ~/.ssh/wca_deploy ubuntu@10.8.0.2`, or log in with the `ubuntu`
  password and re-add the key.
- To authorize a **new** machine, add its public key on the box:
  ```bash
  echo 'PASTE_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys
  ```

---

## Step 3 — Common tasks (run these on the box)

```bash
cd /opt/24hourclipping

# See what's running
sudo docker compose -f docker-compose.prod.yml ps

# Tail logs
sudo docker compose -f docker-compose.prod.yml logs -f backend

# Restart the app
sudo docker compose -f docker-compose.prod.yml restart

# Rebuild + restart after a code change
sudo docker compose -f docker-compose.prod.yml up -d --build
```

The secrets live in `/opt/24hourclipping/.env` (chmod 600) — **never overwrite it**.

---

## Step 4 — Deploy new code (from your PC, tunnel up)

The app dir is **not** a git repo, so deploy by copying files over the tunnel, then
rebuilding. From the project folder on your PC:
```bash
tar -czf - --exclude='.git' --exclude='node_modules' --exclude='frontend/build' \
          --exclude='__pycache__' --exclude='*.env' . \
  | ssh ubuntu@10.8.0.2 'sudo tar -xzf - -C /opt/24hourclipping'

ssh ubuntu@10.8.0.2 'cd /opt/24hourclipping && sudo docker compose -f docker-compose.prod.yml up -d --build'
```
> `--exclude='*.env'` is important — it keeps the server's secrets intact.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ssh: connect to host 10.8.0.2 port 22: Connection timed out` | WireGuard tunnel is **not active**. Open the WireGuard app and activate the tunnel. |
| `Permission denied (publickey)` | Your machine's SSH key isn't authorized. Use `-i ~/.ssh/wca_deploy`, or add your public key to `~/.ssh/authorized_keys` on the box. |
| Public IP `142.44.240.184` won't SSH | Correct — SSH is **only** over the tunnel at `10.8.0.2`. Don't use the public IP. |
| Site down but box reachable | `cd /opt/24hourclipping && sudo docker compose -f docker-compose.prod.yml up -d` |

**One rule:** the WireGuard tunnel must be UP on your machine first. Everything else
follows from that.
