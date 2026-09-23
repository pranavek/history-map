/* Build a synthetic copy of the site at an arbitrary size, so performance work
   can be measured instead of asserted. Writes into a scratch directory; never
   touches data/ in the working tree. Deliberately synthesises its own place
   records rather than reading the real ones, so it does not race whoever is
   editing data/ at the time.

   node tools/bench-data.mjs <out-dir> <places-per-region> */
import { mkdir, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [out, perStr] = process.argv.slice(2);
const per = Number(perStr || 40);
if (!out) { console.error('usage: bench-data.mjs <out-dir> <per-region>'); process.exit(1); }

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar','Chandigarh',
'Dadra and Nagar Haveli','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];

// deterministic, so runs are comparable
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'data/places'), { recursive: true });
for (const d of ['css', 'js', 'assets']) await cp(d, join(out, d), { recursive: true });
for (const f of ['index.html', 'map.html', 'about.html']) await cp(f, join(out, f));
for (const f of ['categories.json', 'eras.json', 'tags.json', 'india-boundary.geojson'])
  await cp(join('data', f), join(out, 'data', f));

const cats = Object.keys(JSON.parse(await readFile('data/categories.json', 'utf8')));
const eras = Object.keys(JSON.parse(await readFile('data/eras.json', 'utf8')));
const tags = Object.keys(JSON.parse(await readFile('data/tags.json', 'utf8')));
const PROSE = 'A paragraph of roughly the length these entries actually run to, so the byte cost per place matches production rather than flattering it. '.repeat(3);

const manifest = [];
for (const [si, st] of STATES.entries()) {
  const list = [];
  for (let i = 0; i < per; i++) {
    list.push({
      id: `s${si}-p${i}`, name: `${st} Site ${i + 1}`, localName: `${st} ${i}`,
      category: cats[(si + i) % cats.length], era: eras[(si * 3 + i) % eras.length],
      tags: [tags[i % tags.length], tags[(i + 5) % tags.length], tags[(i + 11) % tags.length]],
      coords: [+(8 + (si % 6) * 4 + rnd() * 3).toFixed(4), +(70 + Math.floor(si / 6) * 4 + rnd() * 3).toFixed(4)],
      coordsPrecision: 'verified', city: `City ${i % 7}`, state: st, built: '12th century',
      summary: 'One line for the map popup, about as long as the real ones.',
      description: [PROSE, PROSE],
      sources: [{ title: 'Source', url: 'https://example.org/' }]
    });
  }
  const file = `data/places/${st.toLowerCase().replace(/[^a-z]+/g, '-')}.json`;
  await writeFile(join(out, file), JSON.stringify(list));
  manifest.push({ id: file, name: st, file });
}
await writeFile(join(out, 'data/regions.json'), JSON.stringify(manifest));

// build the index in the synthetic tree too, so the benchmark measures what
// production actually serves rather than the no-build fallback path
const { execFileSync } = await import('node:child_process');
execFileSync(process.execPath, [join(process.cwd(), 'tools/build-index.mjs')],
             { cwd: out, stdio: 'pipe' });
console.log(`  ${STATES.length} regions x ${per} = ${STATES.length * per} places -> ${out} (indexed)`);
