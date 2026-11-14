// 综艺花字的画法库（移植自风格库的 J-综艺花字）：多层描边花字、贴纸、贴条、入场、放射线、星星、爆炸框、
// 彩纸、冲击环、粗线、气泡、圆台。全部是时刻的纯函数；颜色由 setPal(this.c) 从主题的八个颜色算出来。
import { clamp, lerp, ease, mix, rgba, noise1 } from '../../../core.mjs'

export const P = {}
export function setPal(c) {
  if (P.src === c) return P
  Object.assign(P, {
    src: c, ink: c.line, white: c.fg, card: c.card, on: c.onAccent,
    yellow: c.accent, purple: c.accent2, cyan: c.muted, pink: c.bg,
    orange: mix(c.accent, c.bg, 0.5), blue: mix(c.muted, c.accent2, 0.6), hot: mix(c.bg, c.accent2, 0.2), lime: mix(c.accent, c.muted, 0.4),
  })
  return P
}

// ---------- 入场 ----------
// dt 是入场以后过了多久（秒，负数表示还没到）。pop 弹出 / slam 砸下 / drop 掉落回弹 / left right 横着甩进来 / up 上弹
export function enter(E, dt, kind = 'pop') {
  const u = E.u, o = { s: 1, a: 1, dx: 0, dy: 0, r: 0, sx: 1, sy: 1 }
  if (dt < 0) { o.a = 0; return o }
  if (kind === 'pop') { const p = clamp(dt / 0.32); o.s = ease.outBack(p); o.a = clamp(dt / 0.06) }
  else if (kind === 'slam') {
    const p = clamp(dt / 0.14)
    o.s = lerp(2, 1, ease.in(p)); o.a = clamp(dt / 0.05)
    if (p >= 1) { const d = dt - 0.14, k = 0.1 * Math.exp(-d * 12) * Math.cos(d * 38); o.sx = 1 + k; o.sy = 1 - k }
  } else if (kind === 'drop') {
    const p = clamp(dt / 0.45); o.dy = -(1 - ease.outBack(p)) * 300 * u; o.a = clamp(dt / 0.06)
    if (p >= 0.55) { const d = dt - 0.25; o.sy = 1 - 0.08 * Math.exp(-d * 10) * Math.cos(d * 30); o.sx = 2 - o.sy }
  } else if (kind === 'left' || kind === 'right') {
    const p = clamp(dt / 0.34), d = kind === 'left' ? -1 : 1
    o.dx = d * (1 - ease.outBack(p)) * 1100 * u; o.r = d * (1 - p) * 0.25
  } else if (kind === 'up') { const p = clamp(dt / 0.36); o.dy = (1 - ease.outBack(p)) * 360 * u; o.a = clamp(dt / 0.08) }
  return o
}
// 按入场把一个元素画在 (x, y)，fn 以 (0,0) 为中心作画；wob 是待机时的轻微摇晃
export function put(ctx, E, dt, { kind = 'pop', x, y, rot = 0, wob = 1, seed = 1, s = 1 }, fn) {
  const o = enter(E, dt, kind)
  if (o.a <= 0.002 || o.s <= 0.01) return
  ctx.save()
  ctx.globalAlpha *= o.a
  ctx.translate(x + o.dx, y + o.dy)
  ctx.rotate(rot + o.r + (wob ? 0.016 * wob * noise1(E.T * 1.4, seed) : 0))
  ctx.scale(o.s * s * o.sx, o.s * s * o.sy)
  fn(ctx)
  ctx.restore()
}
// 画面一抖：dt 是事件以后过了多久
export function shake(E, dt, amp = 12, dur = 0.35) {
  if (dt < 0 || dt > dur) return { x: 0, y: 0 }
  const d = Math.pow(1 - dt / dur, 1.5) * amp * E.u
  return { x: d * noise1(dt * 45, 3), y: d * noise1(dt * 45, 9) }
}

