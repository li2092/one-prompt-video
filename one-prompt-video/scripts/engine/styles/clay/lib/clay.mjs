// 黏土质感的基础：手捏轮廓、体积渐变、内阴影与高光、指纹与捏痕、颗粒、接触阴影；
// 黏土字、刻字牌、黏土条，以及弹出、掉落、压扁、定格颤动这几种动作。
// 移植自风格库的 S-黏土卡通（lib/clay.mjs）。改动：贴图走 E.once 缓存；颜色从主题的 c 推出来（pal）；
// 字体走引擎的 E.font；尺寸由调用方乘好 E.u；刻字牌支持多行；新加按字拆块的黏土字串（clayRow）。
import { noise1, rng, mix, rgba, clamp, lerp } from '../../../core.mjs'

const DARK = '#3A2220'
export const shade = (hex, p) => (p >= 0 ? mix(hex, '#ffffff', p) : mix(hex, DARK, -p))
// 小装饰用的马卡龙色（不随 colors 换）；墙、字、桌子、机器人、字牌、强调色都从主题的八个颜色来
const MAC = { butter: '#F7D98A', mint: '#9FDBC0', lav: '#C3B0EA', pink: '#F5AFC4', green: '#58B98A' }

export function pal(E) {
  return E.once('clay:pal', () => {
    const c = E.theme.c
    return {
      ...MAC, wall: c.bg, ink: c.fg, soft: c.muted, accent: c.accent, robot: c.accent2, robotDark: shade(c.accent2, -0.2),
      cream: c.card, paper: shade(c.card, 0.5), face: shade(c.card, 0.35), table: c.line, on: c.onAccent,
      sky: mix(c.card, c.accent2, 0.5),
      tones: [MAC.butter, MAC.mint, mix(c.card, c.accent2, 0.5), MAC.pink, MAC.lav],
    }
  })
}
const CJK = /[㐀-鿿　-〿＀-￯]/
export const measurer = E => E.once('clay:mc', () => E.createCanvas(8, 8).getContext('2d'))

// ---------- 轮廓 ----------
// 手捏的不规则：沿法线加一点平滑噪声
export function rrPts(x, y, w, h, r, seed = 1, wob = 1) {
  r = Math.min(r, w / 2, h / 2)
  const pts = [], amp = Math.min(w, h) * 0.018 * wob + 0.6
  const per = 2 * (w + h - 4 * r) + 2 * Math.PI * r, n = Math.max(24, Math.round(per / 5))
  const segs = [w - 2 * r, Math.PI * r / 2, h - 2 * r, Math.PI * r / 2, w - 2 * r, Math.PI * r / 2, h - 2 * r, Math.PI * r / 2]
  for (let i = 0; i < n; i++) {
    let s = (i / n) * per, px, py, nx, ny, k = 0
    while (k < 7 && s > segs[k]) { s -= segs[k]; k++ }
    const arc = (cx, cy, a0) => { const a = a0 + s / r; px = cx + Math.cos(a) * r; py = cy + Math.sin(a) * r; nx = Math.cos(a); ny = Math.sin(a) }
    if (k === 0) { px = x + r + s; py = y; nx = 0; ny = -1 }
    else if (k === 1) arc(x + w - r, y + r, -Math.PI / 2)
    else if (k === 2) { px = x + w; py = y + r + s; nx = 1; ny = 0 }
    else if (k === 3) arc(x + w - r, y + h - r, 0)
    else if (k === 4) { px = x + w - r - s; py = y + h; nx = 0; ny = 1 }
    else if (k === 5) arc(x + r, y + h - r, Math.PI / 2)
    else if (k === 6) { px = x; py = y + h - r - s; nx = -1; ny = 0 }
    else arc(x + r, y + r, Math.PI)
    const d = noise1((i / n) * 9, seed) * amp + noise1((i / n) * 23, seed + 5) * amp * 0.35
    pts.push([px + nx * d, py + ny * d])
  }
  return pts
}
export function ellPts(cx, cy, rx, ry, seed = 1, wob = 1) {
  const n = Math.max(32, Math.round((rx + ry) * Math.PI / 5)), amp = Math.min(rx, ry) * 0.035 * wob + 0.5, pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, d = noise1((i / n) * 7, seed) * amp + noise1((i / n) * 19, seed + 3) * amp * 0.3
    pts.push([cx + Math.cos(a) * (rx + d), cy + Math.sin(a) * (ry + d)])
  }
  return pts
}
// 任意多边形 → 圆角 + 手捏噪声（顶点按顺时针）
export function polyPts(vs, r, seed = 1, wob = 1) {
  const out = [], n = vs.length
  for (let i = 0; i < n; i++) {
    const p0 = vs[(i + n - 1) % n], p1 = vs[i], p2 = vs[(i + 1) % n]
    const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), rr = Math.min(r, d0 / 2, d2 / 2)
    const a = [p1[0] + (p0[0] - p1[0]) * rr / d0, p1[1] + (p0[1] - p1[1]) * rr / d0], b = [p1[0] + (p2[0] - p1[0]) * rr / d2, p1[1] + (p2[1] - p1[1]) * rr / d2]
    for (let j = 0; j <= 6; j++) { const t = j / 6, q = 1 - t; out.push([q * q * a[0] + 2 * q * t * p1[0] + t * t * b[0], q * q * a[1] + 2 * q * t * p1[1] + t * t * b[1]]) }
    const nb = Math.floor((d2 - 2 * rr) / 6), r2 = Math.min(r, d2 / 2), e1 = [p2[0] + (p1[0] - p2[0]) * r2 / d2, p2[1] + (p1[1] - p2[1]) * r2 / d2]
    for (let j = 1; j < nb; j++) out.push([lerp(b[0], e1[0], j / nb), lerp(b[1], e1[1], j / nb)])
  }
  let cx = 0, cy = 0
  for (const p of out) { cx += p[0]; cy += p[1] }
  cx /= out.length; cy /= out.length
  return out.map(([x, y], i) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1, d = noise1((i / out.length) * 8, seed) * 1.4 * wob; return [x + dx / L * d, y + dy / L * d] })
}
export function pathPts(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath() }

