import { chromium } from 'playwright';
const UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const B=process.env.BASE||'http://127.0.0.1:8111';
let fail=0;
const is=(n,g,w)=>g===w?console.log(`  PASS  ${n} (${JSON.stringify(g).slice(0,60)})`):(fail++,console.log(`  FAIL  ${n} — got ${JSON.stringify(g).slice(0,80)} want ${JSON.stringify(w)}`));
const b=await chromium.launch();

// ── Scenario 1: unpkg blocked, cdnjs reachable → fallback must save it ──
{
  console.log('\n1. unpkg blocked (cdnjs fallback should load)');
  const ctx=await b.newContext({userAgent:UA,viewport:{width:1200,height:800}});
  await ctx.route('**://unpkg.com/**', r=>r.abort());
  const p=await ctx.newPage();
  await p.goto(`${B}/map.html`); await p.waitForTimeout(4000);
  is('Leaflet loaded from fallback', await p.evaluate(()=>typeof window.L!=='undefined'), true);
  is('markers render anyway', (await p.locator('.leaflet-marker-icon').count()) > 0, true);
  await ctx.close();
}

// ── Scenario 2: BOTH CDNs blocked → must explain, not go blank ──
{
  console.log('\n2. both CDNs blocked (must show a real message)');
  const ctx=await b.newContext({userAgent:UA,viewport:{width:1200,height:800}});
  await ctx.route('**://unpkg.com/**', r=>r.abort());
  await ctx.route('**://cdnjs.cloudflare.com/**', r=>r.abort());
  const p=await ctx.newPage();
  await p.goto(`${B}/map.html`); await p.waitForTimeout(4000);
  const txt=(await p.locator('#map').textContent()).trim();
  is('map is NOT silently empty', txt.length>40, true);
  is('names the cause', txt.includes('map library could not be loaded'), true);
  is('mentions DNS filtering / Pi-hole', /Pi-hole|DNS filter/.test(txt), true);
  is('offers the home page as a way through', txt.includes('home page'), true);
  await p.screenshot({path:(process.env.SHOTS||'/tmp')+'/blocked-both.png'});
  await ctx.close();
}

// ── Scenario 3: data file missing → must explain too ──
{
  console.log('\n3. a data file 404s');
  const ctx=await b.newContext({userAgent:UA,viewport:{width:1200,height:800}});
  await ctx.route('**/data/regions.json', r=>r.fulfill({status:404,body:'nope'}));
  const p=await ctx.newPage();
  await p.goto(`${B}/map.html`); await p.waitForTimeout(3000);
  const txt=(await p.locator('#map').textContent()).trim();
  is('explains the data failure', /Could not load the map data|failed to start/.test(txt), true);
  await ctx.close();
}
await b.close();
console.log(fail?`\n${fail} FAILURE(S)\n`:'\nAll failure-path checks passed.\n');
process.exit(fail?1:0);
