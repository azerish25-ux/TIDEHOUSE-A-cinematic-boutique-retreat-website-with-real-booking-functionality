import Stripe from "stripe";
import type { Pool } from "pg";
import { AppError } from "./domain.ts";
import type { Booking } from "./bookings.ts";
import { settle } from "./bookings.ts";
import { appUrl, managementToken } from "./security.ts";
let stripeClient: Stripe | undefined;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_"))
    throw new AppError(
      503,
      "Configure a Stripe sandbox secret key. Live payments are intentionally disabled.",
      "NOT_CONFIGURED",
    );
  return (stripeClient ??= new Stripe(key, { maxNetworkRetries: 2 }));
}
export async function checkout(pool: Pool, b: Booking) {
  const token = managementToken(b.id),
    url = `${appUrl()}/booking/${b.id}#${token}`;
  if (b.provider === "simulator" || b.status !== "held")
    return { id: b.id, token, url, paymentMode: b.provider };
  if (b.provider_session_id) {
    const session = await stripe().checkout.sessions.retrieve(
      b.provider_session_id,
    );
    return {
      id: b.id,
      token,
      url: session.status === "open" ? session.url : url,
      paymentMode: b.provider,
    };
  }
  if (
    !b.hold_until ||
    new Date(b.hold_until).getTime() < Date.now() + 31 * 60000
  )
    throw new AppError(
      409,
      "Your payment hold is almost over. Please begin a new reservation.",
    );
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: b.guest_email,
      client_reference_id: b.id,
      metadata: { booking_id: b.id },
      line_items: [
        {
          price_data: {
            currency: "cad",
            unit_amount: b.total,
            product_data: {
              name: `TIDEHOUSE — ${b.quote.nights.length} nights`,
              description: `${b.arrival} to ${b.departure} · ${b.guests} guests · includes selected extras and illustrative tax`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: url,
      cancel_url: url,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    { idempotencyKey: `checkout:${b.id}` },
  );
  if (session.livemode)
    throw new AppError(500, "A live payment session was rejected.");
  await pool.query(
    "UPDATE bookings SET provider_session_id=$2,updated_at=now() WHERE id=$1 AND (provider_session_id IS NULL OR provider_session_id=$2)",
    [b.id, session.id],
  );
  return { id: b.id, token, url: session.url, paymentMode: b.provider };
}
export async function stripeWebhook(
  pool: Pool,
  body: string,
  signature: string,
) {
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signingSecret)
    throw new AppError(503, "The payment webhook is not configured.");
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, signingSecret);
  } catch {
    throw new AppError(400, "Invalid payment webhook signature.");
  }
  if (event.livemode)
    throw new AppError(400, "Live payment events are not accepted.");
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return { received: true, ignored: true };
  const s = event.data.object as Stripe.Checkout.Session,
    id = s.metadata?.booking_id;
  if (!id || s.client_reference_id !== id)
    throw new AppError(400, "Missing reservation metadata.");
  if (
    event.type === "checkout.session.completed" &&
    s.payment_status !== "paid"
  )
    return { received: true, pending: true };
  const paid =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";
  if (paid && s.payment_status !== "paid")
    throw new AppError(400, "The session has not been paid.");
  const result = await settle(pool, {
    eventId: event.id,
    bookingId: id,
    sessionId: s.id,
    provider: "stripe",
    outcome: paid
      ? "paid"
      : event.type === "checkout.session.expired"
        ? "expired"
        : "failed",
    amount: s.amount_total ?? undefined,
    currency: s.currency ?? undefined,
    paymentIntent:
      typeof s.payment_intent === "string" ? s.payment_intent : undefined,
  });
  return { received: true, ...result };
}
