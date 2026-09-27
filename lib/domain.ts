import type { AddonId } from "./catalog.ts";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "INVALID_REQUEST",
  ) {
    super(message);
  }
}
export type Selection = {
  cabinId: number;
  arrival: string;
  departure: string;
  guests: number;
  addons: AddonId[];
};
export type Quote = {
  currency: "CAD";
  nights: { date: string; cents: number }[];
  accommodation: number;
  extras: {
    id: AddonId;
    name: string;
    quantity: number;
    unit: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  taxBps: number;
  total: number;
};
export const DAY = 86400000;
export function parseDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AppError(400, "Choose a valid calendar date.");
  const date = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new AppError(400, "That calendar date does not exist.");
  return value;
}
export function addDays(date: string, days: number) {
  return new Date(
    new Date(parseDate(date) + "T00:00:00Z").getTime() + days * DAY,
  )
    .toISOString()
    .slice(0, 10);
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Halifax",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function datesBetween(arrival: string, departure: string) {
  const dates: string[] = [];
  for (let d = arrival; d < departure; d = addDays(d, 1)) {
    dates.push(d);
    if (dates.length > 366) throw new AppError(400, "Date range is too long.");
  }
  return dates;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError(400, "A JSON object is required.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new AppError(
      400,
      `${label} is required (maximum ${max} characters).`,
    );
  return value.trim();
}
export function integer(
  value: unknown,
  label: string,
  min: number,
  max: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new AppError(400, `${label} must be between ${min} and ${max}.`);
  return value;
}
export function validateSelection(
  raw: unknown,
  capacity = 4,
  clock = today(),
): Selection {
  const v = object(raw);
  const arrival = parseDate(v.arrival),
    departure = parseDate(v.departure);
  if (arrival < addDays(clock, 1))
    throw new AppError(400, "Please book at least one day before arrival.");
  if (arrival > addDays(clock, 365) || departure > addDays(clock, 386))
    throw new AppError(400, "We release dates up to one year ahead.");
  const length = (Date.parse(departure) - Date.parse(arrival)) / DAY;
  if (length < 2 || length > 21)
    throw new AppError(400, "Choose a stay of 2–21 nights.");
  if (
    !Array.isArray(v.addons) ||
    v.addons.some((a) => a !== "breakfast" && a !== "sauna") ||
    new Set(v.addons).size !== v.addons.length
  )
    throw new AppError(
      400,
      "Choose only the available optional extras, once each.",
    );
  return {
    cabinId: integer(v.cabinId, "Cabin", 1, 5),
    arrival,
    departure,
    guests: integer(v.guests, "Total guests", 1, capacity),
    addons: [...v.addons].sort() as AddonId[],
  };
}
export function quoteStay(
  base: number,
  selection: Selection,
  overrides: Record<string, number> = {},
  taxBps = 1500,
): Quote {
  const nights = datesBetween(selection.arrival, selection.departure).map(
    (date) => {
      const d = new Date(date + "T12:00:00Z"),
        month = d.getUTCMonth() + 1;
      const seasonal =
        month >= 6 && month <= 8 ? 128 : month <= 3 || month >= 11 ? 85 : 100;
      const weekend = d.getUTCDay() === 5 || d.getUTCDay() === 6 ? 110 : 100;
      return {
        date,
        cents:
          overrides[date] ?? Math.round((base * seasonal * weekend) / 10000),
      };
    },
  );
  const accommodation = nights.reduce((n, d) => n + d.cents, 0);
  const extras: Quote["extras"] = selection.addons.map((id) =>
    id === "breakfast"
      ? {
          id,
          name: "Slow-morning breakfast",
          quantity: selection.guests * nights.length,
          unit: 2400,
          total: selection.guests * nights.length * 2400,
        }
      : {
          id,
          name: "Private sauna session",
          quantity: 1,
          unit: 6500,
          total: 6500,
        },
  );
  const subtotal = accommodation + extras.reduce((n, e) => n + e.total, 0),
    tax = Math.round((subtotal * taxBps) / 10000);
  return {
    currency: "CAD",
    nights,
    accommodation,
    extras,
    subtotal,
    tax,
    taxBps,
    total: subtotal + tax,
  };
}
export function refundable(arrival: string, total: number, clock = today()) {
  return arrival >= addDays(clock, 7) ? total : 0;
}
export function money(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T12:00:00Z"));
}
