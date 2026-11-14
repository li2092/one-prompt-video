// 手机：几何、外壳和屏幕底（画在背景里）、状态栏（最上层）、语音转文字字幕、标题栏里的联系人。
// 画法沿用原样片的 drawPhone / subtitle；横屏手机居中、两侧放关键词，竖屏手机几乎占满、底部是关键词区。
import { clamp, drawLines, textUnits } from '../../../core.mjs'
import { captionChunks } from '../../../layouts.mjs'
import { pal, rr, icon, avatar, skel, outE } from './ui.mjs'

// P = 聊天内容的尺寸单位：原样片横屏手机屏宽 446 时为 1，竖屏屏宽 672 时为 1（原样片竖屏 1.5 倍）
export function geo(E) {
  return E.once('chat:geo', () => {
    const { W, H, u, portrait } = E, cap = E.captionH > 0
    let ph, bz, status, header, composer, P, strip = null, kw = null, sides = null, right, compY
    if (!portrait) {
      const h = cap ? Math.min(866 * u, H - 214 * u) : Math.min(960 * u, H - 100 * u), w = h * 0.57
      ph = { x: (W - w) / 2, y: cap ? 34 * u : (H - h) / 2, w, h, r: h * 0.075 }
      bz = 12 * u * h / 826
      const scw = w - 2 * bz
      P = scw / 446; status = 34 * P; header = 72 * P; composer = 78 * P
      const sw = ph.x - 110 * u
      if (sw > 400 * u) sides = { L: ph.x / 2 + 10 * u, R: W - ph.x / 2 - 10 * u, w: sw }
    } else {
      const s = W / 1080
      ph = { x: 22 * s, y: 96 * s, w: W - 44 * s, h: H - 120 * s, r: 92 * s }
      bz = 14 * s
      P = (ph.w - 2 * bz) / 672; status = 64 * s; header = 120 * s; composer = 112 * s
    }
    const sc = { x: ph.x + bz, y: ph.y + bz, w: ph.w - 2 * bz, h: ph.h - 2 * bz, r: ph.r - bz }
    const view = { x: sc.x, y: sc.y + status + header, w: sc.w }
    if (!portrait) { compY = sc.y + sc.h - composer; view.bottom = compY; right = sc.x + sc.w }
    else {
      const s = W / 1080, kwH = 262 * s
      compY = sc.y + sc.h - kwH - composer
      view.bottom = cap ? compY - 158 * s : compY
      if (cap) strip = { y: view.bottom, h: compY - view.bottom }
      kw = { y: compY + composer, h: kwH }
      right = Math.min(sc.x + sc.w, 944 * s)   // 竖屏消息右沿让出平台右侧的按钮列
    }
    view.h = view.bottom - view.y; view.right = right
    return { P, ph, sc, status, header, composer, compY, view, strip, kw, sides, hm: sc.y + status + header / 2, cy: ph.y + ph.h / 2 }
  })
}

