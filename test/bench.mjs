/* Measure the map at a given size, under a throttled connection and CPU so the
   numbers mean something on a phone. Prints one line per metric so runs can be
   diffed directly.

   BASE=http://127.0.0.1:8123 WANT=1440 node test/bench.mjs */
import { chromium } from 'playwright';

const B = process.env.BASE || 'http://127.0.0.1:8123';
const WANT = Number(process.env.WANT || 0);
const NET = { downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8, latency: 60 }; // good 4G
const CPU = 4;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NET });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

let bytes = 0, reqs = 0;
p.on('response', async (r) => { reqs++; try { bytes += (await r.body()).length; } catch {} });

const t0 = Date.now();
await p.goto(`${B}/map.html`, { waitUntil: 'domcontentloaded' });
const dcl = Date.now() - t0;

// "interactive" = the results list is populated, which is what render() drives
await p.waitForFunction(() => document.querySelectorAll('#results .result').length > 0,
                        null, { timeout: 240000, polling: 100 });
const interactive = Date.now() - t0;

// and settle: wait for the DOM to stop growing
let prev = -1, same = 0;
while (same < 3) {
  const n = await p.evaluate(() => document.getElementsByTagName('*').length);
  same = n === prev ? same + 1 : 0; prev = n;
  await p.waitForTimeout(200);
}
const settled = Date.now() - t0;

const m = await p.evaluate(() => ({
  nodes: document.getElementsByTagName('*').length,
  markers: document.querySelectorAll('.leaflet-marker-icon').length,
  rows: document.querySelectorAll('#results .result').length,
  places: window.__bench?.places ?? null,
}));

// interaction: toggle a category and time to next paint, median of 5
const times = [];
for (let i = 0; i < 5; i++) {
  times.push(await p.evaluate(async () => {
    const e = document.querySelector('#legend .legend-item');
    const s = performance.now(); e.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return performance.now() - s;
  }));
}
times.sort((a, z) => a - z);

const pad = (s, n = 26) => String(s).padEnd(n);
console.log(`  ${pad('places')} ${m.places ?? WANT}`);
console.log(`  ${pad('requests')} ${reqs}`);
console.log(`  ${pad('transferred')} ${(bytes / 1e6).toFixed(2)} MB`);
console.log(`  ${pad('DOMContentLoaded')} ${dcl} ms`);
console.log(`  ${pad('interactive (list ready)')} ${interactive} ms`);
console.log(`  ${pad('settled')} ${settled} ms`);
console.log(`  ${pad('DOM nodes')} ${m.nodes.toLocaleString()}`);
console.log(`  ${pad('marker elements')} ${m.markers.toLocaleString()}`);
console.log(`  ${pad('result rows')} ${m.rows.toLocaleString()}`);
console.log(`  ${pad('filter -> paint (median)')} ${Math.round(times[2])} ms`);

if (WANT && m.markers === 0) { console.log('\n  WARNING: no markers rendered'); process.exit(1); }
await b.close();
