// 新闻播报的画法库，移植自风格库的 T-新闻播报：演播室大屏、画中画、标签、胶囊条、主播剪影、主播台、
// 线框地球、翻牌数字、发光线、刷出。颜色由 setPal 从风格包的 this.c 算出来，字体由调用方用 E.font 给。
// 不持有跨帧状态，同一个时刻画出同一帧。

import { rgba } from '../../../core.mjs'

// 调色板：每个入口（bg、版式、字幕、最上层、转场）先调 setPal(E, this.c)，下面的画法都从 P 取色
export const P = {}
const PALS = new Map()
export function setPal(E, c) {
  const key = [c.bg, c.fg, c.muted, c.accent, c.accent2, c.card, c.line, c.onAccent].join()
  let k = PALS.get(key)
  if (!k) {
    const m = E.mix, dk = (h, f) => m(h, '#000000', f)
    k = {
      bg0: dk(c.bg, 0.62), bg1: c.bg, bg2: m(c.bg, c.card, 0.32),
      blue: c.card, blue2: m(c.card, c.fg, 0.18), cyan: c.line, ice: m(c.fg, c.card, 0.17),
      white: c.fg, text2: c.muted, red: c.accent, red2: m(c.accent, c.fg, 0.2), gold: c.accent2, on: c.onAccent,
      ink: m(c.bg, c.card, 0.12), panelTop: m(c.bg, c.card, 0.22), panelBot: dk(c.bg, 0.3),
    }
    PALS.set(key, k)
  }
  Object.assign(P, k)
  return P
}

const cl = v => Math.max(0, Math.min(1, v))

// 发光：在字外描三层由宽到窄的半透明边。原样片用 shadowBlur，大字的高斯模糊一帧要十几到二十毫秒，这样不到一毫秒
export function glowText(ctx, s, x, y, r, col) {
  ctx.save(); ctx.lineJoin = 'round'
  for (const [k, a] of [[1, 0.1], [0.55, 0.18], [0.25, 0.3]]) { ctx.lineWidth = r * k; ctx.strokeStyle = rgba(col, a); ctx.strokeText(s, x, y) }
  ctx.restore()
}
// 单行文字；返回字宽。o.font 必给（E.font 的结果）；o.glow 是发光的宽度，配合 o.glowCol（要 #rrggbb）
export function text(ctx, s, x, y, o = {}) {
  ctx.save()
  ctx.font = o.font
  ctx.textAlign = o.align || 'left'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha *= o.alpha ?? 1
  if (o.glow) glowText(ctx, s, x, y, o.glow, o.glowCol || P.cyan)
  ctx.fillStyle = o.color || P.white
  ctx.fillText(s, x, y)
  const w = ctx.measureText(s).width
  ctx.restore()
  return w
}
export function measure(ctx, s, font) { ctx.save(); ctx.font = font; const w = ctx.measureText(s).width; ctx.restore(); return w }

// 进场：缩放回弹加淡入
export function pop(E, t, t0, dur = 0.35) {
  const k = E.clamp((t - t0) / dur)
  return { a: E.clamp((t - t0) / (dur * 0.5)), s: t < t0 ? 0 : 0.6 + 0.4 * E.ease.outBack(k), k }
}
// 从下方滑入
export function rise(E, t, t0, dur = 0.4, dist = 40) {
  const k = E.ease.outExpo(E.clamp((t - t0) / dur))
  return { a: E.clamp((t - t0) / (dur * 0.6)), dy: (1 - k) * dist * E.u, k }
}

// 横向揭开（新闻图板的「刷出」）：clip 宽度随 p 增长，揭开处一道亮线
export function wipe(ctx, E, x, y, w, h, p, fn) {
  if (p <= 0) return
  ctx.save()
  ctx.beginPath(); ctx.rect(x - 2, y - 40 * E.u, (w + 4) * cl(p), h + 80 * E.u); ctx.clip()
  fn()
  ctx.restore()
  if (p < 1) {
    const ex = x + w * p
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createLinearGradient(ex - 60 * E.u, 0, ex + 8 * E.u, 0)
    g.addColorStop(0, E.rgba(P.cyan, 0)); g.addColorStop(0.8, E.rgba(P.cyan, 0.45)); g.addColorStop(1, E.rgba(P.white, 0.95))
    ctx.fillStyle = g
    ctx.fillRect(ex - 60 * E.u, y, 68 * E.u, h)
    ctx.restore()
  }
}

