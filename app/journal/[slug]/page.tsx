import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EditorialArticle } from '../../../components/Editorial';
import { imagery } from '../../../lib/catalog';
const slugs=['shoreline','at-the-table','the-art-of-less'];
export function generateStaticParams(){return slugs.map(slug=>({slug}));}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const i=slugs.indexOf(slug);if(i===-1)notFound();return <><div className="article-photo"><img src={[imagery.sea,imagery.breakfast,imagery.forest][i]} alt="Photographic reference for the TIDEHOUSE field notes"/></div><EditorialArticle slug={slug}/><div className="article-return"><Link href="/journal/" className="text-link">← All field notes</Link><Link href="/stay/" className="text-link">Find your stay ↗</Link></div></>;}
