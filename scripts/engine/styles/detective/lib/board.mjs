// 调查线索板的底层画法：软木板、镜头、红线、图钉、记号笔、手写字、转场。移植自风格库的 X-调查线索板（lib/board.mjs）。
// 全片是同一块板：第 i 场在板上的位置由 origin(i) 给出，相邻两场正好左右或上下相接；
// 软木纹理按板上的位置平铺，所以转场时两场的软木在接缝处接得上。
import { clamp, lerp, ease, noise1, rng, mix, rgba } from '../../../core.mjs'

const TAU = Math.PI * 2
// 按比例调亮调暗（k 大于 1 调亮），色相不变
export const tone = (hex, k) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('')

// 全部颜色从主题的八个颜色推出来："colors" 换了哪个，跟着变
export function pal(c) {
  return {
    cork: c.bg, paper: c.card, ink: c.fg, pencil: c.muted, red: c.accent, note: c.accent2, rule: c.line, on: c.onAccent,
    white: mix(c.card, '#ffffff', 0.62), pink: mix(c.accent, '#ffffff', 0.64), blue: mix(c.line, '#ffffff', 0.62),
    manila: mix(c.card, '#c08f45', 0.55), photo: mix(c.fg, '#141a22', 0.55), grid: mix(c.card, '#dfe9d8', 0.7), felt: mix(c.fg, '#000000', 0.55),
  }
}

// ---------- 软木 ----------
// 一块能四方平铺的软木贴图：大块明暗、颗粒、小黑孔、旧钉眼。只画一次
export function corkTile(E) {
  const c = E.theme.c
  return E.once('det:cork:' + c.bg, () => {
    const S = Math.round(900 * E.u), cv = E.createCanvas(S, S), g = cv.getContext('2d'), r = rng(42), k = S / 1024
    g.fillStyle = c.bg; g.fillRect(0, 0, S, S)
    const wrap = (x, y, m, fn) => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) if (x + dx > -m && x + dx < S + m && y + dy > -m && y + dy < S + m) fn(x + dx, y + dy) }
    for (let i = 0; i < 26; i++) {
      const x = r() * S, y = r() * S, rad = (80 + r() * 160) * k, light = r() < 0.5
      wrap(x, y, rad, (xx, yy) => {
        const gr = g.createRadialGradient(xx, yy, 0, xx, yy, rad)
        gr.addColorStop(0, light ? rgba(tone(c.bg, 1.6), 0.2) : rgba(tone(c.bg, 0.45), 0.24)); gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr; g.fillRect(xx - rad, yy - rad, rad * 2, rad * 2)
      })
    }
    const cols = [1.45, 1.65, 1.2, 0.78, 1.78, 1.1].map(f => tone(c.bg, f))
    for (let i = 0, n = Math.round(26000 * k * k); i < n; i++) {
      const x = r() * S, y = r() * S, rad = (0.8 + r() * r() * 3.6) * k, ry = rad * (0.6 + r() * 0.5), rot = r() * 3
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.globalAlpha = 0.35 + r() * 0.5
      wrap(x, y, 6 * k, (xx, yy) => { g.beginPath(); g.ellipse(xx, yy, rad, ry, rot, 0, TAU); g.fill() })
    }
    g.fillStyle = tone(c.bg, 0.45)
    for (let i = 0, n = Math.round(2600 * k * k); i < n; i++) { const x = r() * S, y = r() * S; g.globalAlpha = 0.4 + r() * 0.4; g.beginPath(); g.arc(x, y, (0.6 + r() * 1.3) * k, 0, TAU); g.fill() }
    for (let i = 0; i < 40; i++) { const x = r() * S, y = r() * S; g.globalAlpha = 0.6; g.beginPath(); g.arc(x, y, 2.2 * k, 0, TAU); g.fill() }
    g.globalAlpha = 1
    return cv
  })
}
// 在当前坐标系里铺满 [x0,x1]×[y0,y1]；坐标 (x, y) 处显示板上 (x + ox, y + oy) 的软木
export function corkRect(ctx, E, x0, y0, x1, y1, ox, oy) {
  const T = corkTile(E), S = T.width
  for (let gx = Math.floor((x0 + ox) / S) * S; gx < x1 + ox; gx += S)
    for (let gy = Math.floor((y0 + oy) / S) * S; gy < y1 + oy; gy += S) ctx.drawImage(T, gx - ox, gy - oy, S + 1, S + 1)
}

