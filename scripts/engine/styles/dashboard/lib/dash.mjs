// 数据大屏的部件，移植自风格库的 U-数据仪表盘（lib/dash.mjs）：面板、四角括号、胶囊、折线、圆点、仪表弧、冲击环、勾。
// 颜色由 setPal 从风格包的 this.c 推出来；发光一律用半透明的粗描边或径向渐变，不用 shadowBlur。
// 全部是时刻的纯函数，不跨帧累积。

const TAU = Math.PI * 2

// 调色板：每个入口（bg、版式、字幕、最上层、转场）先调 setPal(E, this.c)，下面的画法都从 P 取色
export const P = {}
const PALS = new Map()
export function setPal(E, c) {
  const key = [c.bg, c.fg, c.muted, c.accent, c.accent2, c.card, c.line, c.onAccent].join()
  let k = PALS.get(key)
  if (!k) {
    const m = E.mix
    k = {
      bg: c.bg, bg1: m(c.bg, c.card, 0.5), panel: c.card, panel2: m(c.card, c.fg, 0.035), line: c.line, grid: m(c.line, c.bg, 0.2),
      text: c.fg, dim: c.muted, faint: m(c.muted, c.bg, 0.42), ghost: m(c.line, c.muted, 0.18),
      acc: c.accent, acc2: c.accent2, on: c.onAccent,
      calm: m(c.muted, c.fg, 0.2),          // 点亮了、但不是当前那一块
      barN: m(c.muted, c.card, 0.38),       // 普通柱子
    }
    PALS.set(key, k)
  }
  Object.assign(P, k)
}

// 字号（乘 E.u）：刻度 / 小标题 / 正文 / 标签 / 场标题
export const SZ = { small: 20, title: 26, body: 34, label: 40, head: 46 }

export function txt(ctx, s, x, y, font, color, align = 'left', base = 'middle') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base
  ctx.fillText(s, x, y)
}
export const tw = (ctx, s, font) => { ctx.font = font; return ctx.measureText(s).width }
export const pulse = (T, hz = 1, ph = 0) => 0.5 + 0.5 * Math.sin((T * hz + ph) * TAU)

// 骨架条：还没点亮的字、数的位置先放一根灰条
export function ghostBar(ctx, E, x, y, w, h, a = 1) {
  if (a <= 0 || w <= 0) return
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = E.rgba(P.ghost, 0.7)
  E.roundRect(ctx, x, y, w, h, h / 2); ctx.fill(); ctx.restore()
}

// 四角括号：glow 时先画一道半透明粗线当光晕
export function brackets(ctx, E, x, y, w, h, o = {}) {
  const u = E.u, L = o.L ?? 18 * u, k = o.k ?? 3 * u, col = o.col ?? P.acc
  if (L <= 0) return
  const path = () => {
    ctx.beginPath()
    ctx.moveTo(x - k, y - k + L); ctx.lineTo(x - k, y - k); ctx.lineTo(x - k + L, y - k)
    ctx.moveTo(x + w + k - L, y - k); ctx.lineTo(x + w + k, y - k); ctx.lineTo(x + w + k, y - k + L)
    ctx.moveTo(x + w + k, y + h + k - L); ctx.lineTo(x + w + k, y + h + k); ctx.lineTo(x + w + k - L, y + h + k)
    ctx.moveTo(x - k + L, y + h + k); ctx.lineTo(x - k, y + h + k); ctx.lineTo(x - k, y + h + k - L)
  }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (o.glow > 0) { ctx.strokeStyle = E.rgba(col, 0.18 * o.glow); ctx.lineWidth = (o.w ?? 2.6) * 3.4 * u; path(); ctx.stroke() }
  ctx.strokeStyle = E.rgba(col, o.a ?? 1); ctx.lineWidth = (o.w ?? 2.6) * u; path(); ctx.stroke()
  ctx.restore()
}

