// 剪贴拼贴的画法库：撕纸、胶带、回形针、订书钉、半调网点、爆炸星贴纸、剪字（每个字一块底）、手写批注和手画笔画。
// 移植自风格库的 N-剪贴拼贴 的 lib/clip.mjs。改动：颜色从主题的 c 取（pal），字体走引擎的四类字体，
// 入场按这一场里元素的入场时刻算（dt = s.t - s.cue(i)），贴图用 E.once 缓存，新加订书钉和剪刀记号。
import { mix, hexToRgb } from '../../../core.mjs'

const TAU = Math.PI * 2
export const CORE = '#fbf8f1'   // 撕边露出的白芯

// 八个主题色，加几种固定的旧纸色和跳色（芥末黄、灰蓝、浅粉、荧光黄绿……）
export function pal(c) {
  return {
    kraft: c.bg, ink: c.fg, gray: c.muted, hot: c.accent, alt: c.accent2, cream: c.card, pen: c.line, on: c.onAccent,
    white: mix(c.card, '#ffffff', 0.6), news: mix(c.card, c.muted, 0.16),
    mustard: '#e2a62e', sky: '#9cc3d5', blush: '#efb7a4', lime: '#cfee3a', blue: '#3b62a3', olive: '#7d8a3c', rust: '#b5622f', note: '#f7df72', bluepen: '#2342a8',
  }
}
export const isLight = hex => { const [r, g, b] = hexToRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.56 }
export function hash(a, b = 0) { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s) }
const geo = new Map()
function memo(key, fn) { let v = geo.get(key); if (!v) { v = fn(); geo.set(key, v) } return v }

// ---------- 纹理 ----------
// 纸面颗粒：深浅斑点加短纤维，可平铺
export function grain(E) {
  return E.once('clip:grain', () => {
    const n = 256, c = E.createCanvas(n, n), g = c.getContext('2d'), r = E.rng(7)
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? 'rgba(60,40,20,0.10)' : 'rgba(255,250,235,0.10)'; g.fillRect(r() * n, r() * n, 1 + r() * 1.6, 1 + r() * 1.6) }
    g.lineCap = 'round'
    for (let i = 0; i < 90; i++) {
      const x = r() * n, y = r() * n, a = r() * Math.PI, l = 4 + r() * 12
      g.strokeStyle = r() < 0.5 ? 'rgba(70,45,20,0.14)' : 'rgba(255,248,230,0.16)'; g.lineWidth = 0.7
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + r() * 3, y + Math.sin(a) * l * 0.5 + r() * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke()
    }
    return c
  })
}
export function dotsTile(E, color, step = 14, rad = 0.36) {
  return E.once(`clip:dots:${color}:${step}:${rad}`, () => {
    const c = E.createCanvas(step * 2, step * 2), g = c.getContext('2d')
    g.fillStyle = color
    for (const [x, y] of [[0, 0], [step, step], [step * 2, 0], [0, step * 2], [step * 2, step * 2]]) { g.beginPath(); g.arc(x, y, step * rad, 0, TAU); g.fill() }
    return c
  })
}

// ---------- 撕纸 ----------
// 以 (0,0) 为中心、w×h 的纸片轮廓；sides 里列出的边是撕的（锯齿），其余是剪刀剪的直边
export function tornPoly(w, h, seed, rough = 6, sides = 'tblr') {
  return memo(`poly:${w | 0}:${h | 0}:${seed}:${rough.toFixed(1)}:${sides}`, () => {
    const pts = []
    const edge = (x0, y0, x1, y1, torn, sd) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(len / (torn ? 9 : 400)))
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len
      for (let i = 0; i < n; i++) {
        const p = i / n, j = torn ? (hash(i + sd * 13, seed) - 0.5) * 2 * rough + Math.sin(p * 9 + seed) * rough * 0.5 : 0
        pts.push([x0 + (x1 - x0) * p + nx * j, y0 + (y1 - y0) * p + ny * j])
      }
    }
    const hw = w / 2, hh = h / 2, cj = k => (hash(k, seed) - 0.5) * Math.min(w, h) * 0.04
    edge(-hw + cj(1), -hh + cj(2), hw + cj(3), -hh + cj(4), sides.includes('t'), 1)
    edge(hw + cj(3), -hh + cj(4), hw + cj(5), hh + cj(6), sides.includes('r'), 2)
    edge(hw + cj(5), hh + cj(6), -hw + cj(7), hh + cj(8), sides.includes('b'), 3)
    edge(-hw + cj(7), hh + cj(8), -hw + cj(1), -hh + cj(2), sides.includes('l'), 4)
    return pts
  })
}
export function polyPath(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath() }

