# PRD — 24 HOUR CLIPPING

## Original Problem Statement
Build a complete, polished, responsive frontend MVP for "24 HOUR CLIPPING" — a real-time marketplace where streamers, podcasters, creators, entrepreneurs and businesses post short-form video-clipping projects. Trusted clippers bid live. Customer accepts clipper(s), clipper locks a Deadline Bond, and a visible 24-hour delivery countdown begins (CONTRACT LIVE). Missed deadline → Rescue Mode (refund + bond credit + strike). 8% success fee. Mock-service adapters so real backend/payments/Solana/AI can be connected later without rebuilding the frontend. "Do not reduce this project into a landing page — build the complete clickable frontend product experience."

## User Choices
- AI Concierge: REAL AI via Emergent LLM key (gpt-5.4, streaming SSE) behind the aiAdapter interface
- Persistence: light FastAPI + MongoDB demo backend
- Role switching: simple navbar role-switcher (Customer / Clipper / Admin, no login)
- Stock demo media OK (replaceable slots)

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) + seed data (`/app/backend/seed.py`), MongoDB, all routes under `/api`. AI via emergentintegrations (EMERGENT_LLM_KEY in backend/.env).
- Frontend: React (CRA/craco, JSX), Tailwind + shadcn, Framer Motion, 17 routed pages, 8 mock-service adapters in `src/services/`, demo video slots in `src/data/demoVideos.js`.
- Docs: `/app/replit.md` (product rules, states, design system, routes, adapter boundaries), `/app/README.md` (run, demo accounts, replace videos, backend connection points).
- Design: near-black graphite theme, #CCFF00 live/success, #FF4500 urgency/rescue, Manrope + IBM Plex Sans + JetBrains Mono (per /app/design_guidelines.json).

## User Personas
1. Customer ("I Need a Clip") — streamer/podcaster/creator/founder/business
2. Clipper ("I Make Clips") — invite-only, manually approved (demo code CLIP24)
3. Administrator — private console

## Core Requirements (static)
- Bids never start the clock; CONTRACT LIVE = funded + selected + clipper accepted + bond locked + footage available
- Bond tiers: $20–49→$5, $50–99→15%, $100–500→20%
- Rescue Mode: refund/credit + bond to customer + strike + admin alert + priority relaunch
- 8% success fee only on completion
- NEVER remove: live bidding, Deadline Bonds, Rescue Mode, AI briefing, 24h countdown

## Implemented (June 2026, MVP)
- Landing hero v2 "Countdown Takeover" (June 2026): giant live-ticking 24h clock (JetBrains Mono), coral pulse rings every second, 6 orbiting clipper avatars with bidding bubbles, floating emoji category chips (podcasts/streams/reels/founder clips) that deep-link to /marketplace?category=X, full-width LIVE BIDS ARRIVING band below hero. Marketplace now reads ?category= URL param.
- Landing (hero, animated live-bid preview, video carousel marquee, 3-step how-it-works, 24h guarantee, clipper roster, use cases, 8% fee, Solana badge, final CTA)
- Live Job Marketplace with category/budget/moment filters; Clipper Directory + public profiles (on-time % hero stat, ratings breakdown, portfolio, reviews)
- Customer: dashboard (stats, live countdowns, deliveries, rescue alert, brand profile, credits), Create Project (AI path or 3-step manual wizard w/ upload simulation + bond preview), AI Concierge (streaming chat, mic via SpeechRecognition, suggestions, file attach, brief generation → editable brief → checkout), Brand Profile, Brief Review & Checkout (USDC/card mock, funded state), Live Bid Room (simulated real-time bids, Best-Fit ranking, multi-select w/ combined total, CONTRACT LIVE overlay), Clip Room (giant countdown, locked brief, chat, versions, Solana verify link, rescue panel, help), Delivery Review (version compare, revisions, approve+release w/ 8% breakdown, rating, download)
- Clipper: invite-only onboarding (CLIP24, mock wallet, portfolio uploads, specialties, pending approval), dashboard (earnings, bond balance, on-time, progress bar, pending bids, live jobs), Job Details + bid form (bond shown but not locked), Project Room (countdown, upload cut w/ progress, revision state, payout summary w/ 8% fee, chat)
- Admin: stats, rescue alerts, contracts (trigger rescue, simulate refund), projects, bids, clippers (invite/suspend/restore), suspicious-activity flags, demo reset
- Seed data: 6 clippers, 8 open projects, 8 bids, 3 live contracts, 1 delivered, 1 rescue, 2 completed, brand profile, chat history
- Testing: iteration_1 — backend 28/28 pass, frontend 100% primary flows. A11y Dialog titles fixed post-test.

## Backlog / Next Tasks
- P1: TypeScript migration (user brief asked React+TypeScript; built in JSX on the CRA template — adapters keep migration contained)
- P1: Persist customer identity per project (currently all projects visible to demo customer)
- P2: Real WebSocket bid feed to replace realtimeAdapter simulation
- P2: Messaging from Bid Room before acceptance (currently toast placeholder)
- P2: Multi-clipper contract view (accepting N clippers creates N contracts; UI navigates to first)
- P2: Auth (JWT or Emergent Google) replacing role switcher when moving beyond demo
- P3: Notifications center, dispute detail flow, clipper strike history page
