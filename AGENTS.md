# history-of-india — Developer / Agent Guide

## Project overview

A static map of historical places in India. Every place is a pin, typed by what
kind of place it is, filterable by era and tags, and required to cite its
sources. Covers every one of India's UNESCO World Heritage Sites, plus many
more places besides — run `make check` for the current place/region count,
which grows as content is added.

The landing page is not the map. It is a hero page with an India silhouette that
leads into `map.html` — four pins on a country map reads as empty, and a JS-only
map gives search engines nothing to index.

## Tech stack

- **Markup/styles**: hand-written HTML, two stylesheets. No framework, no preprocessor.
- **Scripts**: vanilla ES modules. No bundler.
- **Map**: [Leaflet](https://leafletjs.com/) 1.9.4 from unpkg, with SRI hashes.
- **Tiles**: `tile.openstreetmap.org`, given a parchment treatment in CSS.
- **Data**: static JSON under `data/`, fetched at runtime.
- **Build**: none. No dependencies, no bundler, no minifier. CI stages a plain copy.
- **Tasks**: a `Makefile`. Playwright is installed on demand into a gitignored
  `.test-tools/` and is never part of the published site.
- **Deployment**: GitHub Pages via Actions.

## Project structure

| Path | Role |
|---|---|
| [index.html](index.html) | Landing page. The India SVG is **inlined** — regenerate, don't hand-edit. |
| [map.html](map.html) | The interactive map. Structure only; all content is injected. |
| [about.html](about.html) | Colophon, sources, and what the map admits it doesn't know. |
| [css/style.css](css/style.css) | Design tokens, shared shell, landing styles. |
| [css/map.css](css/map.css) | Leaflet overrides, pins, popups, rail, detail panel. |
| [js/data.js](js/data.js) | Loads and validates all JSON. Throws on bad data. |
| [js/filters.js](js/filters.js) | Pure filter state. No DOM, no Leaflet — testable alone. |
| [js/icons.js](js/icons.js) | Category glyphs and the pin SVG. |
| [js/map.js](js/map.js) | Leaflet init, markers, rail, detail panel, deep links. |
| [js/landing.js](js/landing.js) | Legend row (each item links to `map.html?cat=<id>`, a filtered view — see the shareable-filters note below) and featured cards. |
| [js/about.js](js/about.js) | Generates the colophon's stats tiles and "what the map doesn't know" gaps list from live data — never hand-written, so it can't drift from the data it's reporting on. |
| [data/categories.json](data/categories.json) | Place types → label, colour, icon. |
| [data/eras.json](data/eras.json) | Era ids → label and year range. |
| [data/tags.json](data/tags.json) | Controlled tag vocabulary. |
| [data/regions.json](data/regions.json) | Manifest of place files. Adding a region means adding a line here. |
| [data/places/](data/places/) | One file per region, named for the state, e.g. `kerala.json`. `multi-state.json` holds properties that belong to no single state. |
| [data/india-boundary.geojson](data/india-boundary.geojson) | Claim-line overlay drawn on the map. Generated — see below. |
| [Makefile](Makefile) | Task runner. `make` lists everything. |
| [tools/check.mjs](tools/check.mjs) | Pre-deploy validation, zero dependencies. Run before you commit. |
| [tools/build-boundary.py](tools/build-boundary.py) | Regenerates both boundary artefacts and verifies the claim line before writing. |
| [tools/inline-svg.py](tools/inline-svg.py) | Re-inlines `assets/india.svg` into `index.html`. |
| [test/](test/) | Three Playwright suites: `run` (the map app), `blocked` (failure paths), `about` (the colophon page). Run `make test` for current per-suite and total counts — don't hardcode them here, they drift every time a check is added. |
| [css/reading.css](css/reading.css) | Clean-editorial design tokens for `/history/` — off-white, high contrast, no sepia/grain. Loaded after `style.css` to override its parchment tokens. |
| [js/reading.js](js/reading.js) | Shared boot script for `/history/` pages: renders `data/history/**/*.json` sections, and a state page's live place list from the existing `data/places/*.json`. |
| [history/](history/) | Long-form reading pages: `india.html`, `state.html` (one shared template for every state/UT, via `?s=<slug>`), `science.html` (a chronological, era-grouped timeline of scientific contributions), and (once written) `monuments/<id>.html`. Deliberately different look from the map app — see "The `/history/` section" below. |
| [data/history/](data/history/) | Narrative content for `/history/` pages: `india.json`, `regions.json` (the state/UT-page manifest), `states/<slug>.json` (one per state/UT), `science.json` (the timeline — a different shape, see below). Same rule as place data: sourced, structured, never hand-authored HTML. |

## Key conventions

- **No unsourced history.** Every place needs a non-empty `sources` array.
  `tools/check.mjs` fails the build without it. This is not negotiable.
- **Record uncertainty as data, not prose.** A place whose position is not
  confirmed sets `"coordsPrecision": "approximate"` and **must** supply a
  `coordsNote`. The map draws it with a dashed halo. Where the history is
  disputed, use the `contested` field — do not silently pick the tidier story.
- **Never remove the India boundary overlay.** `addBoundary()` in `js/map.js`
  draws `data/india-boundary.geojson` over the tiles. This is not decoration.
  OSM assigns Aksai Chin to China and Gilgit-Baltistan to Pakistan, and
  `openstreetmap-carto` renders no claim line at all, so at any zoom showing
  the north the tiles alone depict a border that does not match the Survey of
  India. Google solves this by serving a different rendering inside India; a
  static site cannot, so it draws one line — the Indian one — unconditionally.
  An earlier version instead clamped `BOUNDS` to 24°N to keep the border off
  screen. That was a workaround and it broke the moment places north of 24°N
  were added. Do not go back to it.
- **Never apply the sepia filter above `.leaflet-tile-pane`.** Filtering the map
  root would dim the attribution control, which breaches the OSM tile usage
  policy. `tools/check.mjs` guards this.
- **The OSM attribution string is mandatory** and must stay legible:
  `© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`.
- **Era is one value, chosen for the period a place is *significant for***, not
  its full occupation span. Beypore is a continuously working port and is filed
  under Late Medieval for its Zamorin-era trade role, with the continuity in
  prose and a `living-tradition` tag.
- **Eras are six, not five: Ancient, Early Medieval, Late Medieval (1200–1526),
  Early Modern (1526–1857), Late Modern (1857–1947), Contemporary.** The two
  new cutoffs are real historiographical markers, not arbitrary: 1526 is the
  First Battle of Panipat and the founding of the Mughal Empire; 1857 is the
  Rebellion, after which the Government of India Act 1858 transferred rule
  from the East India Company to the Crown — the actual line between Company
  presence and the Raj. A single "Colonial" bucket spanning 1498–1947 used to
  put the Taj Mahal, Red Fort and Raigad Fort (Mughal and Maratha work, no
  colonial power involved) in the same era as the Gateway of India. The tags
  (`mughal`, `maratha`, `british-raj`, `portuguese`, …) always carried the
  correct political story; the era label now doesn't contradict them.
  Kappad Beach's 1498 landing falls at the tail of Late Medieval (1200–1526),
  not the start of the next era — there is no more "hinge" date for eras to
  turn on. If you need to explain why the sea route to Europe opened in one
  era and formal colonization happened in a later one, that is what tags and
  the `description` prose are for, not the era boundary.
- **Categories vs eras vs tags**: category = what kind of place (drives the pin
  icon), era = when (second filter axis), tags = what story it belongs to
  (many per place). Filters combine as `category AND era AND (any tag)`.
- **A serial UNESCO property gets one pin, and must say so.** Sites such as the
  Hill Forts of Rajasthan, the Great Living Chola Temples, the Western Ghats and
  the Maratha Military Landscapes are spread over hundreds of kilometres. They
  are mapped as a single place with `"coordsPrecision": "approximate"` and a
  `coordsNote` naming which component the coordinate is and what it does not
  represent. The Mountain Railways of India are the exception: their three
  railways are in different states and are mapped separately.
- **For a natural site, era means its conservation history**, not the age of the
  landscape — a national park cannot be filed under a period of human history
  otherwise. Every natural place says so in its `contested` note.
- **Adding a region requires no code changes** — one JSON file under
  `data/places/`, one line in `data/regions.json`. Keep it that way.
- **`assets/india.svg` and `data/india-boundary.geojson` are both generated** —
  never hand-edit them. Run `make boundary`, which rebuilds both from DataMeet's
  CC-0 `india-composite.geojson`, re-inlines the SVG into `index.html`, and
  refuses to write anything if the claim line fails its point-in-polygon checks
  (Aksai Chin, Gilgit-Baltistan, Azad Kashmir and Shaksgam inside; Lhasa,
  Kathmandu and Colombo outside). Editing the inlined copy in `index.html`
  without editing the SVG is how they drifted apart once already.

## The `/history/` section

A second, deliberately different-looking part of the site: long-form narrative
reading (India → state → monument), not the map's pins-and-filters UI.

- **Not parchment.** The map app's whole identity is sepia/parchment/grain
  (see `css/style.css`'s own header comment). `/history/` pages are clean
  editorial — off-white background, high-contrast ink, no grain, no aged
  texture — because long-form reading and a museum-label map UI want opposite
  things. `css/reading.css` carries this; it overrides `style.css`'s paper/ink
  custom properties and disables the grain overlay, but keeps the shared shell
  classes (`.site-head`, `.site-foot`, `.eyebrow`, `.btn`) so the header/footer
  don't need reimplementing. Both stylesheets load on every `/history/` page,
  `reading.css` second so its overrides win. Give `<body>` the `reading` class,
  or the grain/paper-wash rules from `style.css` bleed back in.
- **Content is data, same rule as places: no unsourced history.**
  `data/history/india.json` and `data/history/states/<state>.json` are arrays
  of `{id, heading, body: [paragraph, ...], sources: [{title, url}]}` objects,
  rendered by `js/reading.js` — never hand-authored HTML. `tools/check.mjs`
  enforces the same non-empty-sources rule here as it does for places.
- **Routing**: `history/india.html` is the top-level narrative.
  `history/state.html` is a **single shared template for every state and union
  territory**, not one HTML file each — which one to show is chosen by
  `?s=<slug>` in the URL (e.g. `history/state.html?s=kerala`), resolved
  client-side in `js/reading.js` against the `data/history/regions.json`
  manifest. This was a deliberate change from an earlier one-file-per-state
  design: 35 near-identical HTML files was the wrong shape for content that
  only differs in its data. `history/monuments/` is reserved for monument
  pages (not built yet — may end up templated the same way). A region's place
  list is *not* duplicated data — it's a live filter over the existing
  `data/places/*.json` via `loadAll(base, {full:true})` (same function the map
  and About page already use), so a place added to a region on the map
  appears on its history page automatically.
- **The manifest is called `regions.json`, not `states.json`, and its field is
  `region`, not `state`.** A third of the entries (Delhi, Puducherry, Jammu
  and Kashmir, Ladakh, the Andaman and Nicobar Islands, Lakshadweep, Dadra and
  Nagar Haveli and Daman and Diu) are union territories, not states — calling
  the manifest and its field "state" was inaccurate for those entries and got
  fixed once flagged. This mirrors `data/regions.json` on the map side, which
  solved the identical problem the same way. The individual narrative files
  still live under `data/history/states/<slug>.json` (unrenamed — matches
  `data/places/` holding one file per region on the map side; only the
  manifest's own field name was the state/UT-conflating part).
- **Adding a region page requires no code and no new HTML file**: write
  `data/history/states/<slug>.json` (the narrative, same shape as
  `india.json`) and add one entry to `data/history/regions.json`:
  `{slug, region, lede}`. That manifest is how both `india.html`'s "States &
  union territories" list *and* `state.html?s=<slug>` find the page — an
  entry with no matching narrative JSON fails `make check`. `js/reading.js`,
  `css/reading.css` and `history/state.html` are shared and untouched.
- **Every region with sourced narrative content is linked — no exceptions.**
  Chandigarh was held back for one round (a purely 20th-century planned-city
  history didn't obviously fit a section otherwise framed around older
  dynastic/architectural history) but is now in the manifest like everything
  else: the site's history isn't only pre-colonial dynastic history, and a
  region with real, sourced content earns a page on that basis alone. If this
  question comes up again for a future region, resolve it the same way —
  write the sourced content, add the manifest entry, link it.
- **`history/science.html` is a different shape from every other `/history/`
  page**: a chronological, era-grouped timeline of scientific and
  technological contributions, not prose sections. `data/history/science.json`
  is an array of `{eraId, eraLabel, eraRange, entries: [{id, year, title,
  body, note?, sources}]}` — rendered by `renderTimeline()` in `js/reading.js`
  (a sibling function to `renderSections()`, not a replacement for it; every
  other page still uses the prose-section shape). The optional `note` field
  is for a caveat on a specific entry — an overstated popular claim, a
  disputed date, a citizenship/attribution nuance — rendered as a distinct
  callout box (`.timeline-note`), not folded into `body`. Many entries in this
  file needed real correction against the sources during research (wrong
  years, bundled-together events that were actually two separate ones, a
  "record" that had since been broken) — a science/space timeline drifts out
  of date and gets facts wrong easily; verify against a real source before
  adding or editing an entry, the same as everywhere else on this site.
- **`map.html`'s filters are shareable via URL** (`?cat=`, `?era=`, `?tag=`
  comma-separated, `?q=` for the search box), alongside the existing
  `?place=` deep link — `init()` seeds `state.filters` from the query string
  (dropping any id that doesn't match a real category/era/tag, so a stale or
  hand-edited link degrades to "no extra filter" instead of silently zeroing
  the result count) and `render()` keeps the address bar in sync via
  `syncFiltersToUrl()` on every filter change, "Clear all filters" included.
  Bump `map.js?v=` in `map.html` on any `js/map.js` edit — see the
  Cloudflare per-edge caching note below; the same caching issue applies
  to `js/map.js`. The index page's legend (`js/landing.js`) reuses this: each
  item is a link to `map.html?cat=<id>`, not just an illustrated key.
- **`about.html`'s coverage line is a generic count, not an enumerated
  list.** `js/about.js` sets `#states-line` to `"${states.length} states and
  regions"` — deliberately, not a hand-listed "Kerala, Karnataka, ... and
  Multi-state" — because an enumerated list duplicates the stat tile below it
  and reads worse as the count grows. Don't revert this to a name list.
- Every `/history/` page needs `data-base="../"` on `<body>` (both
  `india.html` and `state.html` sit one level under the repo root), so
  `reading.js` and `data.js` can resolve `data/...` fetch URLs correctly.

## Development notes

```bash
make            # list targets
make check      # data, icons, selectors, links, attribution, filters — no dependencies
make serve      # http://localhost:8111, serving source directly
make test       # browser checks (count shown in its own output); installs Playwright into .test-tools/ on first run
make test-live  # the same suites against the deployed site
make boundary   # regenerate India's outline from source and re-inline the hero
make stage      # build exactly what CI publishes, into _site/
```

CI runs `make check` and `make stage`, so a developer machine and the pipeline
cannot drift apart on what gets published.

- **A real HTTP server is required.** ES modules and `fetch` both fail over
  `file://`. Use `python3 -m http.server 8000`.
- `tools/check.mjs` runs in CI before staging, so bad data fails the pull request
  rather than the live site. It imports only Node built-ins — never add an npm
  dependency to it without a good reason.
- Leaflet is pinned with SRI hashes. If you bump the version, recompute them —
  a stale hash blocks the script silently.
- **The live site sits behind Cloudflare**, which caches every JS file for
  4 hours (`Cache-Control: max-age=14400`) independently per edge node —
  different visitors can get different cached versions of the same URL for up
  to 4 hours after a deploy. This showed up once as some readers getting a
  404 for a renamed data file that others had already stopped seeing. Every
  script tag that loads a top-level module is versioned for exactly this
  reason (`js/reading.js?v=3`, `js/landing.js?v=2`, `js/map.js?v=3`,
  `js/about.js?v=2` in `history/india.html`/`history/state.html`/
  `history/science.html`, `index.html`, `map.html`, `about.html`
  respectively) — **bump the `?v=N` on
  a file's own script tag whenever you edit that file**, which changes the
  cache key and forces every edge to fetch fresh instead of waiting out the
  TTL. This only covers the top-level files with a `<script src>` tag: a
  change to a file that's only reached via an internal `import` (`js/data.js`,
  `js/filters.js`, `js/icons.js`) has no version query to bump and will
  genuinely take up to 4 hours to reach every edge. If that's ever urgent,
  the real fix is purging Cloudflare's cache from its dashboard, which this
  repo has no access to do.

## Out of scope

- No backend, no database, no API. It is a static site and should stay one.
- No build step and no runtime dependencies. Minification was considered and
  deliberately deferred — the landing page is 21.5 kB gzipped as it stands.
- No analytics, no tracking, no cookies.
- No user accounts or user-submitted content.
- No tile provider requiring an API key. CARTO began enforcing keys in August
  2026 and serves a watermarked tile with an HTTP 200 to unkeyed callers —
  if a keyed provider is ever adopted, the key must be domain-restricted.
- No routing, directions, or "near me". This is a history atlas, not a trip planner.
