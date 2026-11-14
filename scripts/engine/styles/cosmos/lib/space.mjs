// 宇宙星图的底和配色。移植自风格库的 Y-宇宙星图：深空斜向渐变、一条弯曲的星云带、三层按深度视差的星点、暗角和字幕带压暗。
// 改动：颜色从主题的八个颜色算（星体 accent、轨道 accent2、细线 line、附属小字 muted）；贴图都用 E.once 只算一次；
// 尺寸乘 E.u；原来按旁白登记的镜头关键帧改成每场开头一段推拉、之后慢漂。
import { clamp, lerp, ease } from '../../../core.mjs'

export const TAU = Math.PI * 2
const { sin, cos } = Math

export function mulberry(seed = 1) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// 配色：gold 只给恒星，cyan 只给轨道和卫星；violet 是星云和行星的第三色（装饰用，不随 colors 换）
export const pal = E => E.once('cosmos:pal', () => {
  const c = E.theme.c
  return {
    bg: c.bg, bg0: E.mix(c.bg, '#000000', 0.72), text: c.fg, dim: c.muted, faint: c.line, gold: c.accent, cyan: c.accent2,
    core: E.mix(c.accent, '#ffffff', 0.86), card: c.card, on: c.onAccent, violet: '#a98bff', white: '#ffffff',
  }
})

// 柔光贴图（某颜色的径向衰减），叠加模式画上去
function glowSprite(E, col) {
  return E.once('cosmos:glow' + col, () => {
    const N = 256, cv = E.createCanvas(N, N), c = cv.getContext('2d')
    const g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2)
    g.addColorStop(0, E.rgba(col, 1)); g.addColorStop(0.12, E.rgba(col, 0.55)); g.addColorStop(0.3, E.rgba(col, 0.2))
    g.addColorStop(0.6, E.rgba(col, 0.05)); g.addColorStop(1, E.rgba(col, 0))
    c.fillStyle = g; c.fillRect(0, 0, N, N)
    return cv
  })
}
export function glow(ctx, E, x, y, r, col, a = 1) {
  if (r <= 0 || a <= 0) return
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= Math.min(1, a)
  ctx.drawImage(glowSprite(E, col), x - r, y - r, r * 2, r * 2)
  ctx.restore()
}

function starData(E) {
  return E.once('cosmos:stars', () => {
    const r = mulberry(E.W * 13 + 7), F = Math.hypot(E.W, E.H) * 1.05
    const cols = ['#ffffff', '#dfe8ff', '#cfe0ff', '#fff1d6', '#ffe2b8', '#d9d0ff']
    const stars = []
    for (let i = 0; i < 950; i++) {
      const d = Math.pow(r(), 1.4)            // 深度：0 远 → 1 近
      stars.push({ x: (r() - 0.5) * F, y: (r() - 0.5) * F, d, sz: (0.9 + d * 2.0 + (r() < 0.05 ? 1.8 : 0)) * E.u, col: cols[Math.floor(r() * cols.length)], ph: r() * TAU, w: 0.6 + r() * 2.2, a: 0.5 + 0.5 * r() })
    }
    return { stars, F }
  })
}

// 星云：沿一条弯曲的带分布的色团（大团淡、小团浓），带中心一层细尘，再压几道暗尘条
function nebula(E) {
  return E.once('cosmos:neb', () => {
    const k = pal(E), N = 720, cv = E.createCanvas(N, N), c = cv.getContext('2d'), r = mulberry(4242)
    c.fillStyle = '#000'; c.fillRect(0, 0, N, N)
    c.globalCompositeOperation = 'lighter'
    const cols = ['#3b1a6e', E.mix('#0f3f63', k.cyan, 0.15), '#5c1650', E.mix('#0c5257', k.cyan, 0.15), '#24206a', E.mix('#6a2a3a', k.gold, 0.12), '#173a7a']
    const band = u => N * (0.5 + 0.2 * sin(u * 5.2 + 0.6))
    for (let i = 0; i < 46; i++) {
      const u = r(), bx = N * (0.02 + 0.96 * u), by = band(u) + (r() - 0.5) * N * 0.26
      const big = r() < 0.35, rad = N * (big ? 0.16 + 0.14 * r() : 0.04 + 0.07 * r()), col = cols[i % cols.length], kk = big ? 0.32 : 0.5
      const g = c.createRadialGradient(bx, by, 0, bx, by, rad)
      g.addColorStop(0, E.rgba(col, kk)); g.addColorStop(0.45, E.rgba(col, kk * 0.35)); g.addColorStop(1, E.rgba(col, 0))
      c.fillStyle = g; c.fillRect(0, 0, N, N)
    }
    for (let i = 0; i < 900; i++) {
      const u = r()
      c.fillStyle = E.rgba(r() < 0.5 ? '#9fb6ff' : '#ffd9b0', 0.12 + 0.2 * r())
      c.fillRect(N * u, band(u) + (r() + r() - 1) * N * 0.06, 1, 1)
    }
    c.globalCompositeOperation = 'source-over'
    for (let i = 0; i < 10; i++) {
      const u = 0.1 + 0.8 * r()
      c.save(); c.translate(N * u, band(u)); c.rotate(Math.atan(0.2 * 5.2 * cos(u * 5.2 + 0.6))); c.scale(3.2, 1)
      const rad = N * (0.02 + 0.03 * r()), g = c.createRadialGradient(0, 0, 0, 0, 0, rad)
      g.addColorStop(0, 'rgba(2,3,10,0.5)'); g.addColorStop(1, 'rgba(2,3,10,0)')
      c.fillStyle = g; c.fillRect(-rad, -rad, rad * 2, rad * 2); c.restore()
    }
    return cv
  })
}

