import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { pool } from './db';
import { config } from './config';
import { DomainError } from '../lib/pricing';
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const secureToken = () => randomBytes(32).toString('hex');
export function sameSecret(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function verifyPassword(value: string) {
  const [method, salt, digest] = config.adminHash.split(':');
  if (method !== 'scrypt' || !salt || !digest) return false;
  return sameSecret(scryptSync(value, salt, 64).toString('hex'), digest);
}
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    if (req.get('origin') !== config.origin) throw new DomainError('This request did not come from the booking website.', 403, 'ORIGIN');
    if (!req.is('application/json')) throw new DomainError('Use an application/json request.', 415);
  }
  next();
}
export async function limit(key: string, max: number, seconds: number) {
  const { rows } = await pool.query(`INSERT INTO rate_limits(key,count,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at < now() THEN now()+$2*interval '1 second' ELSE rate_limits.expires_at END RETURNING count`, [key, seconds]);
  if (rows[0].count > max) throw new DomainError('Too many attempts. Please pause and try again shortly.', 429, 'RATE_LIMIT');
}
export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith('tidehouse_admin='))?.split('=')[1];
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new DomainError('Please sign in to the owner dashboard.', 401, 'AUTH');
  const session = await pool.query('SELECT 1 FROM admin_sessions WHERE token_hash=$1 AND expires_at>now()', [hash(token)]);
  if (!session.rowCount) throw new DomainError('Your owner session has expired. Please sign in again.', 401, 'AUTH');
  next();
}
export function bookingToken(req: Request) {
  const value = req.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[a-f0-9]{64}$/.test(value)) throw new DomainError('Open your private booking link to manage this stay.', 401, 'AUTH');
  return value;
}
