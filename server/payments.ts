import Stripe from 'stripe';
import { config } from './config';
import { DomainError } from '../lib/pricing';
export const stripe = config.stripeKey ? new Stripe(config.stripeKey, { maxNetworkRetries: 2, timeout: 15000 }) : null;
export function requireStripe(): Stripe {
  if (!stripe) throw new DomainError('Stripe test checkout has not been configured by the owner yet. No payment has been taken.', 503, 'PAYMENTS_UNCONFIGURED');
  return stripe;
}
export type PaidSession = { id: string; payment_status: string; amount_total: number | null; currency: string | null; metadata: { [key: string]: string } | null; payment_intent: string | { id: string } | null; livemode: boolean };