// ---------- 板上的位置 ----------
// 从第 i-1 场到第 i 场往哪走：蛇形，右、右、下、左、左、下……
const DIRS = [[1, 0], [1, 0], [0, 1], [-1, 0], [-1, 0], [0, 1]]
export const move = (E, i) => { const [a, b] = DIRS[(i - 1) % DIRS.length]; return [a * E.W, b * E.H] }
export function origin(E, i) { let x = 0, y = 0; for (let k = 1; k <= i; k++) { const [a, b] = move(E, k); x += a; y += b } return [x, y] }
// 每一场的红线都从右上角这枚钉子出发，连到下一场同一个位置的钉子
export const anchor = E => [E.W - E.pick(64, 40) * E.u, E.pick(56, 106) * E.u]

// ---------- 镜头 ----------
// 手持漂移：只平移不转动（转动会让转场的两场在接缝处错开），幅度几个像素，字读得清。
// s 给了就加上这一场的轻震（数字圈好、号牌钉上时）；转场时间里的震动跳过
export function drift(E, s, shakes = []) {
  const u = E.u, T = E.T
  let x = noise1(T * 0.35, 11) * 5 * u, y = noise1(T * 0.31, 12) * 4 * u
  if (s) for (const t0 of shakes) {
    const d = s.t - t0
    if (t0 < 0.9 || d < 0 || d > 0.4) continue
    const a = 7 * u * Math.exp(-d * 9)
    x += noise1(d * 40, 3) * a; y += noise1(d * 40, 7) * a
  }
  return [x, y]
}

// ---------- 阴影、入场 ----------
// 投影：同一个形状错开几个像素，两层半透明深色；拿起来时错得更开、更淡
export function drop(ctx, E, lift, path) {
  const u = E.u
  ctx.save(); ctx.fillStyle = `rgba(14,7,0,${0.17 - lift * 0.06})`; ctx.translate((6 + 16 * lift) * u, (9 + 22 * lift) * u); path(); ctx.fill(); ctx.restore()
  ctx.save(); ctx.fillStyle = `rgba(14,7,0,${0.24 - lift * 0.1})`; ctx.translate((2.5 + 8 * lift) * u, (4 + 11 * lift) * u); path(); ctx.fill(); ctx.restore()
}
// 把一件东西「拿起来按到板上」：d 是它入场以后过了多久（秒）。o: x y w h rot kind(drop|peel|slide|fade) from pin pinAt pins
// body(ctx, lift) 以 (0,0) 为中心画；钉子收进 o.pins，最后统一画在最上面
export function put(ctx, E, d, o, body) {
  if (d <= 0) return
  const D = o.dur ?? 0.34, p = clamp(d / D), e = ease.out(p), kind = o.kind || 'drop'
  let sc = 1, sy = 1, dr = 0, lift = 0, a = 1, dx = 0, dy = 0
  if (kind === 'drop') { sc = lerp(1.14, 1, e); dr = (1 - e) * (o.spin ?? 0.07); lift = 1 - e; a = clamp(d / 0.07) }
  else if (kind === 'peel') { sy = lerp(0.15, 1, ease.outBack(p)); lift = (1 - p) * 0.6; a = clamp(d / 0.06) }
  else if (kind === 'slide') { const [fx, fy] = o.from || [0, 300 * E.u]; dx = (1 - e) * fx; dy = (1 - e) * fy; dr = (1 - e) * (o.spin ?? 0.1); lift = 1 - e; a = clamp(d / 0.06) }
  else a = ease.inOut(p)
  ctx.save(); ctx.globalAlpha *= a
  ctx.translate(o.x + dx, o.y + dy); ctx.rotate((o.rot || 0) + dr); ctx.scale(sc, sc)
  if (sy !== 1) { ctx.translate(0, -o.h / 2); ctx.scale(1, sy); ctx.translate(0, o.h / 2) }
  body(ctx, lift)
  ctx.restore()
  if (o.pin && o.pins) { const k = clamp((d - D * 0.8) / 0.12); if (k > 0) { const [x, y] = pinPos(E, o); o.pins.push({ x, y, col: o.pin, k }) } }
}
// 钉子在画面上的位置（按物件落定后的角度算）
export function pinPos(E, o) {
  const [px, py] = o.pinAt || [0, -o.h / 2 + 20 * E.u], c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0)
  return [o.x + c * px - s * py, o.y + s * px + c * py]
}