// ---------- 黏土贴图 ----------
function tileGrain(E, g, W, H, a) {
  const t = E.once('clay:grain', () => {
    const N = 192, c = E.createCanvas(N, N), x = c.getContext('2d'), img = x.createImageData(N, N), d = img.data, r = rng(91)
    for (let i = 0; i < d.length; i += 4) { const v = r(), dark = v < 0.5; d[i] = dark ? 60 : 255; d[i + 1] = dark ? 35 : 252; d[i + 2] = dark ? 25 : 245; d[i + 3] = Math.floor(Math.abs(v - 0.5) * 70) }
    x.putImageData(img, 0, 0)
    return c
  })
  g.globalAlpha = a
  for (let y = 0; y < H; y += t.height) for (let x = 0; x < W; x += t.width) g.drawImage(t, x, y)
  g.globalAlpha = 1
}
// drawSil(g)：在 (0,0)-(w,h) 里画出实心轮廓。o: color, seed, depth, shadow（烤进投影）, deco(g,w,h) 压在表面的字和花纹,
// gloss（0..1 高光强度）, prints（指纹个数）, dents（捏痕个数）, lx/ly 体积亮点, hx/hy 高光位置, grain
// 同一个 key 只做一次（做法是预渲染：六步合成，见原风格说明）
export function sprite(E, key, w, h, drawSil, o = {}) {
  return E.once('clay:' + key, () => {
    const color = o.color || '#FFF6EA', m = Math.min(w, h)
    const d = o.depth ?? clamp(m * 0.075, 2.5, 20)
    const pad = Math.ceil((o.shadow ? m * 0.08 + 22 : 4) + d * 1.5)
    const W = Math.ceil(w + pad * 2), H = Math.ceil(h + pad * 2)
    const mk = () => { const c = E.createCanvas(W, H); return [c, c.getContext('2d')] }
    const [sil, sg] = mk()
    sg.translate(pad, pad); sg.fillStyle = '#fff'; sg.strokeStyle = '#fff'; drawSil(sg)
    const [B, b] = mk()
    b.drawImage(sil, 0, 0)
    b.globalCompositeOperation = 'source-in'; b.fillStyle = color; b.fillRect(0, 0, W, H)
    b.globalCompositeOperation = 'source-atop'
    // 体积：左上亮、右下暗
    const gx = pad + w * (o.lx ?? 0.32), gy = pad + h * (o.ly ?? 0.26), gr = b.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.95)
    gr.addColorStop(0, rgba(shade(color, 0.42), 0.8)); gr.addColorStop(0.42, rgba(color, 0)); gr.addColorStop(1, rgba(shade(color, -0.3), 0.55))
    b.fillStyle = gr; b.fillRect(0, 0, W, H)
    // 内阴影（右下边缘）与内高光（左上边缘）
    const [T, tg] = mk()
    tg.fillStyle = shade(color, -0.5); tg.fillRect(0, 0, W, H)
    tg.globalCompositeOperation = 'destination-out'; tg.drawImage(sil, -d * 0.9, -d)
    b.filter = `blur(${(d * 0.9).toFixed(1)}px)`; b.globalAlpha = 0.7; b.drawImage(T, 0, 0)
    tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H)
    tg.fillStyle = '#FFFFFF'; tg.fillRect(0, 0, W, H)
    tg.globalCompositeOperation = 'destination-out'; tg.drawImage(sil, d * 0.55, d * 0.6)
    b.filter = `blur(${(d * 0.7).toFixed(1)}px)`; b.globalAlpha = 0.55; b.drawImage(T, 0, 0)
    b.filter = 'none'; b.globalAlpha = 1
    // 高光：一块柔光 + 一点亮斑
    const gl = o.gloss ?? 1
    if (gl > 0) {
      const hx = pad + w * (o.hx ?? 0.27), hy = pad + h * (o.hy ?? 0.24), hr = Math.min(m * 0.36, Math.max(w, h) * 0.2)
      b.save(); b.translate(hx, hy); b.rotate(-0.55); b.scale(1, 0.5)
      const hg = b.createRadialGradient(0, 0, 0, 0, 0, hr)
      hg.addColorStop(0, `rgba(255,255,255,${0.5 * gl})`); hg.addColorStop(1, 'rgba(255,255,255,0)')
      b.fillStyle = hg; b.beginPath(); b.arc(0, 0, hr, 0, Math.PI * 2); b.fill(); b.restore()
      b.save(); b.translate(hx - hr * 0.15, hy - hr * 0.08); b.rotate(-0.55)
      b.fillStyle = `rgba(255,255,255,${0.45 * gl})`; b.filter = `blur(${Math.max(1, m * 0.012).toFixed(1)}px)`
      b.beginPath(); b.ellipse(0, 0, Math.max(2, hr * 0.32), Math.max(1.2, hr * 0.1), 0, 0, Math.PI * 2); b.fill()
      b.filter = 'none'; b.restore()
    }
    if (o.deco) { b.save(); b.translate(pad, pad); o.deco(b, w, h); b.restore(); b.globalCompositeOperation = 'source-atop' }
    // 指纹：同心短弧，暗亮各一道
    const r = rng((o.seed ?? 1) * 7919 + 13), np = o.prints ?? (m > 60 ? 2 : 0)
    for (let k = 0; k < np; k++) {
      const cx = pad + w * (0.2 + r() * 0.6), cy = pad + h * (0.25 + r() * 0.55), Rm = clamp(m * 0.26, 10, 70), rot = r() * Math.PI
      for (let rr = 3; rr < Rm; rr += 2.7) {
        const a0 = r() * Math.PI * 2, span = 1.2 + r() * 2.2
        b.lineWidth = 1
        b.strokeStyle = 'rgba(60,30,20,0.11)'; b.beginPath(); b.ellipse(cx, cy, rr * 1.25, rr, rot, a0, a0 + span); b.stroke()
        b.strokeStyle = 'rgba(255,255,255,0.14)'; b.beginPath(); b.ellipse(cx + 0.9, cy + 0.9, rr * 1.25, rr, rot, a0, a0 + span); b.stroke()
      }
    }
    // 细小的捏痕
    const nd = o.dents ?? Math.min(4, Math.floor(m / 50))
    for (let k = 0; k < nd; k++) {
      const cx = pad + w * (0.15 + r() * 0.7), cy = pad + h * (0.2 + r() * 0.6), L = clamp(m * 0.08, 5, 22), a = r() * Math.PI
      b.lineWidth = 1.6; b.lineCap = 'round'
      b.strokeStyle = 'rgba(60,30,20,0.09)'; b.beginPath(); b.arc(cx, cy, L, a, a + 1.1); b.stroke()
      b.strokeStyle = 'rgba(255,255,255,0.13)'; b.beginPath(); b.arc(cx + 1.2, cy + 1.2, L, a, a + 1.1); b.stroke()
    }
    tileGrain(E, b, W, H, o.grain ?? 0.55)
    const [F, f] = mk()
    if (o.shadow) {
      const [S2, s2] = mk()
      s2.drawImage(sil, 0, 0); s2.globalCompositeOperation = 'source-in'; s2.fillStyle = 'rgba(120,64,44,1)'; s2.fillRect(0, 0, W, H)
      f.filter = `blur(${(m * 0.04 + 7).toFixed(1)}px)`; f.globalAlpha = 0.26; f.drawImage(S2, m * 0.015, m * 0.05 + 6)
      f.filter = 'none'; f.globalAlpha = 1
    }
    f.drawImage(B, 0, 0)
    return { c: F, pad, w, h }
  })
}

