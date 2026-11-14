// 聊天界面的零件：配色（全部从 this.c 推出来）、圆角、图标、头像。
// 图标、头像沿用原样片 W-聊天界面 的画法库；去掉了带题材的字母头像，字体不写死名字。
import { mix, hexToRgb, clamp } from '../../../core.mjs'

export const outE = t => 1 - Math.pow(1 - t, 3)
export const backE = t => 1 + 2.5 * Math.pow(t - 1, 3) + 1.5 * Math.pow(t - 1, 2)
export const kk = (t, t0, d) => clamp((t - t0) / d)
export const lum = h => { const [r, g, b] = hexToRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 }

// 配色：手机里的字色从气泡底色和背景色推出来，用户用 colors 换了哪个，其余的跟着变
const memo = new WeakMap()
export function pal(c) {
  let C = memo.get(c)
  if (C) return C
  const dark = lum(c.bg) < 0.45, lightCard = lum(c.card) > 0.5
  let ink = lightCard ? mix(c.bg, '#000000', 0.25) : '#ffffff'
  if (lightCard && lum(ink) > 0.3) ink = '#1d1f2a'
  C = {
    ...c, dark, ink,
    sub: mix(ink, c.card, 0.45),
    bg1: mix(c.bg, c.accent, 0.16),
    screen: mix(c.card, c.line, 0.42), bar: mix(c.card, c.line, 0.12), panel: mix(c.card, c.line, 0.62),
    faint: mix(c.line, ink, 0.22), skel: mix(c.line, c.card, 0.1),
    outInk: lum(c.accent2) > 0.55 ? mix(c.accent2, '#000000', 0.78) : '#ffffff',
    accSoft: mix(c.card, c.accent, 0.13), accMid: mix(c.card, c.accent, 0.32),
    side: dark ? c.fg : mix(c.fg, '#000000', 0.1), sideSub: c.muted,
    accL: dark ? mix(c.accent, '#ffffff', 0.38) : c.accent,
    capBg: dark ? mix(c.bg, '#000000', 0.32) : mix(ink, c.bg, 0.08),
    dot: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    bezel: '#0d0e13', bezelHi: '#3a3c4a', grn: '#2fa36b',
  }
  memo.set(c, C)
  return C
}

// 圆角矩形，r 可以是四个角各自的半径 [左上, 右上, 右下, 左下]
export function rr(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r]
  const [a, b, c, d] = r.map(v => Math.max(0, Math.min(v, w / 2, h / 2)))
  ctx.beginPath()
  ctx.moveTo(x + a, y)
  ctx.lineTo(x + w - b, y); ctx.arcTo(x + w, y, x + w, y + b, b)
  ctx.lineTo(x + w, y + h - c); ctx.arcTo(x + w, y + h, x + w - c, y + h, c)
  ctx.lineTo(x + d, y + h); ctx.arcTo(x, y + h, x, y + h - d, d)
  ctx.lineTo(x, y + a); ctx.arcTo(x, y, x + a, y, a)
  ctx.closePath()
}

