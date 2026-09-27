import type Stripe from 'stripe';
import type { Booking } from './bookings.ts';
import { AppError } from './domain.ts';
export type CheckoutBooking = Pick<Booking, 'id' | 'guest_email' | 'total' | 'arrival' | 'departure' | 'guests' | 'quote' | 'hold_until'>;
/** Every Stripe parameter comes from the immutable booking snapshot, not the retry clock. */
export function checkoutParameters(b: CheckoutBooking, managementUrl: string): Stripe.Checkout.SessionCreateParams {
  const holdUntil = b.hold_until ? new Date(b.hold_until).getTime() : NaN;
  if (!Number.isFinite(holdUntil)) throw new AppError(409, 'This reservation has no valid payment hold.');
  return {
    mode: 'payment', payment_method_types: ['card'], customer_email: b.guest_email,
    client_reference_id: b.id, metadata: { booking_id: b.id },
    line_items: [{ price_data: {
      currency: 'cad', unit_amount: b.total,
      product_data: { name: `TIDEHOUSE — ${b.quote.nights.length} nights`, description: `${b.arrival} to ${b.departure} · ${b.guests} guests · includes selected extras and illustrative tax` },
    }, quantity: 1 }],
    success_url: managementUrl, cancel_url: managementUrl,
    // A 35-minute inventory hold gives the initial request roughly 34 minutes,
    // above Stripe's 30-minute minimum. Later retries replay the identical value.
    expires_at: Math.floor(holdUntil / 1000) - 60,
  };
}
