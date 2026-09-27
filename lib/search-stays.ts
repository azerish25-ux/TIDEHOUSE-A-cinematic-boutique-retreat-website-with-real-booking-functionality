import type { Pool } from "pg";
import { cabins } from "./catalog.ts";
import { validateSelection } from "./domain.ts";
import { readQuote } from "./bookings.ts";

/** A single request returns comparable, server-calculated stay totals for all cabins. */
export async function searchStays(pool: Pool, raw: unknown) {
  const selection = validateSelection(raw);
  const rows = await Promise.all(
    cabins.map(async (cabin) => {
      if (selection.guests > cabin.capacity)
        return [
          cabin.id,
          {
            available: false,
            quote: null,
            reason: `Up to ${cabin.capacity} guests`,
          },
        ] as const;
      const result = await readQuote(pool, { ...selection, cabinId: cabin.id });
      return [
        cabin.id,
        {
          ...result,
          reason: result.available ? undefined : "Unavailable for these dates",
        },
      ] as const;
    }),
  );
  return { results: Object.fromEntries(rows) };
}
