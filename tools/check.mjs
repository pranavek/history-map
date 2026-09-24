/* Pre-deploy validation. Runs in CI before the build, so bad data or a broken
   selector fails the pull request instead of the live site. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { createFilters, apply, toggle, clear } from '../js/filters.js';
import { ICONS } from '../js/icons.js';

let fail = 0;
const ok  = (m) => console.log(`  PASS  ${m}`);
const bad = (m) => { console.log(`  FAIL  ${m}`); fail++; };
const J   = (p) => JSON.parse(readFileSync(p, 'utf8'));

console.log('\nData');
const categories = J('data/categories.json');
const eras       = J('data/eras.json');
const tags       = J('data/tags.json');
const regions    = J('data/regions.json');
const places     = regions.flatMap((r) => {
  if (!existsSync(r.file)) { bad(`regions.json points at missing file ${r.file}`); return []; }
  return J(r.file);
});

const seen = new Set();
for (const p of places) {
  const w = p.id || p.name || '(unnamed)';
  if (!p.id)                       bad(`${w}: missing id`);
  if (seen.has(p.id))              bad(`${w}: duplicate id`);
  seen.add(p.id);
  if (!categories[p.category])     bad(`${w}: unknown category "${p.category}"`);
  if (!eras[p.era])                bad(`${w}: unknown era "${p.era}"`);
  for (const t of p.tags || []) if (!tags[t]) bad(`${w}: unknown tag "${t}"`);
  if (!p.sources?.length)          bad(`${w}: no sources`);
  const [lat, lon] = p.coords || [];
  if (typeof lat !== 'number' || typeof lon !== 'number') bad(`${w}: bad coords`);
  else if (lat < 6 || lat > 38 || lon < 68 || lon > 98)   bad(`${w}: coords outside India (${lat},${lon})`);
  // An approximate coordinate must say so in the UI, or the map overstates its precision.
  if (p.coordsPrecision === 'approximate' && !p.coordsNote) bad(`${w}: approximate coords with no coordsNote`);
  if (p.coordsPrecision && !['verified', 'approximate'].includes(p.coordsPrecision))
    bad(`${w}: coordsPrecision must be "verified" or "approximate"`);
}
if (!fail) ok(`${places.length} places across ${regions.length} regions, valid against ${Object.keys(categories).length} categories, ${Object.keys(eras).length} eras, ${Object.keys(tags).length} tags`);

console.log('\nHistory pages (data/history/**/*.json)');
// Same "no unsourced history" rule as places, applied to the reading-page
// narrative content: every section needs a heading, at least one paragraph
// and at least one source.
const historyFiles = existsSync('data/history')
  ? [
      ...(existsSync('data/history/india.json') ? ['data/history/india.json'] : []),
      ...(existsSync('data/history/states')
        ? readdirSync('data/history/states').filter((f) => f.endsWith('.json')).map((f) => `data/history/states/${f}`)
        : [])
    ]
  : [];
let sectionCount = 0;
for (const file of historyFiles) {
  const sections = J(file);
  const seenIds = new Set();
  for (const s of sections) {
    const w = `${file} → ${s.id || s.heading || '(unnamed section)'}`;
    if (!s.id)                    bad(`${w}: missing id`);
    if (seenIds.has(s.id))        bad(`${w}: duplicate section id`);
    seenIds.add(s.id);
    if (!s.heading)               bad(`${w}: missing heading`);
    if (!Array.isArray(s.body) || !s.body.length) bad(`${w}: body must be a non-empty array of paragraphs`);
    if (!s.sources?.length)       bad(`${w}: no sources — unsourced history does not ship`);
    sectionCount++;
  }
}
if (!fail && historyFiles.length) ok(`${sectionCount} sourced sections across ${historyFiles.length} history file(s)`);

console.log('\nScience timeline (data/history/science.json)');
// Different shape from the other history files — era groups of dated
// entries rather than prose sections — so it gets its own validation pass,
// but the same "no unsourced history" rule applies to every entry.
if (existsSync('data/history/science.json')) {
  const eras = J('data/history/science.json');
  const seenEntryIds = new Set();
  let entryCount = 0;
  for (const era of eras) {
    const ew = era.eraId || era.eraLabel || '(unnamed era)';
    if (!era.eraId)    bad(`science.json → ${ew}: missing eraId`);
    if (!era.eraLabel) bad(`science.json → ${ew}: missing eraLabel`);
    if (!Array.isArray(era.entries) || !era.entries.length) bad(`science.json → ${ew}: entries must be a non-empty array`);
    for (const e of era.entries || []) {
      const w = `science.json → ${ew} → ${e.id || e.title || '(unnamed entry)'}`;
      if (!e.id)                     bad(`${w}: missing id`);
      if (seenEntryIds.has(e.id))    bad(`${w}: duplicate entry id`);
      seenEntryIds.add(e.id);
      if (!e.year)                   bad(`${w}: missing year`);
      if (!e.title)                  bad(`${w}: missing title`);
      if (!e.body)                   bad(`${w}: missing body`);
      if (!e.sources?.length)        bad(`${w}: no sources — unsourced history does not ship`);
      entryCount++;
    }
  }
  if (!fail) ok(`${entryCount} sourced timeline entries across ${eras.length} eras`);
}

