"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { addDays, today, formatDate, parseDate } from "@/lib/domain";
import { api } from "@/lib/client";
import {
  firstOfMonth, calendarKeyDate, canDepart, suggestedDeparture, nightOccupied,
  type CalendarInventory, type OccupiedNightRange,
} from "@/lib/calendar-days";
import { Arrow } from "./Brand";
export type Occupied = OccupiedNightRange;

export function Calendar({ cabinId, arrival, departure, onChange }: {
  cabinId: number; arrival: string; departure: string;
  onChange: (start: string, end: string) => void;
}) {
  const clock = today();
  const firstArrival = addDays(clock, 1), lastArrival = addDays(clock, 365);
  const [month, setMonth] = useState(firstOfMonth(arrival));
  const [pickingEnd, setPickingEnd] = useState(false);
  const [focusDay, setFocusDay] = useState(arrival);
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    key: string; inventory: CalendarInventory | null; error: string;
  }>({ key: '', inventory: null, error: '' });
  const root = useRef<HTMLDivElement>(null), pendingFocus = useRef<string | null>(null);
  const id = useId(), key = `${cabinId}:${month}`;
  const loading = snapshot.key !== key;
  const error = !loading ? snapshot.error : '';
  const inventory = !loading && !error ? snapshot.inventory : null;
  useEffect(() => {
    let active = true, inFlight = false;
    const controller = new AbortController();
    // 21 preceding days cover a stay begun in the previous month. The full query
    // remains within the API's 93-day limit, including both visible months.
    const from = addDays(month, -21), to = addDays(month, 72);
    async function load() {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await api<{ occupied: Occupied[] }>(`availability?from=${from}&to=${to}`, { signal: controller.signal });
        if (active) setSnapshot({ key, inventory: { from, to, occupied: data.occupied }, error: '' });
      } catch (e) {
        if (active) setSnapshot({ key, inventory: null, error: e instanceof Error ? e.message : 'Availability could not be loaded.' });
      } finally { inFlight = false; }
    }
    void load();
    const timer = setInterval(load, 15000);
    window.addEventListener('focus', load);
    return () => { active = false; controller.abort(); clearInterval(timer); window.removeEventListener('focus', load); };
  }, [key, month, refresh]);
  useEffect(() => {
    setPickingEnd(false);
    setNotice('');
  }, [cabinId]);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const button = root.current?.querySelector<HTMLButtonElement>(`button[data-date="${pendingFocus.current}"]`);
    if (button) { button.focus({ preventScroll: true }); pendingFocus.current = null; }
  }, [focusDay, month]);
  const endAllowed = (day: string) => canDepart(inventory, cabinId, arrival, day, clock);
  function dayReason(day: string): string {
    if (loading) return 'Availability is loading';
    if (error) return 'Availability could not be checked';
    if (pickingEnd && day > arrival) return endAllowed(day) ? '' : 'Departure unavailable for this arrival';
    if (day < firstArrival) return 'Past or same-day arrival';
    if (day > lastArrival) return 'Outside the arrival booking window';
    if (inventory && nightOccupied(inventory, cabinId, day)) return 'Occupied night';
    return suggestedDeparture(inventory, cabinId, day, clock) ? '' : 'No two-night stay from this date';
  }
  function choose(day: string) {
    if (dayReason(day)) return;
    setFocusDay(day);
    if (pickingEnd && day > arrival && endAllowed(day)) {
      onChange(arrival, day);
      setPickingEnd(false);
      setNotice(`Stay selected: ${formatDate(arrival)} to ${formatDate(day)}.`);
    } else {
      const end = suggestedDeparture(inventory, cabinId, day, clock);
      if (!end) return;
      onChange(day, end);
      setPickingEnd(true);
      setNotice(`Arriving ${formatDate(day)}. Now choose a departure, two to twenty-one nights later.`);
    }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    if (event.key === 'Escape') {
      setPickingEnd(false); setNotice('Date selection finished. Your selected stay is unchanged.'); return;
    }
    const moved = calendarKeyDate(day, event.key, event.shiftKey);
    if (!moved) return;
    event.preventDefault();
    const min = firstOfMonth(clock), max = addDays(lastArrival, 21);
    const target = moved < min ? min : moved > max ? max : moved;
    if (target < month || target >= firstOfMonth(month, 2)) setMonth(firstOfMonth(target));
    pendingFocus.current = target;
    setFocusDay(target);
  }
  function browse(offset: number) {
    const next = firstOfMonth(month, offset);
    setMonth(next);
    setFocusDay(next < firstArrival ? firstArrival : next);
  }
  function typedArrival(value: string) {
    if (!value) return;
    try {
      const day = parseDate(value);
      if (day < firstArrival || day > lastArrival) throw new Error('Choose an arrival from tomorrow to one year ahead.');
      // Typed dates may lie outside the currently loaded grid. The batch search
      // rechecks them server-side; never infer availability from missing data.
      const covered = inventory && day >= inventory.from && addDays(day, 3) <= inventory.to;
      const end = covered ? suggestedDeparture(inventory, cabinId, day, clock) : addDays(day, 3);
      if (!end) throw new Error('There is no two-night stay from that arrival. Choose another date.');
      onChange(day, end); setMonth(firstOfMonth(day)); setFocusDay(day); setPickingEnd(false); setNotice('Your dates are being checked against current availability.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Choose a valid arrival date.'); }
  }
  function typedDeparture(value: string) {
    if (!value) return;
    try {
      const day = parseDate(value);
      if (day < addDays(arrival, 2) || day > addDays(arrival, 21)) throw new Error('Choose a stay of two to twenty-one nights.');
      onChange(arrival, day); setPickingEnd(false); setNotice('Your dates are being checked against current availability.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Choose a valid departure date.'); }
  }
  return <div className="calendar" ref={root}>
    <div className="calendar-controls">
      <div><span className="eyebrow">{pickingEnd ? 'NOW CHOOSE YOUR DEPARTURE' : 'CHOOSE YOUR DATES'}</span>
        <p>{pickingEnd ? `Arriving ${formatDate(arrival)} · minimum 2 nights` : 'Stay a little. Two nights, or a few more.'}</p></div>
      <div className="calendar-arrows">
        <button type="button" className="round-button" aria-label="Previous month" disabled={month <= firstOfMonth(clock)} onClick={() => browse(-1)}><Arrow direction="left" /></button>
        <button type="button" className="round-button" aria-label="Next month" disabled={month >= firstOfMonth(pickingEnd ? addDays(lastArrival, 21) : lastArrival)} onClick={() => browse(1)}><Arrow /></button>
      </div>
    </div>
    <p id={`${id}-help`} className="calendar-instructions">Choose arrival, then departure. Use arrow keys to move, Page Up or Down to change month, and Enter to select. Unavailable dates can be explored but not selected.</p>
    {error && <div className="notice error"><p role="alert">{error}</p><button type="button" className="text-link" onClick={() => setRefresh(n => n + 1)}>Retry calendar availability <Arrow /></button></div>}
    <p className="calendar-announcement sr-only" role="status">{notice}</p>
    <div className="calendar-months" aria-busy={loading}>
      {[0, 1].map(offset => {
        const first = firstOfMonth(month, offset), next = firstOfMonth(first, 1);
        const start = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
        const days = Math.round((Date.parse(`${next}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000);
        const title = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${first}T12:00:00Z`));
        const tabStop = focusDay >= first && focusDay < next ? focusDay : arrival >= first && arrival < next ? arrival : first >= firstArrival ? first : firstArrival < next ? firstArrival : first;
        return <div className="calendar-month" key={first}>
          <h4 id={`${id}-${offset}`}>{title}</h4>
          <div className="calendar-grid" role="grid" aria-labelledby={`${id}-${offset}`} aria-describedby={`${id}-help`} aria-multiselectable="true">
            <div className="calendar-weekdays" role="row">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => <span role="columnheader" aria-label={day} key={day}>{day.slice(0, 2)}</span>)}</div>
            <div className="calendar-days" role="rowgroup">
              {Array.from({ length: Math.ceil((start + days) / 7) }, (_, week) => <div className="calendar-week" role="row" key={week}>
                {Array.from({ length: 7 }, (_, weekday) => {
                  const n = week * 7 + weekday - start;
                  if (n < 0 || n >= days) return <span role="gridcell" className="calendar-cell empty" key={weekday} />;
                  const day = addDays(first, n), reason = dayReason(day);
                  const occupied = inventory ? nightOccupied(inventory, cabinId, day) : false;
                  const isEnd = pickingEnd && endAllowed(day), inside = day > arrival && day < departure;
                  return <span role="gridcell" className="calendar-cell" aria-selected={day >= arrival && day <= departure} key={day}>
                    <button type="button" data-date={day} tabIndex={day === tabStop ? 0 : -1}
                      aria-disabled={!!reason} aria-pressed={day === arrival || day === departure}
                      aria-current={day === clock ? 'date' : undefined}
                      aria-label={`${formatDate(day)}${day === arrival ? ' — selected arrival' : day === departure ? ' — selected departure' : ''}${isEnd ? ' — departure available' : reason ? ` — ${reason.toLowerCase()}` : ''}`}
                      onFocus={() => setFocusDay(day)} onKeyDown={e => navigate(e, day)} onClick={() => choose(day)}
                      className={`${inside ? 'in-range ' : ''}${day === arrival ? 'range-start ' : ''}${day === departure ? 'range-end ' : ''}${occupied ? 'occupied ' : ''}${isEnd ? 'departure-possible ' : ''}`}>
                      {n + 1}
                    </button>
                  </span>;
                })}
              </div>)}
            </div>
          </div>
        </div>;
      })}
    </div>
    <div className="calendar-key"><span><i /> Selected stay</span><span><s>14</s> Unavailable night</span><span>Check-in 15:00 · Check-out 11:00</span></div>
    <div className="date-input-fallback">
      <label>Arrival<input type="date" value={arrival} min={firstArrival} max={lastArrival} onChange={e => typedArrival(e.target.value)} /></label>
      <label>Departure<input type="date" value={departure} min={addDays(arrival, 2)} max={addDays(arrival, 21)} onChange={e => typedDeparture(e.target.value)} /></label>
    </div>
    {notice && <p className="calendar-feedback">{notice}</p>}
  </div>;
}
