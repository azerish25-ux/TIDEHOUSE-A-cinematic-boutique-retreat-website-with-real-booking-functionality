# Architecture and trust boundaries

## ADR 001 — Next.js frontend, TypeScript API, PostgreSQL

Next.js statically renders the public routes, which hydrate into the interactive property and booking experience. A same-origin Express/TypeScript server serves that output and the booking API. PostgreSQL is the source of truth for inventory, quotes, rates, content, payment events and owner sessions. This separates a portable portfolio preview from the real booking backend without maintaining two visual implementations.

`NEXT_PUBLIC_PREVIEW=1` is an explicit build-time switch. Only that build imports the browser-only preview behavior at runtime; it does not fallback automatically when the server fails. The application must not claim shared inventory correctness from local storage. The database integration tests exercise the real server, not the preview adapter.

## Inventory

All occupied ranges live in one `reservations` relation. `holding`, `confirmed`, `blocked` and `cancelling` rows participate in the same exclusion constraint. This prevents the common bug where owner blocks and guest bookings each validate only against their own table. Intervals are `[arrival, departure)` using date columns, not local-time timestamps.

Per-cabin transaction advisory locks serialize owner rate changes with new quote snapshots; the exclusion constraint is the final authority under races. HTTP 409 is a normal result when another visitor wins the cabin. The public availability response is informative, not a lock.

## Payment boundary

The browser submits dates, guest count and add-on identifiers, not a trusted price. The server recomputes the quote from stored rates, rejects stale totals, stores the immutable breakdown, and creates an idempotent provider checkout. Names, emails and management tokens are not put in public query strings.

Only an HMAC-signed Stripe event, or the explicitly enabled local test simulator, can transition a hold to confirmed. Provider session ID, amount, currency, live/test mode and booking metadata are checked. Event IDs are deduplicated transactionally. An expired event cannot undo a confirmation. Card failures are not automatically treated as terminal while a payable checkout remains open.

Unknown checkout-create outcomes retain inventory. Reconciliation does not assume a local expiry timestamp means the provider can no longer charge. A paid session is fulfilled; a confirmed-expired unpaid session is released. A late success for released inventory is not allowed to regain it; a full refund job is queued.

## Cancellation and outbox

Confirmed cancellations calculate the saved policy on the server. Refundable cancellations enter `cancelling` and continue to occupy dates until the refund job succeeds. Stripe refund requests use a stable idempotency key. Job claims use row locking and a lease; abandoned jobs are retried after the lease expires. Exponential backoff is capped at one hour. Ambiguous refund outcomes remain pending.

Confirmation email is optional infrastructure. No SMTP configuration means no claim that an email was sent. Confirmations remain available on-screen through the private management link. SMTP acceptance is not a delivery receipt and can be at-least-once on process failure.

## Security and privacy

Booking management uses 32 random bytes represented as 64 hex characters. Only the SHA-256 hash is stored in PostgreSQL. A management URL carries the token in the fragment, which is not sent as part of the HTTP request; the client sends it in an Authorization header. The app removes the fragment from the address bar after opening and offers an explicit private-link copy control.

Owner passphrases are scrypt-hashed. Sessions are random, hashed server-side, HttpOnly, SameSite=Strict, eight-hour cookies, with Secure required in production. Every state-changing API route except the signature-verified webhook requires the configured Origin and JSON content type. Owner login and reservation creation have PostgreSQL-backed rate limits. Cookie trust-proxy behavior is opt-in.

CMS body text is escaped by React, not rendered through raw HTML. Optimistic versions reject conflicting owner edits. Logs do not include request bodies, private tokens, card details or guest data. No payment card number is handled by the application.

## Deliberate limits

One property; no customer accounts, loyalty points, channel manager, booking marketplaces, dynamic currency conversion or live charges. A real launch still needs operational credentials, a hosted PostgreSQL service, monitored webhooks, backup/restore procedures, a coherent image set, verified accessibility measurements and business-specific guest policies. The Render blueprint is deployment configuration, not evidence that a service was provisioned.
