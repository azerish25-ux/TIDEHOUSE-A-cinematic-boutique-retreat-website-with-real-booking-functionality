'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="empty-state"><p className="eyebrow">A SMALL INTERRUPTION</p><h1>Let’s try<br/><em>that again.</em></h1><p>Something interrupted this page. Your reservation will never be confirmed merely by refreshing.</p><button className="button button-dark" onClick={reset}>Try again</button></section>;}