// 背景：深靛色渐变、两团慢慢漂的柔光、点阵；再画手机外壳、屏幕底、标题栏、输入栏
export function drawBg(ctx, E, c) {
  const C = pal(c), G = geo(E), { W, H, u, T } = E, P = G.P
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H)
  g.addColorStop(0, C.bg); g.addColorStop(1, C.bg1)
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const blob = (x, y, r, col, a) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, E.rgba(col, a)); rg.addColorStop(1, E.rgba(col, 0))
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  blob(W * 0.18 + Math.sin(T * 0.21) * 60 * u, H * 0.25 + Math.cos(T * 0.17) * 40 * u, 520 * u, C.accent, 0.16)
  blob(W * 0.84 + Math.cos(T * 0.19) * 60 * u, H * 0.78 + Math.sin(T * 0.23) * 40 * u, 560 * u, C.accent2, 0.10)
  ctx.drawImage(E.once('chat:dots', () => {
    const cv = E.createCanvas(W, H), x = cv.getContext('2d'), s = 36 * u
    x.fillStyle = C.dot
    for (let y = s / 2; y < H; y += s) for (let xx = s / 2; xx < W; xx += s) { x.beginPath(); x.arc(xx, y, 1.6 * u, 0, 7); x.fill() }
    return cv
  }), 0, 0)
  // 外壳
  const { ph, sc } = G
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 50 * u; ctx.shadowOffsetY = 18 * u
  ctx.fillStyle = C.bezel; rr(ctx, ph.x, ph.y, ph.w, ph.h, ph.r); ctx.fill(); ctx.restore()
  ctx.strokeStyle = C.bezelHi; ctx.lineWidth = 2 * u; rr(ctx, ph.x + u, ph.y + u, ph.w - 2 * u, ph.h - 2 * u, ph.r); ctx.stroke()
  ctx.fillStyle = '#2a2c36'
  rr(ctx, ph.x + ph.w - u, ph.y + ph.h * 0.2, 5 * u, ph.h * 0.09, 3 * u); ctx.fill()
  rr(ctx, ph.x - 4 * u, ph.y + ph.h * 0.17, 5 * u, ph.h * 0.05, 3 * u); ctx.fill()
  rr(ctx, ph.x - 4 * u, ph.y + ph.h * 0.24, 5 * u, ph.h * 0.05, 3 * u); ctx.fill()
  // 屏幕
  ctx.save(); rr(ctx, sc.x, sc.y, sc.w, sc.h, sc.r); ctx.clip()
  ctx.fillStyle = C.screen; ctx.fillRect(sc.x, sc.y, sc.w, sc.h)
  ctx.fillStyle = C.bar; ctx.fillRect(sc.x, sc.y, sc.w, G.status + G.header)
  ctx.fillStyle = C.line; ctx.fillRect(sc.x, G.view.y - 1.5 * P, sc.w, 1.5 * P)
  icon(ctx, 'back', sc.x + 30 * P, G.hm, 28 * P, C.ink, 3 * P)
  icon(ctx, 'dots', sc.x + sc.w - 34 * P, G.hm, 28 * P, C.ink)
  if (G.strip) { ctx.fillStyle = C.panel; ctx.fillRect(sc.x, G.strip.y, sc.w, G.strip.h); ctx.fillStyle = C.line; ctx.fillRect(sc.x, G.strip.y, sc.w, 1.5 * P) }
  // 输入栏
  const ch = G.composer, cm = G.compY + ch / 2
  ctx.fillStyle = C.bar; ctx.fillRect(sc.x, G.compY, sc.w, ch)
  ctx.fillStyle = C.line; ctx.fillRect(sc.x, G.compY, sc.w, 1.5 * P)
  icon(ctx, 'plus', sc.x + 34 * P, cm, 30 * P, C.ink, 2.4 * P)
  const fx = sc.x + 64 * P, fw = sc.w - 64 * P - 112 * P, fh = 46 * P
  ctx.fillStyle = C.card; rr(ctx, fx, cm - fh / 2, fw, fh, fh / 2); ctx.fill()
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.5 * P; ctx.stroke()
  if (Math.floor(T * 2.4) % 2 === 0) { ctx.fillStyle = C.accent; ctx.fillRect(fx + 20 * P, cm - 14 * P, 2.5 * P, 28 * P) }
  icon(ctx, 'face', sc.x + sc.w - 86 * P, cm, 30 * P, C.ink, 2.2 * P)
  icon(ctx, 'mic', sc.x + sc.w - 36 * P, cm, 30 * P, C.ink, 2.2 * P)
  if (G.kw) { ctx.fillStyle = C.panel; ctx.fillRect(sc.x, G.kw.y, sc.w, G.kw.h) }
  ctx.fillStyle = C.ink; rr(ctx, sc.x + sc.w / 2 - 70 * P, sc.y + sc.h - 16 * P, 140 * P, 6 * P, 3 * P); ctx.fill()
  ctx.restore()
}

// 最上层：状态栏（信号、刘海、电池），不显示时间
export function drawStatus(ctx, E, c) {
  const C = pal(c), G = geo(E), { sc } = G, P = E.portrait ? G.P * 1.12 : G.P, sy = sc.y + G.status * 0.55
  ctx.fillStyle = C.ink
  for (let i = 0; i < 4; i++) { const h = (5 + i * 3) * P; rr(ctx, sc.x + 34 * P + i * 7 * P, sy + 7 * P - h, 4.5 * P, h, 1.5 * P); ctx.fill() }
  ctx.fillStyle = C.bezel; rr(ctx, sc.x + sc.w / 2 - 54 * P, sc.y + 8 * P, 108 * P, 22 * P, 11 * P); ctx.fill()
  ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6 * P
  rr(ctx, sc.x + sc.w - 70 * P, sy - 8 * P, 36 * P, 16 * P, 4 * P); ctx.stroke()
  ctx.fillStyle = C.ink; rr(ctx, sc.x + sc.w - 67 * P, sy - 5 * P, 24 * P, 10 * P, 2 * P); ctx.fill()
  rr(ctx, sc.x + sc.w - 32 * P, sy - 3 * P, 3 * P, 6 * P, P); ctx.fill()
}

