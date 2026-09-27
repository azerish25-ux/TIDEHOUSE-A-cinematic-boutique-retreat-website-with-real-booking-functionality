# TIDEHOUSE — from a place to stay to a stay you can book

## The brief

Design a direct-booking experience for a fictional coastal retreat: one property, five distinctive cabins, two optional additions, and one complete reservation workflow. The interface should communicate atmosphere without hiding the practical decisions a guest needs to make.

The service demonstrated is **boutique accommodation websites with booking-system integration**. This is not a marketplace, an actual accommodation business, or a live-money checkout.

## The guest experience

The editorial homepage establishes a coastal visual identity through warm paper, sea-glass greens, restrained line illustration, Instrument Serif and DM Sans. The illustrated grounds connect directly to the selected cabin. An accessible cabin list provides the same selection without requiring interaction with a map.

On the stay page, the guest can compare two cabins, inspect their individual concept floor plans and access notes, choose dates and party size, and add breakfast or a private sauna session. The cabin list and comparison use date-specific, server-calculated complete prices rather than substituting a base nightly rate for a quote. Capacity and unavailable dates remain visible.

The selected cabin, dates, guest count, extras and total remain one coherent selection through checkout. A response for earlier dates cannot enable checkout for a later selection. Invalid shareable links recover to valid cabin IDs and dates instead of crashing the page.

## The engineering behind the promise

PostgreSQL is the final authority for inventory. Active holds, confirmed bookings and owner blocks share a date-range exclusion constraint. Adjacent checkout and arrival dates are permitted; overlapping occupancy in the same cabin is not. Application checks provide a readable explanation, but the database constraint also rejects conflicting direct writes.

Prices are calculated in integer CAD cents, night by night, with seasonal/weekend adjustments and owner overrides. Each reservation saves its price snapshot. A changed rate cannot silently alter an existing booking, and an outdated quote cannot reserve at an obsolete total.

A checkout redirect is not proof of payment. Signed Stripe test-mode events must match the reservation, provider session, total and currency. Duplicate events are handled idempotently. A payment arriving after released inventory does not resurrect the stay: it enters refund handling instead.

Checkout request parameters, including expiry, are derived from the saved reservation. A lost provider response or failed session-ID attachment can therefore replay the same idempotency key with identical parameters. The private management screen can resume the original checkout. Browser storage failure does not discard the only private access link.

Cancellation and refund completion are distinct states. The database records refund work durably, and the interface does not describe a pending provider refund as completed. Confirmation and cancellation emails similarly use a persistent outbox, with no claim of delivery before a successful sending response.

## The owner experience

An authenticated studio manages date blocks, nightly rate overrides and plain-text editorial pages. The core demonstration includes publishing a guide edit, changing a rate and blocking dates, followed by observing the changed public information and availability. Private booking capabilities and owner authentication remain separate.

## Verification evidence

The functional release checkpoint `e4e7f181c23b816850447e1390c0141ac87d79f7` passed its complete quality workflow: domain/recovery unit tests, 20 PostgreSQL integration tests, production build, TypeScript checking and 56 browser tests. The browser report recorded **zero skipped, zero failed and zero flaky cases**. Chromium desktop/mobile, WebKit and Firefox are covered, with normal and reduced-motion configurations.

Evidence: https://github.com/azerish25-ux/TIDEHOUSE-A-cinematic-boutique-retreat-website-with-real-booking-functionality/actions/runs/36334830324

The final artwork release must also pass the quality workflow attached to its own commit. Each successful workflow publishes an exact source snapshot, a runnable build, screenshots, the browser report and a `verification.json` containing the tested source commit. Do not attribute an older run to a later source change.

## A three-minute demonstration

Begin with the homepage and illustrated grounds. Select Driftwood, compare it with The Lookout and inspect their access and floor-plan differences. Choose a future three-night stay, add breakfast, and show the complete total. Complete the explicitly labelled local approved-payment simulation, view confirmation and download the receipt. In a second browser, show that those dates are no longer available. Cancel the first reservation and show that inventory is released.

Then demonstrate a declined payment and the owner date-block/rate editor. A genuine Stripe-hosted sandbox demonstration is a separate acceptance step and must not be represented by the local simulator.

## Honest presentation

The new Lookout hero is generated artwork with recorded content hashes. Other photographs remain credited architectural references. Five cabin-specific concept plans replace the old generic capacity-based diagrams, but none are measured building or certified accessibility plans.

No guest testimonials, conversion improvements, revenue figures, live payments or real accommodation availability are asserted. A public deployment, genuine Stripe sandbox transactions, sender-configured emails, the complete photographic series and the final Figma handoff remain required before describing the whole commission as delivered.
