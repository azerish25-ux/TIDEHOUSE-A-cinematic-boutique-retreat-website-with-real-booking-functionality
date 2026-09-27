# TIDEHOUSE

**A little closer to doing nothing.** A fictional five-cabin coastal retreat with an editorial website, illustrated property map, cabin comparison, availability calendar, PostgreSQL reservations and test-payment workflows.

## Experience

- `/`: cinematic editorial homepage, five cabin profiles, interactive illustrated grounds, two optional rituals and local field notes.
- `/stay`: select a cabin on the map or accessible list; compare two; browse galleries, plans, accessibility and FAQs; choose 2–21 nights, guest count and extras; review server-calculated prices; continue to payment.
- `/cabins/[slug]`: complete cabin profiles.
- `/booking/[id]#<private-token>`: private payment/confirmation/cancellation page, itemised receipt and calendar download. The token is removed from the address bar and stored in session storage after loading.
- `/studio`: authenticated owner calendar, reservations, date blocks, rates, refund/email queue processing and a plain-text editorial CMS.
- `/field-notes/[slug]`: guide, arrival, accessibility, inclusions, cancellation and privacy information.

Design reference: https://www.figma.com/design/x09xEkNDRwu92uJpDldCUP

## Stack and scope

Next.js App Router, TypeScript, React, PostgreSQL with `btree_gist`, Stripe Checkout in **test mode only**, custom owner CMS, Playwright and axe-core. One retreat; five cabins; breakfast and sauna only. All prices are integer CAD cents. The example 15% tax and property/accessibility details are fictional specifications, not legal, tax or access-certification claims.

## Local setup

Use Node 22.16+ and PostgreSQL 17 or later. The database user needs permission to create the `btree_gist` extension during setup.

```sh
npm install
cp .env.example .env.local
# Set DATABASE_URL, APP_URL, APP_SECRET and ADMIN_PASSWORD_HASH in .env.local.
# Generate a random session secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Generate a password hash, then paste its output into .env.local:
npm run admin:password -- 'replace-with-your-long-unique-password'
npm run db:setup
npm run dev
```

Open http://localhost:3000. Optionally start a local database using `POSTGRES_PASSWORD=<your-password> docker compose up -d`, then configure the matching DATABASE_URL. `db:setup` uses a migration lock and does not overwrite owner-edited content or rates.

The editorial site can be browsed without a database, but reservation APIs fail closed with a clear configuration error. There is no mock fallback that falsely reports a booking as confirmed.

## Payment modes — an important distinction

### Explicit local simulator

Set `PAYMENT_PROVIDER=simulator` and `ALLOW_PAYMENT_SIMULATOR=true`. This is a **local payment-state harness**, not a payment-provider sandbox. The private payment screen provides approved and declined outcomes. It never asks for a card number or takes money. This mode exercises the same PostgreSQL hold, confirmation, cancellation, availability and refund state transitions.

### Actual Stripe sandbox

