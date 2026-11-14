// 酸性镀铬的共用部件：镀铬立体字贴图、液化绘制、入场动作、星形闪光、贴纸、标签、镀铬面板、柱子、光圈、液滴、箭头。
// 移植自风格库的 Z-酸性镀铬。改动：颜色从主题的八个颜色算；尺寸乘 E.u；贴图走 E.once；字体按 E.font 的类别取；
// 星和光圈的发光改成预先画好的贴图和半透明描边；镀铬字分「底层」「字面」两遍画，相邻的字不互相压暗。
import { clamp, lerp, mix, rgba, roundRect, drawLines } from '../../../core.mjs'

export const TAU = Math.PI * 2
const scale = (hex, k) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('')

// 配色：ink 是深色描边（onAccent），violet 由底色调亮得到，lime / pink 是两个强调色
export const pal = E => E.once('chrome:pal', () => {
  const c = E.theme.c, violet = scale(c.bg, 2.8)
  return { bg: c.bg, deep: scale(c.bg, 0.72), violet, violetHi: mix(violet, c.accent2, 0.35), ink: c.onAccent, lime: c.accent, pink: c.accent2, white: c.fg, dim: c.muted, silver: c.line, card: c.card, cyan: '#7df9ff' }
})

// ---------- 动作 ----------
export const prog = (t, t0, d) => clamp((t - t0) / Math.max(1e-6, d))
export const outCubic = p => 1 - Math.pow(1 - p, 3)
export const outBack = p => { if (p <= 0) return 0; const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2) }
const outElastic = p => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -9 * p) * Math.sin((p * 9 - 0.75) * TAU / 3.2) + 1)
// 入场（p 是 0 到 1 的线性进度）：pop 回弹放大 / stretch 横向拉长后弹回 / tall 竖向 / drop 落下 / spin 旋入 / melt 液化后凝固 / left right up down 滑入
export function enter(p, kind = 'pop', u = 1) {
  const o = { s: 1, sx: 1, sy: 1, rot: 0, dx: 0, dy: 0, a: p > 0 ? clamp(p * 5) : 0, liq: 0 }
  if (kind === 'pop') o.s = outBack(p) * 0.85 + 0.15 * p
  if (kind === 'stretch') { const e = outElastic(p); o.sx = lerp(2.2, 1, e); o.sy = lerp(0.25, 1, e) }
  if (kind === 'tall') { const e = outElastic(p); o.sx = lerp(0.3, 1, e); o.sy = lerp(2, 1, e) }
  if (kind === 'drop') { o.dy = -lerp(240 * u, 0, outBack(p)); o.rot = (1 - outCubic(p)) * 0.2 }
  if (kind === 'spin') { o.s = outBack(p); o.rot = (1 - outCubic(p)) * -1.1 }
  if (kind === 'melt') { o.liq = 1 - outCubic(p); o.sy = lerp(1.45, 1, outCubic(p)); o.s = lerp(0.9, 1, outCubic(p)) }
  const sl = 1 - outBack(p) * 0.9 - 0.1 * p
  if (kind === 'left') o.dx = -520 * u * sl
  if (kind === 'right') o.dx = 520 * u * sl
  if (kind === 'up') o.dy = 520 * u * sl
  if (kind === 'down') o.dy = -520 * u * sl
  return o
}
// 待机微动：慢速摆动 + 上下浮
export const idle = (t, seed, amp = 1, u = 1) => ({ rot: Math.sin(t * 1.7 + seed * 3.1) * 0.018 * amp, dy: Math.sin(t * 2.3 + seed) * 5 * u * amp })
export const jolt = (t, t0, d = 0.3) => { const p = prog(t, t0, d); return p <= 0 || p >= 1 ? 0 : Math.pow(1 - p, 2) }
// 合并几组变换：旋转、位移相加，缩放、透明度相乘，液化取大
export function M(...os) {
  const r = { s: 1, sx: 1, sy: 1, rot: 0, dx: 0, dy: 0, a: 1, liq: 0 }
  for (const o of os) {
    if (!o) continue
    r.s *= o.s ?? 1; r.sx *= o.sx ?? 1; r.sy *= o.sy ?? 1; r.a *= o.a ?? 1
    r.rot += o.rot || 0; r.dx += o.dx || 0; r.dy += o.dy || 0; r.liq = Math.max(r.liq, o.liq || 0)
    if (o.ph != null) r.ph = o.ph
    if (o.shine != null) r.shine = o.shine
  }
  return r
}
// 以 (x, y) 为中心施加变换，之后照原坐标画
export function around(ctx, x, y, o = {}) {
  ctx.translate(x + (o.dx || 0), y + (o.dy || 0))
  if (o.rot) ctx.rotate(o.rot)
  const s = o.s ?? 1
  ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1))
  ctx.translate(-x, -y)
  ctx.globalAlpha *= clamp(o.a ?? 1)
}
// 扫光进度：从 t0 起每 period 秒扫一次
export const sweep = (t, t0, period = 2.4, dur = 0.55) => { if (t < t0) return null; const q = ((t - t0) % period) / dur; return q < 1 ? q : null }