// 面板：p 出现进度，lit 点亮程度，col 点亮的颜色（当前那一块用强调色，其余用 calm）。
// head 是标题栏高（0 为没有），titleF 是 E.fit 排好的标题，没有标题时标题栏放一根骨架条；dash 为虚线占位
export function panel(ctx, E, r, o = {}) {
  const u = E.u, p = o.p ?? 1, lit = o.lit ?? 0, col = o.col ?? P.acc, head = o.head ?? 0
  if (p <= 0) return
  ctx.save()
  ctx.globalAlpha *= E.clamp(p * 1.8)
  const rad = 8 * u
  if (o.dash) {
    ctx.fillStyle = E.rgba(P.panel, 0.5); E.roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill()
    ctx.setLineDash([10 * u, 8 * u]); ctx.strokeStyle = E.rgba(P.faint, 0.8); ctx.lineWidth = 1.6 * u
    E.roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, rad); ctx.stroke(); ctx.setLineDash([])
    ctx.restore(); return
  }
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
  g.addColorStop(0, P.panel2); g.addColorStop(1, P.panel)
  ctx.fillStyle = g; E.roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill()
  if (lit > 0) {
    const gl = ctx.createLinearGradient(0, r.y, 0, r.y + Math.min(r.h, 220 * u))
    gl.addColorStop(0, E.rgba(col, 0.11 * lit)); gl.addColorStop(1, E.rgba(col, 0))
    ctx.fillStyle = gl; E.roundRect(ctx, r.x, r.y, r.w, r.h, rad); ctx.fill()
  }
  ctx.strokeStyle = E.mix(P.line, col, lit * 0.45); ctx.lineWidth = 1.5 * u
  E.roundRect(ctx, r.x + 0.75 * u, r.y + 0.75 * u, r.w - 1.5 * u, r.h - 1.5 * u, rad); ctx.stroke()
  brackets(ctx, E, r.x, r.y, r.w, r.h, { L: 18 * u * E.ease.out(E.clamp(p * 1.4)), col: lit > 0.02 ? col : P.faint, a: 0.4 + 0.6 * lit, glow: lit })
  if (head > 0) {
    const hy = r.y + head / 2
    if (head < r.h - 4 * u) { ctx.fillStyle = E.rgba(P.grid, 0.9); ctx.fillRect(r.x + 14 * u, r.y + head, r.w - 28 * u, 1.2 * u) }
    ctx.fillStyle = lit > 0.05 ? col : P.faint
    ctx.beginPath(); ctx.arc(r.x + 26 * u, hy, 5 * u, 0, TAU); ctx.fill()
    if (lit > 0.05) { ctx.fillStyle = E.rgba(col, 0.25 * lit); ctx.beginPath(); ctx.arc(r.x + 26 * u, hy, 10 * u, 0, TAU); ctx.fill() }
    const tx = r.x + 46 * u
    if (o.titleF) {
      const f = o.titleF, a = o.titleA ?? 1
      ghostBar(ctx, E, tx, hy - 5 * u, Math.min(f.width, r.w * 0.5), 10 * u, 1 - a)
      ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - E.ease.out(a)) * 14 * u, 0)
      ctx.fillStyle = E.mix(P.dim, P.text, Math.max(lit, a)); ctx.font = E.font('title', 700, f.size)
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(f.lines[0], tx, hy + 1 * u)
      ctx.restore()
    } else ghostBar(ctx, E, tx, hy - 4 * u, Math.min(r.w * 0.36, 150 * u), 8 * u, 0.8)
    if (o.live) live(ctx, E, r.x + r.w - 20 * u, hy, lit > 0.05 ? col : P.faint, 'right')
  }
  ctx.restore()
}

// 标题栏右边的「LIVE」小字和闪烁的点（装饰短词）
export function live(ctx, E, x, y, col, align = 'left', word = 'LIVE') {
  const u = E.u
  ctx.save(); ctx.font = E.font('mono', 600, 18 * u); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  const w = [...word].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + 3 * u * (word.length - 1)
  const x0 = align === 'right' ? x - w - 20 * u : x
  ctx.fillStyle = E.rgba(col, Math.floor(E.T * 2) % 2 ? 0.3 : 1); ctx.beginPath(); ctx.arc(x0 + 5 * u, y, 5 * u, 0, TAU); ctx.fill()
  ctx.fillStyle = E.rgba(col, 0.9); E.spacedText(ctx, word, x0 + 20 * u, y + 1 * u, 3 * u)
  ctx.restore()
}

// 胶囊（整圈细边）：font 由调用方给
export function capsule(ctx, E, x, y, w, h, col, o = {}) {
  ctx.save()
  ctx.fillStyle = o.fill ?? E.rgba(col, 0.1); E.roundRect(ctx, x, y, w, h, h / 2); ctx.fill()
  ctx.strokeStyle = E.rgba(col, o.a ?? 0.75); ctx.lineWidth = 1.5 * E.u; E.roundRect(ctx, x, y, w, h, h / 2); ctx.stroke()
  ctx.restore()
}

