'use client';
import { useId, useState } from 'react';
import type { Cabin } from '@/lib/catalog';
import { floorPlans } from '@/lib/floor-plans';
import { Modal } from './Modal';
import { Arrow } from './Brand';

function Drawing({ cabin }: { cabin: Cabin }) {
  const patternId = useId().replaceAll(':', '');
  const p = floorPlans[cabin.id];
  if (!p) return null;
  const scale = Math.min(570 / p.width, 295 / p.depth);
  const x = (680 - p.width * scale) / 2, y = 38;
  const px = (n: number) => x + n * scale, py = (n: number) => y + n * scale;
  return <svg className='plan-drawing' viewBox='0 0 680 415' role='img' aria-label={`${cabin.name} illustrative floor plan: ${cabin.beds}, bathroom, kitchen, living room and private deck. Not to scale.`}>
    <defs><pattern id={patternId} width='9' height='9' patternUnits='userSpaceOnUse'><path d='M0 0V9' stroke='#c5c2b1' strokeWidth='1'/></pattern></defs>
    <g fill='none' stroke='#6e806f' strokeWidth='1'><path d={`M${x} 21H${px(p.width)}M${x} 16V26M${px(p.width)} 16V26`}/></g>
    <text x='340' y='14' textAnchor='middle' fontFamily='sans-serif' fontSize='12' fill='#344e3f'>Approx. {p.width.toFixed(1)} m</text>
    <rect x={x} y={py(p.depth)} width={p.width * scale} height='49' fill={`url(#${patternId})`} stroke='#78917d'/>
    {p.rooms.map(room => <g key={room.label}>
      <rect x={px(room.x)} y={py(room.y)} width={room.w * scale} height={room.h * scale} fill={room.label.toLowerCase().includes('bath') ? '#e6ebe1' : '#f4f1e9'} stroke='#849382' strokeWidth='1.5'/>
      <text x={px(room.x + room.w / 2)} y={py(room.y + room.h) - 12} textAnchor='middle' fontFamily='sans-serif' fontSize={room.w < 2 ? 10 : 12} fill='#344e3f'>{room.label}</text>
    </g>)}
    <rect x={x} y={y} width={p.width * scale} height={p.depth * scale} fill='none' stroke='#344e3f' strokeWidth='3'/>
    {p.beds.map((bed, i) => <g key={i}>
      <rect x={px(bed.x)} y={py(bed.y)} width={bed.w * scale} height={bed.h * scale} rx='3' fill='#e0e6d7' stroke='#60765f' strokeWidth='1.5'/>
      <rect x={px(bed.x + 0.12)} y={py(bed.y + 0.12)} width={(bed.w - 0.24) * scale} height={0.38 * scale} rx='2' fill='#f4f1e9' stroke='#849382'/>
      <text x={px(bed.x + bed.w / 2)} y={py(bed.y + 1.35)} textAnchor='middle' fontFamily='sans-serif' fontSize='11' fill='#344e3f'>{bed.kind.toUpperCase()}</text>
    </g>)}
    {p.turning && <g><circle cx={px(p.turning.x)} cy={py(p.turning.y)} r={p.turning.diameter * scale / 2} fill='none' stroke='#496a56' strokeDasharray='4 3'/><text x={px(p.turning.x)} y={py(p.turning.y) + 4} textAnchor='middle' fontSize='10' fontFamily='sans-serif' fill='#344e3f'>1,500 mm</text></g>}
    <path d={`M${px(p.entrance)} ${py(p.depth)}h${0.9 * scale}`} stroke='#f4f1e9' strokeWidth='6'/>
    <path d={`M${px(p.entrance)} ${py(p.depth)}v${-0.9 * scale}a${0.9 * scale} ${0.9 * scale} 0 0 1 ${0.9 * scale} ${0.9 * scale}`} fill='none' stroke='#60765f' strokeWidth='1.5'/>
    <text x='340' y={py(p.depth) + 30} textAnchor='middle' fontFamily='sans-serif' fontSize='12' fill='#344e3f'>{p.deck.toUpperCase()}</text>
    <text x='340' y='398' textAnchor='middle' fontFamily='sans-serif' fontSize='12' fill='#344e3f'>{p.entryNote}</text>
  </svg>;
}
export function FloorPlan({ cabin }: { cabin: Cabin }) {
  const [open, setOpen] = useState(false);
  const p = floorPlans[cabin.id];
  if (!p) return null;
  return <div className='floor-plan'>
    <Drawing cabin={cabin}/>
    <p className='plan-caption'><span>{cabin.area} m² interior</span><span>{cabin.beds}</span><span>{p.shower}</span></p>
    <p className='plan-note'>A cabin-specific concept plan, not a measured building drawing. Access dimensions are fictional design specifications; review the access notes before choosing.</p>
    <button type='button' className='text-link' onClick={() => setOpen(true)}>Enlarge {cabin.name} floor plan <Arrow/></button>
    {open && <Modal title={`${cabin.name} floor plan`} onClose={() => setOpen(false)}><Drawing cabin={cabin}/><p>{cabin.beds} · {p.entryNote}. {cabin.access}</p></Modal>}
  </div>;
}
