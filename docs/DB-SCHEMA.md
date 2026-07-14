# Database Schema — target design (PostgreSQL)

Status: **proposed**. Current production runs MongoDB (Motor); this is the target we
migrate to for scale, correctness, and auditability. Rationale in the PR / chat, summary
at the bottom.

## Principles

1. **Money is never a float.** Fiat is `NUMERIC(14,2)`. On-chain amounts are stored in
   integer base units (`lamports`/USDC micro-units) as `BIGINT`, plus a currency tag.
2. **The database enforces the state machine**, not just the app: enums, `CHECK`s,
   foreign keys, and partial unique indexes make illegal states unrepresentable.
3. **Every money movement is a ledger row** (`transactions`) — nothing mutates a balance
   without an immutable audit record.
4. **No embedded arrays for anything queryable** (deliveries, reviews, portfolio,
   references, roles) — they become first-class tables.
5. **UUID v4 PKs**, `TIMESTAMPTZ` everywhere, `created_at`/`updated_at` on every table.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------- enums ----------
CREATE TYPE auth_provider AS ENUM ('local','google','demo');
CREATE TYPE user_role     AS ENUM ('customer','clipper','admin');
CREATE TYPE project_status AS ENUM ('draft','open','contract_live','delivered','completed','rescue','closed');
CREATE TYPE bid_status     AS ENUM ('pending','accepted','rejected','withdrawn');
CREATE TYPE contract_status AS ENUM ('live','delivered','revision','completed','rescue','closed_rescued');
CREATE TYPE currency       AS ENUM ('usd','usdc','sol');
CREATE TYPE txn_kind       AS ENUM ('deposit','payout','tip','bond_hold','bond_release','bond_forfeit','fee');
CREATE TYPE txn_status     AS ENUM ('pending','confirmed','failed');

-- ---------- identity ----------
CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          CITEXT UNIQUE NOT NULL,            -- case-insensitive
  name           TEXT NOT NULL,
  hashed_password TEXT,                             -- null for oauth/demo
  auth_provider  auth_provider NOT NULL DEFAULT 'local',
  avatar_url     TEXT,
  credits        INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  payout_wallet  TEXT,
  onboarded      BOOLEAN NOT NULL DEFAULT false,
  disabled       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- multi-role accounts (customer + clipper + admin) — normalized, not an array
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    user_role NOT NULL,
  PRIMARY KEY (user_id, role)
);

