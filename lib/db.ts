import pg from "pg";
import type { Pool, PoolClient } from "pg";
import { AppError } from "./domain.ts";
const globalDb = globalThis as unknown as { tidehousePool?: Pool };
export function getPool(): Pool {
  if (!process.env.DATABASE_URL)
    throw new AppError(
      503,
      "The booking database is not configured. The retreat can be explored, but no reservation has been created.",
      "NOT_CONFIGURED",
    );
  return (globalDb.tidehousePool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='8s'");
    await client.query("SET LOCAL statement_timeout='20s'");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23P01")
      throw new AppError(
        409,
        "Those dates were just reserved or blocked. Please choose another cabin or different dates.",
        "DATES_UNAVAILABLE",
      );
    throw error;
  } finally {
    client.release();
  }
}
