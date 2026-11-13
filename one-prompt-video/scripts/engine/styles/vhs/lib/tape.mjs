// 移植自风格库的 R-复古录像带：画法库。调色（跟着 this.c 走）、入场、复古立体大字、四色条纹、胶囊标签、节目卡、
// 老电视、录像带侧标、录像机面板、按钮符号、闪光、噪点贴图和雪花。所有函数只看传进来的时刻，不存跨帧状态。
import { mix, clamp, lerp, ease, roundRect, drawLines } from '../../../core.mjs'

export const P = {}
// 固定的装饰色：录像机显示屏的青色、电平灯的绿、录制红点、显像管玻璃、屏显白
export const FIX = { cyan: '#46d9f0', teal: '#2ec4b6', green: '#3fcf74', red: '#e8463a', glass: '#0e1820', osd: '#f4fff4', white: '#ffffff' }
export const SHADE = 'rgba(10,5,20,0.55)'

// 主色调从 this.c 取；四色条纹是强调色到第二强调色的四级渐变（默认是黄、橙、红、洋红）
export function setPal(c) {
  if (P.src === c) return
  Object.assign(P, { src: c, bg: c.bg, fg: c.fg, muted: c.muted, acc: c.accent, acc2: c.accent2, card: c.card, ink: c.line, on: c.onAccent })
  P.stripes = [c.accent, mix(c.accent, c.accent2, 0.35), mix(c.accent, c.accent2, 0.7), c.accent2]
  P.card2 = mix(c.card, c.line, 0.2)
}

// ---------- 入场 ----------
// dt 是入场后过了几秒。pop 弹出 / stamp 盖章 / drop 掉落 / left right 滑入 / up 浮上 / crt 老电视开机（先是一条亮线再撑开）
export function enter(dt, kind = 'pop', u = 1) {
  const o = { sx: 1, sy: 1, a: 1, dx: 0, dy: 0, flash: 0 }
  if (dt < 0) { o.a = 0; return o }
  if (kind === 'pop') { o.sx = o.sy = Math.max(0.01, ease.outBack(clamp(dt / 0.32))); o.a = clamp(dt / 0.08) }
  else if (kind === 'stamp') {
    const p = clamp(dt / 0.15)
    o.sx = o.sy = lerp(1.4, 1, ease.in(p)) + (p >= 1 ? 0.05 * Math.exp(-(dt - 0.15) * 14) * Math.sin((dt - 0.15) * 40) : 0)
    o.a = clamp(dt / 0.05)
  } else if (kind === 'drop') { o.dy = -(1 - ease.outBack(clamp(dt / 0.42))) * 240 * u; o.a = clamp(dt / 0.08) }
  else if (kind === 'left' || kind === 'right') o.dx = (kind === 'left' ? -1 : 1) * (1 - ease.outExpo(clamp(dt / 0.4))) * 1000 * u
  else if (kind === 'up') { o.dy = (1 - ease.outExpo(clamp(dt / 0.36))) * 110 * u; o.a = clamp(dt / 0.12) }
  else if (kind === 'crt') {
    const p1 = clamp(dt / 0.1), p2 = clamp((dt - 0.1) / 0.22)
    o.sy = dt < 0.1 ? 0.02 : lerp(0.02, 1, ease.outBack(p2))
    o.sx = dt < 0.1 ? lerp(0.1, 1.1, ease.out(p1)) : lerp(1.1, 1, p2)
    o.flash = 1 - clamp((dt - 0.05) / 0.3)
  }
  return o
}
// 按入场方式画一个以 (x, y) 为中心的元素；fn 在 (0,0) 为中心作画，拿到 o（crt 的闪白在 o.flash）
export function put(ctx, dt, x, y, kind, u, fn, rot = 0) {
  const o = enter(dt, kind, u)
  if (o.a <= 0.001) return
  ctx.save(); ctx.globalAlpha *= o.a; ctx.translate(x + o.dx, y + o.dy); if (rot) ctx.rotate(rot); ctx.scale(o.sx, o.sy)
  fn(o)
  ctx.restore()
}

