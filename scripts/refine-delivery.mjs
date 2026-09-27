import {readFile,writeFile,unlink} from 'node:fs/promises';
async function edit(path,replacements){let text=await readFile(path,'utf8');for(const [from,to] of replacements){if(!text.includes(from))throw new Error(`Expected source fragment not found in ${path}`);text=text.replace(from,to);}await writeFile(path,text);}
await edit('components/Stay.tsx', [['type="checkbox" checked={compare.includes(c.id)}','type="checkbox" aria-label={`Compare ${c.name}`} checked={compare.includes(c.id)}']]);
await edit('components/Studio.tsx', [['<label>Cabin<select value={cabinId}', '<label>Cabin<select aria-label="Cabin" value={cabinId}']]);
await edit('app/layout.tsx', [["import './globals.css';", "import './globals.css';\nimport './refinements.css';"]]);
await edit('lib/catalog.ts', [["export const photo = (id: string, width = 1400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;", `const photoAssets: Record<string, string> = {
  'photo-1499793983690-e29da59ef1c2':'hero',
  'photo-1500375592092-40eb2168fd21':'coast',
  'photo-1441974231531-c6227db76b6e':'forest',
  'photo-1616486338812-3dadae4b4ace':'interior',
  'photo-1533089860892-a7c6f0a88666':'breakfast',
  'photo-1449158743715-0a90ebb6d2d8':'driftwood',
  'photo-1502005229762-cf1b2da7c5d6':'bedroom',
  'photo-1518780664697-55e3ad937233':'lookout',
  'photo-1510798831971-661eb04b3739':'dune',
  'photo-1449844908441-8829872d2607':'stillwater',
};
export const photo = (id: string, _width = 1400) => {
  const asset = photoAssets[id];
  if (!asset) throw new Error('Unregistered editorial photograph');
  return '/images/' + asset + '.jpg';
};`], ["The site requests photos from Unsplash and fonts from Google; those services receive normal network request information.","Photographs are served from this website. Fonts are requested from Google, which receives normal network request information. The photographic credits are available at /image-credits.json."]]);
await edit('README.md', [['URLs are centralised in `lib/catalog.ts`.', 'A fixed coastal/timber photographic set is stored under `public/images/`; `public/image-credits.json` records photographers, source pages, licenses and content hashes. `scripts/assets.mjs` reproducibly prepares missing assets. Images are architectural inspiration, not documentation of one real property.'], ['npm install\ncp .env.example .env.local','npm install\nnode scripts/assets.mjs\ncp .env.example .env.local']]);
const pkg=JSON.parse(await readFile('package.json','utf8'));
pkg.devDependencies.prettier='3.6.2';
pkg.scripts.format='prettier --write app components lib scripts tests *.ts *.json README.md';
await writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
await unlink('scripts/refine-delivery.mjs');
console.log('Applied contrast, explicit control labels and credited coastal photography without replacing the existing application.');
