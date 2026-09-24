"""Render one program clip to iso sprite frames with Blender (headless, Cycles CPU). Animation pilot, Phase 0.
    blender -b --python tools/anim/render_program.py -- job.json
job.json: {"glb": "...", "out": "dir", "clip": "walk", "frames": [1, 8, 15, ...] (source frame numbers, may be fractional),
           "facings": ["s","se","e","ne","n"], "res": 256, "samples": 24, "root": "none" | "linear" | "full",
           "cycle": [a, b] (for root "linear": the source range the loop spans)}
The camera is orthographic at 30 deg elevation (the game's 2:1 projection) and never moves: facings turn the
character, so light and scale are identical in every facing and clip. Root motion is removed as asked:
  linear - subtract the hips' average drift over one cycle (walk: the feet stay planted relative to the body);
  full   - pin the hips' ground position to the first frame (death: the body falls in place).
Emission is rebuilt from the texture's bright, saturated pixels (the cyan and amber seams).
The ground origin's pixel is written to <clip>.meta.json so the post step can lock the pivot."""
import bpy, sys, math, json, os
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
out = job['out']; os.makedirs(out, exist_ok=True)
res = job.get('res', 256); facings = job.get('facings', ['s', 'se', 'e', 'ne', 'n']); root_mode = job.get('root', 'none')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=job['glb'])
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for o in list(bpy.data.objects):   # Meshy adds a helper "Icosphere"; keep only skinned meshes
    if o.type == 'MESH' and not any(m.type == 'ARMATURE' for m in o.modifiers): bpy.data.objects.remove(o)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
root = bpy.data.objects.new('root', None); bpy.context.scene.collection.objects.link(root)
arm.parent = root
base_loc = arm.location.copy()
sc = bpy.context.scene
hips = arm.pose.bones['Hips']

def set_frame(t):
    sc.frame_set(int(math.floor(t)), subframe=t - math.floor(t))
def hips_xy(t):
    set_frame(t); p = arm.matrix_world @ hips.head; return Vector((p.x, p.y, 0))

frames = job['frames']
# ---- root-motion offsets, measured with the character unrotated
root.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
offsets = []
if root_mode == 'linear':
    a, b = job['cycle']; pa, pb = hips_xy(a), hips_xy(b)
    for t in frames: offsets.append(-(pb - pa) * ((t - a) / (b - a)) - Vector((pa.x, pa.y, 0)))
elif root_mode == 'full':
    for t in frames: offsets.append(-hips_xy(t))
else:
    p0 = hips_xy(frames[0]); offsets = [-p0 for _ in frames]    # centre on the first frame's hips
stride = None
if root_mode == 'linear':
    a, b = job['cycle']; stride = (hips_xy(b) - hips_xy(a)).length

# ---- materials: emissive seams from bright, saturated texels
for m in bpy.data.materials:
    if not m.use_nodes: continue
    nt = m.node_tree; bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    img = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image and 'base' in (n.label + n.image.name).lower()), None) \
        or next((n for n in nt.nodes if n.type == 'TEX_IMAGE'), None)
    if not bsdf or not img: continue
    hsv = nt.nodes.new('ShaderNodeSeparateColor'); hsv.mode = 'HSV'
    nt.links.new(img.outputs['Color'], hsv.inputs['Color'])
    s_ok = nt.nodes.new('ShaderNodeMath'); s_ok.operation = 'GREATER_THAN'; s_ok.inputs[1].default_value = 0.45
    v_ok = nt.nodes.new('ShaderNodeMath'); v_ok.operation = 'GREATER_THAN'; v_ok.inputs[1].default_value = 0.5
    nt.links.new(hsv.outputs[1], s_ok.inputs[0]); nt.links.new(hsv.outputs[2], v_ok.inputs[0])
    mask = nt.nodes.new('ShaderNodeMath'); mask.operation = 'MULTIPLY'
    nt.links.new(s_ok.outputs[0], mask.inputs[0]); nt.links.new(v_ok.outputs[0], mask.inputs[1])
    k = nt.nodes.new('ShaderNodeMath'); k.operation = 'MULTIPLY'; k.inputs[1].default_value = 2.2
    nt.links.new(mask.outputs[0], k.inputs[0])
    nt.links.new(img.outputs['Color'], bsdf.inputs['Emission Color'] if 'Emission Color' in bsdf.inputs else bsdf.inputs['Emission'])
    nt.links.new(k.outputs[0], bsdf.inputs['Emission Strength'])

# ---- light rig (plan, Art direction): warm key upper-left, cool cyan rim back-right, soft fill
def light(name, energy, color, rot):
    L = bpy.data.lights.new(name, 'SUN'); L.energy = energy; L.color = color
    o = bpy.data.objects.new(name, L); o.rotation_euler = [math.radians(v) for v in rot]; sc.collection.objects.link(o)
light('key', 3.2, (1.0, 0.86, 0.72), (50, 0, -35))
light('rim', 4.0, (0.35, 0.85, 1.0), (60, 0, 150))
light('fill', 0.8, (0.6, 0.7, 0.9), (70, 0, 70))
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.03, 0.05, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
sc.world = w

# ---- camera: fixed size for every clip so all frames share one scale (MODEL_M = frame height in metres)
MODEL_M = job.get('frameMetres', 2.9)
cam_d = bpy.data.cameras.new('cam'); cam_d.type = 'ORTHO'; cam_d.ortho_scale = MODEL_M
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
el = math.radians(30); dist = 20
target = Vector((0, 0, job.get('aimZ', 0.95)))
cam.location = target + Vector((0, -dist * math.cos(el), dist * math.sin(el)))
cam.rotation_euler = (math.radians(90) - el, 0, 0)

sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = job.get('samples', 24); sc.cycles.use_denoising = False
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = res; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.view_settings.view_transform = 'Standard'

# character forward is -Y; the camera sits on -Y, so yaw 0 = facing the viewer ("s", screen-down)
YAW = {'s': 0, 'se': 45, 'e': 90, 'ne': 135, 'n': 180, 'sw': -45, 'w': -90, 'nw': -135}
bpy.context.view_layer.update()
o = world_to_camera_view(sc, cam, Vector((0, 0, 0)))
meta = {'clip': job['clip'], 'frames': frames, 'res': res, 'facings': facings, 'groundPx': [o.x * res, (1 - o.y) * res],
        'metresPerPx': MODEL_M / res, 'root': root_mode, 'strideM': stride}
for f in facings:
    root.rotation_euler = (0, 0, math.radians(YAW[f]))
    for i, t in enumerate(frames):
        arm.location = base_loc + offsets[i]
        set_frame(t)
        sc.render.filepath = os.path.join(out, f"{job['clip']}_{f}_{i:02d}.png")
        bpy.ops.render.render(write_still=True)
json.dump(meta, open(os.path.join(out, f"{job['clip']}.meta.json"), 'w'), indent=1)
print('DONE', json.dumps(meta))
