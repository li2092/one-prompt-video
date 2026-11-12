// 几个自定义场景共用的小工具。全部只由传进来的时刻决定，不用随机数、不存状态。
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const outCubic = x => 1 - Math.pow(1 - clamp(x), 3)
export const inCubic = x => Math.pow(clamp(x), 3)
export const outBack = x => { const t = clamp(x) - 1, s = 1.9; return t * t * ((s + 1) * t + s) + 1 }
export const hash = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7 + 1.3) * 43758.5453; return x - Math.floor(x) }
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})` }

// 从 (cx, cy) 往外飞的星点。boost 越大拖尾越长。
export function stars(ctx, E, t, { cx, cy, n = 160, speed = 1, boost = 0, color = '#ffffff', alpha = 1 }) {
  const { W, H, u } = E, maxR = Math.hypot(W, H) * 0.6
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const a = hash(i) * Math.PI * 2, r = (hash(i, 1) + t * speed * (0.02 + 0.05 * hash(i, 2))) % 1
    const d = Math.pow(r, 1.7) * maxR, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
    const size = (0.8 + 2.6 * r * hash(i, 3)) * u, al = alpha * clamp(r * 3) * (0.35 + 0.65 * hash(i, 4))
    if (boost > 0.02) {
      const d0 = Math.max(0, d - boost * (40 + 260 * r) * u)
      ctx.strokeStyle = rgba(color, al); ctx.lineWidth = size * 1.2
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); ctx.lineTo(x, y); ctx.stroke()
    } else { ctx.fillStyle = rgba(color, al); ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill() }
  }
  ctx.restore()
}

export function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0))
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore()
}

export function pill(ctx, x, y, w, h) {
  const r = Math.min(h / 2, w / 2)
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2)
  ctx.lineTo(x + r, y + h); ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath()
}
