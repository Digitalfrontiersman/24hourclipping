# 24 HOUR CLIPPING

Post your footage, vetted clippers bid in real time, and you get a finished,
ready-to-post short-form clip (TikTok / Reels / Shorts) within **24 hours** —
backed by a money-back deadline bond.

Full-stack monorepo: **FastAPI + PostgreSQL** backend, **React 19** frontend,
orchestrated with Docker Compose. Live at **https://24hourclipping.com**.

## Features

**Marketplace & jobs**
- Post a job two ways: **Express** (one screen — title + budget) or a full guided brief. Upload footage or paste a link.
- **Free-posting mode** (current launch setting): jobs go live for bids instantly, no checkout. Flip `FREE_POSTING=false` to require payment.
- **Live bid room** — vetted clippers bid in real time (polling), with transparent sort: **Best fit / Lowest price / Fastest**. One-tap accept.
- **Clipper Quick Apply** — bid in one tap using smart defaults, or customize.
- **24-hour contracts** with a clipper-staked **deadline bond** — miss it and the creator gets a full refund plus the bond (**Rescue Mode**). Deliver → review → approve, with revisions and multi-clipper accept.
- **Verified platform listing** badge on admin-created jobs.

**Accounts & auth**
- Email/password (bcrypt + JWT) with **email verification** for local signups; **Google Sign-In** (auto-verified).
- Conversational onboarding (creator / clipper / both). Clippers set specialties, tools, and their **Solana (USDC) payout wallet**.
- Real role switching, brand profiles, clipper directory + portfolios.

**Payments**
- **Pay-in:** card & wallets via **Square**, or **USDC / SOL** via **Solana + Phantom** (verified on-chain).
- **Payouts are decoupled from pay-in:** approval credits a USD balance; clippers withdraw via **PayPal (fiat)** or **USDC** — so a creator can fund in USDC and the clipper can still cash out fiat.
- Tips, escrow, and an immutable transaction ledger. Creator **Billing** page with history.

**AI & content**
- **AI Concierge** (OpenAI) turns a short chat into a complete project brief.
- **Self-updating blog** (`/blog`) — server-rendered, SEO-first, with seed articles + a daily auto-generated, keyword-targeted post seasoned with real platform stats.
- **Feature Wishlist** (`/wishlist`) — anyone can view; logged-in users submit ideas and upvote; admins set status (Planned / Shipped / …).

**SEO / AEO (built to rank in search *and* AI answer engines)**
- Rich meta + Open Graph/Twitter, **JSON-LD** (Organization, Service, FAQ, WebApplication, Article, Breadcrumb).
- `robots.txt` explicitly welcoming AI crawlers, `sitemap.xml`, `llms.txt`, and **build-time prerendering** of public routes so crawlers get real per-page HTML.

**Admin console** (`/admin`)
- Overview stats; **users** (grant/revoke roles, suspend, delete); **projects** (edit, hide/show, delete, publish free); **contracts** (trigger Rescue); bids; clippers.
- **CSV export** (users / projects / contracts / bids) and on-demand blog generation.

**Infra & hardening**
- **PostgreSQL** (SQLAlchemy 2.0 async, DB-enforced integrity), **AWS S3** direct-to-bucket uploads, **Resend** transactional email (branded templates), HTTP security headers, IP-based rate limiting.

## Monorepo layout

```
.
├── backend/           FastAPI app (REST API under /api) + server-rendered /blog
│   ├── server.py      All API routes
│   ├── models.py      SQLAlchemy 2.0 ORM (PostgreSQL)
│   ├── database.py    Async engine + additive column migrations
│   ├── blog.py        Blog rendering + OpenAI generation
│   ├── square.py / solana_pay.py / paypal.py   Payments
│   └── Dockerfile
├── frontend/          React 19 + CRACO + Tailwind + Radix UI
│   ├── src/           Pages, components, service adapters
│   ├── scripts/prerender.js   Per-route static HTML for crawlers
│   └── Dockerfile(.prod)
├── docs/              PRD, DB schema, payments, deploy notes, design tokens
├── docker-compose.yml / docker-compose.prod.yml
└── Makefile
```

Deployment & server access: [`docs/DEPLOY.md`](docs/DEPLOY.md), [`docs/SERVER-ACCESS.md`](docs/SERVER-ACCESS.md).

## Quick start (Docker)

```bash
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend API → http://localhost:8001/api  (health: `GET /api/`)
- PostgreSQL → localhost:5432

### Local dev

Prereqs: Python 3.11+, Node 20+, Yarn, PostgreSQL.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run setup && npm run dev      # backend :8001 + frontend :3000
```

## Key environment variables

| Scope     | Var                                   | Purpose                                        |
|-----------|---------------------------------------|------------------------------------------------|
| backend   | `DATABASE_URL`                        | Postgres (asyncpg) connection string           |
| backend   | `SECRET_KEY`                          | JWT signing secret (**required in prod**)      |
| backend   | `FREE_POSTING`                        | `true` = post jobs live without paying         |
| backend   | `GOOGLE_CLIENT_ID`                    | Google Sign-In                                 |
| backend   | `OPENAI_API_KEY` / `OPENAI_MODEL`     | AI concierge + blog generation                 |
| backend   | `SQUARE_*`                            | Card checkout                                  |
| backend   | `SOLANA_RPC_URL` / `SOLANA_TREASURY_SECRET` | USDC/SOL payments                        |
| backend   | `S3_*`                                | AWS S3 media storage                            |
| backend   | `RESEND_API_KEY` / `EMAIL_FROM`       | Transactional email                            |
| frontend  | `REACT_APP_BACKEND_URL`               | Backend base URL (app calls `${URL}/api`)      |

Templates live in `*/.env.example`. AI/payment features degrade gracefully (HTTP 503) when keys are absent — the rest of the app works.

## Tests

```bash
cd backend && pytest
```
