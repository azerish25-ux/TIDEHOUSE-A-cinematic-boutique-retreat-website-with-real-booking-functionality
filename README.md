# TIDEHOUSE

**Five cabins. One quieter coast. A complete direct-booking experience.**

A fictional boutique retreat, built as a hospitality portfolio flagship. The application combines an editorial Next.js website with a TypeScript booking API, PostgreSQL inventory constraints, an editable owner content system, and a Stripe **test-mode-only** payment adapter.

## What is in this repository

- A responsive, custom coastal design: Cormorant Garamond and Manrope, paper and sea-glass tones, an original illustrated property map, cabin pages, galleries, concept floor plans, two-cabin comparison, field notes and practical guest information.
- Exactly **five cabins**, **two optional extras** (breakfast and a private sauna session), and **one booking workflow**.
- Date and capacity validation, per-night seasonal pricing, exact owner overrides, immutable quote snapshots and a complete CAD price breakdown.
- PostgreSQL-enforced exclusion between checkout holds, confirmed stays and owner blocks. Availability is not trusted to a browser check.
- Idempotent reservation requests, Stripe-hosted test checkout, raw-body signed webhooks, event deduplication, delayed-payment reconciliation, cancellation and durable refund jobs.
- Private booking management links using random 256-bit capabilities; only hashes are stored on the server. Owner sessions use HttpOnly cookies and a separate passphrase.
- An owner dashboard for reservations, date blocks, base rates, dated overrides and versioned plain-text editorial content.
- Unit, PostgreSQL integration, browser and accessibility tests, plus a CI workflow that produces visual evidence and a source archive.

## Two deliberately distinct environments

| Environment | Persistence | Payment path | Intended use |
| --- | --- | --- | --- |
| Full application | PostgreSQL, shared by all visitors | Stripe test Checkout; explicit local simulator available for development | Real booking-system demonstration and verification |
| Static portfolio preview | This browser's local storage only | Clearly labelled local simulation | Exploring the design without database credentials |

The static preview **does not demonstrate cross-device inventory protection or real Stripe payment processing**. It has a persistent disclosure banner. Its owner dashboard is read-only. It is never silently substituted for an unavailable production API.

## Run the full application

Requires Docker with Compose. No cloud account is required for the local PostgreSQL-backed simulator.

