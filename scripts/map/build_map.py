"""Render a branded dark map of central Saint Petersburg from OpenFreeMap vector tiles (© OpenStreetMap contributors).

Output: assets/map/spb-dark.webp (+ spb-light.webp) and src/shared/assets/mapMeta.ts with the projection params.
"""
import math, sys, json, urllib.request, concurrent.futures as cf
from pathlib import Path
import mapbox_vector_tile
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/zhar-map-cache')
CACHE.mkdir(parents=True, exist_ok=True)
S, W, N, E = 59.905, 30.24, 59.985, 30.42
TZ = 14            # source tile zoom
RZ = 15            # render zoom (256 px tiles)
SS = 2             # supersampling
TILEJSON = json.loads(urllib.request.urlopen(urllib.request.Request('https://tiles.openfreemap.org/planet', headers={'User-Agent': 'ZharDemo/1.0'}), timeout=30).read())
URL = TILEJSON['tiles'][0]

def lon2x(lon, z): return (lon + 180) / 360 * 256 * 2 ** z
def lat2y(lat, z):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 256 * 2 ** z

X0, Y0 = lon2x(W, RZ), lat2y(N, RZ)
X1, Y1 = lon2x(E, RZ), lat2y(S, RZ)
WPX, HPX = int(X1 - X0), int(Y1 - Y0)
tx0, tx1 = int(lon2x(W, TZ) // 256), int(lon2x(E, TZ) // 256)
ty0, ty1 = int(lat2y(N, TZ) // 256), int(lat2y(S, TZ) // 256)

def fetch(t):
    x, y = t
    p = CACHE / f'{TZ}_{x}_{y}.pbf'
    if not p.exists():
        req = urllib.request.Request(URL.format(z=TZ, x=x, y=y), headers={'User-Agent': 'ZharDemo/1.0'})
        p.write_bytes(urllib.request.urlopen(req, timeout=60).read())
    return t, mapbox_vector_tile.decode(p.read_bytes())

tiles = [(x, y) for x in range(tx0, tx1 + 1) for y in range(ty0, ty1 + 1)]
with cf.ThreadPoolExecutor(8) as ex:
    decoded = dict(ex.map(fetch, tiles))
print('tiles', len(tiles), 'image', WPX, HPX)

STYLES = {
  'dark':  dict(land=(23,17,14), water=(12,22,27), water_line=(14,28,34), park=(21,27,18), building=(31,24,20), road_minor=(40,31,26), road_major=(60,45,36), road_main=(78,57,44), rail=(40,34,30), label=(156,139,128)),
  'light': dict(land=(244,235,227), water=(196,219,228), water_line=(180,208,220), park=(214,228,203), building=(232,220,210), road_minor=(255,255,255), road_major=(252,228,212), road_main=(248,205,178), rail=(220,210,200), label=(128,105,93)),
}
ROAD_W = {'motorway': 9, 'trunk': 8, 'primary': 7, 'secondary': 6, 'tertiary': 4.5, 'minor': 3, 'service': 1.8, 'path': 1.2, 'track': 1.2, 'pedestrian': 2.5}

def to_px(tx, ty, ext, gx, gy):
    # tile-local (gx, gy) with y up in MVT (mapbox_vector_tile flips by default -> y up)
    scale = 2 ** (RZ - TZ) * 256 / ext
    px = (tx * 256 * 2 ** (RZ - TZ) + gx * scale - X0) * SS
    py = (ty * 256 * 2 ** (RZ - TZ) + (ext - gy) * scale - Y0) * SS
    return (px, py)

def rings(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'Polygon': return [c]
    if t == 'MultiPolygon': return c
    return []

def lines(geom):
    t, c = geom['type'], geom['coordinates']
    if t == 'LineString': return [c]
    if t == 'MultiLineString': return c
    if t == 'Polygon': return c
    if t == 'MultiPolygon': return [r for p in c for r in p]
    return []

def render(style):
    st = STYLES[style]
    img = Image.new('RGB', (WPX * SS, HPX * SS), st['land'])
    d = ImageDraw.Draw(img)
    def polys(layer, color, filt=lambda p: True):
        for (tx, ty), data in decoded.items():
            L = data.get(layer)
            if not L: continue
            ext = L['extent']
            for f in L['features']:
                if not filt(f['properties']): continue
                for poly in rings(f['geometry']):
                    for i, ring in enumerate(poly):
                        pts = [to_px(tx, ty, ext, x, y) for x, y in ring]
                        if len(pts) > 2:
                            d.polygon(pts, fill=color if i == 0 else st['land'])
    def strokes(layer, colorfn, widthfn, filt=lambda p: True):
        for (tx, ty), data in decoded.items():
            L = data.get(layer)
            if not L: continue
            ext = L['extent']
            for f in L['features']:
                p = f['properties']
                if not filt(p): continue
                w = widthfn(p)
                if not w: continue
                for ln in lines(f['geometry']):
                    pts = [to_px(tx, ty, ext, x, y) for x, y in ln]
                    if len(pts) > 1:
                        d.line(pts, fill=colorfn(p), width=max(1, int(w * SS)), joint='curve')
    polys('landcover', st['park'], lambda p: p.get('class') in ('grass', 'wood', 'farmland'))
    polys('park', st['park'])
    polys('landuse', st['park'], lambda p: p.get('class') in ('cemetery', 'pitch', 'stadium'))
    polys('water', st['water'])
    strokes('waterway', lambda p: st['water'], lambda p: 6 if p.get('class') == 'river' else 3)
    polys('building', st['building'])
    def rcolor(p):
        c = p.get('class')
        if c in ('motorway', 'trunk', 'primary'): return st['road_main']
        if c in ('secondary', 'tertiary'): return st['road_major']
        if c in ('rail', 'transit'): return st['rail']
        return st['road_minor']
    def rwidth(p):
        c = p.get('class')
        if p.get('brunnel') == 'tunnel': return 0
        if c in ('rail', 'transit'): return 1.2
        return ROAD_W.get(c, 0)
    strokes('transportation', rcolor, rwidth)
    img = img.filter(ImageFilter.GaussianBlur(0.4)).resize((WPX, HPX), Image.LANCZOS)
    out = ROOT / 'assets' / 'map'; out.mkdir(parents=True, exist_ok=True)
    img.save(out / f'spb-{style}.webp', 'WEBP', quality=78, method=6)

for s in ('dark', 'light'):
    render(s)

meta = f"""// Generated by scripts/map/build_map.py. Map data © OpenStreetMap contributors (OpenFreeMap).
export const MAP_META = {{
  bounds: {{ south: {S}, west: {W}, north: {N}, east: {E} }},
  zoom: {RZ},
  width: {WPX},
  height: {HPX},
  originX: {X0},
  originY: {Y0},
}} as const;

export const MAP_IMAGES = {{
  dark: require('../../../assets/map/spb-dark.webp'),
  light: require('../../../assets/map/spb-light.webp'),
}};
"""
(ROOT / 'src' / 'shared' / 'assets' / 'mapMeta.ts').write_text(meta)
print('done')