// ---------- 花字 ----------
// 逐字画，四层：深色硬投影 → 白色宽边 → 彩色描边 → 上浅下深的渐变字芯。
// t：入场以后过了多久；anim 'pop' | 'slam' | 'drop' | 'wave' | null；stagger 字间错开的秒数；bob 待机上下跳的幅度（像素）。
// k0：这一行第一个字在整段里的序号（多行时接着数）；alt(k)：第 k 个字换一种花字（高亮词），返回 { fill, outer, rim, bob } 或 null。
// rimW、outW 是白边、彩色描边的线宽（字号的倍数）：中文笔画多，描边太粗会糊，按原尺寸单帧定的值。
export function hz(ctx, E, s, x, y, size, o = {}) {
  const { fill = [P.white, P.yellow], outer = P.purple, rim = P.white, shadow = P.ink, align = 'center',
    t = 1e9, anim = 'pop', stagger = 0.04, bob = 0, k0 = 0, alt = null, rimW = 0.22, outW = 0.1, sh = 0.07 } = o
  ctx.font = E.font('title', 900, size)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.miterLimit = 2
  const chars = [...s], ws = chars.map(c => ctx.measureText(c).width), total = ws.reduce((a, b) => a + b, 0)
  let cx = align === 'center' ? x - total / 2 : align === 'left' ? x : x - total
  const st = chars.map((c, i) => {
    const px = cx + ws[i] / 2; cx += ws[i]
    const k = k0 + i, dt = t - k * stagger
    if (dt < 0 || c === ' ') return null
    let sc = 1, dy = 0, r = 0, a = 1
    if (anim === 'pop') { const p = clamp(dt / 0.3); sc = ease.outBack(p); a = clamp(dt / 0.05) }
    else if (anim === 'slam') { const p = clamp(dt / 0.13); sc = lerp(1.7, 1, ease.in(p)); a = clamp(dt / 0.05) }
    else if (anim === 'drop') { const p = clamp(dt / 0.4); dy = -(1 - ease.outBack(p)) * size * 1.4; a = clamp(dt / 0.06) }
    else if (anim === 'wave') { const p = clamp(dt / 0.35); sc = ease.outBack(p); r = (1 - p) * (k % 2 ? 0.5 : -0.5) }
    const al = alt ? alt(k) : null, b = al && al.bob != null ? al.bob : bob
    if (b) dy += Math.sin(t * 7 - k * 0.9) * b
    return { c, px, sc, dy, r, a, fill: al?.fill ?? fill, outer: al?.outer ?? outer, rim: al && 'rim' in al ? al.rim : rim, rimW: al?.rimW ?? rimW, outW: al?.outW ?? outW }
  })
  const each = fn => st.forEach(q => {
    if (!q || q.sc <= 0.01) return
    ctx.save(); ctx.globalAlpha *= q.a; ctx.translate(q.px, y + q.dy); ctx.rotate(q.r); ctx.scale(q.sc, q.sc); fn(q); ctx.restore()
  })
  const so = size * sh, grads = new Map()
  const grad = f => {
    if (!Array.isArray(f)) return f
    const key = f.join(); if (grads.has(key)) return grads.get(key)
    const g = ctx.createLinearGradient(0, -size * 0.4, 0, size * 0.4); g.addColorStop(0, f[0]); g.addColorStop(1, f[1])
    grads.set(key, g); return g
  }
  if (shadow) each(q => { ctx.fillStyle = shadow; ctx.strokeStyle = shadow; ctx.lineWidth = size * (q.rim ? q.rimW : q.outW); ctx.strokeText(q.c, so * 0.7, so); ctx.fillText(q.c, so * 0.7, so) })
  each(q => { if (q.rim) { ctx.strokeStyle = q.rim; ctx.lineWidth = size * q.rimW; ctx.strokeText(q.c, 0, 0) } })
  each(q => { if (q.outer) { ctx.strokeStyle = q.outer; ctx.lineWidth = size * q.outW; ctx.strokeText(q.c, 0, 0) } })
  each(q => { ctx.fillStyle = grad(q.fill); ctx.fillText(q.c, 0, 0) })
  return total
}
// E.fit 排好的几行花字：y0 是第一行的顶，字号、行高取 f 的
export function hzLines(ctx, E, f, x, y0, o = {}) {
  let k0 = o.k0 || 0
  f.lines.forEach((ln, j) => { hz(ctx, E, ln, x, y0 + j * f.lineH + f.lineH / 2, f.size, { ...o, k0 }); k0 += [...ln].length })
}

