// 等轴测基础：调色、相机与取景、长方体、贴面、深度排序、地面网格、接触阴影、扬尘、占位虚线、落位与镜头轻震。
// 移植自风格库的 D-等轴测机房（lib/iso.mjs）。改动：颜色从主题的八个颜色推出来；新加 fitCam（按屏幕矩形取景）和可读朝向的立面贴图。
// 世界坐标 x、y 在地面，z 向上，1 = 一格。相机绕目标点水平旋转（yaw），俯角 pitch。
import { mix, clamp, ease, roundRect, rgba, hexToRgb } from '../../../core.mjs'

const INK = '#1c1a2b'
export const lum = hex => { const [r, g, b] = hexToRgb(hex); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }
// 明暗：f < 1 压暗，f > 1 提亮（光照，和主题色无关）
export const shade = (hex, f) => (f >= 1 ? mix(hex, '#ffffff', Math.min(1, f - 1)) : mix(hex, INK, 1 - f))

// 调色板：机身、钢件、履带、浅紫这些都由主题的 c 推出来，用户用 colors 换色时整座机房跟着变
const PAL = new Map()
export function pal(c) {
  const key = Object.values(c).join()
  if (!PAL.has(key)) PAL.set(key, {
    ...c, body: mix(c.card, c.bg, 0.35), bodyTop: mix(c.card, c.bg, 0.08),
    steel: mix(c.bg, c.fg, 0.17), rail: mix(c.bg, c.fg, 0.38), slate: mix(c.bg, c.fg, 0.55),
    // dark 是屏幕、出口这类「黑」的东西：取 fg、bg 里暗的那个，深色主题也不会变成浅色
    belt: mix(c.fg, c.bg, 0.3), dark: mix(lum(c.fg) < lum(c.bg) ? c.fg : c.bg, c.accent, 0.14),
    violet: mix(c.accent, '#ffffff', 0.3), lilac: mix(c.accent, c.card, 0.86), lilac2: mix(c.accent, c.card, 0.6),
    scr: mix(c.accent, '#ffffff', 0.6), scr2: mix(c.accent, '#ffffff', 0.85),   // 暗屏幕上发光的字和日志行，永远是亮的
    red: '#e11d48',
  })
  return PAL.get(key)
}

// ---------- 相机 ----------
export function makeCam({ yaw = 45, pitch = 30, s = 100, cx = 0, cy = 0 } = {}) {
  const yr = yaw * Math.PI / 180, pr = pitch * Math.PI / 180
  return { cyw: Math.cos(yr), syw: Math.sin(yr), cp: Math.cos(pr), sp: Math.sin(pr), s, cx, cy }
}
// 世界点 → [屏幕 x, 屏幕 y, 深度]（深度越大越靠前）
export function P(c, x, y, z = 0) {
  const rx = x * c.cyw - y * c.syw, ry = x * c.syw + y * c.cyw
  return [c.cx + rx * c.s, c.cy + (ry * c.sp - z * c.cp) * c.s, ry * c.cp + z * c.sp]
}
// 屏幕点 → 高度 z 上的世界点 [x, y]（P 的反算）
export function unP(c, sx, sy, z = 0) {
  const rx = (sx - c.cx) / c.s, ry = ((sy - c.cy) / c.s + z * c.cp) / c.sp
  return [rx * c.cyw + ry * c.syw, -rx * c.syw + ry * c.cyw]
}
// 取景：让一组世界点投影后放进屏幕矩形 R。ax、ay 是放不满时靠哪边（0 左/上，0.5 居中，1 右/下）
export function fitCam(pts, R, { yaw = 45, pitch = 30, max = Infinity, ax = 0.5, ay = 0.5, dy = 0 } = {}) {
  const c = makeCam({ yaw, pitch, s: 1 })
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y, z] of pts) { const [sx, sy] = P(c, x, y, z); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy) }
  const s = Math.min(R.w / (x1 - x0), R.h / (y1 - y0), max)
  c.s = s; c.cx = R.x + (R.w - (x1 - x0) * s) * ax - x0 * s; c.cy = R.y + (R.h - (y1 - y0) * s) * ay - y0 * s + dy
  c.bw = (x1 - x0) * s; c.bh = (y1 - y0) * s; c.uw = x1 - x0; c.uh = y1 - y0   // 取景后占的屏幕宽高；s = 1 时的宽高
  return c
}