// 软投影：几层往下错开的半透明圆角块。大面积的 shadowBlur 一帧要几十毫秒，这样只要两三毫秒
export function softShadow(ctx, E, x, y, w, h, r = 0, k = 1) {
  ctx.save()
  for (const [d, a] of [[8, 0.2], [16, 0.13], [28, 0.08]]) {
    const dd = d * k * E.u
    E.roundRect(ctx, x - dd * 0.4, y + dd, w + dd * 0.8, h, r + dd); ctx.fillStyle = E.rgba(P.bg0, a); ctx.fill()
  }
  ctx.restore()
}

// 演播室数字大屏：深蓝渐变、扫描线、顶部高光、整圈细边、四角青色折角；sheen 是扫过去的一道光（0..1 的位置）
export function panel(ctx, E, x, y, w, h, o = {}) {
  const u = E.u, r = o.r ?? 10 * u
  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  if (o.shadow !== false) softShadow(ctx, E, x, y, w, h, r, 1.2)
  E.roundRect(ctx, x, y, w, h, r)
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, E.rgba(o.top || P.panelTop, 0.9)); g.addColorStop(1, E.rgba(o.bot || P.panelBot, 0.94))
  ctx.fillStyle = g; ctx.fill()
  ctx.save()
  E.roundRect(ctx, x, y, w, h, r); ctx.clip()
  ctx.fillStyle = E.rgba(P.ice, 0.035)
  for (let yy = y; yy < y + h; yy += 5 * u) ctx.fillRect(x, yy, w, 1.4 * u)
  const hg = ctx.createLinearGradient(0, y, 0, y + h * 0.4)
  hg.addColorStop(0, E.rgba(P.blue2, 0.16)); hg.addColorStop(1, E.rgba(P.blue2, 0))
  ctx.fillStyle = hg; ctx.fillRect(x, y, w, h * 0.4)
  if (o.sheen != null && o.sheen > -0.3 && o.sheen < 1.3) {
    const sx = x + w * o.sheen, sg = ctx.createLinearGradient(sx - 160 * u, 0, sx + 160 * u, 0)
    sg.addColorStop(0, E.rgba(P.white, 0)); sg.addColorStop(0.5, E.rgba(P.ice, 0.13)); sg.addColorStop(1, E.rgba(P.white, 0))
    ctx.fillStyle = sg; ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
  E.roundRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = o.border || E.rgba(P.blue2, 0.5); ctx.lineWidth = (o.lw ?? 1.6) * u; ctx.stroke()
  const c = o.corner ?? 26 * u, k = 6 * u
  ctx.strokeStyle = o.cornerCol || P.cyan; ctx.lineWidth = 3 * u; ctx.lineCap = 'square'
  for (const [cx, cy, sx, sy] of [[x - k, y - k, 1, 1], [x + w + k, y - k, -1, 1], [x - k, y + h + k, 1, -1], [x + w + k, y + h + k, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * c, cy); ctx.stroke()
  }
  ctx.restore()
}

// 标签块（「快讯」这一类）：x 为左端，y 为中线；返回宽度
export function tag(ctx, E, s, x, y, o = {}) {
  const u = E.u, fs = o.fs ?? 28 * u
  ctx.save()
  ctx.font = o.font || E.font('title', 900, fs)
  const w = o.w ?? ctx.measureText(s).width + fs * 0.9, h = o.h ?? fs * 1.45
  ctx.globalAlpha *= o.alpha ?? 1
  const col = o.color || P.red, g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2)
  g.addColorStop(0, E.mix(col, '#ffffff', 0.18)); g.addColorStop(1, E.mix(col, '#000000', 0.15))
  ctx.fillStyle = g
  E.roundRect(ctx, x, y - h / 2, w, h, o.r ?? 5 * u); ctx.fill()
  ctx.fillStyle = o.textColor || P.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(s, x + w / 2, y + fs * 0.04)
  ctx.restore()
  return w
}