// 纸片在空中的高度：put() 入场时投影更远更虚，落定后贴紧
const K = { lift: 0 }
function shadowOn(ctx, E, k = 1) {
  const l = K.lift, u = E.u
  ctx.shadowColor = `rgba(45,28,10,${0.34 * k})`; ctx.shadowBlur = (5 + l * 26) * u; ctx.shadowOffsetX = (3 + l * 16) * u; ctx.shadowOffsetY = (5 + l * 22) * u
}
function shadowOff(ctx) { ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0 }

// 纸片：撕边露白芯、底色、纹理、颗粒。tex: news 印刷行 / dots 网点 / grid 方格 / lines 横线本
export function scrap(ctx, E, w, h, { fill, seed = 1, torn = 'tblr', rough = 6, tex = null, texColor = null, shadow = 1, core = true } = {}) {
  const u = E.u, outer = tornPoly(w, h, seed, rough * u, torn), inner = tornPoly(w - 5 * u, h - 5 * u, seed + 101, rough * u, torn)
  ctx.save()
  if (shadow) shadowOn(ctx, E, shadow)
  ctx.fillStyle = core && torn ? CORE : fill
  polyPath(ctx, outer); ctx.fill()
  shadowOff(ctx)
  if (core && torn) { ctx.fillStyle = fill; polyPath(ctx, inner); ctx.fill() }
  polyPath(ctx, core && torn ? inner : outer); ctx.clip()
  if (tex) paperTex(ctx, E, w, h, tex, texColor || (isLight(fill) ? 'rgba(40,30,20,0.13)' : 'rgba(255,245,225,0.16)'), seed)
  ctx.globalAlpha *= 0.55
  ctx.fillStyle = ctx.createPattern(grain(E), 'repeat'); ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.restore()
}
export function paperTex(ctx, E, w, h, tex, color, seed = 1) {
  const u = E.u
  ctx.save()
  if (tex === 'news') {
    ctx.fillStyle = color
    const cols = Math.max(1, Math.round(w / (230 * u))), cw = w / cols, lh = 15 * u
    for (let c = 0; c < cols; c++) for (let y = -h / 2 + 10 * u, i = 0; y < h / 2 - 6 * u; y += lh, i++) ctx.fillRect(-w / 2 + c * cw + 10 * u, y, cw * (0.62 + 0.3 * hash(i + c * 50, seed)) - 18 * u, 6 * u)
  } else if (tex === 'dots') {
    ctx.fillStyle = ctx.createPattern(dotsTile(E, color, 12, 0.32), 'repeat'); ctx.fillRect(-w / 2, -h / 2, w, h)
  } else if (tex === 'grid') {
    ctx.strokeStyle = 'rgba(70,120,170,0.22)'; ctx.lineWidth = 1.2 * u
    for (let x = -w / 2; x < w / 2; x += 26 * u) { ctx.beginPath(); ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); ctx.stroke() }
    for (let y = -h / 2; y < h / 2; y += 26 * u) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke() }
  } else if (tex === 'lines') {
    ctx.strokeStyle = 'rgba(70,110,170,0.28)'; ctx.lineWidth = 1.6 * u
    for (let y = -h / 2 + 34 * u; y < h / 2; y += 34 * u) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke() }
    ctx.strokeStyle = 'rgba(210,60,60,0.35)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 46 * u, -h / 2); ctx.lineTo(-w / 2 + 46 * u, h / 2); ctx.stroke()
  }
  ctx.restore()
}

