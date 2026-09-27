'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
export function Modal({ open, onClose, title, children, className='' }: { open:boolean; onClose:()=>void; title:string; children:ReactNode; className?:string }) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{ const dialog=ref.current; if(!dialog) return; if(open&&!dialog.open) dialog.showModal(); else if(!open&&dialog.open) dialog.close(); if(open) { const old=document.body.style.overflow; document.body.style.overflow='hidden'; return()=>{document.body.style.overflow=old;}; } },[open]);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget) onClose();}}><div className="modal-inner"><div className="modal-top"><span className="eyebrow">{title}</span><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></div>{children}</div></dialog>;
}
