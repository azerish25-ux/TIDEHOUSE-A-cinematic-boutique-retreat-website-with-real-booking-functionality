# TIDEHOUSE — delivery and verification status

Recorded on 27 September 2026. Application source checkpoint: `654ee28937505fe17bfac0c5c2ab8a0db4ff446e`.

**This branch contains a substantial implementation, but it is not a verified, deployed release.** Treat the README's feature descriptions as implementation documentation, not as a statement that every acceptance test has passed.

## Where the work is saved

Branch: `tidehouse/full-booking-experience`.

Draft pull request: [#1 — full direct-booking experience, preserved for integration](https://github.com/azerish25-ux/TIDEHOUSE-A-cinematic-boutique-retreat-website-with-real-booking-functionality/pull/1).

The build started from initial commit `857b8db254187711ae5f9277f47ed0ec8ffe546c`. A separate complete implementation was subsequently added to `main` while this work was in progress. The attempted fast-forward publication therefore failed; both implementations were preserved. The pull request has merge conflicts and has not been merged. Do not resolve this by force-pushing over `main` or blindly replacing its booking data contracts.

## Implementation present in this branch

The source includes an editorial coastal Next.js website; five cabin detail pages; galleries and illustrative floor plans; an original interactive property map; two-cabin comparison; date and capacity selection; per-night seasonal quotes; breakfast and sauna extras; the guest reservation and private management journey; and an owner interface for date blocks, rates and versioned editorial content.

The TypeScript server includes PostgreSQL inventory exclusion, immutable quote snapshots, idempotent checkout requests, Stripe test-mode Checkout and signature verification, event deduplication, cancellation/refund handling, a durable delivery queue, private booking capabilities and separate owner authentication. Docker, local email capture and a hosting blueprint are included. These implementation claims are distinct from runtime verification.

## Verification actually performed

| Check | Result |
| --- | --- |
| Exact committed pricing source recovered and its Git blob hash reproduced | Passed |
| Exact committed unit-test source recovered and its Git blob hash reproduced | Passed |
| Isolated pricing/date test execution | **15 passed, 0 failed, 0 skipped** |
| Full dependency installation | Not completed in this environment |
| Full application TypeScript check | Not run successfully |
| Next.js production build | Not run successfully |
| PostgreSQL migration and integration suite | Authored, not executed |
| Concurrent visitor and direct-SQL overlap tests | Authored, not executed |
| Browser journeys, screenshots and accessibility tests | Authored, not executed |
| Genuine external Stripe sandbox checkout and refund | Not verified; operator credentials were not supplied |
| Hosted application and public booking URL | Not deployed or verified |

### What the isolated test result means

The test run used the exact `lib/pricing.ts` and `tests/unit.test.ts` source from commit `4ec507ffc13e47c657b345ba3fc2539e6dcf0c06`; those two files were unchanged by the subsequent booking-interface fix.

Verified Git blob hashes:

- `lib/pricing.ts`: `26633bd953915e2890d73e26bb4140b1e1d77064`
- `tests/unit.test.ts`: `da69b0ab62a30502275910a1594b20eb1ea26b04`

The files were transpiled with the locally installed TypeScript compiler and executed with Node's test runner. The unavailable catalog module was replaced with a small explicit fixture containing the same five cabin IDs, capacities and base rates, and the two add-on prices. This was **not** a full installed-application test run and was **not** a semantic TypeScript check.

The tests covered impossible dates, leap-year arithmetic, date-only boundaries, exact integer-cent quotes, summer/winter/weekend rates, seasonal boundaries, exact rate overrides, add-on multiplication, duplicate/unknown extras, stay length, capacity, booking horizon, adjacent half-open intervals and cancellation cutoffs.

The test runner reported:

```text
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

No passing PostgreSQL, browser, visual or external payment verification should be inferred from this result. Existing CI failures on the independently changed `main` branch are not test results for this branch either.

## Follow-up fixes already committed

`4ec507ffc13e47c657b345ba3fc2539e6dcf0c06` preserves a private management path when checkout creation has an ambiguous provider outcome. It also routes unexpected payment after cancellation of an unpaid hold into refund reconciliation rather than ignoring that payment or reclaiming released dates.

`654ee28937505fe17bfac0c5c2ab8a0db4ff446e` validates dates arriving through shareable booking URLs, clears availability when a required date is missing, and prevents a stale quote for previous dates, guests or extras from being submitted. These changes received source review, not full runtime verification.

## Figma and photographic assets

The connected Figma account was used to create [the TIDEHOUSE design file](https://www.figma.com/design/iTRT2IHhmym8yHipA6YISj). The file remains **unfinished; an editable page design was not completed**. The Figma connector subsequently confirmed its Starter-plan tool-call limit. Do not present that file as an approved design deliverable.

No new photorealistic images were generated. The website currently uses explicitly disclosed Unsplash architectural and landscape references. The property map, floor-plan illustrations, logo treatment and CSS compositions are original source work, but the references do not form a consistent photographic series of the five designed cabins. See [ASSETS.md](ASSETS.md).

AppDeploy reported its daily limit, so no AppDeploy release or image-generation output was produced. Attempts to change the CI workflow through the connector were blocked and were not applied. The existing workflow still needs an appropriate supported execution path after the competing implementations are reconciled.

## Remaining acceptance work

Resolve the competing implementations without discarding concurrent work, install and lock the dependencies, execute the full typecheck/build/database/browser suites, inspect desktop and mobile screenshots, complete the Figma canvas and coherent photographic series, configure genuine Stripe sandbox/webhook credentials and optional email, and deploy the PostgreSQL-backed application. Re-test payment and refund behavior at that deployed origin.

Until those steps are verified, the accurate delivery description is **committed implementation awaiting integration, runtime verification and final visual assets**, not a finished premium production website.
