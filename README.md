# 📜 Historical Places of India

A static map of India's historical places — every pin typed by what kind of place
it is, filterable by era and theme, and required to cite its sources.

69 places across **20 states and regions**, including all 44 of India's UNESCO
World Heritage Sites — from the rock shelters of Bhimbetka to the Moidams of
Charaideo. It began with Calicut, where a Zamorin temple, a Yemeni shipowner's
mosque, a Parsi fire temple and a Jain temple sit within a few hundred metres of
each other.

## ✨ Features

- 🗺️ **Parchment map** — Leaflet over OpenStreetMap tiles, aged in CSS. No API key.
- 🛕 **Typed pins** — eighteen place categories, each with its own hand-drawn glyph and colour.
- 🏷️ **Three filter axes** — category, era and tags, combining as `category AND era AND (any tag)`.
- 📖 **Legend that filters** — the legend *is* the category control. One panel, two jobs.
- 🔗 **Deep links** — `map.html?place=thali-temple` opens straight to a place.
- ⚖️ **Honest about gaps** — approximate positions are drawn with a dashed halo and say why; contested history is labelled as contested.
- 🇮🇳 **India drawn correctly** — both the landing silhouette and a live overlay on the map follow the Indian claim line, including Lakshadweep and the Andamans.
- ♿ **Keyboard and screen-reader accessible**, mobile-first, no analytics in the source.

## 🛠️ Tech

Vanilla HTML, one stylesheet per surface, ES modules. No framework, no bundler,
no build step at all, no dependencies. Leaflet 1.9.4 from CDN with SRI. Data is
static JSON. Deploys to GitHub Pages.

## 📦 Development

```bash
make          # list every target
make serve    # http://localhost:8111
make check    # validate data, icons, selectors, links, attribution, filters
make test     # 67 browser checks in headless Chromium
```

The site itself has no dependencies and no build step — `make check` and
`make serve` need only python3 and node. `make test` drives a real browser and
installs Playwright on first run, into a gitignored directory; nothing from it
ships. A real HTTP server is required, since ES modules and `fetch` both fail
over `file://`.

## 🚀 Deployment

Pushes to `main` validate and deploy via `.github/workflows/deploy.yml`. Pull
requests validate but do not deploy. Set **Settings → Pages → Source**
to **GitHub Actions** once, on first setup.

## 🧭 Adding a place

Add an object to `data/places/<region>.json`; for a new region, add a line to
`data/regions.json`. No code changes needed. Every `category`, `era` and `tag`
must resolve against the vocabularies in `data/`, and every place must cite at
least one source — `node tools/check.mjs` enforces both.

See [AGENTS.md](AGENTS.md) for the full conventions.

## 📄 Licence

MIT — see [LICENSE](LICENSE).

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
India outline derived from [DataMeet](https://github.com/datameet/maps) (CC-0).
