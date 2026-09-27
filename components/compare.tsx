'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cabins } from '../lib/catalog';
import type { CabinId } from '../lib/types';
import { money } from '../lib/pricing';
import { Modal } from './Modal';
import { Icon } from './Icon';
const Context=createContext<{selected:CabinId[];toggle:(id:CabinId)=>void;open:()=>void}>({selected:[],toggle:()=>{},open:()=>{}});
export const useCompare=()=>useContext(Context);
export function CompareProvider({children}:{children:ReactNode}) {
  const [selected,setSelected]=useState<CabinId[]>([]);const [open,setOpen]=useState(false);const [notice,setNotice]=useState('');
  const toggle=(id:CabinId)=>{setNotice('');setSelected(current=>{if(current.includes(id))return current.filter(v=>v!==id);if(current.length===2){setNotice('Compare two at a time. Remove a cabin to choose another.');return current;}return [...current,id];});};
  const chosen=selected.map(id=>cabins.find(c=>c.id===id)!);
  return <Context.Provider value={{selected,toggle,open:()=>setOpen(true)}}>{children}{selected.length>0&&<aside className="compare-tray" aria-label="Cabin comparison"><div><span className="eyebrow">YOUR SHORTLIST</span><p>{chosen.map(c=>c.name).join(' + ')} <small>{selected.length}/2</small></p></div><button className="button button-light" onClick={()=>setOpen(true)} disabled={selected.length!==2}>Compare <Icon name="arrow" size={17}/></button><button className="icon-button" aria-label="Clear comparison" onClick={()=>{setSelected([]);setNotice('');}}><Icon name="close" size={17}/></button>{notice&&<p role="status" className="compare-notice">{notice}</p>}</aside>}<Modal open={open} onClose={()=>setOpen(false)} title="Find your kind of quiet" className="compare-modal"><h2>Two cabins.<br/><em>Your choice.</em></h2><div className="compare-columns">{chosen.map(c=><article key={c.id}><img src={c.image} alt={c.imageAlt}/><p className="eyebrow">CABIN {c.number}</p><h3>{c.name}</h3><dl><div><dt>View</dt><dd>{c.view}</dd></div><div><dt>Guests</dt><dd>Up to {c.capacity}</dd></div><div><dt>Space</dt><dd>{c.size} m² · {c.beds}</dd></div><div><dt>Access</dt><dd>{c.id==='cove'?'Step-free concept':'Entrance steps'}</dd></div><div><dt>Base rate</dt><dd>From {money(c.baseRate)} / night</dd></div></dl><Link href={`/cabins/${c.id}/`} className="text-link" onClick={()=>setOpen(false)}>Explore {c.name} <Icon name="arrow"/></Link><Link href={`/stay/?cabin=${c.id}`} className="button button-dark" onClick={()=>setOpen(false)}>Choose {c.name} <Icon name="diagonal"/></Link></article>)}</div><p className="fine-print">Rates depend on your dates. Your complete price is shown before checkout.</p></Modal></Context.Provider>;
}
export function CompareButton({id}:{id:CabinId}) { const {selected,toggle}=useCompare();return <button type="button" className="compare-button" aria-pressed={selected.includes(id)} onClick={()=>toggle(id)}><span className="checkbox-mark"><Icon name={selected.includes(id)?'check':'plus'} size={12}/></span>Compare {cabins.find(c=>c.id===id)?.name}</button>; }
