// 风格包：综艺花字（variety）。移植自风格库的 J-综艺花字：高饱和渐变底上转着放射线、飘着波点，
// 字是多层描边的花字，配贴纸、贴条、爆炸框、彩纸和一个软糖吉祥物；顶部一条弹幕，字只来自这一场的 s.scene。
// 换场是十二角星爆开。九种版式见 NOTES.md。
import { P, setPal, put, shake, hz, hzLines, label, inkLines, sticker, pill, tape, rays, speedLines, sparkle, twinkles, boom, confetti, ring, fatLine, arrow, badge, bubble, podium } from './lib/fx.mjs'
import { mascot } from './lib/mascot.mjs'
import { drawBg, danmu, caption, starWipe } from './lib/stage.mjs'
import { formatNumber, decimalsOf, rgba, mix } from '../../core.mjs'
import { rolling } from '../../layouts.mjs'

// 几段字用同一个字号（取各自能放下的最小字号）
function fitAll(E, texts, opt) {
  const size = Math.min(...texts.map(t => E.fit(t, opt).size))
  return texts.map(t => E.fit(t, { ...opt, size }))
}
// 吉祥物：脚踩在 (x, feet)，掉进来
function buddy(ctx, E, dt, x, feet, size, o = {}) {
  put(ctx, E, dt, { kind: 'drop', x, y: feet - size * 0.54, wob: 0, seed: 5 }, c => mascot(c, E, E.T, { s: size, ...o }))
}
// 事件以后 0.6 秒内的速度线强度
const burst = dt => (dt >= 0 && dt < 0.6 ? 1 - dt / 0.6 : 0)
// 吉祥物伸手指向 (tx, ty) 的角度
const aimAt = (x, feet, size, tx, ty) => Math.atan2(ty - (feet - size * 0.46), tx - x)
// 指向时手臂伸多长：目标近时缩短，免得手压到字上
const reachTo = (x, feet, size, tx, ty) => Math.max(size * 0.3, Math.min(size * 0.7, Math.hypot(tx - x, ty - feet + size * 0.46) - size * 0.55))
// 吉祥物占的框和字的框相交时先缩小，再不行就不画：热闹归热闹，字是主角
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
function fitBuddy(x, feet, size, boxes) {
  for (const k of [1, 0.75]) { const m = { x: x - size * k * 0.75, y: feet - size * k * 1.4, w: size * k * 1.5, h: size * k * 1.4 }; if (!boxes.some(b => hit(m, b))) return size * k }
  return 0
}

// 场标题：一行花字，横屏靠左、竖屏居中。返回下面可用区域的 y
function heading(ctx, s, E, text) {
  const B = E.L.box, u = E.u
  if (!text) return B.y
  const f = E.fit(text, { role: 'title', weight: 900, size: E.pick(76, 70) * u, maxW: B.w * 0.9, maxLines: 2, lineGap: 1.15, oneLine: true })
  hzLines(ctx, E, f, E.portrait ? E.W / 2 : B.x + f.size * 0.12, B.y, { align: E.portrait ? 'center' : 'left', t: s.t - s.cue(0), anim: 'pop', stagger: 0.03, fill: [P.white, P.yellow], outer: P.purple })
  return B.y + f.lines.length * f.lineH + 24 * u
}

// 柱子：硬投影、深色描边、左侧一道高光
function barShape(ctx, E, x, y, w, h, col, horiz = false) {
  const u = E.u, r = Math.min(14 * u, w / 2, h / 2)
  ctx.save()
  ctx.fillStyle = P.ink; E.roundRect(ctx, x + 7 * u, y + 7 * u, w, h, r); ctx.fill()
  ctx.fillStyle = col; E.roundRect(ctx, x, y, w, h, r); ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.fillStyle = rgba(P.white, 0.35)
  if (horiz) ctx.fillRect(x + r, y + h * 0.14, Math.max(0, w - r * 2), h * 0.14)
  else ctx.fillRect(x + w * 0.13, y + r, w * 0.12, Math.max(0, h - r * 2))
  ctx.restore()
}

// 弹幕里飘什么：这一场自己的字，每条带它跟着第几个元素出现
function danmuList(sc, layout) {
  const L = [], add = (t, i) => { if (t) L.push({ str: String(t), i }) }
  switch (layout) {
    case 'title': { let i = 0; if (sc.kicker) add(sc.kicker, i++); add(sc.title, i++); add(sc.subtitle, i); break }
    case 'statement': add(sc.highlight, 0); add(sc.text, 0); break
    case 'bullets': case 'steps': add(sc.title, 0); sc.items.forEach((it, k) => add(it, k + 1)); break
    case 'bars': add(sc.title, 0); sc.items.forEach((it, k) => add(`${it.label} ${formatNumber(it.value, decimalsOf(it.value))}${sc.unit || ''}`, k + 1)); break
    case 'number': add(String(sc.value) + (sc.unit || ''), 0); add(sc.label, 1); add(sc.note, sc.label ? 2 : 1); break
    case 'compare': add(sc.title, 0); [sc.left, sc.right].forEach((d, k) => { add(d.title, k + 1); (d.items || []).forEach(t => add(t, k + 1)) }); break
    case 'quote': add(sc.text, 0); add(sc.by, 1); break
    case 'end': { let i = 0; add(sc.title, i++); if (sc.subtitle) add(sc.subtitle, i++); add(sc.cta, i); break }
  }
  return L
}

const stripCols = () => [P.purple, P.hot, P.blue, P.orange, mix(P.purple, P.hot, 0.5), mix(P.blue, P.cyan, 0.4)]

