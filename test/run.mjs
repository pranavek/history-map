import { chromium } from 'playwright';
const B=process.env.BASE||'http://127.0.0.1:8111';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
let fail=0;
const ok=(m)=>console.log('  PASS  '+m);
const bad=(m)=>{console.log('  FAIL  '+m);fail++;};
const is=(m,g,w)=>g===w?ok(`${m} (${g})`):bad(`${m} — got ${JSON.stringify(g)} want ${JSON.stringify(w)}`);
/* Markers cluster, so counting .pin elements no longer counts places. A place
   is represented either by its own pin or by the cluster it falls into. */
const represented = (pg) => pg.evaluate(() =>
  document.querySelectorAll('.leaflet-marker-icon.pin').length +
  [...document.querySelectorAll('.cluster-n')].reduce((a, e) => a + Number(e.textContent), 0));
/* "N of M places" -> N */
const shown = async (pg) =>
  Number((await pg.locator('.count').textContent()).trim().match(/^(\d+)/)[1]);

// Computed from the actual data rather than hardcoded — adding or removing a
// place, or a tag going in or out of use, should never require hand-updating
// a count in this file. (It did, repeatedly, before this.)
const regions = await (await fetch(`${B}/data/regions.json`)).json();
const places = (await Promise.all(regions.map((r) => fetch(`${B}/${r.file}`).then((r) => r.json())))).flat();
const wantPlaces = places.length;
const wantTags = new Set(places.flatMap((pl) => pl.tags || [])).size;

const browser=await chromium.launch();
const ctx=await browser.newContext({userAgent:UA,viewport:{width:1440,height:900},deviceScaleFactor:2});
const errs=[];
ctx.on('weberror',e=>errs.push('pageerror: '+e.error().message));

// ── Landing ──────────────────────────────────────────────────────────────────
console.log('\nindex.html');
let p=await ctx.newPage();
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
await p.goto(B+'/index.html',{waitUntil:'networkidle'});
await p.waitForSelector('#featured .place-card',{timeout:5000}).catch(()=>{});
is('featured cards rendered', await p.locator('#featured .place-card').count(), wantPlaces);
is('legend entries rendered', await p.locator('#legend .legend-item').count(), 17);
is('place count text', await p.locator('#place-count').textContent(), String(wantPlaces));
is('India silhouette present', await p.locator('svg.india').count(), 1);
{ const items = await p.locator('#legend .legend-item').allTextContents();
  is('landing legend is alphabetical', JSON.stringify(items), JSON.stringify([...items].sort((a,z)=>a.localeCompare(z)))); }
is('landing groups by state', await p.locator('.state-block').count(), 20);
{ const names = await p.locator('.state-name').allTextContents();
  // Each heading is "State Name  <count>" (state-count span is inside it) — strip the trailing digits before sorting.
  const clean = names.map((t) => t.replace(/\s*\d+\s*$/, '').trim());
  is('landing state groups are alphabetical', JSON.stringify(clean), JSON.stringify([...clean].sort((a,z)=>a.localeCompare(z)))); }
const paths=await p.locator('svg.india .india-land path').count();
paths>40?ok(`India land paths: ${paths} (mainland + islands)`):bad(`only ${paths} land paths`);
is('Calicut pin on silhouette', await p.locator('svg.india .india-pin circle').count(), 1);
const h1=await p.locator('h1').first().textContent();
ok('h1: '+h1.trim());
await p.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-landing.png',fullPage:false});
await p.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-landing-full.png',fullPage:true});

