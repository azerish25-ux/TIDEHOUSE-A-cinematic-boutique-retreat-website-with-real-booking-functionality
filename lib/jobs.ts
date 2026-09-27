import type { Pool } from "pg";
import { transaction } from "./db.ts";
import { stripe } from "./payments.ts";
import { appUrl, managementToken } from "./security.ts";
import { money } from "./domain.ts";
export async function processRefunds(pool: Pool) {
  let completed = 0,
    failed = 0;
  for (let i = 0; i < 10; i++) {
    const job = await transaction(pool, async (client) => {
      const r = await client.query(
        "SELECT r.*,b.provider,b.payment_intent FROM refund_jobs r JOIN bookings b ON b.id=r.booking_id WHERE (r.state IN ('pending','failed') OR (r.state='processing' AND r.lease_until<now())) AND r.attempts<20 ORDER BY r.updated_at FOR UPDATE OF r SKIP LOCKED LIMIT 1",
      );
      if (!r.rowCount) return null;
      await client.query(
        "UPDATE refund_jobs SET state='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes' WHERE booking_id=$1",
        [r.rows[0].booking_id],
      );
      return r.rows[0];
    });
    if (!job) break;
    try {
      let ref: string;
      if (job.provider === "simulator") {
        ref = `sim_refund_${job.booking_id}`;
      } else {
        if (!job.payment_intent) throw new Error("Missing payment reference");
        const r = await stripe().refunds.create(
          { payment_intent: job.payment_intent, amount: job.amount },
          { idempotencyKey: `refund:${job.booking_id}` },
        );
        if (r.status !== "succeeded")
          throw new Error("Provider refund not yet completed");
        ref = r.id;
      }
      await pool.query(
        "UPDATE refund_jobs SET state='refunded',provider_ref=$2,last_error=NULL,lease_until=NULL,updated_at=now() WHERE booking_id=$1",
        [job.booking_id, ref],
      );
      completed++;
    } catch {
      await pool.query(
        "UPDATE refund_jobs SET state='failed',last_error='Provider refund needs retry or manual review',lease_until=NULL,updated_at=now() WHERE booking_id=$1",
        [job.booking_id],
      );
      failed++;
      break;
    }
  }
  return { completed, failed };
}
export async function deliverEmails(pool: Pool) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return { sent: 0, configured: false };
  let sent = 0;
  for (let i = 0; i < 10; i++) {
    const job = await transaction(pool, async (client) => {
      const r = await client.query(
        "SELECT e.*,b.guest_email,b.guest_name,b.arrival::text,b.departure::text,b.total,b.status FROM email_outbox e JOIN bookings b ON b.id=e.booking_id WHERE (e.state='pending' OR (e.state='sending' AND e.lease_until<now())) AND e.attempts<20 ORDER BY e.id FOR UPDATE OF e SKIP LOCKED LIMIT 1",
      );
      if (!r.rowCount) return null;
      await client.query(
        "UPDATE email_outbox SET state='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes' WHERE id=$1",
        [r.rows[0].id],
      );
      return r.rows[0];
    });
    if (!job) break;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `tidehouse:${job.booking_id}:${job.kind}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [job.guest_email],
          subject: `TIDEHOUSE — booking ${job.kind}`,
          text: `Hello ${job.guest_name},\n\nYour test booking was ${job.kind}.\nStay: ${job.arrival} to ${job.departure}\nTotal: ${money(job.total)} CAD\n\nReview the current booking and refund status using your private link:\n${appUrl()}/booking/${job.booking_id}#${managementToken(job.booking_id)}\n\nTIDEHOUSE is a fictional portfolio retreat. No real accommodation is reserved.`,
        }),
      });
      if (!response.ok) throw new Error("Email provider rejected request");
      await pool.query(
        "UPDATE email_outbox SET state='sent',lease_until=NULL,last_error=NULL WHERE id=$1",
        [job.id],
      );
      sent++;
    } catch {
      await pool.query(
        "UPDATE email_outbox SET state='pending',lease_until=NULL,last_error='Email delivery needs retry' WHERE id=$1",
        [job.id],
      );
      break;
    }
  }
  return { sent, configured: true };
}
export async function maintenance(pool: Pool) {
  await pool.query(
    "UPDATE bookings SET status='expired',updated_at=now() WHERE status='held' AND hold_until<=now()",
  );
  await pool.query("DELETE FROM rate_limits WHERE bucket<$1", [
    Math.floor(Date.now() / 60000) - 60,
  ]);
  return {
    refunds: await processRefunds(pool),
    emails: await deliverEmails(pool),
  };
}