// ---------- 文字 ----------
function grad(name) {
  if (name === 'chrome') return [[0, '#ffffff'], [0.42, '#c9eeff'], [0.5, '#4a7fe0'], [0.56, '#8ec8ff'], [1, '#f2fbff']]
  if (name === 'mint') return [[0, '#f4fff2'], [0.45, '#9ff5c8'], [0.52, '#3fcf9a'], [1, '#1d9c8f']]
  return [[0, '#fffbd6'], [0.36, P.acc], [0.5, mix(P.acc, P.acc2, 0.3)], [0.53, mix(P.acc, P.acc2, 0.5)], [1, P.acc2]]
}
// 复古立体大字：斜体、深色立体投影、粗描边、渐变填色、外沿一点洋红和青色的错位色边。(x, y) 是这一行的中心
// 斜切、描边和投影会让字比量出来的宽约 0.3 个字号，排字时要留出来
export function retro(ctx, str, x, y, font, size, o = {}) {
  ctx.save()
  ctx.translate(x, y); ctx.transform(1, 0, -0.13, 1, 0, 0)
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  const depth = size * 0.09, steps = Math.max(3, Math.round(depth / 3))
  ctx.strokeStyle = P.ink; ctx.lineWidth = size * 0.13
  for (let i = steps; i >= 1; i--) { const d = depth * i / steps; ctx.strokeText(str, d * 0.55, d) }
  ctx.strokeText(str, 0, 0)
  const g = ctx.createLinearGradient(0, -size * 0.48, 0, size * 0.42)
  for (const [p, c] of grad(o.grad)) g.addColorStop(p, c)
  ctx.fillStyle = g; ctx.fillText(str, 0, 0)
  ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= 0.35
  ctx.fillStyle = P.acc2; ctx.fillText(str, -size * 0.03, 0)
  ctx.fillStyle = FIX.cyan; ctx.fillText(str, size * 0.03, 0)
  ctx.restore()
}
// 粗体字：深色硬投影 + 深色描边 + 填色，花底上也读得清
export function bold(ctx, str, x, y, size, col) {
  ctx.lineJoin = 'round'
  ctx.fillStyle = P.ink; ctx.fillText(str, x + size * 0.045, y + size * 0.06)
  ctx.lineWidth = size * 0.1; ctx.strokeStyle = P.ink; ctx.strokeText(str, x, y)
  ctx.fillStyle = col; ctx.fillText(str, x, y)
}
// 不加框的说明字（浅色，带投影）
export function label(ctx, f, font, x, y, col) {
  ctx.font = font
  ctx.fillStyle = SHADE; drawLines(ctx, f.lines, x + f.size * 0.05, y + f.size * 0.07, f.lineH, 'center')
  ctx.fillStyle = col; drawLines(ctx, f.lines, x, y, f.lineH, 'center')
}

