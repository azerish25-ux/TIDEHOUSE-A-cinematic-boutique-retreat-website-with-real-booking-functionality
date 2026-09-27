import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import type { Booking } from '../lib/bookings.ts';
import { readStayLink, selectionKey } from '../lib/stay-link.ts';
import { checkoutParameters } from '../lib/checkout-request.ts';
import { checkout, type CheckoutGateway } from '../lib/payments.ts';
import { floorPlans } from '../lib/floor-plans.ts';
import { cabins } from '../lib/catalog.ts';
import { addDays, quoteStay } from '../lib/domain.ts';
process.env.APP_SECRET ||= 'isolated-test-only-secret-at-least-32-characters';
process.env.APP_URL ||= 'http://localhost:3000';
const clock = '2027-01-01';
const parse = (query: string) => readStayLink(new URLSearchParams(query), clock);

test('fractional, out-of-range and non-numeric cabin IDs recover to a real cabin', () => {
  for (const raw of ['1.5', '0', '-2', '6', 'Infinity', 'NaN', 'abc', '']) {
    const result = parse(`cabin=${encodeURIComponent(raw)}`);
    assert.equal(result.selection.cabinId, 1); assert.equal(result.corrected, true);
  }
});
test('all five canonical cabin links remain supported', () => {
  for (const cabin of cabins) { const r = parse(`cabin=${cabin.id}`); assert.equal(r.selection.cabinId, cabin.id); assert.equal(r.corrected, false); }
});
test('fractional guest counts do not enter state', () => {
  for (const raw of ['2.5', '0', '5', 'abc']) { const r = parse(`guests=${raw}`); assert.equal(r.selection.guests, 2); assert.equal(r.corrected, true); }
});
test('missing parameters use a valid two-guest three-night stay', () => {
  const r = parse(''); assert.equal(r.corrected, false);
  assert.equal(r.selection.arrival, '2027-01-15'); assert.equal(r.selection.departure, '2027-01-18');
});
test('invalid, past and distant dates recover without unsafe date formatting', () => {
  for (const arrival of ['2027-02-30', 'broken', '2026-12-31', '9999-12-31']) {
    const r = parse(`arrival=${arrival}`); assert.equal(r.corrected, true); assert.equal(r.selection.arrival, '2027-01-15');
  }
});
test('departure is validated relative to the actual arrival, including missing departure', () => {
  assert.equal(parse('arrival=2027-03-10').selection.departure, '2027-03-13');
  for (const departure of ['2027-03-09', '2027-03-11', '2027-04-02', 'bad']) {
    const r = parse(`arrival=2027-03-10&departure=${departure}`); assert.equal(r.selection.departure, '2027-03-13'); assert.equal(r.corrected, true);
  }
});
test('valid guest, cabin and date details are preserved', () => {
  assert.deepEqual(parse('cabin=3&guests=4&arrival=2027-04-01&departure=2027-04-06'), { corrected: false, selection: { cabinId: 3, guests: 4, arrival: '2027-04-01', departure: '2027-04-06', addons: [] } });
});
test('quote identities change with dates, guests and extras but ignore extra ordering', () => {
  const s = parse('').selection;
  assert.notEqual(selectionKey(s), selectionKey({ ...s, guests: 1 }));
  assert.notEqual(selectionKey(s), selectionKey({ ...s, departure: addDays(s.departure, 1) }));
  assert.equal(selectionKey({ ...s, addons: ['sauna', 'breakfast'] }), selectionKey({ ...s, addons: ['breakfast', 'sauna'] }));
});
test('each cabin has its own bounded floor plan with the advertised area', () => {
  assert.deepEqual(Object.keys(floorPlans), ['1','2','3','4','5']);
  assert.equal(new Set(Object.values(floorPlans).map(p => JSON.stringify(p))).size, 5);
  for (const c of cabins) {
    const p = floorPlans[c.id]; assert.ok(Math.abs(p.width * p.depth - c.area) < 0.01);
    for (const room of p.rooms) { assert.ok(room.x >= 0 && room.y >= 0); assert.ok(room.x + room.w <= p.width + 0.001); assert.ok(room.y + room.h <= p.depth + 0.001); }
    for (const bed of p.beds) { assert.ok(bed.x + bed.w < p.width); assert.ok(bed.y + bed.h < p.depth); }
  }
});
test('Cove has a queen; Saltgrass has one king and two singles; Headland has two kings', () => {
  assert.deepEqual(floorPlans[4].beds.map(b => b.kind), ['queen']);
  assert.deepEqual(floorPlans[3].beds.map(b => b.kind), ['king', 'single', 'single']);
  assert.deepEqual(floorPlans[5].beds.map(b => b.kind), ['king', 'king']);
  assert.equal(floorPlans[2].turning?.diameter, 1.5);
});
function fixture(): Booking {
  const selection = parse('').selection;
  return { id: '5ab79b73-cc8d-4fa7-93a1-89ac6a2c6a47', cabin_id: 1, arrival: selection.arrival, departure: selection.departure, guests: 2, guest_name: 'Test Guest', guest_email: 'guest@example.test', status: 'held', quote: quoteStay(29500, selection), total: quoteStay(29500, selection).total, provider: 'stripe', provider_session_id: null, payment_intent: null, hold_until: new Date('2027-01-01T12:35:00Z'), paid_at: null, is_block: false, request_hash: 'fixture', created_at: new Date('2027-01-01T12:00:00Z') };
}
const session = { id: 'cs_test_fixture', url: 'https://checkout.stripe.com/c/pay/cs_test_fixture', status: 'open', payment_status: 'unpaid', livemode: false } as const;
function poolStub(write: () => Promise<void> = async () => {}) {
  return { query: async () => { await write(); return { rows: [], rowCount: 1 }; } } as unknown as Pool;
}
test('Stripe request expiry is fixed by the stored hold, with initial minimum-expiry headroom', t => {
  const b = fixture(); t.mock.method(Date, 'now', () => Date.parse('2027-01-01T12:00:01Z'));
  const before = checkoutParameters(b, 'http://localhost:3000/booking/example#private');
  assert.equal(before.expires_at, Date.parse('2027-01-01T12:34:00Z') / 1000);
  assert.ok(before.expires_at! - Date.now()/1000 > 1800);
  t.mock.method(Date, 'now', () => Date.parse('2027-01-01T12:08:00Z'));
  assert.deepEqual(checkoutParameters(b, 'http://localhost:3000/booking/example#private'), before);
});
test('a lost provider response keeps the private link and recovers the same checkout parameters', async t => {
  const calls: { params: unknown; key: string | undefined }[] = [];
  const gateway: CheckoutGateway = {
    create: async (params, options) => { calls.push({ params, key: options.idempotencyKey }); if (calls.length === 1) throw new Error('Response lost after provider accepted'); return session; },
    retrieve: async () => session,
  };
  const b = fixture(), pool = poolStub();
  const first = await checkout(pool, b, gateway);
  assert.equal(first.checkoutPending, true); assert.match(first.url, /\/booking\/.*#[A-Za-z0-9_-]{43}$/);
  t.mock.method(Date, 'now', () => Date.parse('2027-01-01T12:08:00Z'));
  const second = await checkout(pool, b, gateway);
  assert.equal(second.url, session.url); assert.equal(second.token, first.token);
  assert.deepEqual(calls[1], calls[0]); assert.equal(calls[0].key, `checkout:${b.id}`);
});
test('a failed database attachment can replay the accepted checkout without a new session', async () => {
  let writes = 0, creates = 0; const cache = new Map<string, string>();
  const gateway: CheckoutGateway = {
    create: async (params, options) => { creates++; const key = options.idempotencyKey!; const canonical = JSON.stringify(params); if (cache.has(key)) assert.equal(cache.get(key), canonical); cache.set(key, canonical); return session; },
    retrieve: async () => session,
  };
  const pool = poolStub(async () => { if (++writes === 1) throw new Error('Database response lost'); });
  assert.equal((await checkout(pool, fixture(), gateway)).checkoutPending, true);
  assert.equal((await checkout(pool, fixture(), gateway)).url, session.url);
  assert.equal(cache.size, 1); assert.equal(creates, 2); assert.equal(writes, 2);
});
test('known checkout is retrieved, not recreated', async () => {
  let creates = 0;
  const gateway: CheckoutGateway = { create: async () => { creates++; return session; }, retrieve: async id => { assert.equal(id, session.id); return session; } };
  assert.equal((await checkout(poolStub(), { ...fixture(), provider_session_id: session.id }, gateway)).url, session.url); assert.equal(creates, 0);
});
test('closed checkout returns management page without assuming payment success', async () => {
  const gateway: CheckoutGateway = { create: async () => session, retrieve: async () => ({ ...session, status: 'complete', payment_status: 'paid' }) };
  const b = { ...fixture(), provider_session_id: session.id };
  const r = await checkout(poolStub(), b, gateway); assert.match(r.url, /\/booking\//); assert.equal(b.status, 'held');
});
test('live sessions are rejected rather than redirecting the visitor', async () => {
  const gateway: CheckoutGateway = { create: async () => ({ ...session, livemode: true }), retrieve: async () => session };
  await assert.rejects(() => checkout(poolStub(), fixture(), gateway), /live payment session was rejected/i);
});
test('invalid stored hold never generates a checkout request', () => {
  assert.throws(() => checkoutParameters({ ...fixture(), hold_until: null }, 'http://localhost:3000'), /valid payment hold/);
});
