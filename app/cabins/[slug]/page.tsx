import { cabins } from '../../../lib/catalog';
import { CabinDetail } from '../../../components/CabinDetail';
import { notFound } from 'next/navigation';
export function generateStaticParams(){return cabins.map(c=>({slug:c.id}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const cabin=cabins.find(c=>c.id===slug);return {title:cabin?`${cabin.name} cabin`: 'Cabin',description:cabin?.description};}
export default async function CabinPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const cabin=cabins.find(c=>c.id===slug);if(!cabin)notFound();return <CabinDetail cabin={cabin}/>;}