// ---------- 图钉 ----------
// 预先画好的图钉贴图（带针影）；k 是按下去的进度，先大后小弹一下；r 是钉帽半径
export function pin(ctx, E, x, y, col, k = 1, r = 14 * E.u) {
  if (k <= 0) return
  const sp = E.once(`det:pin:${col}:${r.toFixed(1)}`, () => {
    const q = 2, R = r * q, S = Math.ceil(R * 3.4), c = R * 1.3, cv = E.createCanvas(S, S), g = cv.getContext('2d')
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(c + R * 0.6, c + R * 0.8, R * 0.95, R * 0.8, 0.5, 0, TAU); g.fill()
    const gr = g.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.1, c, c, R)
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.2, col); gr.addColorStop(1, tone(col, 0.55))
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, TAU); g.fill()
    return { cv, c: c / q, S: S / q }
  })
  const s = lerp(1.7, 1, ease.out(k))
  ctx.save(); ctx.globalAlpha *= clamp(k * 3); ctx.translate(x, y); ctx.scale(s, s); ctx.drawImage(sp.cv, -sp.c, -sp.c, sp.S, sp.S); ctx.restore()
}
export const pins = (ctx, E, P) => { for (const p of P) pin(ctx, E, p.x, p.y, p.col, p.k) }

// ---------- 红线 ----------
// 从 a 到 b 的二次曲线，中点下垂；p 画出几成；d 是画完以后过了多久（落定前晃一下）
export function string(ctx, E, a, b, p = 1, o = {}) {
  if (p <= 0) return
  const u = E.u, L = Math.hypot(b[0] - a[0], b[1] - a[1])
  const settle = clamp((o.d ?? 9) / 0.6), sag = (o.sag ?? 0.06) * L * (1 + (1 - settle) * 0.35 * Math.sin(settle * 9))
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + sag, n = Math.max(8, Math.min(40, Math.ceil(L / (30 * u)))), pts = []
  for (let i = 0; i <= n; i++) { const f = i / n * clamp(p), v = 1 - f; pts.push([v * v * a[0] + 2 * v * f * mx + f * f * b[0], v * v * a[1] + 2 * v * f * my + f * f * b[1]]) }
  const w = (o.w ?? 4.2) * u
  const path = (dx, dy) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy))) }
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w
  ctx.strokeStyle = 'rgba(10,5,0,0.32)'; path(w * 1.1, w * 1.7); ctx.stroke()
  ctx.strokeStyle = o.color; path(0, 0); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.26)'; ctx.lineWidth = w * 0.35; path(-w * 0.15, -w * 0.2); ctx.stroke()
  ctx.restore()
}
// 一根线：在 t0 开始拉，dur 秒拉完；t 是这一场的时刻
export const pull = (ctx, E, a, b, t, t0, o = {}) => string(ctx, E, a, b, ease.inOut(clamp((t - t0) / (o.dur ?? 0.4))), { ...o, d: t - t0 - (o.dur ?? 0.4) })

// 场与场之间的红线：这一场的钉子连上一场、下一场的钉子（下一场的那根在场尾拉出来）
export function links(ctx, E, s, c) {
  const i = s.index, A = anchor(E), [ox, oy] = origin(E, i)
  const at = j => { const [x, y] = origin(E, j); return [x - ox + A[0], y - oy + A[1]] }
  if (i > 0) string(ctx, E, at(i - 1), A, 1, { color: c.accent, sag: 0.045 })
  if (i < s.count - 1) string(ctx, E, A, at(i + 1), ease.inOut(clamp((s.t - (s.dur - 0.85)) / 0.7)), { color: c.accent, sag: 0.045 })
  pin(ctx, E, A[0], A[1], c.accent, 1)
}

