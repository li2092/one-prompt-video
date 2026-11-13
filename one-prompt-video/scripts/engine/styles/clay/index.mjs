// 风格包：黏土卡通。马卡龙色抹过的墙，焦糖色黏土桌；画面里的东西都是黏土捏的——刻字牌、黏土大字、圆台、柱子、
// 桌上的小摆件，还有一只圆头小机器人在每一场里招呼、指点、跳圆台、举牌子。字幕是一块刻字的奶油色黏土牌，
// 换场时下一场从画面中间被一团手捏的黏土压开。画法库（lib/）移植自风格库的 S-黏土卡通。
import { pal, sprite, blob, ball, put, ground, noodle, rrPts, ellPts, polyPts, pathPts, pressText, plaque, engrave, clayRow, rowWidth, measurer, pop, drop, squish, boil } from './lib/clay.mjs'
import { stageLay, stage, robot, robotH, armTo, drum, prop, check, stand } from './lib/props.mjs'
import { captionChunks, rolling } from '../../layouts.mjs'
import { formatNumber, decimalsOf, textUnits, clamp, lerp, ease } from '../../core.mjs'

// 第 i 个元素的黏土弹出（从它的入场时刻起，可以再晚 d 秒）、掉落
const NONE = { s: 0, sx: 0, sy: 0, p: 0, a: 0, dy: 0 }
const popAt = (s, i, d = 0, dur = 0.45) => (s.p(i) > 0 ? pop(s.t, s.cue(i) + d, dur) : NONE)
const dropAt = (s, i, E, h = 140, d = 0) => (s.p(i) > 0 ? drop(s.t, s.cue(i) + d, h * E.u, 0.24) : NONE)
// 画一块贴图：带弹出缩放和定格颤动
function show(ctx, E, sp, x, y, pp, o = {}) {
  if (!pp || pp.sx <= 0) return
  const bo = boil(E.T, o.seed ?? 1, 0.8 * E.u)
  put(ctx, sp, x + bo.x, y + bo.y + (pp.dy || 0), { sx: pp.sx, sy: pp.sy, rot: (o.rot ?? 0) + bo.r, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, a: pp.a ?? 1 })
}
// 几段字用同一个字号（取各自能放下的最小字号），同一场里的牌子字号不忽大忽小。
// 定下字号的那一段再按原字号排一次（不 silent），缩得多时照常记进报告
function fitAll(E, texts, o) {
  const sizes = texts.map(t => E.fit(t, { ...o, silent: true }).size), size = Math.min(...sizes)
  E.fit(texts[sizes.indexOf(size)], o)
  return texts.map(t => E.fit(t, { ...o, size }))
}
// 场标题：左上角一块奶黄色刻字牌。返回它下面可用区域的 y
function header(ctx, s, E, text) {
  const a = E.L.box, u = E.u
  if (!text) return a.y
  const f = E.fit(text, { role: 'title', weight: 800, size: 56 * u, maxW: a.w - 70 * u, maxLines: 2, lineGap: 1.2, oneLine: true })
  const sp = plaque(E, f.lines, f.size, { role: 'title', weight: 800, lineH: f.lineH, color: pal(E).butter, align: 'left', padX: f.size * 0.55, seed: 9 })
  show(ctx, E, sp, a.x + sp.w / 2, a.y + sp.h / 2, popAt(s, 0), { seed: 5, rot: -0.01 })
  return a.y + sp.h + E.pick(30, 40) * u
}
// 一行行黏土大字，一个字一块，依次掉下来压扁
function dropTitle(ctx, s, E, f, i, cx, y, color) {
  if (s.p(i) <= 0) return
  const n = [...f.lines.join('')].length, step = Math.min(0.05, 0.4 / Math.max(1, n))
  let k0 = 0
  f.lines.forEach((ln, j) => {
    const base = k0
    clayRow(ctx, E, ln, cx, y + j * f.lineH + f.lineH / 2, f.size, color, { anim: k => drop(s.t, s.cue(i) + (base + k) * step, 150 * E.u, 0.22) })
    k0 += [...ln].length
  })
}
// 数值：数字是黏土块，单位小一号、不描边；(x, y) 是整串的中心
function clayValue(ctx, E, num, unit, x, y, size, color) {
  const us = size * 0.62, gap = size * 0.06, wn = rowWidth(E, num, size, 'num'), wu = unit ? rowWidth(E, unit, us, 'num') + gap : 0, x0 = x - (wn + wu) / 2
  clayRow(ctx, E, num, x0, y, size, color, { role: 'num', align: 'left' })
  if (unit) clayRow(ctx, E, unit, x0 + wn + gap, y + size * 0.17, us, color, { role: 'num', align: 'left', rim: false })
}
// 一对黏土引号：两颗球各拖一条往右上翘的尾巴
function quoteMark(E, size, color) {
  const r = size * 0.2, w = Math.round(size * 1.1), h = Math.round(size * 0.75)
  return sprite(E, `qm:${size}:${color}`, w, h, g => {
    g.lineCap = 'round'; g.lineWidth = r * 0.95
    for (const cx of [r * 1.25, w - r * 1.5]) {
      const cy = h - r * 1.1
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill()
      g.beginPath(); g.moveTo(cx - r * 0.6, cy - r * 0.3); g.quadraticCurveTo(cx - r * 0.7, cy - r * 2.2, cx + r * 0.9, cy - r * 2.6); g.stroke()
    }
  }, { color, shadow: true, seed: 75, prints: 0, depth: Math.max(3, size * 0.05) })
}
// 挥手、欢呼时手臂的角度
const wave = (t, t0) => 2.55 + Math.sin((t - t0) * 7) * 0.35
const cheer = (t, k) => 2.6 + Math.sin(t * 6 + k) * 0.12
const after = (t, t0) => t >= t0