function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath() }

// ---------- 长方体 ----------
// b = { x, y（中心）, z（底面）, w（x 向）, d（y 向）, h, col, top?, alpha?, edge?, lw?, side?(nx, ny), onTop?(ctx, w, d) }
export function box(ctx, c, b) {
  const { x, y, z = 0, w, d, h, col } = b
  if (h <= 0.0005 || (b.alpha ?? 1) <= 0.002) return
  const x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2, z1 = z + h
  ctx.save()
  if (b.alpha != null) ctx.globalAlpha *= b.alpha
  ctx.lineJoin = 'round'
  const edge = b.edge === undefined ? rgba(INK, 0.16) : b.edge
  ctx.lineWidth = b.lw ?? Math.max(1, c.s * 0.012)
  for (const [nx, ny, ax, ay, bx, by] of [[1, 0, x1, y0, x1, y1], [-1, 0, x0, y1, x0, y0], [0, 1, x1, y1, x0, y1], [0, -1, x0, y0, x1, y0]]) {
    if (nx * c.syw + ny * c.cyw <= 1e-4) continue
    poly(ctx, [P(c, ax, ay, z), P(c, bx, by, z), P(c, bx, by, z1), P(c, ax, ay, z1)])
    ctx.fillStyle = b.side ? b.side(nx, ny) : shade(col, 0.86 - 0.11 * (nx * c.cyw - ny * c.syw))
    ctx.fill()
    if (edge) { ctx.strokeStyle = edge; ctx.stroke() }
  }
  poly(ctx, [P(c, x0, y0, z1), P(c, x1, y0, z1), P(c, x1, y1, z1), P(c, x0, y1, z1)])
  ctx.fillStyle = b.top ?? shade(col, 1.07); ctx.fill()
  if (edge) { ctx.strokeStyle = edge; ctx.stroke() }
  if (b.onTop) { ctx.save(); plane(ctx, c, x0, y0, z1); b.onTop(ctx, w, d); ctx.restore() }
  ctx.restore()
}

// 把局部 (u, v) 平面映射到世界。'xy' 地面或顶面；'xz' 朝 +y 的立面（u 沿 +x，v 向下）；'yz' 朝 +x 的立面（u 沿 -y，字是正的）
export function plane(ctx, c, ox, oy, oz, axis = 'xy') {
  const o = P(c, ox, oy, oz)
  const a = axis === 'yz' ? P(c, ox, oy - 1, oz) : P(c, ox + 1, oy, oz)
  const b = axis === 'xy' ? P(c, ox, oy + 1, oz) : P(c, ox, oy, oz - 1)
  ctx.transform(a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1])
}
// 立面上写字：局部 1 格 = 100 个字号单位，字号按 E.fit 的像素值写（贴到面上以后大约缩放 c.s / 100）
export function faceText(ctx, c, ox, oy, oz, axis, fn) { ctx.save(); plane(ctx, c, ox, oy, oz, axis); ctx.scale(0.01, 0.01); fn(ctx); ctx.restore() }

// ---------- 深度排序 ----------
export class World {
  constructor(ctx, cam) { this.ctx = ctx; this.c = cam; this.g = []; this.o = []; this.n = 0 }
  P(x, y, z = 0) { return P(this.c, x, y, z) }
  ground(f) { this.g.push({ i: this.n++, f }) }
  obj(x, y, z, f, bias = 0) { this.o.push({ d: P(this.c, x, y, z)[2] + bias, i: this.n++, f }) }
  box(b, bias = 0) { this.obj(b.x, b.y, (b.z || 0) + b.h / 2, () => box(this.ctx, this.c, b), bias) }
  flush() {
    const ctx = this.ctx
    for (const g of this.g) { ctx.save(); g.f(ctx, this.c); ctx.restore() }
    this.o.sort((a, b) => a.d - b.d || a.i - b.i)
    for (const o of this.o) { ctx.save(); o.f(ctx, this.c); ctx.restore() }
    this.g = []; this.o = []
  }
}

