# Payments — how money moves on 24 Hour Clipping

## The shape of the problem
This is a **two-sided marketplace**, which means money moves in two directions:

1. **Pay-in** — creators pay to fund a project (charge a card).
2. **Pay-out** — the platform pays clippers when work is approved (send money to a third party).

Pay-in is easy (any processor does it). **Pay-out to third parties is the hard part** and is what determines the right architecture.

## The Square reality (important)
Square is excellent for **pay-in** — accepting card / Apple Pay / Google Pay from creators. That's what we're setting up.

**But Square has no marketplace-payout product.** Unlike Stripe Connect or PayPal for Marketplaces, Square can't automatically split a payment and pay out to thousands of individual clippers' bank accounts with their own KYC/tax handling. Square payouts only settle to *your own* linked bank account.

So: **Square handles the creator's payment; clipper payouts run on a separate rail.** This is a normal, supported architecture — the platform collects into its Square balance (escrow), then pays clippers out itself.

## Recommended model — escrow + balance + withdrawal (standard SaaS marketplace)
This is how Fiverr/Upwork-style marketplaces work, and it fits us cleanly:

1. **Fund (escrow):** creator funds a project via **Square hosted checkout**. Money sits in the platform's balance, earmarked for that project. Project → `funded`.
2. **Deliver & approve:** clipper delivers; creator approves. On approval we don't wire cash immediately — we **credit the clipper's on-platform balance** with `price − 8% platform fee`, and write a `transactions` ledger row (`kind=payout, status=pending`).
3. **Withdraw:** the clipper withdraws their balance (on-demand above a small minimum, e.g. $20, or an automatic weekly sweep). The withdrawal is what actually sends money out, on a payout rail:
   - **USDC on Solana** — *already built and working on mainnet.* Instant, global, ~zero fee, no bank onboarding. Clipper sets a wallet address. Best default for a global clipper base.
   - **PayPal Payouts** *(add next)* — fiat to a PayPal email; global, simple KYC on PayPal's side. For clippers who want "real money to my bank."
   - **(Not Square)** — Square can't do this leg.

**Why balance-then-withdraw rather than pay-per-job:** fewer, batched payouts (lower fees), a clean ledger, dispute/hold window before money leaves, and it's the UX clippers already expect.

## Fees
- Platform fee: **8%** of project value, retained on approval (already modeled).
- Processor fees: Square takes its cut on pay-in; the payout rail takes its cut on withdrawal (USDC ≈ network fee only; PayPal per-payout fee).

## Data model (already in the new Postgres schema)
Every movement is a `transactions` ledger row — `deposit` (Square pay-in), `payout` (approval credit), `bond_hold`/`bond_release`/`bond_forfeit`, `fee`, `tip` — with amount in base units, currency, `chain_sig` (unique, anti-replay for on-chain), and status. Balances are derived from the ledger, never hand-edited. A clipper's withdrawable balance = confirmed payouts − withdrawals.

## What we're setting up now
- **Square sandbox** for pay-in (module: `backend/square.py`, hosted Checkout / Payment Links). Ziina is being dropped.
- Clipper payout stays on the existing **USDC/Solana** rail for now; PayPal Payouts is the fast-follow for fiat withdrawals.

### Square sandbox — credentials to grab
From the Square Developer Dashboard (developer.squareup.com):
1. Create an application → open the **Sandbox** tab.
2. Copy the **Sandbox Access Token** and a **Sandbox Location ID** (Locations section).
3. Put them in the server `.env`:
   ```
   SQUARE_ACCESS_TOKEN=EAAA...   # sandbox token
   SQUARE_LOCATION_ID=L...       # sandbox location
   SQUARE_ENV=sandbox
   SQUARE_CURRENCY=USD
   ```
4. Test cards for sandbox checkout: `4111 1111 1111 1111`, any future expiry, any CVV.

Flip `SQUARE_ENV=production` + production token/location when you go live.
