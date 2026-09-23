#!/usr/bin/env python3
"""Regenerate India's outline from DataMeet's CC-0 composite.

Produces two artefacts from one source, at different resolutions:

  assets/india.svg            hero silhouette, inlined into index.html
  data/india-boundary.geojson claim-line overlay drawn on the Leaflet map

Both follow the Survey of India claim line: Aksai Chin, Gilgit-Baltistan,
Azad Kashmir and the Shaksgam Valley inside, Lakshadweep and the Andaman &
Nicobar Islands preserved rather than dropped. The script verifies that by
point-in-polygon before writing anything, and refuses to write if a check
fails — a silently wrong boundary is the one failure mode that matters here.

    python3 tools/build-boundary.py

After running, re-inline assets/india.svg into index.html (make boundary
does this for you).
"""
import json, math, sys, os, urllib.request

SRC = "https://raw.githubusercontent.com/datameet/maps/master/Country/india-composite.geojson"
CACHE = ".cache/india-composite.geojson"

# lon, lat, must-be-inside
CHECKS = [
    ("Aksai Chin",        79.40, 35.10, True),
    ("Gilgit-Baltistan",  74.30, 35.90, True),
    ("Azad Kashmir",      73.47, 34.36, True),
    ("Shaksgam Valley",   76.50, 35.90, True),
    ("Arunachal Pradesh", 93.60, 27.60, True),
    ("Kanyakumari",       77.54,  8.08, True),
    ("Port Blair",        92.74, 11.62, True),
    ("Kozhikode",         75.79, 11.25, True),
    ("Lhasa",             91.10, 29.65, False),
    ("Kathmandu",         85.32, 27.71, False),
    ("Colombo",           79.86,  6.93, False),
]


def fetch():
    if not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        print(f"  downloading {SRC}")
        urllib.request.urlretrieve(SRC, CACHE)
    return json.load(open(CACHE))["features"][0]["geometry"]["coordinates"]


def dp(pts, eps):
    """Douglas-Peucker, iterative — the mainland ring has 242k points and
    recursion blows the stack."""
    n = len(pts)
    if n < 3:
        return pts
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        x1, y1 = pts[a]
        x2, y2 = pts[b]
        dx, dy = x2 - x1, y2 - y1
        m = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = (abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / math.sqrt(m)
                 if m > 0 else math.hypot(x0 - x1, y0 - y1))
            if d > best:
                best, idx = d, i
        if best > eps and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def inside_ring(pt, ring):
    x, y = pt
    n, ins, j = len(ring), False, len(ring) - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-18) + xi:
            ins = not ins
        j = i
    return ins


def verify(polys, label):
    print(f"  verifying {label}")
    ok = True
    for name, lon, lat, want in CHECKS:
        got = any(inside_ring((lon, lat), p[0] if isinstance(p[0][0], list) else p)
                  for p in polys)
        if got != want:
            print(f"    FAIL  {name}: inside={got}, expected {want}")
            ok = False
    return ok


def main():
    polys = fetch()
    print(f"  source: {len(polys)} polygons, "
          f"{sum(len(p[0]) for p in polys)} points")

    if not verify([p for p in polys], "source data"):
        sys.exit("source data does not match the Indian claim line — aborting")

    # ── overlay: coarse. It is a reference line over live tiles, and every
    #    point is payload on every map view. ──
    out = []
    for p in polys:
        r = dp(p[0], 0.02)
        if len(r) >= 4:
            out.append([[[round(x, 4), round(y, 4)] for x, y in r]])
    if not verify(out, "simplified overlay"):
        sys.exit("simplification broke the claim line — aborting")
    gj = {"type": "Feature",
          "properties": {"name": "India (Survey of India claim line, approximated)"},
          "geometry": {"type": "MultiPolygon", "coordinates": out}}
    open("data/india-boundary.geojson", "w").write(json.dumps(gj, separators=(",", ":")))
    print(f"  wrote data/india-boundary.geojson  "
          f"{os.path.getsize('data/india-boundary.geojson'):,} bytes, "
          f"{sum(len(p[0]) for p in out)} points")

    # ── hero: finer, and projected. Equirectangular with a cos-latitude
    #    correction; Mercator would stretch Kashmir out of proportion on a
    #    country silhouette. ──
    LAT0 = math.radians(23.5)
    K = math.cos(LAT0)
    W, H, PAD = 680, 760, 18
    xs = [pt[0] for p in polys for pt in p[0]]
    ys = [pt[1] for p in polys for pt in p[0]]
    lo0, la0, lo1, la1 = min(xs), min(ys), max(xs), max(ys)
    S = min((W - 2 * PAD) / ((lo1 - lo0) * K), (H - 2 * PAD) / (la1 - la0))
    ox = PAD + ((W - 2 * PAD) - (lo1 - lo0) * K * S) / 2
    oy = PAD + ((H - 2 * PAD) - (la1 - la0) * S) / 2
    proj = lambda lon, lat: (ox + (lon - lo0) * K * S, oy + (la1 - lat) * S)

    def path(ring, eps):
        r = dp(ring, eps)
        if len(r) < 4:
            return None
        return "".join(f"{'M' if i == 0 else 'L'}{x:.1f} {y:.1f}"
                       for i, (x, y) in enumerate(proj(a, b) for a, b in r)) + "Z"

    main_path = path(polys[0][0], 0.012)
    isl, dots = [], []
    for p in polys[1:]:
        r = p[0]
        bx = [q[0] for q in r]
        by = [q[1] for q in r]
        if max((max(bx) - min(bx)) * K * S, (max(by) - min(by)) * S) >= 1.2:
            q = path(r, 0.004)
            if q:
                isl.append(q)
        else:
            dots.append(proj(sum(bx) / len(bx), sum(by) / len(by)))

    cx, cy = proj(75.7872, 11.2477)   # Calicut, where this started
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" '
           f'aria-label="Map of India, drawn to the Survey of India boundary">',
           '<g class="india-land">', f'<path d="{main_path}"/>']
    svg += [f'<path d="{q}"/>' for q in isl]
    svg.append('</g>')
    if dots:
        svg.append('<g class="india-isles">' + ''.join(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.1"/>' for x, y in dots) + '</g>')
    svg.append(f'<g class="india-pin"><circle cx="{cx:.1f}" cy="{cy:.1f}" r="5.5"/></g>')
    svg.append('</svg>')
    open("assets/india.svg", "w").write("\n".join(svg))
    print(f"  wrote assets/india.svg  {os.path.getsize('assets/india.svg'):,} bytes, "
          f"{main_path.count('L') + 1} mainland points, {len(isl)} islands, {len(dots)} dots")
    print("\n  assets/india.svg is inlined into index.html — re-inline it "
          "(`make boundary` does this).")


if __name__ == "__main__":
    main()