// 普通粗字：白字深色描边（贴纸上的小字、柱子下的标签）
export function label(ctx, E, s, x, y, size, { fill = P.white, stroke = P.ink, lw = 0.22, align = 'center', weight = 900 } = {}) {
  ctx.font = E.font('body', weight, size)
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = size * lw; ctx.strokeText(s, x, y) }
  ctx.fillStyle = fill; ctx.fillText(s, x, y)
}
export function inkLines(ctx, E, f, x, y0, { color = P.ink, align = 'center', weight = 900, stroke = null, lw = 0.2 } = {}) {
  f.lines.forEach((ln, j) => label(ctx, E, ln, x, y0 + j * f.lineH + f.lineH / 2, f.size, { fill: color, stroke, lw, align, weight }))
}

// ---------- 贴纸 ----------
// 模切贴纸：深色硬投影 + 白色宽边 + 彩色芯，以 (0,0) 为中心
export function sticker(ctx, E, w, h, { fill = P.yellow, r = 26, border = 8, sh = 10, ink = 4 } = {}) {
  const u = E.u, b = border * u, rr = Math.min(r * u, h / 2)
  ctx.save()
  ctx.fillStyle = P.ink; E.roundRect(ctx, -w / 2 - b + sh * u, -h / 2 - b + sh * u, w + 2 * b, h + 2 * b, rr + b); ctx.fill()
  if (b > 0) { ctx.fillStyle = P.white; E.roundRect(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, rr + b); ctx.fill() }
  ctx.lineWidth = ink * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = fill; E.roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.fill()
  if (b <= 0) { ctx.lineWidth = ink * u; ctx.stroke() }
  ctx.restore()
}
// 自适应宽度的胶囊贴纸：s 是一行字
export function pill(ctx, E, s, size, { fill = P.hot, color = P.white, stroke = null, padX = 0.62, h = 1.62, border = 6, sh = 7 } = {}) {
  ctx.font = E.font('body', 900, size)
  const w = ctx.measureText(s).width + size * padX * 2
  sticker(ctx, E, w, size * h, { fill, r: size * h / 2 / E.u, border, sh })
  label(ctx, E, s, 0, size * 0.04, size, { fill: color, stroke, lw: 0.18 })
  return w
}
// 「划重点」这类贴条：斜贴的彩条，两头锯齿，上沿一道高光，字是白芯深边的花字
export function tape(ctx, E, s, size, { fill = P.hot } = {}) {
  const u = E.u
  ctx.font = E.font('title', 900, size)
  const w = ctx.measureText(s).width + size * 1.2, h = size * 1.55
  const path = (ox, oy) => {
    ctx.beginPath(); ctx.moveTo(-w / 2 + ox, -h / 2 + oy); ctx.lineTo(w / 2 + ox, -h / 2 + oy)
    for (let i = 1; i <= 6; i++) ctx.lineTo(w / 2 + ox + (i % 2 ? -size * 0.16 : 0), -h / 2 + oy + h * i / 6)
    ctx.lineTo(-w / 2 + ox, h / 2 + oy)
    for (let i = 5; i >= 0; i--) ctx.lineTo(-w / 2 + ox + (i % 2 ? size * 0.16 : 0), -h / 2 + oy + h * i / 6)
    ctx.closePath()
  }
  ctx.save(); ctx.lineJoin = 'round'
  path(9 * u, 9 * u); ctx.fillStyle = P.ink; ctx.fill()
  path(0, 0); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = rgba(P.white, 0.22); ctx.fillRect(-w / 2 + size * 0.2, -h / 2 + h * 0.12, w - size * 0.4, h * 0.16)
  ctx.restore()
  hz(ctx, E, s, 0, size * 0.04, size, { fill: [P.white, P.yellow], outer: P.ink, rim: null, shadow: null, outW: 0.16 })
  return w
}

