import { app } from './app';
import { config } from './config';
import { pool } from './db';
import { startWorker } from './worker';
const server = app.listen(config.port, '0.0.0.0', () => console.log(`TIDEHOUSE listening on ${config.port}; provider=${config.provider}; live payments disabled.`));
const worker = startWorker();
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {
  clearInterval(worker);
  server.close(() => { pool.end().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(1), 10000).unref();
});