// 胶囊信息条（深底亮边），以 (cx, cy) 为中心；f 是 E.fit 的结果
export function chipLabel(ctx, E, f, cx, cy, o = {}) {
  const u = E.u, fs = f.size
  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  const w = f.width + fs * 1.3, h = fs * 1.62
  E.roundRect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2)
  ctx.fillStyle = o.bg || E.rgba(P.bg1, 0.92); ctx.fill()
  ctx.strokeStyle = o.border || E.rgba(P.cyan, 0.7); ctx.lineWidth = 2 * u; ctx.stroke()
  ctx.fillStyle = o.color || P.white; ctx.font = E.font('body', o.weight ?? 700, fs); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(f.lines[0], cx, cy + fs * 0.04)
  ctx.restore()
  return w
}

// 画中画小窗：深蓝底、白色细框；draw 在窗内（已 clip）画内容；dot 是右上角的红点
export function pip(ctx, E, x, y, w, h, o = {}, draw) {
  const u = E.u
  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  softShadow(ctx, E, x, y, w, h, 0)
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  const g = ctx.createLinearGradient(0, y, 0, y + h)
  g.addColorStop(0, E.mix(P.bg2, P.blue, 0.15)); g.addColorStop(1, E.mix(P.bg1, P.bg0, 0.4))
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h)
  if (draw) draw()
  ctx.restore()
  ctx.strokeStyle = o.border || E.rgba(P.white, 0.85); ctx.lineWidth = 3 * u; ctx.strokeRect(x, y, w, h)
  if (o.dot) { ctx.fillStyle = P.red2; ctx.globalAlpha *= Math.floor(E.T * 2) % 2 ? 1 : 0.35; ctx.beginPath(); ctx.arc(x + w - 26 * u, y + 26 * u, 9 * u, 0, Math.PI * 2); ctx.fill() }
  ctx.restore()
}

// 线框地球：正射投影，前半球亮、后半球淡
export function globe(ctx, E, cx, cy, R, rot, o = {}) {
  const tilt = o.tilt ?? 0.38, col = o.color || P.cyan, a = o.alpha ?? 0.3
  const ct = Math.cos(tilt), st = Math.sin(tilt)
  const proj = (lat, lon) => {
    const x = Math.cos(lat) * Math.sin(lon + rot), y0 = Math.sin(lat), z0 = Math.cos(lat) * Math.cos(lon + rot)
    return [cx + x * R, cy - (y0 * ct - z0 * st) * R, y0 * st + z0 * ct]
  }
  ctx.save()
  ctx.lineWidth = (o.lw ?? 1.4) * E.u
  const front = E.rgba(col, a), back = E.rgba(col, a * 0.28)
  // 同一深度的线段攒成一条路径一起描，比逐段描快得多
  const seg = pts => {
    for (const side of [true, false]) {
      ctx.beginPath()
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0, z0] = pts[i - 1], [x1, y1, z1] = pts[i]
        if ((z0 + z1 > 0) !== side) continue
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1)
      }
      ctx.strokeStyle = side ? front : back; ctx.stroke()
    }
  }
  const nM = o.meridians ?? 12, nP = o.parallels ?? 7, N = o.seg ?? 40
  for (let m = 0; m < nM; m++) { const lon = (m / nM) * Math.PI * 2; seg(Array.from({ length: N + 1 }, (_, i) => proj(-Math.PI / 2 + (i / N) * Math.PI, lon))) }
  for (let p = 1; p < nP; p++) { const lat = -Math.PI / 2 + (p / nP) * Math.PI; seg(Array.from({ length: N + 1 }, (_, i) => proj(lat, (i / N) * Math.PI * 2))) }
  ctx.strokeStyle = E.rgba(col, Math.min(1, a * 1.3))
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

