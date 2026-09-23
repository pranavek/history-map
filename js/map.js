import { loadAll, loadDetail } from './data.js';
import { createFilters, apply, toggle, isActive, clear } from './filters.js';
import { iconSvg, pinSvg } from './icons.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

/* India bound.
   Earlier this stopped at 24N so that India's disputed northern border could
   never be drawn — OSM assigns Aksai Chin to China and Gilgit-Baltistan to
   Pakistan, and openstreetmap-carto renders no claim line at all. That was a
   workaround, and it stopped working the moment places north of 24N were added.
   The real fix is below: we draw the Survey of India claim line ourselves, on
   top of the tiles. Google solves the same problem by serving a different
   rendering inside India; a static site cannot do that, so it draws one line —
   the Indian one — for everybody. */
const BOUNDS = () => L.latLngBounds([5.5, 66.5], [37.8, 98.0]);

const state = { places: [], visible: [], filters: createFilters(), markers: new Map(),
                markerLayer: null, activeId: null, map: null, meta: null };

/* Render a failure the reader can actually act on. A blank rectangle tells
   them nothing and tells us nothing either. */
function fatal(title, detail) {
  const el = document.getElementById('map');
  if (el) el.innerHTML =
    `<div style="max-width:34rem;margin:3rem auto;padding:0 1.5rem;font-family:var(--serif);color:var(--ink)">
       <h2 style="font-family:var(--display);color:var(--accent)">${title}</h2>
       <p>${detail}</p>
       <p style="font-size:.92rem;color:var(--ink-3)">Every place is also listed on the
          <a href="index.html">home page</a>, which needs no map library.</p>
     </div>`;
}

async function init() {
  // Leaflet loads from a CDN, with a second CDN as fallback. If both are
  // blocked - ad blocker, DNS filtering, offline - say so instead of leaving
  // an empty rectangle. This check must come before any use of L.
  if (typeof L === 'undefined') {
    fatal('The map library could not be loaded.',
      'Leaflet is served from unpkg.com, with cdnjs.cloudflare.com as a fallback. ' +
      'Both appear to be unreachable from this network — an ad blocker, a DNS filter ' +
      'such as Pi-hole, or a corporate proxy will do this.');
    return;
  }

  let data;
  try {
    data = await loadAll();
  } catch (err) {
    fatal('Could not load the map data.',
      `<code style="font:.9em var(--mono)">${err.message}</code>`);
    throw err;
  }
  state.meta = data;
  state.places = data.places;

  state.map = L.map('map', {
    center: [20.5, 79.0], zoom: 5, minZoom: 4, maxZoom: 18,
    maxBounds: BOUNDS(), maxBoundsViscosity: 0.9, zoomControl: false
  });
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  await addBoundary();

  state.markerLayer = L.layerGroup().addTo(state.map);
  // Re-cluster after the map settles. Without this the grid would be computed
  // for a zoom level the user has already left.
  state.map.on('moveend zoomend', renderMarkers);

  buildRail();

  // Shareable filter state: map.html?cat=temple,fort&era=ancient&tag=unesco&q=fort
  // A place someone filtered down to should be a link they can send, not just
  // something they saw once in their own session.
  const params = new URLSearchParams(location.search);
  // Validate against the real id sets — a stale or hand-edited link with an
  // unknown id would otherwise silently filter the map down to nothing.
  const fromParam = (key, set, valid) => {
    for (const v of (params.get(key) || '').split(',').filter(Boolean)) if (valid.has(v)) set.add(v);
  };
  fromParam('cat', state.filters.categories, new Set(Object.keys(data.categories)));
  fromParam('era', state.filters.eras, new Set(Object.keys(data.usedEras)));
  fromParam('tag', state.filters.tags, new Set(Object.keys(data.usedTags)));
  const q = params.get('q');
  if (q) { state.filters.query = q; $('.search').value = q; }

  render();

  // Frame every place rather than trusting a hand-picked centre — the set will
  // grow, and a fixed zoom would quietly crop new entries out of view.
  state.map.fitBounds(L.latLngBounds(state.places.map((p) => p.coords)), {
    padding: [70, 70], maxZoom: 14
  });

  // Deep link: map.html?place=thali-temple
  // Look the place up in the dataset, never in state.markers — that map holds
  // only the individual pins currently on screen, so anything inside a cluster
  // or outside the viewport would not be found.
  const want = new URLSearchParams(location.search).get('place');
  const target = want && state.places.find((p) => p.id === want);
  if (target) openDetail(target, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDetail(); $('.rail')?.classList.remove('is-open'); }
  });
}

