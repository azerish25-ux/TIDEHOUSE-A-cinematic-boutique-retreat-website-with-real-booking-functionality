'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { cabins, addOns, sitePath } from '../lib/catalog';
import type { AddOnId, Availability, CabinId } from '../lib/types';
import { api, ClientError, errorMessage, newToken, storeAccess } from '../lib/api';
import { displayDate, money, parseDate, plusDays, today } from '../lib/pricing';
import { PREVIEW } from '../lib/site-config';
import { Icon } from './Icon';
import { PriceBreakdown } from './PriceBreakdown';
import { AvailabilityCalendar } from './AvailabilityCalendar';

function dateFromQuery(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  try { parseDate(raw); return raw; } catch { return fallback; }
}

export function Stay() {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [cabinId, setCabinId] = useState<CabinId>('salt');
  const [extras, setExtras] = useState<AddOnId[]>([]);
  const [results, setResults] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [reserveError, setReserveError] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [provider, setProvider] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const attempt = useRef<{ fingerprint: string; idempotencyKey: string; accessToken: string } | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const incoming = query.get('cabin');
    if (cabins.some(c => c.id === incoming)) setCabinId(incoming as CabinId);
    const start = dateFromQuery(query.get('checkIn'), plusDays(today(), 14));
    const end = dateFromQuery(query.get('checkOut'), plusDays(today(), 17));
    setCheckIn(start);
    setCheckOut(end);
    if ((query.has('checkIn') && query.get('checkIn') !== start) || (query.has('checkOut') && query.get('checkOut') !== end)) {
      setReserveError('The shared link contained an invalid date. Please review the replacement dates before booking.');
    }
    const count = Number(query.get('guests'));
    if (Number.isInteger(count) && count >= 1 && count <= 4) setGuests(count);
    api.health().then(health => setProvider(health.paymentProvider)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setResults([]);
      setLoading(false);
      setSearchError('Choose both an arrival and a departure to check availability.');
      return;
    }
    let active = true;
    setLoading(true);
    setSearchError('');
    const timer = setTimeout(() => {
      api.availability({ checkIn, checkOut, guests, addOns: extras })
        .then(rows => { if (active) setResults(rows); })
        .catch(error => { if (active) { setResults([]); setSearchError(errorMessage(error)); } })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [checkIn, checkOut, guests, extras, refresh]);

  const cabin = cabins.find(c => c.id === cabinId)!;
  const result = results.find(row => row.cabinId === cabinId);
  const candidate = result?.quote;
  // Never display or submit a quote for the previously selected dates or extras.
  const quote = !loading && candidate && candidate.checkIn === checkIn && candidate.checkOut === checkOut
    && candidate.guests === guests && candidate.extras.length === extras.length
    && candidate.extras.every(extra => extras.includes(extra.id)) ? candidate : null;
  const canBook = Boolean(quote && result?.available && !loading && !busy);

  function toggleExtra(id: AddOnId) {
    setExtras(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canBook || !quote || !consent || busy) return;
    setBusy(true);
    setReserveError('');
    try {
      const details = { cabinId, checkIn, checkOut, guests, addOns: extras, name, email, expectedTotal: quote.total };
      const fingerprint = JSON.stringify(details);
      if (attempt.current?.fingerprint !== fingerprint) {
        attempt.current = { fingerprint, idempotencyKey: crypto.randomUUID(), accessToken: newToken() };
      }
      const current = attempt.current!;
      // Validate storage before creating a payable reservation. A retry keeps
      // the same idempotency key and capability for the same guest request.
      sessionStorage.setItem(`tidehouse.pending.${current.idempotencyKey}`, current.accessToken);
      const booking = await api.reserve({ ...details, idempotencyKey: current.idempotencyKey, accessToken: current.accessToken });
      storeAccess(booking.id, current.accessToken);
      window.location.assign(booking.checkoutUrl || `${sitePath('/booking/')}?id=${booking.id}#access=${current.accessToken}`);
    } catch (error) {
      setReserveError(errorMessage(error));
      if (error instanceof ClientError && ['PRICE_CHANGED', 'DATES_UNAVAILABLE'].includes(error.code)) {
        attempt.current = null;
        setRefresh(value => value + 1);
      }
    } finally { setBusy(false); }
  }

  return <>
    <section className="stay-heading">
      <div><p className="eyebrow">YOUR NEXT CHAPTER</p><h1>A few days,<br/><em>all your own.</em></h1></div>
      <ol className="booking-steps" aria-label="Booking journey">
        <li className="active"><span>01</span>Find your cabin</li>
        <li><span>02</span>Make it yours</li>
        <li><span>03</span>Secure test checkout</li>
      </ol>
    </section>
    <div className="stay-layout">
      <div className="stay-main">
        <section className="stay-section">
          <div className="step-heading"><span>01</span><div><p className="eyebrow">WHEN THE WORLD CAN WAIT</p><h2>Choose your dates.</h2></div></div>
          <div className="stay-date-fields">
            <label>Arrival<input aria-label="Arrival date" type="date" value={checkIn} min={plusDays(today(), 1)} max={plusDays(today(), 363)} onChange={event => {
              const value = event.target.value;
              setCheckIn(value);
              if (value && checkOut <= value) setCheckOut(plusDays(value, 3));
            }}/></label>
            <label>Departure<input aria-label="Departure date" type="date" value={checkOut} min={checkIn ? plusDays(checkIn, 2) : undefined} max={checkIn ? plusDays(checkIn, 21) : undefined} onChange={event => setCheckOut(event.target.value)}/></label>
            <label>Guests<select aria-label="Guests" value={guests} onChange={event => setGuests(Number(event.target.value))}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></label>
          </div>
          <p className="search-status" role="status">{loading ? 'Checking availability and seasonal rates…' : searchError || `${results.filter(row => row.available).length} of 5 cabins available for your dates.`}</p>
          {searchError && <button className="text-link" onClick={() => setRefresh(value => value + 1)}>Try availability again <Icon name="arrow"/></button>}
          <div className="stay-cabin-list" aria-label="Choose your cabin">
            {cabins.map(item => {
              const availability = results.find(row => row.cabinId === item.id);
              return <button type="button" className={`stay-cabin-option ${item.id === cabinId ? 'selected' : ''}`} key={item.id} aria-pressed={item.id === cabinId} aria-label={`Choose ${item.name}${availability && !availability.available ? ' · unavailable' : ''}`} disabled={loading || !availability?.available} onClick={() => { setCabinId(item.id); setReserveError(''); }}>
                <img src={item.image} alt="" loading="lazy"/>
                <span className="stay-cabin-description"><span className="eyebrow">{item.number} / {item.view}</span><strong>{item.name}</strong><small>{item.capacity} guests · {item.size} m² · {item.id === 'cove' ? 'step-free concept' : item.beds}</small></span>
                <span className="stay-cabin-price">{availability?.available && availability.quote ? <>{money(availability.quote.accommodation)}<small>accommodation</small></> : <small>{loading ? 'Checking…' : availability?.reason || 'Unavailable'}</small>}</span>
                <span className="radio-mark"><Icon name="check" size={13}/></span>
              </button>;
            })}
          </div>
          <div className="selected-cabin-tools">
            <Link href={`/cabins/${cabinId}/`} className="text-link">Explore {cabin.name} & its floor plan <Icon name="diagonal" size={17}/></Link>
            <button type="button" className="text-link" aria-expanded={calendarOpen} onClick={() => setCalendarOpen(!calendarOpen)}>{calendarOpen ? 'Close calendar' : 'View cabin calendar'} <Icon name="calendar" size={17}/></button>
          </div>
          {calendarOpen && <AvailabilityCalendar cabinId={cabinId} onRange={(start, end) => { setCheckIn(start); setCheckOut(end); }}/>}
        </section>
        <section className="stay-section">
          <div className="step-heading"><span>02</span><div><p className="eyebrow">A LITTLE SOMETHING EXTRA</p><h2>Make it yours.</h2></div></div>
          <p>Two considered additions. Entirely optional.</p>
          <div className="addon-grid">{addOns.map(extra => <label className={`addon-card ${extras.includes(extra.id) ? 'selected' : ''}`} key={extra.id}>
            <img src={extra.image} alt="" loading="lazy"/>
            <div className="addon-body">
              <span className="addon-check"><input type="checkbox" checked={extras.includes(extra.id)} onChange={() => toggleExtra(extra.id)} aria-label={extra.subtitle}/><Icon name="check" size={13}/></span>
              <p className="eyebrow">{extra.subtitle}</p><h3>{extra.title}</h3><p>{extra.description}</p><strong>{money(extra.amount)} <small>{extra.unit}</small></strong>
            </div>
          </label>)}</div>
        </section>
        <section className="stay-section">
          <div className="step-heading"><span>03</span><div><p className="eyebrow">LET’S MAKE THIS YOURS</p><h2>A name for the welcome.</h2></div></div>
          <form id="guest-details" onSubmit={submit}>
            <div className="guest-fields">
              <label>Your full name<input name="name" autoComplete="name" value={name} minLength={2} maxLength={100} required placeholder="Your name" onChange={event => setName(event.target.value)}/></label>
              <label>Email for your stay<input name="email" type="email" autoComplete="email" value={email} required maxLength={254} placeholder="you@example.com" onChange={event => setEmail(event.target.value)}/></label>
            </div>
            <p className="fine-print">Your private booking link is shown after checkout. Confirmation email is sent when the owner has connected an email service. Please use test details in this portfolio demonstration.</p>
            <label className="consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/><span>I have read the <Link href="/terms/" target="_blank">booking and cancellation terms</Link> and understand this is a fictional retreat with test payments only.</span></label>
          </form>
        </section>
      </div>
      <aside className="stay-summary">
        <div className="booking-card quote-card">
          <img className="quote-image" src={cabin.image} alt={cabin.imageAlt}/>
          <div className="quote-card-content">
            <p className="eyebrow">YOUR STAY, AT A GLANCE</p><h2>{cabin.name}</h2>
            {checkIn && checkOut && <p className="quote-dates">{displayDate(checkIn)} — {displayDate(checkOut)} · {guests} {guests === 1 ? 'guest' : 'guests'}</p>}
            {quote ? <PriceBreakdown quote={quote}/> : <div className="quote-placeholder">{loading ? 'Your complete price is being checked…' : searchError || result?.reason || 'Choose valid dates to see your complete price.'}</div>}
            <div className="cancellation-note"><Icon name="shield"/><div><strong>Room to change your plans.</strong><p>Full test refund at least 7 days before arrival. No refund after that.</p></div></div>
            <button className="button button-dark full-width" type="submit" form="guest-details" disabled={!canBook || !consent}>{busy ? 'Creating your secure checkout…' : 'Continue to test payment'}<Icon name="diagonal" size={18}/></button>
            {reserveError && <p role="alert" className="form-error">{reserveError}</p>}
            <p className="checkout-note">{provider === 'simulated' ? 'Clearly labelled payment simulation — no card details or money.' : provider === 'stripe' ? 'Stripe-hosted test checkout. No live charges.' : 'Provider availability is verified before checkout.'}{PREVIEW && ' Browser-only preview; shared database behavior requires the server application.'}</p>
            <p className="fine-print centered">A reservation is confirmed only after payment verification.</p>
          </div>
        </div>
      </aside>
    </div>
  </>;
}
