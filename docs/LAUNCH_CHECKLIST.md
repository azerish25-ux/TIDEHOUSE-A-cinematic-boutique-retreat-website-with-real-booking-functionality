# Operator launch checklist

This is a working test-booking application, not a claim that hosting or payment credentials have been provisioned.

## Full runtime

- Provision a PostgreSQL service and run the migration with extension permissions for `btree_gist`.
- Build and host the Node application; configure its exact HTTPS origin and health check.
- Set a unique owner passphrase hash. Do not deploy the development example database credentials.
- Supply Stripe sandbox secret and webhook signing keys through the host's secret manager.
- Keep live payments disabled. Verify a genuine Stripe sandbox checkout and cancellation with the deployed webhook, not only a signed fixture.
- Configure optional SMTP with an authorized sender; verify a confirmation is accepted and received.
- Verify the process worker is running and inspect unresolved refund / confirmation jobs.
- Take a backup and verify restore on a separate database. Define operational retention and access controls.

## Product acceptance

- Explore all five cabins and the illustrated map on desktop and mobile.
- Compare two cabins, check access details and inspect the concept floor plan.
- Search dates across a seasonal boundary and include both optional extras.
- Confirm one test booking and verify the calendar becomes unavailable to a second visitor.
- Run the PostgreSQL concurrency suite. Two conflicting reservations must not both acquire inventory.
- Fail a payment; verify no confirmed booking exists and the range is released only when the payment outcome is terminal.
- Cancel early, retry the cancellation and verify a single refund and eventual date release.
- Test owner blocks, base and override rates, stale quote rejection and versioned content edits.
- Review keyboard operation, focus visibility, screen-reader names, reduced motion and mobile overflow.

## Content and photographs

- Replace the reference photography with an approved consistent series; record photographers / licenses or the generation provenance.
- Measure and verify real-world access details before adapting the fictional retreat into an operating property.
- Replace fictional arrival/local-guide information with verified operating details and an actual guest contact channel.
- Review real pricing, tax and cancellation policies for the operating business rather than reusing the illustrative configuration.

## What CI proves, and what it does not

CI exercises PostgreSQL constraints, the server state machine, signed webhook fixtures and the local payment simulator. A passing CI run does not prove that externally supplied Stripe credentials, SMTP delivery or a cloud database have been configured correctly. The GitHub Pages preview is deliberately browser-only and is not a replacement for the full server.
