// 液态渐变底：在 1/8 大小的离屏画布上逐像素算一层被扭曲过的正弦场，查色阶，再平滑放大到全屏，色带边缘自然融化；
// 上面叠一层随正弦慢慢扭动的白色细网格（每场主元素落地时局部鼓起一下）、角落的镀铬液滴、背景闪星、暗角。
// 移植自风格库的 Z-酸性镀铬（style.mjs 的背景）。改动：色阶从主题颜色算，按场轮换三套；网格鼓起改挂在每场第一个元素的入场时刻；
// 内容多的版式整体压暗、网格变淡，正文更好读。
import { clamp, mix, rgba } from '../../../core.mjs'
import { pal, star, blob } from './acid.mjs'

// 三套色阶：大部分落在深紫到粉，亮白和荧光绿只占窄带
function ramps(E) {
  return E.once('chrome:ramps', () => {
    const k = pal(E), W = '#ffffff'
    return [
      [[0, k.deep], [0.3, k.violet], [0.52, mix(k.violet, k.pink, 0.62)], [0.62, mix(k.pink, W, 0.25)], [0.68, mix(k.pink, W, 0.86)], [0.74, k.lime], [0.8, mix(k.violet, k.pink, 0.15)], [1, k.deep]],
      [[0, k.deep], [0.3, mix(k.deep, k.violet, 0.6)], [0.5, k.violet], [0.6, mix(k.lime, '#000000', 0.1)], [0.66, mix(k.lime, W, 0.72)], [0.72, k.pink], [0.82, k.violet], [1, k.deep]],
      [[0, k.deep], [0.35, k.violet], [0.55, mix(k.violet, k.pink, 0.45)], [0.65, k.pink], [0.71, mix(k.pink, W, 0.85)], [0.77, mix(k.violet, k.pink, 0.3)], [1, k.deep]],
    ]
  })
}
function lut(E, v) {
  return E.once('chrome:lut' + v, () => {
    const R = ramps(E)[v], out = new Uint8Array(256 * 3)
    for (let i = 0; i < 256; i++) {
      const p = i / 255
      let j = 0
      while (j + 1 < R.length - 1 && p > R[j + 1][0]) j++
      const [p0, c0] = R[j], [p1, c1] = R[j + 1], n = parseInt(mix(c0, c1, clamp((p - p0) / Math.max(1e-6, p1 - p0))).slice(1), 16)
      out[i * 3] = (n >> 16) & 255; out[i * 3 + 1] = (n >> 8) & 255; out[i * 3 + 2] = n & 255
    }
    return out
  })
}
function buf(E) {
  return E.once('chrome:buf', () => {
    const lw = Math.round(E.W / 8), lh = Math.round(E.H / 8), lo = E.createCanvas(lw, lh), img = lo.getContext('2d').createImageData(lw, lh)
    const vg = E.createCanvas(E.W, E.H), v = vg.getContext('2d'), ink = pal(E).ink
    const rg = v.createRadialGradient(E.W / 2, E.H * 0.45, Math.min(E.W, E.H) * 0.35, E.W / 2, E.H * 0.45, Math.max(E.W, E.H) * 0.78)
    rg.addColorStop(0, rgba(ink, 0)); rg.addColorStop(1, rgba(ink, 0.5))
    v.fillStyle = rg; v.fillRect(0, 0, E.W, E.H)
    return { lo, lw, lh, img, vg }
  })
}

function liquid(ctx, E, s) {
  const B = buf(E), d = B.img.data, L = lut(E, s.index % 3), { lw, lh } = B
  const sm = Math.min(lw, lh), tt = E.T * 0.55 + s.index * 3.7
  for (let y = 0; y < lh; y++) {
    const ny = y / sm * 2.4
    for (let x = 0; x < lw; x++) {
      const nx = x / sm * 2.4
      const q = Math.sin(nx * 1.3 + tt * 0.6) + Math.sin(ny * 1.7 - tt * 0.45 + 1.5 * Math.sin(nx * 0.9 + tt * 0.35))
      const wx = nx + 0.75 * Math.sin(ny * 1.1 + tt * 0.5 + q), wy = ny + 0.65 * Math.cos(nx * 1.3 - tt * 0.4 + q * 0.7)
      const v = Math.sin(wx * 1.5 + wy * 1.1 + tt * 0.7) * 0.6 + Math.sin(wx * 0.7 - wy * 1.6 - tt * 0.5) * 0.4
      const i8 = Math.max(0, Math.min(255, Math.round((v * 0.5 + 0.5) * 255))) * 3, o = (y * lw + x) * 4
      d[o] = L[i8]; d[o + 1] = L[i8 + 1]; d[o + 2] = L[i8 + 2]; d[o + 3] = 255
    }
  }
  B.lo.getContext('2d').putImageData(B.img, 0, 0)
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(B.lo, 0, 0, E.W, E.H); ctx.restore()
}

