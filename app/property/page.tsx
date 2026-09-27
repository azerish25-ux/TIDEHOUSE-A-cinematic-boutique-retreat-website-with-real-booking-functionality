import Link from 'next/link';
import { PropertyMap } from '../../components/PropertyMap';
import { EditorialArticle } from '../../components/Editorial';
import { DateSearch } from '../../components/DateSearch';
export const metadata={title:'Our little world'};
export default function Page(){return <><EditorialArticle slug="our-place"/><PropertyMap compact/><div className="property-practical"><div><p className="eyebrow">A FEW USEFUL THINGS</p><h2>A thoughtful place.<br/><em>A clear plan.</em></h2></div><div><p>Five cabins, one welcome house and a private sauna by the water. Walking paths connect the property; a parking space is included with each cabin.</p><p>The map is an illustrated concept, not navigation for a real place. Read the practical details before exploring the booking demonstration.</p><Link href="/accessibility/" className="text-link">Accessibility & terrain →</Link><Link href="/arrival/" className="text-link">Arrival & what’s included →</Link></div></div><div className="search-wrap"><DateSearch/></div></>;}
