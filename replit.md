# 24 HOUR CLIPPING — replit.md

## Product Vision
A real-time marketplace where streamers, podcasters, creators, entrepreneurs and businesses post short-form video-clipping projects. Trusted clippers bid live. The customer accepts one or more clippers, each clipper locks a Deadline Bond, and a visible 24-hour delivery clock begins. Feels as simple as Uber, as immediate as TikTok, as polished as Apple, as energetic as a trading floor. Platform principle: **FRICTION IS FICTION.**

## User Roles
1. **Customer** — "I Need a Clip" (streamers, podcasters, creators, entrepreneurs, businesses)
2. **Clipper** — "I Make Clips" (invite-only pilot, manually approved)
3. **Administrator** — private console

Role switching is available in the navbar for demo purposes (mock auth adapter).

## Product Rules (DO NOT REMOVE)
- Projects receive bids WITHOUT starting the 24-hour clock.
- The clock starts ONLY at **CONTRACT LIVE**: (1) customer funds the price, (2) customer selects a clipper, (3) clipper accepts, (4) clipper locks the Deadline Bond, (5) all footage/links/info available.
- A bid does NOT lock a bond. Bond locks only after acceptance + clipper confirmation.
- Deadline Bond tiers: $20–49 → $5 · $50–99 → 15% · $100–500 → 20%.
- Missed deadline → **Rescue Mode**: customer refund/credit, bond credited to customer, clipper on-time score drops + strike, admin alerted, customer may relaunch as priority job.
- Platform earns an **8% success fee** only on successful completion.
- NEVER remove: live bidding, Deadline Bonds, Rescue Mode, AI briefing (concierge), or the 24-hour countdown.

## Contract States
`draft → open (funded, receiving bids) → pending_acceptance → awaiting_clipper → live (CONTRACT LIVE) → delivered → revision → completed`
Failure path: `live → rescue → closed_rescued (relaunched as priority)`

## Design System
- Backgrounds: near-black `#0A0A0A`, panel `#121212`, card `#1A1A1A`
- Signal green `#CCFF00` = live/success ONLY · Coral `#FF4500` = urgency/countdown/rescue ONLY
- Fonts: Manrope (headings), IBM Plex Sans (body), JetBrains Mono (timers, money, stats)
- Pill buttons, rounded-2xl cards, 1px white/10 borders, restrained motion (Framer Motion for bid arrivals)
- No purple, no gradient soup, no crypto jargon. "Powered by Solana" is a subtle trust badge.

## Routes
| Route | Screen |
|---|---|
| `/` | Landing page |
| `/marketplace` | Live job marketplace (filterable) |
| `/clippers` · `/clippers/:id` | Clipper directory · public profile |
| `/customer` | Customer dashboard |
| `/customer/create` | Create project (AI or manual) |
| `/customer/concierge` | AI Clipping Concierge |
| `/customer/brand` | Brand profile |
| `/customer/checkout/:projectId` | Brief review & mock checkout |
| `/customer/bids/:projectId` | Live Bid Room (simulated real-time bids) |
| `/customer/clip-room/:contractId` | Clip Room (24h countdown, chat, versions) |
| `/customer/review/:contractId` | Delivery review |
| `/clipper/onboarding` | Invite-only onboarding (demo code: CLIP24) |
| `/clipper` | Clipper dashboard |
| `/clipper/job/:projectId` | Job details + bid form |
| `/clipper/room/:contractId` | Clipper project room |
| `/admin` | Admin console |

## Mock-Service Boundaries (`frontend/src/services/`)
All provider logic is isolated in adapters. Components never call providers directly.
- `authAdapter.js` — mock roles/users → swap for real auth
- `dbAdapter.js` — API wrapper → swap endpoints for production database
- `aiAdapter.js` — AI concierge streaming (Emergent LLM key via backend) → swap AI provider
- `paymentAdapter.js` — mock USDC/card funding → swap for Stripe / Solana Pay
- `solanaAdapter.js` — mock wallet + explorer links → swap for real wallet adapter
- `storageAdapter.js` — simulated uploads with progress → swap for S3/GCS
- `notificationAdapter.js` — toast wrapper → add push/email
- `realtimeAdapter.js` — simulated live bid arrivals → swap for WebSockets

Demo videos/thumbnails: `frontend/src/data/demoVideos.js` (named replaceable slots).
No real private keys, no production credentials, no custodial wallet logic anywhere.
