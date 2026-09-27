import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { AppError, type Selection, type Quote, validateSelection, quoteStay, object, text, integer, parseDate, addDays, today, refundable } from './domain.ts';
import { transaction } from './db.ts';
export type BookingStatus = 'held'|'confirmed'|'cancelled'|'expired'|'failed'|'blocked'|'payment_review';
export type Booking = { id:string; cabin_id:number; arrival:string; departure:string; guests:number; guest_name:string; guest_email:string; status:BookingStatus; quote:Quote; total:number; provider:'simulator'|'stripe'|'owner'; provider_session_id:string|null; payment_intent:string|null; hold_until:Date|null; paid_at:Date|null; is_block:boolean; request_hash:string; created_at:Date };
const fields='b.*, b.arrival::text AS arrival, b.departure::text AS departure';
async function lockCabin(client:PoolClient,id:number){const r=await client.query('SELECT * FROM cabins WHERE id=$1 FOR UPDATE',[id]);if(!r.rowCount)throw new AppError(404,'Cabin not found.');return r.rows[0] as {id:number;capacity:number;base_rate:number};}
async function expireCabin(client:PoolClient,id:number){await client.query("UPDATE bookings SET status='expired',updated_at=now() WHERE cabin_id=$1 AND status='held' AND hold_until<=now()",[id]);}
async function getLocked(client:PoolClient,id:string){const row=await client.query<{cabin_id:number}>('SELECT cabin_id FROM bookings WHERE id=$1',[id]);if(!row.rowCount)throw new AppError(404,'Booking not found.');await lockCabin(client,row.rows[0].cabin_id);await expireCabin(client,row.rows[0].cabin_id);return (await client.query<Booking>(`SELECT ${fields} FROM bookings b WHERE b.id=$1 FOR UPDATE`,[id])).rows[0];}
async function quoteIn(client:PoolClient,selection:Selection,base:number){const rows=await client.query<{day:string;cents:number}>('SELECT day::text,cents FROM nightly_rates WHERE cabin_id=$1 AND day>=$2 AND day<$3',[selection.cabinId,selection.arrival,selection.departure]);return quoteStay(base,selection,Object.fromEntries(rows.rows.map(r=>[r.day,r.cents])));}
export async function readQuote(pool:Pool,raw:unknown){return transaction(pool,async client=>{const initial=validateSelection(raw),cabin=await lockCabin(client,initial.cabinId),s=validateSelection(raw,cabin.capacity);await expireCabin(client,s.cabinId);const available=!(await client.query("SELECT 1 FROM bookings WHERE cabin_id=$1 AND status IN ('held','confirmed','blocked') AND period && daterange($2::date,$3::date,'[)') LIMIT 1",[s.cabinId,s.arrival,s.departure])).rowCount;return {available,selection:s,quote:await quoteIn(client,s,cabin.base_rate)};});}
export async function reserve(pool:Pool,raw:unknown,provider:'simulator'|'stripe'){
 const data=object(raw),initial=validateSelection(data.selection),name=text(data.name,'Your name',100),email=text(data.email,'Email',254).toLowerCase(),key=text(data.idempotencyKey,'Request ID',36);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new AppError(400,'Enter a valid email address.');
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key))throw new AppError(400,'A valid request ID is required.');
 if(data.acceptedPolicy!==true)throw new AppError(400,'Please accept the booking and cancellation policy.');
 const expected=integer(data.expectedTotal,'Quoted total',1,20000000);
 const hash=createHash('sha256').update(JSON.stringify({selection:initial,name,email,expected,provider})).digest('hex');
 return transaction(pool,async client=>{
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const previous=await client.query<Booking>(`SELECT ${fields} FROM bookings b WHERE idempotency_key=$1`,[key]);
  if(previous.rowCount){if(previous.rows[0].request_hash!==hash)throw new AppError(409,'This request ID was used for different booking details.','IDEMPOTENCY_CONFLICT');return previous.rows[0];}
  const cabin=await lockCabin(client,initial.cabinId),selection=validateSelection(data.selection,cabin.capacity);await expireCabin(client,cabin.id);
  const quote=await quoteIn(client,selection,cabin.base_rate);
  if(quote.total!==expected)throw new AppError(409,'The price changed while you were choosing. Please review the updated quote.','PRICE_CHANGED');
  const id=randomUUID();
  await client.query("INSERT INTO bookings(id,cabin_id,arrival,departure,guests,status,guest_name,guest_email,quote,total,provider,idempotency_key,request_hash,hold_until) VALUES($1,$2,$3,$4,$5,'held',$6,$7,$8,$9,$10,$11,$12,now()+interval '35 minutes')",[id,selection.cabinId,selection.arrival,selection.departure,selection.guests,name,email,JSON.stringify(quote),quote.total,provider,key,hash]);
  return (await client.query<Booking>(`SELECT ${fields} FROM bookings b WHERE id=$1`,[id])).rows[0];
 });
}
export async function getBooking(pool:Pool,id:string){return transaction(pool,async client=>{const b=await getLocked(client,id);const refund=await client.query('SELECT amount,state,provider_ref FROM refund_jobs WHERE booking_id=$1',[id]);const delivery=await client.query('SELECT kind,state FROM email_outbox WHERE booking_id=$1 ORDER BY id',[id]);return {...b,refundableAmount:b.status==='confirmed'?refundable(b.arrival,b.total):0,refund:refund.rows[0]??null,emailDelivery:delivery.rows};});}
export type Settlement={eventId:string;bookingId:string;sessionId:string;provider:'stripe'|'simulator';outcome:'paid'|'failed'|'expired';amount?:number;currency?:string;paymentIntent?:string};
export async function settle(pool:Pool,event:Settlement){return transaction(pool,async client=>{
 const b=await getLocked(client,event.bookingId);
 if(b.provider!==event.provider)throw new AppError(400,'Payment provider mismatch.');
 if(event.provider==='stripe'&&b.provider_session_id!==event.sessionId)throw new AppError(409,'Payment session is not attached yet. Retry delivery.');
 if(event.outcome==='paid'&&(event.amount!==b.total||event.currency?.toUpperCase()!=='CAD'))throw new AppError(400,'Payment amount or currency did not match the reservation.');
 const receipt=await client.query('INSERT INTO payment_events(event_id,booking_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING event_id',[event.eventId,b.id]);
 if(!receipt.rowCount)return {status:b.status,duplicate:true};
 if(event.outcome==='paid'){
  if(b.status==='confirmed')return {status:b.status,duplicate:true};
  if(b.paid_at)return {status:b.status,duplicate:true};
  if(b.status==='held'){
   await client.query("UPDATE bookings SET status='confirmed',paid_at=now(),payment_intent=$2,updated_at=now() WHERE id=$1",[b.id,event.paymentIntent??event.sessionId]);
   await client.query("INSERT INTO email_outbox(booking_id,kind) VALUES($1,'confirmed') ON CONFLICT DO NOTHING",[b.id]);
   return {status:'confirmed' as const,duplicate:false};
  }
  // A late payment never resurrects expired inventory or displaces another stay.
  await client.query("UPDATE bookings SET status=CASE WHEN status='cancelled' THEN status ELSE 'payment_review' END,paid_at=now(),payment_intent=$2,updated_at=now() WHERE id=$1",[b.id,event.paymentIntent??event.sessionId]);
  await client.query('INSERT INTO refund_jobs(booking_id,amount) VALUES($1,$2) ON CONFLICT DO NOTHING',[b.id,b.total]);
  return {status:b.status==='cancelled'?'cancelled':'payment_review',duplicate:false};
 }
 if(b.status==='held')await client.query('UPDATE bookings SET status=$2,updated_at=now() WHERE id=$1',[b.id,event.outcome==='failed'?'failed':'expired']);
 return {status:b.status==='held'?(event.outcome==='failed'?'failed':'expired'):b.status,duplicate:false};
});}
export async function cancel(pool:Pool,id:string,acceptNoRefund:boolean){return transaction(pool,async client=>{
 const b=await getLocked(client,id);
 if(b.status==='cancelled')return {status:'cancelled',alreadyCancelled:true};
 if(!['held','confirmed'].includes(b.status))throw new AppError(409,'This booking is no longer active.');
 const amount=b.status==='confirmed'?refundable(b.arrival,b.total):0;
 if(b.status==='confirmed'&&amount===0&&!acceptNoRefund)throw new AppError(409,'This stay is within seven days of arrival and is non-refundable. Confirm that you accept a zero refund.','NON_REFUNDABLE');
 await client.query("UPDATE bookings SET status='cancelled',updated_at=now() WHERE id=$1",[id]);
 if(amount>0)await client.query('INSERT INTO refund_jobs(booking_id,amount) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,amount]);
 await client.query("INSERT INTO email_outbox(booking_id,kind) VALUES($1,'cancelled') ON CONFLICT DO NOTHING",[id]);
 return {status:'cancelled',refundAmount:amount,alreadyCancelled:false};
});}
export async function inventory(pool:Pool,from:string,to:string){
 parseDate(from);parseDate(to);if(to<=from||to>addDays(from,93))throw new AppError(400,'Choose an availability window of up to 93 days.');
 const rows=await pool.query("SELECT cabin_id,arrival::text,departure::text FROM bookings WHERE status IN ('confirmed','blocked') OR (status='held' AND hold_until>now())");
 return rows.rows.filter(r=>r.arrival<to&&r.departure>from);
}
export async function blockDates(pool:Pool,raw:unknown){const d=object(raw),cabinId=integer(d.cabinId,'Cabin',1,5),arrival=parseDate(d.arrival),departure=parseDate(d.departure),reason=text(d.reason,'Reason',200);if(arrival<today()||departure<=arrival||departure>addDays(arrival,366))throw new AppError(400,'Choose a future block of 1–366 nights.');return transaction(pool,async client=>{await lockCabin(client,cabinId);await expireCabin(client,cabinId);const id=randomUUID();await client.query("INSERT INTO bookings(id,cabin_id,arrival,departure,is_block,guests,status,guest_name,quote,total,provider) VALUES($1,$2,$3,$4,true,0,'blocked',$5,'{}',0,'owner')",[id,cabinId,arrival,departure,reason]);await client.query("INSERT INTO audit_log(action,details) VALUES('block_dates',$1)",[JSON.stringify({id,cabinId,arrival,departure,reason})]);return {id};});}
export async function unblockDates(pool:Pool,id:string){return transaction(pool,async client=>{const b=await getLocked(client,id);if(!b.is_block||b.status!=='blocked')throw new AppError(409,'This is not an active owner block.');await client.query("UPDATE bookings SET status='cancelled',updated_at=now() WHERE id=$1",[id]);await client.query("INSERT INTO audit_log(action,details) VALUES('unblock_dates',$1)",[JSON.stringify({id})]);return {ok:true};});}
export async function updateRates(pool:Pool,raw:unknown){const d=object(raw),cabinId=integer(d.cabinId,'Cabin',1,5),cents=integer(d.cents,'Nightly rate in cents',5000,500000);return transaction(pool,async client=>{await lockCabin(client,cabinId);if(d.mode==='base'){await client.query('UPDATE cabins SET base_rate=$2 WHERE id=$1',[cabinId,cents]);}else{const from=parseDate(d.arrival),to=parseDate(d.departure);if(from<today()||to<=from||to>addDays(from,366))throw new AppError(400,'Choose a rate window of 1–366 nights.');await client.query("INSERT INTO nightly_rates(cabin_id,day,cents) SELECT $1,d::date,$4 FROM generate_series($2::date,$3::date-1,interval '1 day') d ON CONFLICT(cabin_id,day) DO UPDATE SET cents=EXCLUDED.cents",[cabinId,from,to,cents]);}await client.query("INSERT INTO audit_log(action,details) VALUES('update_rates',$1)",[JSON.stringify(d)]);return {ok:true};});}