/* The national boundary, drawn by us rather than taken from the tiles.
   OSM-derived basemaps place Aksai Chin in China and Gilgit-Baltistan in
   Pakistan and draw no claim line, so at any zoom showing the north the tiles
   alone would depict a border that does not match the Survey of India. This
   overlay is the correction. It is deliberately a stroke and not a fill, so it
   annotates the basemap instead of hiding it. */
async function addBoundary() {
  try {
    const gj = await (await fetch('data/india-boundary.geojson')).json();
    state.boundary = L.geoJSON(gj, {
      interactive: false,
      style: { color: '#5c4f3a', weight: 1.6, opacity: 0.85, fill: false, lineJoin: 'round' }
    }).addTo(state.map);
    // Irrelevant once you are inside a city, and it costs paint time there.
    const vis = () => {
      const on = state.map.getZoom() <= 8;
      if (on && !state.map.hasLayer(state.boundary)) state.boundary.addTo(state.map);
      if (!on && state.map.hasLayer(state.boundary)) state.map.removeLayer(state.boundary);
    };
    state.map.on('zoomend', vis); vis();
  } catch (err) {
    // A missing outline must not take the whole map down with it.
    console.error('India boundary overlay failed to load:', err);
  }
}

/* Markers are built for what is on screen, not for the whole dataset, and
   anything that collides at the current zoom is merged into a cluster.

   Before this, every place got a Leaflet marker at load: at 1,440 places that
   was 1,440 divIcons, ~20k DOM nodes and a filter click that took 165 ms to
   repaint. Both costs scaled linearly with the dataset, so they only ever got
   worse. Now cost scales with what is visible, which is roughly constant.

   This is a grid clusterer rather than Leaflet.markercluster: it is about
   sixty lines, it needs no dependency, and it does not have to be general —
   it only has to group points that overlap on screen. */

const CLUSTER_PX = 64;   // grid cell, in screen pixels
const VIEW_PAD   = 0.25; // fetch slightly beyond the viewport so panning is smooth

function pinFor(p) {
  const cat = state.meta.categories[p.category];
  const approx = p.coordsPrecision === 'approximate';
  const marker = L.marker(p.coords, {
    icon: L.divIcon({
      className: `pin${approx ? ' is-approx' : ''}`,
      html: pinSvg(cat.icon, cat.color),
      iconSize: [32, 42], iconAnchor: [16, 41], popupAnchor: [0, -36]
    }),
    keyboard: true, title: p.name, alt: `${p.name} — ${cat.label}`
  });
  marker.bindPopup(
    `<div style="--cat:${cat.color}">
       <div class="pop-cat">${cat.label} · ${state.meta.eras[p.era].label}</div>
       <div class="pop-name">${p.name}</div>
       ${p.localName ? `<div class="pop-local">${p.localName}</div>` : ''}
       <p class="pop-sum">${p.summary}</p>
       <button class="pop-more" data-id="${p.id}">Read more →</button>
     </div>`);
  marker.on('popupopen', (e) => {
    e.popup.getElement().querySelector('.pop-more')
      ?.addEventListener('click', () => openDetail(p));
  });
  marker._placeId = p.id;
  return marker;
}

function clusterFor(latlng, members) {
  const n = members.length;
  // size follows count, but sub-linearly, so a 400-place cluster is not a disc
  const r = Math.min(46, 26 + Math.log2(n) * 4);
  const cats = new Set(members.map((m) => m.category));
  const colour = cats.size === 1
    ? state.meta.categories[members[0].category].color
    : '#5c4f3a';
  const marker = L.marker(latlng, {
    icon: L.divIcon({
      className: 'cluster',
      html: `<span class="cluster-dot" style="--cat:${colour};width:${r}px;height:${r}px">
               <span class="cluster-n">${n}</span></span>`,
      iconSize: [r, r], iconAnchor: [r / 2, r / 2]
    }),
    keyboard: true,
    title: `${n} places — click to zoom in`,
    alt: `Cluster of ${n} places`
  });
  marker.on('click', () => {
    const b = L.latLngBounds(members.map((m) => m.coords));
    // a cluster of co-located points has no extent; just zoom in on it
    state.map.flyToBounds(b.pad(0.25), { maxZoom: state.map.getZoom() + 4, duration: 0.6 });
  });
  return marker;
}