// ---------- 镀铬立体字 ----------
// face：多段金属色阶（上亮、一道窄的暗地平线、下反光）；cjk：中文且字号不大于 120 时用，地平线只压到中灰，笔画多的字不糊
const CJK = /[㐀-鿿豈-﫿]/
function kinds(E) {
  return E.once('chrome:kinds', () => {
    const k = pal(E), W = '#ffffff', B = '#000000'
    const metal = c => ({
      face: [[0, mix(c, W, 0.75)], [0.2, mix(c, W, 0.4)], [0.4, c], [0.47, mix(c, B, 0.62)], [0.53, mix(c, B, 0.15)], [0.64, mix(c, W, 0.3)], [0.84, mix(c, W, 0.6)], [1, mix(c, W, 0.4)]],
      cjk: [[0, mix(c, W, 0.75)], [0.45, mix(c, W, 0.15)], [0.52, mix(c, B, 0.12)], [0.6, mix(c, W, 0.35)], [1, mix(c, W, 0.55)]],
    })
    return {
      silver: {
        face: [[0, W], [0.16, '#eef0ff'], [0.4, '#a9aed6'], [0.48, mix(k.violet, B, 0.4)], [0.53, mix(k.violet, W, 0.35)], [0.62, mix(k.pink, W, 0.8)], [0.8, W], [1, mix(k.violet, W, 0.72)]],
        cjk: [[0, W], [0.44, '#e3e6ff'], [0.51, mix(k.violet, W, 0.55)], [0.58, mix(k.pink, W, 0.82)], [1, mix(k.violet, W, 0.74)]],
        side: [k.pink, k.violet],
      },
      lime: { ...metal(k.lime), side: [k.violetHi, k.deep] },
      pink: { ...metal(k.pink), side: [k.violet, k.ink] },
    }
  })
}
const probe = E => E.once('chrome:probe', () => E.createCanvas(8, 8).getContext('2d'))
// tex(E, 字或分段 [[字, kind], …], 字号, { kind, role, w, depth })：返回 { back, face, mask, w, h, x0, cy, tw, size }
// back 是光晕、投影、挤出和深色描边，face 是金属字面、亮边和反光；x0, cy 是字的起点和竖直中线在贴图里的位置
export function tex(E, segs, size, o = {}) {
  const S = (typeof segs === 'string' ? [[segs, o.kind || 'silver']] : segs).filter(g => g[0])
  const role = o.role || 'title', wt = o.w ?? 900, dk = o.depth ?? 0.085
  const key = 'chrome:t|' + role + wt + '|' + size.toFixed(1) + '|' + dk + '|' + S.map(g => g[1] + ':' + g[0]).join('\u0001')
  return E.once(key, () => build(E, S, size, role, wt, dk))
}
function build(E, S, size, role, wt, dk) {
  const K = kinds(E), k = pal(E), text = S.map(g => g[0]).join(''), font = E.font(role, wt, size)
  const pr = probe(E); pr.font = font
  const tw = pr.measureText(text).width
  const depth = Math.max(3, size * dk), gw = size * 0.06, pad = Math.ceil(size * 0.24 + gw)
  const W = Math.ceil(tw + pad * 2 + depth * 0.7), H = Math.ceil(size * 1.32 + pad * 2 + depth)
  const x0 = pad, cy = pad + size * 0.66
  const segX = []; let acc = 0
  for (const [str] of S) { segX.push(x0 + pr.measureText(text.slice(0, acc)).width); acc += str.length }
  const setup = c => { c.font = font; c.textBaseline = 'middle'; c.textAlign = 'left' }
  const mk = () => { const cv = E.createCanvas(W, H), c = cv.getContext('2d'); setup(c); return [cv, c] }
  const [back, b] = mk(), [tmp, tc] = mk()
  // 字形膨胀：在两圈上错位叠印填充（代替 strokeText，字形内部重叠的轮廓不会露线）
  const dil = (str, x, y, r) => { tc.fillText(str, x, y); if (r < 0.5) return; for (const [rr, n] of [[r, 16], [r * 0.55, 8]]) for (let i = 0; i < n; i++) { const a = i / n * TAU; tc.fillText(str, x + Math.cos(a) * rr, y + Math.sin(a) * rr) } }
  const solid = (col, r, dx, dy) => { tc.clearRect(0, 0, W, H); S.forEach(([str, kind], j) => { tc.fillStyle = typeof col === 'function' ? col(K[kind] || K.silver) : col; dil(str, segX[j] + dx, cy + dy, r) }); return tmp }
  // 深色光晕（贴图里只算一次，不进逐帧）：亮的液态底上也压得住
  b.save(); b.shadowColor = rgba(k.ink, 0.8); b.shadowBlur = size * 0.2; b.drawImage(solid(k.ink, gw, depth * 0.3, depth * 0.5), 0, 0); b.restore()
  b.save(); b.shadowColor = rgba(k.ink, 0.5); b.shadowBlur = size * 0.14; b.shadowOffsetY = size * 0.07; b.drawImage(solid(KK => KK.side[1], 0, depth * 0.6, depth), 0, 0); b.restore()
  // 挤出：从最深一层画到表面
  const step = Math.max(1.5, size / 70)
  for (let d = depth; d >= 0; d -= step) b.drawImage(solid(KK => mix(KK.side[0], KK.side[1], d / depth), size * 0.035, d * 0.6, d), 0, 0)
  b.drawImage(solid(k.ink, size * 0.0375, 0, 0), 0, 0)
  // 字面：金属渐变 + 上沿亮边 + 下沿暗边 + 一道窄斜反光，都只落在字面上
  const [face, f] = mk()
  let simpleAll = true
  S.forEach(([str, kind], j) => {
    const KK = K[kind] || K.silver, simple = CJK.test(str) && size <= 120
    if (!simple) simpleAll = false
    const g = f.createLinearGradient(0, cy - size * 0.52, 0, cy + size * 0.5)
    for (const [p, col] of (simple ? KK.cjk : KK.face)) g.addColorStop(p, col)
    f.fillStyle = g; f.fillText(str, segX[j], cy)
  })
  const rim = (dx, dy, col) => {
    const [rc, r] = mk()
    r.fillStyle = col; r.fillText(text, x0, cy)
    // 挖掉时用不透明色，否则字面会残留一层半透明色（字面发灰）
    r.globalCompositeOperation = 'destination-out'; r.fillStyle = '#000'; r.fillText(text, x0 + dx, cy + dy)
    return rc
  }
  f.globalCompositeOperation = 'source-atop'
  f.drawImage(rim(size * 0.01, size * 0.03, 'rgba(255,255,255,0.95)'), 0, 0)
  if (!simpleAll) f.drawImage(rim(-size * 0.006, -size * 0.022, rgba(k.ink, 0.4)), 0, 0)
  const sg = f.createLinearGradient(x0, cy - size * 0.6, x0 + size * 0.9, cy + size * 0.4)
  sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.38, 'rgba(255,255,255,0)'); sg.addColorStop(0.45, 'rgba(255,255,255,0.5)'); sg.addColorStop(0.53, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,0)')
  f.fillStyle = sg; f.fillRect(0, 0, W, H)
  const [mask, m] = mk()
  m.fillStyle = '#fff'; m.fillText(text, x0, cy)
  return { back, face, mask, w: W, h: H, x0, cy, tw, size }
}
// 画一张镀铬字贴图。(x, y) 是锚点：align = center（字心）/ left（字的起点）/ right（字的终点），y 是字的竖直中线
// o = { s, sx, sy, rot, dx, dy, a, liq, ph, shine }；part = 'back' | 'face' | 'both'
export function draw(ctx, T, x, y, o = {}, part = 'both', align = 'center') {
  if ((o.a ?? 1) <= 0.001) return
  ctx.save()
  ctx.translate(x + (o.dx || 0), y + (o.dy || 0))
  if (o.rot) ctx.rotate(o.rot)
  const s = o.s ?? 1
  ctx.scale(s * (o.sx ?? 1), s * (o.sy ?? 1))
  ctx.globalAlpha *= clamp(o.a ?? 1)
  const ox = -(align === 'left' ? T.x0 : align === 'right' ? T.x0 + T.tw : T.x0 + T.tw / 2), oy = -T.cy
  const layers = part === 'back' ? [T.back] : part === 'face' ? [T.face] : [T.back, T.face]
  const liq = o.liq || 0
  for (const cv of layers) {
    if (liq > 0.002) {
      // 液化：按横条正弦错位
      const strip = 3, amp = liq * T.size * 0.3, ph = o.ph ?? 0
      for (let sy = 0; sy < T.h; sy += strip) {
        const h = Math.min(strip + 0.6, T.h - sy), dx = amp * Math.sin(sy / T.size * 4.2 + ph) + amp * 0.3 * Math.sin(sy / T.size * 8.5 - ph * 1.7)
        ctx.drawImage(cv, 0, sy, T.w, h, ox + dx, oy + sy, T.w, h)
      }
    } else ctx.drawImage(cv, ox, oy)
  }
  if (part !== 'back' && liq <= 0.002 && o.shine != null && o.shine > 0 && o.shine < 1) {
    const bx = ox - T.size + (T.w + T.size * 2) * o.shine
    ctx.beginPath(); ctx.moveTo(bx, oy); ctx.lineTo(bx + T.size * 0.35, oy); ctx.lineTo(bx - T.size * 0.15, oy + T.h); ctx.lineTo(bx - T.size * 0.5, oy + T.h); ctx.closePath(); ctx.clip()
    ctx.globalAlpha *= 0.75; ctx.drawImage(T.mask, ox, oy)
  }
  ctx.restore()
}
// 一组贴图：先画全部底层，再画全部字面。list 的每项 { T, x, y, o, align }
export function drawSet(ctx, list) {
  for (const part of ['back', 'face']) for (const it of list) draw(ctx, it.T, it.x, it.y, it.o || {}, part, it.align || 'center')
}
// 一串字逐个用单字贴图拼起来（滚动的数字每一帧都不同，整串做贴图会每帧重算）。返回总宽
export function glyphRun(ctx, E, str, x, y, size, o = {}) {
  const role = o.role || 'num', wt = o.w ?? 900, pr = probe(E)
  pr.font = E.font(role, wt, size)
  const chars = [...String(str)], adv = chars.map(ch => pr.measureText(ch).width), total = adv.reduce((p, q) => p + q, 0)
  let cx = o.align === 'right' ? x - total : o.align === 'left' ? x : x - total / 2
  const list = chars.map((ch, i) => { const it = { T: tex(E, ch, size, { kind: o.kind, role, w: wt }), x: cx, y, align: 'left', o: { shine: o.shine } }; cx += adv[i]; return it })
  drawSet(ctx, list)
  return total
}
export const textW = (E, str, role, wt, size) => { const pr = probe(E); pr.font = E.font(role, wt, size); return pr.measureText(String(str)).width }