Set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_WEBHOOK_SECRET=whsec_...`. Configure your real HTTPS APP_URL and register `POST /api/webhooks/stripe` for Checkout session completed, async payment succeeded, async payment failed and expired events. For local testing, use Stripe CLI forwarding to this endpoint and its generated signing secret.

The server creates a 30-minute card-only Checkout session while the database holds inventory for 35 minutes. A success redirect does **not** confirm anything. A signed event must match the booking, session, paid status, exact amount and CAD currency. Live keys and live events are rejected. Account credentials were not supplied with this repository; provider-hosted checkout must be exercised after configuration. Synthetic signature verification is not represented as a real provider transaction.

Official implementation references: https://docs.stripe.com/checkout/fulfillment and https://www.postgresql.org/docs/current/rangetypes.html

## Why two visitors cannot reserve the same nights

Held reservations, confirmed stays and owner blocks share one PostgreSQL table and one partial GiST exclusion constraint:

```sql
EXCLUDE USING gist (cabin_id WITH =, period WITH &&)
WHERE (status IN ('held','confirmed','blocked'))
```

The stored date range is half-open `[arrival, departure)`, allowing adjacent checkout/check-in dates. Cabin row locks serialize related writes; the exclusion constraint still rejects conflicting direct SQL writes or independent workers. Request idempotency is protected by a PostgreSQL advisory lock and a unique request key. Changed payloads under an old key are rejected.

Expired holds are removed from active inventory before relevant writes. An overdue payment does not resurrect a reservation: it is recorded for payment review and a full refund. Duplicated or out-of-order events cannot downgrade an already confirmed stay. Price snapshots are immutable after reservation.

## Cancellation, refunds and email

Cancellation 7+ calendar days before arrival is fully refundable. Later cancellations require explicit acknowledgement of a zero refund. Policy dates use America/Halifax. Cancellation releases inventory immediately; refund completion is tracked separately.

Refund jobs are persistent, leased and idempotent. Provider failures remain visible and retryable. Confirmation/cancellation email jobs are transactionally recorded in an outbox. Optional Resend delivery requires RESEND_API_KEY and EMAIL_FROM. No email is reported as sent without a successful provider response.

Schedule the protected `/api/maintenance` endpoint to expire holds, retry refunds and process the email outbox. Send `Authorization: Bearer <CRON_SECRET>` using a random secret of at least 32 characters. The owner can also run this from the studio. `vercel.json` declares a 15-minute schedule, which requires a hosting plan that supports that cadence; remove or adjust it for a different host. A scheduler is not assumed to be active simply because this file exists.

## Security decisions

The owner password uses salted scrypt, and the signed owner cookie is HTTP-only, SameSite Strict, time-limited, and Secure for HTTPS origins. Owner login is disabled without a configured hash; there is no default password. Mutations require the configured Origin. Private booking credentials are HMAC-derived, validated with constant-time comparison, sent in Authorization headers and excluded from referrers. Treat each management link as a bearer capability.

Validation, capacity and price checks are server-side. Shared PostgreSQL rate limiting protects sensitive endpoints. TRUST_PROXY must only be enabled behind a proxy that overwrites X-Forwarded-For. Content is plain text, never raw HTML. Error logs do not contain request bodies, card data, emails or private links. Full production operation still requires verified legal content, data-retention rules, host monitoring, backups, sender setup and operational review.

## Verification

```sh
npm test
# Point both URLs at a disposable database whose name ends in _test.
DATABASE_URL=postgresql://.../tidehouse_test npm run db:setup
TEST_DATABASE_URL=postgresql://.../tidehouse_test npm run test:integration
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

The integration suite refuses destructive tests on a database name that does not end in `_test`. Tests cover a 12-way reservation race, database-level exclusion, adjacent dates, capacity, stale prices, duplicate requests/events, failed payments, expired holds, late payments, blocks, cancellations/refunds and signed Stripe webhook validation. Browser tests cover desktop/mobile journeys, owner changes, screenshots and automated WCAG A/AA checks.

GitHub Actions runs the checks against a real PostgreSQL service and publishes reports, screenshots, the resolved lockfile and the source snapshot as downloadable artifacts. Check the actual workflow result before treating any check as passed. Automated accessibility checks are not a claim of complete accessibility certification.

## Photography and design provenance

The visual system, typography treatment, wordmark, line illustrations, property map, floor-plan diagrams and page layouts are original code/design work for this project. Photographs are representative Unsplash images, not generated property photographs and not evidence of an actual TIDEHOUSE location. URLs are centralised in `lib/catalog.ts`. Google Fonts supplies Instrument Serif and DM Sans. Fonts and photographs remain subject to their own terms: https://unsplash.com/license and https://fonts.google.com/knowledge/glossary/licensing

Native image generation was not available in the build session. No generated image is falsely described as an original photograph. Replace representative imagery with a coherent commissioned or generated five-cabin asset library before presenting this as a real property.

## Deployment status

This is a deployable Next.js/PostgreSQL repository, not a claim of a live hosted website. A deployment needs a Node-compatible Next.js host, database and configured secrets. The available deployment service was quota-limited during authoring. No live Stripe transaction, real accommodation reservation, email delivery or public production URL is claimed without separate verification.