// 四色条纹：(x, y) 是左端的中线，p 是从左往右扫出了多少
export function stripes(ctx, x, y, w, h, p = 1, cols = P.stripes) {
  if (p <= 0) return
  const bh = h / cols.length
  cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x, y - h / 2 + i * bh, w * p, bh + 0.5) })
}
// 胶囊标签：圆角、深色粗边、硬投影，以 (0,0) 为中心；f 是 E.fit 的结果（可以两行）。stripes 时背后横穿四色条纹
export const pillH = f => f.lines.length * f.lineH + f.size * 0.36
export function pill(ctx, f, font, u, o = {}) {
  const s = f.size, h = pillH(f), w = f.width + s * 1.3, r = Math.min(h / 2, s * 0.82)
  if (o.stripes) stripes(ctx, -w / 2 - s * 2.4, 0, w + s * 4.8, Math.min(h, s * 1.64) * 0.62, o.sp ?? 1)
  ctx.fillStyle = SHADE; roundRect(ctx, -w / 2 + s * 0.12, -h / 2 + s * 0.14, w, h, r); ctx.fill()
  ctx.fillStyle = o.fill || P.card; roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fill()
  ctx.lineWidth = Math.max(3 * u, s * 0.09); ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = o.color || P.ink; ctx.font = font
  drawLines(ctx, f.lines, 0, -h / 2 + s * 0.18 + s * 0.04, f.lineH, 'center')
  return { w, h }
}
// 复古立体的双引号（用图形画，不靠字体：中文字体里引号的位置各家不一样）。以 (0,0) 为中心，s 是整体高度
export function quoteMark(ctx, s) {
  const r = s * 0.2
  const path = () => {
    ctx.beginPath()
    for (const cx of [-r * 1.25, r * 1.25]) {
      const cy = s * 0.22
      ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx - r * 1.05, cy - r * 2.3, cx + r * 0.9, cy - r * 2.7)
      ctx.lineTo(cx + r * 0.75, cy - r * 2.05); ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 1.7, cx + r * 0.1, cy - r * 0.95); ctx.closePath()
    }
  }
  ctx.save(); ctx.transform(1, 0, -0.13, 1, 0, 0); ctx.lineJoin = 'round'
  ctx.translate(s * 0.05, s * 0.07); path(); ctx.fillStyle = P.ink; ctx.fill(); ctx.lineWidth = s * 0.08; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.translate(-s * 0.05, -s * 0.07); path(); ctx.stroke()
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.42)
  for (const [p, c] of grad()) g.addColorStop(p, c)
  ctx.fillStyle = g; ctx.fill()
  ctx.restore()
}
// 录像带正面：黑壳，上面一大张奶油色贴纸（下沿四色条纹），下面是透明窗和两只转动的卷盘。以 (0,0) 为中心；labH 是贴纸高度
export const cassetteWin = (u, w) => Math.min(170 * u, w * 0.13)
export function cassette(ctx, u, w, h, labH, spin) {
  const r = 18 * u, wh = cassetteWin(u, w), lw = w - 64 * u, lx = -lw / 2, ly = -h / 2 + 28 * u
  ctx.fillStyle = SHADE; roundRect(ctx, -w / 2 + 12 * u, -h / 2 + 14 * u, w, h, r); ctx.fill()
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#2b2433'); g.addColorStop(1, '#141018')
  ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fill()
  ctx.lineWidth = 5 * u; ctx.strokeStyle = '#05030a'; ctx.stroke()
  ctx.fillStyle = P.card; roundRect(ctx, lx, ly, lw, labH, 8 * u); ctx.fill()
  ctx.save(); roundRect(ctx, lx, ly, lw, labH, 8 * u); ctx.clip(); stripes(ctx, lx, ly + labH - 24 * u, lw, 24 * u); ctx.restore()
  const ww = w * 0.5, wy = ly + labH + 22 * u
  ctx.fillStyle = '#0a0710'; roundRect(ctx, -ww / 2, wy, ww, wh, 10 * u); ctx.fill()
  ctx.strokeStyle = '#4a4258'; ctx.lineWidth = 2 * u; ctx.stroke()
  const rr = wh * 0.36, cy = wy + wh / 2
  for (const [cx, rad] of [[-ww * 0.26, rr * 1.2], [ww * 0.26, rr * 0.75]]) {
    ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.fill()
    ctx.fillStyle = P.card; ctx.beginPath(); ctx.arc(cx, cy, rr * 0.5, 0, 7); ctx.fill()
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3 * u
    for (let k = 0; k < 3; k++) { const a = spin + k * 2.094; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rr * 0.48, cy + Math.sin(a) * rr * 0.48); ctx.stroke() }
  }
  ctx.fillStyle = '#05030a'
  for (const sx of [-w * 0.4, w * 0.4]) { ctx.beginPath(); ctx.arc(sx, h / 2 - 26 * u, 9 * u, 0, 7); ctx.fill() }
  return { x: lx, y: ly, w: lw, h: labH }
}