// ---------- 四角星闪光：预先画好带光晕的贴图，逐帧只贴 ----------
const SR = 60, SN = 192
function starSprite(E, col) {
  return E.once('chrome:star' + col, () => {
    const cv = E.createCanvas(SN, SN), c = cv.getContext('2d')
    c.translate(SN / 2, SN / 2)
    const path = (R, k) => { c.beginPath(); c.moveTo(0, -R); c.quadraticCurveTo(R * k, -R * k, R, 0); c.quadraticCurveTo(R * k, R * k, 0, R); c.quadraticCurveTo(-R * k, R * k, -R, 0); c.quadraticCurveTo(-R * k, -R * k, 0, -R); c.closePath() }
    c.shadowColor = col; c.shadowBlur = SR * 0.7; path(SR, 0.13); c.fillStyle = col; c.fill()
    c.shadowBlur = 0; path(SR * 0.55, 0.16); c.fillStyle = '#ffffff'; c.fill()
    return cv
  })
}
export function star(ctx, E, x, y, r, o = {}) {
  if (r <= 0.5 || (o.a ?? 1) <= 0) return
  const k = r / SR * SN / 2
  ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.globalAlpha *= clamp(o.a ?? 1)
  ctx.drawImage(starSprite(E, o.color || '#ffffff'), -k, -k, 2 * k, 2 * k); ctx.restore()
}
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
// 一组星在 t0 爆开：从中心向外飞，闪一下后熄灭
export function burst(ctx, E, x, y, t, t0, o = {}) {
  const n = o.n ?? 7, R = (o.R ?? 220) * E.u, life = o.life ?? 0.9, seed = o.seed ?? 1, k = pal(E)
  const p = prog(t, t0, life)
  if (p <= 0 || p >= 1) return
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + hash(seed + i) * 0.7, d = R * (0.45 + 0.55 * hash(seed * 3 + i)) * outCubic(p)
    const r = (o.r ?? 24) * E.u * (0.6 + 0.6 * hash(seed * 7 + i)) * Math.sin(Math.PI * Math.min(1, p * 1.3))
    star(ctx, E, x + Math.cos(ang) * d, y + Math.sin(ang) * d * (o.squash ?? 1), r, { rot: p * 2 * (i % 2 ? 1 : -1), color: [k.lime, k.pink, k.cyan, '#ffffff'][i % 4] })
  }
}
// 常驻闪烁的星
export function twinkle(ctx, E, x, y, r, t, t0, seed = 0, color) {
  if (t < t0) return
  const ph = (t * 1.3 + hash(seed) * 3) % 1.6, k = ph < 0.5 ? Math.sin(Math.PI * ph / 0.5) : 0, a = prog(t, t0, 0.2)
  star(ctx, E, x, y, r * (0.35 + 0.65 * k) * a, { rot: t * 0.6 + seed, color: color || '#ffffff', a })
}

