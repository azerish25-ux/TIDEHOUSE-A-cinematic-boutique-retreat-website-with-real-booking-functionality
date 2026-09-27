import Stripe from "stripe";
import type { Pool } from "pg";
import { AppError } from "./domain.ts";
import type { Booking } from "./bookings.ts";
import { settle } from "./bookings.ts";
import { appUrl, managementToken } from "./security.ts";
import { checkoutParameters } from "./checkout-request.ts";
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
export function assertCheckoutConfigured(provider: "stripe" | "simulator") {
  if (provider !== "stripe") return;
  stripe();
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    throw new AppError(
      503,
      "Configure signed Stripe webhook delivery before opening checkout.",
      "NOT_CONFIGURED",
    );
}

type Session = Pick<
  Stripe.Checkout.Session,
  "id" | "url" | "status" | "payment_status" | "livemode"
>;
export type CheckoutGateway = {
  create(
    params: Stripe.Checkout.SessionCreateParams,
    options: Stripe.RequestOptions,
  ): Promise<Session>;
  retrieve(id: string): Promise<Session>;
};
export type CheckoutResult = {
  id: string;
  token: string;
  url: string;
  paymentMode: Booking["provider"];
  checkoutPending?: boolean;
};

export async function checkout(
  pool: Pool,
  b: Booking,
  injected?: CheckoutGateway,
): Promise<CheckoutResult> {
  const token = managementToken(b.id);
  const managementUrl = `${appUrl()}/booking/${b.id}#${token}`;
  const managed: CheckoutResult = {
    id: b.id,
    token,
    url: managementUrl,
    paymentMode: b.provider,
  };
  if (b.provider === "simulator" || b.status !== "held") return managed;
  const gateway = injected ?? stripe().checkout.sessions;
  try {
    if (b.provider_session_id) {
      const session = await gateway.retrieve(b.provider_session_id);
      if (session.livemode)
        throw new AppError(500, "A live payment session was rejected.");
      return {
        ...managed,
        url:
          session.status === "open" && session.url
            ? session.url
            : managementUrl,
      };
    }
    // Even an old retry must replay identical parameters. A local remaining-time
    // guard would prevent recovery of a checkout Stripe already accepted.
    const session = await gateway.create(checkoutParameters(b, managementUrl), {
      idempotencyKey: `checkout:${b.id}`,
    });
    if (session.livemode)
      throw new AppError(500, "A live payment session was rejected.");
    await pool.query(
      "UPDATE bookings SET provider_session_id=$2,updated_at=now() WHERE id=$1 AND (provider_session_id IS NULL OR provider_session_id=$2)",
      [b.id, session.id],
    );
    return {
      ...managed,
      url:
        session.status === "open" && session.url ? session.url : managementUrl,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    // A timeout is not evidence that Stripe rejected payment. Keep the original
    // hold, request key and private management link; the visitor can resume it.
    console.warn("TIDEHOUSE checkout recovery required", { bookingId: b.id });
    return { ...managed, checkoutPending: true };
  }
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