// ---------- 老电视 ----------
// 机壳两色（上、下渐变）。cab 可以是这几种的名字，也可以直接给 [上, 下]
export const CAB = {
  orange: ['#e0814a', '#9c4325'], teal: ['#46b3a6', '#1f6d66'], cream: ['#f0e2c0', '#c9ad7c'],
  red: ['#d9534f', '#8d2433'], wood: ['#a8693d', '#5f3519'], plum: ['#8a5aa8', '#4a2a66'],
}
// 屏幕在机壳里的位置（以机壳中心为原点）
export function tvGeom(w, h, o = {}) {
  const pad = Math.min(h, w) * 0.09, pw = o.panel === false ? 0 : Math.min(w * 0.17, h * 0.42)
  return { sx: -w / 2 + pad, sy: -h / 2 + pad, sw: w - pad * 2 - pw, sh: h - pad * 2, pw, pad }
}
// 老电视：机壳、奶油色屏框、圆角显像管屏、右侧旋钮面板、天线（o.ant 是天线高度，0 不画）。
// screen(c, sw, sh) 以屏幕中心为原点作画；不给 screen 就是关着的黑屏
export function tv(ctx, u, w, h, screen, o = {}) {
  const r = h * 0.1, [c0, c1] = Array.isArray(o.cab) ? o.cab : CAB[o.cab || 'orange'], ink = P.ink
  if (o.ant) {
    ctx.strokeStyle = ink; ctx.lineWidth = 6 * u; ctx.lineCap = 'round'
    const ax = -w * 0.08, ay = -h / 2 + 4 * u
    for (const [tx, ty] of [[ax - o.ant * 0.95, ay - o.ant], [ax + o.ant * 0.8, ay - o.ant * 0.88]]) {
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(tx, ty); ctx.stroke()
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(tx, ty, 7 * u, 0, 7); ctx.fill()
    }
    ctx.fillStyle = ink; roundRect(ctx, ax - 22 * u, ay - 16 * u, 44 * u, 22 * u, 10 * u); ctx.fill()
  }
  ctx.fillStyle = ink
  const fh = Math.min(h * 0.07, 22 * u)
  ctx.fillRect(-w * 0.32, h / 2 - 4 * u, 14 * u, fh); ctx.fillRect(w * 0.32 - 14 * u, h / 2 - 4 * u, 14 * u, fh)
  ctx.fillStyle = SHADE; roundRect(ctx, -w / 2 + 10 * u, -h / 2 + 12 * u, w, h, r); ctx.fill()
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, c0); g.addColorStop(1, c1)
  ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fill()
  ctx.lineWidth = 5 * u; ctx.strokeStyle = ink; ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3 * u; roundRect(ctx, -w / 2 + 8 * u, -h / 2 + 8 * u, w - 16 * u, h - 16 * u, r * 0.8); ctx.stroke()
  const { sx, sy, sw, sh, pw, pad } = tvGeom(w, h, o)
  ctx.fillStyle = mix(P.card, '#c9ad7c', 0.5); roundRect(ctx, sx - 8 * u, sy - 8 * u, sw + 16 * u, sh + 16 * u, r * 0.9); ctx.fill()
  ctx.lineWidth = 3 * u; ctx.strokeStyle = ink; ctx.stroke()
  ctx.save()
  roundRect(ctx, sx, sy, sw, sh, r * 0.75); ctx.clip()
  ctx.fillStyle = FIX.glass; ctx.fillRect(sx, sy, sw, sh)
  if (screen) { ctx.save(); ctx.translate(sx + sw / 2, sy + sh / 2); screen(ctx, sw, sh); ctx.restore() }
  // 显像管：扫描线、四周暗角、玻璃反光
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (let yy = sy; yy < sy + sh; yy += 4 * u) ctx.fillRect(sx, yy, sw, 1.5 * u)
  const rg = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, Math.min(sw, sh) * 0.3, sx + sw / 2, sy + sh / 2, Math.max(sw, sh) * 0.72)
  rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = rg; ctx.fillRect(sx, sy, sw, sh)
  const hg = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.6)
  hg.addColorStop(0, 'rgba(255,255,255,0.14)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.03)'); hg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hg; ctx.fillRect(sx, sy, sw, sh)
  ctx.restore()
  ctx.lineWidth = 4 * u; ctx.strokeStyle = ink; roundRect(ctx, sx, sy, sw, sh, r * 0.75); ctx.stroke()
  if (pw) {
    const px = w / 2 - pw / 2 - pad * 0.5, kr = Math.min(pw * 0.26, h * 0.1)
    for (const [ky, rot] of [[-h * 0.22, 0.6], [0, -0.9]]) {
      ctx.fillStyle = P.card; ctx.beginPath(); ctx.arc(px, ky, kr, 0, 7); ctx.fill()
      ctx.lineWidth = 4 * u; ctx.strokeStyle = ink; ctx.stroke()
      ctx.beginPath(); ctx.moveTo(px, ky); ctx.lineTo(px + Math.cos(rot - 1.57) * kr * 0.8, ky + Math.sin(rot - 1.57) * kr * 0.8); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(26,15,46,0.7)'
    for (let i = 0; i < 4; i++) { const yy = h * 0.17 + i * h * 0.065; ctx.beginPath(); ctx.moveTo(px - pw * 0.28, yy); ctx.lineTo(px + pw * 0.28, yy); ctx.stroke() }
  }
  return { sx, sy, sw, sh }
}
// 屏幕开机：前 0.1 秒是一条横亮线，然后画面上下撑开，闪白退去。fn() 以屏幕中心为原点画内容
export function screenOn(c, u, sw, sh, dt, fn) {
  if (dt < 0) return
  if (dt < 0.1) {
    const k = dt / 0.1
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-sw * 0.5 * k, -5 * u, sw * k, 10 * u)
    c.fillStyle = '#ffffff'; c.fillRect(-sw * 0.5 * k, -1.5 * u, sw * k, 3 * u)
    return
  }
  c.save(); c.scale(1, Math.max(0.02, ease.outBack(clamp((dt - 0.1) / 0.22)))); fn(); c.restore()
  const fl = 1 - clamp((dt - 0.1) / 0.3)
  if (fl > 0) { c.fillStyle = `rgba(255,255,255,${fl * 0.85})`; c.fillRect(-sw / 2, -sh / 2, sw, sh) }
}