// ---------- 贴纸、标签、面板 ----------
// 白边模切贴纸（中心锚点）：o = { fill, r, m（变换）, f（E.fit 的结果，居中写在贴纸上）, fg, role, weight }
export function sticker(ctx, E, x, y, w, h, o = {}) {
  const k = pal(E), u = E.u, b = 7 * u, r = o.r ?? Math.min(h / 2, 28 * u)
  ctx.save(); around(ctx, x, y, o.m || {}); ctx.translate(x, y)
  ctx.fillStyle = rgba(k.ink, 0.45); roundRect(ctx, -w / 2 - b + 9 * u, -h / 2 - b + 13 * u, w + 2 * b, h + 2 * b, r + b); ctx.fill()
  ctx.fillStyle = '#ffffff'; roundRect(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, r + b); ctx.fill()
  const fill = o.fill || k.lime, g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  g.addColorStop(0, mix(fill, '#ffffff', 0.35)); g.addColorStop(0.5, fill); g.addColorStop(1, mix(fill, '#000000', 0.12))
  ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fill()
  ctx.lineWidth = 3 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.save(); roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; roundRect(ctx, -w / 2 + 10 * u, -h / 2 + 5 * u, w - 20 * u, Math.min(h * 0.2, 26 * u), 13 * u); ctx.fill(); ctx.restore()
  if (o.f) { ctx.fillStyle = o.fg || k.ink; ctx.font = E.font(o.role || 'body', o.weight ?? 900, o.f.size); drawLines(ctx, o.f.lines, 0, -o.f.lines.length * o.f.lineH / 2 + 2 * u, o.f.lineH, 'center') }
  ctx.restore()
}
// 深色胶囊标签：f 是 E.fit 的结果，(x, y) 是锚点（y 为竖直中心）；o = { align, bg, border, fg, role, weight, a }。返回占的框
export function tag(ctx, E, f, x, y, o = {}) {
  const k = pal(E), u = E.u, size = f.size, padX = size * 0.62, padY = size * 0.3
  const w = f.width + padX * 2, h = f.lines.length * f.lineH + padY * 2
  const lx = o.align === 'left' ? x : o.align === 'right' ? x - w : x - w / 2, ty = y - h / 2
  ctx.save(); ctx.globalAlpha *= clamp(o.a ?? 1)
  ctx.fillStyle = o.bg || rgba(k.card, 0.92); roundRect(ctx, lx, ty, w, h, f.lines.length > 1 ? size * 0.7 : h / 2); ctx.fill()
  ctx.lineWidth = 2.5 * u; ctx.strokeStyle = o.border || rgba(k.silver, 0.9); ctx.stroke()
  ctx.fillStyle = o.fg || k.white; ctx.font = E.font(o.role || 'body', o.weight ?? 700, size)
  drawLines(ctx, f.lines, lx + w / 2, ty + padY, f.lineH, 'center')
  ctx.restore()
  return { x: lx, y: ty, w, h }
}
// 镀铬边框面板（左上角坐标）：金属渐变的边，深色的里子
export function chromePanel(ctx, E, x, y, w, h, o = {}) {
  const k = pal(E), u = E.u, r = Math.min(o.r ?? 30 * u, w / 2, h / 2), b = o.border ?? 10 * u
  ctx.save()
  ctx.fillStyle = rgba(k.ink, 0.42); roundRect(ctx, x + 9 * u, y + 14 * u, w, h, r); ctx.fill()
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#9aa0c8'); g.addColorStop(0.5, mix(k.violet, '#000000', 0.35)); g.addColorStop(0.58, mix(k.pink, '#ffffff', 0.82)); g.addColorStop(1, mix(k.violet, '#ffffff', 0.62))
  ctx.fillStyle = g; roundRect(ctx, x, y, w, h, r); ctx.fill()
  ctx.lineWidth = 3 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.fillStyle = o.fill || k.card; roundRect(ctx, x + b, y + b, w - b * 2, h - b * 2, Math.max(0, r - b * 0.6)); ctx.fill()
  ctx.lineWidth = 2 * u; ctx.stroke()
  ctx.restore()
}
// 圆形徽章贴纸：白边、彩色底、深色数字
export function dot(ctx, E, x, y, r, fill, label, o = {}) {
  const k = pal(E), u = E.u
  ctx.save()
  ctx.fillStyle = rgba(k.ink, 0.45); ctx.beginPath(); ctx.arc(x + 5 * u, y + 8 * u, r + 6 * u, 0, TAU); ctx.fill()
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, r + 6 * u, 0, TAU); ctx.fill()
  const g = ctx.createLinearGradient(0, y - r, 0, y + r)
  g.addColorStop(0, mix(fill, '#ffffff', 0.4)); g.addColorStop(0.5, fill); g.addColorStop(1, mix(fill, '#000000', 0.15))
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  if (label != null) { ctx.fillStyle = o.fg || k.ink; ctx.font = E.font('num', 900, r * 1.05); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(label), x, y + r * 0.05) }
  ctx.restore()
}
// 镀铬柱：横向金属渐变、深色描边、一道高光条。竖着时 x 是柱心、base 是柱底；horiz 时 x 是左端、base 是柱心
export function pillar(ctx, E, x, base, w, h, col, horiz = false) {
  if (h <= 1) return
  const k = pal(E), u = E.u, r = Math.min(16 * u, w / 2, h / 2)
  const [rx, ry, rw, rh] = horiz ? [x, base - w / 2, h, w] : [x - w / 2, base - h, w, h]
  ctx.save()
  ctx.fillStyle = rgba(k.ink, 0.42); roundRect(ctx, rx + 9 * u, ry + 12 * u, rw, rh, r); ctx.fill()
  const g = horiz ? ctx.createLinearGradient(0, ry, 0, ry + rh) : ctx.createLinearGradient(rx, 0, rx + rw, 0)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, col); g.addColorStop(0.55, mix(k.violet, '#000000', 0.25)); g.addColorStop(0.63, col); g.addColorStop(1, '#ffffff')
  ctx.fillStyle = g; roundRect(ctx, rx, ry, rw, rh, r); ctx.fill()
  ctx.lineWidth = 3.5 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  if (horiz) roundRect(ctx, rx + 8 * u, ry + rh * 0.14, Math.max(0, rw - 16 * u), Math.min(12 * u, rh * 0.18), 6 * u); else roundRect(ctx, rx + rw * 0.14, ry + 8 * u, Math.min(12 * u, rw * 0.18), Math.max(0, rh - 16 * u), 6 * u)
  ctx.fill()
  ctx.restore()
}
// 液态光圈：一圈晃动的椭圆，深色衬边 + 半透明宽描边当发光 + 彩色本体 + 白色细芯
export function ring(ctx, E, x, y, rx, ry, t, o = {}) {
  const a = clamp(o.a ?? 1), p = clamp(o.p ?? 1), k = pal(E), u = E.u
  if (a <= 0 || p <= 0) return
  const n = 140, wob = o.wob ?? 0.04, w = (o.w ?? 16) * u, col = o.color || k.lime
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let i = 0; i <= n * p; i++) {
    const th = -Math.PI / 2 + (i / n) * TAU, q = 1 + wob * Math.sin(th * 5 + t * 2.4) + wob * 0.6 * Math.sin(th * 3 - t * 1.7)
    const px = x + Math.cos(th) * rx * q, py = y + Math.sin(th) * ry * q
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)
  }
  for (const [lw, c] of [[w * 2.6, rgba(col, 0.18)], [w + 7 * u, k.ink], [w, col], [w * 0.28, 'rgba(255,255,255,0.85)']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke() }
  ctx.restore()
}
// 彩虹光盘（中心锚点）：锥形渐变按 t 转，同心细纹，中孔
export function disc(ctx, E, x, y, r, t, o = {}) {
  const k = pal(E), u = E.u
  ctx.save(); ctx.globalAlpha *= clamp(o.a ?? 1)
  ctx.fillStyle = rgba(k.ink, 0.4); ctx.beginPath(); ctx.arc(x + 8 * u, y + 14 * u, r, 0, TAU); ctx.fill()
  const g = ctx.createConicGradient(t * 1.2 + (o.ph || 0), x, y)
  const cols = ['#e9ecff', mix(k.pink, '#ffffff', 0.55), '#c7a6ff', '#8ff7ff', mix(k.lime, '#ffffff', 0.5), '#ffffff', mix(k.pink, '#ffffff', 0.65), '#a9b0ff', '#e9ecff']
  cols.forEach((c, i) => g.addColorStop(i / (cols.length - 1), c))
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.lineWidth = 1.2 * u; ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  for (let q = 0.45; q < 0.98; q += 0.08) { ctx.beginPath(); ctx.arc(x, y, r * q, 0, TAU); ctx.stroke() }
  ctx.fillStyle = '#d8dcf5'; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.fill(); ctx.lineWidth = 3 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.fillStyle = k.deep; ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, TAU); ctx.fill(); ctx.stroke()
  ctx.restore()
}
// 镀铬液滴（装饰）
export function blob(ctx, E, x, y, r, t, seed = 0) {
  const k = pal(E)
  ctx.save(); ctx.translate(x, y); ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * TAU, q = 1 + 0.12 * Math.sin(th * 3 + t * 1.5 + seed) + 0.07 * Math.sin(th * 5 - t * 2.1 + seed * 2)
    i ? ctx.lineTo(Math.cos(th) * r * q, Math.sin(th) * r * q) : ctx.moveTo(Math.cos(th) * r * q, Math.sin(th) * r * q)
  }
  ctx.closePath()
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r * 1.1)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#e3e6ff'); g.addColorStop(0.6, '#8b86c4'); g.addColorStop(0.8, mix(k.pink, '#ffffff', 0.45)); g.addColorStop(1, k.violet)
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3 * E.u; ctx.strokeStyle = rgba(k.ink, 0.7); ctx.stroke()
  ctx.restore()
}
// 粗箭头（深色衬边）
export function arrow(ctx, E, x1, y1, x2, y2, o = {}) {
  const k = pal(E), u = E.u, w = (o.w ?? 12) * u, col = o.color || '#ffffff', ang = Math.atan2(y2 - y1, x2 - x1), hl = w * 2.2
  const ex = x2 - Math.cos(ang) * hl * 0.8, ey = y2 - Math.sin(ang) * hl * 0.8
  ctx.save(); ctx.globalAlpha *= clamp(o.a ?? 1); ctx.lineCap = 'round'
  for (const [lw, c] of [[w + 7 * u, k.ink], [w, col]]) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke() }
  ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - Math.cos(ang - 0.5) * hl, y2 - Math.sin(ang - 0.5) * hl); ctx.lineTo(x2 - Math.cos(ang + 0.5) * hl, y2 - Math.sin(ang + 0.5) * hl); ctx.closePath()
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3.5 * u; ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.restore()
}
// 超宽字距的英文点缀（深色描边）
export function wide(ctx, E, text, x, y, o = {}) {
  const k = pal(E), size = o.size, sp = o.sp ?? size * 0.6
  ctx.save(); ctx.font = E.font('body', 600, size); ctx.textBaseline = 'middle'
  const chars = [...text], ws = chars.map(c => ctx.measureText(c).width), tw = ws.reduce((p, q) => p + q, 0) + sp * (chars.length - 1)
  let cx = o.align === 'right' ? x - tw : o.align === 'center' ? x - tw / 2 : x
  ctx.textAlign = 'left'; ctx.lineWidth = Math.max(3, size * 0.18); ctx.strokeStyle = rgba(k.ink, 0.85); ctx.lineJoin = 'round'
  chars.forEach((c, i) => { ctx.strokeText(c, cx, y); ctx.fillStyle = o.color || '#ffffff'; ctx.fillText(c, cx, y); cx += ws[i] + sp })
  ctx.restore()
}
// 光标（按钮旁边点一下）
export function cursor(ctx, E, x, y, s) {
  const k = pal(E), h = s / 2
  ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, s * 0.08)
  ctx.beginPath(); ctx.moveTo(-h * 0.5, -h); ctx.lineTo(h * 0.6, h * 0.15); ctx.lineTo(h * 0.05, h * 0.2); ctx.lineTo(h * 0.35, h * 0.85); ctx.lineTo(h * 0.1, h * 0.95); ctx.lineTo(-h * 0.18, h * 0.32); ctx.lineTo(-h * 0.5, h * 0.62); ctx.closePath()
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = k.ink; ctx.stroke()
  ctx.restore()
}
