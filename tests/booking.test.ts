import test,{beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import Stripe from 'stripe';
import {reserve,settle,getBooking,readQuote,cancel,blockDates,unblockDates,updateRates,inventory} from '../lib/bookings.ts';
import {today,addDays,AppError,type Selection} from '../lib/domain.ts';
import {processRefunds,deliverEmails} from '../lib/jobs.ts';
import {stripeWebhook} from '../lib/payments.ts';
const url=process.env.TEST_DATABASE_URL;
if(!url||!new URL(url).pathname.endsWith('_test'))throw new Error('Refusing destructive tests: TEST_DATABASE_URL must point to a database ending in _test.');
const pool=new pg.Pool({connectionString:url,max:16});
const selection:Selection={cabinId:1,arrival:addDays(today(),60),departure:addDays(today(),63),guests:2,addons:[]};
async function request(s=selection,key=randomUUID()){const q=await readQuote(pool,s);return {selection:s,name:'Test Guest',email:'test@example.test',acceptedPolicy:true,expectedTotal:q.quote.total,idempotencyKey:key};}
async function held(s=selection){return reserve(pool,await request(s),'simulator');}
async function pay(id:string,eventId=randomUUID()){const b=await getBooking(pool,id);return settle(pool,{eventId,bookingId:id,sessionId:`sim_${id}`,provider:'simulator',outcome:'paid',amount:b.total,currency:'CAD'});}
beforeEach(async()=>{await pool.query('TRUNCATE bookings CASCADE');await pool.query('DELETE FROM nightly_rates');await pool.query('UPDATE cabins SET base_rate=CASE id WHEN 1 THEN 29500 WHEN 2 THEN 27500 WHEN 3 THEN 34500 WHEN 4 THEN 26500 ELSE 39500 END');});
after(async()=>{await pool.end();});
test('12 simultaneous visitors produce exactly one held reservation',async()=>{const base=await request();const results=await Promise.allSettled(Array.from({length:12},(_,i)=>reserve(pool,{...base,email:`visitor${i}@example.test`,idempotencyKey:randomUUID()},'simulator')));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);for(const r of results.filter(r=>r.status==='rejected'))assert.equal((r as PromiseRejectedResult).reason.status,409);assert.equal((await pool.query("SELECT count(*)::int AS n FROM bookings WHERE status='held'")).rows[0].n,1);});
test('same idempotency key concurrently returns one booking',async()=>{const body=await request();const results=await Promise.all(Array.from({length:6},()=>reserve(pool,body,'simulator')));assert.equal(new Set(results.map(r=>r.id)).size,1);});
test('idempotency key cannot be reused with changed details',async()=>{const body=await request();await reserve(pool,body,'simulator');await assert.rejects(()=>reserve(pool,{...body,name:'Different Guest'},'simulator'),(e:unknown)=>e instanceof AppError&&e.code==='IDEMPOTENCY_CONFLICT');});
test('database exclusion rejects an overlapping direct SQL insert',async()=>{const b=await held();await pay(b.id);await assert.rejects(()=>pool.query("INSERT INTO bookings(id,cabin_id,arrival,departure,guests,status,guest_name,guest_email,quote,total,provider,paid_at) SELECT $1,cabin_id,arrival,departure,guests,'confirmed',guest_name,guest_email,quote,total,provider,now() FROM bookings WHERE id=$2",[randomUUID(),b.id]),(e:unknown)=>(e as {code:string}).code==='23P01');});
test('adjacent checkout/checkin dates do not overlap',async()=>{const a=await held();await pay(a.id);const b=await held({...selection,arrival:selection.departure,departure:addDays(selection.departure,3)});assert.notEqual(a.id,b.id);});
test('different cabins can host the same dates',async()=>{await held();assert.ok((await held({...selection,cabinId:2})).id);});
test('failed payment never confirms and releases availability',async()=>{const b=await held();await settle(pool,{eventId:randomUUID(),bookingId:b.id,sessionId:'sim',provider:'simulator',outcome:'failed'});assert.equal((await getBooking(pool,b.id)).status,'failed');assert.equal((await readQuote(pool,selection)).available,true);assert.equal((await pool.query("SELECT count(*)::int AS n FROM bookings WHERE status='confirmed'")).rows[0].n,0);});
test('duplicate and out-of-order events do not downgrade confirmation',async()=>{const b=await held(),eventId=randomUUID();await pay(b.id,eventId);assert.equal((await pay(b.id,eventId)).duplicate,true);await settle(pool,{eventId:randomUUID(),bookingId:b.id,sessionId:'sim',provider:'simulator',outcome:'expired'});assert.equal((await getBooking(pool,b.id)).status,'confirmed');assert.equal((await pool.query('SELECT count(*)::int AS n FROM email_outbox')).rows[0].n,1);});
test('wrong payment amount or currency cannot confirm',async()=>{const b=await held();for(const [amount,currency] of [[b.total+1,'CAD'],[b.total,'USD']] as const)await assert.rejects(()=>settle(pool,{eventId:randomUUID(),bookingId:b.id,sessionId:'sim',provider:'simulator',outcome:'paid',amount,currency}));assert.equal((await getBooking(pool,b.id)).status,'held');});
test('late payment queues a refund instead of overlapping a replacement stay',async()=>{const a=await held();await pool.query("UPDATE bookings SET hold_until=now()-interval '1 minute' WHERE id=$1",[a.id]);const b=await held();await pay(b.id);await pay(a.id);assert.equal((await getBooking(pool,a.id)).status,'payment_review');assert.equal((await getBooking(pool,a.id)).refund?.amount,a.total);assert.equal((await getBooking(pool,b.id)).status,'confirmed');});
test('owner blocks and holds use the same exclusion constraint',async()=>{const b=await blockDates(pool,{cabinId:1,arrival:selection.arrival,departure:selection.departure,reason:'Maintenance'});await assert.rejects(()=>held(),(e:unknown)=>e instanceof AppError&&e.status===409);await unblockDates(pool,b.id);assert.ok((await held()).id);});
test('owner cannot block dates already confirmed',async()=>{const b=await held();await pay(b.id);await assert.rejects(()=>blockDates(pool,{cabinId:1,arrival:selection.arrival,departure:selection.departure,reason:'Maintenance'}));});
test('capacity is enforced in application and database',async()=>{await assert.rejects(()=>held({...selection,guests:3}));const b=await held();await assert.rejects(()=>pool.query('UPDATE bookings SET guests=3 WHERE id=$1',[b.id]),(e:unknown)=>(e as {code:string}).code==='23514');});
test('stale quote cannot reserve at an obsolete rate',async()=>{const body=await request();await updateRates(pool,{cabinId:1,cents:49900,mode:'base'});await assert.rejects(()=>reserve(pool,body,'simulator'),(e:unknown)=>e instanceof AppError&&e.code==='PRICE_CHANGED');});
test('rate overrides are exact; existing price snapshots remain immutable',async()=>{const b=await held();await updateRates(pool,{cabinId:1,cents:12345,mode:'window',arrival:selection.arrival,departure:selection.departure});assert.equal((await getBooking(pool,b.id)).total,b.total);assert.equal((await readQuote(pool,selection)).quote.accommodation,3*12345);});
test('full cancellation releases dates and refunds exactly once',async()=>{const b=await held();await pay(b.id);await cancel(pool,b.id,false);await cancel(pool,b.id,false);assert.equal((await readQuote(pool,selection)).available,true);assert.equal((await getBooking(pool,b.id)).refund?.state,'pending');await processRefunds(pool);await processRefunds(pool);assert.equal((await getBooking(pool,b.id)).refund?.state,'refunded');assert.equal((await pool.query('SELECT count(*)::int AS n FROM refund_jobs')).rows[0].n,1);});
test('nonrefundable cancellation requires acknowledgement',async()=>{const b=await held({...selection,arrival:addDays(today(),3),departure:addDays(today(),6)});await pay(b.id);await assert.rejects(()=>cancel(pool,b.id,false),(e:unknown)=>e instanceof AppError&&e.code==='NON_REFUNDABLE');await cancel(pool,b.id,true);assert.equal((await getBooking(pool,b.id)).status,'cancelled');assert.equal((await getBooking(pool,b.id)).refund,null);});
test('cancelled unpaid hold plus late payment queues a full refund',async()=>{const b=await held();await cancel(pool,b.id,false);await pay(b.id);const result=await getBooking(pool,b.id);assert.equal(result.status,'cancelled');assert.equal(result.refund?.amount,b.total);});
test('availability contains no guest data or booking credentials',async()=>{await held();const result=await inventory(pool,selection.arrival,selection.departure);assert.deepEqual(Object.keys(result[0]).sort(),['arrival','cabin_id','departure']);});
test('signed paid webhook confirms; bad signatures and live events are rejected',async()=>{
 process.env.STRIPE_SECRET_KEY='sk_test_'+randomUUID();process.env.STRIPE_WEBHOOK_SECRET='whsec_'+randomUUID();
 const b=await reserve(pool,await request(),'stripe');await pool.query('UPDATE bookings SET provider_session_id=$2 WHERE id=$1',[b.id,'cs_test_fixture']);
 const event={id:'evt_test_paid',object:'event',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test_fixture',object:'checkout.session',client_reference_id:b.id,metadata:{booking_id:b.id},payment_status:'paid',amount_total:b.total,currency:'cad',payment_intent:'pi_test_fixture'}}};
 const client=new Stripe(process.env.STRIPE_SECRET_KEY);const send=(e:typeof event)=>{const body=JSON.stringify(e),signature=client.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET!});return stripeWebhook(pool,body,signature);};
 await assert.rejects(()=>stripeWebhook(pool,JSON.stringify(event),'invalid'));await assert.rejects(()=>send({...event,livemode:true}));await send(event);assert.equal((await getBooking(pool,b.id)).status,'confirmed');
});

test('email outbox stops automatic retries at the limit and records owner review',async()=>{
 const b=await held();await pay(b.id);
 await pool.query("UPDATE email_outbox SET attempts=19 WHERE booking_id=$1 AND kind='confirmed'",[b.id]);
 const oldFetch=globalThis.fetch,oldKey=process.env.RESEND_API_KEY,oldFrom=process.env.EMAIL_FROM;
 let calls=0;process.env.RESEND_API_KEY='test-key';process.env.EMAIL_FROM='TIDEHOUSE <test@example.test>';
 globalThis.fetch=async()=>{calls++;return new Response('rejected',{status:500});};
 try{await deliverEmails(pool);await deliverEmails(pool);}
 finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=oldKey;if(oldFrom===undefined)delete process.env.EMAIL_FROM;else process.env.EMAIL_FROM=oldFrom;}
 const row=(await pool.query("SELECT state,attempts,last_error FROM email_outbox WHERE booking_id=$1 AND kind='confirmed'",[b.id])).rows[0];
 assert.equal(calls,1);assert.equal(row.state,'pending');assert.equal(row.attempts,20);assert.match(row.last_error,/owner review required/i);
});
