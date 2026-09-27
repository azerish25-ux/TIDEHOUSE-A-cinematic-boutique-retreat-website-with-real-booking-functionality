import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, transaction } from './db';
import { config } from './config';
import { bookingToken, hash, limit, originGuard, requireAdmin, secureToken, verifyPassword } from './security';
import { requireStripe } from './payments';
import { authorizeBooking, availability, calendar, cancelBooking, ensureCheckout, mapDatabaseError, publicBooking, quoteStay, reserve, settleEvent, simulatePayment } from './booking-service';
import { processOutbox } from './outbox';
import { DomainError, parseDate, plusDays, today } from '../lib/pricing';
import { cabins } from '../lib/catalog';
const cabinId = z.enum(['salt','dune','drift','cove','pine']);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
const staySchema = z.object({ cabinId, checkIn: day, checkOut: day, guests: z.number().int().min(1).max(4), addOns: z.array(z.enum(['breakfast','sauna'])).max(2) }).strict();
const reservationSchema = staySchema.extend({ name: z.string().trim().min(2).max(100), email: z.email().max(254), idempotencyKey: uuid, accessToken: z.string().regex(/^[a-f0-9]{64}$/), expectedTotal: z.number().int().positive() }).strict();
const parseId = (req: Request) => uuid.parse(req.params.id);
export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Opener-Policy': 'same-origin' });
  if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});
