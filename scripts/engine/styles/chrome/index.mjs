// 风格包：酸性镀铬（chrome）。流动的液态渐变底、扭动的细网格、镀铬立体字、星形闪光、白边贴纸。
// title 是镀铬大字套一圈液态光圈、贴纸小标题；statement 是液态底上的一句镀铬大字，高亮词是荧光绿镀铬、下面一道波浪线；
// bullets 是一串镀铬边胶囊，前面一枚圆贴纸编号；number 是巨大的荧光绿镀铬数字滚上去，套一圈光圈；
// bars 是镀铬柱子，数值也是镀铬字；steps 是一串镀铬胶囊和箭头，最后一步是荧光绿贴纸；
// compare 是粉、绿两块贴纸面板从两边撞到一起，中间一枚镀铬 VS；quote 是镀铬边框的面板，角上一个粉色镀铬引号；
// end 是镀铬字外面一圈转动的星，按钮是一张荧光绿贴纸，一个光标点它。
// 字幕是深紫胶囊加镀铬边框，两端各一颗星；最上层是超宽字距的角标；转场是液面从下往上漫过、旧画面横向液化。
// 镀铬字、贴纸、星、液态底的画法移植自风格库的 Z-酸性镀铬（见 lib/ 和 NOTES.md）。
import { clamp, mix, rgba, roundRect, drawLines, formatNumber, decimalsOf, textUnits } from '../../core.mjs'
import { captionChunks, rolling } from '../../layouts.mjs'
import { TAU, pal, enter, M, around, idle, jolt, sweep, prog, outCubic, tex, drawSet, glyphRun, textW, star, burst, twinkle, sticker, tag, chromePanel, dot, pillar, ring, arrow, wide, cursor, disc } from './lib/acid.mjs'
import { background } from './lib/liquid.mjs'

const ent = (s, i, d = 0.5) => clamp((s.t - s.cue(i)) / d)
const two = i => String(i + 1).padStart(2, '0')
const DENSE = new Set(['bullets', 'bars', 'steps', 'compare', 'quote'])
const tagH = f => f.lines.length * f.lineH + f.size * 0.6

