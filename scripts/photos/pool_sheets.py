"""Download thumbnails for a TSV pool of Pexels ids and render numbered contact sheets."""
import sys, urllib.request, concurrent.futures as cf
from pathlib import Path
from PIL import Image, ImageDraw
WORK = Path(sys.argv[1]); POOL = WORK / 'pool.tsv'
UA = 'Mozilla/5.0'
rows = []
seen = set()
for line in POOL.read_text().splitlines():
    if not line.strip(): continue
    pid, title = line.split('\t', 1)
    if pid in seen: continue
    seen.add(pid); rows.append((pid, title))
(WORK / 'thumbs').mkdir(exist_ok=True)
def dl(pid):
    p = WORK / 'thumbs' / f'{pid}.jpg'
    if p.exists() and p.stat().st_size > 1000: return
    try:
        req = urllib.request.Request(f'https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=360', headers={'User-Agent': UA})
        p.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    except Exception as e:
        print('fail', pid, e)
with cf.ThreadPoolExecutor(16) as ex: list(ex.map(dl, [r[0] for r in rows]))
(WORK / 'psheets').mkdir(exist_ok=True)
C, S = 6, 230
per = 30
for si in range(0, len(rows), per):
    chunk = rows[si:si+per]
    img = Image.new('RGB', (C*S, ((len(chunk)+C-1)//C)*(S+24)), (16,16,16))
    d = ImageDraw.Draw(img)
    for i, (pid, title) in enumerate(chunk):
        x, y = (i % C)*S, (i//C)*(S+24)
        try:
            t = Image.open(WORK/'thumbs'/f'{pid}.jpg').convert('RGB'); t.thumbnail((S-6, S-6)); img.paste(t, (x+3, y+3))
        except Exception: pass
        d.rectangle([x+3, y+S-2, x+S-3, y+S+22], fill=(0,0,0))
        d.text((x+6, y+S), f'{pid} {title[:26]}', fill=(255,230,0))
    img.save(WORK/'psheets'/f'p{si//per:02d}.jpg', quality=82)
print(len(rows))
