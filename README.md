# 24 HOUR CLIPPING

Turn your best moments into finished clips in 24 hours. A real-time video-clipping marketplace MVP — complete clickable frontend with a light demo backend.

## How to Run
Services are supervisor-managed in this environment:
- Backend (FastAPI): `sudo supervisorctl restart backend` — runs on :8001, all routes under `/api`
- Frontend (React): `sudo supervisorctl restart frontend` — runs on :3000
- Local dev elsewhere: `cd backend && pip install -r requirements.txt && uvicorn server:app --port 8001` and `cd frontend && yarn && yarn start`
- Env: `backend/.env` (MONGO_URL, DB_NAME, EMERGENT_LLM_KEY), `frontend/.env` (REACT_APP_BACKEND_URL)

## Demo Accounts & Roles
No login required — use the **role switcher** in the navbar:
- **Customer** (Aria Chen) — post projects, fund, accept bids, review deliveries
- **Clipper** (Maya Torres) — bid on jobs, deliver cuts. Onboarding invite code: `CLIP24`
- **Admin** — console at `/admin`, can trigger Rescue Mode and reset demo data

## Route Map
See `replit.md` for the full table. Key journeys:
- Customer: `/customer/create` → concierge or manual → `/customer/checkout/:id` → `/customer/bids/:id` (live bid room) → CONTRACT LIVE → `/customer/clip-room/:id` → `/customer/review/:id`
- Clipper: `/clipper/onboarding` → `/clipper` → `/clipper/job/:id` (bid) → `/clipper/room/:id` (deliver)
- Admin: `/admin` (contracts, rescues, flags, suspend/restore)

## Mock Services
All in `frontend/src/services/` — auth, db, ai, payment, solana, storage, notification, realtime adapters. Swap internals without touching components. Details in `replit.md`.

## Replacing Demo Videos
Edit `frontend/src/data/demoVideos.js` — four named slots (streamer-highlight, podcast-insight, founder-clip, product-ad). Seeded marketplace/portfolio media lives in `backend/seed.py` (IMG/VIDS constants). Reset demo data from Admin → "Reset demo data".

## Future Backend Connection Points
- Auth: replace `authAdapter` (JWT/OAuth) and gate routes
- Database: `backend/server.py` endpoints are the contract; swap Mongo demo collections for production models
- Payments: `paymentAdapter.fund()` → Stripe / Solana Pay; escrow + 8% fee logic already modeled
- Solana: `solanaAdapter` → real wallet adapter + on-chain bond escrow
- Storage: `storageAdapter.upload()` → S3/GCS presigned uploads
- Realtime: `realtimeAdapter` → WebSocket bid feed
- AI: backend `/api/ai/*` already uses a real LLM (Emergent key); swap key/provider in `backend/.env`

## Connect to GitHub
Use the "Save to GitHub" feature in Emergent (top-right menu) to push this workspace to a repo, or locally:
```
git init && git add -A && git commit -m "24 Hour Clipping MVP"
git remote add origin <your-repo-url> && git push -u origin main
```