console.log('\nHistory region pages (data/history/regions.json manifest)');
// history/state.html is a single template shared by every state and union
// territory, chosen via ?s=<slug> (see js/reading.js) — so a manifest entry
// only needs the shared template to exist plus its own narrative JSON, and
// every entry's slug and name must be unique or ?s= would be ambiguous or
// unnamed on the page. Called "regions", not "states", because a third of
// the entries here are union territories, not states.
if (existsSync('data/history/regions.json')) {
  const regionManifest = J('data/history/regions.json');
  if (!existsSync('history/state.html')) bad('data/history/regions.json has entries but history/state.html (the shared template) is missing');
  const seenSlugs = new Set(), seenNames = new Set();
  for (const r of regionManifest) {
    if (seenSlugs.has(r.slug)) bad(`regions.json: duplicate slug "${r.slug}"`);
    seenSlugs.add(r.slug);
    if (seenNames.has(r.region)) bad(`regions.json: duplicate region name "${r.region}"`);
    seenNames.add(r.region);
    if (!r.lede) bad(`regions.json → ${r.region}: missing lede`);
    const jsonFile = `data/history/states/${r.slug}.json`;
    if (!existsSync(jsonFile)) bad(`regions.json → ${r.region}: missing ${jsonFile}`);
  }
  if (!fail) ok(`${regionManifest.length} region page(s) resolve to real narrative files`);
}

console.log('\nIcons');
// Resolve against the actual module, not a text match — quoted keys such as
// 'fire-temple': are invisible to a naive `${icon}:` grep.
for (const [id, c] of Object.entries(categories))
  ICONS[c.icon] ? null : bad(`category "${id}" wants icon "${c.icon}" — not exported by js/icons.js`);
for (const [id, d] of Object.entries(ICONS))
  /^<path\b/.test(d) ? null : bad(`icon "${id}" is not a <path> element`);
const orphans = Object.keys(ICONS).filter((i) => !Object.values(categories).some((c) => c.icon === i));
if (orphans.length) console.log(`  note  unused glyphs: ${orphans.join(', ')}`);
if (!fail) ok(`${Object.keys(ICONS).length} glyphs, one per category, all well-formed`);

console.log('\nWiring (selectors map.js needs must exist in map.html)');
const mapHtml = readFileSync('map.html', 'utf8');
const mapJs   = readFileSync('js/map.js', 'utf8');
const needIds = [...mapJs.matchAll(/\$\('#([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
const needCls = [...mapJs.matchAll(/\$\('\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
for (const id of new Set(needIds))
  mapHtml.includes(`id="${id}"`) ? null : bad(`map.js queries #${id} — not in map.html`);
for (const c of new Set(needCls))
  new RegExp(`class="[^"]*\\b${c}\\b`).test(mapHtml) ? null : bad(`map.js queries .${c} — not in map.html`);
if (!fail) ok(`${new Set(needIds).size} ids and ${new Set(needCls).size} classes resolve`);

console.log('\nLinks');
const htmlPages = [
  'index.html', 'map.html', 'about.html',
  ...(existsSync('history/india.html') ? ['history/india.html'] : []),
  ...(existsSync('history/state.html') ? ['history/state.html'] : []),
  ...(existsSync('history/science.html') ? ['history/science.html'] : [])
];
for (const page of htmlPages) {
  const src = readFileSync(page, 'utf8');
  // Relative hrefs resolve against the page's own directory, not the CWD —
  // "../css/style.css" from history/india.html is a sibling of history/, not
  // of the repo root, so it must be joined against dirname(page) here.
  for (const m of src.matchAll(/(?:href|src)="(?!https?:|data:|#|mailto:)([^"?#]+)/g))
    existsSync(normalize(join(dirname(page), m[1]))) ? null : bad(`${page} → ${m[1]} does not exist`);
  // Cloudflare caches every static file for 4 hours independently per edge
  // node. Script tags are already versioned for this; a local stylesheet
  // link without a ?v= would silently take up to 4 hours to reach every
  // reader after an edit, the same bug class the ?v= convention exists to
  // prevent for scripts.
  for (const m of src.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
    const href = m[1];
    if (/^https?:/.test(href)) continue;
    if (!href.includes('?v=')) bad(`${page} → stylesheet ${href} has no ?v= cache-busting query`);
  }
}
if (!fail) ok('all local hrefs and srcs resolve, and local stylesheets are cache-busted');

console.log('\nAttribution (OSM tile usage policy)');
mapJs.includes('openstreetmap.org/copyright')
  ? ok('OSM attribution present in the tile layer')
  : bad('tile layer is missing the required OpenStreetMap attribution');
readFileSync('css/map.css', 'utf8').includes('.leaflet-tile-pane {')
  ? ok('sepia filter scoped to the tile pane, so attribution stays legible')
  : bad('sepia filter is not scoped to .leaflet-tile-pane — it would dim the attribution');

console.log('\nFilter logic');
const P = places;
let f = createFilters();
apply(P, f).length === P.length ? ok('no filter returns everything') : bad('no-filter case');
clear(f); toggle(f.categories, 'railway'); toggle(f.eras, 'ancient');
apply(P, f).length === 0 ? ok('contradictory filters return nothing') : bad('AND across axes');
clear(f); toggle(f.eras, 'late-medieval');
{ const r = apply(P, f);
  (r.length > 0 && r.every((p) => p.era === 'late-medieval'))
    ? ok('era filter is exact') : bad('era filter — got 0 results or a wrong era, not just non-exact'); }

console.log(fail ? `\n${fail} failure(s)\n` : '\nAll checks passed.\n');
process.exit(fail ? 1 : 0);