// 画贴图：(x, y) 是锚点（ax, ay 为相对轮廓框的比例），sx/sy 缩放，rot 旋转
export function put(ctx, s, x, y, o = {}) {
  const { sx = 1, sy = 1, rot = 0, a = 1, ax = 0.5, ay = 0.5 } = o
  if (a <= 0.002 || Math.abs(sx) < 0.002 || Math.abs(sy) < 0.002) return
  ctx.save(); ctx.globalAlpha *= clamp(a)
  ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx, sy)
  ctx.drawImage(s.c, -s.pad - s.w * ax, -s.pad - s.h * ay)
  ctx.restore()
}
// 落在桌面上的接触阴影
export function ground(ctx, x, y, w, a = 1) {
  if (a <= 0.01 || w <= 1) return
  ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2)
  g.addColorStop(0, `rgba(110,55,35,${0.38 * a})`); g.addColorStop(0.6, `rgba(110,55,35,${0.14 * a})`); g.addColorStop(1, 'rgba(110,55,35,0)')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore()
}
export const blob = (E, key, w, h, r, o = {}) => sprite(E, `rr:${key}:${w}x${h}:${o.color}`, w, h, g => { pathPts(g, rrPts(0, 0, w, h, r, o.seed ?? 3, o.wob ?? 1)); g.fill() }, o)
export const ball = (E, key, w, h, o = {}) => sprite(E, `el:${key}:${w}x${h}:${o.color}`, w, h, g => { pathPts(g, ellPts(w / 2, h / 2, w / 2, h / 2, o.seed ?? 4, o.wob ?? 1)); g.fill() }, o)

