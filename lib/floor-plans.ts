export type PlanRoom = { label: string; x: number; y: number; w: number; h: number };
export type PlanBed = { kind: 'king' | 'queen' | 'single'; x: number; y: number; w: number; h: number };
export type CabinPlan = {
  width: number; depth: number; rooms: PlanRoom[]; beds: PlanBed[];
  entrance: number; entryNote: string; deck: string; shower: string;
  turning?: { x: number; y: number; diameter: number };
};
/** Metre-based concept layouts, not measured or access-certified building plans. */
export const floorPlans: Record<number, CabinPlan> = {
  1: {
    width: 7, depth: 6, entrance: 4.2,
    rooms: [{ label: 'Bedroom', x: 0, y: 0, w: 3.1, h: 3.6 }, { label: 'Kitchen', x: 3.1, y: 0, w: 1.7, h: 2.5 }, { label: 'Bath', x: 4.8, y: 0, w: 2.2, h: 2.5 }, { label: 'Living & dining', x: 3.1, y: 2.5, w: 3.9, h: 3.5 }, { label: 'Reading nook', x: 0, y: 3.6, w: 3.1, h: 2.4 }],
    beds: [{ kind: 'king', x: 0.6, y: 0.5, w: 1.8, h: 2 }],
    entryNote: '12 approach steps', deck: 'Ocean-facing deck', shower: '60 mm shower lip',
  },
  2: {
    width: 7.667, depth: 6, entrance: 3.7,
    rooms: [{ label: 'Bedroom', x: 0, y: 0, w: 3.4, h: 3.5 }, { label: 'Level shower / bath', x: 3.4, y: 0, w: 2.5, h: 3 }, { label: 'Kitchen', x: 5.9, y: 0, w: 1.767, h: 3 }, { label: 'Living & dining', x: 3.4, y: 3, w: 4.267, h: 3 }, { label: 'Reading corner', x: 0, y: 3.5, w: 3.4, h: 2.5 }],
    beds: [{ kind: 'king', x: 0.6, y: 0.4, w: 1.8, h: 2 }],
    entryNote: 'Step-free concept · 900 mm entrance', deck: 'Sheltered dune terrace', shower: 'Level shower + grab rails',
    turning: { x: 4.8, y: 4.3, diameter: 1.5 },
  },
  3: {
    width: 8, depth: 8, entrance: 4.3,
    rooms: [{ label: 'Main bedroom', x: 0, y: 0, w: 4, h: 3.5 }, { label: 'Twin bedroom', x: 4, y: 0, w: 4, h: 3.5 }, { label: 'Bath', x: 0, y: 3.5, w: 2.4, h: 2.3 }, { label: 'Kitchen', x: 0, y: 5.8, w: 2.4, h: 2.2 }, { label: 'Living & dining', x: 2.4, y: 3.5, w: 5.6, h: 4.5 }],
    beds: [{ kind: 'king', x: 1, y: 0.45, w: 1.8, h: 2 }, { kind: 'single', x: 4.5, y: 0.45, w: 0.95, h: 2 }, { kind: 'single', x: 6.5, y: 0.45, w: 0.95, h: 2 }],
    entryNote: '3 entrance steps', deck: 'Meadow-facing deck', shower: 'Raised shower tray',
  },
  4: {
    width: 6.333, depth: 6, entrance: 3.4,
    rooms: [{ label: 'Bedroom', x: 0, y: 0, w: 3, h: 3.5 }, { label: 'Bath', x: 3, y: 0, w: 1.7, h: 2.5 }, { label: 'Kitchen', x: 4.7, y: 0, w: 1.633, h: 2.5 }, { label: 'Living', x: 3, y: 2.5, w: 3.333, h: 3.5 }, { label: 'Reading nook', x: 0, y: 3.5, w: 3, h: 2.5 }],
    beds: [{ kind: 'queen', x: 0.75, y: 0.45, w: 1.5, h: 2 }],
    entryNote: '6 steps · uneven final path', deck: 'Sheltered shoreline deck', shower: 'Raised shower tray',
  },
  5: {
    width: 9, depth: 8, entrance: 4.4,
    rooms: [{ label: 'Ocean bedroom', x: 0, y: 0, w: 3.6, h: 3.8 }, { label: 'Shared bath', x: 3.6, y: 0, w: 1.8, h: 3.2 }, { label: 'Woodland bedroom', x: 5.4, y: 0, w: 3.6, h: 3.8 }, { label: 'Kitchen & dining', x: 0, y: 3.8, w: 4.5, h: 4.2 }, { label: 'Living room', x: 4.5, y: 3.8, w: 4.5, h: 4.2 }],
    beds: [{ kind: 'king', x: 0.8, y: 0.5, w: 1.8, h: 2 }, { kind: 'king', x: 6.2, y: 0.5, w: 1.8, h: 2 }],
    entryNote: '8 entrance steps · 40 mm deck threshold', deck: 'Long panoramic coast deck', shower: 'Shared bathroom',
  },
};
