import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import prettier from 'prettier';

// One-time import of the generated image explicitly intended for this public site.
// The transport URL is never logged or copied into the resulting release tree.
const input = JSON.parse(fs.readFileSync('.artwork-source.json', 'utf8'));
const source = new URL(input.url);
if (source.protocol !== 'https:' || !source.hostname.endsWith('.oaiusercontent.com') || source.username || source.password) throw new Error('Unsupported artwork transport');
if (input.sha256 !== '50a4e149928d813d3cb587d35b5833a916a8dbfb550a87c45a8178fcd04e0c2d') throw new Error('Artwork is not the reviewed Lookout image');
const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error('Artwork transport expired or unavailable');
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length > 12000000 || createHash('sha256').update(bytes).digest('hex') !== input.sha256) throw new Error('Artwork checksum mismatch');
const metadata = await sharp(bytes, { limitInputPixels: 20000000 }).metadata();
if (metadata.width < 1400 || metadata.height < 900) throw new Error('Artwork resolution is insufficient');
const image = await sharp(bytes).webp({ quality: 86, effort: 6 }).toBuffer();
const imagePath = 'public/images/lookout-generated.webp';
fs.writeFileSync(imagePath, image);
const creditsPath = 'public/generated-artwork.json';
fs.writeFileSync(creditsPath, JSON.stringify({
  version: 1,
  images: [{ path: '/images/lookout-generated.webp', kind: 'AI-generated fictional property image', subject: 'The Lookout exterior', generator: 'OpenAI image generation', generationId: '8dabb6f4-2286-4f60-ac81-e7c900bce2e7', createdOn: '2026-09-27', sourceSha256: input.sha256, webpSha256: createHash('sha256').update(image).digest('hex'), width: metadata.width, height: metadata.height }],
  note: 'This is not a photograph of a real accommodation. Other images remain separately credited architectural references. The full five-cabin photographic series is not complete.'
}, null, 2));
const catalogPath = 'lib/catalog.ts';
const catalog = fs.readFileSync(catalogPath, 'utf8');
const previousHero = 'hero: photo("photo-1499793983690-e29da59ef1c2", 2200)';
if (!catalog.includes(previousHero)) throw new Error('Catalog changed; reconcile before importing');
fs.writeFileSync(catalogPath, catalog.replace(previousHero, 'hero: "/images/lookout-generated.webp"'));
let readme = fs.readFileSync('README.md', 'utf8');
readme = readme.replace('The server creates a 30-minute card-only Checkout session while the database holds inventory for 35 minutes.', 'The server creates a card-only Checkout session with a fixed expiry one minute before its 35-minute database hold ends. The expiry and all request parameters remain identical across retries.');
readme = readme.replace('Native image generation was not available in the build session. No generated image is falsely described as an original photograph. Replace representative imagery with a coherent commissioned or generated five-cabin asset library before presenting this as a real property.', 'The homepage and The Lookout now use a generated coastal hero image. Its provenance and hashes are recorded in `public/generated-artwork.json`. The remaining photographs are representative credited references; the coherent five-cabin photographic series is not finished. Generated images are not presented as photographs of a real property.');
fs.writeFileSync('README.md', readme);
const paths = [imagePath, creditsPath, catalogPath, 'README.md', 'components/Stay.tsx', 'components/Booking.tsx', 'components/CabinDetails.tsx', 'components/FloorPlan.tsx', 'components/Modal.tsx', 'lib/stay-link.ts', 'lib/floor-plans.ts', 'lib/checkout-request.ts', 'lib/payments.ts', 'lib/search-stays.ts', 'app/api/[...path]/route.ts', 'app/refinements.css', 'tests/release.test.ts', 'tests/e2e/release.spec.ts', 'playwright.config.ts', 'package.json'];
for (const path of paths.filter(p => !p.endsWith('.webp'))) fs.writeFileSync(path, await prettier.format(fs.readFileSync(path, 'utf8'), { filepath: path }));
execFileSync('npm', ['test'], { stdio: 'inherit' });
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
execFileSync('npm', ['run', 'typecheck'], { stdio: 'inherit' });
const repository = process.env.GITHUB_REPOSITORY;
if (repository !== 'azerish25-ux/TIDEHOUSE-A-cinematic-boutique-retreat-website-with-real-booking-functionality') throw new Error('Unexpected repository');
async function gitApi(resource, body) {
  const r = await fetch(`https://api.github.com/repos/${repository}/git/${resource}`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Git object write failed: ${r.status}`);
  return r.json();
}
const parent = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim();
const baseTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}']).toString().trim();
const tree = [];
for (const path of paths) {
  const blob = await gitApi('blobs', { content: fs.readFileSync(path).toString('base64'), encoding: 'base64' });
  tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
}
// Import helpers and temporary transport data are absent from the release tree.
for (const path of ['.artwork-source.json', '.github/workflows/artwork-import.yml', 'scripts/import-artwork.mjs']) tree.push({ path, mode: '100644', type: 'blob', sha: null });
const createdTree = await gitApi('trees', { base_tree: baseTree, tree });
const commit = await gitApi('commits', { message: 'art: integrate generated Lookout hero with provenance and format release source', tree: createdTree.sha, parents: [parent] });
fs.mkdirSync('evidence', { recursive: true });
fs.writeFileSync('evidence/artwork-import.json', JSON.stringify({ parent, commit: commit.sha, tree: createdTree.sha, imagePath, width: metadata.width, height: metadata.height, sourceSha256: input.sha256, webpBytes: image.length, checks: ['unit tests', 'production build', 'TypeScript'], branchUpdated: false }, null, 2));
console.log(`Prepared asset commit ${commit.sha}; main was not moved.`);