// 转场：镜头顺着红线平移到下一块区域，中间略微拉远再推近。拉远时露出来的板面按板上的位置补画软木
export function pan(ctx, A, B, p, E, info) {
  const { W, H } = E, [dx, dy] = move(E, info.to), e = ease.inOut(p), z = 1 - 0.13 * Math.sin(Math.PI * p)
  const cx = dx * e, cy = dy * e, [sx, sy] = drift(E), [ox, oy] = origin(E, info.from)
  ctx.fillStyle = E.theme.c.bg; ctx.fillRect(0, 0, W, H)
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2 - cx, -H / 2 - cy)
  if (z < 0.999) {
    const hw = W / 2 / z + 4, hh = H / 2 / z + 4
    corkRect(ctx, E, W / 2 + cx - hw, H / 2 + cy - hh, W / 2 + cx + hw, H / 2 + cy + hh, Math.round(ox - sx), Math.round(oy - sy))
    if (info.from > 0) { const [px, py] = origin(E, info.from - 1), a = anchor(E); ctx.save(); ctx.translate(sx, sy); string(ctx, E, [px - ox + a[0], py - oy + a[1]], a, 1, { color: E.theme.c.accent, sag: 0.045 }); ctx.restore() }
  }
  ctx.drawImage(A, 0, 0); ctx.drawImage(B, dx, dy)
}

// 台灯：中间一点暖光，四周压暗。只算一次
export function lamp(ctx, E) {
  const cv = E.once('det:lamp', () => {
    const { W, H } = E, c = E.createCanvas(W, H), g = c.getContext('2d'), cx = W / 2, cy = E.portrait ? H * 0.4 : H * 0.46, R = Math.hypot(W, H) / 2
    const g1 = g.createRadialGradient(cx, cy, R * (E.portrait ? 0.44 : 0.42), cx, cy, R * 1.02)
    g1.addColorStop(0, 'rgba(12,6,0,0)'); g1.addColorStop(0.55, 'rgba(12,6,0,0.26)'); g1.addColorStop(1, 'rgba(8,4,0,0.66)')
    g.fillStyle = g1; g.fillRect(0, 0, W, H)
    const g2 = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.7)
    g2.addColorStop(0, 'rgba(255,190,110,0.07)'); g2.addColorStop(1, 'rgba(255,190,110,0)')
    g.fillStyle = g2; g.fillRect(0, 0, W, H)
    return c
  })
  ctx.drawImage(cv, 0, 0)
}

