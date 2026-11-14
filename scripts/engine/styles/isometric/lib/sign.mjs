// 屏幕空间的字：白底圆角牌（带柔和投影）、引线和钉点、带厚度的键帽块。
// 移植自风格库的 D-等轴测机房（lib/iso.mjs 的 tag 和 keycap），改成接收 E.fit 排好的字，颜色从调色板 k 取。
import { clamp, lerp, ease, roundRect, rgba, drawLines } from '../../../core.mjs'
import { shade } from './iso.mjs'

const fill = (k, kind) => ({ accent: k.accent, dark: k.fg, ghost: rgba(k.card, 0.78) }[kind] ?? k.card)
export const ink = (k, kind) => ({ accent: k.onAccent, dark: k.bg, ghost: k.muted }[kind] ?? k.fg)

// 一块牌的底板。kind: light | accent | dark | ghost
export function board(ctx, E, k, x, y, w, h, kind = 'light', r) {
  const u = E.u
  ctx.save()
  ctx.shadowColor = 'rgba(40,36,80,0.16)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 6 * u
  roundRect(ctx, x, y, w, h, r ?? Math.min(h * 0.3, 24 * u)); ctx.fillStyle = fill(k, kind); ctx.fill()
  ctx.shadowColor = 'transparent'
  if (kind === 'light' || kind === 'ghost') { ctx.lineWidth = 1.5 * u; ctx.strokeStyle = k.line; ctx.stroke() }
  ctx.restore()
}

// 弹出：p 0..1，以 (cx, cy) 为中心从 0.7 倍弹到 1 倍
export function pop(ctx, p, cx, cy, fn) {
  if (p <= 0.001) return
  const e = ease.outBack(clamp(p)), s = lerp(0.7, 1, e)
  ctx.save(); ctx.globalAlpha *= clamp(p * 2.2); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); fn(); ctx.restore()
}

// 引线：从钉点 (ax, ay) 拉到 (bx, by)，p 是画出的比例；钉点是实心圆加白芯
export function lead(ctx, E, k, ax, ay, bx, by, p, col = rgba(k.fg, 0.45)) {
  if (p <= 0.001) return
  const u = E.u, e = ease.out(clamp(p))
  ctx.save(); ctx.globalAlpha *= clamp(p * 2.2)
  ctx.strokeStyle = col; ctx.lineWidth = 2 * u
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(lerp(ax, bx, e), lerp(ay, by, e)); ctx.stroke()
  ctx.fillStyle = col === rgba(k.fg, 0.45) ? k.fg : col; ctx.beginPath(); ctx.arc(ax, ay, 5.5 * u, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ax, ay, 2.4 * u, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// 写字：f 是 E.fit 的结果，(x, y) 是第一行的上沿
export function words(ctx, E, f, x, y, align, color, role = 'body', weight = 700) {
  ctx.fillStyle = color; ctx.font = E.font(role, weight, f.size); drawLines(ctx, f.lines, x, y, f.lineH, align)
}

// 带字的牌：返回尺寸；draw 为 false 时只量不画
export function tagSize(E, f, o = {}) {
  const padX = o.padX ?? f.size * 0.62, padY = o.padY ?? f.size * 0.36
  return { w: f.width + padX * 2 + (o.lead ?? 0), h: f.lines.length * f.lineH + padY * 2, padX, padY }
}
export function tag(ctx, E, k, f, x, y, o = {}) {
  const S = tagSize(E, f, o), kind = o.kind ?? 'light'
  pop(ctx, o.p ?? 1, x + S.w / 2, y + S.h / 2, () => {
    board(ctx, E, k, x, y, S.w, S.h, kind, o.r)
    words(ctx, E, f, o.align === 'center' ? x + S.w / 2 : x + S.padX + (o.lead ?? 0), y + S.padY, o.align ?? 'left', o.color ?? ink(k, kind), o.role, o.weight)
  })
  return { x, y, ...S }
}

// 键帽：带厚度的圆角块（屏幕空间），前沿往下压出 dz 的厚度；hi 0..1 往上抬一点
export function keycap(ctx, E, x, y, w, h, o = {}) {
  const u = E.u, dz = o.dz ?? 8 * u, col = o.col ?? '#ffffff', r = o.r ?? h * 0.24
  ctx.save()
  ctx.shadowColor = 'rgba(40,36,80,0.14)'; ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 5 * u
  roundRect(ctx, x, y + dz, w, h, r); ctx.fillStyle = shade(col, 0.72); ctx.fill()
  ctx.shadowColor = 'transparent'
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = col; ctx.fill()
  ctx.lineWidth = 1.5 * u; ctx.strokeStyle = o.line ?? shade(col, 0.8); ctx.stroke()
  ctx.restore()
}