// 主播剪影（抽象，不画五官）：baseY 为桌面高度，s 为尺度（肩宽约 1.5s），带呼吸和点头
export function anchor(ctx, E, cx, baseY, s, t, o = {}) {
  const u = E.u
  const br = Math.sin(t * 1.7) * 1.5 * u
  const nod = (o.talk ?? 1) * (E.noise1(t * 2.2, 5) * 4 * u)
  const tilt = (o.talk ?? 1) * E.noise1(t * 0.9, 9) * 0.03
  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  const y0 = baseY + 10 * u, sh = baseY - 0.62 * s + br
  const body = () => {
    ctx.beginPath()
    ctx.moveTo(cx - 0.78 * s, y0)
    ctx.bezierCurveTo(cx - 0.76 * s, sh + 0.2 * s, cx - 0.62 * s, sh, cx - 0.36 * s, sh - 0.02 * s)
    ctx.lineTo(cx - 0.12 * s, sh - 0.1 * s); ctx.lineTo(cx - 0.11 * s, sh - 0.2 * s); ctx.lineTo(cx + 0.11 * s, sh - 0.2 * s); ctx.lineTo(cx + 0.12 * s, sh - 0.1 * s)
    ctx.lineTo(cx + 0.36 * s, sh - 0.02 * s)
    ctx.bezierCurveTo(cx + 0.62 * s, sh, cx + 0.76 * s, sh + 0.2 * s, cx + 0.78 * s, y0)
    ctx.closePath()
  }
  const g = ctx.createLinearGradient(cx - 0.8 * s, sh, cx + 0.8 * s, y0)
  g.addColorStop(0, E.mix(P.bg2, P.blue, 0.12)); g.addColorStop(0.5, P.bg1); g.addColorStop(1, P.bg0)
  // 轮廓光：先描几层由宽到窄的半透明边，再填身体盖住内侧一半，只剩外沿的光（代替很慢的 shadowBlur）
  const rim = o.rim || P.cyan, glow = shape => { for (const [lw, a] of [[22, 0.05], [13, 0.09], [7, 0.14]]) { ctx.strokeStyle = E.rgba(rim, a); ctx.lineWidth = lw * u; shape(); ctx.stroke() } }
  glow(body)
  ctx.fillStyle = g; body(); ctx.fill()
  ctx.strokeStyle = E.rgba(rim, 0.55); ctx.lineWidth = 2.2 * u; body(); ctx.stroke()
  // 衣领 V 形
  ctx.save(); body(); ctx.clip()
  ctx.fillStyle = E.rgba(P.ice, 0.22)
  ctx.beginPath(); ctx.moveTo(cx - 0.12 * s, sh - 0.12 * s); ctx.lineTo(cx, sh + 0.2 * s); ctx.lineTo(cx + 0.12 * s, sh - 0.12 * s); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = E.rgba(P.blue2, 0.3); ctx.lineWidth = 2 * u
  ctx.beginPath(); ctx.moveTo(cx - 0.16 * s, sh - 0.08 * s); ctx.lineTo(cx - 0.02 * s, sh + 0.42 * s); ctx.moveTo(cx + 0.16 * s, sh - 0.08 * s); ctx.lineTo(cx + 0.02 * s, sh + 0.42 * s); ctx.stroke()
  ctx.restore()
  // 头
  ctx.save()
  ctx.translate(cx, sh - 0.42 * s + nod * 0.3); ctx.rotate(tilt)
  const hg = ctx.createRadialGradient(-0.06 * s, -0.08 * s, 0.02 * s, 0, 0, 0.3 * s)
  hg.addColorStop(0, E.mix(P.bg2, P.blue, 0.25)); hg.addColorStop(1, P.bg0)
  const head = () => { ctx.beginPath(); ctx.ellipse(0, 0, 0.2 * s, 0.25 * s, 0, 0, Math.PI * 2) }
  glow(head)
  ctx.fillStyle = hg; head(); ctx.fill()
  ctx.strokeStyle = E.rgba(rim, 0.6); ctx.lineWidth = 2.2 * u; ctx.stroke()
  ctx.restore()
  ctx.restore()
}

// 主播台：桌面带亮边，前脸一道来回扫的亮带（不写台名）
export function desk(ctx, E, cx, topY, w, h, o = {}) {
  const u = E.u, tw = w * 1.04, fy = topY + 22 * u
  ctx.save()
  ctx.globalAlpha *= o.alpha ?? 1
  ctx.beginPath(); ctx.moveTo(cx - tw / 2, topY); ctx.lineTo(cx + tw / 2, topY); ctx.lineTo(cx + w / 2, fy); ctx.lineTo(cx - w / 2, fy); ctx.closePath()
  const tg = ctx.createLinearGradient(0, topY, 0, fy)
  tg.addColorStop(0, E.mix(P.blue2, P.white, 0.4)); tg.addColorStop(1, E.mix(P.blue, P.bg1, 0.3))
  ctx.fillStyle = tg; ctx.fill()
  const fg = ctx.createLinearGradient(0, fy, 0, fy + h)
  fg.addColorStop(0, P.panelTop); fg.addColorStop(1, P.bg0)
  ctx.fillStyle = fg
  ctx.beginPath(); ctx.moveTo(cx - w / 2, fy); ctx.lineTo(cx + w / 2, fy); ctx.lineTo(cx + w / 2 - 24 * u, fy + h); ctx.lineTo(cx - w / 2 + 24 * u, fy + h); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = E.rgba(P.blue2, 0.45); ctx.lineWidth = 1.5 * u; ctx.stroke()
  const sw = o.sweep ?? 0.5, lg = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0)
  lg.addColorStop(0, E.rgba(P.cyan, 0)); lg.addColorStop(cl(sw - 0.2), E.rgba(P.cyan, 0.08)); lg.addColorStop(cl(sw), E.rgba(P.cyan, 0.55)); lg.addColorStop(cl(sw + 0.2), E.rgba(P.cyan, 0.08)); lg.addColorStop(1, E.rgba(P.cyan, 0))
  ctx.fillStyle = lg; ctx.fillRect(cx - w / 2 + 30 * u, fy + h * 0.55, w - 60 * u, 4 * u)
  ctx.restore()
}

