# Deployment and sandbox acceptance

## Configure the application, not a static export

Use the repository's Next.js Node/Docker build with a persistent PostgreSQL database. Configure the following in the hosting service's secret/environment settings, not in Git:

- `DATABASE_URL`: the provider-issued PostgreSQL connection string, with the provider's required secure transport settings.
- `APP_URL`: the exact public HTTPS origin. Request-origin checks and private return links must agree with this value.
- `APP_SECRET`: at least 32 random characters, stable between releases. Changing it invalidates existing private management tokens and owner sessions.
- `ADMIN_PASSWORD_HASH`: generate with `npm run admin:password -- '<a unique owner password>'`. Do not configure a public demonstration password for the actual owner role.
- `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_...`, and `STRIPE_WEBHOOK_SECRET=whsec_...` for actual provider-hosted sandbox checkout. Live keys are rejected. Missing webhook configuration is rejected before creating a new payable hold.
- `CRON_SECRET`: a separate random secret of at least 32 characters for the maintenance endpoint.
- `RESEND_API_KEY` and `EMAIL_FROM`: verified sender credentials when demonstrating email delivery.

For a deliberately labelled local simulation instead, use `PAYMENT_PROVIDER=simulator` with `ALLOW_PAYMENT_SIMULATOR=true`. This exercises PostgreSQL booking state but is not a substitute for a payment-provider sandbox.

Run `npm ci`, configure the environment, run `npm run db:setup`, then build and start the application. The setup script preserves existing owner-edited rates and content. The database role must be permitted to create the schema's `btree_gist` extension during initial setup. Keep PostgreSQL off the public web interface.

## Register payment delivery

Register the deployed `POST /api/webhooks/stripe` endpoint for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`. Use its exact signing secret. A successful browser redirect must never change a booking to confirmed without verified provider delivery.

Schedule the protected `/api/maintenance` endpoint with `Authorization: Bearer <CRON_SECRET>`. Do not place this secret in client-side code or a public URL. The hosting account must actually support the desired cadence; a configuration file alone does not establish an active scheduler.

## Record the acceptance exercise

Use only controlled test details and test payments. Record the deployed origin, application commit, booking reference and provider test event/reference IDs, while keeping booking bearer tokens, API keys, passwords and webhook secrets out of public screenshots and reports.

1. Complete a three-night stay with extras through hosted sandbox checkout. Confirm the saved amount, currency, cabin and dates. Wait for signed delivery; show the confirmed state and updated availability in a second browser.
2. Attempt the same cabin/dates concurrently from two independent sessions. Exactly one reservation may acquire the dates; the other must receive an understandable conflict, never a second confirmation.
3. Decline a test card. Confirm that no stay is falsely confirmed. A provider checkout that remains open may permit another card attempt until it expires; this is different from a terminal declined local simulation.
4. Simulate a lost checkout response or refresh the private management page. Resume the original reservation rather than creating a second checkout. The mock recovery tests cover the code contract; repeat the externally observable behavior in the sandbox.
5. Cancel more than seven calendar days before arrival. Show immediate inventory release, a pending refund if applicable, and final provider-confirmed test refund status. Repeat a nonrefundable cancellation with explicit acknowledgement.
6. Verify confirmation and cancellation messages arrive in a controlled inbox, with working private links. Confirm maintenance retries a temporarily failed outbox/refund operation.
7. Restart/redeploy the app and verify that reservations, blocks, rates and content persist. Run the guest and owner journeys on the actual public origin, not only localhost.

## Preserve scope and truthful evidence

Do not enable live payments, real accommodation marketing, third-party channels or a marketplace as part of this portfolio release. Retain the fictional-property disclosure and verified image provenance. Do not publish real guest data or report conversion, revenue, accessibility certification or field-performance metrics without evidence.