// ---------- 背景元素 ----------
// 放射线：从 (x, y) 出发的 n 道楔形
export function rays(ctx, E, x, y, n, rot, color, R = null) {
  const r = R ?? Math.hypot(E.W, E.H)
  ctx.save(); ctx.fillStyle = color; ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = rot + i * Math.PI * 2 / n, w = Math.PI / n * 0.5
    ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a - w) * r, y + Math.sin(a - w) * r); ctx.lineTo(x + Math.cos(a + w) * r, y + Math.sin(a + w) * r); ctx.closePath()
  }
  ctx.fill(); ctx.restore()
}
// 屏幕边缘的速度线：只画在外圈，不进中心；每秒换 18 次。amt 0..1
export function speedLines(ctx, E, amt, { color = P.white, n = 56, seed = 1 } = {}) {
  if (amt <= 0.01) return
  const cx = E.W / 2, cy = E.H / 2, R = Math.hypot(E.W, E.H) / 2, fr = Math.floor(E.T * 18)
  ctx.save(); ctx.globalAlpha *= Math.min(1, amt) * 0.8; ctx.fillStyle = color; ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i + E.hash(seed * 997 + i, fr) * 0.8) / n * Math.PI * 2, ex = Math.cos(a), ey = Math.sin(a)
    const r0 = (0.74 + 0.2 * E.hash(seed * 31 + i, fr + 7)) * 1.12, w = (4 + 10 * E.hash(i, fr * 3 + seed)) * E.u
    const x1 = cx + ex * R * 1.4, y1 = cy + ey * R * 1.4
    ctx.moveTo(cx + ex * r0 * E.W / 2, cy + ey * r0 * E.H / 2); ctx.lineTo(x1 - ey * w, y1 + ex * w); ctx.lineTo(x1 + ey * w, y1 - ex * w); ctx.closePath()
  }
  ctx.fill(); ctx.restore()
}
// 四角星闪光
export function sparkle(ctx, E, x, y, r, { color = P.white, rim = P.ink, rot = 0 } = {}) {
  if (r <= 0.5) return
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.beginPath()
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.26 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) }
  ctx.closePath()
  if (rim) { ctx.lineWidth = Math.max(3 * E.u, r * 0.16); ctx.strokeStyle = rim; ctx.lineJoin = 'round'; ctx.stroke() }
  ctx.fillStyle = color; ctx.fill(); ctx.restore()
}
// 一圈星星围着一个点闪；dt 是开始闪以后过了多久
export function twinkles(ctx, E, dt, x, y, rx, ry, n = 5, { seed = 1, size = 30, colors = null } = {}) {
  if (dt < 0) return
  const cols = colors || [P.white, P.yellow, P.cyan]
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + E.hash(seed, i) * 0.8, ph = dt * 3.2 + E.hash(seed + 7, i) * 6
    const k = Math.max(0, Math.sin(ph)) * clamp((dt - i * 0.05) / 0.2)
    sparkle(ctx, E, x + Math.cos(a) * rx, y + Math.sin(a) * ry, size * E.u * (0.5 + 0.7 * E.hash(seed + 3, i)) * k, { color: cols[i % cols.length], rot: ph * 0.2 })
  }
}
// 漫画爆炸框：不规则尖刺，以 (0,0) 为中心
export function boom(ctx, E, r, { fill = P.yellow, n = 16, seed = 3, rot = 0, sh = 14, lw = 7 } = {}) {
  const u = E.u, pts = []
  for (let i = 0; i < n * 2; i++) {
    const a = rot + i * Math.PI / n + (E.hash(seed, i) - 0.5) * 0.18
    const rr = i % 2 ? r * (0.64 + 0.1 * E.hash(seed + 1, i)) : r * (0.9 + 0.16 * E.hash(seed + 2, i))
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr])
  }
  const path = (ox, oy) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + ox, y + oy) : ctx.moveTo(x + ox, y + oy))); ctx.closePath() }
  ctx.save(); ctx.lineJoin = 'round'
  if (sh) { path(sh * u, sh * u); ctx.fillStyle = P.ink; ctx.fill() }
  path(0, 0); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.restore()
}
// 彩纸：dt 是炸开以后过了多久，从 (x, y) 炸开，重力下落，life 秒后淡没
export function confetti(ctx, E, dt, x, y, { n = 36, seed = 1, speed = 900, spread = Math.PI * 2, dir = -Math.PI / 2, life = 1.5 } = {}) {
  if (dt < 0 || dt > life) return
  const u = E.u, cols = [P.yellow, P.pink, P.cyan, P.lime, P.white, P.purple]
  ctx.save()
  for (let i = 0; i < n; i++) {
    const a = dir + (E.hash(seed, i) - 0.5) * spread, v = speed * u * (0.35 + 0.65 * E.hash(seed + 1, i))
    const drag = 1 - Math.exp(-dt * 2.2), px = x + Math.cos(a) * v * drag / 2.2, py = y + Math.sin(a) * v * drag / 2.2 + 520 * u * dt * dt
    const sz = (9 + 12 * E.hash(seed + 2, i)) * u
    ctx.save(); ctx.globalAlpha *= clamp((life - dt) / 0.4); ctx.translate(px, py); ctx.rotate(dt * (4 + 8 * E.hash(seed + 3, i)) + i)
    ctx.fillStyle = cols[i % cols.length]
    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, sz * 0.5, 0, Math.PI * 2); ctx.fill() }
    else ctx.fillRect(-sz * 0.6, -sz * 0.25, sz * 1.2, sz * 0.5 * Math.abs(Math.cos(dt * 9 + i)) + 2 * u)
    ctx.restore()
  }
  ctx.restore()
}
// 冲击圆环
export function ring(ctx, E, dt, x, y, r1, { color = P.white, dur = 0.45, lw = 14 } = {}) {
  const p = dt / dur
  if (p < 0 || p > 1) return
  ctx.save(); ctx.globalAlpha *= 1 - p; ctx.strokeStyle = color; ctx.lineWidth = lw * E.u * (1 - p * 0.7)
  ctx.beginPath(); ctx.arc(x, y, r1 * ease.out(p), 0, Math.PI * 2); ctx.stroke(); ctx.restore()
}

