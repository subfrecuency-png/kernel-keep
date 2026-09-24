"""Pack rendered program frames (from render_program.py) into one atlas per clip (animation pilot).
Each 256 px render is shifted so the ground point lands on the pivot, halved to a 128 px cell (pivot 64,112),
and packed row-major by facing (s, se, e, ne, n), 16 cells per row (2048 px).
    python3 tools/anim/pack_program.py <render_dir> <type> clip:frames:fps:loop[:fire] ...
e.g. runner idle:8:6:1 walk:8:10:1 attack:6:10:0:4"""
import json, os, sys
import numpy as np
from PIL import Image
src, typ, specs = sys.argv[1], sys.argv[2], sys.argv[3:]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'anim')
FACINGS = ['s', 'se', 'e', 'ne', 'n']; CELL = 128; PIV = (64, 112); COLS = 16
stand_h = None
for spec in specs:
    parts = spec.split(':'); clip, n, fps, loop = parts[0], int(parts[1]), int(parts[2]), parts[3] == '1'
    fire = int(parts[4]) if len(parts) > 4 else None
    meta = json.load(open(os.path.join(src, f'{clip}.meta.json')))
    gx, gy = meta['groundPx']; res = meta['res']
    cells = []; clipped = 0
    for f in FACINGS:
        for i in range(n):
            im = Image.open(os.path.join(src, f'{clip}_{f}_{i:02d}.png')).convert('RGBA')
            big = Image.new('RGBA', (CELL * 2, CELL * 2))
            big.paste(im, (round(PIV[0] * 2 - gx * 256 / res), round(PIV[1] * 2 - gy * 256 / res)), im)
            c = big.resize((CELL, CELL), Image.LANCZOS); a = np.array(c)[:, :, 3]
            clipped += int((a[0] > 16).sum() + (a[:, 0] > 16).sum() + (a[:, -1] > 16).sum())
            cells.append(c)
    if clip == 'idle':
        a = np.array(cells[0])[:, :, 3]; ys = np.where(a.max(axis=1) > 40)[0]; stand_h = int(PIV[1] - ys.min())
    rows = -(-len(cells) // COLS)
    atlas = Image.new('RGBA', (CELL * min(COLS, len(cells)), CELL * rows))
    for k, c in enumerate(cells): atlas.paste(c, ((k % COLS) * CELL, (k // COLS) * CELL))
    name = f'{typ}-{clip}'
    atlas.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=88, method=6, alpha_quality=92)
    js = {'type': typ, 'clip': clip, 'frames': n, 'fps': fps, 'loop': loop, 'cell': [CELL, CELL], 'cols': COLS,
          'facings': FACINGS, 'pivot': list(PIV)}
    if fire is not None: js['fire'] = fire
    json.dump(js, open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
    print(name, atlas.size, os.path.getsize(os.path.join(OUT, name + '.webp')), 'bytes; edge pixels', clipped)
if stand_h:
    print('standH', stand_h)
    for spec in specs:   # every clip of this program shares the idle's standing height
        p = os.path.join(OUT, f"{typ}-{spec.split(':')[0]}.json"); j = json.load(open(p)); j['standH'] = stand_h
        json.dump(j, open(p, 'w'), indent=1)
