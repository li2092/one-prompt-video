// 风格包：漫画分镜。一场一页漫画：米白纸面，黑色粗框分格（格缝斜切），格子带硬投影压在纸上；
// 还没画到的格子是铅笔虚线空格，轮到时砸进来。网点、集中线、速度线、拟声字、旁白框、气泡和刺头小人
// 都来自原样片 V-漫画分镜 的画法库（lib/）。只用墨、白、网点灰和一种强调色。
import { K, quad, rect, cols, rows, panel, shake, gradTone, toneFill, focusLines, speedLines, put, impact, sfxWord, box, boxSize, bubble, burst, tri } from './lib/comic.mjs'
import { agent } from './lib/agent.mjs'
import { captionChunks, rolling, visibleText } from '../../layouts.mjs'
import { formatNumber, decimalsOf, textUnits, hasCJK } from '../../core.mjs'

const GAP = E => E.pick(24, 20) * E.u
// 一页：横屏贴着画面四周，让开底部字幕；竖屏让开顶部的平台标题区和字幕
function page(E) {
  const { W, H, u } = E, por = E.portrait
  const x = (por ? 40 : 56) * u, y = (por ? 150 : 40) * u
  const b = E.captionH ? H - E.captionH - (por ? 30 : 8) * u : H - (por ? 150 : 40) * u
  return rect(x, y, W - x, b)
}
// 页首横格的高度；把一页切成页首和下面的正文区
const headH = E => E.pick(150, 150) * E.u
function splitTop(E, R, h) { const g = GAP(E); return [rect(R.x, R.y, R.r, R.y + h), rect(R.x, R.y + h + g, R.r, R.b)] }
// 拟声字：中文片用汉字，其余用英文
const ono = (s, zh, en) => (hasCJK(visibleText(s.scene) + (s.scene.say || '')) ? zh : en)
// 正文字：白色描边垫底再填墨，压在网点和线上也读得清
function words(ctx, E, f, x, y, align, o = {}) {
  const k = K(E)
  ctx.font = E.font(o.role || 'body', o.w || 900, f.size); ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  f.lines.forEach((ln, i) => {
    const yy = y + i * f.lineH + f.lineH / 2
    ctx.lineWidth = f.size * 0.26; ctx.strokeStyle = o.halo || k.white; ctx.strokeText(ln, x, yy)
    ctx.fillStyle = o.color || k.ink; ctx.fillText(ln, x, yy)
  })
}
// 页首横格：场标题是冲击字，右端一个小人
function header(ctx, s, E, P, text, o = {}) {
  const u = E.u, k = K(E), p = s.p(0)
  const f = E.fit(text, { role: 'title', weight: 900, size: E.pick(70, 62) * u, maxW: P.w - E.pick(300, 230) * u, maxLines: 2, maxH: P.h * 0.84, lineGap: 1.12, oneLine: true })
  panel(ctx, E, P, Math.max(p, E.clamp(s.t / 0.3)), c => {
    c.drawImage(gradTone(E, P.w, P.h, 'up', { step: 10, rmax: 3.2 }), P.x, P.y)
    speedLines(c, E, s.t, P, 0, { n: 16, seed: 21, speed: 0.5, color: E.rgba(k.ink, 0.3) })
    put(c, E, p, P.x + 44 * u, P.cy, cc => f.lines.forEach((ln, i) => impact(cc, E, ln, 0, (i - (f.lines.length - 1) / 2) * f.lineH, f.size, { align: 'left', ow: 0.17, iw: 0.1 })), { kind: 'drop', h: 50 })
    const sa = P.h * 0.27
    agent(c, E, P.r - sa * 1.6, P.b - P.h * 0.05, sa, { t: s.t, seed: 2, pose: o.pose || 'point', face: o.face || 'dot', mouth: o.mouth || 'smile', fx: o.fx || [], flip: true })
  }, { ghost: false })
}
// 几段字用同一个字号（取各自能放下的最小字号），一页里的格子字号不忽大忽小
function fitAll(E, texts, opts) {
  const size = Math.min(...texts.map((t, i) => E.fit(t, opts[i]).size))
  return texts.map((t, i) => E.fit(t, { ...opts[i], size }))
}
// 一页里 n 格：竖屏一列；横屏 3 格以内一排，4 格两排两列，5 格上三下二
function grid(E, R, n) {
  const g = GAP(E), u = E.u
  if (E.portrait) return rows(R, n, g, 22 * u)
  const per = n <= 3 ? [n] : n === 4 ? [2, 2] : [3, 2], bands = rows(R, per.length, g, 0)
  return per.flatMap((m, j) => cols(bands[j], m, g, 30 * u * (j % 2 ? -1 : 1)))
}
// 要点格里小人的几种样子，一格换一种
const BULLET_LOOKS = [{ pose: 'point', face: 'dot' }, { pose: 'thumbs', face: 'happy', mouth: 'grin' }, { pose: 'hold', face: 'wide', mouth: 'o' }, { pose: 'cheer', face: 'star', mouth: 'grin' }, { pose: 'hips', face: 'smug', mouth: 'smirk' }]
// 格子背景轮换三种网点处理，像不同的分镜
function tone(c, E, P, i, t) {
  const k = K(E)
  const w = P.X1 - P.X0, h = P.Y1 - P.Y0
  if (i % 3 === 0) c.drawImage(gradTone(E, w * 0.6, h, 'radial', { step: 10, rmax: 3 }), P.X1 - w * 0.46, P.Y0)
  else if (i % 3 === 1) c.drawImage(gradTone(E, w, h * 0.55, 'down', { step: 10, rmax: 3.4 }), P.X0, P.Y1 - h * 0.55)
  else speedLines(c, E, t, P, -0.5, { n: 26, seed: 40 + i, speed: 0.4, color: E.rgba(k.ink, 0.28) })
}

