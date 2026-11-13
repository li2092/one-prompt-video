// 风格包：纸艺定格（papercraft）。移植自风格库的 O-纸艺定格，画法库在 lib/。
// 每一场是一个纸艺景箱：天空底卡、吊线纸云、三层剪纸山丘，近景山丘压在内容前面。内容全是带投影的彩色卡纸，
// 由一个纸片小人来演。全片每秒换 8 张：运动一格一格走，每块纸每格轻轻抖一下，剪纸轮廓每两格 boil 一次；
// 纸纹只画一次压在最上面，不跟着抖。转场是一张新卡纸一格一格从右边推进来。
import { mix, formatNumber, decimalsOf, textUnits, drawLines } from '../../core.mjs'
import { captionChunks, rolling } from '../../layouts.mjs'
import { P, SM, useE, tq, frameNo, hash, hs, clamp, kf, pop, outBack, inOut, shade, shadow, cutPoly, cutCircle, card, fillPaper, place, label, labelSize, tileRow, tiles, paperCheck, string, brad } from './lib/paper.mjs'
import { stageOf, stageBack, stageFront } from './lib/stage.mjs'
import { doll, DOLL_W, DOLL_H } from './lib/doll.mjs'

const K = c => ({ ink: c.fg, soft: c.muted, paper: c.card, acc: c.accent, acc2: c.accent2, line: c.line, on: c.onAccent, kraft: mix(c.line, c.card, 0.4) })
// 一场的公共量：定格后的时刻、布景、镜头（整场一格一格推近 3.5%）
function setup(theme, s, E) {
  useE(E)
  const t = tq(s, E)
  const b = { ...E.L.box, r: E.L.box.x + E.L.box.w }
  return { t, g: stageOf(E, s.layout, theme.c), z: 1 + 0.035 * clamp(t / Math.max(1, s.dur)), k: K(theme.c), u: E.u, b, sc: s.scene, por: E.portrait }
}
const hand = (E, sz) => E.font('body', 500, sz)
const bold = (E, sz) => E.font('title', 900, sz)
const fitHand = (E, text, size, maxW, maxLines = 2, o = {}) => E.fit(text, { role: 'body', weight: 500, size, maxW, maxLines, lineGap: 1.25, ...o })
// 几段字用同一个字号（取各自放得下的最小字号）
function fitAll(E, texts, opts) {
  const size = Math.min(...texts.map((t, i) => E.fit(t, opts[i]).size))
  return texts.map((t, i) => E.fit(t, { ...opts[i], size }))
}
const lerp = (a, b, p) => a + (b - a) * p

// 字块排版：字块的宽约是字号的 1.75 倍，先按缩小的宽度让 E.fit 断行、定字号，再按字块的实际宽度收一次
function tileFit(ctx, E, text, { size, maxW, maxLines = 2 }) {
  const f = E.fit(text, { role: 'title', weight: 900, size: size * 0.62, maxW: maxW * 0.56, maxLines, lineGap: 2, oneLine: true })
  let ts = f.size / 0.62
  const wide = Math.max(...f.lines.map(l => tileRow(ctx, l, ts, sz => bold(E, sz)).total))
  if (wide > maxW) ts *= maxW / wide
  return { lines: f.lines, size: ts, rowH: ts * 1.24, n: f.lines.join('').length }
}
const tileStep = tf => Math.min(1 / SM, 1.1 / Math.max(1, tf.n))
function tileText(ctx, E, tf, cx, y, t, t0, col, fg, seed = 11) {
  let n0 = 0
  tf.lines.forEach((ln, j) => { tiles(ctx, ln, cx, y + tf.rowH * (j + 0.5), t, t0, { size: tf.size, font: sz => bold(E, sz), col, fg, n0, stagger: tileStep(tf), seed }); n0 += [...ln].length })
}
// 场标题：一排字块，第一块是强调色。返回下沿的 y
function heading(ctx, s, E, X, text, cx, maxW) {
  if (!text) return X.b.y
  const tf = tileFit(ctx, E, text, { size: E.pick(78, 74) * X.u, maxW, maxLines: 2 })
  tileText(ctx, E, tf, cx, X.b.y, X.t, s.cue(0) - 0.1, i => (i ? X.k.paper : X.k.acc), i => (i ? X.k.ink : X.k.on), 5)
  return X.b.y + tf.rowH * tf.lines.length
}
// 剪出来的字：底下一层深一号的纸厚，左上错出一道浅色剪口，上面一层纸；(0, 0) 是字的底线中点
// （不用 strokeText 描边：粗体是合成加粗时，描边会把字形里的原轮廓也描出来）
function cutGlyph(c, E, ch, font, fill) {
  const u = E.u
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.save(); shadow(c, 1.4); c.fillStyle = shade(fill, -0.3); c.fillText(ch, 5 * u, 6 * u); c.restore()
  c.fillStyle = shade(fill, 0.55); c.fillText(ch, -1.8 * u, -1.8 * u)
  c.fillStyle = fill; c.fillText(ch, 0, 0)
}
// 小人的公共参数
const actor = (X, o) => ({ body: X.k.acc2, ink: X.k.ink, ...o })
const wave = () => 2.15 + (Math.floor(frameNo() / 2) % 2) * 0.4
// 场景从卡纸上立起来：以 (x, y) 为底边中点按 sy 拉高
const rise = (t, t0) => (t <= t0 ? 0 : outBack(kf(t, t0, 0.5)))