// ---------- 图形 ----------
export function fatLine(ctx, E, pts, color, w = 20) {
  const u = E.u
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))) }
  path(); ctx.strokeStyle = P.ink; ctx.lineWidth = (w + 12) * u; ctx.stroke()
  path(); ctx.strokeStyle = color; ctx.lineWidth = w * u; ctx.stroke()
  ctx.restore()
}
// 粗箭头：从 (x0,y0) 指向 (x1,y1)，p 是画出的进度
export function arrow(ctx, E, x0, y0, x1, y1, p = 1, color = P.yellow, w = 16) {
  if (p <= 0) return
  const x = lerp(x0, x1, p), y = lerp(y0, y1, p), a = Math.atan2(y1 - y0, x1 - x0), h = w * 2.3 * E.u
  fatLine(ctx, E, [[x0, y0], [x - Math.cos(a) * h * 0.6, y - Math.sin(a) * h * 0.6]], color, w)
  ctx.save(); ctx.beginPath(); ctx.moveTo(x, y)
  ctx.lineTo(x - Math.cos(a - 0.55) * h, y - Math.sin(a - 0.55) * h); ctx.lineTo(x - Math.cos(a + 0.55) * h, y - Math.sin(a + 0.55) * h); ctx.closePath()
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 6 * E.u; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
}
// 圆形徽章：深色投影 + 白边 + 彩芯
export function badge(ctx, E, r, fill) {
  const u = E.u
  ctx.save()
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(6 * u, 7 * u, r + 6 * u, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.arc(0, 0, r + 6 * u, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}
// 对话气泡：(x, y, w, h) 的圆角框，尾巴从框边伸向 (tx, ty)
export function bubble(ctx, E, x, y, w, h, tx, ty, { fill = P.card } = {}) {
  const u = E.u, r = Math.min(h * 0.22, 60 * u)
  const bx = clamp(tx, x + r + 40 * u, x + w - r - 40 * u), by = clamp(ty, y + r + 40 * u, y + h - r - 40 * u)
  const side = ty > y + h ? 'b' : ty < y ? 't' : tx < x ? 'l' : 'r', tw = 46 * u
  const path = (ox, oy) => {
    E.roundRect(ctx, x + ox, y + oy, w, h, r)
    ctx.moveTo(tx + ox, ty + oy)
    if (side === 'b' || side === 't') { const yy = side === 'b' ? y + h - 2 * u : y + 2 * u; ctx.lineTo(bx - tw + ox, yy + oy); ctx.lineTo(bx + tw + ox, yy + oy) }
    else { const xx = side === 'l' ? x + 2 * u : x + w - 2 * u; ctx.lineTo(xx + ox, by - tw + oy); ctx.lineTo(xx + ox, by + tw + oy) }
    ctx.closePath()
  }
  ctx.save(); ctx.lineJoin = 'round'
  path(11 * u, 12 * u); ctx.fillStyle = P.ink; ctx.fill()
  path(0, 0); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 6 * u; ctx.strokeStyle = P.ink; ctx.stroke()
  // 盖掉尾巴和框之间的那段描边
  ctx.beginPath(); ctx.moveTo(tx, ty)
  if (side === 'b' || side === 't') { const yy = side === 'b' ? y + h - 5 * u : y + 5 * u; ctx.lineTo(bx - tw + 4 * u, yy); ctx.lineTo(bx + tw - 4 * u, yy) }
  else { const xx = side === 'l' ? x + 5 * u : x + w - 5 * u; ctx.lineTo(xx, by - tw + 4 * u); ctx.lineTo(xx, by + tw - 4 * u) }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill()
  ctx.restore()
}
// 舞台圆台 + 一束追光；(x, y) 是台面中心，台面一圈跑马灯
export function podium(ctx, E, x, y, w, t) {
  const u = E.u, h = w * 0.22
  ctx.save()
  const g = ctx.createLinearGradient(0, y - w * 1.6, 0, y)
  g.addColorStop(0, rgba(P.white, 0)); g.addColorStop(1, rgba(P.white, 0.3))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.moveTo(x - w * 0.16, y - w * 1.7); ctx.lineTo(x + w * 0.16, y - w * 1.7); ctx.lineTo(x + w * 0.52, y); ctx.lineTo(x - w * 0.52, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(x + 8 * u, y + h * 0.55, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = P.hot; ctx.beginPath(); ctx.ellipse(x, y + h * 0.42, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill()
  ctx.lineWidth = 5 * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = P.yellow; ctx.beginPath(); ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2, on = (Math.floor(t * 6) + i) % 2 === 0
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * w * 0.42, y + Math.sin(a) * h * 0.38, 6 * u, 0, Math.PI * 2)
    ctx.fillStyle = on ? P.white : mix(P.hot, P.white, 0.5); ctx.fill()
  }
  ctx.restore()
}
