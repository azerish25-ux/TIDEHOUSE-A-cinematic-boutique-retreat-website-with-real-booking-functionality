import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
const provider = process.env.PAYMENT_PROVIDER || 'stripe';
if (provider !== 'stripe' && provider !== 'simulated') throw new Error('PAYMENT_PROVIDER must be stripe or simulated.');
const production = process.env.APP_ENV === 'production';
if (production && provider === 'simulated') throw new Error('Simulated payments are forbidden when APP_ENV=production.');
const origin = process.env.APP_ORIGIN || 'http://localhost:3000';
if (new URL(origin).origin !== origin) throw new Error('APP_ORIGIN must be an origin without a trailing slash or path.');
if (production && !origin.startsWith('https://')) throw new Error('Production requires HTTPS.');
export const config = {
  provider: provider as 'stripe' | 'simulated', production, origin,
  port: Number(process.env.PORT || 3000), databaseUrl: process.env.DATABASE_URL,
  stripeKey: process.env.STRIPE_SECRET_KEY || '', webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  adminHash: process.env.ADMIN_PASSWORD_HASH || '', smtp: process.env.SMTP_URL || '',
  mailFrom: process.env.MAIL_FROM || 'TIDEHOUSE <stays@tidehouse.example>',
};
if (config.stripeKey && !config.stripeKey.startsWith('sk_test_')) throw new Error('TIDEHOUSE accepts Stripe TEST secret keys only. Live payments are deliberately disabled.');
if (production && (!config.stripeKey || !config.webhookSecret || !config.adminHash)) throw new Error('Production requires Stripe test credentials, webhook signing secret and ADMIN_PASSWORD_HASH.');
