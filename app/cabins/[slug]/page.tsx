import {notFound} from 'next/navigation';
import {cabins} from '@/lib/catalog';
import {CabinDetailPage} from '@/components/CabinDetails';
export function generateStaticParams(){return cabins.map(c=>({slug:c.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return {title:cabins.find(c=>c.slug===slug)?.name??'Cabin'};}
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!cabins.some(c=>c.slug===slug))notFound();return <CabinDetailPage slug={slug}/>;}
