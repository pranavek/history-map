import { loadAll } from './data.js';
import { iconSvg } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);

(async () => {
  let data;
  try { data = await loadAll(); }
  catch (err) { console.error(err); $('#featured').innerHTML =
    `<p style="color:var(--accent)">Could not load places: ${err.message}</p>`; return; }

  const { categories, eras, places } = data;

  // State/UT → history page slug, so "Every place, by state & union
  // territory" headings can link straight into the deeper narrative for that
  // region. Stays optional (a region with no manifest entry keeps a plain
  // heading) so landing.js never breaks if the /history/ section is absent.
  let regionSlug = new Map();
  try {
    const regions = await (await fetch('data/history/regions.json')).json();
    regionSlug = new Map(regions.map((r) => [r.region, r.slug]));
  } catch { /* the /history/ section is additive; landing must work without it */ }

  const legend = $('#legend');
  // Shown lexicographically, not in categories.json's insertion order — a
  // reader scanning a legend expects alphabetical, not "however it was added".
  // Each item links straight into the map, pre-filtered to that category —
  // reuses the ?cat= param map.js already reads and keeps in the URL.
  const sortedCats = Object.entries(categories).sort((a, b) => a[1].label.localeCompare(b[1].label));
  for (const [id, c] of sortedCats) {
    if (!places.some((p) => p.category === id)) continue;
    const li = document.createElement('li');
    li.innerHTML = `<a class="legend-item" href="map.html?cat=${encodeURIComponent(id)}" style="--cat:${c.color}">
      <span class="legend-swatch">${iconSvg(c.icon)}</span>${c.label}</a>`;
    legend.append(li);
  }

  // Grouped by state: twenty-three cards in one undifferentiated grid tells
  // the reader nothing about where any of it is.
  const byState = new Map();
  for (const p of places) {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state).push(p);
  }

  const card = (p) => {
    const c = categories[p.category];
    return `<a class="card place-card" href="map.html?place=${p.id}" style="--cat:${c.color}">
      <span class="pc-icon">${iconSvg(c.icon)}</span>
      <span class="pc-cat">${c.label} · ${eras[p.era].label}</span>
      <span class="pc-name">${p.name}</span>
      ${p.localName ? `<span class="pc-local">${p.localName}</span>` : ''}
      <span class="pc-sum">${p.summary}</span>
      <span class="pc-go">View on the map →</span>
    </a>`;
  };

  // Shown lexicographically, not in place-load order — same reasoning as the
  // category legend above: a reader scanning a list of states expects A→Z.
  const sortedStates = [...byState].sort((a, b) => a[0].localeCompare(b[0]));

  $('#featured').innerHTML = sortedStates.map(([state, list]) => {
    const slug = regionSlug.get(state);
    const heading = slug
      ? `<a href="history/state.html?s=${encodeURIComponent(slug)}">${state}</a>`
      : state;
    return `
    <section class="state-block">
      <h3 class="state-name">${heading} <span class="state-count">${list.length}</span></h3>
      <div class="cards">${list.map(card).join('')}</div>
    </section>`;
  }).join('');

  $('#place-count').textContent = places.length;
  const sc = $('#state-count'); if (sc) sc.textContent = byState.size;
})();