-- 1:1 with a user that is a clipper
CREATE TABLE clipper_profiles (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle         CITEXT UNIQUE,
  specialty      TEXT,
  price_min      NUMERIC(14,2) CHECK (price_min >= 0),
  price_max      NUMERIC(14,2) CHECK (price_max >= price_min),
  badge          TEXT,
  tools          TEXT[] NOT NULL DEFAULT '{}',
  -- reputation is DERIVED from contracts/reviews (materialized view or triggers),
  -- never hand-written:
  rating         NUMERIC(3,2) NOT NULL DEFAULT 0,
  on_time_pct    SMALLINT NOT NULL DEFAULT 100,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  missed_deadlines INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'approved',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clipper_id UUID NOT NULL REFERENCES clipper_profiles(user_id) ON DELETE CASCADE,
  title      TEXT,
  thumb_url  TEXT,
  video_url  TEXT,
  position   SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE brand_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT,
  description TEXT,
  audience   TEXT,
  caption_style TEXT, pacing TEXT, cta TEXT, avoid TEXT, fonts TEXT,
  colors     TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- marketplace ----------
CREATE TABLE projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title          TEXT NOT NULL,
  category       TEXT NOT NULL,
  description    TEXT NOT NULL DEFAULT '',
  budget         NUMERIC(14,2) NOT NULL CHECK (budget > 0),
  bond           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (bond >= 0),
  status         project_status NOT NULL DEFAULT 'draft',
  funded         BOOLEAN NOT NULL DEFAULT false,
  -- brief
  output_length  TEXT, aspect_ratio TEXT, captions TEXT, platform TEXT,
  moment_mode    TEXT, goal TEXT, audience TEXT, mood TEXT, style TEXT, cta TEXT,
  source_link    TEXT, source_key TEXT, source_length TEXT,
  thumbnail_url  TEXT, thumbnail_key TEXT,
  -- creative direction
  quality_notes  TEXT,
  -- deadline policy
  deadline_hours SMALLINT NOT NULL DEFAULT 24 CHECK (deadline_hours BETWEEN 1 AND 168),
  allow_extension BOOLEAN NOT NULL DEFAULT false,
  -- payment
  payment_method TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON projects (status);
CREATE INDEX ON projects (owner_id);
CREATE INDEX ON projects (category);
CREATE INDEX ON projects (created_at DESC);

CREATE TABLE project_references (   -- was projects.references[]
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE bids (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  clipper_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  pitch      TEXT NOT NULL,
  eta_hours  SMALLINT NOT NULL CHECK (eta_hours BETWEEN 1 AND 72),
  bond_required NUMERIC(14,2) NOT NULL DEFAULT 0,
  status     bid_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- one live bid per clipper per project (kills the duplicate-bid bug at the DB):
CREATE UNIQUE INDEX one_pending_bid ON bids (project_id, clipper_id) WHERE status = 'pending';
CREATE INDEX ON bids (project_id);
CREATE INDEX ON bids (clipper_id);

CREATE TABLE contracts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id       UUID NOT NULL UNIQUE REFERENCES bids(id) ON DELETE RESTRICT, -- kills double-accept
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  clipper_id   UUID NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  price        NUMERIC(14,2) NOT NULL CHECK (price > 0),
  bond         NUMERIC(14,2) NOT NULL DEFAULT 0,
  status       contract_status NOT NULL DEFAULT 'live',
  base_hours   SMALLINT NOT NULL DEFAULT 24,
  extended_hours SMALLINT NOT NULL DEFAULT 0 CHECK (extended_hours BETWEEN 0 AND 48),
  allow_extension BOOLEAN NOT NULL DEFAULT false,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at  TIMESTAMPTZ NOT NULL,
  rating_given SMALLINT CHECK (rating_given BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON contracts (clipper_id);
CREATE INDEX ON contracts (project_id);
CREATE INDEX ON contracts (status);

CREATE TABLE deliveries (          -- was contracts.versions[]
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version     SMALLINT NOT NULL,
  url         TEXT, object_key TEXT, thumb_url TEXT,
  note        TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version)
);

CREATE TABLE reviews (             -- was clippers.reviews[]
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL UNIQUE REFERENCES contracts(id) ON DELETE CASCADE,
  clipper_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- messaging (one table, polymorphic parent via nullable FKs) ----------
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  bid_id      UUID REFERENCES bids(id)      ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role user_role NOT NULL,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(contract_id, bid_id) = 1)   -- belongs to exactly one thread
);
CREATE INDEX ON messages (contract_id, created_at);
CREATE INDEX ON messages (bid_id, created_at);

-- ---------- money ledger (immutable audit of every movement) ----------
CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         txn_kind NOT NULL,
  status       txn_status NOT NULL DEFAULT 'pending',
  project_id   UUID REFERENCES projects(id),
  contract_id  UUID REFERENCES contracts(id),
  from_user    UUID REFERENCES users(id),
  to_user      UUID REFERENCES users(id),
  amount       NUMERIC(20,0) NOT NULL,     -- base units (cents / lamports / usdc micro)
  currency     currency NOT NULL,
  chain_sig    TEXT UNIQUE,                -- on-chain signature; UNIQUE = anti-replay
  meta         JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON transactions (contract_id);
CREATE INDEX ON transactions (project_id);

-- ---------- misc ----------
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
```

## What the schema fixes (vs today)

| Bug we hit / risk | How the schema kills it |
|---|---|
| Double-accept → 2 contracts | `contracts.bid_id UNIQUE` |
| Duplicate pending bids | partial unique index `one_pending_bid` |
| Pay for undelivered work | app tx + `contract_status` transitions guarded, ledger row required |
| `bids_count` drift | never stored — `COUNT(*)` or a trigger-maintained counter |
| Orphaned bids/contracts | foreign keys with `ON DELETE` rules |
| Money rounding | `NUMERIC`, base-unit `BIGINT` for chain |
| Slow marketplace at scale | indexes on `status`, `owner_id`, `clipper_id`, `created_at` |
| Non-atomic accept/fund | wrap in a single SQL transaction |

## Testing plan

1. **Constraint tests** — assert the DB *rejects* illegal states (double-accept,
   negative amount, second pending bid, approve-before-deliver). These are fast and
   prove the invariants hold regardless of app bugs.
2. **Integration tests** — the full funnel (register → post → fund → bid → accept →
   deliver → approve → payout) against a throwaway Postgres (Docker service or
   testcontainers), wrapped per-test in a transaction that rolls back.
3. **Migration verification** — a script that reads every Mongo document, writes the
   Postgres rows, and then re-counts + checksums each entity to prove nothing was lost.

## Migration path (safe, phased)

- **Stack:** SQLAlchemy 2.0 (async) + `asyncpg`, Alembic for migrations, add a
  `postgres` service to `docker-compose.prod.yml` (named volume, daily `pg_dump`).
- **Phase 1:** land the models + Alembic baseline + tests on a branch; stand up Postgres
  in staging. No prod impact.
- **Phase 2:** write the Mongo→Postgres data-migration script; dry-run + verify counts.
- **Phase 3:** cutover in a short maintenance window (freeze writes, migrate, flip the
  `DB` env, verify, unfreeze). Keep the Mongo volume as a rollback for N days.

Effort: ~2–4 focused sessions. Best done on a branch with the CI runner so each step
is verified before cutover — not big-banged on the live box.