// ── Map ──────────────────────────────────────────────────────────────────────
console.log('\nmap.html');
const p2=await ctx.newPage();
p2.on('console',m=>{if(m.type()==='error')errs.push('map console: '+m.text())});
p2.on('pageerror',e=>errs.push('map pageerror: '+e.message));
await p2.goto(B+'/map.html',{waitUntil:'networkidle'});
await p2.waitForSelector('.pin',{timeout:8000}).catch(()=>{});
const total = await shown(p2);   // read from the page, not hard-coded
is('every place represented on the map', await represented(p2), wantPlaces);
is('approximate markers flagged', (await p2.locator('.pin.is-approx').count()) > 0, true);
is('legend filter entries', await p2.locator('#legend .legend-item').count(), 17);
{ const items = await p2.locator('#legend .legend-item').allTextContents();
  is('map legend is alphabetical', JSON.stringify(items), JSON.stringify([...items].sort((a,z)=>a.localeCompare(z)))); }
is('era chips', (await p2.locator('#eras .chip').count()) > 0, true);
is('tag chips', await p2.locator('#tags .chip').count(), wantTags);
is('count line', (await p2.locator('.count').textContent()).trim(), `${wantPlaces} of ${wantPlaces} places`);
is('results list reports every place', await shown(p2), wantPlaces);
is('results list renders a window of rows', (await p2.locator('#results .result').count()) > 0, true);
const tiles=await p2.locator('.leaflet-tile-loaded').count();
tiles>0?ok(`tiles loaded: ${tiles}`):bad('no tiles loaded');
const filt=await p2.evaluate(()=>getComputedStyle(document.querySelector('.leaflet-tile-pane')).filter);
filt.includes('grayscale')&&filt.includes('sepia')?ok('parchment filter applied to tile pane'):bad('filter missing: '+filt);
const af=await p2.evaluate(()=>getComputedStyle(document.querySelector('.leaflet-control-attribution')).filter);
is('attribution NOT filtered', af, 'none');
const attrib=await p2.locator('.leaflet-control-attribution').textContent();
attrib.includes('OpenStreetMap')?ok('OSM attribution visible: '+attrib.trim()):bad('attribution missing');
await p2.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-map.png'});

// filter: click Temple in the legend
console.log('\nfiltering');
const wantTemples = places.filter((pl) => pl.category === 'temple').length;
await p2.locator('#legend .legend-item[data-cat="temple"]').click();
await p2.waitForTimeout(250);
is('after Temple filter, places represented', await represented(p2), wantTemples);
is('count updates', (await p2.locator('.count').textContent()).trim(), `${wantTemples} of ${wantPlaces} places`);
is('results list follows filter', await p2.locator('#results .result').count(), wantTemples);
is('reset button shown', await p2.locator('.reset').isVisible(), true);
// contradictory: no railway predates 1947, let alone 600 CE
await p2.locator('.reset').click();
await p2.waitForTimeout(250);
await p2.locator('#legend .legend-item[data-cat="railway"]').click();
await p2.locator('#eras .chip[data-era="ancient"]').click();
await p2.waitForTimeout(250);
is('contradictory filter -> nothing represented', await represented(p2), 0);
is('empty note shown', await p2.locator('.empty-note').isVisible(), true);
is('results list empties too', await p2.locator('#results .result').count(), 0);
await p2.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-empty.png'});
await p2.locator('.reset').click();
await p2.waitForTimeout(250);
is('after reset, places represented again', await represented(p2), wantPlaces);

// tag disclosure: collapsed by default, auto-opens when a tag filter is active
console.log('\nIndia boundary overlay');
await p2.evaluate(()=>{const m=document.querySelector('#map');});
is('boundary drawn at national zoom', await p2.locator('.leaflet-overlay-pane path').count()>0, true);

console.log('\ntag disclosure');
is('tags collapsed on load', await p2.locator('.tag-box[open]').count(), 0);
is('tag count label', (await p2.locator('#tag-count').textContent()).trim(), `(${wantTags})`);
await p2.locator('.tag-box > summary').click(); await p2.waitForTimeout(250);
is('opens on click', await p2.locator('.tag-box[open]').count(), 1);
await p2.locator('#tags .chip[data-tag="parsi"]').click(); await p2.waitForTimeout(300);
is('parsi tag narrows the set to one place', await shown(p2), 1);
is('summary reports active count', (await p2.locator('#tag-count').textContent()).trim(), `(1 of ${wantTags} selected)`);
await p2.locator('.tag-box > summary').click(); await p2.waitForTimeout(250);
is('user can still collapse it', await p2.locator('.tag-box[open]').count(), 0);
is('active count still visible when collapsed', await p2.locator('#tag-count').isVisible(), true);
await p2.locator('.reset').click(); await p2.waitForTimeout(300);

