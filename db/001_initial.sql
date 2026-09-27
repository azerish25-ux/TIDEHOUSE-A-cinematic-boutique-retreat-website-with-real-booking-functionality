CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS cabins (
  id text PRIMARY KEY CHECK (id IN ('salt','dune','drift','cove','pine')),
  base_rate integer NOT NULL CHECK (base_rate BETWEEN 1000 AND 1000000),
  version integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rates (
  cabin_id text NOT NULL REFERENCES cabins(id), stay_date date NOT NULL,
  amount integer NOT NULL CHECK (amount BETWEEN 1000 AND 1000000),
  PRIMARY KEY (cabin_id, stay_date)
);
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY,
  cabin_id text NOT NULL REFERENCES cabins(id),
  start_date date NOT NULL, end_date date NOT NULL CHECK (end_date > start_date),
  guests integer NOT NULL CHECK (guests BETWEEN 0 AND 4),
  kind text NOT NULL CHECK (kind IN ('booking','block')),
  status text NOT NULL CHECK (status IN ('holding','confirmed','blocked','failed','expired','cancelled','cancelling','payment_conflict')),
  name text, email text, token_hash text, idempotency_key uuid UNIQUE, payload_hash text,
  quote jsonb, total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  provider text NOT NULL CHECK (provider IN ('stripe','simulated')),
  checkout_id text UNIQUE, checkout_url text, payment_intent text,
  hold_expires_at timestamptz NOT NULL,
  refund_cents integer NOT NULL DEFAULT 0 CHECK (refund_cents >= 0 AND refund_cents <= total_cents),
  refunded_cents integer NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0 AND refunded_cents <= total_cents),
  block_note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking CHECK (kind = 'block' OR (guests > 0 AND token_hash IS NOT NULL AND quote IS NOT NULL AND total_cents > 0)),
  CONSTRAINT no_overlapping_inventory EXCLUDE USING gist (
    cabin_id WITH =,
    daterange(start_date, end_date, '[)') WITH &&
  ) WHERE (status IN ('holding','confirmed','blocked','cancelling'))
);
CREATE INDEX IF NOT EXISTS pending_reservations ON reservations(hold_expires_at) WHERE status = 'holding';
CREATE TABLE IF NOT EXISTS payment_events (id text PRIMARY KEY, type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS outbox (
  id bigserial PRIMARY KEY, reservation_id uuid NOT NULL REFERENCES reservations(id),
  kind text NOT NULL CHECK (kind IN ('confirmation','refund')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','working','done')),
  attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, kind)
);
CREATE TABLE IF NOT EXISTS documents (
  slug text PRIMARY KEY, title text NOT NULL, eyebrow text NOT NULL, body text NOT NULL,
  version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id bigserial PRIMARY KEY, action text NOT NULL, target text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
