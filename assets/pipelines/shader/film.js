// 全屏着色器短片的最小工程：一个镜头，8 秒，太阳慢慢升起，镜头往前推。
// 管道在 gl.js（多次采样累加出抗锯齿和运动模糊、调色输出），场景在 scene.glsl。画面只由时刻决定。
import { createStage } from './gl.js'
const FPS = 30
window.DUR = 8
const lerp = (a, b, u) => a + (b - a) * u, D = Math.PI / 180
// 机位、注视点、太阳仰角都是时刻的函数。多个镜头时：每帧先定它属于哪个镜头，运动模糊的子采样不要跨镜头。
function camAt(t) {
  const u = Math.min(1, Math.max(0, t / window.DUR)), e = u * u * (3 - 2 * u)
  return { pos: [lerp(0, 1.2, e), lerp(2.6, 2.9, e), lerp(6, 2.5, e)], tgt: [0, 1.6, -8], fov: 42, p0: [lerp(1.5, 9, u) * D, 25 * D, 0, 0] }
}
try {
  const src = await (await fetch('./scene.glsl')).text()
  const stage = createStage(document.getElementById('c'), src, 1920, 1080)
  const spp = Number(new URLSearchParams(location.search).get('spp')) || 8     // 每帧采样数：试帧用 4，出片用 8 到 16
  window.renderAt = (t) => {
    t = Math.min(Math.max(Number(t) || 0, 0), window.DUR - 1e-6)
    const fade = Math.min(1, t / 0.8) * Math.min(1, (window.DUR - t) / 1.0)
    return stage.render({ time: t, frame: Math.round(t * FPS), spp, camAt, fps: FPS, shutter: 0.5, exposure: 1, fade })
  }
  window.renderAt(Number(new URLSearchParams(location.search).get('t')) || 0)
  window.ready = true
} catch (e) { window.fatal = String(e && e.message || e) }
