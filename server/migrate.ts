import { readFile } from 'node:fs/promises';
import { cabins, editorial } from '../lib/catalog';
import { pool, transaction } from './db';
export async function migrate() {
  await transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(721830, 1)');
    await client.query(await readFile(new URL('../db/001_initial.sql', import.meta.url), 'utf8'));
    for (const cabin of cabins) await client.query('INSERT INTO cabins(id,base_rate) VALUES($1,$2) ON CONFLICT DO NOTHING', [cabin.id, cabin.baseRate]);
    for (const doc of editorial) await client.query('INSERT INTO documents(slug,title,eyebrow,body) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [doc.slug, doc.title, doc.eyebrow, doc.body]);
  });
}
if (process.argv[1]?.endsWith('migrate.ts')) migrate().then(() => { console.log('Database migration complete.'); return pool.end(); }).catch(error => { console.error(error); process.exitCode = 1; return pool.end(); });
