import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if(existsSync('.env'))process.loadEnvFile('.env');
const tsx=resolve('node_modules/tsx/dist/cli.mjs');
const migration=spawn(process.execPath,[tsx,'server/migrate.ts'],{stdio:'inherit',env:process.env});
const migrated=await new Promise(resolve=>migration.on('exit',resolve));
if(migrated!==0)process.exit(1);
const children=[
  spawn(process.execPath,[tsx,'watch','server/index.ts'],{stdio:'inherit',env:{...process.env,PORT:'3001',APP_ORIGIN:'http://localhost:3000'}}),
  spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','-p','3000'],{stdio:'inherit',env:process.env}),
];
let closing=false;
function close(code=0){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),500).unref();}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>close());
for(const child of children){child.on('error',error=>{console.error(error.message);close(1);});child.on('exit',code=>close(code||0));}
