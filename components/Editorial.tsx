'use client';
import { useEffect, useState } from 'react';
import { editorial } from '../lib/catalog';
import { api } from '../lib/api';
export function useEditorial(slug:string){const [document,setDocument]=useState(editorial.find(d=>d.slug===slug)!);useEffect(()=>{let active=true;api.content().then(docs=>{const d=docs.find(d=>d.slug===slug);if(active&&d)setDocument(d);}).catch(()=>{});return()=>{active=false;};},[slug]);return document;}
export function EditorialArticle({slug}:{slug:string}){const doc=useEditorial(slug);return <article className="editorial-article"><p className="eyebrow">{doc.eyebrow}</p><h1>{doc.title}</h1><div className="article-rule"/><div className="article-body">{doc.body.split('\n\n').map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div></article>;}