export default {
  name: '纸艺定格', mood: '彩色卡纸景箱、纸片小人和定格抖动，轻松的科普、产品介绍和故事', bpm: 96,
  c: { bg: '#F7EBD3', fg: '#3E2B20', muted: '#6B5444', accent: '#D9734E', accent2: '#4F948B', card: '#FBF4E6', line: '#B8936A', onAccent: '#FFFDF7' },
  fontTitle: 'sans', fontBody: 'hand', fontNum: 'sans', wTitle: 900, wBody: 500, radius: 14,
  motion: 'pop', solidAccent: true,
  music: { style: 'bright', prog: ['C', 'Am', 'F', 'G'], lead: 'pluck', drums: false },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'chime' },

  bg(ctx, E, s) { const X = setup(this, s, E); stageBack(ctx, E, X.g, X.z) },

  layouts: {
    // 片头：一块大纸牌从景里立起来（横屏立在两根木桩上，竖屏用两根线吊着），标题是一张张字块；
    // kicker 是压在牌子上沿的小签，副标题是压在下沿的牛皮纸条；小人站在一旁，标题到齐后挥手
    title(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X
      let i = 0
      const ck = sc.kicker ? s.cue(i++) : 0, ct = s.cue(i++), cs = sc.subtitle ? s.cue(i++) : 0
      const side = por ? 0 : 290 * u, bw = por ? b.w : Math.min(b.w - side, 1300 * u), bx = por ? E.W / 2 : b.x + side + (b.w - side) / 2
      const tf = tileFit(ctx, E, sc.title, { size: E.pick(124, 140) * u, maxW: bw - E.pick(120, 90) * u, maxLines: E.pick(2, 3) })
      const kick = sc.kicker && fitHand(E, sc.kicker, 40 * u, bw * 0.7, 1), sf = sc.subtitle && fitHand(E, sc.subtitle, E.pick(46, 42) * u, bw * 0.84, 2)
      const kh = kick ? labelSize(kick).h : 0, sh = sf ? labelSize(sf).h : 0
      const padT = kick ? kh * 0.5 + 34 * u : 56 * u, bh = padT + tf.rowH * tf.lines.length + (sf ? sh * 0.5 + 34 * u : 56 * u)
      const ds = E.pick(0.95, 1.1), dH = DOLL_H * ds * u
      const top = por ? Math.max(b.y + kh / 2, b.y + (g.floor - dH - 70 * u - b.y - bh) * 0.62) : Math.max(b.y + kh / 2 + 4 * u, Math.min(g.floor - 120 * u - bh, (b.y + g.floor - bh) / 2 - 20 * u))
      const up = rise(t, Math.max(0, s.cue(0) - 0.35))
      const board = (c, y) => {
        card(c, -bw / 2, y, bw, bh, k.paper, { r: 20 * u, seed: 6, lift: 1.5 })
        c.save(); c.setLineDash([12 * u, 9 * u]); c.strokeStyle = E.rgba(k.line, 0.7); c.lineWidth = 3 * u; E.roundRect(c, -bw / 2 + 16 * u, y + 16 * u, bw - 32 * u, bh - 32 * u, 12 * u); c.stroke(); c.restore()
      }
      if (up > 0 && por) {
        const dy = -(1 - up) * (top + bh + 60 * u)
        for (const sx of [-1, 1]) string(ctx, bx + sx * bw * 0.3, -10, bx + sx * bw * 0.3, top + dy + 18 * u, 'rgba(80,60,40,0.6)', 2.4)
        place(ctx, bx, 0, { seed: 4, amp: 0.5 }, c => { board(c, top + dy); for (const sx of [-1, 1]) brad(c, sx * bw * 0.3, top + dy + 18 * u, 8 * u) })
      } else if (up > 0) {
        place(ctx, bx, g.floor + 30 * u, { sy: up, seed: 4, amp: 0.5 }, c => {
          const y = top - g.floor - 30 * u
          for (const sx of [-1, 1]) card(c, sx * bw * 0.3 - 13 * u, y + bh - 20 * u, 26 * u, -y - bh + 30 * u, '#8E6A4A', { r: 6 * u, seed: 7 + sx, lift: 1 })
          board(c, y)
        })
      }
      if (up >= 1) {
        tileText(ctx, E, tf, bx, top + padT, t, ct, n => [k.acc, P.mustard, k.acc2, P.coral, P.sage][n % 5], n => [k.on, k.ink, k.on, k.ink, k.ink][n % 5], 21)
        if (kick) place(ctx, bx, top, { s: pop(t, ck), rot: -0.02, seed: 8 }, c => label(c, kick, hand(E, kick.size), { fill: k.acc2, fg: k.on, seed: 9 }))
        if (sf) place(ctx, bx, top + bh, { s: pop(t, cs), rot: 0.012, seed: 10 }, c => label(c, sf, hand(E, sf.size), { fill: P.kraft, fg: k.ink, seed: 11 }))
      }
      const done = t >= ct + tf.n * tileStep(tf) + 0.4
      doll(ctx, por ? E.W / 2 : b.x + 125 * u, g.floor, ds * u, actor(X, { seed: 3, face: done ? 'happy' : 'smile', look: por ? 0 : 1, armR: done ? wave() : 0.2 }))
      stageFront(ctx, E, g, X.z)
    },

    // 一句话：一张大纸用两根线吊下来，高亮的词贴上强调色纸条；小人在旁边仰头看
    statement(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X
      const ds = 0.9, dH = DOLL_H * ds * u, side = por ? 0 : 300 * u
      const sw = por ? b.w : b.w - side, sx = b.x + sw / 2, pad = E.pick(60, 52) * u
      const lo = por ? g.floor - dH - 50 * u : g.floor - 40 * u
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(112, 96) * u, maxW: sw - pad * 2, maxLines: E.pick(4, 6), maxH: lo - b.y - 40 * u - pad * 2, lineGap: 1.34 })
      const sh = f.lines.length * f.lineH + pad * 2, top = b.y + 30 * u + Math.max(0, (lo - b.y - 30 * u - sh) * 0.42)
      const c0 = s.cue(0), up = rise(t, c0 - 0.2), landed = t >= c0 + 0.3
      if (up > 0) {
        const dy = -(1 - up) * (top + sh + 60 * u), ax = sw * 0.34
        for (const q of [-1, 1]) string(ctx, sx + q * ax, -10, sx + q * ax, top + dy + 16 * u, 'rgba(80,60,40,0.6)', 2.4)
        place(ctx, sx, top + dy + sh / 2, { rot: -0.01, seed: 9, amp: 0.6 }, c => {
          card(c, -sw / 2, -sh / 2, sw, sh, k.paper, { r: 18 * u, seed: 10, lift: 1.4 })
          for (const q of [-1, 1]) brad(c, q * ax, -sh / 2 + 16 * u, 8 * u)
          // 高亮词可能折到两行：按它在整句里的位置逐行切出要贴纸条的那一截
          const hl = sc.highlight ? String(sc.highlight) : '', hs0 = hl ? f.lines.join('').indexOf(hl) : -1, hk = kf(t, c0 + 0.5, 0.375)
          let off = 0
          f.lines.forEach((ln, j) => {
            const y = -sh / 2 + pad + (j + 0.5) * f.lineH
            c.font = bold(E, f.size); c.textBaseline = 'middle'; c.textAlign = 'left'
            const lw = c.measureText(ln).width, x0 = -lw / 2, a0 = Math.max(0, hs0 - off), a1 = Math.min(ln.length, hs0 + hl.length - off)
            off += ln.length
            if (hs0 < 0 || a1 <= a0) { c.fillStyle = k.ink; c.fillText(ln, x0, y); return }
            const pre = ln.slice(0, a0), mid = ln.slice(a0, a1), wp = c.measureText(pre).width, wm = c.measureText(mid).width
            if (hk > 0) { c.save(); c.translate(x0 + wp - 10 * u, y); c.rotate(hs(j, 3) * 0.02); card(c, 0, -f.size * 0.62, (wm + 20 * u) * hk, f.size * 1.24, k.acc, { r: 8 * u, seed: 20 + j, lift: 0.7 }); c.restore() }
            c.font = bold(E, f.size); c.textBaseline = 'middle'; c.textAlign = 'left'
            c.fillStyle = k.ink; c.fillText(pre, x0, y)
            c.fillStyle = hk >= 1 ? k.on : k.acc; c.fillText(mid, x0 + wp, y)
            c.fillStyle = k.ink; c.fillText(ln.slice(a1), x0 + wp + wm, y)
          })
        })
      }
      doll(ctx, por ? b.x + 170 * u : b.r - 150 * u, g.floor, ds * u, actor(X, { seed: 4, face: landed ? 'happy' : 'o', look: por ? 1 : -1, armL: !por && landed ? 2.1 : 0.2, armR: por && landed ? 2.1 : 0.2 }))
      stageFront(ctx, E, g, X.z)
    },

    // 要点：一串吊着线的纸牌挂在一根纸横杆下，一张接一张晃进来；横屏小人站在右边指着
    bullets(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X, n = sc.items.length
      const side = por ? 0 : 330 * u, cw = por ? b.w : b.w - side, cx = b.x + cw / 2
      const hy = heading(ctx, s, E, X, sc.title, cx, cw), rail = hy + 8 * u, top = rail + 16 * u, bot = g.floor - E.pick(14, 24) * u
      const slot = (bot - top) / n, gs = Math.min(38 * u, slot * 0.22), ch = Math.min(slot - gs, E.pick(140, 190) * u)
      const nt = Math.min(ch * 0.62, 88 * u), pad = 22 * u, lead = pad + nt + 26 * u
      const FS = fitAll(E, sc.items, sc.items.map(() => ({ role: 'body', weight: 500, size: Math.min(E.pick(50, 50) * u, ch * 0.44), maxW: cw - lead - pad * 1.5, maxLines: 2, maxH: ch * 0.86, lineGap: 1.22 })))
      // 纸牌一样宽：按最长的一条定宽，不短于栏宽的六成
      const pw = clamp(lead + Math.max(...FS.map(f => f.width)) + pad * 2.5, cw * 0.6, cw), tx = -pw / 2 + lead
      const y0 = top + gs + (bot - top - n * (ch + gs)) * 0.3, ax = pw * 0.36
      const kr = rise(t, s.cue(0) - 0.2)
      if (kr > 0) place(ctx, cx, rail, { s: Math.min(1, kr), seed: 12, amp: 0.5 }, c => { card(c, -cw * 0.45, -7 * u, cw * 0.9, 14 * u, k.line, { r: 6 * u, seed: 13, lift: 0.9 }); for (const q of [-1, 1]) brad(c, q * cw * 0.43, 0, 8 * u) })
      let prev = [[cx - ax, rail], [cx + ax, rail]], seen = -1
      sc.items.forEach((it, i) => {
        const kb = kf(t, s.cue(i + 1), 0.5)
        if (kb <= 0 || kr <= 0) return
        seen = i
        const yt = y0 + i * (ch + gs), rot = 0.13 * Math.cos(kb * Math.PI * 1.5) * (1 - kb), cs = Math.cos(rot), sn = Math.sin(rot)
        ;[-1, 1].forEach((q, j) => string(ctx, prev[j][0], prev[j][1], cx + q * ax * cs, yt + q * ax * sn + 10 * u, 'rgba(80,60,40,0.6)', 2.2))
        prev = [-1, 1].map(q => [cx + q * ax * cs - (ch - 12 * u) * sn, yt + q * ax * sn + (ch - 12 * u) * cs])
        const f = FS[i]
        place(ctx, cx, yt, { rot, seed: 30 + i, amp: 0.8 }, c => {
          card(c, -pw / 2, 0, pw, ch, k.paper, { r: 14 * u, seed: 31 + i, lift: 1.1 })
          for (const q of [-1, 1]) { brad(c, q * ax, 10 * u, 6 * u); brad(c, q * ax, ch - 12 * u, 6 * u) }
          card(c, -pw / 2 + pad, ch / 2 - nt / 2, nt, nt, i % 2 ? k.acc2 : k.acc, { r: 10 * u, seed: 40 + i, lift: 0.6 })
          c.font = bold(E, nt * 0.56); c.fillStyle = k.on; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), -pw / 2 + pad + nt / 2, ch / 2 + nt * 0.03)
          c.font = hand(E, f.size); c.fillStyle = k.ink; drawLines(c, f.lines, tx, ch / 2 - f.lines.length * f.lineH / 2, f.lineH, 'left')
        })
      })
      if (!por) doll(ctx, b.r - 160 * u, g.floor, 0.9 * u, actor(X, { seed: 5, face: seen === n - 1 ? 'happy' : 'smile', look: -1, armL: seen >= 0 ? 1.9 + (seen % 2) * 0.25 : 0.2 }))
      stageFront(ctx, E, g, X.z)
    },

    // 大数字：一个个剪出来的纸数字立在牛皮纸台子上，从 0 滚到目标值；label 和 note 是贴在台子正面的纸签
    number(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X, val = String(sc.value)
      const side = por ? 0 : 330 * u, aw = por ? b.w : b.w - side, ax = b.x + aw / 2, size = E.pick(300, 360) * u
      ctx.font = bold(E, size * 0.34); const uw0 = sc.unit ? ctx.measureText(sc.unit).width + 24 * u : 0
      // 数字的字号跟着位数走：先试排定字号，再正式排（只有真放不下才进报告）
      const fo = { role: 'num', weight: 900, size, maxW: aw * 0.86 - uw0, maxLines: 1, minSize: size * 0.3, lineGap: 1 }
      const f = E.fit(val, { ...fo, size: E.fit(val, { ...fo, silent: true }).size })
      const us = f.size * 0.34; ctx.font = bold(E, us); const uw = sc.unit ? ctx.measureText(sc.unit).width + 22 * u : 0
      const lab = sc.label && fitHand(E, sc.label, E.pick(50, 46) * u, aw * 0.8, 2), note = sc.note && fitHand(E, sc.note, E.pick(36, 36) * u, aw * 0.7, 2)
      const LS = lab ? labelSize(lab) : { w: 0, h: 0 }, NS = note ? labelSize(note) : { w: 0, h: 0 }
      const capH = f.size * 0.74, pw = Math.max(f.width + uw + 90 * u, LS.w + 80 * u, NS.w + 80 * u, 380 * u)
      const need = 40 * u + LS.h + (note ? NS.h + 22 * u : 0) + 40 * u, room = g.floor - b.y - capH - 40 * u
      const ph = Math.max(need, Math.min(room, room * E.pick(0.45, 0.5))), ptop = g.floor - ph, base = ptop - 2 * u
      const up = rise(t, Math.max(0, s.cue(0) - 0.35))
      // 台子是一摞纸板：每块错开一点、深浅相间，最上面一块亮一点
      if (up > 0) place(ctx, ax, g.floor + 40 * u, { sy: up, seed: 7, amp: 0.4 }, c => {
        const nS = Math.max(2, Math.round((ph + 40 * u) / (70 * u))), sh = (ph + 40 * u) / nS
        for (let j = 0; j < nS; j++) card(c, -pw / 2 + hs(j, 41) * 8 * u, -(j + 1) * sh, pw, sh + 2 * u, j === nS - 1 ? shade(k.kraft, 0.18) : j % 2 ? shade(k.kraft, -0.06) : k.kraft, { r: 8 * u, seed: 8 + j, lift: 0.9 })
      })
      const roll = clamp((t - s.cue(0)) / Math.min(1.4, s.dur * 0.35)), shown = [...rolling(sc.value, roll)], nf = E.font('num', 900, f.size)
      ctx.font = nf
      let x = ax - (f.width + uw) / 2 + f.width
      for (let j = shown.length - 1; j >= 0; j--) {
        ctx.font = nf; const w = ctx.measureText(shown[j]).width, cx = x - w / 2; x -= w
        const kk = pop(t, s.cue(0) + (shown.length - 1 - j) / SM)
        if (kk > 0) place(ctx, cx, base, { s: kk, rot: hs(j, 17) * 0.04, seed: 60 + j, amp: 0.7 }, c => cutGlyph(c, E, shown[j], nf, k.acc))
      }
      if (sc.unit) {
        let xu = ax - (f.width + uw) / 2 + f.width + 22 * u
        ;[...sc.unit].forEach((ch, j) => {
          ctx.font = bold(E, us); const w = ctx.measureText(ch).width, kk = pop(t, s.cue(0) + 0.375 + j / SM)
          if (kk > 0) place(ctx, xu + w / 2, base, { s: kk, rot: hs(j, 19) * 0.05, seed: 70 + j, amp: 0.7 }, c => cutGlyph(c, E, ch, bold(E, us), k.acc2))
          xu += w
        })
      }
      let i = 1
      if (lab) { const p = pop(t, s.cue(i++)); place(ctx, ax, ptop + 40 * u + LS.h / 2, { s: p, rot: -0.01, seed: 72 }, c => label(c, lab, hand(E, lab.size), { fill: k.paper, fg: k.ink, seed: 73 })) }
      if (note) { const p = pop(t, s.cue(i++)); place(ctx, ax, ptop + 40 * u + LS.h + 22 * u + NS.h / 2, { s: p, rot: 0.015, seed: 74 }, c => label(c, note, hand(E, note.size), { fill: mix(k.acc2, k.paper, 0.72), fg: k.ink, seed: 75 })) }
      const rolled = roll >= 1
      if (por) doll(ctx, b.r - 140 * u, g.floor, 0.8 * u, actor(X, { seed: 6, face: rolled ? 'happy' : 'o', look: -1, armL: 2.3, armR: rolled ? wave() : 2.3 }))
      else doll(ctx, b.r - 150 * u, g.floor, 0.95 * u, actor(X, { seed: 6, face: rolled ? 'happy' : 'o', look: -1, armL: 2.3, armR: rolled ? wave() : 2.3 }))
      stageFront(ctx, E, g, X.z)
    },

    // 柱状图：每根柱子是一摞纸块，一块一块落上去；数值签贴在顶上那块的正面，标签是插在地上的纸签；
    // 最高（或 highlight 指定）的那摞是强调色，摞好以后小人跳上去
    bars(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc } = X, n = sc.items.length
      const top = heading(ctx, s, E, X, sc.title, E.W / 2, b.w) + 12 * u
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const slot = b.w / n, bw = Math.min(slot * 0.6, 210 * u), base = g.floor - E.pick(36, 44) * u
      const ds = Math.min(0.42, slot * 0.85 / (DOLL_W * u)), dH = DOLL_H * ds * u
      let hMax = Infinity
      vals.forEach((v, i) => { if (v > 0) hMax = Math.min(hMax, (base - top - (i === hi ? dH : 0) - 6 * u) / (v / max)) })
      const LF = fitAll(E, sc.items.map(it => it.label), sc.items.map(() => ({ role: 'body', weight: 500, size: E.pick(34, 32) * u, maxW: slot * 0.96 - 18 * u, maxLines: E.pick(2, 3), lineGap: 1.15 })))
      const VF = fitAll(E, vals.map(v => formatNumber(v, dec) + unit), vals.map(() => ({ role: 'title', weight: 900, size: E.pick(40, 36) * u, maxW: Math.max(bw, slot * 0.86) - 24 * u, maxLines: 1 })))
      const xOf = i => b.x + slot * (i + 0.5)
      let perch = null
      sc.items.forEach((it, i) => {
        const h = hMax * vals[i] / max, nb = Math.max(1, Math.round(h / (46 * u))), bh = h / nb
        const kb = kf(t, s.cue(i + 1), 0.75), m = kb > 0 ? Math.ceil(kb * nb - 1e-6) : 0, col = i === hi ? k.acc : k.kraft
        for (let j = 0; j < m; j++) {
          const drop = j === m - 1 && kb < 1 ? -bh * 0.7 : 0
          place(ctx, xOf(i) + hs(i * 7 + 3, j) * 4 * u, base - (j + 0.5) * bh + drop, { rot: hs(i * 13, j) * 0.025, seed: i * 50 + j, amp: 0.6 }, c => card(c, -bw / 2, -bh / 2 + 1.5 * u, bw, Math.max(2 * u, bh - 3 * u), j % 2 ? shade(col, -0.07) : col, { r: Math.min(6 * u, bh / 3), seed: i * 50 + j, lift: 0.8 }))
        }
        if (kb >= 1) {
          const VS = labelSize(VF[i]), vy = h > VS.h + 16 * u ? base - h + VS.h / 2 + 8 * u : base - h - VS.h / 2 - 6 * u
          place(ctx, xOf(i), vy, { s: pop(t, s.cue(i + 1) + 0.75), rot: hs(i, 23) * 0.03, seed: 80 + i, amp: 0.6 }, c => label(c, VF[i], bold(E, VF[i].size), { fill: k.paper, fg: i === hi ? k.acc : k.ink, seed: 81 + i, lift: 0.8 }))
          if (i === hi) perch = [xOf(i), base - h, s.cue(i + 1) + 0.75]
        }
      })
      if (perch && t > perch[2]) {
        const hk = kf(t, perch[2], 0.375)
        doll(ctx, perch[0], perch[1] - Math.sin(hk * Math.PI) * 70 * u, ds * u, actor(X, { seed: 7, face: 'happy', armL: wave(), armR: wave(), noGround: hk < 1 }))
      }
      stageFront(ctx, E, g, X.z)
      sc.items.forEach((it, i) => {
        const LS = labelSize(LF[i])
        place(ctx, xOf(i), base + 6 * u + LS.h / 2, { s: pop(t, s.cue(i + 1)), rot: hs(i, 29) * 0.03, seed: 90 + i, amp: 0.6 }, c => label(c, LF[i], hand(E, LF[i].size), { fill: k.paper, fg: k.ink, seed: 91 + i, lift: 0.9 }))
      })
    },

    // 流程：几块纸踏板，小人一块一块跳过去，最后一块上欢呼。横屏是一排越来越高的纸柱（台阶），
    // 竖屏是左右交错、从下往上的纸搁板
    steps(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X, n = sc.items.length
      const top = heading(ctx, s, E, X, sc.title, E.W / 2, b.w) + 10 * u
      const nt = E.pick(56, 60) * u, pad = 18 * u, cue = i => s.cue(i + 1)
      const tile = (c, x, y, i) => {
        card(c, x, y, nt, nt, i === n - 1 ? k.acc : k.acc2, { r: 10 * u, seed: 40 + i, lift: 0.7 })
        c.font = bold(E, nt * 0.56); c.fillStyle = k.on; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), x + nt / 2, y + nt / 2 + nt * 0.03)
      }
      let spots, ds
      if (!por) {
        const slot = b.w / n, cw = slot * 0.84
        ds = Math.min(0.6, cw * 0.8 / (DOLL_W * u))
        const FS = fitAll(E, sc.items, sc.items.map(() => ({ role: 'body', weight: 500, size: 50 * u, maxW: cw - pad * 2 - 12 * u, maxLines: 3, lineGap: 1.22 })))
        const cardH = Math.max(...FS.map(f => f.lines.length * f.lineH)) + pad * 2 + nt * 0.4, h0 = cardH + 50 * u
        const lift = n > 1 ? clamp((g.floor - h0 - (top + DOLL_H * ds * u + 16 * u)) / (n - 1), 0, 150 * u) : 0
        spots = sc.items.map((_, i) => [b.x + slot * (i + 0.5), g.floor - h0 - i * lift])
        sc.items.forEach((it, i) => {
          const up = rise(t, cue(i) - 0.1), [x, y] = spots[i]
          if (up > 0) place(ctx, x, g.floor + 40 * u, { sy: up, seed: 20 + i, amp: 0.5 }, c => {
            const y0 = y - g.floor - 40 * u
            card(c, -cw / 2, y0, cw, -y0 + 10 * u, k.kraft, { r: 10 * u, seed: 21 + i, lift: 1.2 })
            card(c, -cw / 2, y0, cw, 16 * u, shade(k.kraft, 0.3), { r: 8 * u, seed: 22 + i, lift: 0, edge: false })
            const cy0 = y0 + 30 * u, f = FS[i]
            card(c, -cw / 2 + 12 * u, cy0, cw - 24 * u, cardH, k.paper, { r: 10 * u, seed: 23 + i, lift: 0.7 })
            tile(c, -cw / 2 + 2 * u, cy0 - nt * 0.3, i)
            c.font = hand(E, f.size); c.fillStyle = k.ink; drawLines(c, f.lines, 0, cy0 + nt * 0.4 + pad + (cardH - nt * 0.4 - pad * 2 - f.lines.length * f.lineH) / 2, f.lineH, 'center')
          })
        })
      } else {
        const lw = b.w * 0.7, bh = 26 * u
        ds = 0.48
        const FS = fitAll(E, sc.items, sc.items.map(() => ({ role: 'body', weight: 500, size: 50 * u, maxW: lw - nt - pad * 3 - 10 * u, maxLines: 2, lineGap: 1.22 })))
        const lh = Math.max(nt, Math.max(...FS.map(f => f.lines.length * f.lineH))) + pad * 2, dH = DOLL_H * ds * u
        const lift = n > 1 ? Math.min(lh + bh + dH + 60 * u, (g.floor - 8 * u - lh - bh - top - dH - 10 * u) / (n - 1)) : 0
        sc.items.forEach((it, i) => {
          const L = i % 2 === 0, y = g.floor - 8 * u - lh - bh - i * lift, x = L ? b.x + lw / 2 : b.r - lw / 2, f = FS[i]
          const kb = kf(t, cue(i) - 0.1, 0.5)
          if (kb > 0) place(ctx, x + (L ? -1 : 1) * (1 - outBack(kb)) * (lw + 120 * u), y, { seed: 20 + i, amp: 0.6 }, c => {
            card(c, -lw / 2 + 14 * u, bh - 6 * u, lw - 28 * u, lh, k.paper, { r: 10 * u, seed: 23 + i, lift: 0.9 })
            card(c, -lw / 2, 0, lw, bh, k.kraft, { r: 8 * u, seed: 21 + i, lift: 1.1 })
            tile(c, -lw / 2 + 14 * u + pad, bh - 6 * u + (lh - nt) / 2, i)
            c.font = hand(E, f.size); c.fillStyle = k.ink; drawLines(c, f.lines, -lw / 2 + 14 * u + pad * 2 + nt, bh - 6 * u + (lh - f.lines.length * f.lineH) / 2, f.lineH, 'left')
          })
        })
        spots = sc.items.map((_, i) => [i % 2 === 0 ? b.x + 110 * u : b.r - 110 * u, g.floor - 8 * u - lh - bh - i * lift])
      }
      // 小人：站在最新出现的那块踏板上；新的一块出来后跳过去（三格的弧线）
      let cur = -1
      for (let i = 0; i < n; i++) if (t >= cue(i) + 0.3) cur = i
      if (cur >= 0) {
        const hk = cur > 0 ? kf(t, cue(cur) + 0.25, 0.375) : 1, a = spots[Math.max(0, cur - 1)], z = spots[cur], last = cur === n - 1 && hk >= 1
        doll(ctx, lerp(a[0], z[0], hk), lerp(a[1], z[1], hk) - Math.sin(hk * Math.PI) * 90 * u, ds * u, actor(X, { seed: 8, face: last ? 'happy' : 'smile', look: por ? 0 : 1, armL: last ? wave() : hk < 1 ? 1.2 : 0.3, armR: last ? wave() : hk < 1 ? 1.2 : 0.3, noGround: hk < 1 }))
      }
      stageFront(ctx, E, g, X.z)
    },

    // 对比：左右（竖屏上下）两个纸舞台，帷幔上是两边的标题，台上一条条纸签；右边是推荐的一方，
    // 强调色帷幔、条目前贴纸条勾。每个台上一个小人：左边的面无表情，右边的高兴
    compare(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X
      const top = heading(ctx, s, E, X, sc.title, E.W / 2, b.w) + 14 * u, gap = E.pick(56, 40) * u, bot = g.floor + 6 * u
      const boxes = por ? [[b.x, top, b.w, (bot - top - gap) / 2], [b.x, top + (bot - top + gap) / 2, b.w, (bot - top - gap) / 2]]
        : [[b.x, top, (b.w - gap) / 2, bot - top], [b.x + (b.w + gap) / 2, top, (b.w - gap) / 2, bot - top]]
      const vh = E.pick(92, 84) * u, cwid = 30 * u, fh = 24 * u
      const G = [sc.left, sc.right].map((side, i) => {
        const [x, y, w, h] = boxes[i], dc = Math.min(230 * u, w * 0.3), items = side.items || []
        const ix0 = i ? x + cwid + 30 * u : x + cwid + dc, ix1 = i ? x + w - cwid - dc : x + w - cwid - 24 * u
        const iy0 = y + vh + 14 * u, iy1 = y + h - fh - 14 * u, rowH = Math.min((iy1 - iy0) / Math.max(1, items.length), 130 * u)
        const tf = E.fit(side.title, { role: 'title', weight: 900, size: E.pick(50, 46) * u, maxW: w - cwid * 2 - 60 * u, maxLines: 1 })
        return { x, y, w, h, dc, items, ix0, ix1, iy0, iy1, rowH, tf, o: { role: 'body', weight: 500, size: Math.min(E.pick(44, 44) * u, rowH * 0.42), maxW: ix1 - ix0 - 50 * u, maxLines: 2, maxH: rowH * 0.92, lineGap: 1.2 } }
      })
      const all = fitAll(E, G.flatMap(q => q.items), G.flatMap(q => q.items.map(() => q.o)))
      G.forEach((q, i) => {
        const strong = i === 1, up = rise(t, s.cue(i + 1) - 0.1), { x, y, w, h, tf } = q
        if (up <= 0) return
        const valC = strong ? k.acc : shade(k.kraft, -0.04), curC = strong ? shade(k.acc, -0.15) : k.line, backC = strong ? mix(k.acc, k.paper, 0.84) : mix(k.kraft, k.paper, 0.5)
        place(ctx, x + w / 2, y + h, { sy: up, seed: 50 + i, amp: 0.5 }, c => {
          const L = -w / 2, T = -h
          card(c, L + 6 * u, T + vh * 0.5, w - 12 * u, h - vh * 0.5 - fh * 0.5, backC, { r: 10 * u, seed: 51 + i, lift: 1.1 })
          for (const cx of [L + 2 * u, L + w - cwid - 2 * u]) card(c, cx, T + vh * 0.4, cwid, h - vh * 0.4 - fh * 0.6, curC, { r: 8 * u, seed: 52 + i + cx, lift: 0.9 })
          card(c, L - 8 * u, -fh, w + 16 * u, fh, shade(k.line, -0.08), { r: 6 * u, seed: 53 + i, lift: 1 })
          const yb = T + vh - 16 * u, nS = Math.max(4, Math.round((w + 20 * u) / (64 * u))), seg = (w + 20 * u) / nS, pts = [[L - 10 * u, T], [L + w + 10 * u, T]]
          for (let j = nS - 1; j >= 0; j--) for (let a = 0; a <= 6; a++) { const ang = Math.PI * a / 6; pts.push([L - 10 * u + seg * (j + 0.5) + Math.cos(ang) * seg / 2, yb + Math.sin(ang) * seg * 0.32]) }
          cutPoly(c, pts, 54 + i); fillPaper(c, valC, 1.2)
          c.font = bold(E, tf.size); c.fillStyle = strong ? k.on : k.ink; drawLines(c, tf.lines, 0, T + (vh - 16 * u - tf.lineH) / 2 + 4 * u, tf.lineH, 'center')
        })
        if (up < 1) return
        const fs = i ? all.slice(G[0].items.length) : all.slice(0, G[0].items.length)
        fs.forEach((f, j) => {
          const cy = q.iy0 + q.rowH * (j + 0.5), p = pop(t, s.cue(i + 1) + 0.3 + j / SM)
          place(ctx, q.ix0, cy, { s: p, seed: 60 + i * 9 + j, amp: 0.6 }, c => {
            if (strong) { c.save(); c.translate(16 * u, 0); paperCheck(c, 36 * u, k.acc2, 61 + j); c.restore() } else { cutCircle(c, 16 * u, 0, 9 * u, 62 + j); fillPaper(c, k.line, 0.6) }
            c.font = hand(E, f.size); c.fillStyle = k.ink; drawLines(c, f.lines, 46 * u, -f.lines.length * f.lineH / 2, f.lineH, 'left')
          })
        })
        const dsz = Math.min((q.h - vh - fh) * 0.78 / (DOLL_H * u), q.dc * 0.95 / (DOLL_W * u))
        doll(ctx, i ? x + w - cwid - q.dc / 2 - 6 * u : x + cwid + q.dc / 2 + 6 * u, y + h - fh + 4 * u, dsz * u, actor(X, { seed: 9 + i, face: strong ? 'happy' : 'flat', look: i ? -1 : 1, armR: strong ? wave() : 0.15, noGround: true }))
      })
      stageFront(ctx, E, g, X.z)
    },

    // 引语：小人站在左下，说出一只大纸气泡；左上角压一枚剪出来的大引号，出处是贴在气泡下面的牛皮纸签
    quote(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X
      const ds = E.pick(1.0, 0.95), dH = DOLL_H * ds * u, dx = b.x + E.pick(150, 170) * u
      const R = por ? { x: b.x, y: b.y + 40 * u, w: b.w, h: g.floor - dH - 110 * u - b.y - 40 * u } : { x: b.x + 330 * u, y: b.y + 10 * u, w: b.w - 330 * u, h: g.floor - 170 * u - b.y - 10 * u }
      const padX = E.pick(76, 60) * u, padY = E.pick(60, 52) * u
      const byf = sc.by && fitHand(E, '— ' + sc.by, 38 * u, R.w * 0.7, 1), BS = byf ? labelSize(byf) : { w: 0, h: 0 }, byRoom = byf ? BS.h + 30 * u : 0
      const f = fitHand(E, sc.text, E.pick(70, 64) * u, R.w - padX * 2, E.pick(4, 6), { maxH: R.h - padY * 2 - byRoom, lineGap: 1.38 })
      const bw = Math.max(f.width + padX * 2, R.w * 0.55), bh = f.lines.length * f.lineH + padY * 2
      const bx = R.x + R.w / 2, by = R.y + Math.max(0, (R.h - byRoom - bh) * E.pick(0.6, 0.85)) + bh / 2, c0 = s.cue(0), kb = pop(t, c0 - 0.1)
      if (kb > 0) place(ctx, bx, by, { s: kb, seed: 30, amp: 0.7 }, c => {
        // 尾巴：从气泡左下沿伸向小人的头，根部宽、尖朝小人
        const b0 = [-bw / 2 + 70 * u, bh / 2 - 14 * u], b1 = [-bw / 2 + 210 * u, bh / 2 - 14 * u], hx = dx + 40 * u - bx, hy = g.floor - 210 * ds * u - by
        cutPoly(c, [b0, b1, [lerp(b0[0], hx, 0.8), lerp(b0[1], hy, 0.8)]], 31); fillPaper(c, k.paper, 1.2)
        card(c, -bw / 2, -bh / 2, bw, bh, k.paper, { r: Math.min(60 * u, bh * 0.4), seed: 32, lift: 1.4 })
        c.font = hand(E, f.size); c.fillStyle = k.ink; drawLines(c, f.lines, 0, -bh / 2 + padY, f.lineH, 'center')
        c.save(); c.translate(-bw / 2 + 34 * u, -bh / 2 + 150 * u); c.rotate(-0.08); cutGlyph(c, E, '“', bold(E, 210 * u), k.acc); c.restore()
      })
      if (byf) place(ctx, bx + bw / 2 - BS.w / 2 - 20 * u, by + bh / 2 + 26 * u + BS.h / 2, { s: pop(t, s.cue(1)), rot: 0.02, seed: 33 }, c => label(c, byf, hand(E, byf.size), { fill: P.kraft, fg: k.ink, seed: 34 }))
      const talk = t >= c0 && t < s.dur * 0.65
      doll(ctx, dx, g.floor, ds * u, actor(X, { seed: 10, face: talk ? (frameNo() % 4 < 2 ? 'o' : 'smile') : 'happy', look: 1, armR: talk ? 0.9 + (frameNo() % 4 < 2 ? 0.3 : 0) : 0.3 }))
      stageFront(ctx, E, g, X.z)
    },

    // 片尾：夜景，吊线纸星星和纸月亮。标题字块一块一块吊在线上轻轻晃；副标题是纸签，按钮是一块有厚度的纸按钮，会被按一下；小人挥手
    end(ctx, s, E) {
      const X = setup(this, s, E), { t, g, k, u, b, sc, por } = X
      let i = 0
      const ct = s.cue(i++), cs = sc.subtitle ? s.cue(i++) : 0, cc = sc.cta ? s.cue(i++) : 0
      const ds = E.pick(0.95, 0.9), dH = DOLL_H * ds * u, side = por ? 0 : 300 * u, cx = b.x + (b.w - side) / 2, mw = b.w - side - 40 * u
      const tf = tileFit(ctx, E, sc.title, { size: E.pick(116, 104) * u, maxW: mw, maxLines: E.pick(2, 3) })
      const sf = sc.subtitle && fitHand(E, sc.subtitle, 46 * u, mw * 0.9, 2), cf = sc.cta && E.fit(sc.cta, { role: 'title', weight: 900, size: 50 * u, maxW: mw * 0.7, maxLines: 1 })
      const SS = sf ? labelSize(sf) : { h: 0 }, bh = cf ? cf.size * 2.1 : 0, bw = cf ? cf.width + cf.size * 2.4 : 0, rowH = tf.rowH * 1.14
      const total = rowH * tf.lines.length + (sf ? SS.h + 40 * u : 0) + (cf ? bh + 56 * u : 0), lo = por ? g.floor - dH - 40 * u : g.floor - 30 * u
      let y = b.y + 60 * u + Math.max(0, (lo - b.y - 60 * u - total) * 0.45)
      // 吊线字块：线先画（在字块后面），字块绕线头轻轻晃
      const st = tileStep(tf), font = sz => bold(E, sz), ts = tf.size, F = frameNo()
      let n0 = 0
      const rows = tf.lines.map((ln, j) => { const m = tileRow(ctx, ln, ts, font), r = { ln, m, y: y + j * rowH, n0 }; n0 += [...ln].length; return r })
      for (const pass of [0, 1]) rows.forEach(r => {
        let x = cx - r.m.total / 2
        ;[...r.ln].forEach((ch, j) => {
          const w = r.m.ws[j], n = r.n0 + j, kk = pop(t, ct + n * st), mx = x + w / 2
          x += w + r.m.gap
          if (ch === ' ' || kk <= 0) return
          if (!pass) { string(ctx, mx, -10, mx, r.y + 8 * u, 'rgba(230,220,240,0.55)', 1.6); return }
          place(ctx, mx, r.y, { s: kk, rot: Math.sin(F * 0.8 + n * 1.3) * 0.045, seed: 40 + n, amp: 0.4 }, c => {
            card(c, -w / 2, 0, w, ts, [k.paper, P.mustard, k.paper, P.pink][n % 4], { r: ts * 0.12, seed: 41 + n, lift: 1.1 })
            brad(c, 0, 8 * u, 4 * u)
            c.font = font(ts * 0.62); c.fillStyle = k.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, ts * 0.54)
          })
        })
      })
      y += rowH * tf.lines.length + 20 * u
      if (sf) { place(ctx, cx, y + SS.h / 2, { s: pop(t, cs), rot: -0.015, seed: 50 }, c => label(c, sf, hand(E, sf.size), { fill: k.paper, fg: k.ink, seed: 51 })); y += SS.h + 40 * u }
      if (cf) {
        const pressed = t >= cc + 0.9 && t < cc + 0.9 + 2 / SM, d = (pressed ? 3 : 12) * u
        place(ctx, cx, y + 20 * u + bh / 2, { s: pop(t, cc), seed: 52, amp: 0.6 }, c => {
          card(c, -bw / 2, -bh / 2 + 12 * u, bw, bh, shade(k.acc, -0.32), { r: bh * 0.32, seed: 53, lift: 1.3 })
          card(c, -bw / 2, -bh / 2 + 12 * u - d, bw, bh, k.acc, { r: bh * 0.32, seed: 54, lift: 0 })
          c.font = bold(E, cf.size); c.fillStyle = k.on; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cf.lines[0], 0, 12 * u - d + cf.size * 0.04)
        })
      }
      doll(ctx, por ? E.W / 2 : b.r - 140 * u, g.floor, ds * u, actor(X, { seed: 11, face: 'happy', look: por ? 0 : -1, armR: t >= ct ? wave() : 0.2 }))
      stageFront(ctx, E, g, X.z)
    },
  },

  // 字幕：奶白撕边纸条，左右两端锯齿，略歪，左上角贴一小块透明胶带
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    useE(E)
    const { W, H, u } = E, c = this.c, t = tq(s, E)
    const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(x => textUnits(x)), total = lens.reduce((a, v) => a + v, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const a = Math.min(clamp((t - t0) / 0.25), idx === chunks.length - 1 ? 1 : clamp((t1 - t) / 0.125))
    if (a <= 0) return
    const size = E.pick(42, 46) * u, txt = chunks[idx].replace(/[，、：:,]$/u, '')
    const f = E.fit(txt, { role: 'body', weight: 500, size, maxW: W - E.safe.l * 2 - size * 1.6, maxLines: 2, lineGap: 1.32, quiet: true })
    const padX = size * 0.8, padY = size * 0.36, bw = f.width + padX * 2, bh = f.lines.length * f.lineH + padY * 2
    const seed = Math.floor(hash(txt.length, txt.charCodeAt(0)) * 1000), x0 = -bw / 2, x1 = bw / 2, y0 = -bh / 2, y1 = bh / 2, st = 30 * u, nz = Math.ceil(bh / (9 * u))
    ctx.globalAlpha = a
    ctx.translate(W / 2, H - E.captionH / 2 - (E.portrait ? 30 * u : 0) + (1 - a) * 10 * u); ctx.rotate(hs(seed, 1) * 0.008)
    ctx.beginPath(); ctx.moveTo(x0, y0)
    for (let x = x0 + st; x < x1; x += st) ctx.lineTo(x, y0 + hs(seed, x / u) * 1.2 * u)
    ctx.lineTo(x1, y0)
    for (let i = 1; i <= nz; i++) ctx.lineTo(x1 + ((i % 2 ? 7 : 0) + hs(seed + 1, i) * 2.5) * u, y0 + bh * i / nz)
    for (let x = x1 - st; x > x0; x -= st) ctx.lineTo(x, y1 + hs(seed + 2, x / u) * 1.2 * u)
    ctx.lineTo(x0, y1)
    for (let i = nz - 1; i >= 0; i--) ctx.lineTo(x0 - ((i % 2 ? 7 : 0) + hs(seed + 3, i) * 2.5) * u, y0 + bh * i / nz)
    ctx.closePath()
    ctx.save(); shadow(ctx, 1.3, 0.28); ctx.fillStyle = c.card; ctx.fill(); ctx.restore()
    ctx.strokeStyle = 'rgba(160,130,95,0.25)'; ctx.lineWidth = 1.2 * u; ctx.stroke()
    ctx.save(); ctx.translate(x0 + 26 * u, y0 + 2 * u); ctx.rotate(-0.5); ctx.fillStyle = 'rgba(255,248,220,0.6)'; ctx.fillRect(-28 * u, -10 * u, 56 * u, 20 * u); ctx.restore()
    ctx.fillStyle = c.fg; ctx.font = E.font('body', 500, f.size); drawLines(ctx, f.lines, 0, y0 + padY, f.lineH, 'center')
  },

  // 最上层：固定的纸纹和暗角（只算一次，不跟着抖），再加每个定格帧一点点明暗差，像逐张拍摄的灯光
  overlay(ctx, E) {
    useE(E)
    ctx.drawImage(E.once('pc-grain', () => grain(E)), 0, 0)
    ctx.fillStyle = `rgba(40,22,8,${0.012 + 0.026 * hash(frameNo(), 5)})`; ctx.fillRect(0, 0, E.W, E.H)
  },

  // 转场：新的一张卡纸（带毛边）按定格一格一格从右边推进来，盖住上一场
  transitionDur: 0.5,
  transition(ctx, A, B, p, E) {
    const { W, H, u } = E, e = inOut(Math.min(1, Math.ceil(p * 4) / 4)), X0 = W * (1 - e) + (e < 1 ? 14 * u : 0)
    ctx.drawImage(A, -W * 0.06 * e, 0)
    if (e <= 0) return
    const edge = () => { ctx.beginPath(); ctx.moveTo(X0, -10); for (let y = 0; y <= H + 20; y += 22 * u) ctx.lineTo(X0 + (hs(77, y / u) * 6 + Math.sin(y / (90 * u)) * 4) * u, y); ctx.lineTo(W + 40, H + 20); ctx.lineTo(W + 40, -10); ctx.closePath() }
    ctx.save(); edge(); ctx.shadowColor = 'rgba(60,35,15,0.38)'; ctx.shadowBlur = 30 * u; ctx.shadowOffsetX = -10 * u; ctx.fillStyle = this.c.bg; ctx.fill(); ctx.restore()
    ctx.save(); edge(); ctx.clip(); ctx.drawImage(B, X0, 0); ctx.restore()
    ctx.save(); edge(); ctx.strokeStyle = 'rgba(255,250,240,0.6)'; ctx.lineWidth = 3 * u; ctx.stroke(); ctx.restore()
  },

  // 默认摆法会用到的零件（九种版式都重画了，custom 场借用时才用到）：纸卡、纸块柱、纸圆点、纸条下划线
  card(ctx, E, x, y, w, h, o = {}) { useE(E); card(ctx, x, y, w, h, o.tone === 'accent' ? this.c.accent : this.c.card, { r: 14 * E.u, seed: o.seed || 1 }) },
  bar(ctx, E, x, y, w, h, o = {}) { useE(E); if (Math.abs(w) > 1 && Math.abs(h) > 1) card(ctx, Math.min(x, x + w), Math.min(y, y + h), Math.abs(w), Math.abs(h), o.color ?? this.c.accent, { r: 6 * E.u, seed: o.seed || 2 }) },
  mark(ctx, E, x, y, r, i, o = {}) { useE(E); cutCircle(ctx, x, y, r, 3 + i); fillPaper(ctx, o.color ?? (i % 2 ? this.c.accent2 : this.c.accent), 0.7) },
  underline(ctx, E, x, y, w, p) { useE(E); if (p > 0) card(ctx, x, y - 4 * E.u, w * p, 12 * E.u, this.c.accent, { r: 5 * E.u, seed: 4, lift: 0.6 }) },

  // 自己加的音效：台阶走到最后一块、小人跳上最高那摞、片尾按钮被按下
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const sc = S.scene, last = S.cues[S.cues.length - 1]
      if (S.layout === 'steps') out.push({ t: S.t0 + last + 0.625, kind: 'chime', gain: 0.28 })
      if (S.layout === 'end' && sc.cta) out.push({ t: S.t0 + last + 0.9, kind: 'thud', gain: 0.3 })
      if (S.layout === 'bars') {
        const v = sc.items.map(it => Number(it.value)), hi = sc.highlight != null ? Number(sc.highlight) - 1 : v.indexOf(Math.max(...v))
        out.push({ t: S.t0 + S.cues[Math.min(hi + 1, S.cues.length - 1)] + 1.1, kind: 'tick', gain: 0.3 })
      }
    }
    return out
  },
}

