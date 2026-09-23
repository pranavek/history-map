/* Pure filter state. No DOM, no Leaflet — so the combination rule is testable
   on its own. Rule: category AND era AND (any selected tag). An empty set for
   an axis means "no constraint on this axis". */

export function createFilters() {
  return { categories: new Set(), eras: new Set(), tags: new Set(), query: '' };
}

export function matches(place, f) {
  if (f.categories.size && !f.categories.has(place.category)) return false;
  if (f.eras.size && !f.eras.has(place.era)) return false;
  if (f.tags.size && !(place.tags || []).some((t) => f.tags.has(t))) return false;
  if (f.query) {
    const q = f.query.toLowerCase();
    const hay = [place.name, place.localName, place.summary, place.city, place.state, place.built]
      .filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const apply = (places, f) => places.filter((p) => matches(p, f));

export function toggle(set, value) {
  set.has(value) ? set.delete(value) : set.add(value);
  return set;
}

export const isActive = (f) =>
  f.categories.size > 0 || f.eras.size > 0 || f.tags.size > 0 || f.query.length > 0;

export function clear(f) {
  f.categories.clear(); f.eras.clear(); f.tags.clear(); f.query = '';
  return f;
}