/** Rebuild the marker layer for the current filters and viewport. */
function renderMarkers() {
  const visible = state.visible;
  const zoom = state.map.getZoom();
  const bounds = state.map.getBounds().pad(VIEW_PAD);
  const inView = visible.filter((p) => bounds.contains(L.latLng(p.coords)));

  const cells = new Map();
  for (const p of inView) {
    const pt = state.map.project(L.latLng(p.coords), zoom);
    const key = `${Math.floor(pt.x / CLUSTER_PX)}:${Math.floor(pt.y / CLUSTER_PX)}`;
    (cells.get(key) || cells.set(key, []).get(key)).push(p);
  }

  state.markerLayer.clearLayers();
  state.markers.clear();
  for (const members of cells.values()) {
    if (members.length === 1) {
      const m = pinFor(members[0]);
      state.markers.set(members[0].id, m);
      state.markerLayer.addLayer(m);
    } else {
      const lat = members.reduce((a, p) => a + p.coords[0], 0) / members.length;
      const lon = members.reduce((a, p) => a + p.coords[1], 0) / members.length;
      state.markerLayer.addLayer(clusterFor([lat, lon], members));
    }
  }
  if (state.activeId) state.markers.get(state.activeId)?.getElement()?.classList.add('is-active');
}

function buildRail() {
  const { categories, usedEras, usedTags } = state.meta;
  const rail = $('.rail');

  $('.search').addEventListener('input', (e) => { state.filters.query = e.target.value.trim(); render(); });

  const legend = $('#legend');
  // Shown lexicographically, not in categories.json's insertion order — a
  // reader scanning a legend expects alphabetical, not "however it was added".
  const sortedCats = Object.entries(categories).sort((a, b) => a[1].label.localeCompare(b[1].label));
  for (const [id, c] of sortedCats) {
    if (!state.places.some((p) => p.category === id)) continue;
    const li = el('li', 'legend-item');
    li.style.setProperty('--cat', c.color);
    li.setAttribute('role', 'button');
    li.tabIndex = 0;
    li.setAttribute('aria-pressed', 'false');
    li.dataset.cat = id;
    li.innerHTML = `<span class="legend-swatch">${iconSvg(c.icon)}</span>${c.label}`;
    const hit = () => { toggle(state.filters.categories, id); render(); };
    li.addEventListener('click', hit);
    li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(); } });
    legend.append(li);
  }

  const eras = $('#eras');
  for (const [id, e0] of Object.entries(usedEras)) {
    const li = el('li');
    const b = el('button', 'chip', `${e0.label} <span style="opacity:.6">${e0.range}</span>`);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.era = id;
    b.addEventListener('click', () => { toggle(state.filters.eras, id); render(); });
    li.append(b); eras.append(li);
  }

  const tags = $('#tags');
  for (const [id, label] of Object.entries(usedTags)) {
    const li = el('li');
    const b = el('button', 'chip', label);
    b.type = 'button'; b.setAttribute('aria-pressed', 'false'); b.dataset.tag = id;
    b.addEventListener('click', () => { toggle(state.filters.tags, id); render(); });
    li.append(b); tags.append(li);
  }


  $('#results').addEventListener('click', (e) => {
    const b = e.target.closest('[data-place]');
    if (b) openDetail(state.places.find((x) => x.id === b.dataset.place), true);
  });

  $('.reset').addEventListener('click', () => {
    clear(state.filters); $('.search').value = ''; render();
  });
  $('.rail-toggle').addEventListener('click', () => rail.classList.toggle('is-open'));
  $('.detail .close').addEventListener('click', closeDetail);
}

function render() {
  const f = state.filters;
  // Shown lexicographically, not in load order — the results list is the
  // reachable-fallback for pins that overlap or sit off-screen, and a reader
  // scanning it expects alphabetical, same as the legend.
  state.visible = apply(state.places, f).sort((a, b) => a.name.localeCompare(b.name));

  renderMarkers();
  renderResults();

  for (const n of document.querySelectorAll('[data-cat]')) n.setAttribute('aria-pressed', f.categories.has(n.dataset.cat));
  for (const n of document.querySelectorAll('[data-era]')) n.setAttribute('aria-pressed', f.eras.has(n.dataset.era));
  for (const n of document.querySelectorAll('[data-tag]')) n.setAttribute('aria-pressed', f.tags.has(n.dataset.tag));

  // Grey out categories that cannot produce a result under the other axes.
  // One pass over the data bucketed by category, rather than a full filter
  // sweep per category — that was O(categories x places) on every click.
  const others = { ...f, categories: new Set() };
  const reachable = new Set(apply(state.places, others).map((p) => p.category));
  for (const n of document.querySelectorAll('[data-cat]'))
    n.classList.toggle('is-empty', !reachable.has(n.dataset.cat));

  $('#tag-count').textContent = f.tags.size
    ? `(${f.tags.size} of ${Object.keys(state.meta.usedTags).length} selected)`
    : `(${Object.keys(state.meta.usedTags).length})`;

  $('.count').textContent = `${state.visible.length} of ${state.places.length} place${state.places.length === 1 ? '' : 's'}`;
  $('.reset').hidden = !isActive(f);
  $('.empty-note').hidden = state.visible.length > 0;

  syncFiltersToUrl(f);
}