export default {
  name: '黏土卡通', mood: '暖色黏土定格，轻松可爱，适合入门讲解', bpm: 112,
  c: { bg: '#FBE2D2', fg: '#4B302B', muted: '#8A675D', accent: '#EE7F68', accent2: '#8FC4EE', card: '#FFF6EA', line: '#EDB98C', onAccent: '#3A2220' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 800, wBody: 700, radius: 28,
  motion: 'pop', solidAccent: true,

  bg(ctx, E, s) { stage(ctx, E, s.index, s.count) },

  layouts: {
    // 片头：kicker 是浅蓝小牌，标题一个字一块黏土掉下来，副标题刻在奶油色牌上；机器人在桌上挥手
    title(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait
      let i = 0
      const ik = sc.kicker ? i++ : -1, it = i++, is = sc.subtitle ? i++ : -1
      const rs = E.pick(210, 260) * u, rx = P ? a.x + a.w * 0.5 : a.x + a.w * 0.88
      const areaB = P ? S.G - robotH(rs) - 50 * u : S.TOP - 20 * u, tw = P ? a.w : a.w * 0.76, cx = P ? E.W / 2 : a.x + a.w * 0.39
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(150, 168) * u, maxW: tw * 0.9, maxLines: 3, lineGap: 1.18, oneLine: true })
      const kick = sc.kicker && E.fit(sc.kicker, { role: 'body', weight: 700, size: 42 * u, maxW: tw * 0.8, maxLines: 1 })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 700, size: E.pick(50, 52) * u, maxW: tw * 0.84, maxLines: 2 })
      const kp = kick && plaque(E, kick.lines, kick.size, { color: K.sky, seed: 31 }), spl = sub && plaque(E, sub.lines, sub.size, { lineH: sub.lineH, seed: 33 })
      const gap = 34 * u, hT = big.lines.length * big.lineH
      let y = a.y + (areaB - a.y - (kp ? kp.h + gap : 0) - hT - (spl ? spl.h + gap : 0)) / 2
      if (P) { prop(ctx, E, 'balls', a.x + a.w * 0.1, S.G, 90 * u, 1); prop(ctx, E, 'plant', a.x + a.w * 0.88, S.G, 90 * u, 2) }
      else { prop(ctx, E, 'balls', a.x + a.w * 0.06, S.G, 100 * u, 1); prop(ctx, E, 'blocks', a.x + a.w * 0.62, S.G, 96 * u, 2) }
      if (kp) { show(ctx, E, kp, cx, y + kp.h / 2, popAt(s, ik), { seed: 3, rot: -0.02 }); y += kp.h + gap }
      dropTitle(ctx, s, E, big, it, cx, y, K.accent)
      y += hT
      if (spl) show(ctx, E, spl, cx, y + gap + spl.h / 2, popAt(s, is), { seed: 4 })
      const tl = s.cue(it) + 0.45, d = drop(s.t, 0.05, 260 * u, 0.3)
      robot(ctx, E, rx, S.G + d.dy, rs, { t: s.t, mood: after(s.t, tl) ? 'happy' : 'neutral', armR: after(s.t, tl) ? wave(s.t, tl) : 0.35, armL: 0.35, look: P ? 0 : -0.4, turn: P ? 0 : -0.2, seed: 1, a: d.a, squash: after(s.t, tl) ? squish(s.t, tl, 0.12) : d })
    },

    // 一句话刻在一块黏土大板上，板子架在两条黏土腿上；高亮词压上一条强调色黏土；机器人在旁边指着它
    statement(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait
      const rs = E.pick(200, 210) * u, maxBW = P ? a.w : a.w * 0.72, pad = E.pick(64, 56) * u
      const bottom = P ? S.G - robotH(rs) - 60 * u : S.G - 70 * u
      const f = E.fit(sc.text, { role: 'title', weight: 800, size: E.pick(88, 80) * u, maxW: maxBW - pad * 2, maxLines: E.pick(4, 6), maxH: bottom - a.y - pad * 2, lineGap: 1.32 })
      const bw = Math.round(Math.max(f.width + pad * 2, maxBW * 0.55)), bh = Math.round(f.lines.length * f.lineH + pad * 2)
      const cx = P ? E.W / 2 : a.x + maxBW / 2, by = a.y + (bottom - a.y - bh) / 2, font = E.font('title', 800, f.size)
      // 高亮词可能被折到两行：按它在整句里的位置，逐行算出要压色条的那一截（板子上的坐标）
      const hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1, mc = measurer(E), segs = []
      mc.font = font
      let off = 0
      f.lines.forEach((ln, k) => {
        const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off), x0 = bw / 2 - mc.measureText(ln).width / 2
        off += ln.length
        if (hs >= 0 && a1 > a0) segs.push({ x: x0 + mc.measureText(ln.slice(0, a0)).width, y: pad + k * f.lineH + f.lineH / 2, w: mc.measureText(ln.slice(a0, a1)).width, text: ln.slice(a0, a1) })
      })
      const board = sprite(E, `board:${f.lines.join('|')}:${f.size}:${bw}x${bh}`, bw, bh, g => { pathPts(g, rrPts(0, 0, bw, bh, 46 * u, 61)); g.fill() }, {
        color: K.cream, shadow: true, seed: 61, prints: 3, deco: g => f.lines.forEach((ln, k) => pressText(g, ln, bw / 2, pad + k * f.lineH + f.lineH / 2 + f.size * 0.03, font, K.ink)),
      })
      const pp = popAt(s, 0, 0, 0.5), tq = clamp((s.t - s.cue(0) - 0.5) / 0.3)
      if (P) { prop(ctx, E, 'balls', a.x + a.w * 0.1, S.G, 84 * u, 3); prop(ctx, E, 'plant', a.x + a.w * 0.9, S.G, 84 * u, 4) }
      else prop(ctx, E, 'pencil', a.x + a.w * 0.78, S.G + 10 * u, 90 * u, 3)
      if (pp.sx > 0) {
        // 两条腿：从板子底下伸到桌面
        for (const dx of [-0.3, 0.3]) { ground(ctx, cx + dx * bw, S.G, 80 * u, pp.s); noodle(ctx, g => { g.beginPath(); g.moveTo(cx + dx * bw, by + bh - 20 * u); g.lineTo(cx + dx * bw, S.G - 6 * u) }, K.table, 22 * u, clamp(pp.p * 3)) }
        const bo = boil(E.T, 7, 0.8 * E.u)
        put(ctx, board, cx + bo.x, by + bh + bo.y, { ay: 1, sx: pp.sx, sy: pp.sy })
        if (tq > 0) for (const g of segs) {
          const X = cx - bw / 2 + g.x + bo.x, Y = by + g.y + bo.y
          put(ctx, blob(E, `hl:${Math.round(g.w)}`, Math.round(g.w + 26 * u), Math.round(f.size * 1.08), f.size * 0.3, { color: K.accent, seed: 62, prints: 0 }), X - 13 * u, Y, { ax: 0, sx: ease.out(tq) })
          ctx.save(); ctx.globalAlpha = tq; engrave(ctx, g.text, X, Y + f.size * 0.03, font, K.on, 'left'); ctx.restore()
        }
      }
      // 机器人指向高亮词（没有就指板子）
      const rx = P ? E.W / 2 : a.x + a.w * 0.87, g0 = segs[0], tx = g0 ? cx - bw / 2 + g0.x + g0.w / 2 : cx + (P ? 0 : bw / 2), ty = g0 ? by + g0.y : by + bh / 2
      const point = clamp((s.t - s.cue(0) - 0.3) / 0.3), ang = armTo(rx, S.G, rs, P ? 1 : -1, tx, ty), arm = lerp(0.35, ang, ease.outBack(point))
      robot(ctx, E, rx, S.G, rs, { t: s.t, mood: tq > 0 ? 'happy' : 'o', look: P ? 0 : -0.6, turn: P ? 0 : -0.25, seed: 2, armL: P ? 0.35 : arm, armR: P ? arm : 0.35, reachL: 1.25, reachR: 1.25, squash: squish(s.t, s.cue(0) + 0.5, 0.1) })
    },

    // 要点：一条一块刻字牌，左端压一颗带编号的黏土球，依次掉下来；机器人站在桌上指着最新的一条
    bullets(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait, n = sc.items.length
      const RC = P ? 0 : Math.min(420 * u, a.w * 0.3), rs = P ? 150 * u : Math.min(240 * u, RC * 0.55)
      const top = header(ctx, s, E, sc.title), y1 = P ? S.G - robotH(rs) - 40 * u : S.TOP - 16 * u
      const rowH = Math.min((y1 - top) / n, E.pick(170, 200) * u), d = Math.round(Math.min(rowH * 0.8, E.pick(112, 110) * u))
      const size = Math.min(E.pick(60, 58) * u, rowH * 0.42), tx = a.x + d * 0.7, padX = d * 0.3 + size * 0.55
      const FS = fitAll(E, sc.items, { role: 'body', weight: 700, size, maxW: a.x + a.w - RC - tx - padX - size * 0.6, maxLines: 2, maxH: rowH * 0.96 - size * 0.8, lineGap: 1.22 })
      const y0 = top + (y1 - top - rowH * n) / 2, cyOf = i => y0 + rowH * (i + 0.5)
      if (P) { prop(ctx, E, 'blocks', a.x + a.w * 0.62, S.G, 84 * u, 5); prop(ctx, E, 'plant', a.x + a.w * 0.9, S.G, 84 * u, 6) }
      else { prop(ctx, E, 'balls', a.x + a.w * 0.42, S.G, 90 * u, 5); prop(ctx, E, 'pencil', a.x + a.w * 0.6, S.G + 10 * u, 80 * u, 6) }
      let newest = -1
      sc.items.forEach((it, i) => {
        if (s.p(i + 1) <= 0) return
        newest = i
        const f = FS[i], dd = dropAt(s, i + 1, E, 46), bo = boil(E.T, 20 + i, 0.8 * u)
        const sp = plaque(E, f.lines, f.size, { lineH: f.lineH, align: 'left', padX, minH: d * 0.86, seed: 40 + i })
        const nb = ball(E, `num${i}:${d}`, d, d, { color: K.tones[i % 5], seed: 80 + i, deco: (g, w, h) => pressText(g, String(i + 1), w / 2, h / 2 + d * 0.03, E.font('num', 900, d * 0.5), K.ink) })
        put(ctx, sp, tx + sp.w / 2 + bo.x, cyOf(i) + dd.dy + bo.y, { sx: dd.sx, sy: dd.sy, a: dd.a, rot: i % 2 ? 0.008 : -0.008 })
        put(ctx, nb, a.x + d / 2 + bo.x, cyOf(i) + dd.dy, { sx: dd.sx, sy: dd.sy, a: dd.a })
      })
      const rx = P ? a.x + a.w * 0.24 : a.x + a.w - RC / 2 + 20 * u, side = P ? 1 : -1
      const aim = i => (i < 0 ? 0.35 : armTo(rx, S.G, rs, side, P ? a.x + a.w * 0.5 : a.x + a.w - RC - 40 * u, cyOf(i)))
      const arm = newest < 0 ? 0.35 : lerp(aim(newest - 1), aim(newest), ease.outBack(clamp((s.t - s.cue(newest + 1)) / 0.3)))
      robot(ctx, E, rx, S.G, rs, { t: s.t, mood: newest >= 0 ? 'happy' : 'neutral', look: P ? 0.3 : -0.5, turn: P ? 0.15 : -0.25, seed: 3, armL: side < 0 ? arm : 0.35, armR: side > 0 ? arm : 0.35, reachL: 1.2, reachR: 1.2, squash: newest >= 0 ? squish(s.t, s.cue(newest + 1) + 0.24, 0.08) : undefined })
    },

    // 大数字：一个字一块鼓起来的黏土，从 0 滚到目标值，滚完挨个压一下；label 刻在牌上，note 是浅色小纸条；机器人仰头看，滚完跳起来欢呼
    number(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait
      let i = 1
      const il = sc.label ? i++ : -1, inote = sc.note ? i++ : -1
      const rs = E.pick(210, 240) * u, RC = P ? 0 : 400 * u, cw = a.w - RC, cx = P ? E.W / 2 : a.x + cw / 2
      const areaB = P ? S.G - robotH(rs) - 50 * u : S.TOP - 16 * u
      const str = String(sc.value), size0 = E.pick(290, 300) * u, unitW = sz => (sc.unit ? rowWidth(E, sc.unit, sz * 0.32) + 22 * u : 0)
      const f = E.fit(str, { role: 'title', weight: 900, size: size0, maxW: cw * 0.88 - unitW(size0), maxLines: 1, minSize: size0 * 0.3, lineGap: 1 })
      const wNum = rowWidth(E, str, f.size), x0 = cx - (wNum + unitW(f.size)) / 2
      const lab = sc.label && E.fit(sc.label, { role: 'body', weight: 700, size: E.pick(54, 60) * u, maxW: cw * 0.84, maxLines: 2 })
      const note = sc.note && E.fit(sc.note, { role: 'body', weight: 600, size: 38 * u, maxW: cw * 0.8, maxLines: 2 })
      const lp = lab && plaque(E, lab.lines, lab.size, { lineH: lab.lineH, seed: 51 })
      const np = note && plaque(E, note.lines, note.size, { lineH: note.lineH, weight: 600, color: K.paper, ink: K.soft, seed: 52, prints: 0 })
      const hNum = f.size * 1.18, gap = 30 * u
      let y = a.y + (areaB - a.y - hNum - (lp ? lp.h + gap : 0) - (np ? np.h + gap * 0.6 : 0)) / 2
      const rollD = Math.min(1.4, s.dur * 0.35), tDone = s.cue(0) + 0.1 + rollD, pp = popAt(s, 0, 0, 0.5)
      if (P) { prop(ctx, E, 'balls', a.x + a.w * 0.12, S.G, 90 * u, 7); prop(ctx, E, 'blocks', a.x + a.w * 0.86, S.G, 84 * u, 8) }
      else { prop(ctx, E, 'pencil', a.x + a.w * 0.08, S.G + 10 * u, 90 * u, 7); prop(ctx, E, 'plant', a.x + a.w * 0.6, S.G, 90 * u, 8) }
      if (pp.sx > 0) {
        const cy = y + hNum / 2
        ctx.save(); ctx.translate(cx, cy + hNum / 2); ctx.scale(pp.sx, pp.sy); ctx.translate(-cx, -(cy + hNum / 2))
        clayRow(ctx, E, rolling(sc.value, clamp((s.t - s.cue(0) - 0.1) / rollD)), x0 + wNum, cy, f.size, K.accent, { align: 'right', anim: k => squish(s.t, tDone + k * 0.06, 0.14) })
        if (sc.unit) clayRow(ctx, E, sc.unit, x0 + wNum + 22 * u, cy + f.size * 0.2, f.size * 0.32, K.robot, { align: 'left' })
        ctx.restore()
      }
      y += hNum
      if (lp) { show(ctx, E, lp, cx, y + gap + lp.h / 2, popAt(s, il), { seed: 11, rot: 0.01 }); y += gap + lp.h }
      if (np) show(ctx, E, np, cx, y + gap * 0.6 + np.h / 2, popAt(s, inote), { seed: 12, rot: -0.015 })
      const done = after(s.t, tDone), hop = done && s.t < tDone + 0.4 ? Math.sin((s.t - tDone) / 0.4 * Math.PI) * 40 * u : 0
      robot(ctx, E, P ? E.W / 2 : a.x + a.w - RC / 2 + 20 * u, S.G, rs, { t: s.t, mood: done ? 'happy' : 'o', look: P ? 0 : -0.5, turn: P ? 0 : -0.2, seed: 4, jump: hop, armL: done ? cheer(s.t, 0) : 0.35, armR: done ? cheer(s.t, 1) : 0.35, squash: done ? squish(s.t, tDone + 0.4, 0.15) : undefined })
    },

    // 柱状图：一根根黏土柱从桌面鼓起来，最高的（或 highlight 指定的）一根是强调色；柱脚立着刻名字的小牌。
    // 横屏：数字是柱顶的黏土小字，机器人站在右边，强调的那根长好后欢呼。竖屏：数字刻在柱子里，机器人跳到强调的那根柱顶上
    bars(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait, n = sc.items.length
      const top = header(ctx, s, E, sc.title)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const RC = P ? 0 : Math.min(300 * u, a.w * 0.18), rs = P ? 120 * u : Math.min(170 * u, RC * 0.6), cw = a.w - RC, slot = cw / n, bw = Math.round(Math.min(slot * 0.58, 190 * u))
      let vs = E.pick(50, 44) * u
      const widest = Math.max(...vals.map(v => rowWidth(E, formatNumber(v, dec) + unit, vs, 'num')))
      if (widest > slot * 0.9) vs *= slot * 0.9 / widest
      const hMax = S.G - top - vs * 1.4 - (P ? robotH(rs) + 20 * u : 0) - 10 * u
      const LS = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 700, size: E.pick(36, 32) * u, maxW: slot * 0.98 - E.pick(44, 38) * u, maxLines: 2, lineGap: 1.15 })
      const tH = s.cue(hi + 1) + 0.5
      let hiTop = null
      sc.items.forEach((it, i) => {
        if (s.p(i + 1) <= 0) return
        const x = a.x + slot * (i + 0.5), hF = Math.max(24 * u, hMax * vals[i] / max), q = clamp((s.t - s.cue(i + 1)) / 0.5)
        const grow = ease.outBack(q), sq = squish(s.t, s.cue(i + 1) + 0.5, 0.08), hNow = hF * grow * sq.sy
        const sp = blob(E, `bar${i}`, bw, Math.round(hF), Math.min(bw * 0.32, hF / 2), { color: i === hi ? K.accent : K.sky, seed: 400 + i, prints: 2 })
        ground(ctx, x, S.G, bw * 1.6 * Math.min(1, q * 3))
        put(ctx, sp, x, S.G, { ay: 1, sx: sq.sx, sy: grow * sq.sy })
        const vt = formatNumber(vals[i] * ease.out(q), dec) + unit, inside = P && hF >= vs * 2.2
        ctx.save(); ctx.globalAlpha = clamp(q * 2)
        if (inside) engrave(ctx, vt, x, S.G - hNow + vs * 0.95, E.font('num', 800, vs * 0.9), i === hi ? K.on : K.ink)
        else clayValue(ctx, E, formatNumber(vals[i] * ease.out(q), dec), unit, x, S.G - hNow - vs * 0.75, vs, i === hi ? K.accent : K.ink)
        ctx.restore()
        const lf = LS[i], lp = plaque(E, lf.lines, lf.size, { lineH: lf.lineH, seed: 90 + i })
        show(ctx, E, lp, x, S.FRONT + 4 * u - lp.h / 2, pop(s.t, s.cue(i + 1) + 0.1, 0.4), { seed: 60 + i, rot: i % 2 ? 0.02 : -0.02 })
        if (i === hi) hiTop = { x, y: S.G - hNow - (inside ? 0 : vs * 1.45) }
      })
      const done = after(s.t, tH)
      if (!P) {
        const rx = a.x + cw + RC / 2 + 10 * u, hop = done && s.t < tH + 0.4 ? Math.sin((s.t - tH) / 0.4 * Math.PI) * 36 * u : 0
        robot(ctx, E, rx, S.G, rs, { t: s.t, mood: done ? 'happy' : 'neutral', look: -0.5, turn: -0.25, seed: 5, jump: hop, armL: done ? cheer(s.t, 0) : 0.5, armR: done ? cheer(s.t, 1) : 0.35 })
      } else if (hiTop && done) {
        const dd = drop(s.t, tH, 260 * u, 0.3)
        robot(ctx, E, hiTop.x, hiTop.y + dd.dy, rs, { t: s.t, mood: dd.landed ? 'happy' : 'o', seed: 5, a: dd.a, squash: dd, armL: dd.landed ? cheer(s.t, 0) : 1.2, armR: dd.landed ? cheer(s.t, 1) : 1.2 })
      }
    },

    // 流程：一步一个黏土圆台，越往后越高；机器人从一个跳到下一个，跳过的路上留一串小黏土点。
    // 横屏字刻在圆台正面；竖屏圆台排在桌上，字牌在墙上排成一列，编号和圆台对上
    steps(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait, n = sc.items.length
      const top = header(ctx, s, E, sc.title), rs = E.pick(140, 110) * u, rh = robotH(rs)
      const slot = a.w / n, pw = Math.round(Math.min(slot * 0.82, E.pick(360, 210) * u)), badge = Math.round(E.pick(64, 64) * u)
      const xs = sc.items.map((_, i) => a.x + slot * (i + 0.5)), col = i => (i === n - 1 ? K.accent : K.tones[i % 5]), ink = i => (i === n - 1 ? K.on : K.ink)
      let FS = null, hmin, hmax, rowH = 0, listB = 0
      if (!P) {
        FS = fitAll(E, sc.items, { role: 'body', weight: 700, size: 48 * u, maxW: pw * 0.82, maxLines: 3, lineGap: 1.2 })
        hmin = Math.max(...FS.map(f => f.lines.length * f.lineH)) + badge + 70 * u
        hmax = Math.max(hmin, S.G - top - rh - 40 * u)
      } else {
        hmin = 100 * u; hmax = clamp(S.G - top - n * 160 * u - rh - 40 * u, 150 * u, 330 * u); listB = S.G - hmax - rh - 40 * u; rowH = Math.min((listB - top) / n, 200 * u)
        FS = fitAll(E, sc.items, { role: 'body', weight: 700, size: Math.min(56 * u, rowH * 0.38), maxW: a.w - badge - 70 * u, maxLines: 2, maxH: rowH * 0.96 - Math.min(56 * u, rowH * 0.38) * 0.8, lineGap: 1.2 })
      }
      const hs = xs.map((_, i) => Math.round(n > 1 ? lerp(hmin, hmax, i / (n - 1)) : hmax))
      let cur = -1
      sc.items.forEach((it, i) => {
        if (s.p(i + 1) <= 0) return
        cur = i
        const f = FS[i], q = clamp((s.t - s.cue(i + 1)) / 0.45), sq = squish(s.t, s.cue(i + 1) + 0.45, 0.06)
        const dr = drum(E, `st${i}:${P ? '' : f.lines.join('|') + f.size}`, pw, hs[i], col(i), (g, w, hh, ry) => {
          if (P) pressText(g, String(i + 1), w / 2, ry * 2 + (hh - ry * 3) / 2, E.font('num', 900, Math.min(56 * u, (hh - ry * 3) * 0.7)), ink(i))
          else drawLinesPressed(g, f, w / 2, ry * 2 + badge + 16 * u + (hh - ry * 3 - badge - 16 * u) / 2, E, ink(i))
        }, { seed: 70 + i })
        ground(ctx, xs[i], S.G, pw * 1.3 * Math.min(1, q * 3))
        put(ctx, dr.sp, xs[i], S.G, { ay: (hs[i] + dr.ry) / dr.H, sx: sq.sx, sy: ease.outBack(q) * sq.sy })
        if (!P) show(ctx, E, ball(E, `sb${i}:${badge}`, badge, badge, { color: K.cream, seed: 90 + i, deco: (g, w, h) => pressText(g, String(i + 1), w / 2, h / 2 + 2 * u, E.font('num', 900, badge * 0.52), K.ink) }), xs[i], S.G - hs[i] + dr.ry + badge / 2 + 8 * u, pop(s.t, s.cue(i + 1) + 0.25, 0.4), { seed: 30 + i })
        else {
          // 墙上的一行：编号球（和圆台同色）+ 刻字牌
          const cy = top + (listB - top - rowH * n) / 2 + rowH * (i + 0.5), dd = dropAt(s, i + 1, E, 46)
          const sp = plaque(E, f.lines, f.size, { lineH: f.lineH, align: 'left', padX: badge * 0.3 + f.size * 0.5, minH: badge * 0.9, seed: 44 + i })
          put(ctx, sp, a.x + badge * 0.7 + sp.w / 2, cy + dd.dy, { sx: dd.sx, sy: dd.sy, a: dd.a })
          put(ctx, ball(E, `sl${i}:${badge}`, badge, badge, { color: col(i), seed: 96 + i, deco: (g, w, h) => pressText(g, String(i + 1), w / 2, h / 2 + 2 * u, E.font('num', 900, badge * 0.52), ink(i)) }), a.x + badge / 2, cy + dd.dy, { sx: dd.sx, sy: dd.sy, a: dd.a })
        }
      })
      if (cur < 0) return
      // 机器人：先掉到第一个圆台上，之后每出一个新圆台就跳过去
      const tops = xs.map((x, i) => [x, S.G - hs[i]]), hd = 0.42, tj = s.cue(cur + 1) + 0.3
      const arc = (j, q) => { const [x0, y0] = tops[j], [x1, y1] = tops[j + 1]; return [lerp(x0, x1, ease.inOut(q)), lerp(y0, y1, q) - Math.sin(Math.PI * q) * (90 * u + Math.abs(y1 - y0) * 0.6)] }
      for (let j = 0; j < cur; j++) {
        const qq = j < cur - 1 ? 1 : clamp((s.t - tj) / hd)
        for (let k = 1; k < 6; k++) if (k / 6 < qq) { const [x, y] = arc(j, k / 6); put(ctx, ball(E, 'trail', Math.round(16 * u), Math.round(14 * u), { color: K.cream, seed: 120 + k, prints: 0 }), x, y - rh * 0.1, { a: 0.75 }) }
      }
      const last = cur === n - 1, q = cur === 0 ? 1 : clamp((s.t - tj) / hd)
      let x, y, o = { t: s.t, seed: 6, mood: 'happy', look: 0.3, armL: 0.4, armR: 0.4 }
      if (cur === 0) { const d = drop(s.t, tj - 0.05, 300 * u, 0.3); [x, y] = tops[0]; y += d.dy; Object.assign(o, { squash: d, a: d.a }) }
      else if (q < 1 && s.t >= tj) { [x, y] = arc(cur - 1, q); Object.assign(o, { mood: 'o', turn: 0.6, armL: 2.3, armR: 2.3 }) }
      else if (s.t < tj) [x, y] = tops[cur - 1]
      else { [x, y] = tops[cur]; o.squash = squish(s.t, tj + hd, 0.18) }
      if (last && s.t >= tj + hd) Object.assign(o, { armL: cheer(s.t, 0), armR: cheer(s.t, 1) })
      robot(ctx, E, x, y, rs, o)
    },

    // 对比：两只表情不同的机器人各举一块牌子。左边奶油色、机器人发愁挠头冒汗；右边是推荐的一方，强调色牌子、机器人开心地蹦，牌角一个勾。
    // 横屏：牌子挂在杆子上，机器人站在外侧握着杆子；竖屏：两块牌子并排，机器人在下面举着
    compare(ctx, s, E) {
      // 内容区不够宽（竖屏、方形）时用竖屏的摆法
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait || a.w / a.h < 1.5
      const top = header(ctx, s, E, sc.title), rs = E.pick(150, 140) * u, rh = robotH(rs), gap = E.pick(70, 40) * u, RW = P ? 0 : rs * 1.25
      const bw = Math.round((a.w - gap) / 2 - RW + (P ? 0 : 26 * u)), avail = P ? S.G - rh - 50 * u - top : S.TOP - 26 * u - top, pad = E.pick(40, 34) * u
      const sides = [sc.left, sc.right], nL = (sc.left.items || []).length
      const TF = sides.map(sd => E.fit(sd.title, { role: 'title', weight: 800, size: E.pick(54, 52) * u, maxW: bw - pad * 2 - 70 * u, maxLines: 2, lineGap: 1.15 }))
      const iy0 = pad + Math.max(...TF.map(f => f.lines.length * f.lineH)) + 28 * u, nMax = Math.max(1, ...sides.map(sd => (sd.items || []).length))
      const rowH = Math.min((avail - iy0 - pad) / nMax, E.pick(130, 160) * u), all = sides.flatMap(sd => sd.items || [])
      const FS = all.length ? fitAll(E, all, { role: 'body', weight: 600, size: Math.min(E.pick(44, 46) * u, rowH * 0.42), maxW: bw - pad * 2 - 34 * u, maxLines: 2, maxH: rowH * 0.94, lineGap: 1.2 }) : []
      const bh = Math.round(Math.min(avail, iy0 + rowH * nMax + pad)), by = top + (avail - bh) * (P ? 0.7 : 0)
      sides.forEach((sd, i) => {
        if (s.p(i + 1) <= 0) return
        const strong = i === 1, ink = strong ? K.on : K.ink, color = strong ? K.accent : K.cream, fs = i ? FS.slice(nL) : FS.slice(0, nL), tf = TF[i]
        const x0 = P ? a.x + i * (bw + gap) : i ? a.x + a.w / 2 + gap / 2 : a.x + RW - 26 * u, cx = x0 + bw / 2
        const poleX = P ? cx : i ? x0 + bw - 26 * u : x0 + 26 * u, rx = P ? cx : i ? a.x + a.w - RW * 0.45 : a.x + RW * 0.45
        const board = sprite(E, `cmp${i}:${sd.title}:${fs.map(f => f.lines.join('|')).join('/')}:${bw}x${bh}:${color}`, bw, bh, g => { pathPts(g, rrPts(0, 0, bw, bh, 40 * u, 140 + i)); g.fill() }, {
          color, shadow: true, seed: 140 + i, prints: 3, deco: (g, w) => {
            const tfont = E.font('title', 800, tf.size)
            tf.lines.forEach((ln, k) => pressText(g, ln, pad, pad + k * tf.lineH + tf.lineH / 2, tfont, ink, 'left'))
            g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(80,40,30,0.16)'; g.fillRect(pad, iy0 - 14 * u, w - pad * 2, 4 * u); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(pad, iy0 - 10 * u, w - pad * 2, 2 * u)
            fs.forEach((f, k) => {
              const cy = iy0 + rowH * (k + 0.5), bfont = E.font('body', 600, f.size)
              g.fillStyle = 'rgba(80,40,30,0.3)'; g.beginPath(); g.arc(pad + 10 * u, cy + 1.5 * u, 8 * u, 0, Math.PI * 2); g.fill()
              f.lines.forEach((ln, j) => pressText(g, ln, pad + 34 * u, cy + (j - (f.lines.length - 1) / 2) * f.lineH, bfont, ink, 'left'))
            })
          },
        })
        const rp = popAt(s, i + 1, 0, 0.45), bp = popAt(s, i + 1, 0.15, 0.5), bo = boil(E.T, 50 + i, 0.8 * u), pa = clamp(bp.p * 3)
        if (bp.sx > 0) {
          // 杆子：横屏立在桌上、杆头一颗小球；竖屏从牌子底下伸到机器人头后
          const yTop = P ? by + bh - 20 * u : by - 26 * u, yBot = P ? S.G - rs * 0.8 : S.G - 4 * u
          if (!P) ground(ctx, poleX, S.G, 60 * u, pa)
          noodle(ctx, g => { g.beginPath(); g.moveTo(poleX, yTop); g.lineTo(poleX, yBot) }, K.table, 18 * u, pa)
          if (!P) put(ctx, ball(E, 'finial', Math.round(36 * u), Math.round(36 * u), { color: K.accent, seed: 150 }), poleX, yTop, { a: pa })
          const ox = P ? cx : i ? x0 + bw : x0
          put(ctx, board, ox + bo.x, by + bh + bo.y, { ax: P ? 0.5 : i ? 1 : 0, ay: 1, sx: bp.sx, sy: bp.sy, rot: (strong ? 0.01 : -0.01) + bo.r })
        }
        // 握杆的那只手伸向杆子；另一只手：发愁的挠头，开心的挥
        const k = rs / 300, hy = S.G - rs * 0.95, ps = i ? -1 : 1, reach = clamp(Math.hypot(poleX - (rx + ps * 88 * k), hy - (S.G - 128 * k)) / (80 * k), 0.8, 1.9)
        const grip = P ? 2.75 : armTo(rx, S.G, rs, ps, poleX, hy), other = P ? 2.75 : strong ? cheer(s.t, i) : 2.95 + Math.sin(s.t * 14) * 0.08
        const bounce = strong && s.t > s.cue(i + 1) + 0.6 ? Math.abs(Math.sin((s.t - s.cue(i + 1)) * 5)) * 14 * u : 0
        const arms = ps > 0 ? { armR: grip, reachR: P ? 1.1 : reach, armL: other, reachL: 1.1 } : { armL: grip, reachL: P ? 1.1 : reach, armR: other, reachR: 1.1 }
        robot(ctx, E, rx, S.G, rs, { t: s.t, seed: 7 + i, mood: strong ? 'happy' : 'worried', sweat: strong ? 0 : 1, look: strong ? -0.4 : 0.4, turn: strong ? -0.15 : 0.15, tilt: strong ? 0 : -0.04, jump: bounce, squash: rp.p < 1 ? { sx: rp.sx, sy: rp.sy } : undefined, ...arms })
        if (strong) check(ctx, E, x0 + bw - pad - 34 * u, by + pad + 30 * u, 70 * u, clamp((s.t - s.cue(i + 1) - 0.6) / 0.3), K.green)
      })
    },

    // 引语：机器人张嘴说话，话在一个黏土气泡里，气泡尾巴指向它；角上一对强调色的黏土引号；出处刻在桌上立着的小牌上
    quote(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait
      const rs = E.pick(230, 220) * u, rh = robotH(rs), pad = E.pick(60, 52) * u, rx = P ? a.x + a.w * 0.28 : a.x + a.w * 0.12
      const byf = sc.by && E.fit(sc.by, { role: 'body', weight: 700, size: 38 * u, maxW: E.pick(a.w * 0.36, a.w * 0.5), maxLines: 1 })
      const tag = byf && plaque(E, byf.lines, byf.size, { color: K.sky, seed: 71 })
      const bx0 = P ? a.x : a.x + a.w * 0.27, bx1 = a.x + a.w, by1 = (P ? S.G - rh - 70 * u : S.G - 150 * u - (tag ? tag.h : 0)) - 50 * u
      const f = E.fit(sc.text, { role: 'title', weight: 700, size: E.pick(78, 70) * u, maxW: Math.min(bx1 - bx0, E.pick(1100, 900) * u) - pad * 2, maxLines: E.pick(5, 7), maxH: by1 - a.y - pad * 2, lineGap: 1.36 })
      const bw = Math.round(Math.max(f.width + pad * 2, (bx1 - bx0) * 0.45)), bh = Math.round(f.lines.length * f.lineH + pad * 2)
      const L = Math.round(bx0 + (bx1 - bx0 - bw) * E.pick(0.25, 0.5)), T = Math.round(a.y + (by1 - a.y - bh) * E.pick(0.5, 0.72))
      const tip = P ? [rx + rs * 0.45, S.G - rs * 1.42] : [rx + rs * 0.62, S.G - rs * 1.15], bx = P ? L + bw * 0.22 : L + 70 * u
      const mx = Math.min(L, tip[0] - 10 * u), my = T, w = Math.round(L + bw - mx), h = Math.round(Math.max(T + bh, tip[1] + 10 * u) - my)
      const font = E.font('title', 700, f.size)
      const bub = sprite(E, `bub:${f.lines.join('|')}:${f.size}:${w}x${h}:${L - mx}`, w, h, g => {
        pathPts(g, rrPts(L - mx, 0, bw, bh, 50 * u, 73)); g.fill()
        pathPts(g, polyPts([[bx - mx - 55 * u, bh - 30 * u], [bx - mx + 55 * u, bh - 30 * u], [tip[0] - mx, tip[1] - my]], 12 * u, 74)); g.fill()
      }, { color: K.cream, shadow: true, seed: 73, prints: 3, deco: g => f.lines.forEach((ln, k) => pressText(g, ln, L - mx + bw / 2, pad + k * f.lineH + f.lineH / 2 + f.size * 0.03, font, K.ink)) })
      const pp = popAt(s, 0, 0, 0.5)
      if (!P) prop(ctx, E, 'plant', a.x + a.w * 0.93, S.G, 90 * u, 9)
      if (tag) {
        const tx = P ? a.x + a.w * 0.74 : L + bw * 0.6, ty = S.G - 110 * u, tp = popAt(s, 1)
        stand(ctx, E, tx, ty + tag.h / 2 - 6 * u, S.G, clamp(tp.p * 3))
        show(ctx, E, tag, tx, ty, tp, { seed: 13, rot: 0.02 })
      }
      show(ctx, E, bub, tip[0], tip[1], pp, { ax: (tip[0] - mx) / w, ay: (tip[1] - my) / h, seed: 14 })
      show(ctx, E, quoteMark(E, Math.round(110 * u), K.accent), L + 16 * u, T + 6 * u, popAt(s, 0, 0.2, 0.4), { seed: 15, rot: -0.12 })
      const talking = s.p(0) > 0 && s.t < s.cue(0) + Math.min(2.4, s.dur * 0.55)
      robot(ctx, E, rx, S.G, rs, { t: s.t, seed: 8, mood: talking ? (Math.floor(s.t * 7) % 2 ? 'o' : 'neutral') : s.p(0) > 0 ? 'happy' : 'neutral', look: 0.5, turn: 0.2, armR: talking ? 1.5 + Math.sin(s.t * 5) * 0.3 : 0.4, armL: 0.35 })
    },

    // 片尾：浅蓝黏土大字掉下来，副标题刻字牌，按钮是一块强调色黏土，隔一会儿压一下；彩色黏土小球落下，机器人挥手
    end(ctx, s, E) {
      const a = E.L.box, u = E.u, K = pal(E), S = stageLay(E), sc = s.scene, P = E.portrait
      let i = 0
      const it = i++, is = sc.subtitle ? i++ : -1, ic = sc.cta ? i++ : -1
      const rs = E.pick(200, 250) * u, rx = P ? a.x + a.w * 0.5 : a.x + a.w * 0.88
      const areaB = P ? S.G - robotH(rs) - 50 * u : S.TOP - 20 * u, tw = P ? a.w : a.w * 0.76, cx = P ? E.W / 2 : a.x + a.w * 0.39
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(128, 140) * u, maxW: tw * 0.9, maxLines: 3, lineGap: 1.2, oneLine: true })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 700, size: E.pick(48, 46) * u, maxW: tw * 0.84, maxLines: 2 })
      const cta = sc.cta && E.fit(sc.cta, { role: 'body', weight: 800, size: 48 * u, maxW: tw * 0.6, maxLines: 1 })
      const sp = sub && plaque(E, sub.lines, sub.size, { lineH: sub.lineH, seed: 35 })
      const bt = cta && plaque(E, cta.lines, cta.size, { weight: 800, color: K.accent, ink: K.on, padX: cta.size * 1.2, padY: cta.size * 0.55, seed: 77 })
      const gap = 34 * u, hT = big.lines.length * big.lineH, tl = s.cue(it) + 0.45
      let y = a.y + (areaB - a.y - hT - (sp ? sp.h + gap : 0) - (bt ? bt.h + gap * 1.4 : 0)) / 2
      if (P) { prop(ctx, E, 'balls', a.x + a.w * 0.1, S.G, 90 * u, 10); prop(ctx, E, 'plant', a.x + a.w * 0.88, S.G, 90 * u, 11) }
      else { prop(ctx, E, 'balls', a.x + a.w * 0.06, S.G, 100 * u, 10); prop(ctx, E, 'plant', a.x + a.w * 0.68, S.G, 96 * u, 11) }
      // 落下来的彩色黏土小球（在字后面）
      for (let k = 0; k < 18; k++) {
        const t0 = tl + E.hash(k, 3) * 1.2, q = s.t - t0
        if (q < 0 || q > 2.4) continue
        const x = a.x + E.hash(k, 1) * a.w + Math.sin(q * 3 + k) * 14 * u, yy = a.y - 60 * u + q * (380 + E.hash(k, 2) * 260) * u
        put(ctx, ball(E, `cf${k % 5}`, Math.round((18 + (k % 3) * 6) * u), Math.round((14 + (k % 3) * 5) * u), { color: K.tones[k % 5], seed: 200 + k, prints: 0 }), x, yy, { rot: q * 3 + k, a: clamp((2.4 - q) / 0.5) })
      }
      dropTitle(ctx, s, E, big, it, cx, y, K.robot)
      y += hT
      if (sp) { show(ctx, E, sp, cx, y + gap + sp.h / 2, popAt(s, is), { seed: 16 }); y += gap + sp.h }
      if (bt) {
        const tc = s.cue(ic) + 0.45, pulse = s.t > tc ? squish(s.t, tc + Math.floor((s.t - tc) / 1.1) * 1.1, 0.07) : { sx: 1, sy: 1 }, pp = popAt(s, ic)
        show(ctx, E, bt, cx, y + gap * 1.4 + bt.h / 2, pp.p < 1 ? pp : { ...pulse, a: 1 }, { seed: 17 })
      }
      robot(ctx, E, rx, S.G, rs, { t: s.t, seed: 9, mood: 'happy', look: P ? 0 : -0.4, turn: P ? 0 : -0.2, armR: wave(s.t, 0.2), armL: after(s.t, tl) ? 0.6 : 0.35, squash: squish(s.t, tl, 0.1) })
    },
  },

  // 字幕：每段一块刻字的奶油色黏土牌，立在桌子的前立面上，换段时轻轻压一下
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const { W, H, u } = E, K = pal(E)
    const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((x, y) => x + y, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const a = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
    const size = E.pick(42, 46) * u
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 700, size, maxW: W - E.safe.l * 2 - size * 1.5, maxLines: 2, lineGap: 1.3, quiet: true })
    const sp = plaque(E, f.lines, f.size, { lineH: f.lineH, color: K.cream, padX: f.size * 0.75, padY: f.size * 0.38, seed: 3, prints: 1 })
    const q = Math.max(0, s.t - t0 + 0.12), w = Math.exp(-q * 9) * Math.sin(q * 30) * 0.05, k = 0.94 + 0.06 * ease.out(a)
    put(ctx, sp, W / 2, H - E.captionH / 2 - (E.portrait ? 30 * u : 0), { sx: k * (1 + w), sy: k * (1 - w), a })
  },

  // 最上层：一圈很淡的暖色暗角，像台灯照着桌面
  overlay(ctx, E) {
    const { W, H } = E, g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62)
    g.addColorStop(0, 'rgba(110,60,40,0)'); g.addColorStop(1, 'rgba(110,60,40,0.12)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  },

  // 转场：下一场在一团手捏的不规则圆里从画面中间压开，边上带投影和一道亮脊；上一场被挤得微微鼓起（原样片是往里缩，缩了会露出画布边）
  transitionDur: 0.5,
  transition(ctx, A, B, p, E) {
    const e = ease.inOut(p), { W, H, u } = E, cx = W / 2, cy = H * (E.portrait ? 0.45 : 0.5), R = Math.hypot(W, H) * 0.62 * e, sq = 1 + 0.03 * Math.sin(p * Math.PI)
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sq, sq); ctx.translate(-cx, -cy); ctx.drawImage(A, 0, 0); ctx.restore()
    if (R < 2) return
    const pts = ellPts(cx, cy, R, R, 3 + Math.floor(p * 6), 1.6)
    ctx.save(); ctx.shadowColor = 'rgba(110,55,35,0.35)'; ctx.shadowBlur = 30 * u; ctx.shadowOffsetY = 10 * u; pathPts(ctx, pts); ctx.fillStyle = '#000'; ctx.globalAlpha = 0.25; ctx.fill(); ctx.restore()
    const zs = 1.04 - 0.04 * e
    ctx.save(); pathPts(ctx, pts); ctx.clip(); ctx.translate(cx, cy); ctx.scale(zs, zs); ctx.translate(-cx, -cy); ctx.drawImage(B, 0, 0); ctx.restore()
    ctx.save(); ctx.translate(-3 * u, -4 * u); pathPts(ctx, pts); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 6 * u; ctx.stroke(); ctx.restore()
  },

  // 默认版式会调用的零件（九种版式都重画了，这些只在别处借用默认摆法时用到）：黏土卡片、黏土条、黏土柱、黏土球
  card(ctx, E, x, y, w, h, o = {}) { put(ctx, blob(E, 'card', Math.round(w), Math.round(h), this.radius * E.u, { color: o.tone === 'accent' ? this.c.accent : this.c.card, shadow: true, seed: o.seed ?? 5 }), x, y, { ax: 0, ay: 0 }) },
  line(ctx, E, x1, y1, x2, y2, o = {}) { noodle(ctx, g => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(lerp(x1, x2, o.p ?? 1), lerp(y1, y2, o.p ?? 1)) }, o.color ?? this.c.accent, (o.width ?? 4) * 2.5 * E.u) },
  bar(ctx, E, x, y, w, h, o = {}) { if (w > 1 && h > 1) put(ctx, blob(E, 'bar', Math.round(w), Math.round(h), Math.min(w, h) * 0.3, { color: o.color ?? this.c.accent, seed: o.seed ?? 6 }), x, y, { ax: 0, ay: 0 }) },
  mark(ctx, E, x, y, r, i, o = {}) { put(ctx, ball(E, 'mark', Math.round(r * 2), Math.round(r * 2), { color: o.color ?? this.c.accent, seed: 7 + i }), x, y) },
  underline(ctx, E, x, y, w, p) { this.line(ctx, E, x, y, x + w, y, { p, width: 5 }) },

  music: { style: 'bright', prog: ['C', 'Am', 'F', 'G'], lead: 'pluck', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'thud' },
  // 几个关键时刻：大字落地、数字滚完、强调的柱子长好、机器人跳上最后一个圆台
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const sc = S.scene, at = (t, kind, gain) => out.push({ t: S.t0 + t, kind, gain })
      if (S.layout === 'title') at(S.cues[sc.kicker ? 1 : 0] + 0.45, 'chime', 0.22)
      if (S.layout === 'end') at(S.cues[0] + 0.45, 'chime', 0.22)
      if (S.layout === 'number') at(S.cues[0] + 0.1 + Math.min(1.4, S.dur * 0.35), 'chime', 0.25)
      if (S.layout === 'bars') { const v = sc.items.map(it => Number(it.value)), hi = sc.highlight != null ? sc.highlight - 1 : v.indexOf(Math.max(...v)); at(S.cues[hi + 1] + 0.5, 'thud', 0.3) }
      if (S.layout === 'steps') at(S.cues[S.cues.length - 1] + 0.72, 'chime', 0.2)
    }
    return out
  },
}

// 把 E.fit 排好的几行字刻进贴图，(x, cy) 是这几行的中心
function drawLinesPressed(g, f, x, cy, E, ink) {
  const font = E.font('body', 700, f.size)
  f.lines.forEach((ln, j) => pressText(g, ln, x, cy + (j - (f.lines.length - 1) / 2) * f.lineH, font, ink))
}
