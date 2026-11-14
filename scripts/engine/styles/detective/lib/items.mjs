// 板上的物件：索引卡、拍立得（相片里只画图标和色块）、便签、撕下的纸条、胶带、坐标纸、档案夹、毡面字板、证物标签。
// 移植自风格库的 X-调查线索板（lib/items.mjs、lib/pics.mjs）。都以 (0,0) 为中心画，lift 是拿起来的高度（0 到 1），决定投影错开多少。
import { rng, rgba, mix } from '../../../core.mjs'
import { drop, tone } from './board.mjs'

const TAU = Math.PI * 2
const rectPath = (ctx, w, h) => () => { ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h) }

// 索引卡：横格蓝线，o.red 处一道红线（卡头），o.top/o.step 定横线
export function card(ctx, E, k, w, h, lift, o = {}) {
  const u = E.u
  drop(ctx, E, lift, rectPath(ctx, w, h))
  ctx.fillStyle = o.fill || k.paper; ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = 'rgba(120,95,60,0.35)'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(-w / 2 + 0.75 * u, -h / 2 + 0.75 * u, w - 1.5 * u, h - 1.5 * u)
  if (o.step) { ctx.strokeStyle = rgba(k.rule, 0.3); ctx.lineWidth = 2 * u; ctx.beginPath(); for (let y = o.top; y < h / 2 - 10 * u; y += o.step) { ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y) } ctx.stroke() }
  if (o.red != null) { ctx.strokeStyle = rgba(k.red, 0.62); ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(-w / 2, o.red); ctx.lineTo(w / 2, o.red); ctx.stroke() }
}

// 坐标纸：浅绿底、细方格
export function graph(ctx, E, k, w, h, lift) {
  const u = E.u, g = 30 * u
  drop(ctx, E, lift, rectPath(ctx, w, h))
  ctx.fillStyle = k.grid; ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = rgba(mix(k.grid, '#2f7a5a', 0.7), 0.24); ctx.lineWidth = 1.5 * u; ctx.beginPath()
  for (let x = -w / 2 + g; x < w / 2; x += g) { ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2) }
  for (let y = -h / 2 + g; y < h / 2; y += g) { ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y) }
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(-w / 2, -h / 2, w, h)
}

// 便签：下沿微微卷起
export function note(ctx, E, w, h, lift, color) {
  const u = E.u
  const path = () => { ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2 - 6 * u); ctx.quadraticCurveTo(w / 4, h / 2 + 4 * u, -w / 2, h / 2); ctx.closePath() }
  drop(ctx, E, lift * 0.8, path)
  ctx.fillStyle = color; path(); ctx.fill()
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.07)'); g.addColorStop(0.18, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.09)')
  ctx.fillStyle = g; ctx.fill()
}

// 撕下来的纸条：上下两条撕边
export function slip(ctx, E, w, h, lift, color, seed = 1) {
  const u = E.u, r = rng(seed), n = Math.max(6, Math.ceil(w / (26 * u))), top = [], bot = []
  for (let i = 0; i <= n; i++) { top.push((r() - 0.5) * 7 * u); bot.push((r() - 0.5) * 7 * u) }
  const path = () => {
    ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + top[0])
    for (let i = 1; i <= n; i++) ctx.lineTo(-w / 2 + w * i / n, -h / 2 + top[i])
    for (let i = n; i >= 0; i--) ctx.lineTo(-w / 2 + w * i / n, h / 2 + bot[i])
    ctx.closePath()
  }
  drop(ctx, E, lift * 0.8, path)
  ctx.fillStyle = color; path(); ctx.fill()
}

// 一截半透明胶带
export function tape(ctx, E, x, y, w, rot = 0) {
  const u = E.u, h = 40 * u
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = 'rgba(236,229,203,0.72)'; ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2)
  for (let i = 0; i <= 6; i++) ctx.lineTo(-w / 2 + (i % 2 ? 5 * u : 0), -h / 2 + h * i / 6)
  ctx.lineTo(w / 2, h / 2)
  for (let i = 6; i >= 0; i--) ctx.lineTo(w / 2 - (i % 2 ? 5 * u : 0), -h / 2 + h * i / 6)
  ctx.closePath(); ctx.fill(); ctx.restore()
}