// 数字翻牌：每位数字从下往上滚到目标，p 0..1，逐位错开；非数字的字符原样画。返回总宽
export function rollNum(ctx, E, str, x, y, font, p, o = {}) {
  ctx.save()
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  const fs = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1])
  const chars = [...str], ws = chars.map(c => ctx.measureText(c).width), tot = ws.reduce((a, b) => a + b, 0)
  let xx = o.align === 'center' ? x - tot / 2 : o.align === 'right' ? x - tot : x
  ctx.globalAlpha *= o.alpha ?? 1
  ctx.fillStyle = o.color || P.white
  const put = (s, x, yy) => { if (o.glow) glowText(ctx, s, x, yy, o.glow, o.glowCol || P.cyan); ctx.fillText(s, x, yy) }
  chars.forEach((c, i) => {
    const d = parseInt(c, 10)
    if (Number.isNaN(d)) { put(c, xx, y); xx += ws[i]; return }
    const pi = E.ease.outExpo(E.clamp(p * (1 + 0.25 * chars.length) - i * 0.25))
    const pos = (1 - pi) * (10 + i * 3), cur = Math.floor(pos), f = pos - cur
    ctx.save()
    ctx.beginPath(); ctx.rect(xx - fs * 0.3, y - fs * 0.62, ws[i] + fs * 0.6, fs * 1.24); ctx.clip()
    put(String((d + cur) % 10), xx, y - f * fs * 1.1)
    if (f > 0.001) put(String((d + cur + 1) % 10), xx, y + (1 - f) * fs * 1.1)
    ctx.restore()
    xx += ws[i]
  })
  ctx.restore()
  return tot
}

// 发光线段（画到 p）和箭头
export function beam(ctx, E, x0, y0, x1, y1, p, col = P.cyan, w = 4) {
  if (p <= 0.001) return
  ctx.save()
  ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(E.lerp(x0, x1, cl(p)), E.lerp(y0, y1, cl(p)))
  for (const [k, a] of [[4.5, 0.12], [2.4, 0.25]]) { ctx.strokeStyle = E.rgba(col, a); ctx.lineWidth = w * k * E.u; ctx.stroke() }
  ctx.strokeStyle = col; ctx.lineWidth = w * E.u; ctx.stroke()
  ctx.restore()
}
export function arrowHead(ctx, E, x, y, ang, s, col = P.cyan, a = 1) {
  ctx.save(); ctx.globalAlpha *= a
  ctx.translate(x, y); ctx.rotate(ang)
  ctx.fillStyle = col
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.lineTo(-s * 0.6, s * 0.7); ctx.closePath(); ctx.fill()
  ctx.restore()
}

// 颗粒（防止深色渐变出色带）：256 的小块铺成比画面大一圈的整张，只算一次；每帧错开位置贴一次（图案填充一帧要四十毫秒，贴整张只要两毫秒）
export function grainSheet(E) {
  return E.once('news-grain', () => {
    const S = 256, t = E.createCanvas(S, S), x = t.getContext('2d'), img = x.createImageData(S, S), r = E.rng(91)
    for (let i = 0; i < S * S; i++) { const v = Math.floor(r() * 255); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255 }
    x.putImageData(img, 0, 0)
    const c = E.createCanvas(E.W + S, E.H + S), y = c.getContext('2d')
    for (let yy = 0; yy < E.H + S; yy += S) for (let xx = 0; xx < E.W + S; xx += S) y.drawImage(t, xx, yy)
    return c
  })
}
