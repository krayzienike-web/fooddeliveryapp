"""Find Pexels photo candidates for each dish via Bing image search and build contact sheets.

Usage: python3 scripts/photos/search.py <workdir>
Reads dish ids + queries from src/mocks/seed/menu.ts (the `q:` field).
"""
import json, re, sys, time, urllib.parse, urllib.request, concurrent.futures as cf
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(sys.argv[1])
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
N = 8

def get(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def dishes():
    src = (ROOT / 'src/mocks/seed/menu.ts').read_text()
    out = []
    for m in re.finditer(r"^  d\('([^']+)', '([^']+)', '([^']+)'.*?q: '([^']+)'", src, re.M):
        out.append({'id': m.group(1), 'cat': m.group(2), 'name': m.group(3), 'q': m.group(4)})
    return out

def bing_ids(q):
    url = 'https://www.bing.com/images/search?' + urllib.parse.urlencode({'q': 'pexels ' + q, 'form': 'HDRSC2', 'first': 1})
    html = get(url).decode('utf-8', 'ignore')
    ids = []
    for m in re.finditer(r'images\.pexels\.com/photos/(\d+)', html):
        if m.group(1) not in ids:
            ids.append(m.group(1))
    return ids

def thumb(pid, dest):
    if dest.exists():
        return True
    try:
        data = get(f'https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=360')
        dest.write_bytes(data)
        return True
    except Exception:
        return False

def sheet(items, path):
    W, H, cols = 200, 200, N
    img = Image.new('RGB', (cols * W + 160, len(items) * (H + 4)), (20, 20, 20))
    d = ImageDraw.Draw(img)
    for r, it in enumerate(items):
        y = r * (H + 4)
        d.text((4, y + 4), it['id'], fill=(255, 255, 255))
        d.text((4, y + 20), it['name'][:22], fill=(200, 200, 200))
        for c, pid in enumerate(it['cands'][:cols]):
            p = WORK / 'thumbs' / f'{pid}.jpg'
            try:
                t = Image.open(p).convert('RGB')
                t.thumbnail((W, H))
                img.paste(t, (160 + c * W, y))
                d.text((160 + c * W + 4, y + 4), str(c), fill=(255, 255, 0))
            except Exception:
                pass
    img.save(path, quality=80)

def main():
    (WORK / 'thumbs').mkdir(parents=True, exist_ok=True)
    cache = WORK / 'cands.json'
    cands = json.loads(cache.read_text()) if cache.exists() else {}
    ds = dishes()
    only = set(sys.argv[2:])
    for it in ds:
        if only and it['id'] not in only:
            continue
        if it['id'] in cands and len(cands[it['id']]) >= 4 and not only:
            continue
        try:
            cands[it['id']] = bing_ids(it['q'])[:N]
        except Exception as e:
            print('bing fail', it['id'], e)
        time.sleep(0.7)
        cache.write_text(json.dumps(cands, indent=1))
    pids = {p for v in cands.values() for p in v}
    with cf.ThreadPoolExecutor(12) as ex:
        list(ex.map(lambda p: thumb(p, WORK / 'thumbs' / f'{p}.jpg'), pids))
    for it in ds:
        it['cands'] = cands.get(it['id'], [])
    (WORK / 'sheets').mkdir(exist_ok=True)
    for i in range(0, len(ds), 6):
        sheet(ds[i:i + 6], WORK / 'sheets' / f'sheet_{i // 6:02d}.jpg')
    print('dishes', len(ds), 'with cands', sum(1 for it in ds if len(it['cands']) >= 3))

main()
