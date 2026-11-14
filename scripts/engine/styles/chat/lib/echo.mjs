// 放大关键词：横屏放在手机两侧（原样片的两侧关键词），竖屏放在输入栏下面的关键词区（气泡形底板加左下小尾巴）。
// 都是手机里已经有的字再放大一遍，被平台界面盖住也不丢信息。
// spec = { L: [条目], R: [条目], K: 条目 }；条目 = { text, q, size, color, w, lines, seq: [{ text, q }], dots, pill, kc }
//   seq：只放大最新出来的那一项；dots：下面一排进度点；pill：画成强调色按钮；kc：竖屏底板上的字色
import { clamp, drawLines } from '../../../core.mjs'
import { rr, backE, outE } from './ui.mjs'
import { geo } from './phone.mjs'

function resolve(e) {
  if (!e || !e.seq) return e && e.text ? e : null
  let j = -1
  e.seq.forEach((it, i) => { if (it.q > 0) j = i })
  return j < 0 ? null : { ...e, ...e.seq[j], j, n: e.seq.length }
}

export function echo(ctx, s, E, C, spec) {
  const G = geo(E), u = E.u
  if (G.sides) {
    for (const z of ['L', 'R']) {
      const list = (spec[z] || []).map(resolve).filter(Boolean)
      if (!list.length) continue
      const zx = G.sides[z]
      const rows = list.map(e => {
        const f = E.fit(e.text, { role: 'title', weight: e.w || 900, size: e.size * u, maxW: G.sides.w - (e.pill ? 80 * u : 0), maxLines: e.lines || 2, lineGap: 1.18, minSize: e.size * u * 0.4, quiet: true })
        return { e, f, h: f.lines.length * f.lineH + (e.pill ? 44 * u : 0) + (e.dots ? 56 * u : 0) }
      })
      const gap = 30 * u, total = rows.reduce((a, r) => a + r.h, 0) + gap * (rows.length - 1)
      let y = G.cy - total / 2
      for (const { e, f, h } of rows) {
        const q = e.q, k = 0.85 + 0.15 * backE(q), my = y + h / 2
        if (q > 0) {
          ctx.save(); ctx.globalAlpha *= Math.min(1, q * 2); ctx.translate(zx, my); ctx.scale(k, k); ctx.translate(-zx, -my)
          const th = f.lines.length * f.lineH
          if (e.pill) { ctx.fillStyle = C.accent; rr(ctx, zx - f.width / 2 - 40 * u, y, f.width + 80 * u, th + 44 * u, (th + 44 * u) / 2); ctx.fill() }
          ctx.fillStyle = e.pill ? C.onAccent : e.color || C.side; ctx.font = E.font('title', e.w || 900, f.size)
          drawLines(ctx, f.lines, zx, y + (e.pill ? 22 * u : 0), f.lineH, 'center')
          if (e.dots) for (let i = 0; i < e.n; i++) {
            const on = i <= e.j
            ctx.fillStyle = on ? C.accL : E.rgba(C.side, 0.18); ctx.beginPath(); ctx.arc(zx + (i - (e.n - 1) / 2) * 40 * u, y + th + 34 * u, (on ? 11 : 9) * u, 0, 7); ctx.fill()
          }
          ctx.restore()
        }
        y += h + gap
      }
    }
    return
  }
  const e = resolve(spec.K)
  if (!G.kw || !e) return
  const s0 = E.W / 1080, { sc, kw } = G, q = e.q
  const f = E.fit(e.text, { role: 'title', weight: 900, size: 84 * s0, maxW: sc.w - 260 * s0, maxLines: 2, lineGap: 1.12, minSize: 84 * s0 * 0.4, quiet: true })
  const th = f.lines.length * f.lineH, pw = f.width + 96 * s0, phh = th + 52 * s0, cx = sc.x + sc.w / 2, cy = kw.y + kw.h / 2 - 14 * s0
  const k = 0.8 + 0.2 * backE(q)
  ctx.save(); ctx.globalAlpha *= clamp(q * 2.5); ctx.translate(cx, cy); ctx.scale(k, k)
  ctx.shadowColor = 'rgba(40,30,20,0.12)'; ctx.shadowBlur = 16 * s0; ctx.shadowOffsetY = 4 * s0
  ctx.fillStyle = e.pill ? C.accent : C.card
  rr(ctx, -pw / 2, -phh / 2, pw, phh, Math.min(44 * s0, phh / 2)); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-pw / 2 + 50 * s0, phh / 2 - 2 * s0); ctx.lineTo(-pw / 2 + 30 * s0, phh / 2 + 26 * s0); ctx.lineTo(-pw / 2 + 92 * s0, phh / 2 - 2 * s0); ctx.closePath(); ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = e.pill ? C.onAccent : e.kc || C.ink; ctx.font = E.font('title', 900, f.size)
  drawLines(ctx, f.lines, 0, -th / 2 + (1 - outE(q)) * 8 * s0, f.lineH, 'center')
  ctx.restore()
}
