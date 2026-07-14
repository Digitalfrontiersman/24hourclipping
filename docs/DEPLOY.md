# Deploying 24 Hour Clipping to a VPS

The production stack runs entirely in Docker and is exposed on host port **8090**,
so it coexists with any existing web server on ports 80/443.

## 1. First deploy

```bash
# on the server, in the project directory (e.g. /opt/24hourclipping)
cp .env.prod.example .env          # adjust if needed
docker compose -f docker-compose.prod.yml up -d --build
```

Open the firewall for the app port if a firewall is active:

```bash
ufw allow 8090/tcp        # only if ufw is enabled
```

App is now live at `http://<server-ip>:8090`.

## 2. Updating after a code change

```bash
git pull        # or re-sync the files
docker compose -f docker-compose.prod.yml up -d --build
```

## 3. Attaching a domain with HTTPS (via the host's existing nginx)

Point an A record at the server, then add a vhost that proxies to the app.
This does **not** disturb existing sites — it's a new server block.

```nginx
# /etc/nginx/sites-available/clipping.conf
server {
    listen 80;
    server_name clips.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;          # SSE for AI streaming
    }
}
```

```bash
ln -s /etc/nginx/sites-available/clipping.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d clips.yourdomain.com     # automatic TLS
```

Once a domain is attached you can bind the app to localhost only — change the
`ports` mapping in `docker-compose.prod.yml` to `"127.0.0.1:8090:80"` and
re-run the up command.

## 4. Operations

```bash
docker compose -f docker-compose.prod.yml ps          # status
docker compose -f docker-compose.prod.yml logs -f     # logs
docker compose -f docker-compose.prod.yml down        # stop (keeps data volume)
```

MongoDB data persists in the `mongo_data` volume. To back it up:

```bash
docker compose -f docker-compose.prod.yml exec mongo \
  mongodump --archive=/tmp/clip.gz --gzip --db clipping
docker compose -f docker-compose.prod.yml cp mongo:/tmp/clip.gz ./clip-backup.gz
```

## Authentication & security

Auth is real: bcrypt-hashed passwords, JWT bearer tokens, role-based access,
and per-resource ownership checks. Configure via `.env`:

- `SECRET_KEY` (required) — `openssl rand -hex 32`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — provisions the only admin account on boot.
  This is the sole way into `/admin`; there is no demo-admin unless you set
  `ENABLE_DEMO_ADMIN=true`.
- `ENABLE_DEMO_LOGIN=true` — one-click demo customer/clipper for showcasing.
- Change the admin password by editing `.env` and re-running the up command.

### Enabling Google Sign-In

1. In Google Cloud Console create an OAuth 2.0 **Web** client ID. Add your
   origin (e.g. `https://clips.yourdomain.com`) to Authorized JavaScript origins.
2. Put the client ID in `.env` as `GOOGLE_CLIENT_ID=...`
3. Rebuild so it's baked into the frontend:
   `docker compose -f docker-compose.prod.yml up -d --build`

The Google button appears automatically once configured; the backend verifies
the token against the same client ID.

## Remaining caveats

- **Uploads are simulated** and **payments are mocked** — see README. Wire up
  S3/GCS storage and Stripe/Solana before real users transact.
- Demo marketplace data auto-seeds on first backend start (`SEED_DEMO_DATA`).
- The in-memory rate limiter is per-instance; use Redis if you scale out.