export default {
  name: '漫画分镜', mood: '黑框分格、网点、速度线和拟声字，讲有转折的故事', bpm: 126,
  c: { bg: '#f3f0e8', fg: '#141414', muted: '#9a968e', accent: '#e3262b', accent2: '#141414', card: '#ffffff', line: '#141414', onAccent: '#ffffff' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 900, wBody: 800, radius: 0,
  motion: 'slam', transition: 'cut', solidAccent: true,

  bg(ctx, E) {
    const { W, H, u } = E, k = K(E)
    ctx.fillStyle = k.paper; ctx.fillRect(0, 0, W, H)
    if (!E.portrait) return
    // 竖屏上下页边铺渐变网点：平台界面盖住的地方也是印出来的纸
    const R = page(E), col = E.mix(k.paper, k.ink, 0.17), hb = H - R.b - 12 * u
    ctx.drawImage(gradTone(E, W, R.y - 12 * u, 'up', { step: 14, rmax: 5.5, color: col }), 0, 0)
    ctx.drawImage(gradTone(E, W, hb, 'down', { step: 14, rmax: 5.5, color: col }), 0, H - hb)
  },

  layouts: {
    // 扉页大格：四周渐变网点，大标题砸下来后集中线指向它；kicker 是黑旁白框，副标题是白旁白框，小人在角上欢呼
    title(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, P = page(E)
      let i = 0
      const pk = sc.kicker ? s.p(i++) : 0, pt = s.p(i++), ps = sc.subtitle ? s.p(i++) : 0
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(150, 124) * u, maxW: P.w * 0.8, maxLines: E.pick(2, 3), lineGap: 1.2, oneLine: true })
      const kick = sc.kicker && E.fit(sc.kicker, { role: 'body', weight: 900, size: E.pick(44, 42) * u, maxW: P.w * 0.6, maxLines: 1 })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 900, size: E.pick(50, 46) * u, maxW: P.w * 0.72, maxLines: 2, lineGap: 1.2 })
      const kh = kick ? boxSize(ctx, E, kick.lines, kick.size).h + 34 * u : 0, th = big.lines.length * big.lineH
      const sh = sub ? boxSize(ctx, E, sub.lines, sub.size, { lh: sub.lineH }).h + 40 * u : 0
      const y0 = P.y + P.h * E.pick(0.44, 0.4) - (kh + th + sh) / 2, ty = y0 + kh + th / 2, landed = E.clamp((pt - 0.5) * 2)
      const j = shake(E, s.t, [[pt, 14]])
      ctx.save(); ctx.translate(j.x, j.y)
      panel(ctx, E, P, E.clamp(s.t / 0.3), c => {
        c.drawImage(gradTone(E, P.w, P.h, 'radial', { step: 11, rmax: 4.4 }), P.x, P.y)
        if (landed > 0) focusLines(c, E, s.t, P, P.cx, ty, big.width * 0.62 + 40 * u, (kh + th + sh) * 0.62, { n: 110, seed: 3 })
        const sa = E.pick(P.h * 0.13, P.w * 0.15), hop = landed > 0 ? Math.sin(landed * Math.PI) * sa * 0.3 : 0
        agent(c, E, P.x + P.w * E.pick(0.12, 0.2), P.b - P.h * 0.05 - hop, sa, { t: s.t, seed: 1, pose: landed > 0 ? 'cheer' : 'wave', face: landed > 0 ? 'star' : 'dot', mouth: 'grin', fx: landed > 0 ? ['sparkle'] : [], legs: hop > 1 ? 'jump' : 'stand' })
        if (kick) put(c, E, pk, P.cx, y0 + kh / 2 - 17 * u, cc => box(cc, E, kick.lines, 0, 0, kick.size, { fill: k.dark, color: k.white, rot: -0.02 }), { kind: 'drop', h: 60 })
        put(c, E, pt, P.cx, ty, cc => big.lines.forEach((ln, n) => impact(cc, E, ln, 0, (n - (big.lines.length - 1) / 2) * big.lineH, big.size)), { kind: 'slam', rot: -0.03 })
        if (sub) put(c, E, ps, P.cx, y0 + kh + th + 40 * u, cc => box(cc, E, sub.lines, 0, 0, sub.size, { lh: sub.lineH, anchor: 'ct' }), { kind: 'pop' })
        sfxWord(c, E, landed, ono(s, '锵', 'BAM!'), P.x + P.w * E.pick(0.86, 0.8), P.y + P.h * E.pick(0.2, 0.12), E.pick(120, 100) * u, { rot: 0.18 })
      }, { ghost: false })
      ctx.restore()
    },

    // 一句话砸下来：落地前是下坠的速度线，落地后集中线指向它、整页一抖；旁边一格小人吓一跳
    statement(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, R = page(E), por = E.portrait
      const [A, B] = por ? rows(R, 2, GAP(E), 28 * u, [0.7, 0.3]) : cols(R, 2, GAP(E), 36 * u, [0.73, 0.27])
      const p = s.p(0), landed = E.clamp((p - 0.47) / 0.53)
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(116, 100) * u, maxW: A.w * 0.82, maxLines: E.pick(3, 5), maxH: A.h * 0.8, lineGap: 1.3 })
      // 高亮词可能被折到两行：按它在整句里的位置，逐行切出要上色的那一截
      const hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1
      let off = 0
      const segs = f.lines.map(ln => {
        const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off); off += ln.length
        return hs < 0 || a1 <= a0 ? [[ln, k.ink]] : [[ln.slice(0, a0), k.ink], [ln.slice(a0, a1), k.red], [ln.slice(a1), k.ink]].filter(g => g[0])
      })
      const bh = f.lines.length * f.lineH, j = shake(E, s.t, [[p, 18]])
      ctx.save(); ctx.translate(j.x, j.y)
      panel(ctx, E, A, E.clamp(s.t / 0.3), c => {
        if (landed <= 0) speedLines(c, E, s.t, A, Math.PI / 2, { n: 60, seed: 5, speed: 2.4, color: E.rgba(k.ink, 0.75) })
        else focusLines(c, E, s.t, A, A.cx, A.cy, f.width * 0.58, bh * 0.78, { n: 120, seed: 8 })
        put(c, E, p, A.cx, A.cy, cc => segs.forEach((sg, n) => impact(cc, E, sg, 0, (n - (f.lines.length - 1) / 2) * f.lineH, f.size)), { kind: 'slam', rot: -0.03 })
      }, { ghost: false })
      panel(ctx, E, B, E.clamp((s.t - 0.1) / 0.3), c => {
        c.drawImage(gradTone(E, B.X1 - B.X0, (B.Y1 - B.Y0) * 0.6, 'down', { step: 10, rmax: 3.4 }), B.X0, B.Y1 - (B.Y1 - B.Y0) * 0.6)
        const sa = por ? Math.min(B.h * 0.26, B.w * 0.14) : Math.min(B.w * 0.3, B.h * 0.17), ax = por ? B.x + B.w * 0.3 : B.cx
        agent(c, E, ax, B.b - B.h * 0.07, sa, landed > 0
          ? { t: s.t, seed: 3, face: 'shock', mouth: 'open', pose: 'panic', fx: ['shock', 'sweat'], legs: 'wide', antenna: 1 }
          : { t: s.t, seed: 3, look: [0, -1], fx: ['q'] })
        sfxWord(c, E, landed, ono(s, '咚', 'BOOM'), por ? B.x + B.w * 0.72 : B.cx, por ? B.cy : B.y + B.h * 0.2, E.pick(110, 96) * u, { rot: -0.2 })
      }, { ghost: false })
      ctx.restore()
    },

    // 一条要点一格，按顺序砸进来；没轮到的是铅笔空格，最新那一格带集中线
    bullets(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, n = sc.items.length
      let body = page(E)
      if (sc.title) { const [H, rest] = splitTop(E, body, headH(E)); header(ctx, s, E, H, sc.title, { pose: 'point' }); body = rest }
      const PS = grid(E, body, n)
      let newest = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0) newest = i
      // 宽格：编号在左、字居中偏左、小人在右；窄格：编号在左上，字在上，小人在下
      const G = PS.map((Q, i) => {
        const P = Q.m, wide = P.w / P.h > 1.9, ns = E.pick(40, 38) * u, nb = boxSize(ctx, E, String(i + 1), ns), pad = 22 * u
        const sa = wide ? Math.min(P.h * 0.24, P.w * 0.08) : Math.min(P.w * 0.16, P.h * 0.13), colW = wide ? sa * 2.6 : 0
        const tx0 = wide ? P.x + nb.w + pad * 2.5 : P.x + pad * 2, tx1 = P.r - pad * 2 - colW, ty0 = wide ? P.y + pad : P.y + nb.h + pad * 2, ty1 = wide ? P.b - pad : P.b - sa * 2.9
        return { wide, ns, pad, sa, colW, tx0, tx1, ty0, ty1, o: { role: 'body', weight: 900, size: Math.min(E.pick(76, 60) * u, (ty1 - ty0) * 0.42), maxW: tx1 - tx0, maxLines: wide ? 2 : 3, maxH: (ty1 - ty0) * 0.92, lineGap: 1.2 } }
      })
      const FS = fitAll(E, sc.items, G.map(g => g.o))
      PS.forEach((Q, i) => {
        const { wide, ns, pad, sa, colW, tx0, tx1, ty0, ty1 } = G[i], f = FS[i], look = BULLET_LOOKS[i % BULLET_LOOKS.length], P = Q.m
        panel(ctx, E, Q, s.p(i + 1), c => {
          tone(c, E, Q, i, s.t)
          const tx = wide ? tx0 : (tx0 + tx1) / 2, ty = (ty0 + ty1) / 2
          if (i === newest) focusLines(c, E, s.t, P, wide ? tx + f.width / 2 : tx, ty, f.width * 0.6 + 20 * u, f.lines.length * f.lineH * 0.8 + 10 * u, { n: 70, seed: 30 + i, thick: 0.8 })
          agent(c, E, wide ? P.r - colW / 2 - pad : P.cx, P.b - P.h * 0.05, sa, { t: s.t, seed: i, ...look, flip: wide })
          box(c, E, String(i + 1), P.x + pad, wide ? P.cy : P.y + pad, ns, { anchor: wide ? 'lc' : 'lt', fill: k.dark, color: k.white })
          words(c, E, f, tx, ty - f.lines.length * f.lineH / 2, wide ? 'left' : 'center')
        })
      })
    },

    // 带集中线的大特写：数字压在爆炸框上滚上去；角上斜压一小格，小人看呆了
    number(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, P = page(E), por = E.portrait
      let i = 1
      const p0 = s.p(0), pl = sc.label ? s.p(i++) : 0, pn = sc.note ? s.p(i++) : 0, landed = E.clamp((p0 - 0.47) / 0.53)
      const size = E.pick(300, 250) * u, str = String(sc.value)
      ctx.font = E.font('title', 900, size * 0.32); const unitW0 = sc.unit ? ctx.measureText(sc.unit).width + 24 * u : 0
      const f = E.fit(str, { role: 'title', weight: 900, size, maxW: P.w * E.pick(0.5, 0.78) - unitW0, maxLines: 1, minSize: size * 0.3, lineGap: 1 })
      const us = f.size * 0.32
      ctx.font = E.font('title', 900, us); const unitW = sc.unit ? ctx.measureText(sc.unit).width + 24 * u : 0
      const lab = sc.label && E.fit(sc.label, { role: 'body', weight: 900, size: E.pick(54, 48) * u, maxW: P.w * E.pick(0.5, 0.78), maxLines: 2, lineGap: 1.2 })
      const note = sc.note && E.fit(sc.note, { role: 'body', weight: 800, size: E.pick(38, 36) * u, maxW: P.w * E.pick(0.4, 0.6), maxLines: 2, lineGap: 1.2 })
      const cx = por ? P.cx : P.x + P.w * 0.4, cy = P.y + P.h * (por ? 0.33 : 0.42), wAll = f.width + unitW
      const rx = wAll / 2 + f.size * 0.42, ry = f.size * 0.78
      const roll = E.clamp((s.t - 0.3) / Math.min(1.4, s.dur * 0.35))
      const I = por ? quad([[P.x + P.w * 0.04, P.y + P.h * 0.69], [P.x + P.w * 0.5, P.y + P.h * 0.71], [P.x + P.w * 0.49, P.b - P.h * 0.03], [P.x + P.w * 0.05, P.b - P.h * 0.04]])
        : quad([[P.r - P.w * 0.26, P.b - P.h * 0.5], [P.r - P.w * 0.035, P.b - P.h * 0.53], [P.r - P.w * 0.03, P.b - P.h * 0.05], [P.r - P.w * 0.255, P.b - P.h * 0.04]])
      const j = shake(E, s.t, [[p0, 20]])
      ctx.save(); ctx.translate(j.x, j.y)
      panel(ctx, E, P, E.clamp(s.t / 0.3), c => {
        if (landed > 0) focusLines(c, E, s.t, P, cx, cy, rx * 1.1, ry * 1.15, { n: 130, seed: 9 })
        else c.drawImage(gradTone(E, P.w, P.h, 'radial', { step: 11, rmax: 4 }), P.x, P.y)
        put(c, E, p0, cx, cy, cc => {
          burst(cc, E, 0, 0, rx, ry, { n: 20, inner: 0.8, spin: s.t * 0.15 })
          impact(cc, E, rolling(sc.value, roll), -wAll / 2 + f.width, 0, f.size, { align: 'right', fill: k.red, ow: 0.24, iw: 0.13 })
          if (sc.unit) impact(cc, E, sc.unit, -wAll / 2 + f.width + 24 * u, f.size * 0.18, us, { align: 'left', ow: 0.26, iw: 0.14 })
        }, { kind: 'slam', rot: -0.04 })
        if (lab) put(c, E, pl, cx, cy + ry * 1.12 + 26 * u, cc => box(cc, E, lab.lines, 0, 0, lab.size, { lh: lab.lineH, anchor: 'ct' }), { kind: 'pop' })
        if (note) put(c, E, pn, P.x + 26 * u, P.y + 26 * u, cc => box(cc, E, note.lines, 0, 0, note.size, { lh: note.lineH, anchor: 'lt', fill: k.dark, color: k.white }), { kind: 'drop', h: 50 })
      }, { ghost: false })
      panel(ctx, E, I, E.clamp((p0 - 0.55) / 0.45), c => {
        c.drawImage(gradTone(E, I.X1 - I.X0, I.Y1 - I.Y0, 'up', { step: 9, rmax: 3 }), I.X0, I.Y0)
        const sa = Math.min(I.h * 0.29, I.w * 0.3)
        agent(c, E, I.cx - sa * 0.3, I.b - I.h * 0.06, sa, { t: s.t, seed: 5, face: 'wide', mouth: 'o', pose: 'reach', fx: ['excl', 'shock'] })
      }, { ghost: false, tilt: 0.02 })
      sfxWord(ctx, E, landed, ono(s, '轰', 'WOW'), por ? P.x + P.w * 0.8 : cx + rx * 0.95, por ? cy - ry * 1.2 : P.y + P.h * 0.13, E.pick(116, 100) * u, { rot: 0.16 })
      ctx.restore()
    },

    // 格子里的柱状图：白柱子铺网点，最高的（或指定的）一根是强调色，砸上来时配一个拟声字
    bars(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, n = sc.items.length, por = E.portrait
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals)), dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const phi = s.p(hi + 1), lhi = E.clamp((phi - 0.6) / 0.4)
      let C = page(E)
      if (sc.title) { const [H, rest] = splitTop(E, C, headH(E)); header(ctx, s, E, H, sc.title, { pose: lhi > 0 ? 'cheer' : 'point', face: lhi > 0 ? 'star' : 'dot', mouth: 'grin' }); C = rest }
      const fillBar = (c, x, y, w, h, i) => {
        if (w <= 0.5 || h <= 0.5) return
        c.fillStyle = k.ink; c.fillRect(x + 8 * u, y + 8 * u, w, h)
        c.fillStyle = k.white; c.fillRect(x, y, w, h)
        if (i === hi) { c.fillStyle = k.red; c.fillRect(x, y, w, h) } else { c.save(); c.beginPath(); c.rect(x, y, w, h); toneFill(c, E, x, y, w, h, { step: 8, r: 2 }); c.restore() }
        c.lineWidth = 5 * u; c.strokeStyle = k.line; c.strokeRect(x, y, w, h)
      }
      let sfxAt
      panel(ctx, E, C, E.clamp(s.t / 0.3), c => {
        c.drawImage(gradTone(E, C.w, C.h * 0.22, 'up', { step: 11, rmax: 2.6 }), C.x, C.y)
        if (!por) {
          const padX = 50 * u, labH = 120 * u, base = C.b - labH, top = C.y + 100 * u, hMax = base - top
          const slot = (C.w - padX * 2) / n, bw = Math.min(slot * 0.55, 190 * u), vs = E.pick(54, 48) * u
          c.lineWidth = 8 * u; c.strokeStyle = k.ink; c.beginPath(); c.moveTo(C.x + padX * 0.5, base); c.lineTo(C.r - padX * 0.5, base); c.stroke()
          sc.items.forEach((it, i) => {
            const p = s.p(i + 1), q = E.ease.out(p), h = hMax * vals[i] / max * q, x = C.x + padX + slot * i + (slot - bw) / 2
            fillBar(c, x, base - h, bw, h, i)
            if (p <= 0) return
            c.save(); c.globalAlpha *= E.clamp(p * 2)
            impact(c, E, formatNumber(vals[i] * q, dec) + unit, x + bw / 2, base - h - vs * 0.75, vs, { fill: i === hi ? k.red : k.ink, ow: 0, iw: 0.18 })
            const lf = E.fit(it.label, { role: 'body', weight: 900, size: 36 * u, maxW: slot * 0.92 - 32 * u, maxLines: 2, lineGap: 1.15 })
            box(c, E, lf.lines, x + bw / 2, base + 20 * u, lf.size, { lh: lf.lineH, anchor: 'ct', fill: i === hi ? k.red : k.white, color: i === hi ? k.on : k.ink })
            c.restore()
            if (i === hi) sfxAt = [x + bw / 2, base - Math.max(h * 0.5, 70 * u)]
          })
        } else {
          const pad = 40 * u, rowH = Math.min((C.h - pad * 2) / n, 250 * u), y0 = C.y + (C.h - rowH * n) / 2, valW = 200 * u, wMax = C.w - pad * 2 - valW, vs = 46 * u
          c.lineWidth = 8 * u; c.strokeStyle = k.ink; c.beginPath(); c.moveTo(C.x + pad, y0); c.lineTo(C.x + pad, y0 + rowH * n); c.stroke()
          sc.items.forEach((it, i) => {
            const p = s.p(i + 1), q = E.ease.out(p), y = y0 + rowH * i, bh = rowH * 0.36, w = wMax * vals[i] / max * q, by = y + rowH * 0.52
            fillBar(c, C.x + pad, by, w, bh, i)
            if (p <= 0) return
            c.save(); c.globalAlpha *= E.clamp(p * 2)
            const lf = E.fit(it.label, { role: 'body', weight: 900, size: 34 * u, maxW: C.w - pad * 3, maxLines: 1 })
            box(c, E, lf.lines, C.x + pad + 14 * u, y + rowH * 0.06, lf.size, { anchor: 'lt', fill: i === hi ? k.red : k.white, color: i === hi ? k.on : k.ink })
            impact(c, E, formatNumber(vals[i] * q, dec) + unit, C.x + pad + w + 24 * u, by + bh / 2, vs, { align: 'left', fill: i === hi ? k.red : k.ink, ow: 0, iw: 0.18 })
            c.restore()
            if (i === hi) sfxAt = [C.x + pad + Math.max(w * 0.5, 70 * u), by + bh / 2]
          })
        }
      }, { ghost: false })
      if (sfxAt) sfxWord(ctx, E, lhi, ono(s, '砰', 'POW'), sfxAt[0], sfxAt[1], E.pick(100, 84) * u, { rot: 0.2 })
    },

    // 顺着阅读方向的几格：同一个小人一格一格往前跑，最后一格欢呼；格缝里的三角指出下一格
    steps(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, n = sc.items.length
      let body = page(E)
      if (sc.title) { const [H, rest] = splitTop(E, body, headH(E)); header(ctx, s, E, H, sc.title, { pose: 'wave' }); body = rest }
      // 宽的页面一排从左往右读；竖屏和方形一列从上往下读
      const por = body.w / body.h < 1.6, PS = por ? rows(body, n, GAP(E), 20 * u) : cols(body, n, GAP(E), 34 * u)
      const G = PS.map(Q => {
        const P = Q.m, ns = E.pick(46, 40) * u, nb = boxSize(ctx, E, '0', ns), pad = 18 * u
        const sa = por ? Math.min(P.h * 0.27, P.w * 0.1) : Math.min(P.w * 0.24, P.h * 0.16), foot = P.b - P.h * (por ? 0.07 : 0.06)
        const tx0 = por ? P.x + P.w * 0.32 : P.x + pad * 2, tx1 = P.r - pad * 2, ty0 = por ? P.y + pad : P.y + nb.h + pad * 2, ty1 = por ? P.b - pad : foot - sa * 2.7
        return { ns, pad, sa, foot, tx0, tx1, ty0, ty1, o: { role: 'body', weight: 900, size: E.pick(62, 52) * u, maxW: tx1 - tx0, maxLines: 3, maxH: (ty1 - ty0) * 0.92, lineGap: 1.22 } }
      })
      const FS = fitAll(E, sc.items, G.map(g => g.o))
      PS.forEach((P, i) => {
        const last = i === n - 1, { ns, pad, sa, foot, tx0, tx1, ty0, ty1 } = G[i], f = FS[i]
        panel(ctx, E, P, s.p(i + 1), c => {
          c.save(); c.beginPath(); c.rect(P.x - 40 * u, foot, P.w + 80 * u, P.h); toneFill(c, E, P.x - 40 * u, foot, P.w + 80 * u, P.h, { step: 9, r: 1.8 }); c.restore()
          c.lineWidth = 5 * u; c.strokeStyle = k.ink; c.beginPath(); c.moveTo(P.x - 40 * u, foot); c.lineTo(P.r + 40 * u, foot); c.stroke()
          const ax = por ? P.x + P.w * 0.17 : P.x + P.w * (n > 1 ? 0.28 + 0.44 * i / (n - 1) : 0.5)
          if (!last) { c.save(); c.beginPath(); c.rect(P.x - 40 * u, foot - sa * 2.2, ax - P.x + 40 * u - sa * 0.4, sa * 2); c.clip(); speedLines(c, E, s.t, rect(P.x, foot - sa * 2.2, ax, foot - sa * 0.3), 0, { n: 14, seed: 50 + i, speed: 2.2 }); c.restore() }
          const hop = last ? Math.abs(Math.sin(s.t * 6)) * sa * 0.18 : 0
          agent(c, E, ax, foot - hop, sa, last ? { t: s.t, seed: i, pose: 'cheer', face: 'star', mouth: 'grin', fx: ['sparkle'], legs: 'jump' } : { t: s.t + i * 0.3, seed: i, pose: 'reach', legs: 'run', look: [1, 0], lean: 0.12 })
          box(c, E, String(i + 1), P.x + pad, P.y + pad, ns, { anchor: 'lt', fill: last ? k.red : k.dark, color: last ? k.on : k.white })
          words(c, E, f, por ? tx0 : (tx0 + tx1) / 2, (ty0 + ty1) / 2 - f.lines.length * f.lineH / 2, por ? 'left' : 'center')
        })
        if (i < n - 1 && s.p(i + 2) > 0) {
          const N = PS[i + 1], mid = (a, b) => (a[0] + b[0]) / 2
          const gx = por ? P.r - 70 * u : (mid(P.pts[1], P.pts[2]) + mid(N.pts[0], N.pts[3])) / 2, gy = por ? ((P.pts[2][1] + N.pts[1][1]) / 2) : P.y + P.h * 0.5
          put(ctx, E, s.p(i + 2), gx, gy, cc => { tri(cc, E, 0, 0, 66 * u, por ? Math.PI / 2 : 0, k.white); tri(cc, E, 0, 0, 50 * u, por ? Math.PI / 2 : 0, k.ink) }, { kind: 'pop' })
        }
      })
    },

    // 左右对峙的两格，中间斜着劈开，格缝上一个 VS；右边是推荐的一方，用强调色的网点和框
    compare(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, por = E.portrait
      let body = page(E)
      if (sc.title) { const [H, rest] = splitTop(E, body, headH(E)); header(ctx, s, E, H, sc.title, { pose: 'shrug' }); body = rest }
      const PS = por ? rows(body, 2, GAP(E) * 1.6, 46 * u) : cols(body, 2, GAP(E) * 1.6, 70 * u)
      const pad = 26 * u, sides = [sc.left, sc.right]
      const G = sides.map((side, i) => {
        const P = PS[i], agentRight = por ? i === 0 : i === 1, colW = P.w * (por ? 0.27 : 0.3)
        const x0 = agentRight ? P.x + pad : P.x + colW, x1 = agentRight ? P.r - colW : P.r - pad
        const tf = E.fit(side.title, { role: 'title', weight: 900, size: E.pick(54, 50) * u, maxW: P.w - pad * 2 - 50 * u, maxLines: 1 })
        const iy0 = P.y + pad + boxSize(ctx, E, tf.lines, tf.size).h + 30 * u, items = side.items || [], rowH = Math.min((P.b - pad - iy0) / Math.max(1, items.length), 150 * u)
        return { agentRight, colW, x0, x1, tf, iy0, items, rowH, o: { role: 'body', weight: 800, size: Math.min(E.pick(46, 44) * u, rowH * 0.42), maxW: x1 - x0 - 40 * u, maxLines: 2, maxH: rowH * 0.92, lineGap: 1.2 } }
      })
      // 两边的条目用同一个字号
      const all = fitAll(E, G.flatMap(g => g.items), G.flatMap(g => g.items.map(() => g.o)))
      sides.forEach((side, i) => {
        const P = PS[i], strong = i === 1, p = s.p(i + 1), { agentRight, colW, x0, tf, iy0, rowH } = G[i], fs = i ? all.slice(G[0].items.length) : all.slice(0, G[0].items.length)
        panel(ctx, E, P, p, c => {
          const h = P.Y1 - P.Y0
          c.drawImage(gradTone(E, P.X1 - P.X0, h * 0.75, 'down', { step: 10, rmax: 3.4, color: strong ? k.red : k.ink }), P.X0, P.Y1 - h * 0.75)
          const sa = Math.min(colW * 0.42, P.h * 0.17), ax = agentRight ? P.r - colW * 0.5 : P.x + colW * 0.5
          agent(c, E, ax, P.b - P.h * 0.05, sa, strong ? { t: s.t, seed: 4, pose: 'thumbs', face: 'star', mouth: 'grin', fx: ['sparkle'], flip: agentRight } : { t: s.t, seed: 2, pose: 'shrug', face: 'dot', mouth: 'flat', fx: ['sweat'], flip: agentRight })
          box(c, E, tf.lines, P.x + pad, P.y + pad, tf.size, { anchor: 'lt', fill: strong ? k.red : k.dark, color: strong ? k.on : k.white })
          fs.forEach((f, n) => {
            const cy = iy0 + rowH * n + rowH / 2
            c.fillStyle = strong ? k.red : k.ink; c.fillRect(x0, cy - 8 * u, 16 * u, 16 * u)
            words(c, E, f, x0 + 34 * u, cy - f.lines.length * f.lineH / 2, 'left', { w: 800 })
          })
        })
      })
      const [L, Rr] = PS, mid = (a, b) => (a + b) / 2
      const vx = por ? body.cx : mid(mid(L.pts[1][0], L.pts[2][0]), mid(Rr.pts[0][0], Rr.pts[3][0])), vy = por ? mid(mid(L.pts[2][1], L.pts[3][1]), mid(Rr.pts[0][1], Rr.pts[1][1])) : body.cy
      put(ctx, E, E.clamp((s.p(2) - 0.4) / 0.6), vx, vy, cc => { burst(cc, E, 0, 0, 92 * u, 78 * u, { n: 14, inner: 0.72 }); impact(cc, E, 'VS', 0, 4 * u, 62 * u, { fill: k.red, ow: 0.22, iw: 0.12 }) }, { kind: 'slam', rot: -0.1 })
    },

    // 对话气泡：小人开口说出这句话，出处是它旁边的旁白框
    quote(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, P = page(E), por = E.portrait
      const p0 = s.p(0), p1 = sc.by ? s.p(1) : 0
      const sa = por ? P.w * 0.17 : P.h * 0.21, ax = P.x + P.w * (por ? 0.24 : 0.15), foot = P.b - P.h * 0.05
      const bx = por ? P.cx + P.w * 0.02 : P.x + P.w * 0.59, by = P.y + P.h * (por ? 0.36 : 0.42)
      const mrx = P.w * (por ? 0.46 : 0.37), mry = P.h * (por ? 0.27 : 0.38), pad = 30 * u
      const f = E.fit(sc.text, { role: 'title', weight: 800, size: E.pick(84, 72) * u, maxW: mrx * 1.41 - pad * 2, maxLines: E.pick(4, 6), maxH: mry * 1.41 - pad * 2, lineGap: 1.32 })
      const th = f.lines.length * f.lineH, rx = Math.max(f.width / 2 * 1.41 + pad, mrx * 0.55), ry = Math.max(th / 2 * 1.41 + pad, mry * 0.5)
      const byf = sc.by && E.fit('— ' + sc.by, { role: 'body', weight: 900, size: E.pick(40, 38) * u, maxW: P.w * (por ? 0.62 : 0.45), maxLines: 1 })
      const talk = p0 > 0 && s.t < s.dur * 0.6 && Math.floor(s.t * 7) % 2 === 0
      panel(ctx, E, P, E.clamp(s.t / 0.3), c => {
        c.drawImage(gradTone(E, P.w, P.h * 0.45, 'down', { step: 11, rmax: 3.6 }), P.x, P.b - P.h * 0.45)
        c.drawImage(gradTone(E, P.w * 0.5, P.h * 0.5, 'radial', { step: 10, rmax: 2.6 }), P.r - P.w * 0.5, P.y)
        agent(c, E, ax, foot, sa, { t: s.t, seed: 6, pose: p0 > 0 ? 'hold' : 'idle', mouth: talk ? 'open' : 'smile', face: p0 > 0 ? 'happy' : 'dot', look: [1, -1] })
        put(c, E, p0, bx, by, cc => {
          const hx = ax + sa * 0.6 - bx, hy = foot - sa * 2.3 - by, d = Math.hypot(hx, hy), ca = hx / d, sn = hy / d
          const edge = 1 / Math.hypot(ca / rx, sn / ry), L = Math.min(d - sa * 0.3, edge + 150 * u)
          bubble(cc, E, 0, 0, rx, ry, { tail: [ca * L, sn * L] })
          cc.fillStyle = k.ink; cc.font = E.font('title', 800, f.size); cc.textAlign = 'center'; cc.textBaseline = 'middle'
          f.lines.forEach((ln, n) => cc.fillText(ln, 0, (n - (f.lines.length - 1) / 2) * f.lineH))
        }, { kind: 'pop' })
        if (byf) put(c, E, p1, por ? P.r - 30 * u : ax + sa * 1.2, por ? P.b - P.h * 0.1 : foot - sa * 0.5, cc => box(cc, E, byf.lines, 0, 0, byf.size, { anchor: por ? 'rc' : 'lc' }), { kind: 'drop', h: 50 })
      }, { ghost: false })
    },

    // 最后一格：一张黑底大格斜压在整页上，白色集中线，大字白底红边；小人挥手，右下角「TO BE CONTINUED」
    end(ctx, s, E) {
      const u = E.u, k = K(E), sc = s.scene, R = page(E), por = E.portrait, g = GAP(E)
      let i = 0
      const pt = s.p(i++), ps = sc.subtitle ? s.p(i++) : 0, pc = sc.cta ? s.p(i++) : 0, landed = E.clamp((pt - 0.47) / 0.53)
      // 压在下面的这一页：几格只有网点的空格
      const under = por ? rows(R, 3, g, 22 * u) : rows(R, 2, g, 0).flatMap((b, j) => cols(b, j ? 3 : 2, g, 30 * u))
      under.forEach((P, n) => panel(ctx, E, P, 1, c => tone(c, E, P, n, s.t)))
      const ins = E.pick(70, 44) * u, P = rect(R.x + ins, R.y + ins * 0.8, R.r - ins, R.b - ins * 0.8)
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(128, 108) * u, maxW: P.w * 0.8, maxLines: 3, lineGap: 1.22, oneLine: true })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 900, size: E.pick(48, 44) * u, maxW: P.w * 0.7, maxLines: 2, lineGap: 1.2 })
      const cta = sc.cta && E.fit(sc.cta, { role: 'body', weight: 900, size: E.pick(50, 46) * u, maxW: P.w * 0.6, maxLines: 1 })
      const th = big.lines.length * big.lineH, sh = sub ? boxSize(ctx, E, sub.lines, sub.size, { lh: sub.lineH }).h + 36 * u : 0, ch = cta ? boxSize(ctx, E, cta.lines, cta.size * 1.1).h + 50 * u : 0
      const y0 = P.y + P.h * E.pick(0.44, 0.42) - (th + sh + ch) / 2
      const tbc = E.clamp((s.t - Math.max(s.dur * 0.6, 1.2)) / 0.35) * (s.p(i - 1) >= 1 ? 1 : 0)
      const j = shake(E, s.t, [[pt, 14]])
      ctx.save(); ctx.translate(j.x, j.y)
      panel(ctx, E, P, E.clamp(s.t / 0.3), c => {
        if (landed > 0) focusLines(c, E, s.t, P, P.cx, y0 + th / 2, big.width * 0.6 + 30 * u, th * 0.9, { n: 100, seed: 61, color: E.rgba(k.white, 0.75), thick: 0.7 })
        else speedLines(c, E, s.t, P, Math.PI / 2, { n: 30, seed: 62, speed: 2, color: E.rgba(k.white, 0.4) })
        const sa = E.pick(P.h * 0.12, P.w * 0.13)
        agent(c, E, P.x + P.w * E.pick(0.1, 0.17), P.b - P.h * 0.05, sa, { t: s.t, seed: 7, pose: 'wave', face: 'happy', mouth: 'grin' })
        put(c, E, pt, P.cx, y0 + th / 2, cc => big.lines.forEach((ln, n) => impact(cc, E, ln, 0, (n - (big.lines.length - 1) / 2) * big.lineH, big.size, { fill: k.white, line: k.red, halo: k.ink, ow: 0.26, iw: 0.14 })), { kind: 'slam', rot: -0.03 })
        if (sub) put(c, E, ps, P.cx, y0 + th + 36 * u, cc => box(cc, E, sub.lines, 0, 0, sub.size, { lh: sub.lineH, anchor: 'ct' }), { kind: 'pop' })
        if (cta) put(c, E, pc, P.cx, y0 + th + sh + 50 * u, cc => box(cc, E, cta.lines, 0, 0, cta.size * 1.1, { anchor: 'ct', fill: k.red, color: k.on, lw: 5 }), { kind: 'slam' })
        if (tbc > 0) {
          // 「待续」箭头：从右边推进来
          const fs = E.pick(40, 34) * u, txt = 'TO BE CONTINUED'
          c.font = E.font('title', 900, fs); const w = c.measureText(txt).width + fs * 2.4, h = fs * 1.9
          const x = P.r - w - 30 * u + (1 - E.ease.out(tbc)) * (w + 60 * u), y = P.b - h - 30 * u
          c.save(); c.globalAlpha *= tbc; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w - h * 0.5, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w - h * 0.5, y + h); c.lineTo(x, y + h); c.closePath()
          c.fillStyle = k.white; c.fill(); c.lineWidth = 4 * u; c.strokeStyle = k.red; c.stroke()
          c.fillStyle = k.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x + (w - h * 0.5) / 2 + fs * 0.2, y + h / 2 + fs * 0.04); c.restore()
        }
      }, { ghost: false, big: true, tilt: -0.012, rot: 0.02, bg: k.ink })
      ctx.restore()
    },
  },

  // 字幕：黑底白字的旁白条，内嵌一圈白细线，带硬投影
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const { W, H, u } = E, k = K(E)
    const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((a, b) => a + b, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const a = Math.min(E.clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : E.clamp((t1 - s.t) / 0.12))
    const size = E.pick(40, 46) * u
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 700, size, maxW: W - E.safe.l * 2 - size * 1.3, maxLines: 2, lineGap: 1.32, quiet: true })
    const w = f.width + f.size * 1.3, h = f.lines.length * f.lineH + f.size * 0.7, cy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0), x = W / 2 - w / 2, y = cy - h / 2
    ctx.globalAlpha = E.clamp(a * 1.6); ctx.translate(0, (1 - E.ease.out(E.clamp(a * 1.5))) * 10 * u)
    ctx.fillStyle = E.rgba(k.ink, 0.18); ctx.fillRect(x + 6 * u, y + 7 * u, w, h)
    ctx.fillStyle = k.dark; ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = k.white; ctx.lineWidth = 2.5 * u; ctx.strokeRect(x + 7 * u, y + 7 * u, w - 14 * u, h - 14 * u)
    ctx.fillStyle = k.white; ctx.font = E.font('body', 700, f.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    f.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + h / 2 + (i - (f.lines.length - 1) / 2) * f.lineH + f.size * 0.03))
  },

  // 默认版式会调用的零件（九种版式都重画了，这些只在别处借用默认摆法时用到）：格子、柱子、方块标记、粗下划线
  card(ctx, E, x, y, w, h, o = {}) {
    const k = K(E), u = E.u
    ctx.save(); ctx.fillStyle = E.rgba(k.ink, 0.16); ctx.fillRect(x + 8 * u, y + 9 * u, w, h)
    ctx.fillStyle = o.tone === 'accent' ? k.red : k.white; ctx.fillRect(x, y, w, h); ctx.lineWidth = 7 * u; ctx.strokeStyle = k.line; ctx.strokeRect(x, y, w, h); ctx.restore()
  },
  bar(ctx, E, x, y, w, h, o = {}) {
    const k = K(E), u = E.u
    ctx.save(); ctx.fillStyle = k.ink; ctx.fillRect(x + 8 * u, y + 8 * u, w, h); ctx.fillStyle = o.color ?? k.red; ctx.fillRect(x, y, w, h)
    ctx.lineWidth = 5 * u; ctx.strokeStyle = k.line; ctx.strokeRect(x, y, w, h); ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) { const k = K(E); ctx.save(); ctx.fillStyle = o.color ?? k.dark; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore() },
  underline(ctx, E, x, y, w, p) { const k = K(E); ctx.save(); ctx.fillStyle = k.ink; ctx.fillRect(x, y, w * p, 10 * E.u); ctx.fillStyle = k.red; ctx.fillRect(x, y + 14 * E.u, w * p * 0.4, 6 * E.u); ctx.restore() },

  music: { style: 'drive', prog: ['Em', 'Em', 'C', 'D'], lead: 'pluck', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'thud' },
}
