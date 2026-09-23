/* Shared boot script for /history/ reading pages. Same shape as about.js:
   fetch JSON, render it, never hand-write prose into the HTML that could
   drift from the data.

   history/state.html is a single template shared by every state and union
   territory, chosen by a `?s=<slug>` query param rather than one HTML file
   each — the content differs, the page structure never does. On load, if
   `?s=` is present, this resolves it against the manifest (data/history/
   regions.json — called "regions", not "states", because a third of the
   entries are union territories, not states) and fills in the title,
   breadcrumb, heading and lede before falling through to the same
   #intro/#place-list rendering every other /history/ page uses.

   #intro renders data/history/<key>.json, where key is either "india" or
   set dynamically to "states/<slug>" by the ?s= bootstrap above (the JSON
   files themselves still live under data/history/states/ — only the
   manifest's own field name was the state/UT-conflating part).
   #state-list, if present (india.html only), renders the regions manifest as
   links to state.html?s=<slug> — this is how india.html reaches these pages,
   since they aren't part of the main site nav.
   #place-list, if present, lists a region's places live from the existing
   data/places/*.json via its data-state attribute — that attribute name
   matches the `state` field every place record already carries (set by the
   map app, unrelated to this manifest), not renamed here.
   #timeline, if present (history/science.html only), renders
   data/history/science.json as a chronological, era-grouped timeline — see
   renderTimeline(). */
import { loadAll } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const base = document.body.dataset.base || '';

const json = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
};

function renderSections(sections) {
  return sections.map((s) => `
    <section id="${esc(s.id)}">
      <h2>${esc(s.heading)}</h2>
      ${s.body.map((p) => `<p>${esc(p)}</p>`).join('')}
      ${s.sources?.length ? `<p class="sources">Sources: ${s.sources.map((src) =>
        `<a href="${esc(src.url)}">${esc(src.title)}</a>`).join(' &middot; ')}</p>` : ''}
    </section>`).join('');
}

// history/science.html: a chronological timeline grouped into named eras,
// not the prose-section shape every other /history/ page uses — the content
// is discrete dated entries, not paragraphs, so it gets its own renderer.
function renderTimeline(eras) {
  return eras.map((era) => `
    <section class="era-group">
      <h2>${esc(era.eraLabel)} <span class="era-range">${esc(era.eraRange)}</span></h2>
      <ol class="timeline">
        ${era.entries.map((e) => `
          <li class="timeline-entry" id="${esc(e.id)}">
            <span class="timeline-year">${esc(e.year)}</span>
            <div class="timeline-body">
              <h3>${esc(e.title)}</h3>
              <p>${esc(e.body)}</p>
              ${e.note ? `<p class="timeline-note">${esc(e.note)}</p>` : ''}
              ${e.sources?.length ? `<details class="sources"><summary>Sources</summary>
                <p>${e.sources.map((src) => `<a href="${esc(src.url)}">${esc(src.title)}</a>`).join(' &middot; ')}</p>
              </details>` : ''}
            </div>
          </li>`).join('')}
      </ol>
    </section>`).join('');
}

(async () => {
  // Bootstrap the generic template: resolve ?s=<slug> against the regions
  // manifest and wire up #intro/#place-list before the generic render code
  // below runs, so everything else stays identical to a static page.
  const regionSlug = new URLSearchParams(location.search).get('s');
  if (regionSlug) {
    const introEl = $('#intro');
    try {
      const manifest = await json(`${base}data/history/regions.json`);
      const entry = manifest.find((r) => r.slug === regionSlug);
      if (!entry) throw new Error(`"${regionSlug}" is not on this map yet`);
      document.title = `The History of ${entry.region} — Historical Places of India`;
      document.querySelector('meta[name="description"]')?.setAttribute('content', entry.lede);
      $('#breadcrumb-state').textContent = entry.region;
      $('#state-h1').textContent = `The history of ${entry.region}`;
      $('#state-lede').textContent = entry.lede;
      $('#place-heading-state').textContent = entry.region;
      introEl.dataset.history = `states/${entry.slug}`;
      $('#place-list').dataset.state = entry.region;

      // Prev/next cycle alphabetically through the manifest (its own listed
      // order), wrapping at both ends so "browse everything" never dead-ends.
      const idx = manifest.indexOf(entry);
      const prev = manifest[(idx - 1 + manifest.length) % manifest.length];
      const next = manifest[(idx + 1) % manifest.length];
      const prevEl = $('#pager-prev'), nextEl = $('#pager-next');
      if (prevEl) { prevEl.href = `state.html?s=${encodeURIComponent(prev.slug)}`; prevEl.textContent = `← ${prev.region}`; }
      if (nextEl) { nextEl.href = `state.html?s=${encodeURIComponent(next.slug)}`; nextEl.textContent = `${next.region} →`; }
    } catch (err) {
      introEl.innerHTML = `<p style="color:var(--accent)">${esc(err.message)}. <a href="india.html">Back to History</a>.</p>`;
      return;
    }
  }

  const introEl = $('#intro');
  if (introEl) {
    const key = introEl.dataset.history;
    try { introEl.innerHTML = renderSections(await json(`${base}data/history/${key}.json`)); }
    catch (err) { introEl.innerHTML = `<p style="color:var(--accent)">Could not load this page's content: ${esc(err.message)}</p>`; }
  }

  const stateListEl = $('#state-list');
  if (stateListEl) {
    try {
      const regions = await json(`${base}data/history/regions.json`);
      stateListEl.innerHTML = regions.map((r) =>
        `<li><a href="${base}history/state.html?s=${esc(r.slug)}">${esc(r.region)}</a></li>`).join('');
    } catch (err) {
      stateListEl.innerHTML = `<li style="color:var(--accent)">Could not load the list: ${esc(err.message)}</li>`;
    }
  }

  const timelineEl = $('#timeline');
  if (timelineEl) {
    try { timelineEl.innerHTML = renderTimeline(await json(`${base}data/history/science.json`)); }
    catch (err) { timelineEl.innerHTML = `<p style="color:var(--accent)">Could not load this page's content: ${esc(err.message)}</p>`; }
  }

  const listEl = $('#place-list');
  if (listEl) {
    const stateName = listEl.dataset.state;
    try {
      const d = await loadAll(base, { full: true });
      const places = d.places.filter((p) => p.state === stateName).sort((a, b) => a.name.localeCompare(b.name));
      listEl.innerHTML = places.length
        ? places.map((p) => `
            <li><a href="${base}map.html?place=${esc(p.id)}">${esc(p.name)}</a>
              <span class="place-meta">${esc(d.categories[p.category].label)} &middot; ${esc(d.eras[p.era].label)}</span></li>`).join('')
        : `<li>No places mapped for ${esc(stateName)} yet.</li>`;
    } catch (err) {
      listEl.innerHTML = `<li style="color:var(--accent)">Could not load places: ${esc(err.message)}</li>`;
    }
  }
})();