// ---------- 录像带侧标（一盘带子侧着放，露出贴纸的那一面） ----------
// 以 (0,0) 为中心；返回贴纸上能写字的区域 { x, w }（相对中心）
export function spine(ctx, u, w, h, col) {
  const r = 8 * u
  ctx.fillStyle = SHADE; roundRect(ctx, -w / 2 + 8 * u, -h / 2 + 9 * u, w, h, r); ctx.fill()
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#3a3244'); g.addColorStop(0.5, '#211b29'); g.addColorStop(1, '#120e18')
  ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, r); ctx.fill()
  ctx.lineWidth = 3 * u; ctx.strokeStyle = '#05030a'; ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.09)'
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) ctx.fillRect(sd * (w / 2 - (16 + k * 9) * u) - 1.5 * u, -h * 0.3, 3 * u, h * 0.6)
  const lx = -w / 2 + 64 * u, lw = w - 128 * u, lh = h * 0.7, ly = -lh / 2, bw = Math.min(lh * 1.2, 90 * u)
  ctx.fillStyle = P.card; roundRect(ctx, lx, ly, lw, lh, 5 * u); ctx.fill()
  ctx.save(); roundRect(ctx, lx, ly, lw, lh, 5 * u); ctx.clip()
  ;[col, mix(col, '#ffffff', 0.35), mix(col, P.ink, 0.25)].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(lx + i * bw / 3, ly, bw / 3 + 0.5, lh) })
  ctx.restore()
  return { x: lx + bw + 26 * u, w: lw - bw - 46 * u, bx: lx + bw / 2, lh }
}