// Register before JSON parsing: Stripe verifies the exact raw request bytes.
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '128kb' }), async (req, res) => {
  if (config.provider !== 'stripe' || !config.webhookSecret) throw new DomainError('Stripe webhook is not configured.', 503);
  const signature = req.get('stripe-signature');
  if (!signature) throw new DomainError('Missing payment signature.', 400);
  let event;
  try { event = requireStripe().webhooks.constructEvent(req.body, signature, config.webhookSecret); }
  catch { throw new DomainError('Invalid payment signature.', 400); }
  if (event.livemode) throw new DomainError('Live events are not accepted.', 400);
  if (['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type)) {
    await settleEvent(event.id, event.type, event.data.object as import('stripe').Stripe.Checkout.Session);
  }
  res.json({ received: true });
});
app.use('/api', express.json({ limit: '40kb' }), originGuard);
app.get('/api/health', async (_req, res) => { await pool.query('SELECT 1'); res.json({ ok: true, database: 'postgresql', paymentProvider: config.provider, paymentReady: config.provider === 'simulated' || Boolean(config.stripeKey), emailReady: Boolean(config.smtp) }); });
app.get('/api/content', async (_req, res) => { const { rows } = await pool.query('SELECT slug,title,eyebrow,body,version FROM documents ORDER BY slug'); res.json(rows); });
app.post('/api/availability', async (req, res) => { const input = staySchema.omit({ cabinId: true }).parse(req.body); res.json(await availability(input)); });
app.post('/api/quote', async (req, res) => { res.json(await quoteStay(staySchema.parse(req.body))); });
app.get('/api/calendar/:cabinId', async (req, res) => { res.json(await calendar(cabinId.parse(req.params.cabinId))); });
app.post('/api/reservations', async (req, res) => {
  await limit(`reserve:${hash(req.ip || 'unknown')}`, 40, 600);
  res.status(201).json(await reserve(reservationSchema.parse(req.body)));
});
app.get('/api/reservations/:id', async (req, res) => {
  const row = await authorizeBooking(parseId(req), bookingToken(req));
  const email = await pool.query("SELECT state FROM outbox WHERE reservation_id=$1 AND kind='confirmation'", [row.id]);
  res.json({ ...publicBooking(row), email_status: !config.smtp ? 'not_configured' : email.rows[0]?.state === 'done' ? 'sent' : 'pending' });
});
app.post('/api/reservations/:id/checkout', async (req, res) => { res.json(await ensureCheckout(await authorizeBooking(parseId(req), bookingToken(req)))); });
app.post('/api/reservations/:id/simulate', async (req, res) => {
  const { outcome } = z.object({ outcome: z.enum(['paid','failed']) }).strict().parse(req.body);
  res.json(await simulatePayment(parseId(req), bookingToken(req), outcome));
});
app.post('/api/reservations/:id/cancel', async (req, res) => {
  const id = parseId(req); const token = bookingToken(req);
  await cancelBooking(id, token);
  // The durable outbox remains authoritative if an immediate attempt fails.
  await processOutbox();
  res.json(publicBooking(await authorizeBooking(id, token)));
});
app.post('/api/admin/login', async (req, res) => {
  await limit(`login:${hash(req.ip || 'unknown')}`, 8, 900);
  if (!config.adminHash) throw new DomainError('Owner login is not configured. Set ADMIN_PASSWORD_HASH on the server.', 503);
  const { password } = z.object({ password: z.string().min(1).max(256) }).strict().parse(req.body);
  if (!verifyPassword(password)) throw new DomainError('The passphrase is not correct.', 401);
  const token = secureToken();
  await pool.query("INSERT INTO admin_sessions(token_hash,expires_at) VALUES($1,now()+interval '8 hours')", [hash(token)]);
  res.cookie('tidehouse_admin', token, { httpOnly: true, secure: config.production, sameSite: 'strict', path: '/api/admin', maxAge: 8 * 3600000 });
  res.json({ ok: true });
});
app.use('/api/admin', requireAdmin);
app.post('/api/admin/logout', async (req, res) => {
  const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('tidehouse_admin='))?.split('=')[1];
  if (token) await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1', [hash(token)]);
  res.clearCookie('tidehouse_admin', { path: '/api/admin' }); res.json({ ok: true });
});
app.get('/api/admin/overview', async (_req, res) => {
  const [bookings, rates, blocks, docs, jobs] = await Promise.all([
    pool.query("SELECT id,cabin_id,start_date,end_date,guests,name,email,status,total_cents,refund_cents,provider,created_at FROM reservations WHERE kind='booking' ORDER BY created_at DESC LIMIT 200"),
    pool.query('SELECT * FROM cabins ORDER BY id'),
    pool.query("SELECT id,cabin_id,start_date,end_date,block_note FROM reservations WHERE kind='block' AND status='blocked' ORDER BY start_date"),
    pool.query('SELECT * FROM documents ORDER BY slug'),
    pool.query("SELECT id,reservation_id,kind,state,attempts,last_error FROM outbox WHERE state!='done' ORDER BY id LIMIT 100"),
  ]);
  const overrides = await pool.query('SELECT * FROM rates WHERE stay_date>=current_date ORDER BY stay_date,cabin_id LIMIT 2000');
  res.json({ bookings: bookings.rows, cabins: rates.rows, blocks: blocks.rows, documents: docs.rows, jobs: jobs.rows, overrides: overrides.rows, paymentProvider: config.provider, emailReady: Boolean(config.smtp) });
});
app.post('/api/admin/blocks', async (req, res) => {
  const input = z.object({ cabinId, start: day, end: day, note: z.string().trim().min(1).max(200) }).strict().parse(req.body);
  parseDate(input.start); parseDate(input.end);
  if (input.start < today() || input.end <= input.start || input.end > plusDays(input.start, 365)) throw new DomainError('Choose a future block of 1–365 nights.');
  try {
    const id = await transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cabin:${input.cabinId}`]);
      const id = randomUUID();
      await client.query("INSERT INTO reservations(id,cabin_id,start_date,end_date,guests,kind,status,provider,hold_expires_at,block_note) VALUES($1,$2,$3,$4,0,'block','blocked',$5,now(),$6)", [id, input.cabinId, input.start, input.end, config.provider, input.note]);
      await client.query("INSERT INTO audit_log(action,target,detail) VALUES('block.created',$1,$2)", [id, JSON.stringify(input)]);
      return id;
    });
    res.status(201).json({ id });
  } catch (error) { mapDatabaseError(error); }
});
app.post('/api/admin/blocks/:id/remove', async (req, res) => {
  await transaction(async client => {
    const result = await client.query("UPDATE reservations SET status='cancelled',updated_at=now() WHERE id=$1 AND kind='block' AND status='blocked' RETURNING id", [parseId(req)]);
    if (!result.rowCount) throw new DomainError('Date block not found.', 404);
    await client.query("INSERT INTO audit_log(action,target) VALUES('block.removed',$1)", [parseId(req)]);
  }); res.json({ ok: true });
});
app.post('/api/admin/rates', async (req, res) => {
  const input = z.object({ cabinId, amount: z.number().int().min(1000).max(1000000).nullable(), start: day.optional(), end: day.optional(), version: z.number().int().positive() }).strict().parse(req.body);
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cabin:${input.cabinId}`]);
    const current = await client.query('SELECT * FROM cabins WHERE id=$1 FOR UPDATE', [input.cabinId]);
    if (current.rows[0].version !== input.version) throw new DomainError('Another owner session changed this rate. Refresh before saving.', 409, 'VERSION_CONFLICT');
    if (input.start || input.end) {
      if (!input.start || !input.end) throw new DomainError('Choose both override dates.');
      parseDate(input.start); parseDate(input.end);
      if (input.start < today() || input.end <= input.start || input.end > plusDays(input.start, 365)) throw new DomainError('Choose a future rate range of 1–365 nights.');
      for (let date = input.start; date < input.end; date = plusDays(date, 1)) {
        if (input.amount === null) await client.query('DELETE FROM rates WHERE cabin_id=$1 AND stay_date=$2', [input.cabinId, date]);
        else await client.query('INSERT INTO rates(cabin_id,stay_date,amount) VALUES($1,$2,$3) ON CONFLICT(cabin_id,stay_date) DO UPDATE SET amount=EXCLUDED.amount', [input.cabinId, date, input.amount]);
      }
      await client.query('UPDATE cabins SET version=version+1 WHERE id=$1', [input.cabinId]);
    } else {
      if (input.amount === null) throw new DomainError('A base rate is required.');
      await client.query('UPDATE cabins SET base_rate=$2,version=version+1 WHERE id=$1', [input.cabinId, input.amount]);
    }
    await client.query("INSERT INTO audit_log(action,target,detail) VALUES('rate.updated',$1,$2)", [input.cabinId, JSON.stringify(input)]);
  }); res.json({ ok: true });
});
app.post('/api/admin/content/:slug', async (req, res) => {
  const slug = z.string().regex(/^[a-z-]{1,60}$/).parse(req.params.slug);
  const input = z.object({ title: z.string().trim().min(3).max(150), eyebrow: z.string().trim().max(100), body: z.string().trim().min(20).max(20000), version: z.number().int().positive() }).strict().parse(req.body);
  await transaction(async client => {
    const result = await client.query('UPDATE documents SET title=$2,eyebrow=$3,body=$4,version=version+1,updated_at=now() WHERE slug=$1 AND version=$5 RETURNING version', [slug, input.title, input.eyebrow, input.body, input.version]);
    if (!result.rowCount) throw new DomainError('This content changed in another session. Refresh before saving.', 409, 'VERSION_CONFLICT');
    await client.query("INSERT INTO audit_log(action,target) VALUES('content.updated',$1)", [slug]);
  }); res.json({ ok: true });
});
app.post('/api/admin/maintenance', async (_req, res) => { await processOutbox(); res.json({ ok: true }); });
app.use('/api', (_req, _res, next) => next(new DomainError('API route not found.', 404)));
app.use(express.static(resolve('out'), { extensions: ['html'], maxAge: 0 }));
app.use((_req, res) => { res.status(404).sendFile(resolve('out/404.html')); });
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues[0]?.message || 'Check the form details.', code: 'VALIDATION' }); return; }
  if (error instanceof DomainError) { if (error.status === 429) res.set('Retry-After','60'); res.status(error.status).json({ error: error.message, code: error.code }); return; }
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : 'UNKNOWN';
  if (code === '23P01') { res.status(409).json({ error: 'Those dates are no longer available.', code: 'DATES_UNAVAILABLE' }); return; }
  if (typeof error === 'object' && error && 'type' in error && error.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON.', code: 'VALIDATION' }); return; }
  console.error(`Request failed (${code}). No request body or guest details logged.`);
  res.status(503).json({ error: 'This service is temporarily unavailable. No new booking has been confirmed. Please retry shortly.', code: 'SERVICE_UNAVAILABLE' });
});
