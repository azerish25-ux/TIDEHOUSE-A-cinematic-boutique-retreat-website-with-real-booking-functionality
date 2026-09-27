import type { Metadata, Viewport } from 'next';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import './globals.css';
import { Shell } from '../components/Shell';
import { BRAND } from '../lib/site-config';
export const metadata: Metadata={title:{default:BRAND.title,template:'%s — TIDEHOUSE'},description:BRAND.description,robots:{index:false,follow:false},openGraph:{title:BRAND.title,description:BRAND.description,type:'website'},icons:{icon:`${process.env.NEXT_PUBLIC_BASE_PATH||''}/icon.svg`}};
export const viewport:Viewport={themeColor:'#24483e',width:'device-width',initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Shell>{children}</Shell></body></html>;}