// 暗角；有字幕时字幕带后面压暗一条（不是底框，只让星场在字幕后面暗一点）
function vignette(E) {
  return E.once('cosmos:vg', () => {
    const { W, H, u } = E, cv = E.createCanvas(W, H), c = cv.getContext('2d')
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)')
    c.fillStyle = g; c.fillRect(0, 0, W, H)
    if (E.captionH) {
      const sy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0), hh = E.captionH * 0.95
      const g2 = c.createLinearGradient(0, sy - hh, 0, sy + hh)
      g2.addColorStop(0, 'rgba(1,2,8,0)'); g2.addColorStop(0.5, 'rgba(1,2,8,0.55)'); g2.addColorStop(1, 'rgba(1,2,8,0)')
      c.fillStyle = g2; c.fillRect(0, sy - hh, W, hh * 2)
    }
    return cv
  })
}

// 镜头：每场开头从略推近、略转的位置回正（1.8 秒），之后每秒 0.4% 旋转、0.6% 推近的慢漂；单双场方向相反
export function cam(s) {
  const q = ease.inOut(clamp(s.t / 1.8)), d = s.index % 2 ? 1 : -1
  return { x: d * 70 * (1 - q), y: -30 * (1 - q), s: lerp(1.14, 1, q) * (1 + 0.006 * s.t), r: d * 0.05 * (1 - q) + 0.004 * s.t }
}
// 每场星云的方位和亮度不同
const NEB = [[0.3, 0.8], [1.4, 0.75], [2.6, 0.7], [-0.9, 0.8], [0.9, 0.75], [-2.1, 0.9], [3.3, 0.85]]

// 背景：底色 → 星云（深度 0.1 视差）→ 三层星点（按深度视差、缩放、旋转、闪烁）→ 暗角
export function space(ctx, E, c, index) {
  const { W, H, u } = E, T = E.T, k = pal(E), A = { x: W / 2, y: H / 2 }, [nebA, neb] = NEB[index % NEB.length], diag = Math.hypot(W, H)
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, k.bg); g.addColorStop(1, k.bg0)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = neb * 0.62
  ctx.translate(A.x, A.y); ctx.rotate(nebA + c.r * 0.5 + T * 0.004)
  const ns = 1 + (c.s - 1) * 0.15, S = diag * 1.6
  ctx.scale(ns, ns); ctx.translate(-c.x * 0.08 * u, -c.y * 0.08 * u)
  ctx.drawImage(nebula(E), -S / 2, -S / 2, S, S)
  ctx.restore()
  const { stars, F } = starData(E), half = diag / 2 + 8
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const st of stars) {
    const z = 1 + (c.s - 1) * (0.2 + 0.8 * st.d)
    const ox = (c.x * (0.15 + 0.6 * st.d) + T * (4 + 22 * st.d)) * u, oy = (c.y * (0.15 + 0.6 * st.d) + T * (1.5 + 6 * st.d)) * u
    const rr = c.r * (0.5 + 0.5 * st.d), cr = cos(rr), sr = sin(rr)
    const vx = ((st.x - ox) % F + F * 1.5) % F - F / 2, vy = ((st.y - oy) % F + F * 1.5) % F - F / 2
    const tw = 0.72 + 0.28 * sin(T * st.w + st.ph)
    for (let kx = -1; kx <= 1; kx++) for (let ky = -1; ky <= 1; ky++) {
      const X = (vx + kx * F) * z, Y = (vy + ky * F) * z
      if (X * X + Y * Y > half * half) continue
      const sx = A.x + X * cr - Y * sr, sy = A.y + X * sr + Y * cr
      if (sx < -10 || sy < -10 || sx > W + 10 || sy > H + 10) continue
      const sz = st.sz * Math.sqrt(z), a = st.a * tw * (0.55 + 0.45 * st.d)
      if (sz > 2.4 * u) {
        glow(ctx, E, sx, sy, sz * 5, st.col, a * 0.5)
        ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.arc(sx, sy, sz * 0.55, 0, TAU); ctx.fill()
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = st.col
        ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz)
      }
    }
  }
  ctx.restore()
  ctx.drawImage(vignette(E), 0, 0)
}
