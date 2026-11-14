// 装饰面板里的东西，移植自风格库的 U-数据仪表盘：折线、小柱、转动的环、点阵、滚动日志带。
// 这里不画任何数字、刻度值、百分比、单位、日期、指标名，只有不带标注的线条和形状；
// 它们一直在缓慢变化（折线漂移、柱子起伏、环在转、点阵闪），所以大屏不会完全静止。
import { P, panel, polyline, dot, arc, ticks, pulse } from './dash.mjs'

const TAU = Math.PI * 2

function grid(ctx, E, r, n = 3) {
  const u = E.u
  ctx.save(); ctx.strokeStyle = P.grid; ctx.lineWidth = 1.2 * u; ctx.setLineDash([4 * u, 6 * u])
  for (let k = 1; k <= n; k++) { const y = r.y + r.h * k / (n + 1); ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke() }
  ctx.restore()
}

// 一条缓慢漂移的折线，末端的点在呼吸
function spark(ctx, E, r, lit, seed) {
  const u = E.u, T = E.T, n = 22
  grid(ctx, E, r)
  if (lit <= 0) return
  const pts = Array.from({ length: n }, (_, i) => ({ x: r.x + r.w * i / (n - 1), y: r.y + r.h * (0.52 - 0.32 * E.noise1(i * 0.26 + seed * 5.3 + T * 0.25, seed)) }))
  const col = E.mix(P.faint, P.calm, lit)
  const end = polyline(ctx, E, pts, E.ease.inOut(lit), col, { area: r.y + r.h, width: 2.4 })
  if (end && lit >= 1) dot(ctx, E, end.x, end.y, 4.5 * u, col, 0.3 + 0.7 * pulse(T, 1.2, seed * 0.2))
}

// 一排起伏的小柱，有一根轮流亮一点
function bars(ctx, E, r, lit, seed) {
  const T = E.T, n = 12, slot = r.w / n, bw = slot * 0.56, hot = Math.floor(T * 1.2 + seed) % n
  for (let i = 0; i < n; i++) {
    const x = r.x + slot * i + (slot - bw) / 2
    ctx.fillStyle = E.rgba(P.ghost, 0.5); ctx.fillRect(x, r.y + r.h * 0.86, bw, r.h * 0.14)
    const g = E.ease.out(E.clamp(lit * 1.6 - i * 0.05))
    if (g <= 0) continue
    const v = 0.28 + 0.62 * (0.5 + 0.5 * E.noise1(i * 0.8 + T * 0.45, seed + 3)), h = r.h * v * g
    ctx.fillStyle = i === hot ? P.calm : P.barN; ctx.fillRect(x, r.y + r.h - h, bw, h)
  }
}

// 转动的环：底环、一圈刻度（没有刻度值）、一段扫过的弧、里圈反向转
function ring(ctx, E, r, lit, seed) {
  const u = E.u, T = E.T, cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.min(r.w, r.h) * 0.34
  arc(ctx, E, cx, cy, R, 9 * u, 0, TAU, E.rgba(P.ghost, 0.8))
  ticks(ctx, E, cx, cy, R + 12 * u, 48, E.rgba(P.faint, 0.7), { rot: -T * 0.15, short: 4, long: 9 })
  if (lit <= 0) return
  const a0 = -Math.PI / 2 + T * 0.5 + seed, len = TAU * (0.3 + 0.08 * Math.sin(T * 0.7 + seed)) * E.ease.out(lit)
  arc(ctx, E, cx, cy, R, 9 * u, a0, a0 + len, P.calm, lit)
  const b0 = -T * 0.8 - seed
  arc(ctx, E, cx, cy, R * 0.64, 3 * u, b0, b0 + TAU * 0.22 * lit, E.rgba(P.calm, 0.7))
  arc(ctx, E, cx, cy, R * 0.64, 3 * u, b0 + Math.PI, b0 + Math.PI + TAU * 0.12 * lit, E.rgba(P.calm, 0.45))
  dot(ctx, E, cx, cy, 5 * u, P.calm, 0.3 + 0.7 * pulse(T, 0.9, seed))
}

// 点阵：每秒换三次，亮起一小部分格子
function matrix(ctx, E, r, lit, seed) {
  const u = E.u, g = 18 * u, cols = Math.max(1, Math.floor(r.w / g)), rows = Math.max(1, Math.floor(r.h / g))
  const ox = r.x + (r.w - (cols - 1) * g) / 2, oy = r.y + (r.h - (rows - 1) * g) / 2, tk = Math.floor(E.T * 3)
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const on = lit > 0 && E.hash(i * 31 + j * 7 + seed * 101, tk) < 0.2 * lit
    ctx.fillStyle = on ? P.calm : E.rgba(P.ghost, 0.8)
    const s = (on ? 6 : 4) * u
    ctx.fillRect(ox + i * g - s / 2, oy + j * g - s / 2, s, s)
  }
}

// 滚动日志带：占位块、状态点、长短条，整列缓慢上移，两端渐隐。没有字
export function logRows(ctx, E, r, lit, seed, o = {}) {
  const u = E.u, rh = (o.rh ?? 30) * u, off = E.T * (o.speed ?? 16) * u, i0 = Math.floor(off / rh) - 1
  const ga = ctx.globalAlpha
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip()
  for (let k = i0; k < i0 + Math.ceil(r.h / rh) + 3; k++) {
    const y = r.y + k * rh - off + rh / 2
    const fade = Math.min(E.clamp((y - r.y) / (rh * 1.5)), E.clamp((r.y + r.h - y) / (rh * 1.5)))
    if (fade <= 0) continue
    const h = E.hash(k, seed), hot = lit > 0 && E.hash(k, seed + 9) > 0.72
    ctx.globalAlpha = ga * fade * (o.alpha ?? 1)
    ctx.fillStyle = E.rgba(P.ghost, 0.9); ctx.fillRect(r.x, y - 4 * u, Math.min(64 * u, r.w * 0.18), 8 * u)
    const dx = r.x + Math.min(84 * u, r.w * 0.24)
    ctx.fillStyle = hot ? P.calm : P.faint; ctx.beginPath(); ctx.arc(dx, y, 4.5 * u, 0, TAU); ctx.fill()
    const bx = dx + 18 * u, bw = (r.x + r.w - bx) * (0.3 + 0.6 * h) * Math.max(0.35, lit)
    ctx.fillStyle = E.rgba(hot ? P.calm : P.dim, hot ? 0.45 : 0.22); ctx.fillRect(bx, y - 4 * u, bw, 8 * u)
  }
  ctx.restore()
}
const log = (ctx, E, r, lit, seed) => logRows(ctx, E, r, lit, seed)

const DECO = { spark, bars, ring, matrix, log }

// 一块装饰面板：p 出现（骨架），lit 点亮；点亮用 calm 色，强调色留给内容
export function decoPanel(ctx, E, r, kind, o = {}) {
  const u = E.u, p = o.p ?? 1, lit = o.lit ?? 0, head = r.h >= 150 * u ? 40 * u : 0
  panel(ctx, E, r, { p, lit, col: P.calm, head })
  if (p <= 0) return
  const pad = 16 * u, inner = { x: r.x + pad, y: r.y + head + pad * 0.8, w: r.w - 2 * pad, h: r.h - head - pad * 1.8 }
  ctx.save(); ctx.globalAlpha *= E.clamp(p * 1.8); DECO[kind](ctx, E, inner, lit, o.seed ?? 1); ctx.restore()
}
