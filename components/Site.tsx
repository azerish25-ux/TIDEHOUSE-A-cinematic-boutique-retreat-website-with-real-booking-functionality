'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext,useContext,useEffect,useState,type ReactNode } from 'react';
import { cabins as initialCabins,editorial,type Cabin } from '@/lib/catalog';
import { api } from '@/lib/client';
import { TideMark,Arrow } from './Brand';
type Catalog={cabins:Cabin[];pages:typeof editorial;bookingConfigured:boolean;paymentMode:string|null};
const CatalogContext=createContext<Catalog>({cabins:initialCabins,pages:editorial,bookingConfigured:false,paymentMode:null});
export const useCatalog=()=>useContext(CatalogContext);
export function Site({children}:{children:ReactNode}){
 const [catalog,setCatalog]=useState<Catalog>({cabins:initialCabins,pages:editorial,bookingConfigured:false,paymentMode:null}),[menu,setMenu]=useState(false);const path=usePathname();
 useEffect(()=>{const controller=new AbortController();api<Catalog>('catalog',{signal:controller.signal}).then(setCatalog).catch(()=>{});return()=>controller.abort();},[path]);
 useEffect(()=>setMenu(false),[path]);
 return <CatalogContext.Provider value={catalog}><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Link href="/" className="brand" aria-label="TIDEHOUSE home"><TideMark/><span>TIDEHOUSE<small>A COASTAL RETREAT</small></span></Link><nav className="desktop-nav" aria-label="Main navigation"><Link href="/#cabins">The cabins</Link><Link href="/#property">The place</Link><Link href="/field-notes/guide">Field notes</Link></nav><div className="nav-actions"><Link href="/stay" className="nav-book">Find your stay <Arrow/></Link><button className="menu-toggle" aria-label={menu?'Close navigation':'Open navigation'} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?'Close':'Menu'}<span>{menu?'−':'+'}</span></button></div></header>{menu&&<nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/#cabins" onClick={()=>setMenu(false)}>The cabins</Link><Link href="/#property" onClick={()=>setMenu(false)}>The place</Link><Link href="/field-notes/guide">Field notes</Link><Link href="/field-notes/accessibility">Accessibility</Link></nav>}{children}<footer className="site-footer"><div className="footer-top"><div><span className="eyebrow">FIVE CABINS. ONE QUIETER CORNER OF THE WORLD.</span><h2>Come for the coast.<br/><em>Stay for the quiet.</em></h2><Link className="text-link light" href="/stay">Find a little space <Arrow/></Link></div><TideMark className="footer-mark"/></div><div className="footer-links"><span className="footer-wordmark">TIDEHOUSE</span><div><Link href="/field-notes/arrival">Getting here</Link><Link href="/field-notes/accessibility">Accessibility</Link><Link href="/field-notes/included">What’s included</Link></div><div><Link href="/field-notes/cancellation">Cancellation policy</Link><Link href="/field-notes/privacy">Privacy & project notes</Link><Link href="/studio">Owner studio</Link></div></div><div className="footer-bottom"><span>A fictional retreat. A working booking experience.</span><span>Representative photography · Test payments only · CAD</span></div></footer></CatalogContext.Provider>;
}
