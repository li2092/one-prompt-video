// 九种现成版式。每个版式拿到 (ctx, s, E)：
//   s = { scene, t 本场已过的秒数, dur 本场时长, p(i) 第 i 个元素的入场进度 0..1 }
//   E = { W, H, u 缩放单位, portrait, safe 安全边距, theme, font(), fit(), enter(), T 全片时刻 }
// 版式只摆位置，颜色、线条、卡片、入场方式都问主题要。
import { clamp, ease, rgba, drawLines, formatNumber, decimalsOf, roundRect } from './core.mjs'

// 每种版式有几个要依次入场的元素（时间线据此排入场时刻和音效）
export const COUNT = {
  title: s => 1 + (s.subtitle ? 1 : 0) + (s.kicker ? 1 : 0),
  statement: () => 1,
  bullets: s => 1 + s.items.length,
  number: s => 1 + (s.label ? 1 : 0) + (s.note ? 1 : 0),
  bars: s => 1 + s.items.length,
  steps: s => 1 + s.items.length,
  compare: s => 1 + 2,
  quote: s => 1 + (s.by ? 1 : 0),
  end: s => 1 + (s.subtitle ? 1 : 0) + (s.cta ? 1 : 0),
  custom: s => s.cues ?? 1,
}

// 每种版式里画面上会出现的字（用来估这一场要停多久）
export function visibleText(s) {
  const arr = [s.title, s.subtitle, s.kicker, s.text, s.by, s.label, s.note, s.cta, s.unit, s.value]
  for (const it of s.items || []) arr.push(typeof it === 'string' ? it : [it.label, it.text].filter(Boolean).join(' '))
  for (const side of [s.left, s.right]) if (side) arr.push(side.title, ...(side.items || []))
  return arr.filter(Boolean).join(' ')
}

const content = E => ({ x: E.safe.l, y: E.safe.t, w: E.W - E.safe.l - E.safe.r, h: E.H - E.safe.t - E.safe.b })

// 场标题：左上角一行，带主题的下划线。返回标题下面可用区域的 y
function heading(ctx, s, E, text) {
  const { u, theme } = E, a = content(E)
  if (!text) return a.y
  const size = (E.portrait ? 72 : 68) * u
  const f = E.fit(text, { role: 'title', weight: theme.wTitle, size, maxW: a.w, maxLines: 2, oneLine: true })
  const p = s.p(0)
  E.enter(ctx, p, a.x, a.y, () => { ctx.fillStyle = theme.c.fg; ctx.font = E.font('title', theme.wTitle, f.size); drawLines(ctx, f.lines, a.x, a.y, f.lineH, 'left') })
  const yb = a.y + f.lines.length * f.lineH + 14 * u
  theme.underline(ctx, E, a.x, yb, Math.min(f.width, a.w), ease.out(clamp(p * 1.2 - 0.2)))
  return yb + 40 * u
}

// 把 "1,280"、"80%"、"¥3.5 万" 拆成 前缀 / 数 / 后缀，好让数字滚动上去
function splitNumber(v) {
  const m = /^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/.exec(String(v).trim())
  if (!m) return null
  return { pre: m[1], num: Number(m[2].replace(/,/g, '')), dec: decimalsOf(m[2]), comma: m[2].includes(','), post: m[3] }
}
function rolling(v, p) {
  const n = splitNumber(v)
  if (!n) return String(v)
  const cur = n.num * ease.out(clamp(p))
  const body = n.comma ? formatNumber(cur, n.dec) : cur.toFixed(n.dec)
  return n.pre + body + n.post
}

