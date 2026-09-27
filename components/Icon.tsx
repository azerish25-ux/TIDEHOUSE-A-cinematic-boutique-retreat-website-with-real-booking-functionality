import type { CSSProperties } from 'react';
const paths = {
  arrow: 'M4 12h16M13 5l7 7-7 7', diagonal:'M5 19 19 5M5 5h14v14', chevron:'m9 5 7 7-7 7', down:'m5 9 7 7 7-7', close:'m6 6 12 12M6 18 18 6', menu:'M3 7h18M3 12h18M3 17h18',
  check:'m4 12 5 5L20 6', plus:'M12 5v14M5 12h14', minus:'M5 12h14',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M17 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  bed:'M3 18v-7h18v7M3 15h18M3 18v3M21 18v3M5 11V5h14v6M8 8h3M14 8h3',
  area:'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8z',
  calendar:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2',
  waves:'M2 7c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 12c3-4 5 4 8 0s5 4 8 0 4 0 4 0M2 17c3-4 5 4 8 0s5 4 8 0 4 0 4 0',
  shield:'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6',
  sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2',
  leaf:'M20 3C5 3 2 7 4 15c7 7 16 2 16-12ZM4 21l10-12',
  coffee:'M3 8h13v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zM16 9h2a3 3 0 1 1 0 6h-2M6 2v3M10 2v3M14 2v3',
  pin:'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
};
export function Icon({ name, size=20, style }: { name: keyof typeof paths; size?: number; style?: CSSProperties }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]}/></svg>; }
export function BrandMark({ size=40 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M10 24 24 10l14 14M15 21v12m18-12v12M21 32v-8h6v8M5 34c6-6 13 6 19 0s13 6 19 0M5 41c6-6 13 6 19 0s13 6 19 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="36" cy="11" r="3" stroke="currentColor" strokeWidth="1.2"/></svg>; }
