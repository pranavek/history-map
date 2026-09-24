# 📜 Historical Places of India

A static map of India's historical places — every pin typed by what kind of
place it is, filterable by era and theme, and required to cite its sources.
Covers every one of India's UNESCO World Heritage Sites, plus many more
places besides — run `make check` for the current count.

## Features

- **Parchment map** — Leaflet over OpenStreetMap tiles, aged in CSS. No API key.
- **Typed pins, three filter axes** — category, era and tags, combining as
  `category AND era AND (any tag)`. The legend *is* the category filter.
- **Deep links** — `map.html?place=<id>`, or a shareable filtered view via
  `?cat=`/`?era=`/`?tag=`/`?q=`.
- **Honest about gaps** — approximate positions get a dashed halo and say why;
  contested history is labelled contested, not smoothed over.
- **India drawn correctly** — the claim line (Lakshadweep, the Andamans
  included) is drawn by the site itself, not left to the basemap.
- Keyboard and screen-reader accessible, mobile-first, no analytics.

## Tech

Vanilla HTML/CSS/ES modules. No framework, no bundler, no build step, no
dependencies. Leaflet 1.9.4 from CDN with SRI. Data is static JSON. Deploys to
GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`.

## Development

```bash
make          # list every target
make serve    # http://localhost:8111
make check    # validate data, icons, selectors, links, attribution, filters
make test     # browser checks in headless Chromium (installs Playwright on first run)
```

A real HTTP server is required — ES modules and `fetch` both fail over `file://`.

## Contributing

Add an object to `data/places/<region>.json`; for a new region, add one line
to `data/regions.json`. No code changes needed. Every `category`, `era` and
`tag` must resolve against `data/`'s vocabularies, and every place needs at
least one source — `make check` enforces both. Full conventions:
[AGENTS.md](AGENTS.md).

## Licence

MIT — see [LICENSE](LICENSE). Map data ©
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. India
outline derived from [DataMeet](https://github.com/datameet/maps) (CC-0).