// 拍立得：白框，下面一条写字的白边；相片里画图标（只算一次）
export function polaroid(ctx, E, k, w, h, lift, o = {}) {
  const u = E.u, m = o.m ?? 18 * u, capH = o.capH ?? 70 * u, pw = w - 2 * m, ph = h - m - capH
  drop(ctx, E, lift, rectPath(ctx, w, h))
  ctx.fillStyle = k.white; ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(-w / 2, -h / 2, w, h)
  if (ph > 4) ctx.drawImage(photo(E, k, o.icon || 'lens', pw, ph, o.seed ?? 1), -w / 2 + m, -h / 2 + m, pw, ph)
}
// 相片：深色渐变底、一两块色块、正中一个浅色图标剪影，加相纸暗角。不画人
export function photo(E, k, icon, w, h, seed) {
  return E.once(`det:photo:${icon}:${Math.round(w)}:${Math.round(h)}:${seed}:${k.photo}:${k.red}`, () => {
    const c = E.createCanvas(w, h), g = c.getContext('2d'), r = rng(seed * 7 + 3), u = E.u
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, tone(k.photo, 1.5)); bg.addColorStop(1, tone(k.photo, 0.8))
    g.fillStyle = bg; g.fillRect(0, 0, w, h)
    const blocks = [k.rule, k.note, k.red, k.pencil]
    for (let i = 0; i < 2; i++) { g.fillStyle = rgba(blocks[(seed + i) % blocks.length], 0.28); const bw = w * (0.3 + r() * 0.3), bh = h * (0.18 + r() * 0.3); g.fillRect(r() * (w - bw), r() * (h - bh), bw, bh) }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h * 0.78, w, h * 0.22)
    const s = Math.min(w, h) * 0.56
    ICON[icon in ICON ? icon : 'lens'](g, w / 2, h * 0.47, s, mix(k.paper, '#ffffff', 0.3), u)
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.62)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,8,0,0.4)')
    g.fillStyle = vg; g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(255,170,80,0.05)'; g.fillRect(0, 0, w, h)
    return c
  })
}

