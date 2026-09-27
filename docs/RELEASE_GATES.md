# TIDEHOUSE release gates

`main` is the authoritative application. The competing draft PR #1 was closed without merging; its branch remains available as an archive. Do not replace main's database contracts with that alternative implementation.

## Implemented and covered by automated checks

- Five cabins, interactive property map, accessible selection and two-cabin comparison.
- Date-specific complete comparison prices, two optional extras and capacity rules.
- Validated public booking links and quotes tied to the current input selection.
- Cabin-specific bed layouts, expandable floor plans and modal focus restoration.
- PostgreSQL reservation exclusion, idempotency, owner blocks and immutable saved prices.
- Failed, late and duplicate payment-event handling; cancellation and durable refunds.
- Immutable Stripe checkout retries and a private resume-checkout screen.
- Owner login, rate changes and editorial publishing.
- Independent accessibility scans and Chromium/WebKit/Firefox regression coverage.

The functional checkpoint e4e7f181c23b816850447e1390c0141ac87d79f7 passed all checks in run 36334830324. Its browser report contains 56 passed, 0 failed, 0 skipped and 0 flaky results. Artwork and subsequent changes must be checked on their own commit; use the attached workflow and its `verification.json`, not this older checkpoint, as the release record.

## Still required for complete portfolio delivery

| Gate | Exact acceptance evidence |
| --- | --- |
| Public full-stack deployment | A stable HTTPS origin, persistent PostgreSQL, working availability after restart, correct application origin and successful deployed smoke tests. A static homepage is insufficient. |
| Genuine payment sandbox | Provider-hosted approved and declined checkout, signed webhook confirmation, duplicate delivery and a completed test refund observed in the provider account. Local simulation and mocked API recovery tests do not satisfy this gate. |
| Confirmation email | Verified sender configuration, successful delivery to a controlled inbox, and a usable private booking link. Queued email is not delivered email. |
| Scheduled maintenance | A configured scheduler invokes the protected maintenance endpoint; expiry, email and refund jobs complete without manually opening the studio. |
| Photographic series | Consistent exterior, interior, bedroom, bathroom and view imagery for each cabin. The Lookout hero is generated; the remaining gallery references have not been replaced by a complete coherent series. |
| Figma handoff | Inspect and finish the authoritative desktop/mobile file, with editable components and every booking/payment/cancellation/owner state. The connector currently reports its plan tool limit; no final Figma approval is claimed. |
| Deployed visual/performance review | Inspect real phone/desktop behavior at the deployed origin; check image delivery, keyboard focus, zoom, normal/reduced motion and loading/failure states. Laboratory/browser checks are not field performance measurements. |

## Account-dependent blockers recorded in the continuation

AppDeploy reported insufficient daily credits for a new deployment until its reset. The Vercel account read returned no accessible teams, and the advertised deploy action returned `Tool deploy_to_vercel not found`. No public deployment URL was produced. Render and Stripe connection suggestions were presented; no provider credentials were invented, committed or substituted with a claim of a real transaction.

The Figma metadata read was blocked by the account's tool-call limit. The main-linked file remains https://www.figma.com/design/x09xEkNDRwu92uJpDldCUP; the older alternate design is not a second release baseline.
