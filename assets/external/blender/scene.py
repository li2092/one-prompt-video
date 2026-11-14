"""Blender 最小工程：用脚本搭一个场景、排一段镜头运动、逐帧渲成 PNG。
在 Blender 里跑（不开界面）：

    blender -b -P scene.py -- --out frames --stills 0,2,4          先出几张静帧看
    blender -b -P scene.py -- --out frames --samples 64            出全片的帧

参数：--out 输出目录；--seconds 全片秒数（默认 5）；--fps（默认 24）；--width（默认 1280，高按 16:9）；
--samples 每像素采样数（默认 16，试帧够用，出片 64 起）；--stills 只渲这几个时刻（秒）；--from/--to 只渲这一段帧号。
场景只由帧号决定：同一个帧号两次渲出来一样，可以分段渲、断了续渲。
"""
import math
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default, cast=str):
    return cast(argv[argv.index(name) + 1]) if name in argv else default


OUT = os.path.abspath(arg("--out", "frames"))
SECONDS, FPS = arg("--seconds", 5.0, float), arg("--fps", 24, int)
WIDTH, SAMPLES = arg("--width", 1280, int), arg("--samples", 16, int)
FRAMES = int(round(SECONDS * FPS))

# ── 清空 ──
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = WIDTH, int(WIDTH * 9 / 16)
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, FRAMES - 1
scene.render.image_settings.file_format = "PNG"
scene.render.use_motion_blur = True


def material(name, color, rough=0.6, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


def add(obj, mat):
    obj.data.materials.append(mat)
    return obj


STONE = material("stone", (0.74, 0.72, 0.68), 0.75)
FLOOR = material("floor", (0.10, 0.11, 0.13), 0.18)
GOLD = material("gold", (0.95, 0.66, 0.25), 0.3, 1.0)
GLOW = material("glow", (1.0, 0.78, 0.45), 0.4, 0.0, 2.5)

# ── 场景：反光的地面、三层台基、一圈柱子、中间一个发光的球 ──
bpy.ops.mesh.primitive_plane_add(size=120)
add(bpy.context.object, FLOOR)
for i, (r, h) in enumerate([(6.0, 0.5), (4.6, 0.5), (3.2, 0.5)]):
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=r, depth=h, location=(0, 0, h / 2 + i * 0.5))
    add(bpy.context.object, STONE)
for k in range(12):
    a = k / 12 * math.tau
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.32, depth=5.0, location=(math.cos(a) * 5.2, math.sin(a) * 5.2, 3.0))
    add(bpy.context.object, STONE)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(math.cos(a) * 5.2, math.sin(a) * 5.2, 5.65))
    cap = add(bpy.context.object, GOLD)
    cap.scale = (0.9, 0.9, 0.3)
    cap.rotation_euler[2] = a
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1.1, location=(0, 0, 3.2))
ball = add(bpy.context.object, GLOW)
bpy.ops.object.shade_smooth()
# 球慢慢上下浮动：位置直接写成帧号的函数，打在关键帧上
for f in range(0, FRAMES + 1, 6):
    ball.location.z = 3.2 + 0.25 * math.sin(f / FPS * 1.6)
    ball.keyframe_insert("location", frame=f)

# ── 光：低角度的太阳加一点天光 ──
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(68), 0, math.radians(125)))
sun = bpy.context.object
sun.data.energy, sun.data.angle, sun.data.color = 4.0, math.radians(3), (1.0, 0.86, 0.72)
world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.20, 0.30, 0.50, 1)
bg.inputs["Strength"].default_value = 0.6

# ── 镜头：绕着场景转四分之一圈，同时慢慢升高、推近；一直对着中间的球 ──
bpy.ops.object.empty_add(location=(0, 0, 3.0))
target = bpy.context.object
bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 32
cam.data.dof.use_dof, cam.data.dof.focus_object, cam.data.dof.aperture_fstop = True, target, 2.8
track = cam.constraints.new("TRACK_TO")
track.target, track.track_axis, track.up_axis = target, "TRACK_NEGATIVE_Z", "UP_Y"
for f in range(0, FRAMES + 1, 4):
    p = f / max(1, FRAMES - 1)
    e = p * p * (3 - 2 * p)                       # 缓入缓出
    a, r, z = math.radians(-70 + 90 * e), 19 - 5 * e, 2.2 + 3.0 * e
    cam.location = (math.cos(a) * r, math.sin(a) * r, z)
    cam.keyframe_insert("location", frame=f)

# ── 渲染 ──
os.makedirs(OUT, exist_ok=True)
if "--stills" in argv:
    todo = [int(round(float(t) * FPS)) for t in arg("--stills", "0").split(",")]
else:
    todo = range(arg("--from", 0, int), arg("--to", FRAMES - 1, int) + 1)
for f in todo:
    path = os.path.join(OUT, f"f{f:05d}.png")
    if os.path.exists(path) and "--stills" not in argv:
        continue                                   # 已经渲过的跳过，断了可以续
    scene.frame_set(f)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("渲好", path, flush=True)
