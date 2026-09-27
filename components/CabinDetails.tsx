'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { type Cabin, cabins as initialCabins } from '@/lib/catalog';
import { money, type Quote } from '@/lib/domain';
import { useCatalog } from './Site';
import { FloorPlan } from './FloorPlan';
import { Modal } from './Modal';
import { Arrow } from './Brand';
export type CabinAvailability = { quote: Quote | null; available: boolean; reason?: string };
export function Gallery({ cabin }: { cabin: Cabin }) {
  const [index, setIndex] = useState(0), [open, setOpen] = useState(false);
  const selected = Math.min(index, cabin.gallery.length - 1);
  return <div className='gallery'>
    <button className='gallery-main' onClick={() => setOpen(true)} aria-label={`Enlarge ${cabin.name} gallery photograph`}>
      <Image src={cabin.gallery[selected]} width={1600} height={1067} sizes='(max-width: 700px) 92vw, (max-width: 1100px) 60vw, 850px' alt={`${cabin.name} representative ${selected === 0 ? 'architecture' : selected === 1 ? 'interior' : 'landscape'} photograph`}/>
      <span className='gallery-count'>0{selected + 1} / 0{cabin.gallery.length} <span>↗</span></span>
    </button>
    <div className='gallery-thumbs'>{cabin.gallery.map((src, i) => <button key={`${cabin.id}-${i}`} onClick={() => setIndex(i)} aria-label={`Show photograph ${i + 1}`} aria-pressed={selected === i}><Image src={src} width={240} height={160} sizes='100px' alt=''/></button>)}<small>Representative imagery<br/>for a fictional retreat.</small></div>
    {open && <Modal title={`${cabin.name} gallery`} onClose={() => setOpen(false)}>
      <Image className='lightbox-image' src={cabin.gallery[selected]} width={1800} height={1200} sizes='92vw' alt={`${cabin.name} representative photograph ${selected + 1}`}/>
      <div className='gallery-navigation'><button className='text-link' onClick={() => setIndex((selected + cabin.gallery.length - 1) % cabin.gallery.length)}><Arrow direction='left'/>Previous</button><span>{selected + 1} / {cabin.gallery.length}</span><button className='text-link' onClick={() => setIndex((selected + 1) % cabin.gallery.length)}>Next<Arrow/></button></div>
    </Modal>}
  </div>;
}
export function CabinFacts({ cabin }: { cabin: Cabin }) {
  return <>
    <div className='cabin-facts'><div><small>YOUR PEOPLE</small><span>Up to {cabin.capacity} guests</span></div><div><small>YOUR SPACE</small><span>{cabin.area} m² interior</span></div><div><small>YOUR VIEW</small><span>{cabin.view}</span></div></div>
    <p className='cabin-description'>{cabin.description}</p>
    <div className='amenities'>{cabin.amenities.map(a => <span key={a}><i aria-hidden='true'>✓</i>{a}</span>)}</div>
    <details className='detail-disclosure'><summary>The floor plan <span aria-hidden='true'>+</span></summary><FloorPlan cabin={cabin}/></details>
    <details className='detail-disclosure'><summary>Access & getting around <span aria-hidden='true'>+</span></summary><p>{cabin.access}</p><Link href='/field-notes/accessibility' className='text-link'>Read the full access notes <Arrow/></Link></details>
    {cabin.faqs.map(f => <details className='detail-disclosure' key={f.question}><summary>{f.question}<span aria-hidden='true'>+</span></summary><p>{f.answer}</p></details>)}
  </>;
}
export function CabinDetailPage({ slug }: { slug: string }) {
  const { cabins } = useCatalog();
  const cabin = cabins.find(c => c.slug === slug) ?? initialCabins.find(c => c.slug === slug);
  if (!cabin) return <main id='main' className='section-pad'><h1>That cabin is not on our map.</h1><Link href='/stay'>Explore our five cabins</Link></main>;
  return <main id='main' className='cabin-page section-pad'>
    <Link href='/#cabins' className='back-link'><Arrow direction='left'/>All five cabins</Link>
    <div className='section-heading'><div><span className='eyebrow'>CABIN 0{cabin.id} / {cabin.view.toUpperCase()}</span><h1>{cabin.name}</h1><p className='serif-lead'>{cabin.subtitle}</p></div><div className='heading-aside'><p>From {money(cabin.baseRate)} / night · CAD</p><Link className='button dark' href={`/stay?cabin=${cabin.id}`}>Find your dates <Arrow/></Link></div></div>
    <div className='cabin-detail-layout'><Gallery key={cabin.id} cabin={cabin}/><div><CabinFacts cabin={cabin}/></div></div>
    <div className='notice'>Two nights minimum. Final cleaning, linen and parking included. Optional extras and illustrative tax are itemised before payment.</div>
  </main>;
}
export function Comparison({ cabins, onClose, onChoose, availability, stayLabel }: { cabins: Cabin[]; onClose: () => void; onChoose: (id: number) => void; availability?: Record<number, CabinAvailability>; stayLabel?: string }) {
  return <Modal title='A little side-by-side' onClose={onClose}>
    <h2>Find <em>your kind of quiet.</em></h2>
    {stayLabel && <p>{stayLabel}</p>}
    <div className='comparison-grid'>{cabins.map(c => {
      const result = availability?.[c.id];
      return <article key={c.id}>
        <Image src={c.image} width={800} height={534} sizes='(max-width: 700px) 42vw, 420px' alt={`Representative photograph for ${c.name}`}/>
        <h3>{c.name}</h3><dl><div><dt>Guests</dt><dd>Up to {c.capacity}</dd></div><div><dt>Space</dt><dd>{c.area} m²</dd></div><div><dt>Beds</dt><dd>{c.beds}</dd></div><div><dt>View</dt><dd>{c.view}</dd></div><div><dt>{result ? 'Complete stay' : 'Base rate'}</dt><dd>{result?.quote ? `${money(result.quote.total)} CAD` : result ? result.reason ?? 'Checking rates…' : `${money(c.baseRate)} / night`}</dd></div></dl>
        {result && <p className={`availability-status ${result.available ? '' : 'unavailable'}`}>{result.available ? 'Available for your dates' : result.reason ?? 'Unavailable for your dates'}</p>}
        <p className='comparison-access'>{c.access}</p>
        <button className='button dark' onClick={() => onChoose(c.id)} disabled={!!availability && !result?.available}>Choose {c.name}<Arrow/></button>
      </article>;
    })}</div>
    <p className='rate-note'>{stayLabel ? 'Stay totals include your selected extras and illustrative tax. Availability is checked again when you reserve; comparing does not hold dates.' : 'Base rates are not a quote. Choose dates to see the complete price.'}</p>
  </Modal>;
}
