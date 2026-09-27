CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE IF NOT EXISTS cabins (id smallint PRIMARY KEY CHECK(id BETWEEN 1 AND 5), name text NOT NULL, capacity smallint NOT NULL CHECK(capacity BETWEEN 1 AND 4), base_rate integer NOT NULL CHECK(base_rate BETWEEN 5000 AND 500000));
CREATE TABLE IF NOT EXISTS nightly_rates (cabin_id smallint NOT NULL REFERENCES cabins(id), day date NOT NULL, cents integer NOT NULL CHECK(cents BETWEEN 5000 AND 500000), PRIMARY KEY(cabin_id,day));
CREATE TABLE IF NOT EXISTS bookings (
 id uuid PRIMARY KEY, cabin_id smallint NOT NULL REFERENCES cabins(id), arrival date NOT NULL, departure date NOT NULL,
 period daterange GENERATED ALWAYS AS (daterange(arrival,departure,'[)')) STORED,
 is_block boolean NOT NULL DEFAULT false, guests smallint NOT NULL,
 status text NOT NULL CHECK(status IN ('held','confirmed','cancelled','expired','failed','blocked','payment_review')),
 guest_name text, guest_email text, quote jsonb NOT NULL, total integer NOT NULL,
 provider text NOT NULL CHECK(provider IN ('simulator','stripe','owner')), provider_session_id text UNIQUE, payment_intent text,
 idempotency_key uuid UNIQUE, request_hash text, hold_until timestamptz, paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(arrival<departure), CHECK(departure-arrival<=366),
 CHECK((is_block AND guests=0 AND total=0 AND provider='owner') OR (NOT is_block AND guests BETWEEN 1 AND 4 AND total>0 AND guest_email IS NOT NULL)),
 CHECK(status<>'confirmed' OR (paid_at IS NOT NULL AND NOT is_block)), CHECK(status<>'blocked' OR is_block),
 CONSTRAINT no_overlapping_stays EXCLUDE USING gist (cabin_id WITH =, period WITH &&) WHERE (status IN ('held','confirmed','blocked'))
);
CREATE INDEX IF NOT EXISTS bookings_expiring ON bookings(hold_until) WHERE status='held';
CREATE TABLE IF NOT EXISTS payment_events (event_id text PRIMARY KEY, booking_id uuid NOT NULL REFERENCES bookings(id), received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS refund_jobs (booking_id uuid PRIMARY KEY REFERENCES bookings(id), amount integer NOT NULL CHECK(amount>0), state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processing','refunded','failed')), provider_ref text, attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, last_error text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS email_outbox (id bigserial PRIMARY KEY, booking_id uuid NOT NULL REFERENCES bookings(id), kind text NOT NULL CHECK(kind IN ('confirmed','cancelled')), state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent')), attempts integer NOT NULL DEFAULT 0, lease_until timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(booking_id,kind));
CREATE TABLE IF NOT EXISTS content_pages (slug text PRIMARY KEY, title text NOT NULL, eyebrow text NOT NULL, body text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits (key text NOT NULL, bucket bigint NOT NULL, hits integer NOT NULL, PRIMARY KEY(key,bucket));
CREATE TABLE IF NOT EXISTS audit_log (id bigserial PRIMARY KEY, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION enforce_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT NEW.is_block AND NEW.guests>(SELECT capacity FROM cabins WHERE id=NEW.cabin_id) THEN RAISE EXCEPTION 'Cabin capacity exceeded' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS booking_capacity ON bookings;
CREATE TRIGGER booking_capacity BEFORE INSERT OR UPDATE OF guests,cabin_id ON bookings FOR EACH ROW EXECUTE FUNCTION enforce_capacity();
