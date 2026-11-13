// 风格包：调查线索板。全片是一整块软木板，一场是板上的一块区域：索引卡、拍立得、便签、撕下的纸条用图钉钉上去，
// 红线把它们连起来，红色记号笔圈出重点；场与场之间镜头顺着红线平移到板上的下一块区域，中间略微拉远再推近。
// 移植自风格库的 X-调查线索板（画法库在 lib/board.mjs 和 lib/items.mjs）。
import { drawLines, formatNumber, decimalsOf, clamp, mix, rgba, textUnits } from '../../core.mjs'
import { rolling, captionChunks } from '../../layouts.mjs'
import { pal, corkRect, origin, drift, links, pan, lamp, put, pinPos, pin, pins, pull, stroke, ring, scrawl, check, neq, hand, handLines } from './lib/board.mjs'
import { card, graph, note, slip, tape, polaroid, ICONS, folder, felt, FELT_GAP, tag } from './lib/items.mjs'

const TAU = Math.PI * 2
// 第 i 个元素入场以后过了多久（秒）；d 再往后推（负数是提前）
const at = (s, i, d = 0) => s.t - s.cue(i) - d
// 手写一段字要多久：字越多写得越久，最多 1.4 秒
const writeP = (d, text, d0 = 0.15) => clamp((d - d0) / Math.min(1.4, 0.05 * [...String(text)].length + 0.3))
const ROLL = s => Math.min(1.4, s.dur * 0.35)
const NOTES = k => [k.note, k.pink, k.blue]
// 短标题宁可略缩也放一行；要缩到八成以下才放得下一行时改成折行（引擎的 oneLine 会一路缩到七成以下）
function fitTitle(E, text, o) {
  const one = E.fit(text, { ...o, maxLines: 1, silent: true })
  return one.size >= o.size * 0.8 && !one.overflow ? E.fit(text, { ...o, maxLines: 1 }) : E.fit(text, o)
}
// 几段字用同一个字号（取各自能放下的最小字号），一组便签里字不忽大忽小；one 为真时每段先试放一行
function fitAll(E, texts, o, one = false) {
  if (!texts.length) return []
  const fit = (t, oo) => (one ? fitTitle(E, t, oo) : E.fit(t, oo))
  const size = Math.min(...texts.map(t => fit(t, o).size))
  return texts.map(t => fit(t, { ...o, size }))
}
// 这一场里镜头轻震的时刻：数字被红笔圈好、片尾按钮钉上
function shakes(s) {
  if (s.layout === 'number') return [s.cue(0) + ROLL(s) + 0.5]
  if (s.layout === 'end' && s.scene.cta) return [s.cue(1 + (s.scene.subtitle ? 1 : 0)) + 0.3]
  return []
}
const cam = (ctx, E, s) => { const [x, y] = drift(E, s, shakes(s)); ctx.translate(x, y) }

// 场标题：一张横条索引卡，左上角一枚红钉。返回 { y: 卡片下面能用的 y, pin: 钉子位置 }
function heading(ctx, s, E, k, text, P) {
  const B = E.L.box, u = E.u
  if (!text) return { y: B.y, pin: null }
  const padX = 40 * u, padY = 22 * u
  const f = fitTitle(E, text, { role: 'title', weight: 700, size: E.pick(58, 54) * u, maxW: B.w * E.pick(0.7, 0.88) - padX * 2 - 30 * u, maxLines: 2 })
  const w = f.width + padX * 2 + 30 * u, h = f.lines.length * f.lineH + padY * 2 + 8 * u
  const o = { x: B.x + w / 2, y: B.y + h / 2, w, h, rot: -0.012, pin: k.red, pinAt: [-w / 2 + 26 * u, -h / 2 + 22 * u], pins: P }
  put(ctx, E, at(s, 0), o, (c, lift) => {
    card(c, E, k, w, h, lift, { red: h / 2 - 12 * u })
    c.font = E.font('title', 700, f.size); c.fillStyle = k.ink
    drawLines(c, f.lines, -w / 2 + padX + 30 * u, -h / 2 + padY, f.lineH, 'left')
  })
  return { y: B.y + h + E.pick(36, 44) * u, pin: pinPos(E, o) }
}
// 手画的柱子：浅色底、斜线排线、歪歪的轮廓
function hatchBar(c, E, x, y, w, h, col, seed) {
  if (w < 1 || h < 1) return
  const u = E.u
  c.save(); c.fillStyle = rgba(col, 0.14); c.fillRect(x, y, w, h)
  c.beginPath(); c.rect(x, y, w, h); c.clip()
  c.strokeStyle = rgba(col, 0.72); c.lineWidth = 3.5 * u; c.beginPath()
  for (let t = -h; t < w; t += 15 * u) { c.moveTo(x + t, y + h); c.lineTo(x + t + h, y) }
  c.stroke(); c.restore()
  const j = q => E.noise1(q, seed) * 2.5 * u
  stroke(c, E, [[x + j(1), y + h], [x + j(2), y + j(3)], [x + w + j(4), y + j(5)], [x + w + j(6), y + h]], 1, { color: col, w: 4.5 })
}

