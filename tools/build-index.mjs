/* Collapse every region file into one light index.

   The map needs a coordinate, a category, an era, tags and a one-line summary
   to draw a pin and filter it. It does not need the description or the source
   list until somebody opens the detail panel — and those are over half the
   bytes. Shipping them on first paint means every reader downloads every essay
   for every place in India to look at one map.

   This emits data/index.json: one request instead of one per region, carrying
   only the fields the map actually renders. Full records stay in the region
   files and are fetched on demand.

   Generated, not source. js/data.js falls back to loading the region files
   directly when it is absent, so `make serve` works on a clean checkout. */
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const KEEP = ['id', 'name', 'localName', 'category', 'era', 'tags', 'coords',
              'coordsPrecision', 'city', 'state', 'built', 'summary'];

const regions = JSON.parse(await readFile('data/regions.json', 'utf8'));
const out = [];
let fullRaw = 0;

for (const [ri, r] of regions.entries()) {
  let places;
  try { places = JSON.parse(await readFile(r.file, 'utf8')); }
  catch { console.error(`  skipping missing ${r.file}`); continue; }
  fullRaw += Buffer.byteLength(JSON.stringify(places));
  for (const p of places) {
    const e = { r: ri };
    for (const k of KEEP) if (p[k] !== undefined) e[k] = p[k];
    // flags the detail panel needs to know about before it fetches
    if (p.contested) e.hasNotes = true;
    if (p.coordsNote) e.hasNotes = true;
    out.push(e);
  }
}

const body = JSON.stringify({ regions: regions.map((r) => r.file), places: out });
await writeFile('data/index.json', body);

const idxGz = gzipSync(Buffer.from(body), { level: 9 }).length;
const fullGz = gzipSync(Buffer.from(JSON.stringify(out.length)), { level: 9 }).length; // placeholder
console.log(`  ${out.length} places from ${regions.length} regions`);
console.log(`  index   ${Buffer.byteLength(body).toLocaleString()} B raw, ${idxGz.toLocaleString()} B gzip`);
console.log(`  full    ${fullRaw.toLocaleString()} B raw  (${(100 - Buffer.byteLength(body) / fullRaw * 100).toFixed(0)}% smaller, and 1 request instead of ${regions.length})`);
