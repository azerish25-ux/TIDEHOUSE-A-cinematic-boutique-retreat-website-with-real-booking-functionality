import nodemailer from 'nodemailer';
import { pool, transaction } from './db';
import { config } from './config';
import { requireStripe } from './payments';
import type { ReservationRow } from './booking-service';
import { getCabin } from '../lib/catalog';
import { money } from '../lib/pricing';
export async function processOutbox() {
  for (let i = 0; i < 10; i++) {
    const job = await transaction(async client => {
      const { rows } = await client.query(`SELECT * FROM outbox WHERE (state='pending' OR (state='working' AND locked_until<now())) AND next_attempt_at<=now() AND (kind='refund' OR $1) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1`, [Boolean(config.smtp)]);
      if (!rows[0]) return null;
      await client.query("UPDATE outbox SET state='working',locked_until=now()+interval '2 minutes',attempts=attempts+1 WHERE id=$1", [rows[0].id]);
      return rows[0];
    });
    if (!job) break;
    try {
      const { rows } = await pool.query<ReservationRow>('SELECT * FROM reservations WHERE id=$1', [job.reservation_id]);
      const row = rows[0];
      if (job.kind === 'refund') {
        if (row.refund_cents > row.refunded_cents && row.provider === 'stripe') {
          if (!row.payment_intent) throw new Error('Missing verified payment reference.');
          const refund = await requireStripe().refunds.create({ payment_intent: row.payment_intent, amount: row.refund_cents, metadata: { bookingId: row.id } }, { idempotencyKey: `refund:${row.id}` });
          if (refund.status !== 'succeeded') throw new Error('Refund is not yet settled.');
        }
        await transaction(async client => {
          await client.query("UPDATE reservations SET refunded_cents=refund_cents,status=CASE WHEN status='cancelling' THEN 'cancelled' ELSE status END,updated_at=now() WHERE id=$1", [row.id]);
          await client.query("UPDATE outbox SET state='done',locked_until=NULL,last_error=NULL WHERE id=$1", [job.id]);
        });
      } else {
        if (row.status === 'confirmed') {
          const transport = nodemailer.createTransport(config.smtp);
          await transport.sendMail({ from: config.mailFrom, to: row.email, messageId: `<tidehouse-${row.id}@tidehouse.example>`, subject: `Your TIDEHOUSE test stay is confirmed · ${getCabin(row.cabin_id)?.name}`, text: `Your test reservation is confirmed.\n\nCabin: ${getCabin(row.cabin_id)?.name}\nArrival: ${row.start_date} from 16:00\nDeparture: ${row.end_date} by 11:00\nGuests: ${row.guests}\nTotal: ${money(row.total_cents, true)} CAD\nReference: ${row.id}\n\n${row.quote.cancellationPolicy}\n\nUse the private management link saved during checkout to manage or cancel this stay. This email does not expose that private access token.\n\nTIDEHOUSE is a fictional portfolio retreat. This is not a reservation for real accommodation. No live payment has been taken.` });
          transport.close();
        }
        await pool.query("UPDATE outbox SET state='done',locked_until=NULL,last_error=NULL WHERE id=$1", [job.id]);
      }
    } catch {
      // Do not persist provider payloads or guest details in error logs.
      await pool.query("UPDATE outbox SET state='pending',locked_until=NULL,last_error='Delivery deferred; retry scheduled.',next_attempt_at=now()+least(3600,power(2,least(attempts,10))::integer)*interval '1 second' WHERE id=$1", [job.id]);
    }
  }
}