export const LAYOUTS = {
  // 片头：大标题居中
  title(ctx, s, E) {
    const { W, u, theme } = E, a = content(E), sc = s.scene
    const big = E.fit(sc.title, { role: 'title', weight: theme.wTitle, size: (E.portrait ? 132 : 156) * u, maxW: a.w * 0.92, maxLines: 3, lineGap: 1.18, oneLine: [...sc.title].length <= 9 })
    const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: theme.wBody, size: 54 * u, maxW: a.w * 0.8, maxLines: 2 }) : null
    const kick = sc.kicker ? E.fit(sc.kicker, { role: 'body', weight: 600, size: 42 * u, maxW: a.w * 0.8, maxLines: 1 }) : null
    const hBig = big.lines.length * big.lineH, hSub = sub ? sub.lines.length * sub.lineH + 34 * u : 0, hKick = kick ? kick.lineH + 26 * u : 0
    let y = a.y + (a.h - hBig - hSub - hKick) / 2
    let i = 0
    if (kick) { const p = s.p(i++); E.enter(ctx, p, W / 2, y, () => { ctx.fillStyle = theme.c.accent; ctx.font = E.font('body', 600, kick.size); drawLines(ctx, kick.lines, W / 2, y, kick.lineH, 'center') }); y += hKick }
    const p0 = s.p(i++)
    E.enter(ctx, p0, W / 2, y + hBig / 2, () => { ctx.fillStyle = theme.c.fg; ctx.font = E.font('title', theme.wTitle, big.size); drawLines(ctx, big.lines, W / 2, y, big.lineH, 'center') })
    y += hBig + 8 * u
    theme.underline(ctx, E, W / 2 - big.width / 2, y, big.width, ease.out(clamp(p0 * 1.3 - 0.3)))
    if (sub) { const p = s.p(i++); y += 26 * u; E.enter(ctx, p, W / 2, y, () => { ctx.fillStyle = theme.c.muted; ctx.font = E.font('body', theme.wBody, sub.size); drawLines(ctx, sub.lines, W / 2, y, sub.lineH, 'center') }) }
  },

  // 一句大字，可以给其中一个词上色
  statement(ctx, s, E) {
    const { W, u, theme } = E, a = content(E), sc = s.scene
    const f = E.fit(sc.text, { role: 'title', weight: theme.wTitle, size: (E.portrait ? 112 : 124) * u, maxW: a.w * 0.9, maxLines: E.portrait ? 6 : 4, lineGap: 1.3 })
    const y0 = a.y + (a.h - f.lines.length * f.lineH) / 2, p = s.p(0)
    ctx.font = E.font('title', theme.wTitle, f.size)
    E.enter(ctx, p, W / 2, y0 + f.lines.length * f.lineH / 2, () => {
      // 高亮词可能被折到两行：按它在整句里的位置，逐行算出要上色的那一截
      const joined = f.lines.join(''), hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? joined.indexOf(hl) : -1
      const q = ease.out(clamp(p * 1.6 - 0.6))
      let off = 0
      f.lines.forEach((line, k) => {
        const y = y0 + k * f.lineH + f.lineH / 2, lw = ctx.measureText(line).width, x0 = W / 2 - lw / 2
        const a0 = Math.max(0, hs - off), a1 = Math.min(line.length, hs + hl.length - off)
        off += line.length
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        if (hs < 0 || a1 <= a0) { ctx.fillStyle = theme.c.fg; ctx.fillText(line, x0, y); return }
        const pre = line.slice(0, a0), mid = line.slice(a0, a1), wPre = ctx.measureText(pre).width, wMid = ctx.measureText(mid).width
        ctx.fillStyle = theme.c.fg; ctx.fillText(pre, x0, y)
        ctx.fillStyle = rgba(theme.c.accent, 0.16); ctx.fillRect(x0 + wPre - 6 * u, y + f.size * 0.18, (wMid + 12 * u) * q, f.size * 0.36)
        ctx.fillStyle = theme.c.accent; ctx.fillText(mid, x0 + wPre, y)
        ctx.fillStyle = theme.c.fg; ctx.fillText(line.slice(a1), x0 + wPre + wMid, y)
      })
    })
  },

  // 标题加几条要点，一条一条出来
  bullets(ctx, s, E) {
    const { u, theme } = E, a = content(E), sc = s.scene
    const top = heading(ctx, s, E, sc.title), n = sc.items.length
    const avail = a.y + a.h - top, rowH = Math.min(avail / n, (E.portrait ? 210 : 170) * u), size = Math.min((E.portrait ? 60 : 58) * u, rowH * 0.42)
    const y0 = top + (avail - rowH * n) / 2, r = size * 0.42, tx = a.x + r * 2 + 34 * u
    sc.items.forEach((it, i) => {
      const p = s.p(i + 1), cy = y0 + rowH * i + rowH / 2
      const f = E.fit(it, { role: 'body', weight: theme.wBody, size, maxW: a.x + a.w - tx, maxLines: 2, maxH: rowH * 0.92 })
      E.enter(ctx, p, a.x, cy, () => {
        theme.mark(ctx, E, a.x + r, cy, r, i)
        ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', theme.wBody, f.size)
        drawLines(ctx, f.lines, tx, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
      })
    })
  },

  // 一个大数字：数从 0 滚到目标值
  number(ctx, s, E) {
    const { W, u, theme } = E, a = content(E), sc = s.scene
    const p0 = s.p(0), txt = String(sc.value) + (sc.unit ? '' : '')
    const size = (E.portrait ? 300 : 340) * u
    const f = E.fit(txt, { role: 'num', weight: 800, size, maxW: a.w * (sc.unit ? 0.62 : 0.9), maxLines: 1, lineGap: 1.05, minSize: size * 0.3 })
    const unitSize = f.size * 0.3
    ctx.font = E.font('body', 700, unitSize); const wUnit = sc.unit ? ctx.measureText(sc.unit).width + 20 * u : 0
    const lab = sc.label ? E.fit(sc.label, { role: 'body', weight: theme.wBody, size: 62 * u, maxW: a.w * 0.86, maxLines: 2 }) : null
    const note = sc.note ? E.fit(sc.note, { role: 'body', weight: 400, size: 40 * u, maxW: a.w * 0.8, maxLines: 2 }) : null
    const hNum = f.lineH, hLab = lab ? lab.lines.length * lab.lineH + 30 * u : 0, hNote = note ? note.lines.length * note.lineH + 18 * u : 0
    let y = a.y + (a.h - hNum - hLab - hNote) / 2
    const shown = rolling(sc.value, clamp((s.t - s.cue(0)) / Math.min(1.4, s.dur * 0.35)))
    ctx.font = E.font('num', 800, f.size); const wNum = ctx.measureText(String(sc.value)).width, x0 = W / 2 - (wNum + wUnit) / 2
    E.enter(ctx, p0, W / 2, y + hNum / 2, () => {
      ctx.fillStyle = theme.c.accent; ctx.font = E.font('num', 800, f.size); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(shown, x0 + wNum, y + hNum / 2)
      if (sc.unit) { ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', 700, unitSize); ctx.textAlign = 'left'; ctx.fillText(sc.unit, x0 + wNum + 20 * u, y + hNum / 2 + f.size * 0.2) }
    })
    y += hNum
    let i = 1
    if (lab) { const p = s.p(i++); y += 30 * u; E.enter(ctx, p, W / 2, y, () => { ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', theme.wBody, lab.size); drawLines(ctx, lab.lines, W / 2, y, lab.lineH, 'center') }); y += lab.lines.length * lab.lineH }
    if (note) { const p = s.p(i++); y += 18 * u; E.enter(ctx, p, W / 2, y, () => { ctx.fillStyle = theme.c.muted; ctx.font = E.font('body', 400, note.size); drawLines(ctx, note.lines, W / 2, y, note.lineH, 'center') }) }
  },

  // 柱状图：横屏竖着长，竖屏横着长；最大的一根（或 highlight 指定的）用强调色
  bars(ctx, s, E) {
    const { u, theme } = E, a = content(E), sc = s.scene, n = sc.items.length
    const top = heading(ctx, s, E, sc.title)
    const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
    const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
    const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
    const colOf = i => (i === hi ? theme.c.accent : theme.c.muted)
    if (!E.portrait) {
      const labH = 104 * u, valH = 84 * u, x0 = a.x, y0 = top + valH, hMax = a.y + a.h - labH - y0, slot = a.w / n, bw = Math.min(slot * 0.56, 220 * u)
      theme.line(ctx, E, x0, y0 + hMax, x0 + a.w, y0 + hMax, { p: ease.out(s.p(0)), color: theme.c.muted, width: 3, ticks: false, seed: 21 })
      sc.items.forEach((it, i) => {
        const p = ease.out(s.p(i + 1)), h = hMax * (vals[i] / max) * p, x = x0 + slot * i + (slot - bw) / 2
        if (p > 0) theme.bar(ctx, E, x, y0 + hMax - h, bw, h, { color: colOf(i), seed: i + 1 })
        const lf = E.fit(it.label, { role: 'body', weight: theme.wBody, size: 42 * u, maxW: slot * 0.94, maxLines: 2, maxH: labH })
        ctx.globalAlpha = clamp(s.p(i + 1) * 2); ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', theme.wBody, lf.size); drawLines(ctx, lf.lines, x + bw / 2, y0 + hMax + 14 * u, lf.lineH, 'center')
        ctx.fillStyle = i === hi ? theme.c.accent : theme.c.fg; ctx.font = E.font('num', 700, 58 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
        ctx.fillText(formatNumber(vals[i] * p, dec) + unit, x + bw / 2, y0 + hMax - h - 16 * u); ctx.globalAlpha = 1
      })
    } else {
      const avail = a.y + a.h - top, rowH = Math.min(avail / n, 220 * u), y0 = top + (avail - rowH * n) / 2, valW = 210 * u, wMax = a.w - valW
      sc.items.forEach((it, i) => {
        const p = ease.out(s.p(i + 1)), y = y0 + rowH * i, bh = rowH * 0.34, w = wMax * (vals[i] / max) * p
        const lf = E.fit(it.label, { role: 'body', weight: theme.wBody, size: 40 * u, maxW: a.w, maxLines: 1 })
        ctx.globalAlpha = clamp(s.p(i + 1) * 2); ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', theme.wBody, lf.size); drawLines(ctx, lf.lines, a.x, y + rowH * 0.08, lf.lineH, 'left'); ctx.globalAlpha = 1
        if (p > 0) theme.bar(ctx, E, a.x, y + rowH * 0.52, w, bh, { color: colOf(i), seed: i + 1 })
        ctx.globalAlpha = clamp(s.p(i + 1) * 2); ctx.fillStyle = i === hi ? theme.c.accent : theme.c.fg; ctx.font = E.font('num', 700, 48 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(formatNumber(vals[i] * p, dec) + unit, a.x + w + 20 * u, y + rowH * 0.52 + bh / 2); ctx.globalAlpha = 1
      })
    }
  },

  // 流程：几步依次出现，中间有箭头
  steps(ctx, s, E) {
    const { u, theme } = E, a = content(E), sc = s.scene, n = sc.items.length
    const top = heading(ctx, s, E, sc.title), avail = a.y + a.h - top
    const arrow = (x1, y1, x2, y2, p) => {
      theme.line(ctx, E, x1, y1, x2, y2, { p, color: theme.c.muted, width: 4, ticks: false, seed: 31 })
      if (p >= 1) { const ang = Math.atan2(y2 - y1, x2 - x1), k = 16 * u; ctx.save(); ctx.fillStyle = theme.c.muted; ctx.beginPath(); ctx.moveTo(x2 + Math.cos(ang) * k * 0.6, y2 + Math.sin(ang) * k * 0.6); ctx.lineTo(x2 - Math.cos(ang - 0.5) * k, y2 - Math.sin(ang - 0.5) * k); ctx.lineTo(x2 - Math.cos(ang + 0.5) * k, y2 - Math.sin(ang + 0.5) * k); ctx.closePath(); ctx.fill(); ctx.restore() }
    }
    const badge = (cx, cy, r, i) => {
      theme.mark(ctx, E, cx, cy, r, i, { badge: true })
      ctx.fillStyle = theme.markHollow ? theme.c.fg : theme.c.onAccent; ctx.font = E.font('num', 800, r * 1.05); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), cx, cy + r * 0.04)
    }
    if (!E.portrait) {
      const gap = 70 * u, cw = (a.w - gap * (n - 1)) / n, ch = Math.min(avail * 0.86, 470 * u), y = top + (avail - ch) / 2
      sc.items.forEach((it, i) => {
        const p = s.p(i + 1), x = a.x + (cw + gap) * i, r = 46 * u
        if (i > 0) arrow(x - gap + 12 * u, y + ch / 2, x - 14 * u, y + ch / 2, ease.out(clamp(p * 2)))
        E.enter(ctx, p, x + cw / 2, y + ch / 2, () => {
          theme.card(ctx, E, x, y, cw, ch, { p: ease.out(p), seed: i + 1 })
          badge(x + cw / 2, y + 30 * u + r, r, i)
          const f = E.fit(it, { role: 'body', weight: theme.wBody, size: 52 * u, maxW: cw - 44 * u, maxLines: 4, maxH: ch - r * 2 - 80 * u })
          ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', theme.wBody, f.size)
          const ty = y + r * 2 + 50 * u, th = ch - r * 2 - 70 * u
          drawLines(ctx, f.lines, x + cw / 2, ty + (th - f.lines.length * f.lineH) / 2, f.lineH, 'center')
        })
      })
    } else {
      const gap = 46 * u, ch = Math.min((avail - gap * (n - 1)) / n, 230 * u), y0 = top + (avail - ch * n - gap * (n - 1)) / 2
      sc.items.forEach((it, i) => {
        const p = s.p(i + 1), y = y0 + (ch + gap) * i, r = 40 * u
        if (i > 0) arrow(a.x + a.w / 2, y - gap + 8 * u, a.x + a.w / 2, y - 12 * u, ease.out(clamp(p * 2)))
        E.enter(ctx, p, a.x + a.w / 2, y + ch / 2, () => {
          theme.card(ctx, E, a.x, y, a.w, ch, { p: ease.out(p), seed: i + 1 })
          badge(a.x + 40 * u + r, y + ch / 2, r, i)
          const tx = a.x + r * 2 + 80 * u, f = E.fit(it, { role: 'body', weight: theme.wBody, size: 46 * u, maxW: a.x + a.w - tx - 30 * u, maxLines: 3, maxH: ch * 0.86 })
          ctx.fillStyle = theme.c.fg; ctx.font = E.font('body', theme.wBody, f.size); drawLines(ctx, f.lines, tx, y + (ch - f.lines.length * f.lineH) / 2, f.lineH, 'left')
        })
      })
    }
  },

  // 左右对比：两张卡片，右边那张默认是强调色
  compare(ctx, s, E) {
    const { u, theme } = E, a = content(E), sc = s.scene
    const top = heading(ctx, s, E, sc.title), avail = a.y + a.h - top, gap = 50 * u
    const boxes = E.portrait
      ? [[a.x, top, a.w, (avail - gap) / 2], [a.x, top + (avail + gap) / 2, a.w, (avail - gap) / 2]]
      : [[a.x, top, (a.w - gap) / 2, avail], [a.x + (a.w + gap) / 2, top, (a.w - gap) / 2, avail]]
    ;[sc.left, sc.right].forEach((side, i) => {
      const [x, y, w, h] = boxes[i], p = s.p(i + 1), pad = 44 * u, strong = i === 1
      E.enter(ctx, p, x + w / 2, y + h / 2, () => {
        theme.card(ctx, E, x, y, w, h, { tone: strong ? 'accent' : 'plain', p: ease.out(p), seed: i + 3 })
        const onFill = strong && theme.solidAccent
        const tf = E.fit(side.title, { role: 'title', weight: theme.wTitle, size: 60 * u, maxW: w - pad * 2, maxLines: 2 })
        ctx.fillStyle = onFill ? theme.c.onAccent : strong ? theme.c.accent : theme.c.fg; ctx.font = E.font('title', theme.wTitle, tf.size); drawLines(ctx, tf.lines, x + pad, y + pad, tf.lineH, 'left')
        const items = side.items || [], ty = y + pad + tf.lines.length * tf.lineH + 26 * u, rowH = Math.min((y + h - pad - ty) / Math.max(1, items.length), 150 * u)
        items.forEach((it, k) => {
          const f = E.fit(it, { role: 'body', weight: theme.wBody, size: Math.min(50 * u, rowH * 0.42), maxW: w - pad * 2 - 40 * u, maxLines: 2, maxH: rowH * 0.94 })
          const cy = ty + rowH * k + rowH / 2
          ctx.fillStyle = onFill ? rgba(theme.c.onAccent, 0.9) : theme.c.muted; ctx.beginPath(); ctx.arc(x + pad + 9 * u, cy, 7 * u, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = onFill ? theme.c.onAccent : theme.c.fg; ctx.font = E.font('body', theme.wBody, f.size); drawLines(ctx, f.lines, x + pad + 40 * u, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
        })
      })
    })
  },

  // 引语
  quote(ctx, s, E) {
    const { W, u, theme } = E, a = content(E), sc = s.scene
    const f = E.fit(sc.text, { role: 'title', weight: Math.min(theme.wTitle, 600), size: (E.portrait ? 76 : 80) * u, maxW: a.w * 0.82, maxLines: E.portrait ? 8 : 5, lineGap: 1.42 })
    const by = sc.by ? E.fit('— ' + sc.by, { role: 'body', weight: theme.wBody, size: 40 * u, maxW: a.w * 0.8, maxLines: 1 }) : null
    const hT = f.lines.length * f.lineH, hBy = by ? by.lineH + 40 * u : 0, y0 = a.y + (a.h - hT - hBy) / 2, p = s.p(0)
    ctx.save(); ctx.globalAlpha = 0.9 * ease.out(p); ctx.fillStyle = theme.c.accent; ctx.font = E.font('title', 900, 260 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
    ctx.fillText('“', W / 2 - a.w * 0.41 - 30 * u, y0 + 120 * u); ctx.restore()
    E.enter(ctx, p, W / 2, y0 + hT / 2, () => { ctx.fillStyle = theme.c.fg; ctx.font = E.font('title', Math.min(theme.wTitle, 600), f.size); drawLines(ctx, f.lines, W / 2, y0, f.lineH, 'center') })
    if (by) { const q = s.p(1); E.enter(ctx, q, W / 2, y0 + hT + 40 * u, () => { ctx.fillStyle = theme.c.muted; ctx.font = E.font('body', theme.wBody, by.size); drawLines(ctx, by.lines, W / 2, y0 + hT + 40 * u, by.lineH, 'center') }) }
  },

  // 片尾：一句收束的话，可以带一行行动号召
  end(ctx, s, E) {
    const { W, u, theme } = E, a = content(E), sc = s.scene
    const big = E.fit(sc.title, { role: 'title', weight: theme.wTitle, size: (E.portrait ? 112 : 128) * u, maxW: a.w * 0.9, maxLines: 3, lineGap: 1.22, oneLine: [...sc.title].length <= 9 })
    const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: theme.wBody, size: 52 * u, maxW: a.w * 0.8, maxLines: 2 }) : null
    const cta = sc.cta ? E.fit(sc.cta, { role: 'body', weight: 700, size: 46 * u, maxW: a.w * 0.7, maxLines: 1 }) : null
    const hBig = big.lines.length * big.lineH, hSub = sub ? sub.lines.length * sub.lineH + 30 * u : 0, hCta = cta ? 110 * u + 50 * u : 0
    let y = a.y + (a.h - hBig - hSub - hCta) / 2, i = 0
    const p0 = s.p(i++)
    E.enter(ctx, p0, W / 2, y + hBig / 2, () => { ctx.fillStyle = theme.c.fg; ctx.font = E.font('title', theme.wTitle, big.size); drawLines(ctx, big.lines, W / 2, y, big.lineH, 'center') })
    y += hBig
    if (sub) { const p = s.p(i++); y += 30 * u; E.enter(ctx, p, W / 2, y, () => { ctx.fillStyle = theme.c.muted; ctx.font = E.font('body', theme.wBody, sub.size); drawLines(ctx, sub.lines, W / 2, y, sub.lineH, 'center') }); y += sub.lines.length * sub.lineH }
    if (cta) {
      const p = s.p(i++); y += 50 * u
      ctx.font = E.font('body', 700, cta.size); const w = ctx.measureText(cta.lines[0]).width + 120 * u, h = 110 * u
      E.enter(ctx, p, W / 2, y + h / 2, () => {
        theme.card(ctx, E, W / 2 - w / 2, y, w, h, { tone: 'accent', p: ease.out(p), seed: 8 })
        const onFill = theme.solidAccent
        ctx.fillStyle = onFill ? theme.c.onAccent : theme.c.accent; ctx.font = E.font('body', 700, cta.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cta.lines[0], W / 2, y + h / 2)
      })
    }
  },
}

export const LAYOUT_IDS = Object.keys(LAYOUTS)

// 底部字幕：一场的 say 按标点切成几段，按字数分配时间，一次显示一段
export function captionChunks(text, maxChars) {
  const parts = String(text).split(/(?<=[。！？!?；;])|(?<=[，,、：:])(?=.{6,})/u).map(x => x.trim()).filter(Boolean)
  const out = []
  let cur = ''
  for (const part of parts) {
    if (cur && [...(cur + part)].length > maxChars) { out.push(cur); cur = part } else cur += part
  }
  if (cur) out.push(cur)
  return out
}

export function drawCaption(ctx, s, E) {
  const say = s.scene.say
  if (!say) return
  const { W, H, u, theme } = E
  const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(c => [...c].length), total = lens.reduce((x, y) => x + y, 0)
  const span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  const a = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
  const size = (E.portrait ? 46 : 44) * u, maxW = W - E.safe.l * 2
  const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 500, size, maxW, maxLines: 2, quiet: true })
  const h = f.lines.length * f.lineH, cy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0), y = cy - h / 2
  ctx.save(); ctx.globalAlpha = a
  const padX = 34 * u, padY = 14 * u, w = f.width + padX * 2
  ctx.fillStyle = rgba(theme.c.fg, 0.86); roundRect(ctx, W / 2 - w / 2, y - padY, w, h + padY * 2, 14 * u); ctx.fill()
  ctx.fillStyle = theme.c.bg; ctx.font = E.font('body', 500, f.size); drawLines(ctx, f.lines, W / 2, y, f.lineH, 'center')
  ctx.restore()
}