// Keeps ?cat=/?era=/?tag=/?q= in sync with the live filter state, so the
// current view is always the URL in the address bar — reusing whatever
// `place` param openDetail/closeDetail already own, never clobbering it.
function syncFiltersToUrl(f) {
  const u = new URL(location);
  const set = (key, values) => values.length ? u.searchParams.set(key, values.join(',')) : u.searchParams.delete(key);
  set('cat', [...f.categories]);
  set('era', [...f.eras]);
  set('tag', [...f.tags]);
  f.query ? u.searchParams.set('q', f.query) : u.searchParams.delete('q');
  history.replaceState(null, '', u);
}

/* The results list is windowed.

   It exists because pins overlap at city zoom and the ones underneath cannot
   be clicked, so every visible place must stay reachable from somewhere. But
   rendering one row per place put 1,440 buttons in the DOM at full size. Only
   a couple of dozen are ever on screen, so only those are built; the rest of
   the scroll height is held open by a spacer. */
const ROW_H = 44;      // must match .result height in css/map.css
const OVERSCAN = 6;

function renderResults() {
  const box = $('#results');
  const list = state.visible;
  const total = list.length;

  if (!box._virtual) {
    box.innerHTML = '<li class="r-spacer"></li><li class="r-window"></li>';
    box._virtual = true;
    // The rail scrolls, not the list, so that is what we listen to.
    $('.rail').addEventListener('scroll', () => renderResultsWindow(), { passive: true });
  }
  box.querySelector('.r-spacer').style.height = `${total * ROW_H}px`;
  renderResultsWindow();
}

function renderResultsWindow() {
  const box = $('#results');
  if (!box?._virtual) return;
  const list = state.visible;
  const rail = $('.rail');
  const top = Math.max(0, rail.scrollTop - box.offsetTop);
  const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  const count = Math.ceil(rail.clientHeight / ROW_H) + OVERSCAN * 2;
  const slice = list.slice(first, first + count);

  const win = box.querySelector('.r-window');
  win.style.transform = `translateY(${first * ROW_H}px)`;
  win.innerHTML = slice.map((p) => {
    const c = state.meta.categories[p.category];
    return `<button type="button" class="result" data-place="${p.id}" style="--cat:${c.color}">
      <span class="r-icon">${iconSvg(c.icon)}</span>
      <span class="r-text"><span class="r-name">${p.name}</span>
      <span class="r-meta">${c.label} · ${state.meta.eras[p.era].label}</span></span>
    </button>`;
  }).join('');
}

async function openDetail(p, fly = false) {
  // The index carries no description or sources; pull the full record first.
  // Cheap after the first open of a region, and invisible in practice.
  await loadDetail(state.meta, p);

  const cat = state.meta.categories[p.category];
  const d = $('.detail');
  d.style.setProperty('--cat', cat.color);
  $('.detail .cat').textContent = `${cat.label} · ${state.meta.eras[p.era].label}`;
  $('.detail h2').textContent = p.name;
  $('.detail .local').textContent = p.localName || '';
  $('.detail .meta').textContent = [p.built, `${p.city}, ${p.state}`].filter(Boolean).join(' · ');
  $('.detail .body').innerHTML = (p.description || []).map((x) => `<p>${x}</p>`).join('');

  const notes = $('.detail .notes');
  notes.innerHTML = '';
  if (p.coordsNote) notes.append(el('div', 'note', `<strong>Location is approximate.</strong> ${p.coordsNote}`));
  if (p.contested) notes.append(el('div', 'note', `<strong>Contested.</strong> ${p.contested}`));

  $('.detail .sources').innerHTML = (p.sources || [])
    .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.title}</a></li>`).join('');

  d.classList.add('is-open');
  d.setAttribute('aria-hidden', 'false');
  $('.detail .close').focus();

  state.activeId = p.id;
  for (const [id, m] of state.markers) m.getElement()?.classList.toggle('is-active', id === p.id);
  // Flying changes the viewport, which rebuilds the markers; renderMarkers()
  // re-applies .is-active from state.activeId once the new pins exist.
  if (fly) state.map.flyTo(p.coords, 16, { duration: 0.9 });

  const u = new URL(location); u.searchParams.set('place', p.id); history.replaceState(null, '', u);
}

function closeDetail() {
  const d = $('.detail');
  d.classList.remove('is-open');
  d.setAttribute('aria-hidden', 'true');
  state.activeId = null;
  for (const m of state.markers.values()) m.getElement()?.classList.remove('is-active');
  const u = new URL(location); u.searchParams.delete('place'); history.replaceState(null, '', u);
}

init().catch((err) => {
  console.error(err);
  fatal('The map failed to start.', `<code style="font:.9em var(--mono)">${err.message}</code>`);
});
