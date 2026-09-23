const B=process.env.BASE||'http://127.0.0.1:8111';
import { chromium } from 'playwright';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
let fail=0;
const is=(n,g,w)=>g===w?console.log(`  PASS  ${n} (${JSON.stringify(g).slice(0,70)})`):(fail++,console.log(`  FAIL  ${n} — got ${JSON.stringify(g).slice(0,90)} want ${JSON.stringify(w)}`));
const b=await chromium.launch();
const ctx=await b.newContext({userAgent:UA,viewport:{width:1100,height:900}});
const p=await ctx.newPage();
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
// Computed from the actual data rather than hardcoded, so adding a place
// never requires hand-updating a number here — the same reasoning that
// keeps about.js itself generated instead of hand-written.
const regions = await (await fetch(`${B}/data/regions.json`)).json();
const places = (await Promise.all(regions.map((r) => fetch(`${B}/${r.file}`).then((r) => r.json())))).flat();
const wantContested = places.filter((pl) => pl.contested).length;
const wantStatesLine = `${new Set(places.map((pl) => pl.state)).size} states and regions`;

await p.goto(`${B}/about.html`,{waitUntil:'networkidle'});
await p.waitForTimeout(1200);
is('stat tiles rendered', await p.locator('#stats .stat').count(), 6);
// A generic count, not an enumerated state list — the list went stale in a
// different way than the count did, and the user asked for a generic term.
is('states line is a generic count', await p.locator('#states-line').textContent(), wantStatesLine);
is('gap entries generated', await p.locator('#gaps > li').count(), wantContested);
const t=await p.locator('.prose').textContent();
is('covers a Karnataka gap', t.includes('Belur'), true);
is('covers a Maharashtra gap', t.includes('Raigad'), true);
is('covers a Calicut gap', t.includes('Mishkal'), true);
is('gap links go to the map', (await p.locator('#gaps > li a').first().getAttribute('href')).startsWith('map.html?place='), true);
is('coverage list generated', await p.locator('#coverage .cov-list li').count(), places.length);
is('coverage grouped by state', await p.locator('#coverage .cov-state').count(), 20);
const body=await p.locator('.prose').textContent();
is('no hard-coded city in the prose intro', /built one region at a time/.test(body), true);
is('no console errors', errs.length, 0);
await p.screenshot({path:(process.env.SHOTS||'/tmp')+'/about.png', fullPage:false});
await b.close();
console.log(fail?`\n${fail} FAILURE(S)\n`:'\nAbout page checks passed.\n');
process.exit(fail?1:0);
