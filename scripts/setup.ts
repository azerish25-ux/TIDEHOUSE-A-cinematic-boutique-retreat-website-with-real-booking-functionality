import { readFileSync, existsSync } from "node:fs";
import pg from "pg";
import { cabins, editorial } from "../lib/catalog.ts";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL before running db:setup.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('tidehouse:migrations'))",
  );
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  if (
    !(await client.query("SELECT 1 FROM schema_migrations WHERE version='001'"))
      .rowCount
  ) {
    await client.query(readFileSync("db/001_initial.sql", "utf8"));
    await client.query("INSERT INTO schema_migrations(version) VALUES('001')");
  }
  for (const c of cabins)
    await client.query(
      "INSERT INTO cabins(id,name,capacity,base_rate) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING",
      [c.id, c.name, c.capacity, c.baseRate],
    );
  for (const [slug, p] of Object.entries(editorial))
    await client.query(
      "INSERT INTO content_pages(slug,title,eyebrow,body) VALUES($1,$2,$3,$4) ON CONFLICT(slug) DO NOTHING",
      [slug, p.title, p.eyebrow, p.body],
    );
  await client.query("COMMIT");
  console.log(
    "TIDEHOUSE schema and five cabins are ready. Existing rates and edited content were preserved.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
