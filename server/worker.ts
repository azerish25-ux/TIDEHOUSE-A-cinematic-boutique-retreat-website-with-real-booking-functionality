import { reconcileHolds } from './booking-service';
import { processOutbox } from './outbox';
import { pool } from './db';
let running = false;
export async function tick() {
  if (running) return;
  running = true;
  try {
    await reconcileHolds(); await processOutbox();
    await pool.query('DELETE FROM admin_sessions WHERE expires_at<now()');
    await pool.query("DELETE FROM rate_limits WHERE expires_at<now()-interval '1 hour'");
  } finally { running = false; }
}
export function startWorker() {
  const timer = setInterval(() => { tick().catch(() => console.error('Background maintenance deferred.')); }, 15000);
  timer.unref(); return timer;
}
if (process.argv[1]?.endsWith('worker.ts')) {
  const timer = startWorker(); timer.ref();
  void tick().catch(() => console.error('Initial maintenance deferred.'));
}