// 图标：以 (x, y) 为中心，s 为边长
export function icon(ctx, name, x, y, s, color, lw) {
  ctx.save()
  ctx.translate(x, y)
  const k = s / 24
  ctx.scale(k, k)
  ctx.strokeStyle = color; ctx.fillStyle = color
  ctx.lineWidth = (lw || 2.2 * k) / k
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const P = () => ctx.beginPath()
  switch (name) {
    case 'check': P(); ctx.moveTo(-7, 0.5); ctx.lineTo(-2, 5.5); ctx.lineTo(8, -5.5); ctx.stroke(); break
    case 'back': P(); ctx.moveTo(4, -8); ctx.lineTo(-4, 0); ctx.lineTo(4, 8); ctx.stroke(); break
    case 'dots': for (const dx of [-7, 0, 7]) { P(); ctx.arc(dx, 0, 2, 0, 7); ctx.fill() } break
    case 'plus': P(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke(); P(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke(); break
    case 'mic': rr(ctx, -4, -10, 8, 13, 4); ctx.stroke(); P(); ctx.moveTo(-8, -1); ctx.quadraticCurveTo(-8, 8, 0, 8); ctx.quadraticCurveTo(8, 8, 8, -1); ctx.moveTo(0, 8); ctx.lineTo(0, 11); ctx.stroke(); break
    case 'face': P(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke(); P(); ctx.arc(-3.5, -2.5, 1.4, 0, 7); ctx.arc(3.5, -2.5, 1.4, 0, 7); ctx.fill(); P(); ctx.arc(0, 1, 5, 0.3, Math.PI - 0.3); ctx.stroke(); break
    case 'chart': P(); ctx.moveTo(-10, 9); ctx.lineTo(10, 9); ctx.stroke(); rr(ctx, -8, 3, 5, 6, 1); ctx.fill(); rr(ctx, -1, -3, 5, 12, 1); ctx.fill(); rr(ctx, 6, -9, 5, 18, 1); ctx.fill(); break
    case 'list': for (const dy of [-6, 0, 6]) { P(); ctx.arc(-7, dy, 1.6, 0, 7); ctx.fill(); P(); ctx.moveTo(-3, dy); ctx.lineTo(8, dy); ctx.stroke() } break
    case 'play': P(); ctx.moveTo(-4, -7); ctx.lineTo(7, 0); ctx.lineTo(-4, 7); ctx.closePath(); ctx.fill(); break
    case 'wave': for (let i = 0; i < 5; i++) { const h = [4, 9, 13, 8, 5][i]; P(); ctx.moveTo(-8 + i * 4, -h / 2); ctx.lineTo(-8 + i * 4, h / 2); ctx.stroke() } break
    case 'link': ctx.rotate(-Math.PI / 4); rr(ctx, -10, -4, 11, 8, 4); ctx.stroke(); rr(ctx, -1, -4, 11, 8, 4); ctx.stroke(); break
    // 以下是移植时补的：图钉、心形、人像、对话框、星
    case 'pin': ctx.rotate(0.6); P(); ctx.moveTo(-5, -10); ctx.lineTo(5, -10); ctx.moveTo(-3, -10); ctx.lineTo(-3, -3); ctx.lineTo(-7, 2); ctx.lineTo(7, 2); ctx.lineTo(3, -3); ctx.lineTo(3, -10); ctx.moveTo(0, 2); ctx.lineTo(0, 11); ctx.stroke(); break
    case 'heart': P(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-13, 0, -8, -12, 0, -5); ctx.bezierCurveTo(8, -12, 13, 0, 0, 8); ctx.fill(); break
    case 'user': P(); ctx.arc(0, -4, 5, 0, 7); ctx.fill(); P(); ctx.ellipse(0, 10, 10, 7, 0, Math.PI, 0); ctx.fill(); break
    case 'msg': rr(ctx, -10, -8, 20, 14, 5); ctx.stroke(); P(); ctx.moveTo(-4, 6); ctx.lineTo(-7, 10); ctx.lineTo(1, 6); ctx.stroke(); break
    case 'star': P(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4.4 : 10; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) } ctx.closePath(); ctx.fill(); break
  }
  ctx.restore()
}

// 圆形徽章：底色圆 + 图标
export function badge(ctx, name, x, y, r, bg, fg = '#fff') {
  if (r <= 0) return
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
  icon(ctx, name, x, y, r * 1.35, fg, r * 0.24)
}

// 头像：a = 强调色底的人像；b = 灰底的人像；group = 四宫格群头像
export function avatar(ctx, kind, x, y, s, C) {
  ctx.save()
  if (kind === 'group') {
    ctx.fillStyle = C.panel; rr(ctx, x, y, s, s, s * 0.28); ctx.fill()
    const g = s * 0.06, t = (s - g * 3) / 2, cols = [C.accent, mix(C.accent2, '#000000', 0.18), C.sub, mix(C.accent, '#000000', 0.3)]
    cols.forEach((col, i) => {
      const tx = x + g + (i % 2) * (t + g), ty = y + g + Math.floor(i / 2) * (t + g)
      ctx.fillStyle = col; rr(ctx, tx, ty, t, t, t * 0.25); ctx.fill()
      icon(ctx, 'user', tx + t / 2, ty + t * 0.52, t * 0.7, 'rgba(255,255,255,0.92)')
    })
  } else {
    ctx.fillStyle = kind === 'b' ? C.sub : C.accent; rr(ctx, x, y, s, s, s * 0.28); ctx.fill()
    ctx.save(); rr(ctx, x, y, s, s, s * 0.28); ctx.clip()
    icon(ctx, 'user', x + s / 2, y + s * 0.56, s * 0.78, 'rgba(255,255,255,0.95)')
    ctx.restore()
  }
  ctx.restore()
}

// 灰色骨架条
export function skel(ctx, x, y, w, h, color) { ctx.fillStyle = color; rr(ctx, x, y, w, h, h / 2); ctx.fill() }

// 放不下时截断加省略号（只用于置顶条这类重复出现的字）
export function ellipsis(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  const ch = [...text]
  while (ch.length > 1 && ctx.measureText(ch.join('') + '…').width > maxW) ch.pop()
  return ch.join('') + '…'
}