// 几段字用同一个字号（取各自能放下的最小字号），一场里的条目字号不忽大忽小
function fitSame(E, texts, opt) {
  const os = texts.map((_, i) => opt(i))
  const size = Math.min(...texts.map((t, i) => E.fit(t, { ...os[i], silent: true }).size))
  return texts.map((t, i) => E.fit(t, { ...os[i], size, minSize: os[i].size * 0.55 }))
}
// 以 (x, y) 为中心按变换 m 画 fn 里的东西
function within(ctx, x, y, m, fn) { if ((m.a ?? 1) <= 0) return; ctx.save(); around(ctx, x, y, m); fn(); ctx.restore() }
// 场标题：左上角一行镀铬字，横向拉长后弹回，末尾一颗闪星。返回下面可用区域的 y
function head(ctx, s, E, text) {
  const a = E.L.box, u = E.u, t = s.t
  if (!text) return a.y
  const f = E.fit(text, { role: 'title', weight: 900, size: E.pick(76, 70) * u, maxW: a.w - 70 * u, maxLines: 2, oneLine: true, lineGap: 1.2 })
  const q = ent(s, 0, 0.6)
  drawSet(ctx, f.lines.map((ln, j) => ({ T: tex(E, ln, f.size), x: a.x, y: a.y + j * f.lineH + f.lineH / 2, align: 'left', o: M(enter(clamp(q * 1.1 - j * 0.1), 'stretch'), { shine: sweep(t, s.cue(0) + 0.8, 3.2) }) })))
  twinkle(ctx, E, a.x + f.width + 34 * u, a.y + f.lineH * 0.3, 24 * u, t, s.cue(0) + 0.4, 5, pal(E).lime)
  return a.y + f.lines.length * f.lineH + E.pick(34, 44) * u
}
// 波浪线：深色衬边 + 彩色 + 白色细芯，一直在流
function wave(ctx, E, x, y, w, t, col) {
  if (w <= 2) return
  const u = E.u, k = pal(E), amp = 6 * u, per = 46 * u
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath()
  for (let d = 0; d <= w; d += 6 * u) { const yy = y + amp * Math.sin(d / per * TAU - t * 5); d ? ctx.lineTo(x + d, yy) : ctx.moveTo(x, yy) }
  for (const [lw, c] of [[15 * u, k.ink], [9 * u, col], [2.5 * u, 'rgba(255,255,255,0.85)']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke() }
  ctx.restore()
}
// 基线：深色粗线 + 白色细芯
function baseline(ctx, E, x1, y1, x2, y2) {
  const u = E.u
  ctx.save(); ctx.lineCap = 'round'
  for (const [lw, c] of [[12 * u, pal(E).ink], [4 * u, '#ffffff']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke() }
  ctx.restore()
}
// 不带光晕的小四角星（贴纸面板上的条目标记）
function spark(ctx, x, y, r, col) {
  const q = r * 0.16
  ctx.beginPath(); ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x + q, y - q, x + r, y); ctx.quadraticCurveTo(x + q, y + q, x, y + r)
  ctx.quadraticCurveTo(x - q, y + q, x - r, y); ctx.quadraticCurveTo(x - q, y - q, x, y - r)
  ctx.closePath(); ctx.fillStyle = col; ctx.fill()
}

export default {
  name: '酸性镀铬', mood: 'Y2K 镀铬立体字、流动的液态渐变、星形闪光，短句、发布预告、新品速览', bpm: 128,
  c: { bg: '#1a0540', fg: '#ffffff', muted: '#b9a8e6', accent: '#c6ff1a', accent2: '#ff3fd2', card: '#1c0650', line: '#dfe2f5', onAccent: '#12042a' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 900, wBody: 700, radius: 30,
  motion: 'pop', solidAccent: true,
  music: { style: 'drive', prog: ['Bm', 'G', 'D', 'A'], lead: 'pluck', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'chime' },
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const c = S.cues, sc = S.scene
      if (S.layout === 'title') out.push({ t: S.t0 + c[sc.kicker ? 1 : 0] + 0.1, kind: 'chime', gain: 0.4 })
      if (S.layout === 'statement') out.push({ t: S.t0 + c[0] + 0.75, kind: 'chime', gain: 0.35 })
      if (S.layout === 'compare') out.push({ t: S.t0 + c[2] + 0.32, kind: 'thud', gain: 0.6 })
      if (S.layout === 'end') out.push({ t: S.t0 + c[0] + 0.1, kind: 'swell', gain: 0.3 })
    }
    return out
  },

  bg(ctx, E, s) { background(ctx, E, s, DENSE.has(s.layout)) },

  layouts: {
    // 片头：贴纸小标题斜贴在上面，镀铬大字横向拉长后弹回，外面一圈荧光绿液态光圈慢慢画出来，副标题是深色胶囊
    title(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, W = E.W
      let i = 0
      const ik = sc.kicker ? i++ : -1, it = i++, is = sc.subtitle ? i++ : -1
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(168, 160) * u, maxW: a.w * 0.9, maxLines: 3, lineGap: 1.16, oneLine: true })
      const kick = sc.kicker && E.fit(sc.kicker, { role: 'body', weight: 900, size: E.pick(44, 42) * u, maxW: a.w * 0.6, maxLines: 1 })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 700, size: E.pick(46, 44) * u, maxW: a.w * 0.78, maxLines: 2, lineGap: 1.3 })
      const kH = kick ? kick.size * 1.8 : 0, kW = kick ? kick.width + kick.size * 1.5 : 0, sH = sub ? tagH(sub) : 0
      const hb = big.lines.length * big.lineH, gapK = 46 * u, gapS = 50 * u
      const total = (kick ? kH + gapK : 0) + hb + (sub ? sH + gapS : 0)
      let y = a.y + (a.h - total) / 2
      ring(ctx, E, W / 2, a.y + a.h / 2, Math.min(W / 2 - 40 * u, big.width / 2 + 150 * u), Math.min(total / 2 + 80 * u, a.h / 2 + 30 * u), t, { p: outCubic(prog(t, s.cue(it) + 0.1, 0.9)), color: k.lime, wob: 0.035 })
      if (kick) {
        sticker(ctx, E, W / 2 - E.pick(big.width * 0.26, 0), y + kH / 2, kW, kH, { fill: k.lime, m: M(enter(ent(s, ik, 0.45), 'spin'), { rot: -0.07 }, idle(t, 2, 0.6, u)), f: kick })
        y += kH + gapK
      }
      const q = ent(s, it, 0.75)
      drawSet(ctx, big.lines.map((ln, j) => ({ T: tex(E, ln, big.size), x: W / 2, y: y + j * big.lineH + big.lineH / 2, o: M(enter(clamp(q * 1.15 - j * 0.1), 'stretch'), { shine: sweep(t, s.cue(it) + 0.9, 2.6) }) })))
      burst(ctx, E, W / 2, y + hb / 2, t, s.cue(it) + 0.1, { n: 9, R: 360, seed: 3 })
      twinkle(ctx, E, W / 2 + big.width / 2 + 10 * u, y + 10 * u, 34 * u, t, s.cue(it) + 0.5, 1, k.lime)
      twinkle(ctx, E, W / 2 - big.width / 2 - 10 * u, y + hb - 20 * u, 26 * u, t, s.cue(it) + 0.8, 2, k.pink)
      y += hb + gapS
      if (sub) within(ctx, W / 2, y + sH / 2, enter(ent(s, is, 0.4), 'pop'), () => tag(ctx, E, sub, W / 2, y + sH / 2, { border: k.pink }))
    },

    // 一句镀铬大字：逐行液化后凝固；高亮词是荧光绿镀铬，落定后下面流出一道波浪线、爆一圈星
    statement(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, W = E.W
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(128, 108) * u, maxW: a.w * 0.92, maxLines: E.pick(4, 6), lineGap: 1.3 })
      const hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1
      let off = 0
      const rows = f.lines.map(ln => { const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off); off += ln.length; return { ln, a0, a1, on: hs >= 0 && a1 > a0 } })
      const y0 = a.y + (a.h - f.lines.length * f.lineH) / 2, t0 = s.cue(0)
      drawSet(ctx, rows.map((r, j) => ({
        T: tex(E, r.on ? [[r.ln.slice(0, r.a0), 'silver'], [r.ln.slice(r.a0, r.a1), 'lime'], [r.ln.slice(r.a1), 'silver']] : r.ln, f.size),
        x: W / 2, y: y0 + j * f.lineH + f.lineH / 2,
        o: M(enter(prog(t, t0 + j * 0.1, 0.85), 'melt'), { ph: t * 6 + j, shine: sweep(t, t0 + 1.1 + j * 0.15, 2.8) }),
      })))
      rows.forEach((r, j) => {
        if (!r.on) return
        const tw = (str) => textW(E, str, 'title', 900, f.size), x0 = W / 2 - tw(r.ln) / 2 + tw(r.ln.slice(0, r.a0)), w = tw(r.ln.slice(r.a0, r.a1)), yy = y0 + j * f.lineH + f.lineH / 2 + f.size * 0.68
        wave(ctx, E, x0, yy, w * outCubic(prog(t, t0 + 0.7, 0.5)), t, k.lime)
        burst(ctx, E, x0 + w / 2, yy - f.size * 0.6, t, t0 + 0.75, { n: 8, R: 260, seed: 7 + j })
        twinkle(ctx, E, x0 + w + 6 * u, yy - f.size * 1.1, 30 * u, t, t0 + 1, 3 + j, k.pink)
      })
    },

    // 要点：每一条是一枚镀铬边的深色胶囊，宽度跟着字走，奇偶行错开一点；前面一枚圆贴纸写序号
    bullets(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, n = sc.items.length
      const top = head(ctx, s, E, sc.title), avail = a.y + a.h - top
      const rowH = Math.min(avail / n, E.pick(160, 190) * u), pillH = rowH * 0.8, y0 = top + (avail - rowH * n) / 2
      const br = pillH * 0.3, tx = br * 2 + 52 * u, shift = 26 * u
      const FS = fitSame(E, sc.items, () => ({ role: 'body', weight: 700, size: Math.min(54 * u, pillH * 0.42), maxW: a.w - shift - tx - 46 * u, maxLines: 2, maxH: pillH * 0.84, lineGap: 1.2 }))
      let newest = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0) newest = i
      // 横屏条目短、右边空着时，放一张慢慢转的彩虹光盘
      const used = shift + tx + Math.max(...FS.map(f => f.width)) + 46 * u, free = a.w - used - 60 * u
      if (!E.portrait && free > 420 * u) {
        const R = Math.min(free * 0.42, (a.y + a.h - top) * 0.42, 300 * u), q = outCubic(prog(t, s.cue(0) + 0.1, 0.7))
        within(ctx, a.x + a.w - free / 2, top + avail / 2, M(enter(q, 'spin'), idle(t, 7, 0.6, u)), () => disc(ctx, E, a.x + a.w - free / 2, top + avail / 2, R, t))
        twinkle(ctx, E, a.x + a.w - free / 2 + R * 0.62, top + avail / 2 - R * 0.7, 40 * u, t, s.cue(0) + 0.6, 12, k.lime)
      }
      sc.items.forEach((_, i) => {
        const f = FS[i], cy = y0 + rowH * (i + 0.5), px = a.x + (i % 2) * shift, pw = Math.min(a.w - shift, tx + f.width + 46 * u)
        within(ctx, px, cy, M(enter(ent(s, i + 1, 0.55), 'stretch'), { rot: i % 2 ? 0.006 : -0.006 }), () => {
          chromePanel(ctx, E, px, cy - pillH / 2, pw, pillH, { r: pillH / 2, border: 6 * u })
          dot(ctx, E, px + 16 * u + br, cy, br, i % 2 ? k.pink : k.lime, i + 1)
          ctx.fillStyle = k.white; ctx.font = E.font('body', 700, f.size); drawLines(ctx, f.lines, px + tx, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
        })
        if (i === newest) twinkle(ctx, E, px + pw - 8 * u, cy - pillH / 2 + 4 * u, 26 * u, t, s.cue(i + 1) + 0.3, i, i % 2 ? k.lime : k.pink)
      })
    },

    // 大数字：荧光绿镀铬数字从 0 滚上去，单位是粉色镀铬；一圈粉色液态光圈画出来；说明和小字是深色胶囊
    number(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, W = E.W
      let i = 1
      const il = sc.label ? i++ : -1, inote = sc.note ? i++ : -1
      const str = String(sc.value), S0 = E.pick(330, 300) * u
      const f = E.fit(str, { role: 'num', weight: 900, size: S0, maxW: a.w * (sc.unit ? 0.66 : 0.88), maxLines: 1, lineGap: 1, minSize: S0 * 0.3 })
      const us = Math.max(f.size * 0.3, 44 * u), uw = sc.unit ? textW(E, sc.unit, 'title', 900, us) + 26 * u : 0
      const lab = sc.label && E.fit(sc.label, { role: 'body', weight: 700, size: E.pick(54, 52) * u, maxW: a.w * 0.8, maxLines: 2, lineGap: 1.25 })
      const note = sc.note && E.fit(sc.note, { role: 'body', weight: 500, size: 38 * u, maxW: a.w * 0.76, maxLines: 2, lineGap: 1.25 })
      const hN = f.size * 1.08, hL = lab ? tagH(lab) + 50 * u : 0, hO = note ? tagH(note) + 24 * u : 0
      let y = a.y + (a.h - hN - hL - hO) / 2
      const ny = y + hN / 2, wNum = textW(E, str, 'num', 900, f.size), x0 = W / 2 - (wNum + uw) / 2, t0 = s.cue(0)
      ring(ctx, E, W / 2, ny, Math.min(W / 2 - 30 * u, (wNum + uw) / 2 + E.pick(150, 70) * u), hN / 2 + 30 * u, t, { p: outCubic(prog(t, t0 + 0.15, 0.8)), color: k.pink, w: 12, wob: 0.05 })
      const shown = rolling(sc.value, clamp((t - t0) / Math.min(1.4, s.dur * 0.35))), sh = jolt(t, t0 + 0.12, 0.3) * 10 * u
      within(ctx, W / 2, ny, M(enter(ent(s, 0, 0.7), 'stretch'), idle(t, 1, 0.5, u), { dx: Math.sin(t * 90) * sh }), () => {
        glyphRun(ctx, E, shown, x0 + wNum, ny, f.size, { kind: 'lime', align: 'right' })
        if (sc.unit) drawSet(ctx, [{ T: tex(E, sc.unit, us, { kind: 'pink' }), x: x0 + wNum + 26 * u, y: ny + f.size * 0.2, align: 'left' }])
      })
      burst(ctx, E, W / 2, ny, t, t0 + 0.12, { n: 10, R: 420, seed: 11 })
      twinkle(ctx, E, x0 + wNum + uw, ny - f.size * 0.42, 40 * u, t, t0 + 0.6, 4, k.lime)
      y += hN
      if (lab) { y += 50 * u; const cy = y + tagH(lab) / 2; within(ctx, W / 2, cy, enter(ent(s, il, 0.4), 'pop'), () => tag(ctx, E, lab, W / 2, cy, { border: k.lime })); y += tagH(lab) }
      if (note) { y += 24 * u; const cy = y + tagH(note) / 2; within(ctx, W / 2, cy, enter(ent(s, inote, 0.4), 'pop'), () => tag(ctx, E, note, W / 2, cy, { fg: k.dim, bg: rgba(k.card, 0.8), border: rgba(k.silver, 0.5), weight: 500 })) }
    },

    // 柱状图：镀铬柱子（最高的或 highlight 指定的是荧光绿），柱顶的数值也是镀铬字；横屏竖着长、标签是柱下的深色胶囊，竖屏横着长
    bars(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, n = sc.items.length
      const top = head(ctx, s, E, sc.title)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || '', g0 = outCubic(ent(s, 0, 0.6)), plain = mix(k.dim, '#ffffff', 0.25)
      // 横屏且每根柱子的位置够宽时竖着长；竖屏、方屏柱子多时横着长
      if (!E.portrait && a.w / n >= 190 * u) {
        const labH = 112 * u, base = a.y + a.h - labH, hMax = base - top - 84 * u, slot = a.w / n, bw = Math.min(slot * 0.46, 150 * u)
        baseline(ctx, E, a.x - 20 * u, base, a.x - 20 * u + (a.w + 40 * u) * g0, base)
        const LF = fitSame(E, sc.items.map(it => it.label), () => ({ role: 'body', weight: 700, size: 36 * u, maxW: slot * 0.92 - 46 * u, maxLines: 2, maxH: labH - 22 * u, lineGap: 1.15 }))
        sc.items.forEach((it, i) => {
          const p = ent(s, i + 1, 0.6), q = outCubic(p), x = a.x + slot * (i + 0.5), h = hMax * vals[i] / max * q
          if (p > 0) {
            pillar(ctx, E, x, base, bw, h, i === hi ? k.lime : plain)
            ctx.save(); ctx.globalAlpha *= clamp(p * 3); glyphRun(ctx, E, formatNumber(vals[i] * q, dec) + unit, x, base - h - 42 * u, 52 * u, { kind: i === hi ? 'lime' : 'silver' }); ctx.restore()
            if (i === hi) twinkle(ctx, E, x + bw / 2, base - h, 30 * u, t, s.cue(i + 1) + 0.5, 6, '#ffffff')
          }
          const lf = LF[i]
          ctx.save(); ctx.globalAlpha *= clamp(p * 2.5); tag(ctx, E, lf, x, base + 20 * u + tagH(lf) / 2); ctx.restore()
        })
      } else {
        // 行高够时标签在柱子上面一行；行太矮（方屏六根）时标签放在柱子左边一栏
        const avail = a.y + a.h - top, rowH = Math.min(avail / n, 220 * u), y0 = top + (avail - rowH * n) / 2, side = rowH < 150 * u
        const LF = fitSame(E, sc.items.map(it => it.label), () => ({ role: 'body', weight: 700, size: (side ? 32 : 38) * u, maxW: side ? a.w * 0.3 : a.w * 0.75, maxLines: 1 }))
        const lw = side ? Math.max(...LF.map(f => f.width + f.size * 1.24)) + 20 * u : 0, x0 = a.x + lw, wMax = a.w - lw - E.pick(190, 210) * u, bh = Math.min(rowH * (side ? 0.46 : 0.3), 54 * u)
        baseline(ctx, E, x0, y0, x0, y0 + rowH * n * g0)
        sc.items.forEach((it, i) => {
          const p = ent(s, i + 1, 0.6), q = outCubic(p), y = y0 + rowH * i, by = y + rowH * (side ? 0.5 : 0.7), w = wMax * vals[i] / max * q, lf = LF[i]
          ctx.save(); ctx.globalAlpha *= clamp(p * 2.5); if (side) tag(ctx, E, lf, x0 - 16 * u, by, { align: 'right' }); else tag(ctx, E, lf, a.x + 22 * u, y + rowH * 0.28, { align: 'left' }); ctx.restore()
          if (p <= 0) return
          pillar(ctx, E, x0, by, bh, w, i === hi ? k.lime : plain, true)
          ctx.save(); ctx.globalAlpha *= clamp(p * 3); glyphRun(ctx, E, formatNumber(vals[i] * q, dec) + unit, x0 + w + 22 * u, by, (side ? 42 : 48) * u, { kind: i === hi ? 'lime' : 'silver', align: 'left' }); ctx.restore()
          if (i === hi) twinkle(ctx, E, x0 + w, by - bh / 2, 26 * u, t, s.cue(i + 1) + 0.5, 6, '#ffffff')
        })
      }
    },

    // 流程：一串镀铬胶囊，箭头连起来；每枚胶囊顶上一枚圆贴纸序号，最后一步是荧光绿贴纸。横屏一排，竖屏往下排
    steps(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, n = sc.items.length
      const top = head(ctx, s, E, sc.title), avail = a.y + a.h - top
      // 一枚胶囊：最后一步是荧光绿贴纸、深色字，其余是镀铬边深色胶囊、白字
      const pill = (x, y, w, h, r, i, cx, cy, kind, inner) => {
        const last = i === n - 1
        within(ctx, cx, cy, M(enter(ent(s, i + 1, 0.6), kind), idle(t, i * 2 + 1, 0.35, u)), () => {
          if (last) sticker(ctx, E, x + w / 2, y + h / 2, w, h, { fill: k.lime, r }); else chromePanel(ctx, E, x, y, w, h, { r, border: 8 * u })
          ctx.fillStyle = last ? k.ink : k.white
          inner(last ? k.pink : i % 2 ? k.pink : k.lime)
        })
      }
      // 横屏且每枚胶囊够宽时排成一排，否则（竖屏、方屏）往下排
      if (!E.portrait && (a.w - 70 * u * (n - 1)) / n >= 240 * u) {
        const gap = 70 * u, cw = (a.w - gap * (n - 1)) / n, ch = Math.min(avail * 0.92, 440 * u), y = top + (avail - ch) / 2, br = Math.min(40 * u, cw * 0.16), r = Math.min(cw / 2, 90 * u)
        const FS = fitSame(E, sc.items, () => ({ role: 'body', weight: 700, size: 56 * u, maxW: cw - 64 * u, maxLines: 4, maxH: ch - br * 2 - 110 * u, lineGap: 1.22 }))
        sc.items.forEach((_, i) => {
          const q = ent(s, i + 1, 0.6), x = a.x + (cw + gap) * i, f = FS[i]
          if (i > 0 && q > 0) arrow(ctx, E, x - gap + 8 * u, y + ch / 2, x - 6 * u, y + ch / 2, { a: clamp(q * 3), w: 12, color: k.lime })
          pill(x, y, cw, ch, r, i, x + cw / 2, y + ch / 2, 'tall', col => {
            const fs = ctx.fillStyle
            dot(ctx, E, x + cw / 2, y + 30 * u + br, br, col, i + 1)
            const ty = y + br * 2 + 50 * u, th = ch - br * 2 - 80 * u
            ctx.fillStyle = fs; ctx.font = E.font('body', 700, f.size); drawLines(ctx, f.lines, x + cw / 2, ty + (th - f.lines.length * f.lineH) / 2, f.lineH, 'center')
          })
        })
      } else {
        const gap = 76 * u, ch = Math.min((avail - gap * (n - 1)) / n, 230 * u), y0 = top + (avail - ch * n - gap * (n - 1)) / 2, br = Math.min(44 * u, ch * 0.3), bx = a.x + 30 * u + br, tx = a.x + br * 2 + 74 * u
        const FS = fitSame(E, sc.items, () => ({ role: 'body', weight: 700, size: 46 * u, maxW: a.x + a.w - tx - 50 * u, maxLines: 3, maxH: ch * 0.84, lineGap: 1.22 }))
        sc.items.forEach((_, i) => {
          const q = ent(s, i + 1, 0.6), y = y0 + (ch + gap) * i, f = FS[i]
          if (i > 0 && q > 0) arrow(ctx, E, a.x + a.w / 2, y - gap + 2 * u, a.x + a.w / 2, y - 4 * u, { a: clamp(q * 3), w: 14, color: k.lime })
          pill(a.x, y, a.w, ch, ch / 2, i, a.x, y + ch / 2, 'stretch', col => {
            const fs = ctx.fillStyle
            dot(ctx, E, bx, y + ch / 2, br, col, i + 1)
            ctx.fillStyle = fs; ctx.font = E.font('body', 700, f.size); drawLines(ctx, f.lines, tx, y + (ch - f.lines.length * f.lineH) / 2, f.lineH, 'left')
          })
        })
      }
    },

    // 对比：粉、绿两块白边贴纸面板从两边滑进来撞到一起，撞上时一震、中缝爆一圈星、弹出镀铬 VS；面板标题是镀铬字，条目是深色字
    compare(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, P = E.portrait
      const top = head(ctx, s, E, sc.title), avail = a.y + a.h - top, gap = E.pick(90, 96) * u, pad = 40 * u
      // 两块面板一样高，高度跟着内容走，在可用区域里上下居中
      const pw = P ? a.w : (a.w - gap) / 2, hMax = P ? (avail - gap) / 2 : avail
      const sides = [sc.left, sc.right], fills = [k.pink, k.lime], tHit = s.cue(2) + 0.32, hit = jolt(t, tHit, 0.35) * 12 * u
      const TF = fitSame(E, sides.map(d => d.title), () => ({ role: 'title', weight: 900, size: E.pick(60, 56) * u, maxW: pw - pad * 2, maxLines: 2, lineGap: 1.15 }))
      const hT = Math.max(...TF.map(f => f.lines.length * f.lineH)) + 26 * u, cnt = Math.max(1, ...sides.map(d => (d.items || []).length))
      const rH = Math.min((hMax - pad * 1.8 - hT) / cnt, E.pick(120, 130) * u), ph = Math.min(hMax, pad * 1.8 + hT + rH * cnt)
      const y0 = P ? top + (avail - ph * 2 - gap) / 2 : top + (avail - ph) / 2
      const boxes = P ? [[a.x, y0, pw, ph], [a.x, y0 + ph + gap, pw, ph]] : [[a.x, y0, pw, ph], [a.x + pw + gap, y0, pw, ph]]
      const ty = boxes.map(b => b[1] + pad + hT), rowH = [rH, rH]
      const all = sides.flatMap((d, i) => (d.items || []).map(it => [it, i]))
      const FI = fitSame(E, all.map(x => x[0]), j => { const i = all[j][1]; return { role: 'body', weight: 700, size: Math.min(46 * u, rowH[i] * 0.44), maxW: boxes[i][2] - pad * 2 - 46 * u, maxLines: 2, maxH: rowH[i] * 0.92, lineGap: 1.2 } })
      sides.forEach((d, i) => {
        const [x, y, w, h] = boxes[i], sgn = i ? 1 : -1
        within(ctx, x + w / 2, y + h / 2, M(enter(ent(s, i + 1, 0.6), P ? (i ? 'up' : 'down') : (i ? 'right' : 'left'), u), { rot: sgn * 0.012, dx: P ? 0 : sgn * hit, dy: P ? sgn * hit : 0 }), () => {
          sticker(ctx, E, x + w / 2, y + h / 2, w, h, { fill: fills[i], r: 30 * u })
          drawSet(ctx, TF[i].lines.map((ln, j) => ({ T: tex(E, ln, TF[i].size), x: x + pad, y: y + pad + j * TF[i].lineH + TF[i].lineH / 2, align: 'left' })))
          FI.filter((_, j) => all[j][1] === i).forEach((f, j) => {
            const cy = ty[i] + rowH[i] * (j + 0.5)
            spark(ctx, x + pad + 12 * u, cy, 13 * u, k.ink)
            ctx.fillStyle = k.ink; ctx.font = E.font('body', 700, f.size); drawLines(ctx, f.lines, x + pad + 46 * u, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
          })
        })
      })
      const vx = P ? E.W / 2 : a.x + a.w / 2, vy = P ? y0 + ph + gap / 2 : y0 + ph / 2
      if (t > tHit - 0.05) drawSet(ctx, [{ T: tex(E, 'VS', P ? 100 * u : gap * 0.95, { kind: 'pink', role: 'num' }), x: vx, y: vy, o: M(enter(prog(t, tHit - 0.05, 0.45), 'pop'), { rot: -0.08 }, idle(t, 9, 0.6, u)) }])
      burst(ctx, E, vx, vy, t, tHit, { n: 10, R: 320, seed: 17 })
    },

    // 引语：镀铬边框的深色面板落下来，字逐行浮出；左上角一个粉色镀铬大引号，出处是右下角斜贴的荧光绿贴纸
    quote(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, W = E.W, pad = E.pick(84, 64) * u
      const f = E.fit(sc.text, { role: 'title', weight: 800, size: E.pick(78, 66) * u, maxW: a.w * E.pick(0.8, 0.9) - pad * 2, maxLines: E.pick(4, 7), lineGap: 1.4 })
      const by = sc.by && E.fit(sc.by, { role: 'body', weight: 900, size: 40 * u, maxW: a.w * 0.62, maxLines: 1 })
      const pw = Math.max(f.width + pad * 2, a.w * E.pick(0.5, 0.8)), ph = f.lines.length * f.lineH + pad * 2, bH = by ? by.size * 1.8 : 0
      const px = W / 2 - pw / 2, py = a.y + (a.h - ph - bH * 0.6) / 2, t0 = s.cue(0)
      within(ctx, W / 2, py + ph / 2, M(enter(ent(s, 0, 0.55), 'drop', u), idle(t, 4, 0.3, u), { rot: -0.012 }), () => {
        chromePanel(ctx, E, px, py, pw, ph, { r: 36 * u, border: 12 * u })
        ctx.fillStyle = k.white; ctx.font = E.font('title', 800, f.size)
        f.lines.forEach((ln, j) => {
          const lp = prog(t, t0 + 0.2 + j * 0.16, 0.35)
          if (lp > 0) { ctx.save(); ctx.globalAlpha *= lp; drawLines(ctx, [ln], W / 2, py + pad + j * f.lineH + (1 - outCubic(lp)) * 14 * u, f.lineH, 'center'); ctx.restore() }
        })
      })
      const qs = E.pick(320, 260) * u, marks = [{ T: tex(E, '“', qs, { kind: 'pink' }), x: px + qs * 0.1, y: py + qs * 0.3, o: M(enter(prog(t, t0 + 0.15, 0.5), 'spin'), { rot: -0.1 }, idle(t, 6, 0.6, u)) }]
      if (!by) marks.push({ T: tex(E, '”', qs, { kind: 'lime' }), x: px + pw - qs * 0.1, y: py + ph + qs * 0.12, o: M(enter(prog(t, t0 + 0.35, 0.5), 'spin'), { rot: 0.1 }, idle(t, 7, 0.6, u)) })
      drawSet(ctx, marks)
      if (by) {
        const bw = by.width + by.size * 1.5
        sticker(ctx, E, Math.min(px + pw - bw / 2 - 20 * u, a.x + a.w - bw / 2), py + ph + 4 * u, bw, bH, { fill: k.lime, f: by, m: M(enter(ent(s, 1, 0.45), 'spin'), { rot: 0.05 }) })
      }
      twinkle(ctx, E, px + pw - 10 * u, py + 12 * u, 34 * u, t, t0 + 0.6, 8, k.lime)
    },

    // 片尾：镀铬大字，外面一圈星沿椭圆慢慢转、各自闪；副标题是深色胶囊；按钮是荧光绿贴纸，一个光标点它
    end(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, t = s.t, W = E.W
      let i = 0
      const it = i++, is = sc.subtitle ? i++ : -1, ic = sc.cta ? i++ : -1
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(150, 124) * u, maxW: a.w * 0.86, maxLines: 3, lineGap: 1.16, oneLine: true })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 700, size: 46 * u, maxW: a.w * 0.76, maxLines: 2, lineGap: 1.28 })
      const cta = sc.cta && E.fit(sc.cta, { role: 'body', weight: 900, size: E.pick(48, 46) * u, maxW: a.w * 0.6, maxLines: 1 })
      const hb = big.lines.length * big.lineH, sH = sub ? tagH(sub) + 44 * u : 0, cH = cta ? cta.size * 1.9 + 64 * u : 0
      let y = a.y + (a.h - hb - sH - cH) / 2
      const cy = y + hb / 2, rx = Math.min(W / 2 - 50 * u, big.width / 2 + 120 * u), ry = hb / 2 + 60 * u, ap = prog(t, s.cue(it) + 0.2, 0.8)
      for (let j = 0; j < 12; j++) {
        const th = j / 12 * TAU + t * 0.35, ph = (t * 1.2 + j * 0.37) % 1.4, kk = ph < 0.6 ? Math.sin(Math.PI * ph / 0.6) : 0
        star(ctx, E, W / 2 + Math.cos(th) * rx, cy + Math.sin(th) * ry, (12 + 18 * kk) * u * ap, { rot: t * 0.8 + j, color: [k.lime, k.pink, k.cyan][j % 3], a: ap })
      }
      drawSet(ctx, big.lines.map((ln, j) => ({ T: tex(E, ln, big.size), x: W / 2, y: y + j * big.lineH + big.lineH / 2, o: M(enter(clamp(ent(s, it, 0.75) * 1.15 - j * 0.1), 'stretch'), { shine: sweep(t, s.cue(it) + 0.9, 2.4) }) })))
      burst(ctx, E, W / 2, cy, t, s.cue(it) + 0.1, { n: 10, R: 380, seed: 23 })
      y += hb
      if (sub) { y += 44 * u; const c2 = y + tagH(sub) / 2; within(ctx, W / 2, c2, enter(ent(s, is, 0.4), 'pop'), () => tag(ctx, E, sub, W / 2, c2, { border: k.pink })); y += tagH(sub) }
      if (cta) {
        y += 64 * u
        const bw = cta.width + cta.size * 2.2, bh = cta.size * 1.9, c3 = y + bh / 2, tc = s.cue(ic) + 0.55, press = 1 - 0.07 * Math.sin(Math.PI * prog(t, tc, 0.22))
        sticker(ctx, E, W / 2, c3, bw, bh, { fill: k.lime, f: cta, m: M(enter(ent(s, ic, 0.45), 'pop'), { s: press * (1 + 0.025 * Math.sin(t * 5)) }) })
        const cp = outCubic(prog(t, s.cue(ic) + 0.15, 0.4)), sz = 64 * u
        if (cp > 0) { ctx.save(); ctx.globalAlpha *= cp; cursor(ctx, E, W / 2 + bw / 2 - 10 * u + (1 - cp) * 120 * u, c3 + bh * 0.35 + (1 - cp) * 90 * u, sz * press); ctx.restore() }
        burst(ctx, E, W / 2 + bw / 2 - 20 * u, c3, t, tc, { n: 6, R: 160, r: 16, seed: 29 })
      }
    },
  },

  // 字幕：深紫胶囊，外面一圈镀铬边，英文和数字用荧光绿；两端各一颗星；每换一段弹一下
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const k = pal(E), u = E.u, P = E.portrait, W = E.W
    const chunks = captionChunks(say, P ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((p, q) => p + q, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const al = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
    const size = E.pick(40, 44) * u
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 700, size, maxW: Math.min(W - E.safe.l * 2, E.pick(1300, 880) * u) - size * 1.6, maxLines: 2, lineGap: 1.38, quiet: true })
    const w = f.width + size * 1.6, h = f.lines.length * f.lineH + size * 0.5, cx = W / 2, cy = E.H - E.captionH / 2 - (P ? 30 * u : 0), y0 = cy - h / 2, r = Math.min(h / 2, 40 * u)
    const since = s.t - t0, pop = since < 0.16 ? 1 + 0.06 * Math.sin(Math.PI * since / 0.16) : 1
    ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.scale(pop, pop); ctx.translate(-cx, -cy)
    ctx.fillStyle = rgba(k.ink, 0.35); roundRect(ctx, cx - w / 2 + 6 * u, y0 + 10 * u, w, h, r); ctx.fill()
    const g = ctx.createLinearGradient(0, y0 - 5 * u, 0, y0 + h + 5 * u)
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#a3a8d0'); g.addColorStop(0.5, mix(k.violet, '#000000', 0.35)); g.addColorStop(0.6, mix(k.pink, '#ffffff', 0.82)); g.addColorStop(1, mix(k.violet, '#ffffff', 0.62))
    ctx.fillStyle = g; roundRect(ctx, cx - w / 2 - 5 * u, y0 - 5 * u, w + 10 * u, h + 10 * u, r + 5 * u); ctx.fill()
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = k.ink; ctx.stroke()
    const bg = ctx.createLinearGradient(0, y0, 0, y0 + h)
    bg.addColorStop(0, mix(k.violet, k.bg, 0.45)); bg.addColorStop(1, k.deep)
    ctx.fillStyle = bg; roundRect(ctx, cx - w / 2, y0, w, h, r); ctx.fill(); ctx.lineWidth = 2 * u; ctx.stroke()
    ctx.font = E.font('body', 700, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
    f.lines.forEach((ln, j) => {
      const yy = y0 + size * 0.25 + f.lineH * (j + 0.5)
      let x = cx - ctx.measureText(ln).width / 2
      for (const part of ln.split(/([A-Za-z0-9][A-Za-z0-9%.+-]*)/)) { if (!part) continue; ctx.fillStyle = /^[A-Za-z0-9]/.test(part) ? k.lime : k.white; ctx.fillText(part, x, yy); x += ctx.measureText(part).width }
    })
    const tw = E.T * 1.4
    star(ctx, E, cx - w / 2 - 2 * u, y0 + 4 * u, (15 + 4 * Math.sin(tw)) * u, { rot: tw * 0.4, color: k.lime })
    star(ctx, E, cx + w / 2 + 2 * u, y0 + h - 4 * u, (13 + 4 * Math.cos(tw)) * u, { rot: -tw * 0.4, color: k.pink })
  },

  // 最上层：左上角超宽字距的装饰词，右上角场次（荧光绿）
  overlay(ctx, E, s) {
    const u = E.u, P = E.portrait, y = (P ? 100 : 46) * u, mx = (P ? 60 : 64) * u, size = E.pick(22, 24) * u
    wide(ctx, E, 'LIQUID CHROME', mx, y, { size, sp: size * 0.55 })
    wide(ctx, E, `${two(s.index)} / ${String(s.count).padStart(2, '0')}`, E.W - mx, y, { size, sp: size * 0.35, align: 'right', color: pal(E).lime })
  },

  // 转场（0.48 秒）：旧画面横向液化，新画面被一道波浪液面从下往上推上来，液面边缘一道镀铬亮线和几颗星
  transitionDur: 0.48,
  transition(ctx, A, B, p, E, info) {
    const { W, H, u } = E, k = pal(E)
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, amt = Math.sin(Math.PI * p), si = info.to, strip = Math.max(4, Math.round(12 * u))
    ctx.fillStyle = k.deep; ctx.fillRect(0, 0, W, H)
    for (let y = 0; y < H; y += strip) ctx.drawImage(A, 0, y, W, strip, amt * 90 * u * Math.sin(y / u * 0.011 + p * 9 + si), y, W, strip)
    const front = x => H + 120 * u - (H + 240 * u) * e + 55 * u * Math.sin(x / u * 0.006 + p * 10 + si) + 25 * u * Math.sin(x / u * 0.017 - p * 14)
    const edge = () => { ctx.beginPath(); for (let x = 0; x <= W + 20 * u; x += 20 * u) { const y = front(x); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y) } }
    ctx.save(); edge(); ctx.lineTo(W + 20 * u, H + 10); ctx.lineTo(0, H + 10); ctx.closePath(); ctx.clip()
    for (let y = 0; y < H; y += strip) ctx.drawImage(B, 0, y, W, strip, amt * 50 * u * Math.sin(y / u * 0.013 - p * 8), y, W, strip)
    ctx.restore()
    ctx.save(); ctx.lineJoin = 'round'
    const g = ctx.createLinearGradient(0, 0, W, 0)
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, k.pink); g.addColorStop(0.55, '#ffffff'); g.addColorStop(0.8, k.lime); g.addColorStop(1, '#ffffff')
    for (const [lw, c] of [[26 * u, k.ink], [16 * u, g], [4 * u, 'rgba(255,255,255,0.9)']]) { edge(); ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke() }
    for (let i = 0; i < 5; i++) { const x = (i + 0.5) / 5 * W + 60 * u * Math.sin(i * 3 + si); star(ctx, E, x, front(x), 30 * u * amt, { rot: p * 3 + i, color: i % 2 ? k.lime : k.pink }) }
    ctx.restore()
  },

  // 默认版式会调用的零件（九种版式都重画了，这些只在自定义场借用时用到）
  card(ctx, E, x, y, w, h, o = {}) {
    if (o.tone === 'accent') sticker(ctx, E, x + w / 2, y + h / 2, w, h, { fill: pal(E).lime, r: this.radius * E.u })
    else chromePanel(ctx, E, x, y, w, h, { r: this.radius * E.u })
  },
  line(ctx, E, x1, y1, x2, y2, o = {}) { const p = o.p ?? 1; baseline(ctx, E, x1, y1, x1 + (x2 - x1) * p, y1 + (y2 - y1) * p) },
  bar(ctx, E, x, y, w, h, o = {}) { if (Math.abs(w) > Math.abs(h) * 1.5) pillar(ctx, E, x, y + h / 2, h, w, o.color ?? pal(E).lime, true); else pillar(ctx, E, x + w / 2, y + h, w, h, o.color ?? pal(E).lime) },
  mark(ctx, E, x, y, r, i, o = {}) { const k = pal(E); dot(ctx, E, x, y, r * 0.86, o.color ?? (i % 2 ? k.pink : k.lime)) },
  underline(ctx, E, x, y, w, p) { wave(ctx, E, x, y, w * p, E.T, pal(E).lime) },
}
