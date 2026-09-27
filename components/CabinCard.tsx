import Link from 'next/link';
import type { Cabin } from '../lib/types';
import { money } from '../lib/pricing';
import { Icon } from './Icon';
import { CompareButton } from './compare';
export function CabinCard({cabin,index=0}:{cabin:Cabin;index?:number}) {return <article className={`cabin-card cabin-card-${index%3}`}><Link href={`/cabins/${cabin.id}/`} className="cabin-image"><img src={cabin.image} alt={cabin.imageAlt} loading="lazy"/><span className="image-number">{cabin.number}</span><span className="image-action"><Icon name="diagonal"/></span></Link><div className="cabin-card-heading"><div><p className="eyebrow">{cabin.view}</p><Link href={`/cabins/${cabin.id}/`}><h3>{cabin.name}</h3></Link></div><p className="rate">From {money(cabin.baseRate)}<span>/ night · CAD</span></p></div><p className="cabin-tagline">{cabin.tagline}</p><div className="cabin-card-meta"><span><Icon name="people" size={16}/>{cabin.capacity} guests</span><span><Icon name="area" size={16}/>{cabin.size} m²</span><CompareButton id={cabin.id}/></div></article>;}