// ---------- 录像机面板：上沿进带口、左侧指示灯、中间显示窗、下沿一排按钮 ----------
// 以 (0,0) 为中心；返回显示窗 { x, y, w, h }
export function vcr(ctx, u, w, h, win, t) {
  ctx.fillStyle = SHADE; roundRect(ctx, -w / 2 + 10 * u, -h / 2 + 12 * u, w, h, 20 * u); ctx.fill()
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, '#3a3346'); g.addColorStop(1, '#1b1724')
  ctx.fillStyle = g; roundRect(ctx, -w / 2, -h / 2, w, h, 20 * u); ctx.fill()
  ctx.lineWidth = 5 * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-w / 2 + 20 * u, -h / 2 + 10 * u, w - 40 * u, 3 * u)
  // 进带口
  ctx.fillStyle = '#0a0710'; roundRect(ctx, -win.w * 0.32, -h / 2 + 24 * u, win.w * 0.64, 26 * u, 8 * u); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2 * u; ctx.stroke()
  // 显示窗
  const x = -win.w / 2, y = win.cy - win.h / 2
  ctx.fillStyle = '#071116'; roundRect(ctx, x, y, win.w, win.h, 12 * u); ctx.fill()
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 3 * u; ctx.stroke()
  // 指示灯：最上面一盏红灯一秒闪一次
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i === 0 ? (Math.floor(t * 2) % 2 ? FIX.red : '#5a1f2a') : i === 1 ? '#1f5a3a' : '#2b2533'
    ctx.beginPath(); ctx.arc(-w / 2 + 44 * u, win.cy - win.h * 0.28 + i * win.h * 0.28, 9 * u, 0, 7); ctx.fill()
  }
  // 按钮：倒带、播放、快进、停止、暂停
  const by = h / 2 - 42 * u, bs = 50 * u, kinds = ['rew', 'play', 'ff', 'stop', 'pause']
  kinds.forEach((k, i) => {
    const bx = (i - (kinds.length - 1) / 2) * (bs + 18 * u)
    ctx.fillStyle = '#2b2533'; roundRect(ctx, bx - bs / 2, by - 17 * u, bs, 34 * u, 6 * u); ctx.fill()
    ctx.strokeStyle = '#0a0710'; ctx.lineWidth = 2 * u; ctx.stroke()
    glyph(ctx, k, bx, by, 9 * u, 'rgba(244,255,244,0.75)')
  })
  return { x, y, w: win.w, h: win.h }
}
// 录像机按钮符号：play ▶ / ff ▶▶ / rew ◀◀ / stop ■ / pause ❚❚ / rec ●。s 是半高
export function glyph(ctx, kind, x, y, s, col) {
  ctx.fillStyle = col
  const tri = (cx, dir) => { ctx.beginPath(); ctx.moveTo(cx - dir * s * 0.75, y - s); ctx.lineTo(cx + dir * s * 0.75, y); ctx.lineTo(cx - dir * s * 0.75, y + s); ctx.closePath(); ctx.fill() }
  if (kind === 'play') tri(x, 1)
  else if (kind === 'ff') { tri(x - s * 0.7, 1); tri(x + s * 0.7, 1) }
  else if (kind === 'rew') { tri(x - s * 0.7, -1); tri(x + s * 0.7, -1) }
  else if (kind === 'stop') ctx.fillRect(x - s * 0.85, y - s * 0.85, s * 1.7, s * 1.7)
  else if (kind === 'pause') { ctx.fillRect(x - s * 0.85, y - s, s * 0.6, s * 2); ctx.fillRect(x + s * 0.25, y - s, s * 0.6, s * 2) }
  else if (kind === 'rec') { ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill() }
}
// 带深色描边的大符号（换台箭头、步骤之间的播放三角）
export function bigGlyph(ctx, kind, x, y, s, col, u) {
  ctx.save(); ctx.lineJoin = 'round'
  ctx.translate(x, y)
  for (const [c, grow] of [[P.ink, 7 * u], [col, 0]]) {
    const k = (s + grow) / s
    ctx.save(); ctx.scale(k, k); glyph(ctx, kind, 0, 0, s, c); ctx.restore()
  }
  ctx.restore()
}

// 四角星闪光
export function sparkle(ctx, x, y, r, col = FIX.white) {
  if (r <= 0.5) return
  ctx.fillStyle = col; ctx.beginPath()
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r)
  ctx.fill()
}

// ---------- 噪点贴图：只算一次，放大画出来 ----------
// 横十分之一、竖五分之一分辨率的灰噪点（不取纯黑纯白），平滑放大成一道道横纹（录像带空白段的样子），每秒换 10 张。
// 实测：原样片那种三分之一分辨率、硬边、每帧都换的满屏雪花，CRF 18 下半秒就要 10 MB；横纹、每秒换十来张只要它的七分之一上下
export const SNOW_RATE = 10
export function noise(E) {
  return E.once('vhs-noise', () => {
    const w = Math.ceil(E.W / 10), h = Math.ceil(E.H / 5), r = E.rng(77), out = []
    for (let k = 0; k < 6; k++) {
      const c = E.createCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h)
      for (let i = 0; i < w * h; i++) { const v = (30 + r() * 190) | 0; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255 }
      x.putImageData(id, 0, 0)
      out.push(c)
    }
    return out
  })
}
// 雪花：画在 (x, y, w, h) 里，frame 决定用哪张、从贴图的哪里取（frame 按 SNOW_RATE 每秒换几次，不要每帧换）
export function snow(ctx, E, x, y, w, h, frame, alpha = 1) {
  if (alpha <= 0 || w <= 0 || h <= 0) return
  const N = noise(E), img = N[((frame % N.length) + N.length) % N.length]
  const sw = Math.min(img.width, Math.max(1, w / 10)), sh = Math.min(img.height, Math.max(1, h / 5))
  const ox = (frame * 37) % Math.max(1, img.width - sw), oy = (frame * 53) % Math.max(1, img.height - sh)
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, ox, oy, sw, sh, x, y, w, h)
  ctx.restore()
}
