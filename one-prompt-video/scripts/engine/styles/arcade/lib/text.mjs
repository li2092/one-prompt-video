// 排字：所有来自 video.json 的字先过 E.fit 定字号和折行，再按大小选画法——
// 够大（≥15 格高）画成阈值化的中文像素字，否则画高清字 + 深色描边 + 一格硬阴影。点阵字库能写的数值画成点阵字。
import { PAL, cellOf, screenView, ctext, ctextImg, ptext, pwidth, hasGlyph } from './px.mjs'

export const pxOK = (E, f) => f.size / cellOf(E) >= 15

// 高清字：y 是第一行的上沿（px）
export function hiLines(ctx, E, f, x, y, col, o = {}) {
  const S = cellOf(E), lines = o.lines || f.lines, lw = Math.max(2, f.size * 0.16)
  ctx.save()
  ctx.font = E.font(o.role || 'body', o.weight || 800, f.size)
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  lines.forEach((ln, i) => {
    if (!ln) return
    const yy = Math.round(y + i * f.lineH + f.lineH / 2)
    if (o.shadow !== false) { const d = o.sd ?? S; ctx.fillStyle = ctx.strokeStyle = o.shadow || PAL.ink; ctx.lineWidth = lw; ctx.strokeText(ln, x + d, yy + d); ctx.fillText(ln, x + d, yy + d) }
    if (o.outline !== false) { ctx.strokeStyle = o.outline || PAL.ink; ctx.lineWidth = lw; ctx.strokeText(ln, x, yy) }
    ctx.fillStyle = col; ctx.fillText(ln, x, yy)
  })
  ctx.restore()
}
// 中文像素字：同一套折行，每行阈值化后按格放大
export function pxLines(ctx, E, f, x, y, col, o = {}) {
  const S = cellOf(E), V = screenView(E), h = Math.round(f.size / S), lines = o.lines || f.lines
  lines.forEach((ln, i) => ctext(ctx, V, E, ln, x / S, (y + i * f.lineH + f.lineH / 2) / S, h, col,
    { outline: o.outline === false ? null : o.outline || PAL.ink, shadow: o.shadow === false ? null : o.shadow || PAL.ink, sd: o.sd ?? 2, align: o.align || 'center', role: o.role || 'title', weight: o.weight || 900 }))
}
export const bigLines = (ctx, E, f, x, y, col, o = {}) => (pxOK(E, f) && o.pixel !== false ? pxLines : hiLines)(ctx, E, f, x, y, col, o)

// 一行里分几段颜色（高亮词）：segs = 每行 [[字, 色], …]；居中于 cx
export function segLines(ctx, E, f, cx, y, segs, o = {}) {
  const S = cellOf(E), px = pxOK(E, f), h = Math.round(f.size / S), V = screenView(E), oo = { role: 'title', weight: o.weight || 900 }
  ctx.save(); ctx.font = E.font('title', oo.weight, f.size)
  segs.forEach((line, i) => {
    const yy = y + i * f.lineH + f.lineH / 2
    const ws = line.map(([s]) => (px ? ctextImg(E, s, h, '#fff', oo).tw * S : ctx.measureText(s).width))
    let x = cx - ws.reduce((a, b) => a + b, 0) / 2
    line.forEach(([s, col], k) => {
      if (s) {
        if (px) ctext(ctx, V, E, s, x / S, yy / S, h, col, { ...oo, outline: PAL.ink, shadow: PAL.ink, sd: 2, align: 'left' })
        else hiLines(ctx, E, { size: f.size, lineH: f.lineH, lines: [s] }, x, yy - f.lineH / 2, col, { ...oo, outline: false, shadow: false })
      }
      x += ws[k]
    })
  })
  ctx.restore()
}
// 把折好的行切成高亮段：高亮词可能被折到两行，按它在整句里的位置逐行算
export function highlightSegs(lines, hl, fg, ac) {
  const joined = lines.join(''), hs = hl ? joined.indexOf(hl) : -1
  let off = 0
  return lines.map(line => {
    const a0 = Math.max(0, hs - off), a1 = Math.min(line.length, hs + hl.length - off)
    off += line.length
    if (hs < 0 || a1 <= a0) return [[line, fg]]
    return [[line.slice(0, a0), fg], [line.slice(a0, a1), ac], [line.slice(a1), fg]]
  })
}
// 逐字打出：前 n 个字（跨行）
export function reveal(lines, n) {
  let left = Math.max(0, Math.floor(n))
  return lines.map(l => { const ch = [...l], k = Math.min(ch.length, left); left -= k; return ch.slice(0, k).join('') })
}
export function revealSegs(segs, n) {
  let left = Math.max(0, Math.floor(n))
  return segs.map(line => line.map(([s, c]) => { const ch = [...s], k = Math.min(ch.length, left); left -= k; return [ch.slice(0, k).join(''), c] }))
}

// 数值：点阵字库能写的部分画成点阵字（unit 格一点），其余（中文单位、¥）画成同高的高清粗字。
// x 按 align 对齐，y 是竖直中心（px）。o.measure 只量不画。返回总宽（px）
export function valueText(ctx, E, s, x, y, unit, col, o = {}) {
  const S = cellOf(E), V = screenView(E), runs = []
  for (const ch of String(s)) { const px = hasGlyph(ch), last = runs[runs.length - 1]; if (last && last.px === px) last.t += ch; else runs.push({ t: ch, px }) }
  const hs = 7 * unit * S * 0.95
  ctx.save(); ctx.font = E.font('title', 900, hs); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  runs.forEach(r => { r.w = r.px ? pwidth(r.t, unit) * S : ctx.measureText(r.t).width + unit * S * 1.5 })
  const total = runs.reduce((a, r) => a + r.w, 0)
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x
  if (!o.measure) for (const r of runs) {
    if (r.px) ptext(ctx, V, r.t, cx / S, y / S, unit, col, { valign: 'middle', shadow: o.shadow, outline: o.outline, sd: o.sd })
    else {
      const xx = cx + unit * S * 0.75
      if (o.shadow) { ctx.fillStyle = ctx.strokeStyle = o.shadow; ctx.lineWidth = hs * 0.14; const d = (o.sd ?? unit) * S; ctx.strokeText(r.t, xx + d, y + d); ctx.fillText(r.t, xx + d, y + d) }
      if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = hs * 0.14; ctx.strokeText(r.t, xx, y) }
      ctx.fillStyle = col; ctx.fillText(r.t, xx, y)
    }
    cx += r.w
  }
  ctx.restore()
  return total
}