// 图标：以 (x, y) 为中心、边长约 s 的剪影
const ln = (g, c, lw) => { g.strokeStyle = c; g.fillStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round' }
export const ICON = {
  lens(g, x, y, s, c) { ln(g, c, s * 0.09); g.beginPath(); g.arc(x - s * 0.08, y - s * 0.08, s * 0.28, 0, TAU); g.stroke(); g.lineWidth = s * 0.13; g.beginPath(); g.moveTo(x + s * 0.13, y + s * 0.13); g.lineTo(x + s * 0.42, y + s * 0.42); g.stroke() },
  file(g, x, y, s, c) { ln(g, c, s * 0.07); g.beginPath(); g.moveTo(x - s * 0.3, y - s * 0.42); g.lineTo(x + s * 0.12, y - s * 0.42); g.lineTo(x + s * 0.3, y - s * 0.24); g.lineTo(x + s * 0.3, y + s * 0.42); g.lineTo(x - s * 0.3, y + s * 0.42); g.closePath(); g.stroke(); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - s * 0.16, y - s * 0.08 + i * s * 0.15); g.lineTo(x + s * 0.16, y - s * 0.08 + i * s * 0.15); g.stroke() } },
  key(g, x, y, s, c) { ln(g, c, s * 0.08); g.beginPath(); g.arc(x - s * 0.22, y, s * 0.17, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x - s * 0.05, y); g.lineTo(x + s * 0.42, y); g.moveTo(x + s * 0.3, y); g.lineTo(x + s * 0.3, y + s * 0.14); g.moveTo(x + s * 0.4, y); g.lineTo(x + s * 0.4, y + s * 0.11); g.stroke() },
  lock(g, x, y, s, c) { ln(g, c, s * 0.08); g.beginPath(); g.arc(x, y - s * 0.1, s * 0.2, Math.PI, 0); g.lineTo(x + s * 0.2, y + s * 0.02); g.moveTo(x - s * 0.2, y - s * 0.1); g.lineTo(x - s * 0.2, y + s * 0.02); g.stroke(); g.beginPath(); g.roundRect(x - s * 0.32, y, s * 0.64, s * 0.44, s * 0.06); g.fill() },
  clock(g, x, y, s, c) { ln(g, c, s * 0.08); g.beginPath(); g.arc(x, y, s * 0.42, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * 0.26); g.moveTo(x, y); g.lineTo(x + s * 0.2, y + s * 0.1); g.stroke() },
  eye(g, x, y, s, c) { ln(g, c, s * 0.08); g.beginPath(); g.moveTo(x - s * 0.5, y); g.quadraticCurveTo(x, y - s * 0.5, x + s * 0.5, y); g.quadraticCurveTo(x, y + s * 0.5, x - s * 0.5, y); g.stroke(); g.beginPath(); g.arc(x, y, s * 0.14, 0, TAU); g.fill() },
  globe(g, x, y, s, c) { ln(g, c, s * 0.07); g.beginPath(); g.arc(x, y, s * 0.42, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(x, y, s * 0.18, s * 0.42, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(x - s * 0.42, y); g.lineTo(x + s * 0.42, y); g.moveTo(x - s * 0.36, y - s * 0.2); g.lineTo(x + s * 0.36, y - s * 0.2); g.moveTo(x - s * 0.36, y + s * 0.2); g.lineTo(x + s * 0.36, y + s * 0.2); g.stroke() },
  steps(g, x, y, s, c) { ln(g, c, s * 0.07); for (let i = 0; i < 4; i++) { const px = x - s * 0.36 + i * s * 0.24, py = y + s * 0.3 - i * s * 0.2; g.beginPath(); g.ellipse(px, py + (i % 2 ? -s * 0.06 : s * 0.06), s * 0.07, s * 0.11, -0.4, 0, TAU); g.fill() } },
  chip(g, x, y, s, c) { ln(g, c, s * 0.05); const q = s * 0.5; for (let i = 0; i < 5; i++) { const d = -q / 2 + q * (i + 0.5) / 5; g.beginPath(); g.moveTo(x + d, y - q / 2); g.lineTo(x + d, y - q * 0.7); g.moveTo(x + d, y + q / 2); g.lineTo(x + d, y + q * 0.7); g.moveTo(x - q / 2, y + d); g.lineTo(x - q * 0.7, y + d); g.moveTo(x + q / 2, y + d); g.lineTo(x + q * 0.7, y + d); g.stroke() } g.lineWidth = s * 0.06; g.strokeRect(x - q / 2, y - q / 2, q, q); g.fillRect(x - q * 0.22, y - q * 0.22, q * 0.44, q * 0.44) },
  pin(g, x, y, s, c) { ln(g, c, s * 0.06); g.beginPath(); g.arc(x, y - s * 0.12, s * 0.22, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x, y + s * 0.1); g.lineTo(x, y + s * 0.42); g.stroke(); g.beginPath(); g.ellipse(x, y + s * 0.44, s * 0.24, s * 0.06, 0, 0, TAU); g.stroke() },
}
export const ICONS = ['lens', 'file', 'key', 'clock', 'eye', 'lock', 'globe', 'steps', 'chip', 'pin']

// 档案夹：后板带标签（标签宽 tabW、高 tabH，左缘在 tabX），前板略矮。tabFill 是标签的颜色
export function folder(ctx, E, k, w, h, lift, o) {
  const u = E.u, { tabW, tabH, tabX } = o, x0 = -w / 2, y0 = -h / 2, back = tone(k.manila, 0.86)
  const path = () => {
    ctx.beginPath(); ctx.moveTo(x0, y0 + tabH); ctx.lineTo(tabX, y0 + tabH); ctx.lineTo(tabX + 18 * u, y0); ctx.lineTo(tabX + tabW - 18 * u, y0); ctx.lineTo(tabX + tabW, y0 + tabH)
    ctx.lineTo(-x0, y0 + tabH); ctx.lineTo(-x0, -y0); ctx.lineTo(x0, -y0); ctx.closePath()
  }
  drop(ctx, E, lift, path)
  ctx.fillStyle = back; path(); ctx.fill()
  if (o.tabFill) { ctx.save(); path(); ctx.clip(); ctx.fillStyle = o.tabFill; ctx.fillRect(tabX, y0, tabW, tabH + 2 * u); ctx.restore() }
  ctx.fillStyle = k.manila; ctx.fillRect(x0, y0 + tabH + 22 * u, w, h - tabH - 22 * u)
  ctx.strokeStyle = 'rgba(90,60,20,0.35)'; ctx.lineWidth = 2 * u; ctx.strokeRect(x0 + u, y0 + tabH + 23 * u, w - 2 * u, h - tabH - 24 * u)
}

// 毡面字板：木框、黑毡面带横槽，白色塑料字一颗颗插上去，每颗略歪。f 是 E.fit 的结果（role num）。预先画成贴图
export const FELT_GAP = 0.08
export function felt(E, k, f, w, h) {
  return E.once(`det:felt:${f.lines.join('|')}:${f.size.toFixed(1)}:${Math.round(w)}:${Math.round(h)}:${k.felt}`, () => {
    const q = 2, u = E.u, W = Math.ceil(w * q), H = Math.ceil(h * q), c = E.createCanvas(W, H), g = c.getContext('2d'), r = rng(f.lines.join('').length * 97 + 5), fr = 12 * u * q
    g.fillStyle = mix(k.manila, '#3a2614', 0.72); g.beginPath(); g.roundRect(0, 0, W, H, 8 * u * q); g.fill()
    g.fillStyle = k.felt; g.fillRect(fr, fr, W - fr * 2, H - fr * 2)
    for (let y = fr + 7 * u * q; y < H - fr; y += 9 * u * q) { g.fillStyle = 'rgba(255,255,255,0.045)'; g.fillRect(fr, y, W - fr * 2, 1.5 * u * q); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(fr, y + 1.5 * u * q, W - fr * 2, 1.2 * u * q) }
    const fs = f.size * q
    g.font = E.font('num', 700, fs); g.textBaseline = 'middle'; g.textAlign = 'center'
    const y0 = H / 2 - f.lines.length * f.lineH * q / 2
    f.lines.forEach((line, li) => {
      const cs = [...line], ws = cs.map(ch => g.measureText(ch).width), gap = fs * FELT_GAP
      let x = W / 2 - (ws.reduce((a, b) => a + b, 0) + gap * (cs.length - 1)) / 2
      const cy = y0 + (li + 0.5) * f.lineH * q
      cs.forEach((ch, i) => {
        g.save(); g.translate(x + ws[i] / 2, cy + (r() - 0.5) * 4 * u * q); g.rotate((r() - 0.5) * 0.06)
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillText(ch, 2 * u * q, 3 * u * q)
        g.fillStyle = mix(k.paper, '#ffffff', 0.5); g.fillText(ch, 0, 0); g.restore()
        x += ws[i] + gap
      })
    })
    return c
  })
}

// 证物标签：左端剪角、金属扣眼、一段麻绳，四周一圈细红框（字幕和署名用）。返回扣眼占的宽度
export function tag(ctx, E, k, x0, y0, w, h, o = {}) {
  const u = E.u, cut = Math.min(h * 0.38, 22 * u), ex = o.ex ?? h * 0.62, X0 = x0 - ex, X1 = x0 + w, ym = y0 + h / 2
  ctx.save(); ctx.strokeStyle = mix(k.manila, '#8a6a3c', 0.5); ctx.lineWidth = 3 * u; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(X0 + ex * 0.45, ym); ctx.bezierCurveTo(X0 - 30 * u, ym - 10 * u, X0 - 60 * u, ym + 40 * u, X0 - 110 * u, ym + 20 * u); ctx.stroke()
  const path = () => { ctx.beginPath(); ctx.moveTo(X0 + cut, y0); ctx.lineTo(X1, y0); ctx.lineTo(X1, y0 + h); ctx.lineTo(X0 + cut, y0 + h); ctx.lineTo(X0, y0 + h - cut); ctx.lineTo(X0, y0 + cut); ctx.closePath() }
  drop(ctx, E, 0.3, path)
  ctx.fillStyle = o.fill || k.white; path(); ctx.fill()
  const m = 7 * u
  ctx.strokeStyle = rgba(k.red, 0.75); ctx.lineWidth = 2 * u; ctx.beginPath()
  ctx.moveTo(X0 + cut + m * 0.4, y0 + m); ctx.lineTo(X1 - m, y0 + m); ctx.lineTo(X1 - m, y0 + h - m); ctx.lineTo(X0 + cut + m * 0.4, y0 + h - m); ctx.lineTo(X0 + m, y0 + h - cut - m * 0.2); ctx.lineTo(X0 + m, y0 + cut + m * 0.2); ctx.closePath(); ctx.stroke()
  const hr = Math.min(h * 0.17, 14 * u)
  ctx.fillStyle = '#9c9a94'; ctx.beginPath(); ctx.arc(X0 + ex * 0.45, ym, hr, 0, TAU); ctx.fill()
  ctx.fillStyle = k.cork; ctx.beginPath(); ctx.arc(X0 + ex * 0.45, ym, hr * 0.52, 0, TAU); ctx.fill()
  ctx.restore()
}