// 胶带：半透明，两端锯齿
export function tape(ctx, E, x, y, w, h, rot = 0, { color = 'rgba(238,228,196,0.78)', seed = 3 } = {}) {
  const u = E.u
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  const pts = tornPoly(w, h, seed, 3.2 * u, 'lr')
  ctx.shadowColor = 'rgba(50,30,10,0.18)'; ctx.shadowBlur = 3 * u; ctx.shadowOffsetY = 1.5 * u
  ctx.fillStyle = color; polyPath(ctx, pts); ctx.fill()
  shadowOff(ctx); ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(-w / 2, -h / 2, w, h * 0.28)
  ctx.restore()
}
export const PINK_TAPE = 'rgba(255,90,150,0.55)'

// 半调网点：fn(fx, fy) 给出每个点的大小（0..1），网格转 angle
export function halftone(g, x0, y0, w, h, color, step, angle, fn) {
  const ca = Math.cos(angle), sa = Math.sin(angle), R = Math.hypot(w, h) / 2 + step, cx = x0 + w / 2, cy = y0 + h / 2
  g.save(); g.fillStyle = color
  for (let i = -R; i <= R; i += step) for (let j = -R; j <= R; j += step) {
    const x = cx + i * ca - j * sa, y = cy + i * sa + j * ca
    if (x < x0 - step || x > x0 + w + step || y < y0 - step || y > y0 + h + step) continue
    const v = fn((x - x0) / w, (y - y0) / h)
    if (v <= 0.03) continue
    g.beginPath(); g.arc(x, y, step * 0.66 * Math.sqrt(Math.min(1, v)), 0, TAU); g.fill()
  }
  g.restore()
}
// 网点图片块要用的透明网点层：从 (cx, cy) 那个角向里渐小。只算一次
export function dotLayer(E, w, h, color, cx = 1, cy = 0, step = 20) {
  w = Math.round(w); h = Math.round(h)
  return E.once(`clip:dl:${w}:${h}:${color}:${cx}:${cy}:${step}`, () => {
    const c = E.createCanvas(w, h)
    halftone(c.getContext('2d'), 0, 0, w, h, color, step * E.u, 0.4, (fx, fy) => 1.1 - Math.hypot(fx - cx, fy - cy) * 0.95)
    return c
  })
}
// 网点图片块：一张撕纸，上面一大片由一角向里渐小的粗网点（像杂志上剪下来的半调照片）
export function photo(ctx, E, w, h, { fill, dot, seed = 1, corner = [1, 0], torn = 'tblr', shadow = 1 } = {}) {
  scrap(ctx, E, w, h, { fill, seed, torn, rough: 7, shadow })
  ctx.save(); polyPath(ctx, tornPoly(w - 5 * E.u, h - 5 * E.u, seed + 101, 7 * E.u, torn)); ctx.clip()
  ctx.drawImage(dotLayer(E, w, h, dot, corner[0], corner[1]), -w / 2, -h / 2)
  ctx.restore()
}
// 错版印刷字：几块色版各自偏一点、正片叠底
export function misreg(g, E, s, x, y, size, { fam, wt = 900, align = 'center', plates = [['rgba(0,160,215,0.9)', -7, -4], ['rgba(235,40,140,0.9)', 6, 3], ['rgba(250,205,20,0.9)', 2, 8]] } = {}) {
  const u = E.u
  g.save(); g.globalCompositeOperation = 'multiply'
  g.font = `${wt} ${size}px ${fam || E.fonts.sans}`; g.textAlign = align; g.textBaseline = 'middle'
  for (const [c, dx, dy] of plates) { g.fillStyle = c; g.fillText(s, x + dx * u, y + dy * u) }
  g.restore()
}
// 爆炸星贴纸（杂志价签那种）
export function burst(ctx, E, r, { fill, n = 18, inner = 0.8, seed = 1, dots = 'rgba(255,255,255,0.22)' } = {}) {
  ctx.save(); shadowOn(ctx, E, 1); ctx.beginPath()
  for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, k = i % 2 ? inner * (0.96 + 0.08 * hash(i, seed)) : 1; ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k) }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); shadowOff(ctx); ctx.clip()
  if (dots) { ctx.fillStyle = ctx.createPattern(dotsTile(E, dots, 12, 0.32), 'repeat'); ctx.fillRect(-r, -r, r * 2, r * 2) }
  ctx.globalAlpha *= 0.5; ctx.fillStyle = ctx.createPattern(grain(E), 'repeat'); ctx.fillRect(-r, -r, r * 2, r * 2)
  ctx.restore()
}
// 回形针：两道嵌套的 U 形钢丝
export function clipWire(ctx, E, x, y, rot = 0, len = 120) {
  const u = E.u, L = len * u, wd = L * 0.3
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  const path = () => {
    ctx.beginPath(); ctx.moveTo(-wd * 0.18, L * 0.22); ctx.lineTo(-wd * 0.18, -L * 0.36); ctx.arc(0, -L * 0.36, wd * 0.18, Math.PI, 0); ctx.lineTo(wd * 0.18, L * 0.36)
    ctx.arc(0, L * 0.36, wd * 0.36, 0, Math.PI); ctx.lineTo(-wd * 0.36, -L * 0.42); ctx.arc(wd * 0.04, -L * 0.42, wd * 0.4, Math.PI, 0); ctx.lineTo(wd * 0.44, L * 0.1)
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.shadowColor = 'rgba(40,25,10,0.35)'; ctx.shadowBlur = 4 * u; ctx.shadowOffsetX = 3 * u; ctx.shadowOffsetY = 4 * u
  ctx.strokeStyle = '#6f747a'; ctx.lineWidth = 7 * u; path(); ctx.stroke(); shadowOff(ctx)
  ctx.strokeStyle = '#c9cdd2'; ctx.lineWidth = 4 * u; path(); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4 * u; ctx.translate(-1 * u, -1 * u); path(); ctx.stroke()
  ctx.restore()
}
// 订书钉：一道钢丝压在纸上，两头扎进纸里（两个小暗点）
export function staple(ctx, E, x, y, rot = 0, len = 54) {
  const u = E.u, L = len * u / 2
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.lineCap = 'round'
  ctx.fillStyle = 'rgba(40,25,10,0.45)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * L, 0, 3.2 * u, 0, TAU); ctx.fill() }
  ctx.shadowColor = 'rgba(40,25,10,0.4)'; ctx.shadowBlur = 2.5 * u; ctx.shadowOffsetX = 1.5 * u; ctx.shadowOffsetY = 2.5 * u
  ctx.strokeStyle = '#7a7f86'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.stroke(); shadowOff(ctx)
  ctx.strokeStyle = '#d4d8dc'; ctx.lineWidth = 2.4 * u; ctx.beginPath(); ctx.moveTo(-L + 2 * u, -1 * u); ctx.lineTo(L - 2 * u, -1 * u); ctx.stroke()
  ctx.restore()
}

// ---------- 入场、待机 ----------
// 入场动作，dt 是入场以后过了多久（秒）：slap 拍上去（从 1.2 倍落下、转正、落地一抖）/ drop 从上方掉落 / slide 从侧面滑入 / grow 长出 / fade 淡入
export function enter(E, dt, kind = 'slap', dir = 1, seed = 1) {
  const u = E.u, o = { s: 1, a: 1, dx: 0, dy: 0, r: 0, lift: 0 }
  if (dt < 0) { o.a = 0; return o }
  const sg = hash(seed, 3) < 0.5 ? -1 : 1
  if (kind === 'slap') { const p = E.clamp(dt / 0.2); o.s = E.lerp(1.2, 1, E.ease.in(p)); o.r = sg * 0.16 * (1 - E.ease.out(p)); o.lift = 1 - p; o.a = E.clamp(dt / 0.05) }
  else if (kind === 'drop') { const p = E.clamp(dt / 0.32); o.dy = -(1 - E.ease.in(p)) * 170 * u; o.r = sg * 0.3 * (1 - p); o.lift = 1 - p; o.a = E.clamp(dt / 0.06) }
  else if (kind === 'slide') { const p = E.clamp(dt / 0.34); o.dx = dir * (1 - E.ease.outExpo(p)) * 900 * u; o.r = dir * 0.12 * (1 - p); o.lift = 0.7 * (1 - p) }
  else if (kind === 'grow') { const p = E.clamp(dt / 0.3); o.s = E.ease.outBack(p); o.a = E.clamp(dt / 0.06); o.lift = 0.5 * (1 - p) }
  else if (kind === 'fade') o.a = E.clamp(dt / 0.25)
  // 落地一抖：入场动作结束后 0.24 秒衰减
  const land = kind === 'drop' ? 0.32 : kind === 'slide' ? 0.34 : 0.2
  if (kind !== 'fade' && dt > land && dt < land + 0.24) { const d = 1 - (dt - land) / 0.24; o.dx += 3.5 * u * d * Math.sin((dt - land) * 70); o.r += 0.018 * d * Math.sin((dt - land) * 55 + 1) }
  return o
}
// 定格抖动：每秒 8 格，位置和角度的极小跳动
export function boil(E, seed, amp = 1) { const st = Math.floor(E.T * 8); return { dx: (hash(st, seed) - 0.5) * 1.6 * E.u * amp, r: (hash(st, seed + 7) - 0.5) * 0.004 * amp } }
// 放置：(x, y) 是中心，rot 是落定后的角度，fn 在 (0,0) 处作画
export function put(ctx, E, dt, { x, y, rot = 0, kind = 'slap', dir = 1, seed = 1, s: s0 = 1, still = false, amp = 1 }, fn) {
  const o = enter(E, dt, kind, dir, seed)
  if (o.a <= 0.002) return
  const b = still ? { dx: 0, r: 0 } : boil(E, seed, amp)
  ctx.save(); ctx.globalAlpha *= o.a
  ctx.translate(x + o.dx + b.dx, y + o.dy); ctx.rotate(rot + o.r + b.r)
  const s = o.s * s0; ctx.scale(s, s)
  const keep = K.lift; K.lift = o.lift
  fn(ctx)
  K.lift = keep; ctx.restore()
}
// 整屏抖一下：list = [[入场后的秒数, 幅度, 时长]]
export function shake(E, list) {
  let x = 0, y = 0
  for (const [dt, amp, dur = 0.3] of list) { if (dt < 0 || dt > dur) continue; const d = 1 - dt / dur; x += amp * E.u * d * Math.sin(dt * 62); y += amp * E.u * d * 0.6 * Math.cos(dt * 51) }
  return { x, y }
}

// ---------- 剪字 ----------
// 一个字一块：不同底色、不同字体、各自略歪，有的撕边、有的带网点
const ransomFonts = E => [[E.fonts.serif, 900], [E.fonts.sans, 900], [E.fonts.hand, 700], [E.fonts.serif, 700], [E.fonts.sans, 700], [E.fonts.mono, 700]]
export const ransomPal = k => [k.cream, k.ink, k.pen, k.mustard, k.white, k.alt, k.news, k.hot, k.blue, k.lime, k.kraft, k.olive]
export function ransomLayout(ctx, E, text, size, seed, palette) {
  return E.once(`clip:rl:${text}:${size.toFixed(1)}:${seed}:${palette.join('')}`, () => {
    const r = E.rng(seed * 977 + text.length), F = ransomFonts(E)
    const toks = [...text]
    const blocks = []
    let x = 0, last = -1
    toks.forEach(ch => {
      if (ch === ' ') { x += size * 0.5; blocks.push(null); return }
      let bi = Math.floor(r() * palette.length); if (bi === last) bi = (bi + 1) % palette.length; last = bi
      const bg = palette[bi], latin = /[A-Za-z\d]/.test(ch)
      let fi = Math.floor(r() * F.length); if (latin && fi === 2) fi = 0
      const [fam, wt] = F[fi]
      const sz = size * (0.86 + r() * 0.24)
      ctx.font = `${wt} ${sz}px ${fam}`
      const gw = ctx.measureText(ch).width, padX = sz * (0.12 + r() * 0.12), padY = sz * (0.1 + r() * 0.1)
      const w = Math.max(gw + padX * 2, sz * (latin ? 0.62 : 0.9)), h = sz * 1.08 + padY * 2
      const color = isLight(bg) ? E.theme.c.fg : (r() < 0.25 ? '#cfee3a' : '#ffffff')
      blocks.push({ ch, bg, fam, wt, sz, w, h, x: x + w / 2, y: (r() - 0.5) * size * 0.12, rot: (r() - 0.5) * 0.16, torn: r() < 0.45 ? 'tblr' : '', dots: r() < 0.2, seed: Math.floor(r() * 9999), color })
      x += w + size * (0.02 + r() * 0.05)
    })
    const W = x - size * 0.04
    for (const b of blocks) if (b) b.x -= W / 2
    return { blocks, W, H: size * 1.4 }
  })
}
// 画一行剪字（以 (0,0) 为中心）。第 i 个字在 dt = i * step 时拍上来
export function ransom(ctx, E, lay, dt, step = 0.06) {
  lay.blocks.forEach((b, i) => {
    if (!b) return
    put(ctx, E, dt - i * step, { x: b.x, y: b.y, rot: b.rot, seed: b.seed, kind: 'slap', amp: 2 }, c => {
      scrap(c, E, b.w, b.h, { fill: b.bg, seed: b.seed, torn: b.torn, rough: 3, tex: b.dots ? 'dots' : null, core: !!b.torn })
      c.font = `${b.wt} ${b.sz}px ${b.fam}`; c.fillStyle = b.color; c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(b.ch, 0, b.sz * 0.05)
    })
  })
}
// 剪字排版：剪字比同字号的正常字宽约 1.38 倍，先按这个比例让 E.fit 折行和缩字号（放不下照常记进报告），
// 画的时候实际还宽（英文字母的字块比例更大），就把几行按同一个比例整体缩一点
const RF = 1.38
// oneLine：短标题宁可缩小放进一行；关掉时按字号折行（片头大标题用）
export function ransomFit(E, text, { size, maxW, maxLines = 1, maxH, lineGap = 1.55, oneLine = true }) {
  const f = E.fit(text, { role: 'title', weight: 900, size: size * RF, maxW, maxLines, maxH, lineGap: lineGap / RF, oneLine })
  return { lines: f.lines, size: f.size / RF, lineH: f.lineH, maxW }
}
// 画 ransomFit 排好的几行。align: left 时 x 是左边，center 时 x 是中线；y 是第一行的上沿。dry 时只量不画。
// 返回 { w 最宽一行, h, rows: [{cx, cy, w}], n 字块数 }
export function ransomLines(ctx, E, R, x, y, { align = 'center', dt = 99, step = 0.06, seed = 1, palette, dry = false } = {}) {
  let n = 0, wMax = 0
  const rows = [], lays = R.lines.map((ln, i) => ransomLayout(ctx, E, ln, R.size, seed + i * 31, palette))
  const k = Math.min(1, R.maxW / Math.max(...lays.map(l => l.W)))
  lays.forEach((lay, i) => {
    const w = lay.W * k, cx = align === 'left' ? x + w / 2 : x, cy = y + i * R.lineH + R.lineH / 2
    if (!dry) { ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ransom(ctx, E, lay, dt - n * step, step); ctx.restore() }
    n += lay.blocks.length; wMax = Math.max(wMax, w); rows.push({ cx, cy, w })
  })
  return { w: wMax, h: R.lines.length * R.lineH, rows, n }
}

// ---------- 手写和手画 ----------
// 手写：按进度逐字写出；每个字略歪、略上下错开（本机没有手写体时，靠这点抖动读出是手写的）
export function hand(ctx, E, s, x, y, size, { color, p = 1, align = 'center', wt = 600, rot = 0, seed = 1 } = {}) {
  if (p <= 0) return
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.font = `${wt} ${size}px ${E.fonts.hand}`; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const chars = [...s], full = ctx.measureText(s).width, vis = Math.round(chars.length * E.clamp(p))
  let cx = align === 'center' ? -full / 2 : align === 'right' ? -full : 0
  for (let i = 0; i < vis; i++) {
    const w = ctx.measureText(chars[i]).width
    ctx.save(); ctx.translate(cx + w / 2, (hash(i, seed) - 0.5) * size * 0.08); ctx.rotate((hash(i, seed + 5) - 0.5) * 0.12); ctx.fillText(chars[i], -w / 2, 0); ctx.restore()
    cx += w
  }
  ctx.restore()
}
// 把折线按 6px 重采样并加抖动，再按长度比例 p 画出一部分
function wob(E, pts, seed, amp) {
  const u = E.u, out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len / (6 * u)))
    const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1)
    for (let k = 0; k < n; k++) { const q = k / n, j = E.noise1(out.length * 0.09, seed) * amp * u; out.push([x0 + (x1 - x0) * q + nx * j, y0 + (y1 - y0) * q + ny * j]) }
  }
  out.push(pts[pts.length - 1])
  return out
}
export function pen(ctx, E, pts, p = 1, { color, w = 6, seed = 1, amp = 2.2, alpha = 1 } = {}) {
  if (p <= 0 || pts.length < 2) return
  const q = wob(E, pts, seed, amp)
  let total = 0; const seg = [0]
  for (let i = 1; i < q.length; i++) { total += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]); seg.push(total) }
  const lim = total * E.clamp(p)
  ctx.save(); ctx.globalAlpha *= alpha
  ctx.strokeStyle = color; ctx.lineWidth = w * E.u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1])
  for (let i = 1; i < q.length; i++) {
    if (seg[i] <= lim) ctx.lineTo(q[i][0], q[i][1])
    else { const f = (lim - seg[i - 1]) / (seg[i] - seg[i - 1] || 1); ctx.lineTo(E.lerp(q[i - 1][0], q[i][0], f), E.lerp(q[i - 1][1], q[i][1], f)); break }
  }
  ctx.stroke(); ctx.restore()
}
export function penEllipse(ctx, E, cx, cy, rx, ry, p, o = {}) {
  const pts = [], n = 64, turns = 1.12, a0 = -2.2
  for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * TAU * turns, k = 1 + 0.04 * Math.sin(i * 0.4 + (o.seed || 1)); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]) }
  pen(ctx, E, pts, p, o)
}
export function penArrow(ctx, E, x0, y0, x1, y1, p, { bend = 0.2, head = 26, ...o } = {}) {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend, my = (y0 + y1) / 2 + (x1 - x0) * bend, pts = []
  for (let i = 0; i <= 20; i++) { const q = i / 20; pts.push([(1 - q) * (1 - q) * x0 + 2 * q * (1 - q) * mx + q * q * x1, (1 - q) * (1 - q) * y0 + 2 * q * (1 - q) * my + q * q * y1]) }
  pen(ctx, E, pts, E.clamp(p / 0.8), o)
  const hp = E.clamp((p - 0.8) / 0.2)
  if (hp > 0) { const a = Math.atan2(y1 - my, x1 - mx), h = head * E.u; pen(ctx, E, [[x1 - Math.cos(a - 0.5) * h, y1 - Math.sin(a - 0.5) * h], [x1, y1], [x1 - Math.cos(a + 0.5) * h, y1 - Math.sin(a + 0.5) * h]], hp, { ...o, seed: (o.seed || 1) + 3 }) }
}
export function penCheck(ctx, E, x, y, s, p, o = {}) { pen(ctx, E, [[x - s * 0.5, y], [x - s * 0.12, y + s * 0.42], [x + s * 0.6, y - s * 0.5]], p, { w: 8, ...o }) }
// 剪刀记号（剪下来的优惠券虚线上用）
export function scissors(ctx, E, r, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = Math.max(3 * E.u, r * 0.14); ctx.lineCap = 'round'
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(-r * 0.62, sg * r * 0.38, r * 0.26, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.4, sg * r * 0.25); ctx.lineTo(r * 0.95, -sg * r * 0.18); ctx.stroke() }
  ctx.restore()
}
