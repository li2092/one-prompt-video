// 纸片画法：剪刀剪出的轮廓（会 boil）、投影、纸卡、标签、字块、纸条勾、细绳。移植自风格库的 O-纸艺定格。
// 都是纯函数，随机只用种子哈希。定格帧号 F、缩放单位 U、轮廓 boil 每帧由 useE(E) 从全片时刻算出：
// 全片每秒换 SM 张，同一格里所有纸片一起换位置，读起来是一张一张拍出来的。

export const SM = 8
let F = 0, U = 1, BOIL = 0
export function useE(E) { F = Math.floor(E.T * SM + 1e-6); U = E.u; BOIL = Math.floor(F / 2) % 3 }
export const frameNo = () => F
// 这一场按定格取整后的秒数（全片时钟取整再减去这一场的起点）
export const tq = (s, E) => Math.floor(E.T * SM + 1e-6) / SM - (E.T - s.t)

// 装饰用的副色卡纸（主色走主题的 this.c）
export const P = { mustard: '#EBB24C', coral: '#EE9A8A', sage: '#9DB58A', blue: '#7E9CC0', pink: '#F4C3B5', kraft: '#D8B98E', gold: '#D9A441', green: '#5E9E5A', white: '#FFFDF7' }

// ---------- 哈希随机 ----------
function hh(n) {
  n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n = n ^ (n >>> 4)
  n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15)
  return (n >>> 0) / 4294967296
}
export const hash = (a, b = 0) => hh((Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) + 7)
export const hs = (a, b = 0) => hash(a, b) * 2 - 1
// 定格抖动：每个定格帧一个小偏移，amp = 1 时约 ±1.9 单位、±0.38°；字块用 0.5 左右
const JIT = 1.9
export function jit(seed, amp = 1) {
  return { x: hs(seed, F * 3) * amp * JIT * U, y: hs(seed, F * 3 + 1) * amp * JIT * U, r: hs(seed, F * 3 + 2) * amp * JIT * 0.0035 }
}
// 剪纸轮廓每 2 个定格帧换一次扰动（3 套轮流）；预渲染贴图时临时关掉
export function withoutBoil(fn) { const b = BOIL; BOIL = 0; try { return fn() } finally { BOIL = b } }
const bs = seed => seed + BOIL * 7919

// ---------- 缓动 ----------
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const outBack = (k, s = 2.1) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2)
export const inOut = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
// 从 t0 起数到第几格的进度：t0 之后的第一格就是 1/(d·SM)，不会出现一闪而过的极小一格
export const kf = (t, t0, d) => (t <= t0 ? 0 : clamp((Math.floor((t - t0) * SM + 1e-6) + 1) / (d * SM)))
// 弹出：0 → 过冲一格 → 落定（8 张一秒时 0.5 秒正好四格）
export const pop = (t, t0, d = 0.5) => (t <= t0 ? 0 : outBack(kf(t, t0, d)))

// 按比例调亮（p > 0）或调暗（p < 0）
export function shade(hex, p) {
  const n = parseInt(hex.slice(1), 16), f = v => Math.round(p < 0 ? v * (1 + p) : v + (255 - v) * p)
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join('')
}

// ---------- 投影：光从左上方来 ----------
export function shadow(ctx, lift = 1, a = 0.3) {
  ctx.shadowColor = `rgba(72,40,16,${a})`; ctx.shadowBlur = 10 * lift * U; ctx.shadowOffsetX = 2.5 * lift * U; ctx.shadowOffsetY = 5 * lift * U
}

// ---------- 剪刀剪出的轮廓：圆角矩形采样后加微小扰动 ----------
export function cutRect(ctx, x, y, w, h, r, seed = 1, rough = 1) {
  r = Math.max(0, Math.min(r, w / 2, h / 2))
  const pts = [], st = 46 * U
  const side = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / st)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]) }
  const arc = (cx, cy, a0) => { for (let i = 0; i < 5; i++) { const a = a0 + (Math.PI / 2) * i / 5; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) } }
  side(x + r, y, x + w - r, y); arc(x + w - r, y + r, -Math.PI / 2)
  side(x + w, y + r, x + w, y + h - r); arc(x + w - r, y + h - r, 0)
  side(x + w - r, y + h, x + r, y + h); arc(x + r, y + h - r, Math.PI / 2)
  side(x, y + h - r, x, y + r); arc(x + r, y + r, Math.PI)
  cutPoly(ctx, pts, seed, rough * 1.07)
}
export function cutCircle(ctx, cx, cy, r, seed = 1, rough = 1) {
  const n = Math.max(14, Math.round(r / (5 * U)))
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r + hs(bs(seed), i) * 1.4 * rough * U
    if (i === 0) ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); else ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
}
export function cutPoly(ctx, pts, seed = 1, rough = 1) {
  ctx.beginPath()
  pts.forEach(([px, py], i) => { const dx = hs(bs(seed), i * 2) * 1.4 * rough * U, dy = hs(bs(seed), i * 2 + 1) * 1.4 * rough * U; if (i === 0) ctx.moveTo(px + dx, py + dy); else ctx.lineTo(px + dx, py + dy) })
  ctx.closePath()
}

