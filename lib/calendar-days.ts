import { addDays, datesBetween, parseDate } from './domain.ts';

export type OccupiedNightRange = { cabin_id: number; arrival: string; departure: string };
export type CalendarInventory = { from: string; to: string; occupied: OccupiedNightRange[] };

export function firstOfMonth(value: string, offset = 0): string {
  const date = new Date(`${parseDate(value)}T12:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1, 12))
    .toISOString().slice(0, 10);
}

/** Preserve the day when possible; January 31 + one month is February's last day. */
export function moveMonth(value: string, offset: number): string {
  const date = new Date(`${parseDate(value)}T12:00:00Z`);
  const first = new Date(`${firstOfMonth(value, offset)}T12:00:00Z`);
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return addDays(first.toISOString().slice(0, 10), Math.min(date.getUTCDate(), last) - 1);
}

export function calendarKeyDate(value: string, key: string, shift = false): string | null {
  const weekday = (new Date(`${parseDate(value)}T12:00:00Z`).getUTCDay() + 6) % 7;
  switch (key) {
    case 'ArrowLeft': return addDays(value, -1);
    case 'ArrowRight': return addDays(value, 1);
    case 'ArrowUp': return addDays(value, -7);
    case 'ArrowDown': return addDays(value, 7);
    case 'Home': return addDays(value, -weekday);
    case 'End': return addDays(value, 6 - weekday);
    case 'PageUp': return moveMonth(value, shift ? -12 : -1);
    case 'PageDown': return moveMonth(value, shift ? 12 : 1);
    default: return null;
  }
}

export function nightOccupied(inventory: CalendarInventory, cabinId: number, date: string): boolean {
  return inventory.occupied.some(r => r.cabin_id === cabinId && date >= r.arrival && date < r.departure);
}

/** Inventory is half-open. An occupied departure day does not consume that night. */
export function canDepart(
  inventory: CalendarInventory | null, cabinId: number, arrival: string, departure: string, clock: string,
): boolean {
  if (!inventory || arrival <= clock || arrival > addDays(clock, 365) ||
      departure < addDays(arrival, 2) || departure > addDays(arrival, 21) ||
      arrival < inventory.from || departure > inventory.to) return false;
  return datesBetween(arrival, departure).every(day => !nightOccupied(inventory, cabinId, day));
}

/** Never auto-select a three-night stay through a blocked night or a one-night gap. */
export function suggestedDeparture(
  inventory: CalendarInventory | null, cabinId: number, arrival: string, clock: string,
): string | null {
  for (const nights of [3, 2]) {
    const end = addDays(arrival, nights);
    if (canDepart(inventory, cabinId, arrival, end, clock)) return end;
  }
  return null;
}
