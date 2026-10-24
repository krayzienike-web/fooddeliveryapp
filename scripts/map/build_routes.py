"""Precompute courier routes (OSRM demo server) restaurant -> known address. Output: src/mocks/seed/routes.json"""
import json, re, time, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def pts(path, rx):
    src = (ROOT / path).read_text()
    return {m.group(1): (float(m.group(2)), float(m.group(3))) for m in re.finditer(rx, src, re.S)}
rest = pts('src/mocks/seed/restaurants.ts', r"id: '(r-[a-z-]+)'.*?point: \{ lat: ([\d.]+), lng: ([\d.]+) \}")
addr = pts('src/mocks/seed/geo.ts', r"id: '(a-[a-z0-9-]+)'.*?point: \{ lat: ([\d.]+), lng: ([\d.]+) \}")
out = {}
for rid, (rlat, rlng) in rest.items():
    for aid, (alat, alng) in addr.items():
        url = f'https://router.project-osrm.org/route/v1/driving/{rlng},{rlat};{alng},{alat}?overview=full&geometries=geojson'
        for i in range(4):
            try:
                j = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'ZharDemo/1.0'}), timeout=30).read())
                coords = j['routes'][0]['geometry']['coordinates']
                # thin to <= 60 points, round to 5 decimals
                step = max(1, len(coords) // 60)
                thin = coords[::step]
                if thin[-1] != coords[-1]: thin.append(coords[-1])
                out[f'{rid}|{aid}'] = [[round(c[1], 5), round(c[0], 5)] for c in thin]
                break
            except Exception as e:
                time.sleep(1.5 * (i + 1))
        time.sleep(0.25)
(ROOT / 'src/mocks/seed/routes.json').write_text(json.dumps(out, separators=(',', ':')))
print(len(rest), len(addr), len(out))