// ---------- 字 ----------
// 黏土字：字形加粗圆角后整块当黏土捏。中文笔画密，700 字重、膨胀和内阴影减小，外加一圈深色同色系黏土描边
const textFont = (E, s, size, role) => E.font(role || 'title', CJK.test(s) ? 700 : 900, size)
export function clayText(E, s, size, color, o = {}) {
  const cjk = CJK.test(s) && o.rim !== false, font = textFont(E, s, size, o.role), u = E.u
  const mc = measurer(E); mc.font = font
  const lw = size * (o.puff ?? (cjk ? 0.025 : 0.07)), rim = cjk ? Math.max(4 * u, size * 0.075) : 0
  const w = Math.ceil(mc.measureText(s).width + lw + 4 + rim * 2), h = Math.ceil(size * 1.18 + lw + rim * 2)
  const body = sprite(E, `txt:${s}:${size}:${color}:${font}:${o.puff}:${cjk}`, w, h, g => {
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = lw
    g.strokeText(s, w / 2, h / 2 + size * 0.04); g.fillText(s, w / 2, h / 2 + size * 0.04)
  }, { color, depth: cjk ? clamp(size * 0.014, 1.2, 2.2) : clamp(size * 0.035, 2, 6), shadow: o.shadow ?? true, prints: 0, dents: 0, gloss: cjk ? 0.35 : 0.6, seed: o.seed, hx: 0.2, hy: 0.25, grain: 0.4 })
  if (!cjk) return body
  return E.once(`clay:rim:${s}:${size}:${color}:${font}`, () => {
    // 深色描边：描三遍，宽度按字轻微起伏，像手捏的一圈；再把字压在上面
    const c = E.createCanvas(body.c.width, body.c.height), g = c.getContext('2d')
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'
    const x0 = body.pad + w / 2, y0 = body.pad + h / 2 + size * 0.04
    g.strokeStyle = mix(color, '#2E1B18', 0.64)
    for (let k = 0; k < 3; k++) { g.lineWidth = lw + rim * 2 * (0.86 + 0.14 * noise1(k * 1.7, s.length + 3)); g.strokeText(s, x0 + (k - 1) * 0.8 * u, y0 + rim * 0.18 + (k === 1 ? 0.8 * u : 0)) }
    g.drawImage(body.c, 0, 0)
    return { c, pad: body.pad, w, h }
  })
}
// 一串字按字拆成黏土块逐个摆：数字滚动时只换块；anim(k) 返回第 k 个字的 { dy, sx, sy, a }（以字底为锚压扁）
export function rowWidth(E, str, size, role) {
  const mc = measurer(E)
  return [...String(str)].reduce((acc, ch) => { mc.font = textFont(E, ch, size, role); return acc + mc.measureText(ch).width }, 0)
}
export function clayRow(ctx, E, str, x, y, size, color, o = {}) {
  const chars = [...String(str)], mc = measurer(E)
  const ws = chars.map(ch => { mc.font = textFont(E, ch, size, o.role); return mc.measureText(ch).width })
  const total = ws.reduce((a, b) => a + b, 0)
  let cx = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2
  chars.forEach((ch, k) => {
    if (ch.trim()) {
      const sp = clayText(E, ch, size, color, o), an = o.anim ? o.anim(k) : {}
      put(ctx, sp, cx + ws[k] / 2, y + sp.h / 2 + (an.dy || 0), { sx: an.sx ?? 1, sy: an.sy ?? 1, a: an.a ?? 1, ay: 1, rot: an.rot || 0 })
    }
    cx += ws[k]
  })
  return total
}
// 压进黏土的字：下沿一道亮边，看起来是刻进去的（只在 sprite 的 deco 里用）
export function pressText(g, s, x, y, font, ink, align = 'center') {
  g.save(); g.globalCompositeOperation = 'source-atop'
  g.font = font; g.textAlign = align; g.textBaseline = 'middle'
  const sz = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1])
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillText(s, x, y + Math.max(1.2, sz * 0.045))
  g.fillStyle = ink; g.fillText(s, x, y)
  g.restore()
}
// 刻字牌：黏土圆角块 + 刻进去的几行字。lines 来自 E.fit；o: role, weight, lineH, color, ink, align, minW, minH, padX, padY
export function plaque(E, lines, size, o = {}) {
  lines = Array.isArray(lines) ? lines : [String(lines)]
  const font = E.font(o.role || 'body', o.weight ?? 700, size), mc = measurer(E); mc.font = font
  const tw = Math.max(...lines.map(s => mc.measureText(s).width)), lh = o.lineH ?? size * 1.25
  const padX = o.padX ?? size * 0.62, padY = o.padY ?? size * 0.4
  const w = Math.ceil(Math.max(o.minW || 0, tw + padX * 2)), h = Math.ceil(Math.max(o.minH || 0, lines.length * lh + padY * 2))
  const seed = o.seed ?? lines.join('').length * 7 + 3, ink = o.ink || pal(E).ink, align = o.align || 'center'
  return sprite(E, `plq:${lines.join('|')}:${size}:${w}x${h}:${o.color}:${ink}:${font}:${align}:${o.shadow}`, w, h, g => { pathPts(g, rrPts(0, 0, w, h, o.r ?? Math.min(h * 0.42, size * 0.9), seed)); g.fill() }, {
    color: o.color || pal(E).cream, shadow: o.shadow ?? true, seed, prints: o.prints ?? 1, depth: o.depth,
    deco: (g, w, h) => lines.forEach((s, j) => pressText(g, s, align === 'left' ? padX : w / 2, h / 2 + (j - (lines.length - 1) / 2) * lh + size * 0.03, font, ink, align)),
  })
}
// 直接画在画面上的刻字（随时在变的字，如柱子里滚动的数）
export function engrave(ctx, s, x, y, font, ink, align = 'center') {
  ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle'
  const sz = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1])
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText(s, x, y + Math.max(1.2, sz * 0.045))
  ctx.fillStyle = ink; ctx.fillText(s, x, y); ctx.restore()
}