```sh
cp .env.example .env
# Optional, but required to sign into the owner dashboard:
npm install
npm run admin:password -- 'replace-with-a-long-unique-passphrase'
# Paste the printed scrypt hash into ADMIN_PASSWORD_HASH in .env.
docker compose up --build
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Open **http://localhost:3000**. The local confirmation-email inbox is **http://localhost:8025**. Docker binds these ports to loopback rather than exposing them on the network. The migration service initializes five cabins and the editorial content before the app starts.

Do not use the example database password or a test owner passphrase for an internet-facing deployment.

### Fast local development

```sh
docker compose up -d db mail
npm install
npm run dev
```

The development script migrates the database, runs the TypeScript API on port 3001 and Next.js on port 3000, and proxies `/api` to the API. Use the same `.env` configuration as above. The default example database password matches the local Compose database.

### Stripe sandbox

1. Set `PAYMENT_PROVIDER=stripe`, your `sk_test_...` secret, the exact public `APP_ORIGIN`, and `STRIPE_WEBHOOK_SECRET` on the API server. No secret is prefixed `NEXT_PUBLIC_` or bundled into the browser.
2. Start a Stripe CLI listener for `/api/webhooks/stripe`, or register that endpoint in the Stripe sandbox dashboard. Subscribe to Checkout completed, expired, asynchronous succeeded and asynchronous failed events.
3. Complete a real hosted **test** Checkout using a Stripe test card. A browser redirect does not confirm a reservation; the verified webhook does.
4. Review the on-screen confirmation, calendar change and cancellation/refund result.

Live Stripe keys and live events are rejected. `APP_ENV=production` also rejects the local simulator and requires HTTPS, owner authentication configuration and Stripe test credentials. A sandbox account and its secrets must be supplied by the operator; this repository does not contain them.

See [Stripe's fulfillment documentation](https://docs.stripe.com/checkout/fulfillment) and [test-payment documentation](https://docs.stripe.com/testing).

## Booking invariants

The `no_overlapping_inventory` constraint in `db/001_initial.sql` applies a GiST exclusion to `(cabin_id, daterange(start_date, end_date, '[)'))` for all inventory-occupying statuses. Check-out is exclusive, so back-to-back stays are valid. The database rejects conflicting writes even when the application availability check is bypassed.

A reservation progresses from `holding` to `confirmed` only after a matching, verified paid session. Duplicate events are idempotent. Failed payments do not confirm. Stale Stripe holds are released only after the provider confirms expiry; an ambiguous provider timeout is handled conservatively. Unexpected late payment on released inventory queues a full test refund instead of resurrecting the booking.

Early cancellation creates a durable, idempotent refund job. Inventory remains occupied while refund settlement is unresolved. Jobs use leases and retries so server restarts do not lose refunds or confirmations. Email is at-least-once delivery with a stable Message-ID; SMTP does not provide an exactly-once delivery guarantee.

## Scope and pricing

Cabins: **Salt, Dune, Drift, Cove, Pine**. Capacities are 2, 2, 4, 4 and 2 guests. Stays are 2–21 nights and open from tomorrow to one year ahead. Prices use integer CAD cents.

The base seasonal schedule is June–August ×1.30; November–March ×0.85; other months ×1.00. Friday and Saturday nights add ×1.10. Exact date overrides replace those multipliers. Breakfast is CAD 24 per guest per night; the private sauna is CAD 85 per stay. Final cleaning is CAD 65. The 15% tax is explicitly illustrative and configurable in the pricing implementation; no real tax jurisdiction is represented.

The saved cancellation policy provides a full test refund at least seven calendar days before check-in, and no refund after that. Real-world deployment requires business-specific policies and verified operating information.

## Verification

```sh
npm run typecheck
npm test
# Integration tests reset data: use ONLY a separate database ending in _test.
# Create tidehouse_test, then point DATABASE_URL at it before running:
npm run test:integration
npm run build
npx playwright install chromium
npm run test:e2e
```

CI creates an isolated PostgreSQL 18 database, generates test-only owner credentials, runs all verification, and uploads `tidehouse-source-and-visual-evidence` plus the browser report. The concurrency test launches 20 competing reservation requests and requires exactly one winner. A second test bypasses application checks with 10 direct concurrent database writes.

The workflow additionally attempts a GitHub Pages deployment of the **separately labelled browser-only preview** after verification succeeds. Pages is not a PostgreSQL/Stripe hosting environment. Use the Docker image or the supplied `render.yaml` blueprint to host the full application; review hosting charges before provisioning a service.

## Project structure

```text
app/                  Next.js pages, metadata, responsive design system
components/           Property map, cabins, comparison, booking and owner UI
lib/                  Shared catalog, contracts, pricing and client adapters
server/               TypeScript API, sessions, payment state machine, outbox
 db/                  PostgreSQL migration and inventory exclusion
scripts/              Local development and owner-passphrase utilities
tests/                Unit, integration, browser and accessibility checks
docs/                 Architecture, brief, asset provenance and launch checklist
```

## Design and asset provenance

[Figma project](https://www.figma.com/design/iTRT2IHhmym8yHipA6YISj)

The property map, floor-plan illustrations, logo mark, layout and copy are custom project work. Photos are **Unsplash architectural and landscape references**, not photographs of a real TIDEHOUSE property and not newly generated images. They are labelled as references in the interface. See [the asset register](docs/ASSETS.md). Replace them with a coherent commissioned or generated property series before presenting the concept as a real retreat.

This project is not a live accommodation business. It does not claim real guests, reviews, awards, availability at a physical property, or a certified accessibility audit.
