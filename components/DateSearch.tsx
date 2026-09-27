'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { plusDays, today, parseDate } from '../lib/pricing';
import { Icon } from './Icon';
export function DateSearch({dark=false}:{dark?:boolean}) {
  const router=useRouter();const [start,setStart]=useState('');const [end,setEnd]=useState('');const [guests,setGuests]=useState('2');const [error,setError]=useState('');
  useEffect(()=>{setStart(plusDays(today(),14));setEnd(plusDays(today(),17));},[]);
  function submit(event:FormEvent){event.preventDefault();setError('');try{parseDate(start);parseDate(end);if(end<plusDays(start,2)||end>plusDays(start,21))throw new Error('Choose a stay of 2–21 nights.');router.push(`/stay/?checkIn=${start}&checkOut=${end}&guests=${guests}`);}catch(e){setError(e instanceof Error?e.message:'Choose your dates.');}}
  return <form onSubmit={submit} className={`date-search ${dark?'date-search-dark':''}`}><div className="date-search-intro"><span className="eyebrow">YOUR NEXT CHAPTER</span><span>Find your stay.</span></div><label><span>ARRIVAL</span><input aria-label="Arrival" type="date" min={plusDays(today(),1)} max={plusDays(today(),363)} value={start} onChange={e=>{setStart(e.target.value);if(e.target.value&&end<=e.target.value)setEnd(plusDays(e.target.value,3));}} required/></label><label><span>DEPARTURE</span><input aria-label="Departure" type="date" min={start?plusDays(start,2):undefined} max={start?plusDays(start,21):undefined} value={end} onChange={e=>setEnd(e.target.value)} required/></label><label><span>GOOD COMPANY</span><select aria-label="Number of guests" value={guests} onChange={e=>setGuests(e.target.value)}>{[1,2,3,4].map(n=><option key={n} value={n}>{n} {n===1?'guest':'guests'}</option>)}</select></label><button className="button button-dark" type="submit">Find my quiet <Icon name="diagonal"/></button>{error&&<p className="form-error" role="alert">{error}</p>}</form>;
}