// ---------- 黏土条（勾、线、棍子）：实时画，暗边、本色、亮脊三层 ----------
export function noodle(ctx, draw, color, w, a = 1) {
  if (a <= 0.01) return
  ctx.save(); ctx.globalAlpha *= a; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.save(); ctx.translate(w * 0.06, w * 0.22); ctx.strokeStyle = 'rgba(110,55,35,0.22)'; ctx.lineWidth = w * 1.05; draw(ctx); ctx.stroke(); ctx.restore()
  ctx.strokeStyle = shade(color, -0.22); ctx.lineWidth = w; draw(ctx); ctx.stroke()
  ctx.save(); ctx.translate(-w * 0.08, -w * 0.1); ctx.strokeStyle = color; ctx.lineWidth = w * 0.72; draw(ctx); ctx.stroke(); ctx.restore()
  ctx.save(); ctx.translate(-w * 0.16, -w * 0.2); ctx.strokeStyle = rgba(shade(color, 0.6), 0.75); ctx.lineWidth = w * 0.22; draw(ctx); ctx.stroke(); ctx.restore()
  ctx.restore()
}
// 画出一段折线的前 p 部分（逐笔画）
export function partial(pts, p) {
  const L = []
  let tot = 0
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(d); tot += d }
  return g => {
    let left = tot * clamp(p)
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length && left > 0; i++) { const f = Math.min(1, left / L[i - 1]); g.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); left -= L[i - 1] }
  }
}