// ---------- 地面 ----------
// 世界网格，中心向外渐隐
export function floorGrid(ctx, c, k, { x = 0, y = 0, R = 9, a = 0.11 } = {}) {
  ctx.save()
  plane(ctx, c, x, y, 0)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R)
  g.addColorStop(0, rgba(k.fg, a)); g.addColorStop(0.6, rgba(k.fg, a * 0.6)); g.addColorStop(1, rgba(k.fg, 0))
  ctx.strokeStyle = g; ctx.lineWidth = 0.022
  ctx.beginPath()
  const n = Math.ceil(R)
  for (let i = -n; i <= n; i++) { ctx.moveTo(i, -R); ctx.lineTo(i, R); ctx.moveTo(-R, i); ctx.lineTo(R, i) }
  ctx.stroke()
  ctx.restore()
}
// 接触阴影：地面上一块柔和的暗区
export function contact(ctx, c, x, y, w, d, a = 0.1, z = 0) {
  if (a <= 0.002) return
  ctx.save(); plane(ctx, c, x, y, z); ctx.fillStyle = '#2b2f4a'
  for (let k = 0; k < 3; k++) { const g = 0.12 + k * 0.14; ctx.globalAlpha = a * (0.55 - k * 0.15); roundRect(ctx, -w / 2 - g, -d / 2 - g, w + 2 * g, d + 2 * g, 0.12 + g); ctx.fill() }
  ctx.restore()
}
// 落地扬尘：q 0→1，一圈强调色的环加八粒灰尘
export function dust(ctx, c, k, x, y, q, r0 = 0.8, z = 0) {
  if (q <= 0 || q >= 1) return
  ctx.save(); plane(ctx, c, x, y, z)
  const r = r0 * (1 + 0.9 * ease.out(q))
  ctx.globalAlpha = (1 - q) * 0.5; ctx.strokeStyle = k.accent; ctx.lineWidth = 0.05 * (1 - q) + 0.01
  ctx.beginPath(); ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = k.slate
  for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + 0.3, rr = r * (0.95 + 0.25 * q); ctx.beginPath(); ctx.arc(Math.cos(an) * rr, Math.sin(an) * rr, 0.06 * (1 - q), 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}
// 地面上的虚线占位框（还没落位的东西）
export function slot(ctx, c, k, x, y, w, d, a, { col = k.accent, z = 0.01, t = 0, axis = 'xy' } = {}) {
  if (a <= 0.002) return
  ctx.save(); plane(ctx, c, x - w / 2, axis === 'xy' ? y - d / 2 : y, z, axis); ctx.globalAlpha *= a
  roundRect(ctx, 0, 0, w, d, 0.12); ctx.fillStyle = rgba(col, 0.06); ctx.fill()
  ctx.setLineDash([0.22, 0.16]); ctx.lineDashOffset = -t * 0.5; ctx.lineWidth = 0.045; ctx.strokeStyle = rgba(col, 0.75); ctx.stroke()
  ctx.restore()
}
// 屏幕空间光晕
export function glow(ctx, x, y, r, col, a) {
  if (a <= 0.002) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, rgba(col, a)); g.addColorStop(0.45, rgba(col, a * 0.35)); g.addColorStop(1, rgba(col, 0))
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
}

// ---------- 动作 ----------
// 落位：dt 是开始落下后过了几秒。先加速落下，触地压扁回弹；返回 { a 透明度, z 离地高度, sq 压扁系数, q 扬尘进度 }
export const LAND = 0.31
export function fall(dt, H = 4, dur = 0.5) {
  const p = dt / dur
  if (p <= 0) return { a: 0, z: H, sq: 1, q: 0 }
  const pf = 0.62
  let z, sq = 1
  if (p < pf) z = H * (1 - Math.pow(p / pf, 2))
  else { const b = Math.min(1, (p - pf) / (1 - pf)); z = H * 0.05 * Math.sin(Math.PI * b) * (1 - b * 0.3); sq = 1 - 0.14 * Math.sin(Math.PI * Math.min(1, b * 2)) * (1 - b) }
  if (p >= 1) { z = 0; sq = 1 }
  return { a: clamp(p * 5), z, sq, q: clamp((dt - dur * pf) / 0.7) }
}
export const PRESENT = { a: 1, z: 0, sq: 1, q: 1 }
// 落地时镜头轻震（像素）：lands 是落地时刻
export function shake(t, lands, u, amp = 5) {
  let y = 0
  for (const l of lands) { const d = t - l; if (d >= 0 && d < 0.35) y += amp * u * Math.sin(d * 55) * Math.exp(-d * 12) }
  return y
}
