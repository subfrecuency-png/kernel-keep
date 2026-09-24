"""Hand-keyed (procedural) Runner clips on the neutral rig — animation pilot, option C.
The six paid Meshy clips could not be recovered (see docs/ANIMATION_PILOT.md). The neutral A-pose rig that
tools/anim/neutralize_rig.py rebuilt from them is sound, so the Runner's clips are keyed here instead, from a few
readable poses per clip. Poses are written as joint rotations in the body frame (X = the Runner's left, -Y =
forward, Z = up) or as target directions for arm bones, and applied by forward kinematics.
    blender -b --python tools/anim/runner_procedural.py -- neutral.blend outdir
writes outdir/runner_<clip>.blend (one action each) + clips.json with frame lists for render_program.py."""
import bpy, sys, math, json, os
from mathutils import Vector, Matrix, Euler, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]; os.makedirs(out, exist_ok=True)

def D(deg): return math.radians(deg)
def rotx(a): return Euler((D(a), 0, 0)).to_matrix()
def E(x=0, y=0, z=0): return Euler((D(x), D(y), D(z)), 'XYZ').to_matrix()
def norm(*v): return Vector(v).normalized()
def lerp(a, b, t): return a + (b - a) * t
def slerpv(a, b, t):
    a, b = Vector(a).normalized(), Vector(b).normalized()
    q = a.rotation_difference(b); return (Quaternion().slerp(q, t) @ a).normalized()

# ---- poses -----------------------------------------------------------------------------------------------
# A pose: {'hips': (dx, dy, dz), 'rot': {bone: 3x3 in parent-delta frame}, 'dir': {bone: body-frame direction}}
CARRY = {  # the Runner's everyday stance: the data cube held low in the right hand, the tool/gun in the left
    'RightArm': norm(-0.30, -0.28, -0.91), 'RightForeArm': norm(-0.10, -0.86, -0.50), 'RightHand': norm(-0.05, -0.9, -0.43),
    'LeftArm': norm(0.30, -0.22, -0.93), 'LeftForeArm': norm(0.10, -0.90, -0.42), 'LeftHand': norm(0.06, -0.95, -0.3),
}
def pose(hips=(0, 0, 0), rot=None, dirs=None):
    d = dict(CARRY); d.update(dirs or {})
    return {'hips': Vector(hips), 'rot': rot or {}, 'dir': d}

def idle(i, n):
    p = math.sin(2 * math.pi * i / n)
    return pose((0, 0, -0.006 + 0.006 * p), {'Spine02': rotx(3 + 1.5 * p), 'neck': rotx(-2 * p), 'LeftUpLeg': rotx(-2), 'RightUpLeg': rotx(-2),
                                              'LeftLeg': rotx(4), 'RightLeg': rotx(4)},
                {'RightForeArm': norm(-0.10, -0.86, -0.50 + 0.03 * p), 'LeftForeArm': norm(0.10, -0.90, -0.42 + 0.03 * p)})

def walk(i, n):
    f = 2 * math.pi * i / n; s, c = math.sin(f), math.cos(f)
    tl, tr = -26 * s, 26 * s
    kl, kr = 8 + 42 * max(0.0, c), 8 + 42 * max(0.0, -c)
    return pose((0, 0, -0.035 * s * s), {
        'Hips': E(z=5 * s), 'Spine02': E(x=8, z=-8 * s), 'neck': rotx(-6),
        'LeftUpLeg': rotx(tl), 'LeftLeg': rotx(kl), 'LeftFoot': rotx(-0.5 * (tl + kl)),
        'RightUpLeg': rotx(tr), 'RightLeg': rotx(kr), 'RightFoot': rotx(-0.5 * (tr + kr)),
    }, {'RightForeArm': norm(-0.10, -0.86, -0.50 - 0.05 * c), 'LeftForeArm': norm(0.10, -0.90, -0.42 + 0.05 * c)})

def harvest(i, n):  # crouched at the well, pulling data up in a steady rhythm
    k = (1 - math.cos(2 * math.pi * i / n)) / 2          # 0 = reaching down, 1 = pulled up
    lean = lerp(38, 22, k); drop = lerp(-0.30, -0.22, k)
    return pose((0, 0.06, drop), {
        'Spine02': rotx(lean * 0.6), 'Spine': rotx(lean * 0.4), 'neck': rotx(-18),
        'LeftUpLeg': E(x=-68, y=-8), 'LeftLeg': rotx(96), 'LeftFoot': rotx(-28),
        'RightUpLeg': E(x=-60, y=8), 'RightLeg': rotx(88), 'RightFoot': rotx(-28),
    }, {'RightArm': slerpv((-0.15, -0.55, -0.82), (-0.25, -0.2, -0.95), k), 'RightForeArm': slerpv((-0.05, -0.55, -0.83), (-0.1, -0.75, -0.35), k),
        'RightHand': slerpv((0, -0.5, -0.86), (-0.05, -0.7, -0.3), k),
        'LeftArm': slerpv((0.15, -0.55, -0.82), (0.25, -0.2, -0.95), k), 'LeftForeArm': slerpv((0.05, -0.55, -0.83), (0.1, -0.75, -0.35), k),
        'LeftHand': slerpv((0, -0.5, -0.86), (0.05, -0.7, -0.3), k)})

