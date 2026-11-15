// 画法：自己画的场（layout: custom）用 E.kit 里的函数拼东西，画出来就是当前风格的材质。
// 这里是没有自己材质的主题和风格包用的默认实现：平涂色块，一层软投影。
// 风格包在 index.mjs 里写 kit(E) 返回同名函数，就换成它自己的材质（纸艺是剪纸，黏土是捏塑）。
import { mix } from './core.mjs'

export function baseKit(E) {
  const u = E.u, c = E.theme.c
  const paint = (ctx, fill, o = {}) => {
    const lift = o.lift ?? 1
    ctx.save()
    if (lift > 0) { ctx.shadowColor = 'rgba(0,0,0,0.22)'; ctx.shadowBlur = 14 * lift * u; ctx.shadowOffsetY = 6 * lift * u }
    ctx.fillStyle = fill; ctx.fill()
    ctx.restore()
  }
  return {
    material: 'flat',
    colors: [c.accent, c.accent2, mix(c.accent, c.card, 0.5), mix(c.accent2, c.card, 0.5), c.muted],
    rect(ctx, x, y, w, h, fill, o = {}) { ctx.beginPath(); E.roundRect(ctx, x, y, w, h, o.r ?? 14 * u); paint(ctx, fill, o) },
    circle(ctx, cx, cy, r, fill, o = {}) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); paint(ctx, fill, o) },
    poly(ctx, pts, fill, o = {}) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); paint(ctx, fill, o) },
    place(ctx, x, y, o = {}, fn) {
      const s = o.s ?? 1
      if (s <= 0.001) return
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s); fn(ctx); ctx.restore()
    },
    figure() { return false },
  }
}