// 标题栏里的联系人：头像、名字（来自 s.scene，没有就画一条骨架）、还有消息没发完时名字后面跳动的三个点
export function drawHeader(ctx, s, E, C, o) {
  const G = geo(E), P = G.P, { sc } = G, hm = G.hm, x = sc.x + 110 * P
  avatar(ctx, o.group ? 'group' : 'a', sc.x + 56 * P, hm - 21 * P, 42 * P, C)
  let end = x
  if (o.name) {
    const q = o.nameEl != null ? s.p(o.nameEl) : 1
    const f = E.fit(o.name, { role: 'title', weight: 700, size: 28 * P, maxW: sc.w - 110 * P - 84 * P, maxLines: 2, lineGap: 1.15 })
    ctx.save(); ctx.globalAlpha *= clamp(q * 2); ctx.fillStyle = C.ink; ctx.font = E.font('title', 700, f.size)
    const lines = f.lines.length === 1 ? [E.typeOn(f.lines[0], outE(q))] : f.lines
    drawLines(ctx, lines, x, hm - f.lines.length * f.lineH / 2, f.lineH, 'left'); ctx.restore()
    ctx.font = E.font('title', 700, f.size); end = x + ctx.measureText(f.lines[f.lines.length - 1]).width
    if (f.lines.length > 1) end = -1
  } else skel(ctx, x, hm - 8 * P, 150 * P, 16 * P, C.skel)
  // 对方还在输入：名字后面三个跳动的点
  if (o.pending && end > 0) for (let i = 0; i < 3; i++) {
    const b = Math.max(0, Math.sin((E.T * 2.2 - i * 0.18) * Math.PI * 2))
    ctx.fillStyle = E.rgba(C.accent, 0.45 + 0.55 * b); ctx.beginPath(); ctx.arc(end + 20 * P + i * 13 * P, hm - b * 3 * P, 4.5 * P, 0, 7); ctx.fill()
  }
}

// 字幕：做成「语音转文字」卡。横屏在手机下面，竖屏在输入栏上方的语音条里；竖屏没有字幕的场显示待机波形
export function drawCap(ctx, s, E, c) {
  const C = pal(c), G = geo(E), { W, H, u } = E, por = E.portrait, say = s.scene.say
  const cyBase = por ? (G.strip ? G.strip.y + G.strip.h / 2 : 0) : (G.ph.y + G.ph.h + H) / 2
  if (!say) {
    if (!G.strip) return
    for (let i = 0; i < 41; i++) {
      const bx = W / 2 + (i - 20) * 18 * u, hh = (6 + 16 * Math.abs(Math.sin(i * 0.9 + E.T * 3.1) * Math.sin(i * 0.37 - E.T * 1.7))) * u * (1 - Math.abs(i - 20) / 26)
      ctx.fillStyle = E.rgba(C.accent, 0.28); rr(ctx, bx - 3 * u, cyBase - hh, 6 * u, hh * 2, 3 * u); ctx.fill()
    }
    return
  }
  const chunks = captionChunks(say, por ? 15 : 28), lens = chunks.map(x => textUnits(x)), total = lens.reduce((a, b) => a + b, 0)
  const span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  const a = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
  const size = (por ? 36 : 34) * u, padX = 30 * u, ic = 44 * u, padY = (por ? 16 : 13) * u
  const maxW = (por ? G.sc.w - 120 * u : Math.min(1080 * u, W - 240 * u)) - padX * 2 - ic
  const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 500, size, maxW, maxLines: 2, lineGap: 1.32, quiet: true })
  const w = f.width + padX * 2 + ic, h = f.lines.length * f.lineH + padY * 2, x = W / 2 - w / 2
  const dy = (1 - outE(a)) * 10 * u, y = cyBase - h / 2 + dy
  ctx.globalAlpha = a
  ctx.fillStyle = C.capBg; rr(ctx, x, y, w, h, 24 * u); ctx.fill()
  icon(ctx, 'wave', x + padX + ic / 2 - 8 * u, y + h / 2, 34 * u, C.accL, 3 * u)
  ctx.fillStyle = '#ffffff'; ctx.font = E.font('body', 500, f.size)
  drawLines(ctx, f.lines, x + padX + ic, y + padY, f.lineH, 'left')
}

// 包住手机的一圈虚线框（原样片收尾的「外面那一层」），q 是画到几成
export function phoneRing(ctx, E, C, q) {
  if (q <= 0) return
  const G = geo(E), { ph } = G, m = E.pick(20, 9) * E.u, x = ph.x - m, y = ph.y - m, w = ph.w + 2 * m, h = ph.h + 2 * m
  ctx.save()
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.arc(x + w / 2, y + h / 2, Math.max(w, h), -Math.PI / 2, -Math.PI / 2 + Math.min(q, 0.9999) * Math.PI * 2); ctx.closePath(); ctx.clip()
  ctx.strokeStyle = C.accL; ctx.lineWidth = 7 * E.u; ctx.setLineDash([22 * E.u, 14 * E.u]); ctx.lineDashOffset = -E.T * 40 * E.u
  rr(ctx, x, y, w, h, ph.r + m); ctx.stroke()
  ctx.restore()
}
