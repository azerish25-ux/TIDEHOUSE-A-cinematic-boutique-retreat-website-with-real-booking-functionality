export type CabinId = 'salt' | 'dune' | 'drift' | 'cove' | 'pine';
export type AddOnId = 'breakfast' | 'sauna';
export type Cabin = {
  id: CabinId; number: string; name: string; tagline: string; description: string;
  capacity: number; beds: string; size: number; baseRate: number; view: string;
  image: string; imageAlt: string; gallery: { src: string; alt: string }[];
  position: [number, number]; amenities: string[]; access: string;
  faqs: { question: string; answer: string }[];
};
export type StayInput = { cabinId: CabinId; checkIn: string; checkOut: string; guests: number; addOns: AddOnId[] };
export type Quote = {
  cabinId: CabinId; checkIn: string; checkOut: string; guests: number;
  nights: { date: string; amount: number; label: string }[];
  accommodation: number; extras: { id: AddOnId; label: string; amount: number }[];
  cleaning: number; subtotal: number; tax: number; taxBasisPoints: number; total: number;
  currency: 'cad'; cancellationPolicy: string;
};
export type BookingStatus = 'holding' | 'confirmed' | 'failed' | 'expired' | 'cancelled' | 'cancelling' | 'payment_conflict' | 'blocked';
export type Booking = {
  id: string; cabin_id: CabinId; start_date: string; end_date: string; guests: number;
  status: BookingStatus; quote: Quote; provider: 'stripe' | 'simulated';
  hold_expires_at: string; created_at: string; checkout_url?: string | null;
  refund_cents: number; email_status?: string;
};
export type Availability = { cabinId: CabinId; available: boolean; quote: Quote | null; reason?: string };
export type CalendarEntry = { start: string; end: string; status: 'unavailable' | 'held' };
export type EditorialDocument = { slug: string; title: string; eyebrow: string; body: string; version: number };
export type ReservationRequest = StayInput & { name: string; email: string; idempotencyKey: string; accessToken: string; expectedTotal: number };
export type ReservationResult = { id: string; status: BookingStatus; checkoutUrl: string | null; provider: 'stripe' | 'simulated' };