export default {
  name: '综艺花字', mood: '综艺节目式的热闹：花字、贴条、爆炸框、吉祥物、弹幕', bpm: 128,
  c: { bg: '#ff4f9a', fg: '#ffffff', muted: '#22d9ff', accent: '#ffe11a', accent2: '#8a46ff', card: '#ffffff', line: '#25124d', onAccent: '#25124d' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 900, wBody: 800, radius: 26,
  motion: 'pop', solidAccent: true,
  transitionDur: 0.5,
  transition(ctx, A, B, p, E, info) { starWipe(ctx, A, B, p, E, info, this.c) },
  bg(ctx, E, s) { drawBg(ctx, E, s, this.c) },

  layouts: {
    // 片头：放射线亮起，标题逐字砸下（多层描边花字），落地时一圈冲击环和彩纸；kicker 是深色胶囊贴纸，副标题是白贴纸；吉祥物欢呼
    title(ctx, s, E) {
      setPal(this.c)
      const u = E.u, W = E.W, B = E.L.box, sc = s.scene, por = E.portrait
      let n = 0
      const ik = sc.kicker ? n++ : -1, it = n++, is = sc.subtitle ? n : -1
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(166, 160) * u, maxW: B.w * 0.86, maxLines: por ? 4 : 2, lineGap: 1.14, oneLine: true })
      const kick = sc.kicker ? E.fit(sc.kicker, { role: 'body', weight: 900, size: 44 * u, maxW: B.w * 0.6, maxLines: 1 }) : null
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 900, size: E.pick(50, 46) * u, maxW: B.w * E.pick(0.6, 0.78), maxLines: 2, lineGap: 1.22 }) : null
      const ms = E.pick(190, 240) * u, mh = por ? ms * 1.45 + 30 * u : 0
      const hK = kick ? kick.size * 1.62 + 40 * u : 0, hT = big.lines.length * big.lineH, subH = sub ? sub.lines.length * sub.lineH + 36 * u : 0, hS = sub ? subH + 48 * u : 0
      let y = B.y + (B.h - mh - hK - hT - hS) / 2
      const cy = y + hK + hT / 2, tt = s.t - s.cue(it), land = tt - 0.13 - ([...big.lines.join('')].length - 1) * 0.05
      rays(ctx, E, W / 2, cy, 18, E.T * 0.25, rgba(P.yellow, 0.2 * E.clamp((tt + 0.1) / 0.3)))
      ring(ctx, E, land, W / 2, cy, B.w * 0.55, { lw: 18 })
      speedLines(ctx, E, burst(land), { seed: 2 })
      if (kick) put(ctx, E, s.t - s.cue(ik), { kind: 'drop', x: W / 2, y: y + kick.size * 0.81, rot: -0.04, seed: 2 }, c => pill(c, E, kick.lines[0], kick.size, { fill: P.ink, color: P.yellow }))
      y += hK
      hzLines(ctx, E, big, W / 2, y, { t: tt, anim: 'slam', stagger: 0.05, bob: 2 * u, fill: [P.white, P.yellow], outer: P.purple })
      twinkles(ctx, E, land, W / 2, cy, big.width * 0.56, hT * 0.6 + 30 * u, 6, { seed: 3, size: 32 })
      confetti(ctx, E, land, W / 2, cy, { n: 44, seed: 4, speed: 1300 })
      const boxes = [{ x: W / 2 - big.width / 2 - big.size * 0.15, y, w: big.width + big.size * 0.3, h: hT }]
      y += hT + 48 * u
      if (sub) {
        boxes.push({ x: W / 2 - sub.width / 2 - 50 * u, y, w: sub.width + 100 * u, h: subH + 10 * u })
        put(ctx, E, s.t - s.cue(is), { kind: 'up', x: W / 2, y: y + subH / 2, rot: 0.015, seed: 4 }, c => {
          sticker(c, E, sub.width + 70 * u, subH, { fill: P.card, r: 22 })
          inkLines(c, E, sub, 0, -subH / 2 + 18 * u)
        })
      }
      const bx = por ? W / 2 : B.x + B.w - ms * 0.5, feet = por ? B.y + (B.h + mh + hK + hT + hS) / 2 : B.y + B.h, mz = por ? ms : fitBuddy(bx, feet, ms, boxes)
      if (mz) buddy(ctx, E, tt - 0.3, bx, feet, mz, { mood: land > 0 ? 'cheer' : 'happy', bump: land })
    },

    // 一句大字：白芯深边的花字逐字弹出，高亮词换成黄橙渐变、粉边、白宽边的花字并上下跳；「划重点」贴条拍在字块左上角
    statement(ctx, s, E) {
      setPal(this.c)
      const u = E.u, W = E.W, B = E.L.box, sc = s.scene, por = E.portrait
      const ms = E.pick(170, 190) * u, mh = por ? ms * 1.45 + 40 * u : 0, tapeH = 70 * u
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(116, 100) * u, maxW: B.w * (E.W / E.H < 1.5 ? 0.88 : 0.74), maxLines: por ? 6 : 4, lineGap: 1.32, maxH: (B.h - mh - tapeH) * 0.92 })
      const chars = [...f.lines.join('')], hl = [...String(sc.highlight || '')]
      let hs = -1
      for (let i = 0; hl.length && i + hl.length <= chars.length; i++) if (hl.every((ch, j) => chars[i + j] === ch)) { hs = i; break }
      const hT = f.lines.length * f.lineH, y0 = B.y + tapeH + (B.h - mh - hT - tapeH) / 2
      const tt = s.t - s.cue(0), done = tt - 0.3 - chars.length * 0.035
      hzLines(ctx, E, f, W / 2, y0, {
        t: tt, anim: 'pop', stagger: 0.035, fill: [P.white, mix(P.white, P.cyan, 0.3)], outer: P.ink, rim: null, outW: 0.13,
        alt: k => (hs >= 0 && k >= hs && k < hs + hl.length ? { fill: [P.yellow, P.orange], outer: P.purple, rim: P.white, rimW: 0.26, outW: 0.12, bob: 3 * u } : null),
      })
      speedLines(ctx, E, burst(done), { seed: 4 })
      twinkles(ctx, E, done, W / 2, y0 + hT / 2, f.width * 0.55, hT * 0.5 + 30 * u, 5, { seed: 8, size: 28 })
      put(ctx, E, tt - 0.35, { kind: 'slam', x: W / 2 - f.width / 2 + 60 * u, y: y0 - 24 * u, rot: -0.08, seed: 6 }, c => tape(c, E, '划重点', 46 * u))
      const bx = por ? W / 2 : B.x + B.w - ms * 0.45, feet = por ? y0 + hT + mh : B.y + B.h, mz = por ? ms : fitBuddy(bx, feet, ms, [{ x: W / 2 - f.width / 2 - f.size * 0.1, y: y0 - tapeH, w: f.width + f.size * 0.2, h: hT + tapeH }])
      if (mz) buddy(ctx, E, tt - 0.2, bx, feet, mz, { mood: done > 0 ? 'smug' : 'shock', bump: done, look: -1 })
    },

    // 要点：一条一张花字贴条，从左右两边轮流甩进来，左端压一个编号徽章；要点少时吉祥物在一旁指着最新的一条
    bullets(ctx, s, E) {
      setPal(this.c)
      const u = E.u, W = E.W, B = E.L.box, sc = s.scene, por = E.portrait, n = sc.items.length
      const top = heading(ctx, s, E, sc.title)
      const withBuddy = por ? n <= 3 : n <= 4, ms = 200 * u
      const rw = withBuddy && !por ? 300 * u : 0, rb = withBuddy && por ? ms * 1.45 : 0
      const avail = B.y + B.h - top - rb, rowH = Math.min(avail / n, E.pick(165, 170) * u), h = rowH * 0.74
      const br = Math.min(h * 0.42, 40 * u), padL = br + 34 * u, padR = 36 * u, x0 = B.x + br + 8 * u
      const FS = fitAll(E, sc.items, { role: 'title', weight: 900, size: Math.min(E.pick(64, 52) * u, h * 0.5), maxW: B.w - rw - padL - padR - br - 60 * u, maxLines: 2, maxH: h * 0.86, lineGap: 1.12 })
      const y0 = top + (avail - rowH * n) / 2, cols = stripCols()
      let last = -1, lx = 0, ly = 0
      sc.items.forEach((it, i) => {
        const f = FS[i], dt = s.t - s.cue(i + 1), sw = f.width + padL + padR, cy = y0 + rowH * i + rowH / 2, x = x0 + (por ? 0 : (i % 2) * 40 * u)
        if (dt >= 0) { last = i; lx = x + sw; ly = cy }
        put(ctx, E, dt, { kind: i % 2 ? 'right' : 'left', x: x + sw / 2, y: cy, rot: i % 2 ? 0.012 : -0.012, wob: 0.5, seed: 10 + i }, c => {
          sticker(c, E, sw, h, { fill: cols[i % cols.length], r: h * 0.3 / u, border: 6, sh: 8 })
          c.save(); c.translate(-sw / 2, 0); badge(c, E, br, P.yellow); label(c, E, String(i + 1), 0, 2 * u, br * 1.15, { fill: P.ink, stroke: null }); c.restore()
          hzLines(c, E, f, -sw / 2 + padL, -f.lines.length * f.lineH / 2, { align: 'left', anim: null, fill: [P.white, mix(P.white, P.yellow, 0.35)], outer: P.ink, rim: null, outW: 0.16, sh: 0.05 })
        })
      })
      if (last >= 0 && n <= 4) twinkles(ctx, E, s.t - s.cue(last + 1) - 0.3, lx + 36 * u, ly, 24 * u, h * 0.55, 3, { seed: 12 + last, size: 26 })
      if (!withBuddy) return
      if (por) buddy(ctx, E, s.t - s.cue(0), W / 2, B.y + B.h, ms, { mood: 'cheer' })
      else {
        // 吉祥物站得离贴条近一些，不在画面另一头干指
        const right = Math.max(...FS.map((f, i) => x0 + (i % 2) * 40 * u + f.width + padL + padR))
        const bx = Math.min(B.x + B.w - rw / 2, right + ms * 1.3 + 40 * u), feet = B.y + B.h
        buddy(ctx, E, s.t - s.cue(0), bx, feet, ms, last >= 0 ? { mood: 'point', aim: aimAt(bx, feet, ms, lx + 40 * u, ly), reach: reachTo(bx, feet, ms, lx + 20 * u, ly), look: -1 } : { mood: 'happy' })
      }
    },

    // 大数字：放射线上转着两层爆炸框，数字砸进来再滚到目标值，滚完炸一圈彩纸；label 是白贴纸，note 是深色胶囊；吉祥物看呆
    number(ctx, s, E) {
      setPal(this.c)
      const u = E.u, W = E.W, B = E.L.box, sc = s.scene, por = E.portrait
      const iL = sc.label ? 1 : -1, iN = sc.note ? (sc.label ? 2 : 1) : -1
      const ms = E.pick(220, 190) * u, mh = por ? ms * 1.45 : 0
      const lab = sc.label ? E.fit(sc.label, { role: 'body', weight: 900, size: E.pick(54, 50) * u, maxW: E.W / E.H < 1.5 ? B.w * 0.74 : Math.min(B.w * 0.74, B.w - ms * 2.6), maxLines: 2, lineGap: 1.2 }) : null
      const note = sc.note ? E.fit(sc.note, { role: 'body', weight: 900, size: 36 * u, maxW: B.w * 0.66, maxLines: 1 }) : null
      const labH = lab ? lab.lines.length * lab.lineH + 34 * u : 0, hL = lab ? labH + 44 * u : 0, hN = note ? note.size * 1.62 + 40 * u : 0
      const r = por ? Math.min(B.w * 0.4, (B.h - hL - hN - mh) / 2.3) : Math.min((B.h - hL - hN) / 2.3, B.w * 0.26)
      const cx = W / 2, cy = B.y + (B.h - mh - hL - hN - r * 2.2) / 2 + r * 1.1
      const dt0 = s.t - s.cue(0), rollT = Math.min(1.2, s.dur * 0.35), land = dt0 - 0.1 - rollT
      rays(ctx, E, cx, cy, 24, E.T * 0.5, rgba(P.white, 0.22 * E.clamp(dt0 / 0.3)), r * 2.6)
      put(ctx, E, dt0, { kind: 'pop', x: cx, y: cy, wob: 0.4, seed: 21 }, c => {
        boom(c, E, r * 1.08, { fill: P.yellow, n: 18, seed: 11, rot: E.T * 0.12, sh: 16, lw: 8 })
        boom(c, E, r * 0.84, { fill: P.hot, n: 16, seed: 4, rot: -E.T * 0.16, sh: 0, lw: 6 })
      })
      const str = String(sc.value), unit = sc.unit || '', s0 = r * 0.8
      // 数字连单位最宽到爆炸框的外径：先按原字号量出两段的比例，再给数字分宽度
      ctx.font = E.font('title', 900, s0); const wN0 = ctx.measureText(str).width
      ctx.font = E.font('title', 900, s0 * 0.36); const wU0 = unit ? ctx.measureText(unit).width + 16 * u : 0
      const f = E.fit(str, { role: 'title', weight: 900, size: s0, maxW: r * 2.1 * wN0 / (wN0 + wU0), maxLines: 1, minSize: s0 * 0.3, lineGap: 1 })
      ctx.font = E.font('title', 900, f.size)
      const wN = ctx.measureText(str).width, us = f.size * 0.36
      ctx.font = E.font('title', 900, us)
      const wU = unit ? ctx.measureText(unit).width + 16 * u : 0, xr = wN - (wN + wU) / 2
      const shown = rolling(sc.value, E.clamp((dt0 - 0.1) / rollT))
      put(ctx, E, dt0 - 0.05, { kind: 'slam', x: cx, y: cy, wob: 0.6, seed: 22 }, c => {
        hz(c, E, shown, xr, f.size * 0.02, f.size, { align: 'right', anim: null, fill: [P.white, P.yellow], outer: P.purple, rimW: 0.18, outW: 0.08 })
        if (unit) hz(c, E, unit, xr + 16 * u, f.size * 0.22, us, { align: 'left', anim: null, fill: [P.white, P.white], outer: P.purple })
      })
      ring(ctx, E, land, cx, cy, r * 1.9, { lw: 20, dur: 0.5 })
      speedLines(ctx, E, burst(land), { seed: 6 })
      confetti(ctx, E, land, cx, cy, { n: 50, seed: 9, speed: 1500 })
      twinkles(ctx, E, land, cx, cy, r * 1.25, r * 1.15, 6, { seed: 13, size: 34 })
      let y = cy + r * 1.1 + 44 * u
      const boxes = [{ x: cx - r * 1.1, y: cy - r * 1.1, w: r * 2.2, h: r * 2.2 }, { x: cx - B.w * 0.37, y, w: B.w * 0.74, h: hL + hN }]
      if (lab) {
        put(ctx, E, s.t - s.cue(iL), { kind: 'up', x: cx, y: y + labH / 2, rot: -0.015, seed: 23 }, c => { sticker(c, E, lab.width + 70 * u, labH, { fill: P.card, r: 22 }); inkLines(c, E, lab, 0, -labH / 2 + 17 * u) })
        y += hL
      }
      if (note) put(ctx, E, s.t - s.cue(iN), { kind: 'pop', x: cx, y: y + note.size * 0.81, rot: 0.02, seed: 24 }, c => pill(c, E, note.lines[0], note.size, { fill: P.ink, color: P.white, border: 4, sh: 5 }))
      if (lab) boxes[1] = { x: cx - lab.width / 2 - 45 * u, y: boxes[1].y, w: lab.width + 90 * u, h: hL + hN }
      const bx = por ? W / 2 : B.x + ms * 0.62, mz = por ? ms : fitBuddy(bx, B.y + B.h, ms, boxes)
      if (mz) buddy(ctx, E, dt0 - 0.2, bx, B.y + B.h, mz, { mood: land > 0 ? 'shock' : 'happy', bump: land, look: 1 })
    },

    // 柱状图：彩色贴纸柱一根根弹着长高，数值跟着滚；高亮的那根是黄色、头上闪星星，吉祥物伸手指着它。竖屏改成横条
    bars(ctx, s, E) {
      setPal(this.c)
      const u = E.u, B = E.L.box, sc = s.scene, por = E.portrait, n = sc.items.length
      const top = heading(ctx, s, E, sc.title)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const cols = [P.cyan, P.purple, P.hot, P.blue, P.orange, P.lime], colOf = i => (i === hi ? P.yellow : cols[i % cols.length])
      const grow = i => { const p = s.p(i + 1); return p > 0 ? E.ease.outBack(p) : 0 }
      const valText = (i, q) => formatNumber(vals[i] * Math.min(1, q), dec) + unit
      const ms = (n >= 6 ? 170 : 200) * u
      let tx = 0, ty = 0, bx, feet
      if (!por) {
        // 吉祥物站在离高亮那根近的一侧
        const side = hi < (n - 1) / 2 ? -1 : 1, mw = ms * 1.3, labH = 96 * u, valH = 86 * u, x0 = side < 0 ? B.x + mw : B.x, cw = B.w - mw, base = B.y + B.h - labH, hMax = base - top - valH
        const slot = cw / n, bw = Math.min(slot * 0.6, 200 * u)
        sc.items.forEach((it, i) => {
          const q = grow(i), h = hMax * vals[i] / max * q, x = x0 + slot * i + (slot - bw) / 2, a = E.clamp(s.p(i + 1) * 3)
          if (h > 1) barShape(ctx, E, x, base - h, bw, h, colOf(i))
          if (a <= 0) return
          ctx.save(); ctx.globalAlpha *= a
          const lf = E.fit(it.label, { role: 'body', weight: 900, size: 38 * u, maxW: slot * 0.92, maxLines: 2, maxH: labH - 18 * u, lineGap: 1.15, oneLine: true })
          inkLines(ctx, E, lf, x + bw / 2, base + 18 * u, { color: P.white, stroke: P.ink, lw: 0.26 })
          if (i === hi) hz(ctx, E, valText(i, q), x + bw / 2, base - h - 44 * u, 52 * u, { anim: null, fill: [P.white, P.yellow], outer: P.hot, rimW: 0.2 })
          else label(ctx, E, valText(i, q), x + bw / 2, base - h - 32 * u, 40 * u, { fill: P.white, stroke: P.ink, lw: 0.26 })
          ctx.restore()
          if (i === hi) { tx = x + bw / 2 - side * 50 * u; ty = base - h - 40 * u; if (n <= 5) twinkles(ctx, E, s.t - s.cue(i + 1) - 0.3, x + bw / 2, base - h - 50 * u, bw * 0.75, 50 * u, 4, { seed: 31, size: 26 }) }
        })
        fatLine(ctx, E, [[x0, base], [x0 + cw, base]], P.white, 8)
        bx = side < 0 ? B.x + mw / 2 : B.x + B.w - mw / 2; feet = base
      } else {
        const mh = ms * 1.45, avail = B.y + B.h - top - mh, rowH = Math.min(avail / n, 200 * u), y0 = top + (avail - rowH * n) / 2
        const x0 = B.x + 8 * u, wMax = B.w - 190 * u
        sc.items.forEach((it, i) => {
          const q = grow(i), y = y0 + rowH * i, bh = rowH * 0.4, by = y + rowH * 0.46, w = wMax * vals[i] / max * q, a = E.clamp(s.p(i + 1) * 3)
          if (w > 1) barShape(ctx, E, x0, by, w, bh, colOf(i), true)
          if (a <= 0) return
          ctx.save(); ctx.globalAlpha *= a
          const lf = E.fit(it.label, { role: 'body', weight: 900, size: 38 * u, maxW: B.w - 20 * u, maxLines: 1 })
          inkLines(ctx, E, lf, x0 + 14 * u, y + rowH * 0.42 - lf.lineH, { color: P.white, stroke: P.ink, lw: 0.26, align: 'left' })
          if (i === hi) hz(ctx, E, valText(i, q), x0 + w + 22 * u, by + bh / 2, 50 * u, { align: 'left', anim: null, fill: [P.white, P.yellow], outer: P.hot, rimW: 0.2 })
          else label(ctx, E, valText(i, q), x0 + w + 22 * u, by + bh / 2, 40 * u, { fill: P.white, stroke: P.ink, lw: 0.26, align: 'left' })
          ctx.restore()
          if (i === hi) { tx = x0 + w * 0.8; ty = by + bh + 20 * u }
        })
        fatLine(ctx, E, [[x0, y0 + rowH * 0.3], [x0, y0 + rowH * n]], P.white, 8)
        bx = tx > E.W / 2 ? B.x + B.w - ms * 0.7 : B.x + ms * 0.7; feet = B.y + B.h
      }
      const seen = s.p(hi + 1) > 0.5
      buddy(ctx, E, s.t - s.cue(0), bx, feet, ms, seen ? { mood: 'point', aim: aimAt(bx, feet, ms, tx, ty), look: -1, bump: s.t - s.cue(hi + 1) - 0.18 } : { mood: 'happy' })
    },

    // 步骤：背面朝上、带编号的翻牌任务卡随标题弹出来，念到第几步翻开第几张；翻开的卡之间亮起箭头
    steps(ctx, s, E) {
      setPal(this.c)
      const u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, vert = E.W / E.H < 1.5
      const top = heading(ctx, s, E, sc.title), avail = B.y + B.h - top, cols = stripCols()
      let R, band, opt
      if (!vert) {
        const gap = (n >= 5 ? 46 : 66) * u, cw = (B.w - gap * (n - 1)) / n, ch = Math.min(avail * 0.9, 470 * u, cw * 1.6), y = top + (avail - ch) / 2
        R = sc.items.map((_, i) => ({ x: B.x + (cw + gap) * i, y, w: cw, h: ch }))
        band = Math.min(ch * 0.24, 92 * u)
        opt = { role: 'title', weight: 900, size: 58 * u, maxW: cw - 44 * u, maxLines: 4, maxH: ch - band - 50 * u, lineGap: 1.2 }
      } else {
        const gap = 40 * u, ch = Math.min((avail - gap * (n - 1)) / n, 230 * u), y0 = top + (avail - ch * n - gap * (n - 1)) / 2
        R = sc.items.map((_, i) => ({ x: B.x, y: y0 + (ch + gap) * i, w: B.w, h: ch }))
        band = Math.min(ch * 0.9, 150 * u)
        opt = { role: 'title', weight: 900, size: 56 * u, maxW: B.w - band - 70 * u, maxLines: 2, maxH: ch - 36 * u, lineGap: 1.18 }
      }
      const FS = fitAll(E, sc.items, opt), flip = i => E.clamp((s.t - s.cue(i + 1)) / 0.32)
      R.forEach((Q, i) => {
        if (i > 0 && flip(i) > 0.5) {
          const p = E.clamp((flip(i) - 0.5) * 3), P0 = R[i - 1]
          if (!vert) arrow(ctx, E, P0.x + P0.w + 6 * u, Q.y + Q.h / 2, Q.x - 6 * u, Q.y + Q.h / 2, p, P.yellow, 12)
          else arrow(ctx, E, Q.x + band / 2, P0.y + P0.h + 4 * u, Q.x + band / 2, Q.y - 4 * u, p, P.yellow, 12)
        }
        const q = flip(i), sx = Math.abs(Math.cos(Math.PI * q)), front = q >= 0.5, w = Q.w, h = Q.h, f = FS[i]
        put(ctx, E, s.t - s.cue(0) - 0.08 * i, { kind: 'pop', x: Q.x + w / 2, y: Q.y + h / 2, rot: (i % 2 ? 0.01 : -0.01), wob: 0.4, seed: 30 + i }, c => {
          c.scale(Math.max(0.02, sx) * (front ? 1 + 0.05 * Math.sin(E.clamp((q - 0.5) * 2) * Math.PI) : 1), 1)
          if (!front) {
            sticker(c, E, w, h, { fill: cols[i % cols.length], r: 24, border: 6 })
            twinkles(c, E, 0.4 + E.T % 3, 0, 0, w * 0.28, h * 0.28, 3, { seed: 40 + i, size: 22 })
            hz(c, E, String(i + 1), 0, 0, Math.min(h * 0.5, w * 0.5), { anim: null, fill: [P.white, P.yellow], outer: P.ink, rim: null, outW: 0.14 })
            return
          }
          sticker(c, E, w, h, { fill: P.card, r: 24, border: 6 })
          c.save(); E.roundRect(c, -w / 2, -h / 2, w, h, 24 * u); c.clip(); c.fillStyle = cols[i % cols.length]
          if (!vert) c.fillRect(-w / 2, -h / 2, w, band); else c.fillRect(-w / 2, -h / 2, band, h)
          c.restore()
          const ns = Math.min(band * 0.62, 70 * u)
          if (!vert) {
            hz(c, E, String(i + 1), 0, -h / 2 + band / 2, ns, { anim: null, fill: [P.white, P.yellow], outer: P.ink, rim: null, outW: 0.16 })
            inkLines(c, E, f, 0, -h / 2 + band + (h - band - f.lines.length * f.lineH) / 2)
          } else {
            hz(c, E, String(i + 1), -w / 2 + band / 2, 0, ns, { anim: null, fill: [P.white, P.yellow], outer: P.ink, rim: null, outW: 0.16 })
            inkLines(c, E, f, -w / 2 + band + 30 * u, -f.lines.length * f.lineH / 2, { align: 'left' })
          }
        })
      })
    },

    // 对比：左右两块牌子从两边甩进来撞在一起，撞上那一下画面一抖，中间砸下一个爆炸框「VS」；右边是推荐的一方（黄牌、星星标记）。竖屏上下摆
    compare(ctx, s, E) {
      setPal(this.c)
      const u = E.u, B = E.L.box, sc = s.scene, por = E.portrait
      const top = heading(ctx, s, E, sc.title), avail = B.y + B.h - top, gap = E.pick(150, 140) * u
      const R = por
        ? [{ x: B.x, y: top, w: B.w, h: (avail - gap) / 2 }, { x: B.x, y: top + (avail + gap) / 2, w: B.w, h: (avail - gap) / 2 }]
        : [{ x: B.x, y: top, w: (B.w - gap) / 2, h: avail }, { x: B.x + (B.w + gap) / 2, y: top, w: (B.w - gap) / 2, h: avail }]
      const sides = [sc.left, sc.right], fills = [P.blue, P.yellow], txt = [P.white, P.ink], pad = 40 * u, th = 100 * u
      const rowH = side => Math.min((R[0].h - th - pad * 2) / Math.max(1, (side.items || []).length), 150 * u)
      const all = []
      sides.forEach(d => (d.items || []).forEach(t => all.push(t)))
      const minRow = Math.min(rowH(sc.left), rowH(sc.right))
      const FS = all.length ? fitAll(E, all, { role: 'body', weight: 900, size: Math.min(54 * u, minRow * 0.44), maxW: R[0].w - pad * 2 - 56 * u, maxLines: 2, maxH: minRow * 0.92, lineGap: 1.18 }) : []
      const vsT = s.t - s.cue(2) - 0.3, sh = shake(E, vsT, 14, 0.4)
      let k0 = 0
      sides.forEach((d, i) => {
        const Q = R[i], items = d.items || [], rh = rowH(d), fs = FS.slice(k0, k0 + items.length)
        k0 += items.length
        const tf = E.fit(d.title, { role: 'title', weight: 900, size: Math.min(60 * u, Q.w * 0.12), maxW: Q.w - pad * 2, maxLines: 1 })
        put(ctx, E, s.t - s.cue(i + 1), { kind: i ? 'right' : 'left', x: Q.x + Q.w / 2 + sh.x, y: Q.y + Q.h / 2 + sh.y, rot: (i ? -1 : 1) * 0.012, wob: 0.4, seed: 50 + i }, c => {
          const w = Q.w, h = Q.h
          sticker(c, E, w, h, { fill: fills[i], r: 30, border: 8, sh: 12 })
          hz(c, E, tf.lines[0], 0, -h / 2 + th / 2 + 10 * u, tf.size, { anim: null, fill: [P.white, i ? mix(P.white, P.yellow, 0.4) : mix(P.white, P.cyan, 0.4)], outer: P.ink, rim: null, outW: 0.17 })
          c.save(); c.strokeStyle = rgba(P.ink, 0.5); c.lineWidth = 4 * u; c.setLineDash([14 * u, 10 * u]); c.beginPath(); c.moveTo(-w / 2 + pad, -h / 2 + th + 6 * u); c.lineTo(w / 2 - pad, -h / 2 + th + 6 * u); c.stroke(); c.restore()
          const y0 = -h / 2 + th + pad * 0.6 + (h - th - pad * 1.6 - rh * items.length) / 2
          fs.forEach((f, k) => {
            const cy = y0 + rh * k + rh / 2, mx = -w / 2 + pad + 18 * u
            if (i) sparkle(c, E, mx, cy, 18 * u, { color: P.hot }); else { c.fillStyle = P.white; c.beginPath(); c.arc(mx, cy, 9 * u, 0, Math.PI * 2); c.fill(); c.lineWidth = 3 * u; c.strokeStyle = P.ink; c.stroke() }
            inkLines(c, E, f, mx + 38 * u, cy - f.lines.length * f.lineH / 2, { color: txt[i], align: 'left', stroke: i ? null : P.ink, lw: 0.14 })
          })
        })
      })
      const vx = por ? E.W / 2 : B.x + B.w / 2, vy = por ? top + avail / 2 : top + avail * 0.48, vr = E.pick(96, 74) * u
      ring(ctx, E, vsT, vx, vy, vr * 3, { lw: 16 })
      speedLines(ctx, E, burst(vsT), { seed: 8 })
      put(ctx, E, vsT, { kind: 'slam', x: vx, y: vy, rot: -0.08, wob: 0.6, seed: 55 }, c => {
        boom(c, E, vr, { fill: P.hot, n: 14, seed: 7, rot: E.T * 0.3, sh: 10, lw: 6 })
        hz(c, E, 'VS', 0, 4 * u, vr * 0.78, { anim: null, fill: [P.white, P.yellow], outer: P.ink, rim: null, outW: 0.16 })
      })
    },

    // 引语：吉祥物举着话筒，那句话装在一个大对话气泡里，左上角一个花字引号；出处是紫色胶囊贴纸
    quote(ctx, s, E) {
      setPal(this.c)
      const u = E.u, B = E.L.box, sc = s.scene, por = E.portrait
      const ms = E.pick(240, 210) * u, mx = B.x + ms * 0.62, gap = 90 * u
      const byF = sc.by ? E.fit(sc.by, { role: 'body', weight: 900, size: 40 * u, maxW: por ? B.w - ms * 1.4 - 80 * u : B.w * 0.5, maxLines: 1 }) : null
      const Q = por ? { x: B.x, y: B.y + 40 * u, w: B.w, h: B.h - ms * 1.45 - 110 * u } : { x: B.x + ms * 1.35, y: B.y + 40 * u, w: B.w - ms * 1.35, h: B.h - 40 * u - (byF ? 120 * u : 40 * u) }
      const padX = 70 * u, padY = 60 * u
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(82, 76) * u, maxW: Q.w - padX * 2, maxLines: por ? 7 : 5, maxH: Q.h - padY * 2, lineGap: 1.3 })
      const bw = Math.min(Q.w, Math.max(f.width + padX * 2, Q.w * 0.6)), bh = f.lines.length * f.lineH + padY * 2
      const bx = Q.x + (Q.w - bw) / 2, by = por ? B.y + (B.h - bh - gap - ms * 1.42) / 2 : Q.y + (Q.h - bh) / 2
      const feet = por ? by + bh + gap + ms * 1.42 : B.y + B.h, my = feet - ms * 0.54
      const tipX = por ? mx + ms * 0.3 : mx + ms * 0.5, tipY = por ? my - ms * 0.75 : my - ms * 0.3
      buddy(ctx, E, s.t - s.cue(0) + 0.25, mx, feet, ms, { mood: 'mic' })
      put(ctx, E, s.t - s.cue(0), { kind: 'pop', x: bx + bw / 2, y: by + bh / 2, wob: 0.3, seed: 60 }, c => {
        bubble(c, E, -bw / 2, -bh / 2, bw, bh, tipX - bx - bw / 2, tipY - by - bh / 2)
        inkLines(c, E, f, 0, -bh / 2 + padY)
        hz(c, E, '“', -bw / 2 + 40 * u, -bh / 2 + 20 * u, 150 * u, { anim: null, fill: [P.yellow, P.orange], outer: P.hot, rimW: 0.16, outW: 0.08 })
      })
      if (byF) {
        const px = por ? (mx + ms * 0.7 + B.x + B.w) / 2 : bx + bw - byF.width / 2 - 60 * u, py = por ? feet - ms * 0.75 : by + bh + 62 * u
        put(ctx, E, s.t - s.cue(1), { kind: 'drop', x: px, y: py, rot: -0.03, seed: 61 }, c => pill(c, E, byF.lines[0], byF.size, { fill: P.purple, color: P.white }))
      }
    },

    // 片尾：收束的话是掉下来的大花字，副标题是深色贴纸，cta 是会跳的粉色大按钮；吉祥物站在跑马灯圆台上欢呼，彩纸一阵阵炸开
    end(ctx, s, E) {
      setPal(this.c)
      const u = E.u, W = E.W, B = E.L.box, sc = s.scene, por = E.portrait
      let n = 0
      const it = n++, is = sc.subtitle ? n++ : -1, ic = sc.cta ? n : -1
      const pw = E.pick(340, 300) * u, ms = pw * 0.6, stageH = por ? pw * 0.2 + ms * 1.4 + 30 * u : 0
      const colW = por ? B.w : B.w - pw - 60 * u, cx = por ? W / 2 : B.x + colW / 2
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(124, 110) * u, maxW: colW * 0.92, maxLines: 3, lineGap: 1.16, oneLine: true })
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 900, size: 46 * u, maxW: colW * 0.82, maxLines: 2, lineGap: 1.2 }) : null
      const cta = sc.cta ? E.fit(sc.cta, { role: 'title', weight: 900, size: 52 * u, maxW: colW * 0.6, maxLines: 1 }) : null
      const hT = big.lines.length * big.lineH, subH = sub ? sub.lines.length * sub.lineH + 32 * u : 0, hS = sub ? subH + 40 * u : 0, ctaH = cta ? cta.size * 1.9 : 0, hC = cta ? ctaH + 56 * u : 0
      let y = B.y + (B.h - stageH - hT - hS - hC) / 2
      const tt = s.t - s.cue(it), land = tt - 0.4 - [...sc.title].length * 0.04
      rays(ctx, E, cx, y + hT / 2, 16, -E.T * 0.2, rgba(P.white, 0.14 * E.clamp(tt / 0.3)))
      hzLines(ctx, E, big, cx, y, { t: tt, anim: 'drop', stagger: 0.04, bob: 2 * u, fill: [P.white, P.yellow], outer: P.hot })
      twinkles(ctx, E, land, cx, y + hT / 2, big.width * 0.55, hT * 0.55 + 30 * u, 5, { seed: 71, size: 30 })
      y += hT + 40 * u
      if (sub) {
        put(ctx, E, s.t - s.cue(is), { kind: 'up', x: cx, y: y + subH / 2, rot: -0.012, seed: 72 }, c => { sticker(c, E, sub.width + 66 * u, subH, { fill: P.ink, r: 20, border: 6 }); inkLines(c, E, sub, 0, -subH / 2 + 16 * u, { color: P.white }) })
        y += hS
      }
      if (cta) {
        const dt = s.t - s.cue(ic), beat = dt > 0.4 ? 1 + 0.04 * Math.sin((dt - 0.4) * Math.PI * 2 * 128 / 60) : 1
        put(ctx, E, dt, { kind: 'slam', x: cx, y: y + 16 * u + ctaH / 2, s: beat, seed: 73 }, c => {
          sticker(c, E, cta.width + cta.size * 2, ctaH, { fill: P.hot, r: ctaH / 2 / u, border: 8, sh: 10 })
          hz(c, E, cta.lines[0], 0, cta.size * 0.04, cta.size, { anim: null, fill: [P.white, P.yellow], outer: P.ink, rim: null, outW: 0.16 })
        })
      }
      const px = por ? W / 2 : B.x + B.w - pw / 2, py = por ? B.y + (B.h + stageH + hT + hS + hC) / 2 - pw * 0.2 : B.y + B.h - pw * 0.16
      podium(ctx, E, px, py, pw, E.T)
      for (let k = 0; k < 8; k++) confetti(ctx, E, tt - 0.4 - k * 1.4, px, py - ms * 0.9, { n: 28, seed: 80 + k, speed: 1150, spread: 1.7 })
      buddy(ctx, E, tt - 0.2, px, py, ms, { mood: 'cheer' })
    },
  },

  caption(ctx, s, E) { setPal(this.c); caption(ctx, s, E) },
  overlay(ctx, E, s) { setPal(this.c); danmu(ctx, E, s, danmuList(s.scene, s.layout)) },

  // 默认版式会调用的零件（九种版式都重画了，只在 custom 场借用时用到）：深紫贴纸卡（强调色是黄色实心）、贴纸柱、黄徽章、黄色粗下划线
  card(ctx, E, x, y, w, h, o = {}) {
    setPal(this.c)
    ctx.save(); ctx.translate(x + w / 2, y + h / 2)
    sticker(ctx, E, w, h, { fill: o.tone === 'accent' ? this.c.accent : mix(this.c.line, this.c.accent2, 0.35), r: this.radius, border: 6, sh: 8 })
    ctx.restore()
  },
  bar(ctx, E, x, y, w, h, o = {}) { setPal(this.c); barShape(ctx, E, x, y, w, h, o.color ?? this.c.accent, w > h) },
  mark(ctx, E, x, y, r, i, o = {}) { setPal(this.c); ctx.save(); ctx.translate(x, y); badge(ctx, E, r, o.color ?? this.c.accent); ctx.restore() },
  underline(ctx, E, x, y, w, p) {
    if (p <= 0) return
    ctx.save(); ctx.fillStyle = this.c.line; E.roundRect(ctx, x + 5 * E.u, y + 5 * E.u, w * p, 16 * E.u, 8 * E.u); ctx.fill()
    ctx.fillStyle = this.c.accent; E.roundRect(ctx, x, y, w * p, 16 * E.u, 8 * E.u); ctx.fill(); ctx.lineWidth = 3 * E.u; ctx.strokeStyle = this.c.line; ctx.stroke(); ctx.restore()
  },

  // 配乐：128 拍，C–G–Am–F，拨弦主奏，八分音符低音，有鼓。音效：入场 pop，换场 whoosh（配星形爆开），number 和 statement 落地 thud
  music: { style: 'drive', prog: ['C', 'G', 'Am', 'F'], lead: 'pluck', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'thud' },
  // 片头花字落地一记 thud，数字滚完、高亮柱长好、片尾各一声 chime，VS 砸下一记 thud
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const sc = S.scene, at = k => S.t0 + S.cues[Math.min(k, S.cues.length - 1)]
      if (S.layout === 'title') out.push({ t: at(sc.kicker ? 1 : 0) + 0.13 + ([...sc.title].length - 1) * 0.05, kind: 'thud', gain: 0.3 })
      if (S.layout === 'number') out.push({ t: at(0) + 0.1 + Math.min(1.2, S.dur * 0.35), kind: 'chime', gain: 0.3 })
      if (S.layout === 'compare') out.push({ t: at(2) + 0.3, kind: 'thud', gain: 0.34 })
      if (S.layout === 'bars') { const v = sc.items.map(it => Number(it.value)), hi = sc.highlight != null ? sc.highlight - 1 : v.indexOf(Math.max(...v)); out.push({ t: at(hi + 1) + 0.3, kind: 'chime', gain: 0.2 }) }
      if (S.layout === 'end') out.push({ t: at(0) + 0.4, kind: 'chime', gain: 0.28 })
    }
    return out
  },
}
