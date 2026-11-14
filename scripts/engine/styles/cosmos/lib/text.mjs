// 星图上的字：逐字淡入、略上浮，先垫一层深色柔影保证读得清，需要时再叠同色柔光（原风格的标注文字 label 的做法）。
// 字都先用 E.fit 排好，这里只管画。转场时上一场（s.t 大于 s.dur）的字在 0.15 秒内先淡出，不随画面放大。
import { clamp, ease } from '../../../core.mjs'
import { pal } from './space.mjs'
import { moon } from './bodies.mjs'

export const outFade = s => 1 - clamp((s.t - s.dur) / 0.15)

// f = { lines, size, lineH }；lines 的每一行是字符串，或分段 [[字, 颜色, 柔光色], …]。o: { p, color, glow, role, weight, alpha }
export function words(ctx, E, s, f, x, y, align = 'left', o = {}) {
  const p = o.p ?? 1, a = (o.alpha ?? 1) * outFade(s)
  if (p <= 0 || a <= 0) return
  const k = pal(E), col = o.color || k.text
  const lines = f.lines.map(l => (typeof l === 'string' ? [[l, col, o.glow]] : l.map(g => [g[0], g[1], g[2] ?? o.glow])))
  const total = lines.reduce((n, l) => n + l.reduce((m, g) => m + [...g[0]].length, 0), 0), front = p * (total + 3)
  ctx.save()
  ctx.font = E.font(o.role || 'body', o.weight || 500, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  // 第一遍：深色柔影；第二遍：只给带柔光色的分段加同色柔光
  for (const pass of [0, 1]) {
    let n = 0
    lines.forEach((segs, li) => {
      const lw = ctx.measureText(segs.map(g => g[0]).join('')).width, yy = y + li * f.lineH + f.lineH / 2
      const x0 = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x
      let pre = ''
      for (const [str, c, gl] of segs) {
        const len = [...str].length
        if (pass && !gl) { pre += str; n += len; continue }
        ctx.shadowColor = pass ? E.rgba(gl, 0.6) : 'rgba(1,2,8,0.9)'; ctx.shadowBlur = f.size * (pass ? 0.4 : 0.28); ctx.fillStyle = c
        if (p >= 1) { ctx.globalAlpha = a; ctx.fillText(str, x0 + ctx.measureText(pre).width, yy); pre += str; n += len; continue }
        for (const ch of str) {
          const ca = clamp((front - n) / 3)
          if (ca > 0) { ctx.globalAlpha = a * ca; ctx.fillText(ch, x0 + ctx.measureText(pre).width, yy + (1 - ease.out(ca)) * f.size * 0.25) }
          pre += ch; n++
        }
      }
    })
  }
  ctx.restore()
}

// 几段字用同一个字号（取各自能放下的最小字号）：一场里的条目字号不忽大忽小
export function fitSame(E, texts, opt) {
  const os = texts.map((_, i) => opt(i))
  const size = Math.min(...texts.map((t, i) => E.fit(t, { ...os[i], silent: true }).size))
  return texts.map((t, i) => E.fit(t, { ...os[i], size, minSize: os[i].size * 0.55 }))
}

// 场标题：左上角一行字带青色柔光，下面一段轨道线画出去，线头一颗小卫星。返回下面可用区域的 y
export function head(ctx, s, E, text) {
  const a = E.L.box, u = E.u, k = pal(E)
  if (!text) return a.y
  const f = E.fit(text, { role: 'title', weight: 700, size: E.pick(64, 62) * u, maxW: a.w, maxLines: 2, oneLine: true, lineGap: 1.18 })
  const p = s.p(0)
  words(ctx, E, s, f, a.x, a.y, 'left', { p, role: 'title', weight: 700, glow: k.cyan })
  const y = a.y + f.lines.length * f.lineH + 14 * u, q = ease.out(clamp(p * 1.25 - 0.15)), L = Math.min(f.width + 140 * u, a.w) * q
  if (q > 0) {
    ctx.save()
    const g = ctx.createLinearGradient(a.x, y, a.x + L, y)
    g.addColorStop(0, E.rgba(k.cyan, 0.8)); g.addColorStop(1, E.rgba(k.cyan, 0.08))
    ctx.strokeStyle = g; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(a.x + L, y); ctx.stroke()
    ctx.fillStyle = E.rgba(k.cyan, 0.6)
    for (let x = a.x; x <= a.x + L; x += 40 * u) ctx.fillRect(x - 0.75 * u, y - 5 * u, 1.5 * u, 10 * u)
    ctx.restore()
    moon(ctx, E, a.x + L, y, 5 * u, k.cyan)
  }
  return y + E.pick(38, 44) * u
}
