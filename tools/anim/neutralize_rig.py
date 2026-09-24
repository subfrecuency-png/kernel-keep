"""Salvage a Meshy rig that was auto-fitted to an ACTION pose (animation pilot, option C).
Meshy's catalog clips are local rotations relative to the rig's rest pose, so a mesh rigged mid-stride keeps
that stride in every clip. This script rebuilds a neutral rest pose, then bakes the mesh into it:
  1. each bone's rest orientation is swung (minimal rotation) onto a canonical direction (T or A pose);
  2. bone heads are re-chained by forward kinematics so parent-relative offsets are kept;
  3. the armature is posed into that skeleton, the mesh deformation is applied, and the pose becomes the rest.
The clip's rotation keys are left untouched, so they now play around the neutral pose.
    blender -b --python tools/anim/neutralize_rig.py -- in.glb out.blend [T|A] [fixRightLeg 0|1]"""
import bpy, sys, math
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]; mode = argv[2] if len(argv) > 2 else 'A'; fix_leg = len(argv) > 3 and argv[3] == '1'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for o in list(bpy.data.objects):
    if o.type == 'MESH' and not any(m.type == 'ARMATURE' for m in o.modifiers): bpy.data.objects.remove(o)
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')

# canonical directions in armature space (Z up, character faces -Y, its left is +X)
UP, DOWN, FWD = Vector((0, 0, 1)), Vector((0, 0, -1)), Vector((0, -1, 0))
arm_l = Vector((1, 0, 0)) if mode == 'T' else Vector((0.62, 0, -0.78)).normalized()   # A pose ≈ 50° down
arm_r = Vector((-arm_l.x, 0, arm_l.z))
foot = Vector((0, -0.45, -0.89)).normalized()
CANON = {
  'Hips': UP, 'Spine02': UP, 'Spine01': UP, 'Spine': UP, 'neck': UP, 'Head': UP, 'head_end': UP, 'headfront': FWD,
  'LeftUpLeg': DOWN, 'LeftLeg': DOWN, 'LeftFoot': foot, 'LeftToeBase': FWD,
  'RightUpLeg': DOWN, 'RightLeg': DOWN, 'RightFoot': foot, 'RightToeBase': FWD,
  'LeftShoulder': Vector((1, 0, 0)), 'LeftArm': arm_l, 'LeftForeArm': arm_l, 'LeftHand': arm_l,
  'RightShoulder': Vector((-1, 0, 0)), 'RightArm': arm_r, 'RightForeArm': arm_r, 'RightHand': arm_r,
}
bones = arm.data.bones
order = []
def walk(b):
    order.append(b.name); [walk(c) for c in b.children]
for b in bones:
    if not b.parent: walk(b)

# rest matrices (armature space) and the target neutral matrices
R = {b.name: b.matrix_local.to_3x3() for b in bones}
H = {b.name: b.head_local.copy() for b in bones}
L = {b.name: b.length for b in bones}
if fix_leg:
    # the auto-rig put the right knee 9 cm under the hip; take the leg's proportions from the left side
    tot = L['RightUpLeg'] + L['RightLeg']; lt = L['LeftUpLeg'] + L['LeftLeg']
    L['RightUpLeg'], L['RightLeg'] = tot * L['LeftUpLeg'] / lt, tot * L['LeftLeg'] / lt
Rn, Hn = {}, {}
for n in order:
    b = bones[n]; y = R[n].col[1].normalized(); d = CANON.get(n, y)
    S = y.rotation_difference(d).to_matrix()
    Rn[n] = S @ R[n]
    if b.parent:
        p = b.parent.name
        off = H[n] - H[p]
        Hn[n] = Hn[p] + (Rn[p] @ R[p].inverted()) @ off
    else:
        Hn[n] = H[n].copy()

# sample the clip on the ORIGINAL rig: armature-space rotation of every bone, and the hips position, per frame.
# Meshy retargets with the rest offset carried along (world_pose = canonical_anim · canonical_rest⁻¹ · rig_rest),
# so on the neutral rig the matching pose is  W_new = W_orig · R⁻¹ · Rn  (the swing moved into each bone's frame).
act0 = arm.animation_data.action if arm.animation_data else None
samples = []
if act0:
    f0, f1 = int(math.ceil(act0.frame_range[0])), int(act0.frame_range[1])
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        samples.append((f, {pb.name: pb.matrix.to_3x3().copy() for pb in arm.pose.bones}, arm.pose.bones['Hips'].head.copy()))

# pose the armature into the neutral skeleton (world-space targets, parents first)
bpy.context.view_layer.objects.active = arm
arm.animation_data_clear() if False else None
act = arm.animation_data.action if arm.animation_data else None
if arm.animation_data: arm.animation_data.action = None
bpy.ops.object.mode_set(mode='POSE')
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'; pb.matrix_basis = Matrix.Identity(4)
for n in order:
    pb = arm.pose.bones[n]
    M = Rn[n].to_4x4(); M.translation = Hn[n]
    pb.matrix = M
    if fix_leg and n in ('RightUpLeg', 'RightLeg'):
        pb.scale = (1, L[n] / bones[n].length, 1)   # stretch/compress along the bone so the knee lands mid-leg
    bpy.context.view_layer.update()
bpy.ops.object.mode_set(mode='OBJECT')

# bake the mesh into this pose, then make the pose the new rest
bpy.context.view_layer.objects.active = mesh
mod = next(m for m in mesh.modifiers if m.type == 'ARMATURE')
name = mod.name
bpy.ops.object.modifier_apply(modifier=name)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT'); bpy.ops.pose.armature_apply(selected=False)
for pb in arm.pose.bones: pb.matrix_basis = Matrix.Identity(4)
bpy.ops.object.mode_set(mode='OBJECT')
m2 = mesh.modifiers.new('Armature', 'ARMATURE'); m2.object = arm
# bake the clip onto the neutral rig
if samples:
    newact = bpy.data.actions.new((act0.name if act0 else 'clip') + '|neutral')
    arm.animation_data_create(); arm.animation_data.action = newact
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='POSE')
    for f, W, hips in samples:
        bpy.context.scene.frame_set(f)
        pos = {}
        for n in order:
            pb = arm.pose.bones[n]; b = bones[n]
            rot = W[n] @ R[n].inverted() @ Rn[n]
            if b.parent:
                p = b.parent.name; prot = W[p] @ R[p].inverted() @ Rn[p]
                head = pos[p] + prot @ Rn[p].inverted() @ (Hn[n] - Hn[p])
            else:
                head = hips
            pos[n] = head
            M = rot.to_4x4(); M.translation = head
            pb.matrix = M
            bpy.context.view_layer.update()
            pb.keyframe_insert('rotation_quaternion', frame=f)
            if not b.use_connect: pb.keyframe_insert('location', frame=f)
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=dst)
print('NEUTRAL', mode, 'fixLeg', fix_leg, 'saved', dst)
