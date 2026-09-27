import { addDays, parseDate, today, type Selection } from './domain.ts';

/** Public links are untrusted input; never use clamping to manufacture a cabin ID. */
export function readStayLink(params: Pick<URLSearchParams, 'get'>, clock = today()) {
  let corrected = false;
  function discrete(key: string, allowed: readonly number[], fallback: number) {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(value) || !allowed.includes(value)) {
      corrected = true;
      return fallback;
    }
    return value;
  }
  function date(key: string, fallback: string, min: string, max: string) {
    const raw = params.get(key);
    if (raw === null) return fallback;
    try {
      const value = parseDate(raw);
      if (value < min || value > max) throw new Error('Outside booking window');
      return value;
    } catch {
      corrected = true;
      return fallback;
    }
  }
  const arrival = date('arrival', addDays(clock, 14), addDays(clock, 1), addDays(clock, 365));
  const departure = date('departure', addDays(arrival, 3), addDays(arrival, 2), addDays(arrival, 21));
  const selection: Selection = {
    cabinId: discrete('cabin', [1, 2, 3, 4, 5], 1),
    guests: discrete('guests', [1, 2, 3, 4], 2),
    arrival,
    departure,
    addons: [],
  };
  return { selection, corrected };
}

/** Pair a response with the exact inputs it priced, even between render and effect. */
export function selectionKey(selection: Selection) {
  return JSON.stringify({ ...selection, addons: [...selection.addons].sort() });
}
