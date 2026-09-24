"""Structure loop from an image-to-video clip (animation pilot, see the Animation plan doc).
Steps: sample N frames evenly over the whole clip (the clip was generated with start frame = end frame, so the
sampled cycle loops), matte each frame with rembg, lock the base plate to frame 0 by phase correlation
(sub-pixel shifts are measured on the lower third, where the footprint is), trim to a common box, scale to the
shipped width and pack a grid atlas (at most 2048 px wide) plus JSON.
Usage: python3 tools/anim/structure_loop.py <video.mp4> <type> <clip> <frames> <fps> <shipped_width>"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from rembg import remove, new_session

video, typ, clip, N, fps, width = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'anim'); os.makedirs(OUT, exist_ok=True)
tmp = tempfile.mkdtemp()
subprocess.run(['ffmpeg', '-v', 'error', '-i', video, os.path.join(tmp, 'f%04d.png')], check=True)
files = sorted(os.listdir(tmp)); total = len(files)
idx = [round(i * (total - 1) / N) for i in range(N)]  # N samples over the cycle; frame N would equal frame 0
sess = new_session('isnet-general-use')
frames = [np.array(remove(Image.open(os.path.join(tmp, files[i])).convert('RGB'), session=sess, post_process_mask=True)).astype(np.float32) for i in idx]

def shift_of(a, b):
    """Phase correlation between the alpha of the lower third (the base plate)."""
    h = a.shape[0]; A = a[int(h * 0.6):, :, 3]; Bm = b[int(h * 0.6):, :, 3]
    F = np.fft.fft2(A) * np.conj(np.fft.fft2(Bm)); r = np.fft.ifft2(F / (np.abs(F) + 1e-9)).real
    y, x = np.unravel_index(np.argmax(r), r.shape)
    if y > A.shape[0] // 2: y -= A.shape[0]
    if x > A.shape[1] // 2: x -= A.shape[1]
    return int(y), int(x)

shifts = [(0, 0)] + [shift_of(frames[0], f) for f in frames[1:]]
locked = [np.roll(np.roll(f, dy, axis=0), dx, axis=1) for f, (dy, dx) in zip(frames, shifts)]
alpha = np.max([f[:, :, 3] for f in locked], axis=0)
ys, xs = np.where(alpha > 24); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
cells = [Image.fromarray(np.clip(f[y0:y1, x0:x1], 0, 255).astype(np.uint8), 'RGBA') for f in locked]
h = round(cells[0].height * width / cells[0].width)
cells = [c.resize((width, h), Image.LANCZOS) for c in cells]
cols = max(1, 2048 // width); rows = -(-N // cols)  # grid atlas, at most 2048 px wide
atlas = Image.new('RGBA', (width * cols, h * rows)); [atlas.paste(c, ((i % cols) * width, (i // cols) * h)) for i, c in enumerate(cells)]
name = f'{typ}-{clip}'
atlas.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=84, method=6, alpha_quality=88)
meta = {'type': typ, 'clip': clip, 'frames': N, 'fps': fps, 'loop': True, 'cell': [width, h], 'cols': cols,
        'maxBaseShiftPx': max(max(abs(a), abs(b)) for a, b in shifts), 'source': os.path.basename(video)}
json.dump(meta, open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
print(json.dumps(meta), 'bytes', os.path.getsize(os.path.join(OUT, name + '.webp')))
