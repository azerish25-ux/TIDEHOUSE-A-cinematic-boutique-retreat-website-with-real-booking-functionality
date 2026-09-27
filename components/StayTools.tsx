'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { datesBetween, formatDate, type Selection } from '@/lib/domain';
import { stayPath } from '@/lib/stay-link';
import { Arrow } from './Brand';

export function StayTools({ selection, cabinName }: { selection: Selection; cabinName: string }) {
  const path = stayPath(selection);
  const [shared, setShared] = useState<{ path: string; url: string; copied: boolean } | null>(null);
  const request = useRef(0);
  const linkField = useRef<HTMLInputElement>(null);
  const label = useId();
  const current = shared?.path === path ? shared : null;
  useEffect(() => { request.current += 1; }, [path]);
  useEffect(() => { if (current && !current.copied) linkField.current?.select(); }, [current]);
  async function share() {
    const number = ++request.current;
    const url = `${window.location.origin}${path}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch { /* A selectable link is available without clipboard permission. */ }
    if (request.current === number) setShared({ path, url, copied });
  }
  function changeDates() {
    const field = document.querySelector<HTMLInputElement>('#dates input[type="date"]');
    field?.focus({ preventScroll: true });
    document.getElementById('dates')?.scrollIntoView({
      block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }
  return (
    <section className="stay-tools" aria-label="Your stay choices">
      <div className="stay-tools-copy">
        <span className="eyebrow">YOUR TIME BY THE WATER</span>
        <p>{formatDate(selection.arrival)} <span aria-hidden="true">—</span><span className="sr-only">to</span> {formatDate(selection.departure)}</p>
        <small>{datesBetween(selection.arrival, selection.departure).length} nights · {selection.guests} {selection.guests === 1 ? 'guest' : 'guests'} · {cabinName}</small>
      </div>
      <div className="stay-tools-actions">
        <button type="button" className="text-link" onClick={changeDates}>Change dates <Arrow /></button>
        <button type="button" className="button outline share-stay" onClick={share}>Share this stay <Arrow /></button>
      </div>
      {current && <div className="stay-share-result">
        <p role="status">{current.copied ? 'Stay link copied.' : 'Copy this stay link to share your choices.'} Dates, cabin, guests and extras only; no names, email or private booking details. Availability and prices are checked again when opened.</p>
        {!current.copied && <><label htmlFor={label}>Public stay link</label><input id={label} ref={linkField} readOnly value={current.url} onFocus={e => e.target.select()} /></>}
      </div>}
    </section>
  );
}
