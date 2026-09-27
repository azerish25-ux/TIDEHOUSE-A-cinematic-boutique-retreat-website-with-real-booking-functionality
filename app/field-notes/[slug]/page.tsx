import {notFound} from 'next/navigation';
import {editorial} from '@/lib/catalog';
import {Editorial} from '@/components/Editorial';
export function generateStaticParams(){return Object.keys(editorial).map(slug=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return {title:editorial[slug]?.eyebrow??'Field notes'};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!Object.hasOwn(editorial,slug))notFound();return <Editorial slug={slug}/>;}
