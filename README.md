# 24 HOUR CLIPPING

Turn your best moments into finished clips in 24 hours. A real-time video-clipping
marketplace — full-stack monorepo with a **FastAPI + MongoDB** backend and a
**React** frontend.

## Monorepo layout

```
.
├── backend/           FastAPI app (REST API under /api), MongoDB via Motor
│   ├── server.py      All API routes
│   ├── seed.py        Demo data (auto-seeded on first startup)
│   ├── requirements-core.txt   Minimal PyPI deps to run the core API
│   ├── requirements.txt        Full pinned set (incl. optional AI stack)
│   └── Dockerfile
├── frontend/          React 19 + CRACO + Tailwind + Radix UI
│   ├── src/           Pages, components, service adapters
│   └── Dockerfile
├── docs/              Docs & references (deploy, server access, design, Vellum)
├── assets/            Source media (hero video, source clips, images)
├── scripts/           Ops scripts (GitHub runner setup, legacy deploy)
├── docker-compose.yml One command for Mongo + backend + frontend
├── package.json       Root dev scripts (concurrently)
└── Makefile           Convenience targets
```

Deployment and server access: see [`docs/DEPLOY.md`](docs/DEPLOY.md) and
[`docs/SERVER-ACCESS.md`](docs/SERVER-ACCESS.md).

## Quick start

### Option A — Docker (recommended, nothing to install)

```bash
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8001/api
- MongoDB → localhost:27017 (auto-seeded with demo data on first run)

To enable the AI concierge, export `EMERGENT_LLM_KEY=...` before running.

### Option B — Local dev

Prereqs: Python 3.11+, Node 20+, Yarn, and a local MongoDB on `:27017`.

```bash
# 1. env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. install deps
npm run setup            # pip + yarn (or: make setup)

# 3. run both with hot reload
npm install              # root: installs concurrently
npm run dev              # backend :8001 + frontend :3000  (or: make dev)
```

Run them separately if you prefer:

```bash
cd backend && uvicorn server:app --reload --port 8001
cd frontend && yarn start
```

## Environment variables

| File            | Var                     | Purpose                                     |
|-----------------|-------------------------|---------------------------------------------|
| `backend/.env`  | `MONGO_URL`             | Mongo connection string                     |
| `backend/.env`  | `DB_NAME`               | Database name                               |
| `backend/.env`  | `CORS_ORIGINS`          | Allowed origins (`*` for all)               |
| `backend/.env`  | `EMERGENT_LLM_KEY`      | Optional — enables `/api/ai/*` concierge    |
| `frontend/.env` | `REACT_APP_BACKEND_URL` | Backend base URL (app calls `${URL}/api`)   |

Templates live in `*/.env.example`. The AI endpoints degrade gracefully
(HTTP 503) when the key/package is absent — the rest of the app works fully.

## API surface

All routes are under `/api`. Core resources: `clippers`, `projects`, `bids`,
`contracts` (activate / deliver / revision / approve / rescue / relaunch),
`messages`, `brand-profiles`, `admin/overview`, and optional `ai/*`.
Health check: `GET /api/` returns a status payload.

## Demo accounts & roles

No login required — use the **role switcher** in the navbar:
- **Customer** (Aria Chen) — post projects, fund, accept bids, review deliveries
- **Clipper** (Maya Torres) — bid on jobs, deliver cuts. Invite code: `CLIP24`
- **Admin** — console at `/admin`; trigger Rescue Mode, reset demo data

## Key journeys

- **Customer:** `/customer/create` → checkout → `/customer/bids/:id` (live bid room)
  → contract live → `/customer/clip-room/:id` → `/customer/review/:id`
- **Clipper:** `/clipper/onboarding` → `/clipper` → `/clipper/job/:id` (bid)
  → `/clipper/room/:id` (deliver)
- **Admin:** `/admin`

See [`docs/replit.md`](docs/replit.md) for the full route table and service-adapter details.

## Tests

```bash
cd backend && pytest          # or: make test
```
