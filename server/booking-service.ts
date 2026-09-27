import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db';
import { config } from './config';
import { hash, sameSecret } from './security';
import { requireStripe, type PaidSession } from './payments';
import { cabins, getCabin } from '../lib/catalog';
import { buildQuote, DomainError, refundAmount, validateStay } from '../lib/pricing';
import type { ReservationRequest, StayInput, Booking, Quote, ReservationResult } from '../lib/types';
export type ReservationRow = Booking & { kind: string; name: string; email: string; token_hash: string; payload_hash: string; checkout_id: string | null; checkout_url: string | null; payment_intent: string | null; total_cents: number; refunded_cents: number; idempotency_key: string };
const blocking = "('holding','confirmed','blocked','cancelling')";
export function mapDatabaseError(error: unknown): never {
  if (typeof error === 'object' && error && 'code' in error && error.code === '23P01') throw new DomainError('Those dates have just been reserved. Please choose another cabin or change your dates.', 409, 'DATES_UNAVAILABLE');
  throw error;
}
async function quoteWithClient(client: PoolClient, input: StayInput): Promise<Quote> {
  validateStay(input);
  const rate = await client.query('SELECT base_rate FROM cabins WHERE id=$1', [input.cabinId]);
  const overrides = await client.query('SELECT stay_date,amount FROM rates WHERE cabin_id=$1 AND stay_date >= $2 AND stay_date < $3', [input.cabinId, input.checkIn, input.checkOut]);
  return buildQuote(input, { baseRate: rate.rows[0]?.base_rate, overrides: Object.fromEntries(overrides.rows.map(r => [r.stay_date, r.amount])) });
}
export async function quoteStay(input: StayInput) { return transaction(client => quoteWithClient(client, input)); }
export async function availability(input: Omit<StayInput, 'cabinId'>) {
  return transaction(async client => {
    const output = [];
    for (const cabin of cabins) {
      if (input.guests > cabin.capacity) { output.push({ cabinId: cabin.id, available: false, quote: null, reason: `Up to ${cabin.capacity} guests` }); continue; }
      const quote = await quoteWithClient(client, { ...input, cabinId: cabin.id });
      const found = await client.query(`SELECT 1 FROM reservations WHERE cabin_id=$1 AND status IN ${blocking} AND daterange(start_date,end_date,'[)') && daterange($2::date,$3::date,'[)') LIMIT 1`, [cabin.id, input.checkIn, input.checkOut]);
      output.push({ cabinId: cabin.id, available: !found.rowCount, quote, ...(found.rowCount ? { reason: 'Not available for these dates' } : {}) });
    }
    return output;
  });
}
export async function calendar(cabinId: string) {
  if (!getCabin(cabinId)) throw new DomainError('Cabin not found.', 404);
  const { rows } = await pool.query(`SELECT start_date AS start,end_date AS end,CASE WHEN status='holding' THEN 'held' ELSE 'unavailable' END AS status FROM reservations WHERE cabin_id=$1 AND status IN ${blocking} AND end_date>=current_date ORDER BY start_date`, [cabinId]);
  return rows;
}
export async function reserve(input: ReservationRequest): Promise<ReservationResult> {
  const payload = hash(JSON.stringify({ cabinId: input.cabinId, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, addOns: [...input.addOns].sort(), name: input.name.trim(), email: input.email.toLowerCase().trim(), expectedTotal: input.expectedTotal }));
  let row: ReservationRow;
  try {
    row = await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`request:${input.idempotencyKey}`]);
      const previous = await client.query<ReservationRow>('SELECT * FROM reservations WHERE idempotency_key=$1 FOR UPDATE', [input.idempotencyKey]);
      if (previous.rowCount) {
        const existing = previous.rows[0];
        if (!sameSecret(existing.token_hash, hash(input.accessToken)) || existing.payload_hash !== payload) throw new DomainError('This checkout attempt has changed. Review your stay and start a new checkout.', 409, 'IDEMPOTENCY_MISMATCH');
        return existing;
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cabin:${input.cabinId}`]);
      const quote = await quoteWithClient(client, input);
      if (quote.total !== input.expectedTotal) throw new DomainError('The rate has changed. Refresh the price and review it before continuing.', 409, 'PRICE_CHANGED');
      if (config.provider === 'stripe') requireStripe();
      const result = await client.query<ReservationRow>(`INSERT INTO reservations(id,cabin_id,start_date,end_date,guests,kind,status,name,email,token_hash,idempotency_key,payload_hash,quote,total_cents,provider,hold_expires_at) VALUES($1,$2,$3,$4,$5,'booking','holding',$6,$7,$8,$9,$10,$11,$12,$13,now()+interval '35 minutes') RETURNING *`, [randomUUID(), input.cabinId, input.checkIn, input.checkOut, input.guests, input.name.trim(), input.email.toLowerCase().trim(), hash(input.accessToken), input.idempotencyKey, payload, JSON.stringify(quote), quote.total, config.provider]);
      return result.rows[0];
    });
  } catch (error) { return mapDatabaseError(error); }
  try { return await ensureCheckout(row); }
  catch {
    // The reservation already exists. Preserve the guest's management path
    // during an ambiguous provider timeout instead of hiding the held booking.
    // The management page can retry the same idempotent checkout operation.
    return { id: row.id, status: row.status, checkoutUrl: null, provider: row.provider };
  }
}
export async function ensureCheckout(row: ReservationRow): Promise<ReservationResult> {
  const result = (url: string | null): ReservationResult => ({ id: row.id, status: row.status, checkoutUrl: url, provider: row.provider });
  if (row.status !== 'holding') return result(null);
  if (row.checkout_id) return result(row.checkout_url);
  if (row.provider === 'simulated') {
    await pool.query('UPDATE reservations SET checkout_id=$2 WHERE id=$1 AND checkout_id IS NULL', [row.id, `sim_${row.id}`]);
    return result(null);
  }
  // Immutable parameters and an idempotency key let retries recover an accepted
  // checkout after a network timeout. Unknown provider outcomes KEEP the hold.
  const session = await requireStripe().checkout.sessions.create({
    mode: 'payment', payment_method_types: ['card'], customer_email: row.email,
    client_reference_id: row.id, metadata: { bookingId: row.id },
    payment_intent_data: { metadata: { bookingId: row.id } },
    expires_at: Math.floor(new Date(row.hold_expires_at).getTime() / 1000),
    line_items: [{ quantity: 1, price_data: { currency: 'cad', unit_amount: row.total_cents, product_data: { name: `TIDEHOUSE · ${getCabin(row.cabin_id)?.name} · ${row.start_date} to ${row.end_date}`, description: 'Complete stay total including selected extras, cleaning and illustrative tax. TEST PAYMENT ONLY.' } } }],
    success_url: `${config.origin}/booking/?id=${row.id}`,
    cancel_url: `${config.origin}/booking/?id=${row.id}&checkout=cancelled`,
  }, { idempotencyKey: `checkout:${row.id}` });
  await pool.query('UPDATE reservations SET checkout_id=$2,checkout_url=$3,updated_at=now() WHERE id=$1 AND (checkout_id IS NULL OR checkout_id=$2)', [row.id, session.id, session.url]);
  return result(session.url);
}
export async function authorizeBooking(id: string, token: string): Promise<ReservationRow> {
  const { rows } = await pool.query<ReservationRow>("SELECT * FROM reservations WHERE id=$1 AND kind='booking'", [id]);
  if (!rows.length || !sameSecret(rows[0].token_hash, hash(token))) throw new DomainError('This private booking link is invalid or no longer available.', 404, 'BOOKING_NOT_FOUND');
  return rows[0];
}
export function publicBooking(row: ReservationRow): Booking {
  return { id: row.id, cabin_id: row.cabin_id, start_date: row.start_date, end_date: row.end_date, guests: row.guests, status: row.status, quote: row.quote, provider: row.provider, hold_expires_at: row.hold_expires_at, created_at: row.created_at, checkout_url: row.status === 'holding' ? row.checkout_url : null, refund_cents: row.refund_cents };
}
export async function settleEvent(eventId: string, type: string, session: PaidSession) {
  if (session.livemode) throw new DomainError('Live payment events are not accepted.', 400);
  const id = session.metadata?.bookingId;
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) return;
  await transaction(async client => {
    const event = await client.query('INSERT INTO payment_events(id,type) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id', [eventId, type]);
    if (!event.rowCount) return;
    const { rows } = await client.query<ReservationRow>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [id]);
    const row = rows[0]; if (!row || row.kind !== 'booking') return;
    if (row.checkout_id && row.checkout_id !== session.id) throw new DomainError('Payment session does not match this reservation.', 400);
    const paid = ['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(type) && session.payment_status === 'paid';
    if (paid) {
      if (session.amount_total !== row.total_cents || session.currency !== 'cad') throw new DomainError('Payment amount or currency does not match the saved quote.', 400);
      const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      if (!intent) throw new DomainError('The paid session has no payment reference.', 400);
      if (row.payment_intent && row.payment_intent !== intent) throw new DomainError('Payment reference does not match this reservation.', 400);
      if (['confirmed','cancelling','payment_conflict'].includes(row.status)) return;
      // A cancelled paid booking has already applied its refund policy. A
      // cancelled unpaid hold has not: an unexpected late payment needs refund.
      if (row.status === 'cancelled' && row.payment_intent === intent) return;
      if (row.status === 'holding') {
        await client.query("UPDATE reservations SET status='confirmed',checkout_id=$2,payment_intent=$3,updated_at=now() WHERE id=$1", [id, session.id, intent]);
        await client.query("INSERT INTO outbox(reservation_id,kind) VALUES($1,'confirmation') ON CONFLICT DO NOTHING", [id]);
      } else {
        // Never resurrect released inventory; refund unexpected late payment.
        await client.query("UPDATE reservations SET status='payment_conflict',checkout_id=$2,payment_intent=$3,refund_cents=total_cents,updated_at=now() WHERE id=$1", [id, session.id, intent]);
        await client.query("INSERT INTO outbox(reservation_id,kind) VALUES($1,'refund') ON CONFLICT DO NOTHING", [id]);
      }
    } else if (type === 'checkout.session.expired' || type === 'checkout.session.async_payment_failed') {
      await client.query("UPDATE reservations SET status=$2,updated_at=now() WHERE id=$1 AND status='holding'", [id, type.endsWith('expired') ? 'expired' : 'failed']);
    }
  });
}
export async function simulatePayment(id: string, token: string, outcome: 'paid' | 'failed') {
  const row = await authorizeBooking(id, token);
  if (config.provider !== 'simulated' || row.provider !== 'simulated') throw new DomainError('Payment simulation is disabled.', 404);
  if (row.status !== 'holding') throw new DomainError('This checkout is no longer open.', 409);
  if (new Date(row.hold_expires_at).getTime() <= Date.now()) { await releaseExpired(row); throw new DomainError('This checkout hold has expired.', 409); }
  await settleEvent(`sim:${id}:${outcome}`, outcome === 'paid' ? 'checkout.session.completed' : 'checkout.session.async_payment_failed', { id: `sim_${id}`, payment_status: outcome === 'paid' ? 'paid' : 'unpaid', amount_total: row.total_cents, currency: 'cad', metadata: { bookingId: id }, payment_intent: `pi_sim_${id}`, livemode: false });
  return publicBooking(await authorizeBooking(id, token));
}
export async function releaseExpired(row: ReservationRow) {
  if (row.provider === 'simulated') {
    await pool.query("UPDATE reservations SET status='expired',updated_at=now() WHERE id=$1 AND status='holding' AND hold_expires_at<=now()", [row.id]);
    return;
  }
  // A local clock is NOT sufficient evidence to release a payable Stripe hold.
  if (!row.checkout_id) { await ensureCheckout(row); return; }
  let session = await requireStripe().checkout.sessions.retrieve(row.checkout_id);
  if (session.payment_status === 'paid') { await settleEvent(`reconcile:paid:${session.id}`, 'checkout.session.completed', session); return; }
  if (session.status === 'open') {
    try { session = await requireStripe().checkout.sessions.expire(session.id); }
    catch { session = await requireStripe().checkout.sessions.retrieve(session.id); }
  }
  if (session.payment_status === 'paid') { await settleEvent(`reconcile:paid:${session.id}`, 'checkout.session.completed', session); return; }
  if (session.status === 'expired') await settleEvent(`reconcile:expired:${session.id}`, 'checkout.session.expired', session);
}
export async function cancelBooking(id: string, token: string) {
  let row = await authorizeBooking(id, token);
  if (row.status === 'holding') {
    if (row.provider === 'stripe') {
      if (!row.checkout_id) { await ensureCheckout(row); row = await authorizeBooking(id, token); }
      if (!row.checkout_id) throw new DomainError('The payment provider has not resolved this checkout yet. Your dates remain protected; retry shortly.', 503);
      let session = await requireStripe().checkout.sessions.retrieve(row.checkout_id);
      if (session.status === 'open') {
        try { session = await requireStripe().checkout.sessions.expire(session.id); }
        catch { session = await requireStripe().checkout.sessions.retrieve(session.id); }
      }
      if (session.payment_status === 'paid') await settleEvent(`reconcile:paid:${session.id}`, 'checkout.session.completed', session);
      else if (session.status !== 'expired') throw new DomainError('Payment is still being resolved. Retry cancellation shortly.', 409);
    }
    await pool.query("UPDATE reservations SET status='cancelled',updated_at=now() WHERE id=$1 AND status='holding'", [id]);
  }
  await transaction(async client => {
    const { rows } = await client.query<ReservationRow>('SELECT * FROM reservations WHERE id=$1 FOR UPDATE', [id]);
    const current = rows[0];
    if (current.status !== 'confirmed') return;
    const refund = refundAmount(current.quote);
    await client.query("UPDATE reservations SET status=$2,refund_cents=$3,updated_at=now() WHERE id=$1", [id, refund > 0 ? 'cancelling' : 'cancelled', refund]);
    if (refund > 0) await client.query("INSERT INTO outbox(reservation_id,kind) VALUES($1,'refund') ON CONFLICT DO NOTHING", [id]);
  });
  return publicBooking(await authorizeBooking(id, token));
}
export async function reconcileHolds() {
  const { rows } = await pool.query<ReservationRow>("SELECT * FROM reservations WHERE status='holding' AND hold_expires_at<=now() ORDER BY hold_expires_at LIMIT 20");
  for (const row of rows) {
    try { await releaseExpired(row); }
    catch { console.error(`Hold reconciliation deferred for ${row.id}; inventory remains protected.`); }
  }
}
