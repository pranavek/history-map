/* The colophon's uncertainty section is generated, not written. Hand-listing
   what the map does not know went stale within two commits of being written —
   this reads it back out of the data, so it cannot drift again. */
import { loadAll } from './data.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

(async () => {
  let d;
  // the gaps section is built from contested/coordsNote, which the index omits
  try { d = await loadAll('', { full: true }); }
  catch (err) { $('#gaps').innerHTML = `<p style="color:var(--accent)">Could not load the data: ${esc(err.message)}</p>`; return; }

  const { places, regions, categories } = d;
  const states = [...new Set(places.map((p) => p.state))];
  const approx = places.filter((p) => p.coordsPrecision === 'approximate');
  const contested = places.filter((p) => p.contested);

  $('#stats').innerHTML = [
    [places.length, 'places'],
    [states.length, 'states and regions'],
    [Object.keys(categories).length, 'categories'],
    [`${places.filter((p) => p.sources?.length).length}/${places.length}`, 'cite sources'],
    [approx.length, 'approximate positions'],
    [contested.length, 'carry a contested note']
  ].map(([n, l]) => `<div class="stat"><span class="stat-n">${n}</span><span class="stat-l">${l}</span></div>`).join('');

  // A generic count, not an enumerated list — naming every state/region here
  // just duplicates the "states and regions" stat below and goes stale at a
  // different pace than that count does.
  $('#states-line').textContent = `${states.length} states and regions`;

  // Coverage is read from the data too. Adding a region should never mean
  // editing this page.
  const byState = new Map();
  for (const p of places) {
    if (!byState.has(p.state)) byState.set(p.state, []);
    byState.get(p.state).push(p);
  }
  $('#coverage').innerHTML = [...byState].map(([state, list]) => `
    <h3 class="cov-state">${esc(state)} <span class="cov-n">${list.length}</span></h3>
    <ul class="cov-list">${list.map((p) => `
      <li><a href="map.html?place=${p.id}">${esc(p.name)}</a>
        <span class="cov-cat">${esc(categories[p.category].label)}</span></li>`).join('')}</ul>`).join('');

  $('#gaps').innerHTML = contested.map((p) => `
    <li><a href="map.html?place=${p.id}"><strong>${esc(p.name)}</strong></a>
      <span class="gap-where">${esc(p.state)}</span>
      <p>${esc(p.contested)}</p>
      ${p.coordsNote ? `<p class="gap-coords"><strong>Position:</strong> ${esc(p.coordsNote)}</p>` : ''}
    </li>`).join('');

  const noNote = approx.filter((p) => !p.contested);
  $('#approx-only').innerHTML = noNote.length
    ? `<h3>Approximate positions</h3><ul class="gaps">${noNote.map((p) => `
        <li><a href="map.html?place=${p.id}"><strong>${esc(p.name)}</strong></a>
          <span class="gap-where">${esc(p.state)}</span>
          <p>${esc(p.coordsNote || '')}</p></li>`).join('')}</ul>`
    : '';
})();
