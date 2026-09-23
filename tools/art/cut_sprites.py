"""Cut in-game sprites out of the Master v0.2 concept sheets (original PNGs in assets/art/concept/).
Steps per cell: crop the cell (labels excluded) -> rembg (isnet-general-use) alpha matte -> drop the floor
reflection below the model's feet -> trim -> scale -> team variants (P1 as-is, P2 red-shifted: blue/cyan hues
moved to crimson, amber kept) -> WebP with alpha in assets/art/sprites/. Also writes sprites.json with each
sprite's size and anchor (the ground contact point, in pixels) used by the renderer.
Usage: python3 tools/art/cut_sprites.py"""
import json, os, sys
import numpy as np
from PIL import Image
from rembg import remove, new_session

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets/art/concept'); OUT = os.path.join(ROOT, 'assets/art/sprites')
os.makedirs(OUT, exist_ok=True)
session = new_session('isnet-general-use')

ROLES = {  # (x0, y0, x1, y1) in kernel-six-roles.png
  'runner': (10, 92, 510, 478), 'ping': (517, 102, 1016, 478), 'bulwark': (1023, 92, 1526, 478),
  'lancer': (10, 533, 510, 946), 'patcher': (517, 533, 1016, 946), 'breaker': (1023, 533, 1526, 946),
}
STRUCT = {  # kernel-ten-structures.png
  'core': (12, 114, 312, 472), 'cache': (322, 114, 612, 472), 'compiler': (624, 114, 914, 472),
  'rig': (926, 114, 1216, 472), 'node': (1228, 114, 1526, 472),
  'bank': (12, 530, 284, 900), 'grid': (294, 530, 612, 900), 'wall': (624, 530, 914, 900),
  'gate': (926, 530, 1242, 900), 'tower': (1254, 530, 1526, 900),
}
UNIT_H, BLD_W = 220, 400   # output resolution: unit height px, building width px

def matte(img):
    a = np.array(remove(img, session=session, post_process_mask=True))
    return a  # RGBA uint8

def trim(a, pad=2):
    ys, xs = np.where(a[:, :, 3] > 24)
    y0, y1, x0, x1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1), max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)
    return a[y0:y1, x0:x1]

def cut_reflection(a):
    # Studio floors reflect the model; keep rows down to the lowest row with substantial, bright-enough coverage
    # and fade the alpha of anything below that (reflections are dim and thin).
    al = a[:, :, 3].astype(float) / 255; lum = a[:, :, :3].astype(float).mean(axis=2)
    cover = (al * (lum > 18)).sum(axis=1)
    rows = np.where(cover > max(4, cover.max() * 0.06))[0]
    foot = rows.max() if len(rows) else a.shape[0] - 1
    a = a.copy(); a[foot + 1:, :, 3] = 0
    return a

def redshift(a):
    """P2 variant: move blue/cyan hues (glows, seams) to crimson; keep amber, greys and whites."""
    rgb = a[:, :, :3].astype(float) / 255
    mx, mn = rgb.max(axis=2), rgb.min(axis=2); d = mx - mn + 1e-9
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, d / (mx + 1e-9), 0); v = mx
    blue = (h >= 165) & (h <= 275) & (s > 0.18)
    h2 = np.where(blue, 348.0, h)
    s2 = np.where(blue, np.minimum(1, s * 1.05), s)
    c = v * s2; hp = (h2 / 60) % 6; x = c * (1 - np.abs(hp % 2 - 1)); m = v - c
    z = np.zeros_like(c)
    conds = [(hp < 1), (hp < 2), (hp < 3), (hp < 4), (hp < 5), (hp >= 5)]
    rr = np.select(conds, [c, x, z, z, x, c]); gg = np.select(conds, [x, c, c, x, z, z]); bb = np.select(conds, [z, z, x, c, c, x])
    out = a.copy(); out[:, :, 0] = np.clip((rr + m) * 255, 0, 255); out[:, :, 1] = np.clip((gg + m) * 255, 0, 255); out[:, :, 2] = np.clip((bb + m) * 255, 0, 255)
    return out

meta = {}
def emit(name, a, kind):
    img = Image.fromarray(a, 'RGBA')
    if kind == 'unit': img = img.resize((round(img.width * UNIT_H / img.height), UNIT_H), Image.LANCZOS)
    else: img = img.resize((BLD_W, round(img.height * BLD_W / img.width)), Image.LANCZOS)
    arr = np.array(img)
    # anchor = horizontal centre of the lowest 8% of opaque pixels, at the bottom edge
    ys, xs = np.where(arr[:, :, 3] > 60)
    low = ys >= ys.max() - max(2, int(arr.shape[0] * 0.08))
    ax = float(xs[low].mean()); ay = float(ys.max())
    for team, data in (('p1', arr), ('p2', redshift(arr))):
        Image.fromarray(data, 'RGBA').save(os.path.join(OUT, f'{name}-{team}.webp'), 'WEBP', quality=86, method=6, alpha_quality=90)
    meta[name] = {'kind': kind, 'w': arr.shape[1], 'h': arr.shape[0], 'ax': round(ax, 1), 'ay': round(ay, 1)}
    print(name, arr.shape[1], arr.shape[0], 'anchor', round(ax), round(ay))

roles = Image.open(os.path.join(SRC, 'kernel-six-roles.png')).convert('RGB')
for k, box in ROLES.items(): emit(k, trim(cut_reflection(matte(roles.crop(box)))), 'unit')
st = Image.open(os.path.join(SRC, 'kernel-ten-structures.png')).convert('RGB')
for k, box in STRUCT.items(): emit(k, trim(matte(st.crop(box))), 'building')
json.dump(meta, open(os.path.join(OUT, 'sprites.json'), 'w'), indent=1)
