import { createHmac, timingSafeEqual, scryptSync, createHash } from 'node:crypto';
import type { Pool } from 'pg';
import { AppError } from './domain.ts';
export function secret(){const value=process.env.APP_SECRET;if(!value||value.length<32)throw new AppError(503,'The server session secret is not configured.','NOT_CONFIGURED');return value;}
export function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function managementToken(id:string){return createHmac('sha256',secret()).update('manage:'+id).digest('base64url');}
export function requireBookingToken(id:string,token:string|null){if(!token||!safeEqual(token,managementToken(id)))throw new AppError(401,'Use the private link from your booking confirmation.','UNAUTHORIZED');}
export function makeAdminSession(){const body=Buffer.from(JSON.stringify({role:'owner',expires:Date.now()+8*60*60*1000})).toString('base64url');return body+'.'+createHmac('sha256',secret()).update('admin:'+body).digest('base64url');}
export function verifyAdminSession(token:string|undefined){
 if(!token)return false;
 const [body,sig]=token.split('.');if(!body||!sig)return false;
 if(!safeEqual(sig,createHmac('sha256',secret()).update('admin:'+body).digest('base64url')))return false;
 try{const data=JSON.parse(Buffer.from(body,'base64url').toString());return data.role==='owner'&&Number.isFinite(data.expires)&&data.expires>Date.now();}catch{return false;}
}
export function verifyPassword(password:string){
 const value=process.env.ADMIN_PASSWORD_HASH;
 if(!value)throw new AppError(503,'Owner login is disabled until ADMIN_PASSWORD_HASH is configured.','NOT_CONFIGURED');
 const [algorithm,salt,hash]=value.split(':');
 if(algorithm!=='scrypt'||!salt||!hash||hash.length!==128)throw new AppError(503,'Owner password configuration is invalid.','NOT_CONFIGURED');
 return safeEqual(scryptSync(password,salt,64).toString('hex'),hash);
}
export function appUrl(){const value=process.env.APP_URL??'http://localhost:3000';const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw new Error('Invalid APP_URL');return url.origin;}
export function requireOrigin(request:Request){if(request.headers.get('origin')!==appUrl())throw new AppError(403,'This request must come from the TIDEHOUSE website.','FORBIDDEN');}
export async function rateLimit(pool:Pool,request:Request,scope:string,limit=30){
 const ip=process.env.TRUST_PROXY==='true'?(request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown'):'shared';
 const key=createHash('sha256').update(scope+':'+ip).digest('hex');const bucket=Math.floor(Date.now()/60000);
 const r=await pool.query('INSERT INTO rate_limits(key,bucket,hits) VALUES($1,$2,1) ON CONFLICT(key,bucket) DO UPDATE SET hits=rate_limits.hits+1 RETURNING hits',[key,bucket]);
 if(r.rows[0].hits>limit)throw new AppError(429,'Too many attempts. Please try again in one minute.','RATE_LIMITED');
}
export function paymentMode():'stripe'|'simulator'{
 if(process.env.PAYMENT_PROVIDER==='stripe')return 'stripe';
 if(process.env.PAYMENT_PROVIDER==='simulator'&&process.env.ALLOW_PAYMENT_SIMULATOR==='true')return 'simulator';
 throw new AppError(503,'Choose and configure a test payment provider before taking bookings.','NOT_CONFIGURED');
}