// 折线：pts 为像素坐标，p 为画到第几成；area 为填充底边 y。返回画到的末端
export function polyline(ctx, E, pts, p, col, o = {}) {
  if (p <= 0 || pts.length < 2) return null
  const u = E.u, n = pts.length - 1, f = E.clamp(p) * n, i = Math.floor(f), fr = f - i
  const path = pts.slice(0, i + 1)
  if (i < n) path.push({ x: E.lerp(pts[i].x, pts[i + 1].x, fr), y: E.lerp(pts[i].y, pts[i + 1].y, fr) })
  ctx.save()
  if (o.area != null) {
    const g = ctx.createLinearGradient(0, Math.min(...pts.map(q => q.y)), 0, o.area)
    g.addColorStop(0, E.rgba(col, 0.2)); g.addColorStop(1, E.rgba(col, 0))
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(path[0].x, o.area)
    for (const q of path) ctx.lineTo(q.x, q.y)
    ctx.lineTo(path[path.length - 1].x, o.area); ctx.closePath(); ctx.fill()
  }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const stroke = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); path.forEach((q, j) => (j ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke() }
  const w = (o.width ?? 3) * u
  if (o.glow !== false) stroke(w * 3.2, E.rgba(col, 0.14))
  stroke(w, col)
  ctx.restore()
  return path[path.length - 1]
}

// 发光圆点（数据点 / 状态灯）
export function dot(ctx, E, x, y, r, col, halo = 1) {
  ctx.save()
  if (halo > 0) { ctx.fillStyle = E.rgba(col, 0.22 * halo); ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill() }
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.restore()
}

// 圆弧（带半透明粗描边的光晕）
export function arc(ctx, E, cx, cy, R, w, a0, a1, col, glow = 0, cap = 'butt') {
  if (a1 - a0 <= 1e-4) return
  ctx.save(); ctx.lineCap = cap
  if (glow > 0) { ctx.strokeStyle = E.rgba(col, 0.16 * glow); ctx.lineWidth = w * 2.6; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke() }
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.stroke()
  ctx.restore()
}

// 一圈刻度（没有刻度值）：n 根，每 major 根一根长的；rot 旋转；from..to 只画这一段角度
export function ticks(ctx, E, cx, cy, R, n, col, o = {}) {
  const u = E.u, rot = o.rot ?? 0, a0 = o.a0 ?? 0, span = o.span ?? TAU, major = o.major ?? 4
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = (o.w ?? 1.6) * u; ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    if (span >= TAU && i === n) break
    const a = a0 + span * i / n + rot, r2 = R + (i % major ? (o.short ?? 6) : (o.long ?? 13)) * u
    ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2)
  }
  ctx.stroke(); ctx.restore()
}

// 冲击环：p 从 0 走到 1，一圈从 r0 扩到 r1 并淡掉
export function shock(ctx, E, x, y, p, r0, r1, col) {
  if (p <= 0 || p >= 1) return
  ctx.save(); ctx.globalAlpha *= 1 - p
  ctx.strokeStyle = E.rgba(col, 0.25); ctx.lineWidth = 9 * E.u; ctx.beginPath(); ctx.arc(x, y, E.lerp(r0, r1, p), 0, TAU); ctx.stroke()
  ctx.strokeStyle = col; ctx.lineWidth = 3 * E.u; ctx.stroke(); ctx.restore()
}

// 勾：p 画到第几成
export function check(ctx, E, x, y, s, col, p = 1) {
  if (p <= 0) return
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.15; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const a = { x: x - s * 0.36, y: y + s * 0.02 }, b = { x: x - s * 0.08, y: y + s * 0.3 }, c = { x: x + s * 0.4, y: y - s * 0.3 }
  const q = E.clamp(p) * 2
  ctx.beginPath(); ctx.moveTo(a.x, a.y)
  if (q < 1) ctx.lineTo(E.lerp(a.x, b.x, q), E.lerp(a.y, b.y, q))
  else { ctx.lineTo(b.x, b.y); ctx.lineTo(E.lerp(b.x, c.x, q - 1), E.lerp(b.y, c.y, q - 1)) }
  ctx.stroke(); ctx.restore()
}

// 一块区域上从左到右扫过的一道竖向扫描光（k 从 0 走到 1）
export function sweep(ctx, E, r, k, col) {
  if (k <= 0 || k >= 1) return
  const u = E.u, sx = r.x + r.w * k, g = ctx.createLinearGradient(sx - 160 * u, 0, sx, 0)
  g.addColorStop(0, E.rgba(col, 0)); g.addColorStop(1, E.rgba(col, 0.16))
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip()
  ctx.fillStyle = g; ctx.fillRect(sx - 160 * u, r.y, 160 * u, r.h)
  ctx.fillStyle = E.rgba(col, 0.3); ctx.fillRect(sx - 4 * u, r.y, 8 * u, r.h)
  ctx.fillStyle = col; ctx.fillRect(sx - 1.2 * u, r.y, 2.4 * u, r.h)
  ctx.restore()
}