BUILD_K = [0.55, 0.8, 0.97, 1.0, 0.0, 0.08, 0.25, 0.4]   # raise slowly, strike on frame 4, recover
def build(i, n):  # hammering with the tool arm
    k = BUILD_K[i % len(BUILD_K)]
    up, strike = (0.25, 0.15, 0.96), (0.15, -0.72, -0.68)
    return pose((0, 0, -0.05), {
        'Spine02': rotx(lerp(22, 2, k)), 'neck': rotx(-10),
        'LeftUpLeg': E(x=-18, y=-6), 'LeftLeg': rotx(26), 'LeftFoot': rotx(-8),
        'RightUpLeg': E(x=8, y=6), 'RightLeg': rotx(16), 'RightFoot': rotx(-12),
    }, {'LeftArm': slerpv(strike, up, k), 'LeftForeArm': slerpv((0.1, -0.95, -0.3), (0.1, 0.35, 0.93), k), 'LeftHand': slerpv((0.05, -0.9, -0.43), (0.05, 0.3, 0.95), k)})

ATTACK = [  # (tool-arm upper, fore, spine lean, hips forward) — fire (impact) on frame 4
    ((0.30, -0.22, -0.93), (0.10, -0.90, -0.42), 4, 0.0),
    ((0.35, 0.35, -0.87), (0.25, 0.60, -0.76), -4, 0.02),
    ((0.40, 0.65, -0.64), (0.30, 0.85, -0.43), -8, 0.03),
    ((0.30, -0.35, -0.89), (0.15, -0.85, -0.50), 6, -0.04),
    ((0.12, -0.98, 0.10), (0.06, -1.0, 0.05), 14, -0.10),
    ((0.22, -0.75, -0.62), (0.10, -0.92, -0.38), 8, -0.05),
]
def attack(i, n):
    a, f, lean, fwd = ATTACK[i]
    return pose((0, fwd, -0.03), {'Hips': E(z=-10 if i in (1, 2) else 8 if i == 4 else 0), 'Spine02': rotx(lean), 'neck': rotx(-lean * 0.5),
                                  'LeftUpLeg': rotx(-20), 'LeftLeg': rotx(22), 'RightUpLeg': rotx(14), 'RightLeg': rotx(14)},
                {'LeftArm': norm(*a), 'LeftForeArm': norm(*f), 'LeftHand': norm(*f)})

def death(i, n):  # hit, stagger, fall backwards, lie still
    t = i / (n - 1)
    fall = max(0.0, min(1.0, (t - 0.22) / 0.6)); fall = fall * fall * (3 - 2 * fall)
    jolt = 1.0 if i == 0 else 0.6 if i == 1 else 0.0
    return pose((0, 0.25 * fall, -0.72 * fall - 0.04 * min(1, t * 4)), {
        'Hips': rotx(-84 * fall), 'Spine02': rotx(-12 * jolt - 6 * fall), 'neck': rotx(-20 * jolt + 10 * fall),
        'LeftUpLeg': rotx(-30 * fall - 8 * jolt), 'LeftLeg': rotx(20 + 25 * (1 - fall)), 'RightUpLeg': rotx(-10 * fall), 'RightLeg': rotx(10 + 35 * (1 - fall)),
    }, {'RightArm': slerpv((-0.30, -0.28, -0.91), (-0.9, 0.1, 0.3), max(jolt, fall)), 'RightForeArm': slerpv((-0.10, -0.86, -0.5), (-0.95, 0.2, 0.2), max(jolt, fall)),
        'LeftArm': slerpv((0.30, -0.22, -0.93), (0.9, 0.2, 0.35), max(jolt, fall)), 'LeftForeArm': slerpv((0.10, -0.9, -0.42), (0.9, 0.35, 0.2), max(jolt, fall))})

CLIPS = {'idle': (idle, 8), 'walk': (walk, 8), 'harvest': (harvest, 8), 'build': (build, 8), 'attack': (attack, 6), 'death': (death, 10)}

# ---- rig ---------------------------------------------------------------------------------------------------
bpy.ops.wm.open_mainfile(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
bones = arm.data.bones
Rn = {b.name: b.matrix_local.to_3x3() for b in bones}
Hn = {b.name: b.head_local.copy() for b in bones}
order = []
def walk_tree(b): order.append(b.name); [walk_tree(c) for c in b.children]
for b in bones:
    if not b.parent: walk_tree(b)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)

def apply(p):
    Dm, pos = {}, {}
    body = Matrix.Identity(3)
    for n in order:
        b = bones[n]; par = b.parent.name if b.parent else None
        Dp = Dm[par] if par else Matrix.Identity(3)
        if n in p['dir']:
            cur = (Dp @ Rn[n]).col[1].normalized()
            want = (Dm.get('Hips', Matrix.Identity(3)) @ p['dir'][n]).normalized()
            Dm[n] = cur.rotation_difference(want).to_matrix() @ Dp
        else:
            Dm[n] = Dp @ p['rot'].get(n, Matrix.Identity(3))
        pos[n] = (pos[par] + Dp @ (Hn[n] - Hn[par])) if par else (Hn[n] + p['hips'])
        pb = arm.pose.bones[n]; M = (Dm[n] @ Rn[n]).to_4x4(); M.translation = pos[n]
        pb.matrix = M; bpy.context.view_layer.update()

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE')
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
meta = {}
for clip, (fn, n) in CLIPS.items():
    act = bpy.data.actions.new(f'runner|{clip}'); arm.animation_data_create(); arm.animation_data.action = act
    for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
    for i in range(n):
        apply(fn(i, n))
        for pb in arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=i + 1); pb.keyframe_insert('location', frame=i + 1)
    for fc in act.fcurves:
        for k in fc.keyframe_points: k.interpolation = 'CONSTANT'
    bpy.ops.object.mode_set(mode='OBJECT')
    for a in list(bpy.data.actions):
        if a is not act: a.use_fake_user = False
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f'runner_{clip}.blend'), copy=True)
    bpy.ops.object.mode_set(mode='POSE')
    meta[clip] = {'frames': list(range(1, n + 1))}
json.dump(meta, open(os.path.join(out, 'clips.json'), 'w'), indent=1)
print('KEYED', list(meta))
