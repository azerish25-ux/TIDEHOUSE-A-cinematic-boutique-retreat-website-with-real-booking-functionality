import { getCabin, addOns } from './catalog';
import type { Quote, StayInput } from './types';
export class DomainError extends Error {
  constructor(message: string, public status = 400, public code = 'INVALID_REQUEST') { super(message); this.name = 'DomainError'; }
}
const DAY = 86400000;
export function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('Choose a valid calendar date.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new DomainError('Choose a valid calendar date.');
  return date;
}
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const plusDays = (date: string, days: number) => dateKey(new Date(parseDate(date).getTime() + days * DAY));
export const today = () => dateKey(new Date());
export function validateStay(input: StayInput, now = new Date()) {
  const cabin = getCabin(input.cabinId);
  if (!cabin) throw new DomainError('Choose one of our five cabins.');
  const start = parseDate(input.checkIn); const end = parseDate(input.checkOut);
  const nights = (end.getTime() - start.getTime()) / DAY;
  if (nights < 2 || nights > 21) throw new DomainError('Choose a stay of 2–21 nights.');
  if (input.checkIn <= dateKey(now)) throw new DomainError('Arrival must be tomorrow or later.');
  if (input.checkOut > plusDays(dateKey(now), 365)) throw new DomainError('Bookings open up to one year ahead.');
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > cabin.capacity) throw new DomainError(`${cabin.name} welcomes up to ${cabin.capacity} guests.`);
  if (!Array.isArray(input.addOns) || new Set(input.addOns).size !== input.addOns.length || input.addOns.some(id => !addOns.find(a => a.id === id))) throw new DomainError('Choose from the two available extras.');
  return { cabin, start, end, count: nights };
}
export function buildQuote(input: StayInput, options: { baseRate?: number; overrides?: Record<string, number>; now?: Date } = {}): Quote {
  const { cabin, count } = validateStay(input, options.now);
  const base = options.baseRate ?? cabin.baseRate;
  if (!Number.isSafeInteger(base) || base < 1000 || base > 1000000) throw new DomainError('The cabin rate is temporarily unavailable.', 503);
  const nights = Array.from({ length: count }, (_, i) => {
    const date = plusDays(input.checkIn, i); const d = parseDate(date); const month = d.getUTCMonth() + 1;
    const factor = month >= 6 && month <= 8 ? 130 : month >= 11 || month <= 3 ? 85 : 100;
    const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6;
    const override = options.overrides?.[date];
    const amount = override ?? Math.round(base * factor / 100 * (weekend ? 1.1 : 1));
    return { date, amount, label: override !== undefined ? 'Special rate' : `${factor === 130 ? 'Summer' : factor === 85 ? 'Quiet season' : 'Coastal season'}${weekend ? ' · weekend' : ''}` };
  });
  const accommodation = nights.reduce((sum, night) => sum + night.amount, 0);
  const extras = addOns.filter(a => input.addOns.includes(a.id)).map(a => ({ id: a.id, label: a.id === 'breakfast' ? `Breakfast · ${input.guests} guests × ${count} mornings` : 'Private sauna · one session', amount: a.amount * (a.id === 'breakfast' ? input.guests * count : 1) }));
  const cleaning = 6500; const subtotal = accommodation + cleaning + extras.reduce((sum, a) => sum + a.amount, 0);
  const taxBasisPoints = 1500; const tax = Math.round(subtotal * taxBasisPoints / 10000);
  return { cabinId: cabin.id, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests, nights, accommodation, extras, cleaning, subtotal, tax, taxBasisPoints, total: subtotal + tax, currency: 'cad', cancellationPolicy: 'Full refund at least 7 days before check-in; no refund after that. All payments and refunds are test transactions.' };
}
export function refundAmount(quote: Quote, now = new Date()): number {
  return dateKey(now) <= plusDays(quote.checkIn, -7) ? quote.total : 0;
}
export const money = (cents: number, full = false) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: full || cents % 100 !== 0 ? 2 : 0 }).format(cents / 100);
export const displayDate = (value: string, long = false) => parseDate(value).toLocaleDateString('en-CA', { timeZone: 'UTC', day: 'numeric', month: long ? 'long' : 'short', ...(long ? { year: 'numeric' } : {}) });
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => a.start < b.end && b.start < a.end;
