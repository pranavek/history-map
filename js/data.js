/* Loads the vocabularies and the place files, and validates every place against
   them. An unknown category, era or tag is a hard error — a silently unstyled
   pin is worse than a loud failure. */

const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
};

/* Load the dataset.

   By default this prefers data/index.json — one request carrying only the
   fields the map draws. Descriptions and sources are over half the bytes and
   are not needed until a detail panel opens, so they are left in the region
   files and fetched on demand by loadDetail().

   Pass { full: true } when you genuinely need every field, as the About page
   does: it is built out of the contested notes, which the index omits.

   The index is generated (`make index`). When it is absent — a clean checkout
   running `make serve` — this falls back to reading the region files, so the
   site never depends on a build step having run. */
export async function loadAll(base = '', { full = false } = {}) {
  const p = (f) => `${base}${f}`;
  const [categories, eras, tags, regions] = await Promise.all([
    json(p('data/categories.json')),
    json(p('data/eras.json')),
    json(p('data/tags.json')),
    json(p('data/regions.json'))
  ]);

  let places, regionFiles = regions.map((r) => r.file);
  if (!full) {
    try {
      const idx = await json(p('data/index.json'));
      places = idx.places;
      regionFiles = idx.regions;
    } catch { /* not built; fall back below */ }
  }
  if (!places) {
    const lists = await Promise.all(regions.map((r) => json(p(r.file))));
    places = lists.map((l, ri) => l.map((x) => ({ ...x, r: ri }))).flat();
  }

  const problems = [];
  const seen = new Set();
  for (const pl of places) {
    const where = pl.id || pl.name || '(unnamed)';
    if (!pl.id) problems.push(`${where}: missing id`);
    if (seen.has(pl.id)) problems.push(`${where}: duplicate id`);
    seen.add(pl.id);
    if (!categories[pl.category]) problems.push(`${where}: unknown category "${pl.category}"`);
    if (!eras[pl.era]) problems.push(`${where}: unknown era "${pl.era}"`);
    for (const t of pl.tags || []) if (!tags[t]) problems.push(`${where}: unknown tag "${t}"`);
    if (!Array.isArray(pl.coords) || pl.coords.length !== 2) problems.push(`${where}: bad coords`);
    // The index deliberately omits sources — they are fetched with the rest of
    // the detail. tools/check.mjs enforces the "no unsourced history" rule
    // against the region files at build time, which is where it belongs.
    if (full && (!pl.sources || !pl.sources.length))
      problems.push(`${where}: no sources — unsourced history does not ship`);
  }
  if (problems.length) throw new Error('Data validation failed:\n  ' + problems.join('\n  '));

  // Only surface tags actually in use, so the filter bar never offers a dead end.
  const used = new Set(places.flatMap((x) => x.tags || []));
  const usedTags = Object.fromEntries(Object.entries(tags).filter(([k]) => used.has(k)));
  const usedEras = Object.fromEntries(
    Object.entries(eras).filter(([k]) => places.some((x) => x.era === k))
  );

  return { categories, eras, tags, usedTags, usedEras, regions, regionFiles, places, base };
}

/* Fetch the fields the index leaves out — description, sources, the contested
   and coordsNote text — and merge them into the place object in place, so a
   second open of the same panel costs nothing. */
const detailCache = new Map();
export async function loadDetail(meta, place) {
  if (place.description) return place;
  const file = meta.regionFiles[place.r];
  if (!file) return place;
  if (!detailCache.has(file)) detailCache.set(file, json(`${meta.base || ''}${file}`));
  const full = (await detailCache.get(file)).find((x) => x.id === place.id);
  if (full) Object.assign(place, full);
  return place;
}