// ---------- 动作 ----------
// 弹出：0 → 过冲 → 1，同时压扁回弹
export function pop(t, t0, dur = 0.5) {
  const p = clamp((t - t0) / dur)
  if (p <= 0) return { s: 0, sx: 0, sy: 0, p }
  const s = p >= 1 ? 1 : 1 + 2.2 * Math.pow(p - 1, 3) + 1.2 * Math.pow(p - 1, 2), w = Math.sin(p * Math.PI * 2.2) * (1 - p) * 0.22
  return { s, sx: s * (1 + w), sy: s * (1 - w), p }
}
// 掉落：从上方 h0 落下，落地压扁回弹
export function drop(t, t0, h0, fall = 0.3) {
  if (t < t0) return { dy: -h0, sx: 1, sy: 1, a: 0, landed: false }
  const p = (t - t0) / fall
  if (p < 1) return { dy: -h0 * (1 - p * p), sx: 0.92, sy: 1.1, a: clamp(p * 4), landed: false }
  const q = t - t0 - fall, w = Math.exp(-q * 7) * Math.cos(q * 26) * 0.28
  return { dy: 0, sx: 1 + w, sy: 1 - w, a: 1, landed: true }
}
// 压一下：在 t0 处一次压扁回弹
export function squish(t, t0, amt = 0.2) {
  if (t < t0) return { sx: 1, sy: 1 }
  const q = t - t0, w = Math.exp(-q * 6) * Math.sin(q * 22) * amt
  return { sx: 1 + w, sy: 1 - w }
}
// 定格动画的颤：每秒 12 次换一下的细微抖动
export function boil(T, seed, amp = 1) {
  const f = Math.floor(T * 12)
  return { x: noise1(f * 0.91, seed) * 0.9 * amp, y: noise1(f * 0.77, seed + 9) * 0.9 * amp, r: noise1(f * 0.63, seed + 17) * 0.006 }
}
