import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
let name='';try{name=new URL(process.env.DATABASE_URL||'').pathname;}catch{}
if(!name.endsWith('_test')){console.error('Integration tests reset database contents. DATABASE_URL must point to a separate database whose name ends in _test.');process.exit(1);}