// 网格：正弦扭动；每场第一个元素落地时在内容区中心鼓起一下再回落
function grid(ctx, E, s, quiet) {
  const { W, H, u } = E, T = E.T, a = E.L.box
  const k0 = s.t - s.cue(0) - 0.15, bs = k0 > 0 ? (150 * Math.exp(-k0 * 3.2) * Math.min(1, k0 * 12) + 40 * Math.min(1, k0 * 4)) * u : 0
  const bx = a.x + a.w / 2, by = a.y + a.h / 2, R2 = Math.pow(Math.min(W, H) * 0.42, 2)
  const warp = (x, y) => {
    let dx = (22 * Math.sin(y / u * 0.0055 + T * 0.9) + 10 * Math.sin(y / u * 0.013 - T * 1.3)) * u, dy = 16 * u * Math.sin(x / u * 0.0048 - T * 0.7)
    if (bs) { const ddx = x - bx, ddy = y - by, d2 = ddx * ddx + ddy * ddy, f = bs * Math.exp(-d2 / R2) / Math.sqrt(d2 + 400 * u * u); dx += ddx * f; dy += ddy * f }
    return [x + dx, y + dy]
  }
  const step = E.pick(96, 90) * u, seg = 40 * u
  ctx.save(); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = rgba(pal(E).silver, quiet ? 0.1 : 0.2); ctx.beginPath()
  for (let x = -step; x <= W + step; x += step) for (let y = -seg, j = 0; y <= H + seg; y += seg, j++) { const [px, py] = warp(x, y); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
  for (let y = -step; y <= H + step; y += step) for (let x = -seg, j = 0; x <= W + seg; x += seg, j++) { const [px, py] = warp(x, y); j ? ctx.lineTo(px, py) : ctx.moveTo(px, py) }
  ctx.stroke(); ctx.restore()
}

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
function deco(ctx, E, s, quiet) {
  const { W, H, u } = E, T = E.T, si = s.index, k = pal(E)
  // 角落的镀铬液滴：只在画面外沿，不进内容区
  const spots = E.portrait ? [[0.03, 0.03, 34], [0.975, 0.975, 70], [0.97, 0.115, 36]] : [[0.02, 0.88, 76], [0.985, 0.12, 66], [0.03, 0.1, 34]]
  spots.forEach(([fx, fy, r], i) => blob(ctx, E, fx * W + 14 * u * Math.sin(T * 0.8 + i * 2), fy * H + 18 * u * Math.cos(T * 0.6 + i), r * u, T, i + si * 3))
  // 背景闪星：每场换一组位置；内容多的版式少放、放淡
  const n = quiet ? 5 : 9
  for (let i = 0; i < n; i++) {
    const x = hash(i * 13.1 + si * 7.7) * W, y = hash(i * 5.3 + si * 3.9 + 1) * H, ph = (T * 0.7 + hash(i * 2.2 + si)) % 1
    if (ph < 0.35) star(ctx, E, x, y, (10 + 16 * hash(i + si * 2)) * u * Math.sin(Math.PI * ph / 0.35), { rot: T * 0.5 + i, color: [k.lime, k.pink, k.cyan][i % 3], a: quiet ? 0.55 : 0.85 })
  }
}

export function background(ctx, E, s, quiet) {
  liquid(ctx, E, s)
  // 整体压暗一层，给镀铬字留对比；内容多的版式压得更暗
  ctx.fillStyle = rgba(pal(E).deep, quiet ? 0.5 : 0.22); ctx.fillRect(0, 0, E.W, E.H)
  grid(ctx, E, s, quiet)
  deco(ctx, E, s, quiet)
  ctx.drawImage(buf(E).vg, 0, 0)
}