// the list must reach a place whose pin is buried under others. The results
// list is sorted alphabetically and windowed (virtualized) for performance,
// so a target place is not necessarily rendered in the DOM at all unless it
// is scrolled into view or the list is narrow enough to contain it whole —
// searching for it, rather than assuming its position in the full list, is
// what makes this robust to the list being re-sorted or the dataset growing.
console.log('\noverlapping pins reachable via list');
await p2.locator('.search').fill('Parsi Anjuman'); await p2.waitForTimeout(300);
await p2.locator('#results .result[data-place="parsi-anjuman-baug"]').click();
await p2.waitForTimeout(700);
is('buried place opens from list', (await p2.locator('.detail h2').textContent()).trim(), 'Parsi Anjuman Baug');
await p2.locator('.detail .close').click();
await p2.locator('.search').fill(''); await p2.waitForTimeout(300); // clear, so later steps see the full dataset again

// popup -> detail
console.log('\npopup and detail panel');
await p2.locator('.leaflet-marker-icon.pin').first().click();
await p2.waitForSelector('.leaflet-popup',{timeout:4000}).catch(()=>{});
is('popup opened', await p2.locator('.leaflet-popup').count(), 1);
await p2.locator('.pop-more').click();
await p2.waitForTimeout(400);
is('detail panel open', await p2.locator('.detail.is-open').count(), 1);
const dn=await p2.locator('.detail h2').textContent();
ok('detail shows: '+dn);
is('sources listed', (await p2.locator('.detail .sources li').count())>0, true);
is('deep link written to URL', p2.url().includes('place='), true);
await p2.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-detail.png'});

// deep link direct
console.log('\ndeep link');
const p3=await ctx.newPage();
p3.on('pageerror',e=>errs.push('deep pageerror: '+e.message));
await p3.goto(B+'/map.html?place=mishkal-mosque',{waitUntil:'networkidle'});
await p3.waitForTimeout(1600);
is('deep link opens detail', await p3.locator('.detail.is-open').count(), 1);
is('correct place', (await p3.locator('.detail h2').textContent()).trim(), 'Mishkal Mosque');
is('approximate note rendered', (await p3.locator('.detail .note').first().textContent()).includes('approximate'), true);
await p3.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-deeplink.png'});

// mobile
console.log('\nmobile 360px');
const m=await ctx.newPage(); await m.setViewportSize({width:360,height:740});
m.on('pageerror',e=>errs.push('mobile pageerror: '+e.message));
await m.goto(B+'/index.html',{waitUntil:'networkidle'});
const sw=await m.evaluate(()=>document.documentElement.scrollWidth);
is('no horizontal scroll on landing', sw<=360, true);
await m.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-mobile.png',fullPage:false});
const m2=await ctx.newPage(); await m2.setViewportSize({width:360,height:740});
await m2.goto(B+'/map.html',{waitUntil:'networkidle'});
await m2.waitForTimeout(900);
is('rail toggle visible on mobile', await m2.locator('.rail-toggle').isVisible(), true);
await m2.locator('.rail-toggle').click(); await m2.waitForTimeout(350);
is('rail opens as sheet', await m2.locator('.rail.is-open').count(), 1);
await m2.screenshot({path:(process.env.SHOTS||'/tmp')+'/shot-mobile-map.png'});

console.log('\nconsole errors');
errs.length?errs.forEach(e=>bad(e)):ok('none');
await browser.close();
console.log(fail?`\n${fail} FAILURE(S)\n`:'\nAll browser checks passed.\n');
process.exit(fail?1:0);
