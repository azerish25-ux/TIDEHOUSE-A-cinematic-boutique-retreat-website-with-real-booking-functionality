import { PREVIEW } from './site-config';
import { cabins, editorial } from './catalog';
import { buildQuote, DomainError, overlaps, refundAmount } from './pricing';
import type { Availability, Booking, CalendarEntry, EditorialDocument, Quote, ReservationRequest, ReservationResult, StayInput } from './types';
export class ClientError extends Error { constructor(message: string, public status = 400, public code = 'REQUEST_FAILED') { super(message); } }
export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  let data;
  try { data = await response.json(); } catch { throw new ClientError('The booking service is not reachable. Please try again shortly.', 503, 'UNREACHABLE'); }
  if (!response.ok) throw new ClientError(data.error || 'The request could not be completed.', response.status, data.code);
  return data as T;
}
type PreviewBooking = Booking & { token: string; idempotencyKey: string; fingerprint: string };
const previewKey = 'tidehouse.preview.v1';
function stored(): PreviewBooking[] {
  try {
    const rows = JSON.parse(localStorage.getItem(previewKey) || '[]') as PreviewBooking[];
    return rows.map(b => b.status === 'holding' && new Date(b.hold_expires_at).getTime() < Date.now() ? { ...b, status: 'expired' } : b);
  } catch { return []; }
}
function save(rows: PreviewBooking[]) { localStorage.setItem(previewKey, JSON.stringify(rows)); window.dispatchEvent(new Event('tidehouse:inventory')); }
const active = (b: PreviewBooking) => ['holding','confirmed','cancelling'].includes(b.status);
async function previewLock<T>(fn: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request('tidehouse-preview', fn);
  return fn();
}
function owned(id: string, token: string) { const b = stored().find(r => r.id === id && r.token === token); if (!b) throw new ClientError('Open your private booking link to view this stay.', 404); return b; }
export const api = {
  content: async (): Promise<EditorialDocument[]> => PREVIEW ? editorial : request('/content'),
  health: async (): Promise<{ paymentProvider: string; paymentReady: boolean; emailReady: boolean }> => PREVIEW ? { paymentProvider: 'simulated', paymentReady: true, emailReady: false } : request('/health'),
  availability: async (input: Omit<StayInput, 'cabinId'>): Promise<Availability[]> => {
    if (!PREVIEW) return request('/availability', input);
    return cabins.map(cabin => {
      if (input.guests > cabin.capacity) return { cabinId: cabin.id, available: false, quote: null, reason: `Up to ${cabin.capacity} guests` };
      const quote = buildQuote({ ...input, cabinId: cabin.id });
      const available = !stored().some(b => active(b) && b.cabin_id === cabin.id && overlaps({start: input.checkIn, end: input.checkOut}, {start: b.start_date, end: b.end_date}));
      return { cabinId: cabin.id, available, quote, ...(!available ? {reason: 'Not available for these dates'} : {}) };
    });
  },
  quote: async (input: StayInput): Promise<Quote> => PREVIEW ? buildQuote(input) : request('/quote', input),
  calendar: async (id: string): Promise<CalendarEntry[]> => PREVIEW ? stored().filter(b => b.cabin_id === id && active(b)).map(b => ({ start: b.start_date, end: b.end_date, status: b.status === 'holding' ? 'held' : 'unavailable' })) : request(`/calendar/${id}`),
  reserve: async (input: ReservationRequest): Promise<ReservationResult> => {
    if (!PREVIEW) return request('/reservations', input);
    return previewLock(() => {
      const rows = stored(); const fingerprint = JSON.stringify({ ...input, accessToken: '' });
      const existing = rows.find(b => b.idempotencyKey === input.idempotencyKey);
      if (existing) { if (existing.token !== input.accessToken || existing.fingerprint !== fingerprint) throw new ClientError('This checkout attempt changed. Start a new checkout.',409,'IDEMPOTENCY_MISMATCH'); return {id:existing.id,status:existing.status,provider:'simulated',checkoutUrl:null}; }
      const quote = buildQuote(input);
      if (quote.total !== input.expectedTotal) throw new ClientError('The price changed. Please review it.',409,'PRICE_CHANGED');
      if (rows.some(b => active(b) && b.cabin_id === input.cabinId && overlaps({start:input.checkIn,end:input.checkOut},{start:b.start_date,end:b.end_date}))) throw new ClientError('Those dates have just been reserved. Please choose another cabin or change your dates.',409,'DATES_UNAVAILABLE');
      const id = crypto.randomUUID();
      rows.push({ id, cabin_id:input.cabinId,start_date:input.checkIn,end_date:input.checkOut,guests:input.guests,status:'holding',quote,provider:'simulated',hold_expires_at:new Date(Date.now()+35*60000).toISOString(),created_at:new Date().toISOString(),refund_cents:0,token:input.accessToken,idempotencyKey:input.idempotencyKey,fingerprint });
      save(rows); return { id,status:'holding',provider:'simulated',checkoutUrl:null };
    });
  },
  booking: async (id: string, token: string): Promise<Booking> => PREVIEW ? { ...owned(id,token), email_status:'not_configured' } : request(`/reservations/${id}`, undefined, token),
  checkout: async (id: string, token: string): Promise<ReservationResult> => PREVIEW ? { id,status:owned(id,token).status,provider:'simulated',checkoutUrl:null } : request(`/reservations/${id}/checkout`, {}, token),
  simulate: async (id: string, token: string, outcome: 'paid'|'failed'): Promise<Booking> => {
    if (!PREVIEW) return request(`/reservations/${id}/simulate`, {outcome}, token);
    return previewLock(() => { const b=owned(id,token); if(b.status!=='holding') throw new ClientError('This checkout is no longer open.',409); const next={...b,status:outcome==='paid'?'confirmed' as const:'failed' as const}; save(stored().map(r=>r.id===id?next:r)); return next; });
  },
  cancel: async (id: string, token: string): Promise<Booking> => {
    if (!PREVIEW) return request(`/reservations/${id}/cancel`, {}, token);
    return previewLock(() => { const b=owned(id,token); if(!['holding','confirmed','cancelling'].includes(b.status)) return b; const next={...b,status:'cancelled' as const,refund_cents:b.status==='confirmed'?refundAmount(b.quote):0}; save(stored().map(r=>r.id===id?next:r)); return next; });
  },
};
export function errorMessage(error: unknown) { return error instanceof Error || error instanceof DomainError ? error.message : 'Something interrupted that request. Please try again.'; }
export function newToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), n=>n.toString(16).padStart(2,'0')).join(''); }
export function storeAccess(id: string, token: string) { sessionStorage.setItem(`tidehouse.access.${id}`,token); }
export function readAccess(id: string) { return sessionStorage.getItem(`tidehouse.access.${id}`)||''; }