// 填一块纸：投影 + 底色 + 剪口的浅色细边
export function fillPaper(ctx, fill, lift = 1, edge = true) {
  ctx.save(); if (lift > 0) shadow(ctx, lift); ctx.fillStyle = fill; ctx.fill(); ctx.restore()
  if (edge) { ctx.save(); ctx.strokeStyle = 'rgba(255,250,240,0.38)'; ctx.lineWidth = 1.6 * U; ctx.stroke(); ctx.restore() }
}
export function card(ctx, x, y, w, h, fill, { r = 14 * U, seed = 1, lift = 1, edge = true } = {}) {
  cutRect(ctx, x, y, w, h, r, seed); fillPaper(ctx, fill, lift, edge)
}

// 在 (x, y) 处按定格抖动、缩放、旋转画东西
export function place(ctx, x, y, { s = 1, sy = 1, rot = 0, seed = 1, amp = 1.1 } = {}, fn) {
  if (s <= 0.001 || sy <= 0.001) return
  const j = jit(seed, amp)
  ctx.save(); ctx.translate(x + j.x, y + j.y); ctx.rotate(rot + j.r); ctx.scale(s, s * sy); fn(ctx); ctx.restore()
}

// 标签：一块纸卡托住几行字（f 是 E.fit 排好的结果），以中心为原点
export function labelSize(f, o = {}) {
  const padX = o.padX ?? f.size * 0.62, padY = o.padY ?? f.size * 0.3
  return { w: Math.max(o.minW || 0, f.width + padX * 2), h: f.lines.length * f.lineH + padY * 2, padX, padY }
}
export function label(ctx, f, font, o = {}) {
  const m = labelSize(f, o)
  card(ctx, -m.w / 2, -m.h / 2, m.w, m.h, o.fill, { r: o.r ?? f.size * 0.26, seed: o.seed || 3, lift: o.lift ?? 1 })
  ctx.font = font; ctx.fillStyle = o.fg; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'
  const x = o.align === 'left' ? -m.w / 2 + m.padX : 0
  f.lines.forEach((ln, i) => ctx.fillText(ln, x, -m.h / 2 + m.padY + (i + 0.5) * f.lineH + f.size * 0.04))
  return m
}

// 字块：一个字一张小方纸片。tileRow 量宽度，tiles 按定格一格弹出一张。font(字号) 返回字体串
export function tileRow(ctx, s, size, font) {
  const gap = size * 0.1
  ctx.font = font(size * 0.62)
  const ws = [...s].map(ch => (ch === ' ' ? size * 0.35 : Math.max(/[A-Za-z0-9]/.test(ch) ? size * 0.74 : size, ctx.measureText(ch).width + size * 0.3)))
  return { ws, total: ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1), gap }
}
// o: { size, font, col(i), fg(i) 第 i 块的纸色和字色, n0 这一行之前已有几块, stagger 一块隔几秒, seed }
export function tiles(ctx, s, cx, cy, t, t0, o) {
  const size = o.size, m = tileRow(ctx, s, size, o.font), chars = [...s], n0 = o.n0 || 0, seed = (o.seed || 11) + n0
  const st = o.stagger ?? 1 / SM
  let x = cx - m.total / 2
  chars.forEach((ch, i) => {
    const w = m.ws[i], k = pop(t, t0 + (n0 + i) * st)
    if (ch !== ' ' && k > 0) {
      place(ctx, x + w / 2, cy + hs(seed + 5, i) * size * 0.05, { s: k, rot: hs(seed, i) * 0.09, seed: seed * 31 + i, amp: 0.5 }, c => {
        card(c, -w / 2, -size / 2, w, size, o.col(n0 + i), { r: size * 0.12, seed: seed + i, lift: 1.1 })
        c.font = o.font(size * 0.62); c.fillStyle = o.fg(n0 + i); c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText(ch, 0, size * 0.04)
      })
    }
    x += w + m.gap
  })
  return m
}

// 纸条勾：两条纸条交叉粘上去
export function paperCheck(ctx, size, col, seed = 7) {
  const w = size * 0.2
  ctx.save(); ctx.translate(-size * 0.18, size * 0.12); ctx.rotate(Math.PI / 4)
  card(ctx, -size * 0.2, -w / 2, size * 0.42, w, col, { r: w * 0.25, seed, lift: 0.8 }); ctx.restore()
  ctx.save(); ctx.translate(size * 0.12, -size * 0.02); ctx.rotate(-Math.PI / 3.2)
  card(ctx, -size * 0.42, -w / 2, size * 0.84, w, col, { r: w * 0.25, seed: seed + 1, lift: 0.8 }); ctx.restore()
}

// 细绳：两点之间微微下垂
export function string(ctx, x0, y0, x1, y1, col = 'rgba(80,60,40,0.55)', w = 2) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w * U; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 6 * U, x1, y1); ctx.stroke(); ctx.restore()
}
// 金色铆钉
export function brad(ctx, x, y, r) {
  ctx.save(); shadow(ctx, 0.35, 0.35); ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.fillStyle = 'rgba(255,245,210,0.85)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill()
}