// 纸纹：确定性噪点 + 纤维 + 暗角，整片只算一次
function grain(E) {
  const c = E.createCanvas(E.W, E.H), g = c.getContext('2d'), img = g.createImageData(E.W, E.H), d = img.data, r = E.rng(29)
  for (let i = 0; i < d.length; i += 4) { const v = r(), dark = v < 0.5; d[i] = dark ? 90 : 255; d[i + 1] = dark ? 62 : 248; d[i + 2] = dark ? 36 : 232; d[i + 3] = Math.floor(Math.abs(v - 0.5) * 26) }
  g.putImageData(img, 0, 0)
  g.strokeStyle = 'rgba(120,90,60,0.06)'; g.lineWidth = E.u
  for (let i = 0; i < 900; i++) {
    const x = r() * E.W, y = r() * E.H, a = r() * Math.PI, L = (6 + r() * 18) * E.u
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 3, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke()
  }
  const vg = g.createRadialGradient(E.W / 2, E.H / 2, Math.min(E.W, E.H) * 0.45, E.W / 2, E.H / 2, Math.hypot(E.W, E.H) * 0.62)
  vg.addColorStop(0, 'rgba(80,50,25,0)'); vg.addColorStop(1, 'rgba(80,50,25,0.16)')
  g.fillStyle = vg; g.fillRect(0, 0, E.W, E.H)
  return c
}