export default {
  name: '调查线索板', mood: '软木板、拍立得、红线连线，复盘、排查、讲「为什么会这样」', bpm: 96,
  c: { bg: '#5f4329', fg: '#211912', muted: '#7d7468', accent: '#b8141d', accent2: '#f1d158', card: '#efe6cf', line: '#3c64a5', onAccent: '#fbf3e6' },
  fontTitle: 'serif', fontBody: 'hand', fontNum: 'sans', wTitle: 700, wBody: 600, radius: 0,
  motion: 'pop', solidAccent: true,

  // 软木底按这一场在板上的位置铺；右上角一枚红钉，红线连向上一场和下一场
  bg(ctx, E, s) {
    const [dx, dy] = drift(E, s, shakes(s)), [ox, oy] = origin(E, s.index)
    ctx.fillStyle = this.c.bg; ctx.fillRect(0, 0, E.W, E.H)
    corkRect(ctx, E, 0, 0, E.W, E.H, Math.round(ox - dx), Math.round(oy - dy))
    ctx.translate(dx, dy)
    links(ctx, E, s, this.c)
  },

  layouts: {
    // 片头：档案卡钉在板子正中，衬线大标题、卡头红线，副标题手写在横格上；kicker 是一张撕下的白纸条，红笔写；
    // 卡片后面先钉了两张拍立得，红线从卡片的钉子拉过去
    title(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W, por = E.portrait, P = []
      cam(ctx, E, s)
      let n = 0
      const ik = sc.kicker ? n++ : -1, it = n++, is = sc.subtitle ? n++ : -1
      const padX = E.pick(84, 56) * u, maxW = B.w * E.pick(0.72, 1) - padX * 2
      const tf = fitTitle(E, sc.title, { role: 'title', weight: 800, size: E.pick(136, 130) * u, maxW, maxLines: E.pick(2, 4), lineGap: 1.2 })
      const sf = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 600, size: E.pick(54, 48) * u, maxW, maxLines: 2, lineGap: 1.55 }) : null
      const cw = Math.max(tf.width, sf ? sf.width : 0, B.w * E.pick(0.5, 0.86) - padX * 2) + padX * 2
      const kf = sc.kicker ? E.fit(sc.kicker, { role: 'body', weight: 700, size: E.pick(42, 40) * u, maxW: cw * 0.4, maxLines: 1 }) : null
      const top = E.pick(66, 60) * u, gap = 34 * u, tH = tf.lines.length * tf.lineH, sH = sf ? sf.lines.length * sf.lineH : 50 * u
      const ch = top + tH + gap + sH + E.pick(46, 42) * u, ks = kf && { w: kf.width + kf.size * 1.4, h: kf.lineH + kf.size * 0.8 }
      const cx = W / 2, cy = B.y + B.h / 2 + (ks ? ks.h * 0.2 : 0), cT = cy - ch / 2, d0 = at(s, 0)
      const pw = E.pick(290, 260) * u, ph = pw * 1.22
      const pol = por
        ? [{ x: cx + cw * 0.27, y: cT - ph * 0.3, rot: 0.06 }, { x: cx - cw * 0.26, y: cT + ch + ph * 0.5 - 6 * u, rot: -0.07 }]
        : [{ x: cx - cw / 2 - pw * 0.12, y: cy + ch * 0.26, rot: -0.09 }, { x: cx + cw / 2 + pw * 0.1, y: cy - ch * 0.22, rot: 0.07 }]
      const cardO = { x: cx, y: cy, w: cw, h: ch, rot: -0.01, pin: k.red, pins: P }
      pol.forEach((q, j) => put(ctx, E, d0 - 0.4 - j * 0.15, { ...q, w: pw, h: ph, pin: k.red, pins: P }, (c, lift) => polaroid(c, E, k, pw, ph, lift, { icon: j ? 'key' : 'lens', seed: 2 + j, capH: ph * 0.2 })))
      pol.forEach((q, j) => pull(ctx, E, pinPos(E, cardO), pinPos(E, { ...q, w: pw, h: ph }), s.t, s.cue(0) + 0.8 + j * 0.15, { color: k.red }))
      put(ctx, E, d0, cardO, (c, lift) => {
        card(c, E, k, cw, ch, lift, { red: -ch / 2 + top + tH + gap * 0.5, top: -ch / 2 + top + tH + gap + (sf ? sf.lineH * 0.88 : 40 * u), step: sf ? sf.lineH : 60 * u })
        const dt = at(s, it), a = clamp(dt / 0.22), z = 1 + (1 - E.ease.out(clamp(dt / 0.3))) * 0.08
        if (a > 0) { c.save(); c.globalAlpha *= a; c.translate(0, -ch / 2 + top + tH / 2); c.scale(z, z); c.font = E.font('title', 800, tf.size); c.fillStyle = k.ink; drawLines(c, tf.lines, 0, -tH / 2, tf.lineH, 'center'); c.restore() }
        if (sf) handLines(c, E, sf, 0, -ch / 2 + top + tH + gap, { color: k.ink, align: 'center', p: writeP(at(s, is), sc.subtitle), seed: 11 })
      })
      if (kf) put(ctx, E, at(s, ik, 0.2), { x: cx - cw / 2 + ks.w / 2 + 26 * u, y: cT - ks.h * 0.12, w: ks.w, h: ks.h, rot: -0.045 }, (c, lift) => {
        slip(c, E, ks.w, ks.h, lift, k.white, 7)
        hand(c, E, kf.lines[0], 0, 0, { size: kf.size, weight: 700, color: k.red, align: 'center', stroke: kf.size * 0.03, p: writeP(at(s, ik, 0.3), sc.kicker, 0) })
        tape(c, E, -ks.w / 2 + 4 * u, -ks.h * 0.2, 80 * u, 1.2)
      })
      pins(ctx, E, P)
    },

    // 一句话：一张大索引卡，句子按卡上的横格排；高亮的那段用红字写、红笔圈起来；卡角贴一张写着叹号的便签
    statement(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W, P = [], rings = []
      cam(ctx, E, s)
      const padX = E.pick(80, 50) * u, top = E.pick(76, 70) * u, bot = E.pick(54, 50) * u
      const f = E.fit(sc.text, { role: 'title', weight: 700, size: E.pick(104, 96) * u, maxW: B.w * E.pick(0.78, 0.94) - padX * 2, maxLines: E.pick(4, 6), lineGap: 1.45 })
      const cw = Math.max(f.width + padX * 2, B.w * E.pick(0.56, 0.86)), ch = top + f.lines.length * f.lineH + bot, nl = f.lines.length
      const cx = W / 2, cy = B.y + B.h / 2, d = at(s, 0)
      const o = { x: cx, y: cy, w: cw, h: ch, rot: 0.008, pin: k.red, pinAt: [-cw / 2 + 34 * u, -ch / 2 + 30 * u], pins: P }
      put(ctx, E, d, o, (c, lift) => {
        card(c, E, k, cw, ch, lift, { red: -ch / 2 + top * 0.62, top: -ch / 2 + top + f.lineH * 0.9, step: f.lineH })
        c.font = E.font('title', 700, f.size); c.textBaseline = 'middle'; c.textAlign = 'left'
        const joined = f.lines.join(''), hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? joined.indexOf(hl) : -1
        let off = 0
        f.lines.forEach((line, li) => {
          const y = -ch / 2 + top + li * f.lineH + f.lineH / 2, x0 = -c.measureText(line).width / 2
          const a0 = Math.max(0, hs - off), a1 = Math.min(line.length, hs + hl.length - off)
          off += line.length
          c.save(); c.globalAlpha *= clamp((d - 0.2 - li * 0.1) / 0.2)
          if (hs < 0 || a1 <= a0) { c.fillStyle = k.ink; c.fillText(line, x0, y) } else {
            const pre = line.slice(0, a0), mid = line.slice(a0, a1), wPre = c.measureText(pre).width, wMid = c.measureText(mid).width
            c.fillStyle = k.ink; c.fillText(pre, x0, y); c.fillText(line.slice(a1), x0 + wPre + wMid, y)
            c.fillStyle = k.red; c.fillText(mid, x0 + wPre, y)
            rings.push([x0 + wPre + wMid / 2, y, wMid / 2 + 14 * u, f.size * 0.64])
          }
          c.restore()
        })
        rings.forEach(([x, y, rx, ry], q) => ring(c, E, x, y, rx, ry, clamp((d - 0.6 - nl * 0.1 - q * 0.35) / 0.45), { color: k.red, w: 6, seed: 4 + q }))
      })
      if (d > 0.3) { const [x, y] = pinPos(E, { ...o, pinAt: [cw / 2 - 34 * u, -ch / 2 + 30 * u] }); P.push({ x, y, col: k.red, k: clamp((d - 0.3) / 0.12) }) }
      const ns = E.pick(118, 110) * u
      put(ctx, E, d - 0.9 - nl * 0.1, { x: cx + cw / 2 + 4 * u, y: cy + ch / 2 - 10 * u, w: ns, h: ns, rot: 0.08, kind: 'peel', pin: k.red, pins: P }, (c, lift) => {
        note(c, E, ns, ns, lift, k.note); hand(c, E, '!', 0, 10 * u, { size: ns * 0.62, weight: 800, color: k.red, align: 'center', stroke: ns * 0.02 })
      })
      pins(ctx, E, P)
    },

    // 要点：一张一张钉上去的便签，红线依次连起来。横屏排成一排（太挤时两排，两排之间那根线从便签底下穿过）；
    // 竖屏排成一列，钉子钉在左边，红线顺着左边一路串下来
    bullets(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, por = E.portrait, P = [], cols = NOTES(k)
      cam(ctx, E, s)
      const hd = heading(ctx, s, E, k, sc.title, P), top = hd.y, avail = B.y + B.h - top, pad = 28 * u, Q = []
      if (!por) {
        const gap = 40 * u, pinRoom = 44 * u
        const geo = rows => { const per = Math.ceil(n / rows), cellW = Math.min((B.w - gap * (per - 1)) / per, 480 * u), cellH = (avail - gap * (rows - 1)) / rows; return { per, cellW, cellH, o: { role: 'body', weight: 600, size: 60 * u, maxW: cellW - pad * 2, maxLines: 3, maxH: cellH - pinRoom - pad * 2, lineGap: 1.3 } } }
        const g1 = geo(1), squeezed = Math.min(...sc.items.map(t => E.fit(t, { ...g1.o, silent: true }).size)) < 60 * u * 0.8
        const rows = n >= 3 && (B.w / n < 300 * u || squeezed) ? 2 : 1, { per, cellW, cellH, o: fo } = geo(rows)
        const fs = fitAll(E, sc.items, fo)
        const tw = Math.max(...fs.map(f => f.width)), th = Math.max(...fs.map(f => f.lines.length * f.lineH))
        const w = Math.min(cellW, Math.max(tw + pad * 2, cellW * 0.8)), h = Math.min(cellH, Math.max(th + pinRoom + pad * 2, w * 0.78)), gy = top + (avail - rows * h - (rows - 1) * gap) / 2
        sc.items.forEach((_, i) => {
          const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per), rw = inRow * w + (inRow - 1) * gap
          Q.push({ x: B.x + (B.w - rw) / 2 + c * (w + gap) + w / 2, y: gy + r * (h + gap) + h / 2 + (i % 2 ? 10 : -8) * u, w, h, rot: [-0.03, 0.025, -0.012, 0.03, -0.022][i % 5], f: fs[i], row: r, tx: 0, ty: pinRoom / 2, align: 'center' })
        })
      } else {
        const gap = 26 * u, left = 76 * u, hEach = (avail - gap * (n - 1)) / n
        const fs = fitAll(E, sc.items, { role: 'body', weight: 600, size: 54 * u, maxW: B.w - 60 * u - left - pad, maxLines: 2, maxH: Math.min(hEach, 260 * u) - pad * 2, lineGap: 1.3 })
        const tw = Math.max(...fs.map(f => f.width)), th = Math.max(...fs.map(f => f.lines.length * f.lineH))
        const w = Math.min(B.w - 40 * u, Math.max(tw + left + pad, B.w * 0.74)), h = Math.min(hEach, Math.max(th + pad * 2 + 30 * u, 160 * u)), gy = top + (avail - n * h - (n - 1) * gap) / 2
        sc.items.forEach((_, i) => Q.push({ x: B.x + 16 * u + w / 2 + (i % 2 ? 24 : 0) * u, y: gy + i * (h + gap) + h / 2, w, h, rot: i % 2 ? 0.012 : -0.014, f: fs[i], row: 0, pinAt: [-w / 2 + 36 * u, 0], tx: -w / 2 + left, ty: 0, align: 'left' }))
      }
      const pp = Q.map(q => pinPos(E, q)), tStr = i => s.cue(i + 2) + 0.3
      Q.forEach((q, i) => { if (i && q.row !== Q[i - 1].row) pull(ctx, E, pp[i - 1], pp[i], s.t, tStr(i - 1), { color: k.red, dur: 0.45 }) })
      Q.forEach((q, i) => put(ctx, E, at(s, i + 1), { ...q, kind: 'peel', pin: k.red, pins: P }, (c, lift) => {
        note(c, E, q.w, q.h, lift, cols[i % 3])
        handLines(c, E, q.f, q.tx, q.ty - q.f.lines.length * q.f.lineH / 2, { color: k.ink, align: q.align, p: writeP(at(s, i + 1), sc.items[i], 0.2), seed: 30 + i })
      }))
      if (por && hd.pin) pull(ctx, E, hd.pin, pp[0], s.t, s.cue(1) + 0.3, { color: k.red, dur: 0.45, sag: 0.02 })
      Q.forEach((q, i) => { if (i && q.row === Q[i - 1].row) pull(ctx, E, pp[i - 1], pp[i], s.t, tStr(i - 1), { color: k.red, dur: 0.35, sag: por ? 0.02 : 0.05 }) })
      pins(ctx, E, P)
    },

    // 大数字：手写在一张大索引卡上，从 0 滚到目标值，滚完红笔圈起来；label 手写在横格上，note 是一张钉在卡角的便签
    number(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W, por = E.portrait, P = []
      cam(ctx, E, s)
      let n = 1
      const il = sc.label ? n++ : -1, inn = sc.note ? n++ : -1
      const padX = E.pick(90, 60) * u, top = E.pick(54, 50) * u, bot = E.pick(52, 48) * u, size = E.pick(290, 320) * u
      const vo = { role: 'body', weight: 800, maxW: B.w * E.pick(0.52, 0.66), maxLines: 1, lineGap: 1.02 }, v0 = E.fit(String(sc.value), { ...vo, size, minSize: size * 0.3, silent: true })
      const vf = E.fit(String(sc.value), { ...vo, size: v0.size, minSize: size * 0.3 })
      const uf = sc.unit ? E.fit(sc.unit, { role: 'body', weight: 700, size: vf.size * 0.3, maxW: B.w * 0.24, maxLines: 1 }) : null
      ctx.font = E.font('body', 800, vf.size)
      const wNum = ctx.measureText(String(sc.value)).width, wUnit = uf ? uf.width + 18 * u : 0
      const lf = sc.label ? E.fit(sc.label, { role: 'body', weight: 600, size: E.pick(56, 52) * u, maxW: B.w * E.pick(0.62, 0.82) - padX * 2, maxLines: 2, lineGap: 1.4 }) : null
      const cw = Math.max(wNum + wUnit, lf ? lf.width : 0, B.w * E.pick(0.44, 0.8) - padX * 2) + padX * 2
      const nH = vf.size * 1.2, ch = top + nH + (lf ? 26 * u + lf.lines.length * lf.lineH : 0) + bot
      const nt = sc.note ? E.fit(sc.note, { role: 'body', weight: 600, size: 40 * u, maxW: Math.min(E.pick(340, 560) * u, B.w * 0.62), maxLines: 3, lineGap: 1.35 }) : null
      const npad = 26 * u, nw = nt ? Math.max(nt.width + npad * 2, 200 * u) : 0, nh = nt ? nt.lines.length * nt.lineH + npad * 2 + 30 * u : 0
      const cx = W / 2 - (nt && !por ? nw * 0.4 : 0), cy = B.y + B.h / 2 - (nt && por ? (nh - 24 * u) / 2 : 0), d = at(s, 0)
      put(ctx, E, d, { x: cx, y: cy, w: cw, h: ch, rot: -0.012, pin: k.red, pins: P }, (c, lift) => {
        card(c, E, k, cw, ch, lift, { red: -ch / 2 + top * 0.6, top: -ch / 2 + top + nH + 26 * u + (lf ? lf.lineH * 0.9 : 50 * u), step: lf ? lf.lineH : 64 * u })
        const ny = -ch / 2 + top + nH / 2, x0 = -(wNum + wUnit) / 2
        c.font = E.font('body', 800, vf.size); c.fillStyle = k.ink; c.textAlign = 'right'; c.textBaseline = 'middle'
        c.fillText(rolling(sc.value, clamp(d / ROLL(s))), x0 + wNum, ny)
        if (uf) { c.font = E.font('body', 700, uf.size); c.textAlign = 'left'; c.fillText(uf.lines[0], x0 + wNum + 18 * u, ny + vf.size * 0.2) }
        ring(c, E, 0, ny + vf.size * 0.05, Math.min((wNum + wUnit) / 2 + 60 * u, cw / 2 - 14 * u), vf.size * 0.56 + 16 * u, clamp((d - ROLL(s) - 0.05) / 0.5), { color: k.red, w: 8, seed: 6 })
        if (lf) handLines(c, E, lf, 0, -ch / 2 + top + nH + 26 * u, { color: k.ink, align: 'center', p: writeP(at(s, il), sc.label, 0.1), seed: 20 })
      })
      if (nt) {
        const o = por ? { x: cx + Math.min(cw * 0.16, (B.w - nw) / 2), y: cy + ch / 2 + nh / 2 - 24 * u, rot: 0.035 } : { x: cx + cw / 2 + nw * 0.38, y: cy + ch / 2 - nh * 0.32, rot: 0.05 }
        put(ctx, E, at(s, inn), { ...o, w: nw, h: nh, kind: 'peel', pin: k.red, pins: P }, (c, lift) => {
          note(c, E, nw, nh, lift, k.note)
          handLines(c, E, nt, 0, -nh / 2 + 30 * u + npad, { color: k.ink, align: 'center', p: writeP(at(s, inn), sc.note, 0.2), seed: 21 })
        })
      }
      pins(ctx, E, P)
    },

    // 柱状图：一张钉在板上的坐标纸，柱子是手画的排线方块，数值手写在顶上；高亮的那根用红笔画、数值圈起来。竖屏改成横条
    bars(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, por = E.portrait, P = []
      cam(ctx, E, s)
      const top = heading(ctx, s, E, k, sc.title, P).y, avail = B.y + B.h - top
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), txt = v => formatNumber(v, dec) + (sc.unit || '')
      const gw = B.w, gh = avail, m = E.pick(44, 36) * u, ink = mix(k.ink, k.pencil, 0.35), labels = sc.items.map(it => it.label)
      const go = { x: B.x + gw / 2, y: top + gh / 2, w: gw, h: gh, rot: 0.004, pin: k.red, pinAt: [-gw / 2 + 30 * u, -gh / 2 + 24 * u], pins: P }
      const grow = i => E.ease.out(clamp(at(s, i + 1) / 0.5)), d0 = at(s, 0, -0.1)
      put(ctx, E, d0, go, (c, lift) => {
        graph(c, E, k, gw, gh, lift)
        if (!por) {
          const slot = (gw - m * 2) / n, bw = Math.min(slot * 0.52, 170 * u)
          const lfs = fitAll(E, labels, { role: 'body', weight: 600, size: 40 * u, maxW: slot * 0.92, maxLines: 2, lineGap: 1.2 }, true)
          const vfs = fitAll(E, vals.map(txt), { role: 'body', weight: 700, size: 46 * u, maxW: slot * 0.96, maxLines: 1 })
          const labH = Math.max(...lfs.map(f => f.lines.length * f.lineH)) + 22 * u, valH = vfs[0].lineH
          const base = gh / 2 - m * 0.7 - labH, hMax = base - (-gh / 2 + m + valH + 14 * u)
          scrawl(c, E, -gw / 2 + m * 0.6, base, gw / 2 - m * 0.6, base, clamp((d0 - 0.3) / 0.4), { color: ink, w: 4, seed: 2 })
          sc.items.forEach((it, i) => {
            const d = at(s, i + 1)
            if (d <= 0) return
            const q = grow(i), x = -gw / 2 + m + slot * i + slot / 2, hh = Math.max(hMax * vals[i] / max, 6 * u) * q, col = i === hi ? k.red : ink, vy = base - hh - 14 * u - valH / 2
            hatchBar(c, E, x - bw / 2, base - hh, bw, hh, col, 50 + i)
            hand(c, E, txt(vals[i] * q), x, vy, { size: vfs[i].size, weight: 700, color: i === hi ? k.red : k.ink, align: 'center', seed: 70 + i })
            handLines(c, E, lfs[i], x, base + 14 * u, { color: i === hi ? k.red : k.ink, align: 'center', p: writeP(d, it.label, 0.05), seed: 80 + i })
            if (i === hi) ring(c, E, x, vy, vfs[i].width / 2 + 22 * u, valH / 2 + 2 * u, clamp((d - 0.6) / 0.4), { color: k.red, w: 5, seed: 9 })
          })
        } else {
          const rowH = Math.min((gh - m * 2) / n, 230 * u), y0 = -gh / 2 + m + (gh - m * 2 - rowH * n) / 2
          const lfs = fitAll(E, labels, { role: 'body', weight: 600, size: 40 * u, maxW: gw - m * 2 - 30 * u, maxLines: 1 })
          const vfs = fitAll(E, vals.map(txt), { role: 'body', weight: 700, size: 44 * u, maxW: 240 * u, maxLines: 1 })
          const vw = Math.max(...vfs.map(f => f.width)), x0 = -gw / 2 + m + 6 * u, wMax = gw / 2 - m - vw - 24 * u - x0, bh = rowH * 0.34
          scrawl(c, E, x0, y0 - 6 * u, x0, y0 + rowH * n, clamp((d0 - 0.3) / 0.4), { color: ink, w: 4, seed: 2 })
          sc.items.forEach((it, i) => {
            const d = at(s, i + 1)
            if (d <= 0) return
            const q = grow(i), y = y0 + rowH * i, L = Math.max(wMax * vals[i] / max, 6 * u) * q, by = y + rowH * 0.64, col = i === hi ? k.red : ink
            handLines(c, E, lfs[i], x0 + 14 * u, y + rowH * 0.26 - lfs[i].lineH / 2, { color: i === hi ? k.red : k.ink, align: 'left', p: writeP(d, it.label, 0.05), seed: 80 + i })
            hatchBar(c, E, x0, by - bh / 2, L, bh, col, 50 + i)
            hand(c, E, txt(vals[i] * q), x0 + L + 18 * u, by, { size: vfs[i].size, weight: 700, color: i === hi ? k.red : k.ink, align: 'left', seed: 70 + i })
            if (i === hi) ring(c, E, x0 + L + 18 * u + vfs[i].width / 2, by, vfs[i].width / 2 + 20 * u, vfs[i].lineH / 2 + 2 * u, clamp((d - 0.6) / 0.4), { color: k.red, w: 5, seed: 9 })
          })
        }
      })
      if (d0 > 0.3) { const [x, y] = pinPos(E, { ...go, pinAt: [gw / 2 - 30 * u, -gh / 2 + 24 * u] }); P.push({ x, y, col: k.red, k: clamp((d0 - 0.3) / 0.12) }) }
      pins(ctx, E, P)
    },

    // 流程：几张拍立得，红线从一张的钉子依次连到下一张；步骤手写在相片下面的白边上，角上一枚圆贴纸写着第几步。
    // 竖屏左右交错往下排
    steps(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, por = E.portrait, P = []
      cam(ctx, E, s)
      const top = heading(ctx, s, E, k, sc.title, P).y, avail = B.y + B.h - top, m = 16 * u
      let Q
      if (!por) {
        const rows = B.w / n >= 330 * u ? 1 : 2, per = Math.ceil(n / rows), gap = 56 * u, gapY = 40 * u, pw = Math.min((B.w - gap * (per - 1)) / per, 420 * u)
        const fs = fitAll(E, sc.items, { role: 'body', weight: 600, size: 44 * u, maxW: pw - m * 2 - 16 * u, maxLines: 3, lineGap: 1.25 })
        const capH = Math.max(...fs.map(f => f.lines.length * f.lineH)) + 34 * u, ph = Math.min(m + (pw - m * 2) * 0.92 + capH, (avail - gapY * (rows - 1)) / rows * 0.96)
        const gy = top + (avail - rows * ph - (rows - 1) * gapY) / 2
        Q = sc.items.map((_, i) => {
          const r = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - r * per), rw = inRow * pw + (inRow - 1) * gap
          return { x: B.x + (B.w - rw) / 2 + c * (pw + gap) + pw / 2, y: gy + r * (ph + gapY) + ph / 2 + (i % 2 ? 12 : -10) * u, w: pw, h: ph, rot: i % 2 ? 0.03 : -0.025, f: fs[i], capH, row: r }
        })
      } else {
        const pw = B.w * 0.5 - 12 * u, gapV = 30 * u
        const fs = fitAll(E, sc.items, { role: 'body', weight: 600, size: 42 * u, maxW: pw - m * 2 - 16 * u, maxLines: 3, lineGap: 1.25 })
        const capH = Math.max(...fs.map(f => f.lines.length * f.lineH)) + 34 * u
        const lim = n > 1 ? (2 * avail / (n - 1) - gapV) / (1 + 2 / (n - 1)) : avail
        const ph = Math.min(m + (pw - m * 2) * 0.82 + capH, lim, avail), step = n > 1 ? Math.min((avail - ph) / (n - 1), ph * 0.78) : 0, y0 = top + (avail - (n - 1) * step - ph) / 2
        Q = sc.items.map((_, i) => ({ x: i % 2 ? B.x + B.w - pw / 2 - 4 * u : B.x + pw / 2 + 4 * u, y: y0 + i * step + ph / 2, w: pw, h: ph, rot: i % 2 ? 0.025 : -0.02, f: fs[i], capH, row: 0 }))
      }
      const pp = Q.map(q => pinPos(E, { ...q, pinAt: [0, -q.h / 2 + 18 * u] })), link = (i, under) => { if (i && (Q[i].row !== Q[i - 1].row) === under) pull(ctx, E, pp[i - 1], pp[i], s.t, s.cue(i + 1) + 0.3, { color: k.red, dur: 0.4, sag: 0.04 }) }
      Q.forEach((_, i) => link(i, true))
      Q.forEach((q, i) => put(ctx, E, at(s, i + 1), { ...q, pin: k.red, pins: P, pinAt: [0, -q.h / 2 + 18 * u] }, (c, lift) => {
        polaroid(c, E, k, q.w, q.h, lift, { icon: ICONS[(i + s.index * 3) % ICONS.length], seed: 10 + i, capH: q.capH, m })
        handLines(c, E, q.f, 0, q.h / 2 - q.capH / 2 - q.f.lines.length * q.f.lineH / 2, { color: k.ink, align: 'center', p: writeP(at(s, i + 1), sc.items[i], 0.25), seed: 40 + i })
        const r = 28 * u
        c.save(); c.translate(-q.w / 2 + 8 * u, -q.h / 2 + 8 * u)
        c.fillStyle = 'rgba(14,7,0,0.22)'; c.beginPath(); c.arc(3 * u, 4 * u, r, 0, TAU); c.fill()
        c.fillStyle = k.note; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill()
        hand(c, E, String(i + 1), 0, 2 * u, { size: r * 1.25, weight: 800, color: k.red, align: 'center', jit: 0.5 })
        c.restore()
      }))
      Q.forEach((_, i) => link(i, false))
      pins(ctx, E, P)
    },

    // 对比：左右两组物证，各是一个档案夹，标签上写组名（右边那组是红标签）；夹里一张索引卡逐条手写，
    // 左边每条前面一道铅笔短横，右边打红勾；两组中间红笔画一个不等号。竖屏上下排
    compare(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, por = E.portrait
      cam(ctx, E, s)
      const top = heading(ctx, s, E, k, sc.title, []).y, avail = B.y + B.h - top, gap = E.pick(Math.min(150 * u, B.w * 0.11), 90 * u)
      const fw = por ? B.w : (B.w - gap) / 2, fh = por ? (avail - gap) / 2 : avail
      const C = por ? [[B.x + fw / 2, top + fh / 2], [B.x + fw / 2, top + fh * 1.5 + gap]] : [[B.x + fw / 2, top + fh / 2], [B.x + B.w - fw / 2, top + fh / 2]]
      const tabH = E.pick(74, 66) * u, pad = E.pick(36, 24) * u, inset = 26 * u, cardW = fw - inset * 2, cardH = fh - tabH - 22 * u - inset * 1.6
      const sides = [sc.left, sc.right], items = sides.map(sd => sd.items || [])
      const rowH = Math.min((cardH - pad * 2) / Math.max(1, ...items.map(a => a.length)), 140 * u)
      const fs = fitAll(E, items.flat(), { role: 'body', weight: 600, size: Math.min(E.pick(46, 44) * u, rowH * 0.5), maxW: cardW - pad * 2 - 56 * u, maxLines: 2, maxH: rowH * 0.96, lineGap: 1.25 })
      sides.forEach((side, i) => {
        const [x, y] = C[i], d = at(s, i + 1), off = i ? items[0].length : 0
        const tf = E.fit(side.title, { role: 'title', weight: 700, size: E.pick(44, 42) * u, maxW: fw - 120 * u, maxLines: 1 })
        const tabW = tf.width + 56 * u, tabX = i && !por ? fw / 2 - 30 * u - tabW : -fw / 2 + 30 * u
        put(ctx, E, d, { x, y, w: fw, h: fh, rot: i ? 0.008 : -0.01, kind: 'slide', from: por ? [(i ? 1 : -1) * 260 * u, 0] : [0, 260 * u], spin: i ? 0.06 : -0.06 }, (c, lift) => {
          folder(c, E, k, fw, fh, lift, { tabW, tabH, tabX, tabFill: i ? k.red : null })
          c.font = E.font('title', 700, tf.size); c.fillStyle = i ? k.on : k.ink; c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText(tf.lines[0], tabX + tabW / 2, -fh / 2 + tabH / 2 + 2 * u)
          c.save(); c.translate(0, -fh / 2 + tabH + 22 * u + (fh - tabH - 22 * u) / 2); c.rotate(i ? 0.01 : -0.012)
          card(c, E, k, cardW, cardH, 0, { top: -cardH / 2 + pad + rowH, step: rowH })
          items[i].forEach((t, q) => {
            const f = fs[off + q], yy = -cardH / 2 + pad + rowH * q + rowH / 2, mx = -cardW / 2 + pad + 16 * u, dq = d - 0.35 - q * 0.18
            if (i) check(c, E, mx, yy, 30 * u, clamp(dq / 0.25), { color: k.red, w: 6 })
            else stroke(c, E, [[mx - 14 * u, yy], [mx + 14 * u, yy - 2 * u]], clamp(dq / 0.2), { color: k.pencil, w: 6 })
            handLines(c, E, f, mx + 40 * u, yy - f.lines.length * f.lineH / 2, { color: k.ink, align: 'left', p: writeP(dq, t, 0), seed: 60 + i * 9 + q })
          })
          c.restore()
        })
      })
      const nx = B.x + B.w / 2, ny = por ? top + fh + gap / 2 : top + avail / 2
      neq(ctx, E, nx, ny, E.pick(84, 70) * u, clamp((at(s, 2) - 0.4) / 0.45), { color: k.red, w: 9 })
    },

    // 引语：一张撕下来的纸条，两角贴胶带，字一个一个手写出来；左上角红笔一个大引号；出处写在钉在右下角的便签上
    quote(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W, P = []
      cam(ctx, E, s)
      const pad = E.pick(70, 54) * u
      const f = E.fit(sc.text, { role: 'body', weight: 600, size: E.pick(76, 68) * u, maxW: B.w * E.pick(0.66, 0.86) - pad * 2, maxLines: E.pick(4, 7), lineGap: 1.5 })
      const bf = sc.by ? E.fit('— ' + sc.by, { role: 'body', weight: 600, size: 38 * u, maxW: B.w * E.pick(0.5, 0.7), maxLines: 1 }) : null
      const sw = Math.max(f.width + pad * 2, B.w * E.pick(0.5, 0.8)), sh = f.lines.length * f.lineH + pad * 2 + 10 * u
      const nw = bf ? bf.width + 56 * u : 0, nh = bf ? bf.lineH + 52 * u + 22 * u : 0, gH = sh + (bf ? nh - 16 * u : 0)
      const cx = W / 2, cy = B.y + (B.h - gH) / 2 + sh / 2, d = at(s, 0), N = [...String(sc.text)].length
      put(ctx, E, d, { x: cx, y: cy, w: sw, h: sh, rot: -0.015 }, (c, lift) => {
        slip(c, E, sw, sh, lift, k.white, 12)
        tape(c, E, -sw / 2 + 30 * u, -sh / 2 + 6 * u, 130 * u, -0.6); tape(c, E, sw / 2 - 30 * u, -sh / 2 + 6 * u, 130 * u, 0.6)
        handLines(c, E, f, 0, -f.lines.length * f.lineH / 2 + 5 * u, { color: k.ink, align: 'center', p: clamp((d - 0.25) / Math.min(1.6, 0.05 * N + 0.4)), seed: 50 })
        const qs = E.pick(190, 160) * u
        c.save(); c.globalAlpha *= clamp((d - 0.15) / 0.2); c.font = E.font('title', 900, qs); c.fillStyle = k.red; c.textAlign = 'left'; c.textBaseline = 'alphabetic'
        const mq = c.measureText('“'); c.fillText('“', -sw / 2 - 26 * u - mq.actualBoundingBoxLeft, -sh / 2 + 44 * u + (mq.actualBoundingBoxAscent - mq.actualBoundingBoxDescent) / 2); c.restore()
      })
      if (bf) put(ctx, E, at(s, 1), { x: cx + sw / 2 - nw / 2 - 10 * u, y: cy + sh / 2 + nh / 2 - 16 * u, w: nw, h: nh, rot: 0.03, kind: 'peel', pin: k.red, pins: P }, (c, lift) => {
        note(c, E, nw, nh, lift, k.note)
        hand(c, E, bf.lines[0], 0, 11 * u, { size: bf.size, color: k.ink, align: 'center', p: writeP(at(s, 1), sc.by, 0.2) })
      })
      pins(ctx, E, P)
    },

    // 片尾：标题插在一块毡面字板上，钉在正中；四周几张小拍立得和问号、叹号便签，红线依次全部拉到字板的钉子上；
    // 副标题手写在撕下的纸条上，cta 是一张便签，钉好后红笔圈起来
    end(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W, por = E.portrait, P = []
      cam(ctx, E, s)
      let n = 0
      const it = n++, is = sc.subtitle ? n++ : -1, ic = sc.cta ? n++ : -1
      const fr = 12 * u, padX = 50 * u, padY = 30 * u
      const tf = fitTitle(E, sc.title, { role: 'num', weight: 700, size: E.pick(110, 96) * u, maxW: (B.w * E.pick(0.62, 0.9) - 2 * (fr + padX)) / 1.16, maxLines: E.pick(2, 3), lineGap: 1.25 })
      ctx.font = E.font('num', 700, tf.size)
      const lw = Math.max(...tf.lines.map(l => [...l].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + tf.size * FELT_GAP * ([...l].length - 1)))
      const bw = lw + 2 * (fr + padX), bh = tf.lines.length * tf.lineH + 2 * (fr + padY)
      const sf = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 600, size: E.pick(50, 46) * u, maxW: B.w * 0.66 - 72 * u, maxLines: 2, lineGap: 1.4 }) : null
      const cf = sc.cta ? E.fit(sc.cta, { role: 'body', weight: 700, size: E.pick(50, 46) * u, maxW: B.w * 0.5, maxLines: 1 }) : null
      const ss = sf && { w: sf.width + 72 * u, h: sf.lines.length * sf.lineH + 44 * u }, cs = cf && { w: cf.width + 90 * u, h: cf.lineH + 70 * u }
      const g1 = 40 * u, g2 = 50 * u, gH = bh + (ss ? g1 + ss.h : 0) + (cs ? g2 + cs.h : 0), cx = W / 2
      const by = B.y + (B.h - gH) / 2 + bh / 2, sy = by + bh / 2 + g1 + (ss ? ss.h / 2 : 0), ny = (ss ? sy + ss.h / 2 : by + bh / 2) + g2 + (cs ? cs.h / 2 : 0)
      const boardO = { x: cx, y: by, w: bw, h: bh, rot: -0.01, pin: k.paper, pinAt: [0, -bh / 2 + 7 * u], pins: P }, bp = pinPos(E, boardO)
      // 中间那一组两侧（竖屏是上下）空出来的板面上各钉两件小物件；空得不够就不放
      const gw = Math.max(bw, ss ? ss.w : 0, cs ? cs.w + 80 * u : 0) / 2 + 24 * u, gy0 = by - bh / 2 - 24 * u, gy1 = (cs ? ny + cs.h / 2 + 24 * u : ss ? sy + ss.h / 2 : by + bh / 2) + 24 * u
      const dw = E.pick(190, 180) * u, rots = [-0.08, 0.07, 0.05, -0.06]
      const D = [0, 1, 2, 3].map(j => {
        const pol = j % 2 === 0, w = dw, h = pol ? dw * 1.22 : dw * 0.9, side = j < 2 ? 0 : 1, end = j % 2
        if (!por) {
          const room = side ? B.x + B.w - (cx + gw) : cx - gw - B.x
          if (room < w * 0.72) return null
          return { x: side ? (cx + gw + B.x + B.w) / 2 + 20 * u : (B.x + cx - gw) / 2 - 20 * u, y: end ? B.y + B.h - h / 2 - 10 * u : B.y + h / 2 + 10 * u, w, h, rot: rots[j], pol, j }
        }
        const room = side ? B.y + B.h - gy1 : gy0 - B.y
        if (room < h * 0.8) return null
        return { x: end ? B.x + B.w - w / 2 - 10 * u : B.x + w / 2 + 10 * u, y: side ? (gy1 + B.y + B.h) / 2 : (B.y + gy0) / 2, w, h, rot: rots[j], pol, j }
      }).filter(Boolean)
      D.forEach((q, j) => put(ctx, E, at(s, it, 0.15 + j * 0.12), { ...q, pin: k.red, pins: P }, (c, lift) => {
        if (q.pol) polaroid(c, E, k, q.w, q.h, lift, { icon: ['eye', 'file', 'clock', 'lens'][q.j], seed: 30 + q.j, capH: q.h * 0.18 })
        else { note(c, E, q.w, q.h, lift, NOTES(k)[q.j % 3]); hand(c, E, q.j === 1 ? '?' : '!', 0, 12 * u, { size: q.h * 0.56, weight: 800, color: k.red, align: 'center', stroke: q.h * 0.02 }) }
      }))
      D.forEach((q, j) => pull(ctx, E, pinPos(E, q), bp, s.t, s.cue(it) + 0.75 + j * 0.2, { color: k.red, dur: 0.45, sag: 0.04 }))
      put(ctx, E, at(s, it), boardO, (c, lift) => {
        c.save(); c.fillStyle = 'rgba(14,7,0,0.3)'; c.fillRect(-bw / 2 + (4 + 14 * lift) * u, -bh / 2 + (7 + 20 * lift) * u, bw, bh); c.restore()
        c.drawImage(felt(E, k, tf, bw, bh), -bw / 2, -bh / 2, bw, bh)
      })
      if (sf) put(ctx, E, at(s, is), { x: cx + E.pick(30, 0) * u, y: sy, w: ss.w, h: ss.h, rot: 0.012 }, (c, lift) => {
        slip(c, E, ss.w, ss.h, lift, k.white, 21)
        handLines(c, E, sf, 0, -sf.lines.length * sf.lineH / 2, { color: k.ink, align: 'center', p: writeP(at(s, is), sc.subtitle, 0.15), seed: 90 })
        tape(c, E, ss.w / 2 - 10 * u, -ss.h / 2 + 4 * u, 90 * u, 0.7)
      })
      if (cf) {
        const dc = at(s, ic)
        put(ctx, E, dc, { x: cx, y: ny, w: cs.w, h: cs.h, rot: -0.02, kind: 'peel', pin: k.red, pins: P }, (c, lift) => {
          note(c, E, cs.w, cs.h, lift, k.note)
          hand(c, E, cf.lines[0], 0, 12 * u, { size: cf.size, weight: 700, color: k.ink, align: 'center', p: writeP(dc, sc.cta, 0.15) })
        })
        ring(ctx, E, cx, ny + 4 * u, cs.w / 2 + 34 * u, cs.h / 2 + 24 * u, clamp((dc - 0.6) / 0.45), { color: k.red, w: 7, seed: 12 })
      }
      pins(ctx, E, P)
    },
  },

  // 字幕：证物标签（剪角、扣眼、麻绳、细红框），衬线字逐字略有错位，像打字机打的。先画台灯暗角，字幕压在暗角上面
  caption(ctx, s, E) {
    lamp(ctx, E)
    const say = s.scene.say
    if (!say) return
    const { W, H, u } = E, k = pal(this.c)
    const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((a, b) => a + b, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const dd = span * lens[i] / total; if (s.t < acc + dd) { idx = i; t0 = acc; t1 = acc + dd; break } acc += dd }
    const a = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
    if (a <= 0) return
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'title', weight: 500, size: E.pick(40, 38) * u, maxW: E.pick(1300, 720) * u, maxLines: 2, lineGap: 1.4, quiet: true })
    const w = f.width + f.size * 1.4, h = f.lines.length * f.lineH + f.size * 0.6, ex = h * 0.62
    const x0 = W / 2 - (w + ex) / 2 + ex, y0 = H - E.captionH / 2 - (E.portrait ? 30 * u : 0) - h / 2 + (1 - E.ease.out(a)) * 8 * u
    ctx.save(); ctx.globalAlpha = clamp(a * 1.4)
    tag(ctx, E, k, x0, y0, w, h, { ex })
    f.lines.forEach((ln, j) => hand(ctx, E, ln, x0 + w / 2, y0 + f.size * 0.3 + (j + 0.5) * f.lineH, { role: 'title', weight: 500, size: f.size, color: k.ink, align: 'center', jit: 0.35, seed: s.index * 31 + idx * 7 + j }))
    ctx.restore()
  },

  // 最上层：左上角一条黑底压字标签「线索」，后面一排图钉表示场次，已经到过的是红钉
  overlay(ctx, E, s) {
    const k = pal(this.c), u = E.u, y = E.pick(54, 106) * u, sz = 22 * u, x0 = E.pick(64, 40) * u, sp = sz * 0.3
    ctx.font = E.font('num', 600, sz)
    const label = '线索', tw = [...label].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + sp, lw = tw + sz * 1.4
    ctx.save(); ctx.translate(x0, y); ctx.rotate(-0.012)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; E.roundRect(ctx, 3 * u, -sz * 0.95 + 4 * u, lw, sz * 1.9, 4 * u); ctx.fill()
    ctx.fillStyle = k.felt; E.roundRect(ctx, 0, -sz * 0.95, lw, sz * 1.9, 4 * u); ctx.fill()
    ctx.fillStyle = k.paper; ctx.textBaseline = 'middle'; E.spacedText(ctx, label, sz * 0.7, 1, sp, 'left')
    ctx.restore()
    const gap = (s.count > 12 ? 22 : 30) * u
    for (let j = 0; j < s.count; j++) {
      const x = x0 + lw + 30 * u + j * gap
      if (j <= s.index) pin(ctx, E, x, y, this.c.accent, 1, 9 * u)
      else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(x + 3 * u, y + 4 * u, 8 * u, 0, TAU); ctx.fill(); ctx.fillStyle = rgba(k.paper, 0.75); ctx.beginPath(); ctx.arc(x, y, 8 * u, 0, TAU); ctx.fill() }
    }
  },

  transitionDur: 0.75,
  transition(ctx, A, B, p, E, info) { pan(ctx, A, B, p, E, info) },

  // 默认版式会调用的零件（九种版式都重画了，只有自己写的 custom 场借用时才用到）：索引卡、排线柱、图钉、红笔下划线
  card(ctx, E, x, y, w, h, o = {}) { const k = pal(this.c); ctx.save(); ctx.translate(x + w / 2, y + h / 2); card(ctx, E, k, w, h, 0, { fill: o.tone === 'accent' ? k.note : k.paper, red: -h / 2 + 30 * E.u }); ctx.restore() },
  bar(ctx, E, x, y, w, h, o = {}) { hatchBar(ctx, E, Math.min(x, x + w), Math.min(y, y + h), Math.abs(w), Math.abs(h), o.color ?? this.c.accent, (o.seed ?? 1) * 7) },
  line(ctx, E, x1, y1, x2, y2, o = {}) { scrawl(ctx, E, x1, y1, x2, y2, o.p ?? 1, { color: o.color ?? this.c.muted, w: o.width ?? 4, seed: o.seed ?? 5 }) },
  mark(ctx, E, x, y, r, i, o = {}) { if (o.badge) { ctx.save(); ctx.fillStyle = this.c.accent; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore() } else pin(ctx, E, x, y, o.color ?? this.c.accent, 1, r * 0.8) },
  underline(ctx, E, x, y, w, p) { scrawl(ctx, E, x, y + 4 * E.u, x + w, y, p, { color: this.c.accent, w: 6, seed: 4 }) },

  music: { style: 'calm', prog: ['Dm', 'Dm', 'Bb', 'A'], lead: 'pluck', drums: true },
  sfx: { enter: 'click', cut: 'whoosh', accent: 'thud' },
  // 几个画面动作上的音效：记号笔圈数字、圈高亮词时沙沙一下，片尾字板钉上一记闷响，红线全部拉到字板上时叮一声
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const c = S.cues, sc = S.scene, t = S.t0
      if (S.layout === 'number') out.push({ t: t + c[0] + Math.min(1.4, S.dur * 0.35) + 0.08, kind: 'type', gain: 0.4 }, { t: t + c[0] + Math.min(1.4, S.dur * 0.35) + 0.3, kind: 'type', gain: 0.3, seed: 3 })
      if (S.layout === 'statement' && sc.highlight) out.push({ t: t + c[0] + 0.75, kind: 'type', gain: 0.35 })
      if (S.layout === 'compare') out.push({ t: t + c[2] + 0.45, kind: 'type', gain: 0.35 })
      if (S.layout === 'end') out.push({ t: t + c[0] + 0.3, kind: 'thud', gain: 0.5 }, { t: t + c[0] + 1.6, kind: 'chime', gain: 0.25 })
    }
    return out
  },
}