// ---------- 记号笔 ----------
// pts 折线，p 画出几成
export function stroke(ctx, E, pts, p, o = {}) {
  if (p <= 0 || pts.length < 2) return
  const lens = []
  let L = 0
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(d); L += d }
  let rem = L * Math.min(1, p)
  ctx.save(); ctx.strokeStyle = o.color; ctx.lineWidth = (o.w ?? 7) * E.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha *= o.alpha ?? 0.9
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length && rem > 0; i++) { const f = Math.min(1, rem / Math.max(1e-6, lens[i - 1])); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); rem -= lens[i - 1] }
  ctx.stroke(); ctx.restore()
}
// 手画的椭圆圈：转 1.12 圈，半径带噪声
export function ring(ctx, E, x, y, rx, ry, p, o = {}) {
  const n = 72, seed = o.seed ?? 1, a0 = o.a0 ?? -2.2, pts = []
  for (let i = 0; i <= n; i++) { const f = i / n, a = a0 + f * 1.12 * TAU, k = 1 + 0.045 * noise1(f * 6, seed) + f * 0.05; pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]) }
  stroke(ctx, E, pts, p, o)
}
// 一笔歪歪的直线（可带箭头）
export function scrawl(ctx, E, x1, y1, x2, y2, p, o = {}) {
  const n = 8, seed = o.seed ?? 3, amp = (o.amp ?? 3) * E.u, pts = []
  for (let i = 0; i <= n; i++) { const f = i / n; pts.push([lerp(x1, x2, f) + noise1(f * 3, seed) * amp, lerp(y1, y2, f) + noise1(f * 3, seed + 9) * amp]) }
  stroke(ctx, E, pts, o.head ? p * 1.25 : p, o)
  if (o.head && p > 0.8) {
    const ang = Math.atan2(y2 - y1, x2 - x1), L = (o.head === true ? 28 : o.head) * E.u
    stroke(ctx, E, [[x2 - Math.cos(ang - 0.5) * L, y2 - Math.sin(ang - 0.5) * L], [x2, y2], [x2 - Math.cos(ang + 0.5) * L, y2 - Math.sin(ang + 0.5) * L]], clamp((p - 0.8) / 0.2), o)
  }
}
export function check(ctx, E, x, y, s, p, o) { stroke(ctx, E, [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.4], [x + s * 0.6, y - s * 0.55]], p, o) }
// ≠：两道横、一道斜
export function neq(ctx, E, x, y, s, p, o) {
  stroke(ctx, E, [[x - s * 0.5, y - s * 0.18], [x + s * 0.5, y - s * 0.2]], clamp(p * 3), o)
  stroke(ctx, E, [[x - s * 0.5, y + s * 0.2], [x + s * 0.5, y + s * 0.18]], clamp(p * 3 - 1), o)
  stroke(ctx, E, [[x + s * 0.25, y - s * 0.55], [x - s * 0.25, y + s * 0.55]], clamp(p * 3 - 2), o)
}

// ---------- 手写字 ----------
// 逐字画：每个字带固定种子的小歪斜和上下错位，p 是写出了几成。字宽按实际字体量，手写体缺了退回黑体也照样排得下
const WCACHE = new Map()
function widths(ctx, font, chars, key) {
  const k = font + '|' + key
  let w = WCACHE.get(k)
  if (!w) { w = chars.map(ch => ctx.measureText(ch).width); WCACHE.set(k, w) }
  return w
}
export const seedOf = s => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) | 0; return h >>> 0 }
export function hand(ctx, E, text, x, y, o) {
  const chars = [...String(text)], font = E.font(o.role || 'body', o.weight ?? 600, o.size)
  ctx.font = font
  const ws = widths(ctx, font, chars, text), total = ws.reduce((a, b) => a + b, 0), jit = o.jit ?? 1
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x
  const r = rng(o.seed ?? seedOf(text)), vis = chars.length * clamp(o.p ?? 1)
  ctx.save(); ctx.fillStyle = o.color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  if (o.stroke) { ctx.strokeStyle = o.color; ctx.lineWidth = o.stroke; ctx.lineJoin = 'round' }
  chars.forEach((ch, i) => {
    const jr = (r() - 0.5) * 0.07 * jit, jy = (r() - 0.5) * o.size * 0.06 * jit, a = clamp(vis - i)
    if (a > 0 && ch.trim()) {
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(cx + ws[i] / 2, y + jy); ctx.rotate(jr)
      if (o.stroke) ctx.strokeText(ch, -ws[i] / 2, 0)
      ctx.fillText(ch, -ws[i] / 2, 0); ctx.restore()
    }
    cx += ws[i]
  })
  ctx.restore()
  return total
}
// 一段排好的字（E.fit 的结果）逐行手写；y 是第一行的顶，p 按全段字数分给各行
export function handLines(ctx, E, f, x, y, o) {
  const N = f.lines.reduce((a, l) => a + [...l].length, 0), vis = N * clamp(o.p ?? 1)
  let before = 0
  f.lines.forEach((ln, i) => {
    const L = [...ln].length
    hand(ctx, E, ln, x, y + i * f.lineH + f.lineH / 2, { ...o, size: f.size, p: clamp((vis - before) / Math.max(1, L)), seed: (o.seed ?? 5) + i * 17 })
    before += L
  })
}
