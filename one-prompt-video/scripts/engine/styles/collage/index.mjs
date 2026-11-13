// 风格包：剪贴拼贴。一场是一页杂志拼贴：牛皮纸底上压一张按场换色的杂志页，内容全是贴上去的纸片——
// 撕纸色块、胶带、回形针、订书钉、半调网点的图片块；标题是一个字一个字剪下来贴的剪字；批注是红笔手写和手画的箭头、圈。
// 移植自风格库的 N-剪贴拼贴（画法库在 lib/clip.mjs，底、字幕、转场在 lib/page.mjs）。
import { pal, isLight, scrap, tape, PINK_TAPE, put, shake, photo, burst, clipWire, staple, ransomFit, ransomLines, ransomPal, hand, pen, penEllipse, penArrow, penCheck, scissors } from './lib/clip.mjs'
import { bgImage, caption, tornSweep } from './lib/page.mjs'
import { drawLines, formatNumber, decimalsOf, mix } from '../../core.mjs'

// 第 i 个元素入场以后过了多久（秒）；d 是再往后推的秒数（负数是提前）
const at = (s, i, d = 0) => s.t - s.cue(i) - d
// 写字的纸：几种旧纸轮着用
const PAPERS = k => [
  { fill: k.white, tex: 'lines' }, { fill: k.sky, tex: 'grid' }, { fill: k.news, tex: 'news', texColor: 'rgba(40,30,20,0.07)' },
  { fill: k.blush, tex: null }, { fill: mix(k.mustard, '#ffffff', 0.45), tex: 'dots', texColor: 'rgba(120,70,10,0.12)' }, { fill: k.cream, tex: 'grid' },
]
// 写着字的纸片：f 是 E.fit 的结果，以 (0,0) 为中心
const slipSize = (f, padX = 0.6, padY = 0.42) => ({ w: f.width + f.size * padX * 2, h: f.lines.length * f.lineH + f.size * padY * 2 })
function slip(c, E, f, o) {
  const { w, h } = o.w ? o : slipSize(f, o.padX, o.padY)
  scrap(c, E, w, h, { fill: o.fill, seed: o.seed, torn: o.torn ?? 'tblr', tex: o.tex, texColor: o.texColor, shadow: o.shadow ?? 1, rough: o.rough ?? 5 })
  c.font = E.font(o.role || 'body', o.wt || 700, f.size); c.fillStyle = o.color
  drawLines(c, f.lines, 0, -f.lines.length * f.lineH / 2, f.lineH, 'center')
  return { w, h }
}
// 几段字用同一个字号（取各自能放下的最小字号），一页里的纸片字号不忽大忽小
function fitAll(E, texts, o) {
  const size = Math.min(...texts.map(t => E.fit(t, o).size))
  return texts.map(t => E.fit(t, { ...o, size }))
}
// 编号小纸块：一个数字一块，底色轮换
function badge(c, E, k, txt, size, i) {
  const fill = [k.ink, k.hot, k.alt, k.blue, k.pen][i % 5]
  scrap(c, E, size * 0.9, size * 1.06, { fill, seed: 90 + i * 3, torn: i % 2 ? 'tblr' : '', rough: 3 })
  c.font = E.font('num', 900, size * 0.68); c.fillStyle = isLight(fill) ? k.ink : k.white; c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(txt, 0, size * 0.04)
}
// 场标题：一行剪字贴在左上角，贴完红笔在下面划一道。返回下面可用区域的 y
function heading(ctx, s, E, k, text) {
  const B = E.L.box, u = E.u
  if (!text) return B.y
  const R = ransomFit(E, text, { size: E.pick(62, 54) * u, maxW: B.w * E.pick(0.78, 1), maxLines: E.pick(1, 2) })
  const r = ransomLines(ctx, E, R, B.x + 4 * u, B.y, { align: 'left', dt: at(s, 0), step: 0.045, seed: 7 + s.index * 13, palette: ransomPal(k) })
  const last = r.rows[r.rows.length - 1], yb = B.y + r.h + 6 * u
  pen(ctx, E, [[B.x, yb + 4 * u], [B.x + last.w + 10 * u, yb - 3 * u]], E.k(at(s, 0), r.n * 0.045 + 0.15, 0.3, E.ease.out), { color: k.pen, w: 6, seed: 3 + s.index })
  return yb + 30 * u
}

// statement 用：一行字按词剪成几张纸条，每张一种底色、一种字体；高亮的那段是一张强调色纸条
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', { granularity: 'word' }) : null
function wordRow(ctx, E, k, line, size, seed, hot) {
  return E.once(`collage:wr:${line}:${size.toFixed(1)}:${seed}:${hot}`, () => {
    const chars = [...line], parts = []
    const add = (str, isHot) => {
      if (!str) return
      if (isHot) { parts.push({ t: str, hot: true }); return }
      for (const w of SEG ? [...SEG.segment(str)].map(x => x.segment) : [...str]) {
        if (/^\s+$/.test(w)) { parts.push({ sp: true }); continue }
        const prev = parts[parts.length - 1]
        // 标点粘在前一张上；两个单字拼成一张，免得一字一张太碎
        if (prev && !prev.sp && (/^[\p{P}\p{S}]+$/u.test(w) || (!prev.hot && [...prev.t].length + [...w].length <= 2))) { prev.t += w; continue }
        parts.push({ t: w })
      }
    }
    if (hot) { add(chars.slice(0, hot[0]).join(''), false); add(chars.slice(hot[0], hot[1]).join(''), true); add(chars.slice(hot[1]).join(''), false) } else add(line, false)
    const r = E.rng(seed * 131 + chars.length), F = [[E.fonts.serif, 900], [E.fonts.sans, 900], [E.fonts.serif, 700], [E.fonts.sans, 700]]
    const P = [k.white, k.news, k.ink, k.sky, k.blush, k.cream, mix(k.mustard, '#ffffff', 0.3), k.kraft]
    const blocks = []
    let x = 0, last = -1
    for (const p of parts) {
      if (p.sp) { x += size * 0.22; continue }
      let bi = Math.floor(r() * P.length); if (bi === last) bi = (bi + 1) % P.length; last = bi
      const [fam, wt] = p.hot ? [E.fonts.sans, 900] : F[Math.floor(r() * F.length)], sz = size * (p.hot ? 1.1 : 0.93 + r() * 0.12)
      ctx.font = `${wt} ${sz}px ${fam}`
      const tw = ctx.measureText(p.t).width, w = tw + sz * 0.42, bg = p.hot ? k.hot : P[bi]
      blocks.push({ t: p.t, hot: p.hot, fam, wt, sz, bg, color: p.hot ? k.on : isLight(bg) ? k.ink : k.white, w, h: sz * 1.4, x: x + w / 2, y: (r() - 0.5) * size * 0.1, rot: (r() - 0.5) * 0.08, torn: r() < 0.5 ? 'tblr' : 'lr', seed: Math.floor(r() * 9999) })
      x += w + size * 0.08
    }
    const W = x - size * 0.08
    for (const b of blocks) b.x -= W / 2
    return { blocks, W }
  })
}

export default {
  name: '剪贴拼贴', mood: '牛皮纸、撕纸、胶带和剪下来的字，轻松的科普、盘点、栏目开场', bpm: 118,
  c: { bg: '#c49a68', fg: '#25201b', muted: '#8c8478', accent: '#ff4d8f', accent2: '#2d7a70', card: '#f5eddb', line: '#d42a2a', onAccent: '#ffffff' },
  fontTitle: 'serif', fontBody: 'sans', fontNum: 'serif', wTitle: 900, wBody: 700, radius: 0,
  motion: 'slam', solidAccent: true,

  bg(ctx, E, s) { ctx.drawImage(bgImage(E, s), 0, 0) },

  layouts: {
    // 片头：网点图片块垫底，标题一个字一个字拍上去；kicker 是别着回形针的黑纸条，副标题是一条报纸条
    title(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W
      let i = 0
      const ik = sc.kicker ? i++ : -1, it = i++, is = sc.subtitle ? i++ : -1
      const R = ransomFit(E, sc.title, { size: E.pick(168, 140) * u, maxW: B.w * E.pick(0.86, 0.88), maxLines: E.pick(2, 3), maxH: B.h * 0.62, oneLine: false })
      const RO = { seed: 3, palette: ransomPal(k), step: 0.07 }, box = ransomLines(ctx, E, R, W / 2, 0, { ...RO, dry: true })
      const kf = sc.kicker && E.fit(sc.kicker, { role: 'body', weight: 700, size: E.pick(40, 36) * u, maxW: B.w * 0.6, maxLines: 1 })
      const sf = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 700, size: E.pick(54, 44) * u, maxW: B.w * 0.78, maxLines: 2, lineGap: 1.3 })
      const ks = kf && slipSize(kf, 0.7, 0.45), ss = sf && slipSize(sf, 0.7, 0.5)
      const pw = Math.min(box.w + E.pick(230, 110) * u, E.W - 60 * u), ph = box.h + E.pick(170, 150) * u
      const pTop = B.y + (B.h - ((ks ? ks.h * 0.5 : 0) + ph + (ss ? ss.h * 0.8 : 0))) / 2 + (ks ? ks.h * 0.5 : 0), pcy = pTop + ph / 2
      const land = at(s, it) - (box.n - 1) * RO.step - 0.2, j = shake(E, [[land, 9, 0.3]])
      ctx.save(); ctx.translate(j.x, j.y)
      put(ctx, E, at(s, it, -0.25), { x: W / 2, y: pcy, rot: -0.018, seed: 21 }, c => {
        photo(c, E, pw, ph, { fill: k.sky, dot: E.rgba(k.blue, 0.42), seed: 22, corner: [1, 0] })
        tape(c, E, -pw / 2 + 34 * u, ph / 2 - 12 * u, 150 * u, 42 * u, 0.7, { seed: 23 })
        tape(c, E, pw / 2 - 34 * u, ph / 2 - 12 * u, 150 * u, 42 * u, -0.7, { seed: 24, color: PINK_TAPE })
      })
      ransomLines(ctx, E, R, W / 2, pcy - box.h / 2, { ...RO, dt: at(s, it) })
      put(ctx, E, land, { x: W / 2 + pw / 2 - 6 * u, y: pTop - 4 * u, rot: 0.16, seed: 25 }, c => {
        burst(c, E, E.pick(64, 56) * u, { fill: k.hot, seed: 4 })
        c.font = E.font('title', 900, E.pick(64, 56) * u); c.fillStyle = k.on; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 4 * u)
      })
      if (kf) put(ctx, E, at(s, ik), { x: W / 2 - pw / 2 + ks.w / 2 + 40 * u, y: pTop, rot: -0.035, seed: 26 }, c => {
        slip(c, E, kf, { fill: k.ink, color: k.white, seed: 27, padX: 0.7, padY: 0.45 }); clipWire(c, E, -ks.w / 2 + 12 * u, -ks.h * 0.32, 0.2, 100)
      })
      if (sf) put(ctx, E, at(s, is), { x: W / 2 + E.pick(70, 0) * u, y: pTop + ph + ss.h * 0.28, rot: 0.014, seed: 28 }, c => slip(c, E, sf, { fill: k.news, color: k.ink, seed: 29, tex: 'news', texColor: 'rgba(40,30,20,0.06)', padX: 0.7, padY: 0.5 }))
      ctx.restore()
    },

    // 一句话：按词剪成纸条，一张一张拍在横线本纸上；高亮的那段是强调色纸条，贴完红笔圈出来
    statement(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W, RW = 1.28
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(122, 94) * u * RW, maxW: B.w * E.pick(0.84, 0.9), maxLines: E.pick(3, 5), maxH: B.h * 0.8, lineGap: 1.7 / RW })
      const size = f.size / RW, joined = f.lines.join(''), hl = sc.highlight ? String(sc.highlight) : '', hc = hl ? joined.indexOf(hl) : -1
      const hs = hc < 0 ? -1 : [...joined.slice(0, hc)].length, hn = [...hl].length
      let off = 0
      const rows = f.lines.map((ln, i) => {
        const n = [...ln].length, a0 = Math.max(0, hs - off), a1 = Math.min(n, hs + hn - off); off += n
        const row = wordRow(ctx, E, k, ln, size, 50 + i * 7 + s.index, hs >= 0 && a1 > a0 ? [a0, a1] : null)
        return { ...row, kk: Math.min(1, B.w * 0.92 / row.W) }
      })
      const th = rows.length * f.lineH, cy = B.y + B.h / 2, sw = Math.max(...rows.map(r => r.W * r.kk)) + 130 * u, sh = th + 90 * u
      put(ctx, E, at(s, 0, -0.25), { x: W / 2, y: cy, rot: 0.01, seed: 31 }, c => {
        scrap(c, E, sw, sh, { fill: k.white, seed: 32, tex: 'lines', rough: 7 })
        tape(c, E, -sw * 0.42, -sh / 2 + 6 * u, 160 * u, 44 * u, -0.5, { seed: 33, color: PINK_TAPE })
        tape(c, E, sw * 0.42, -sh / 2 + 6 * u, 160 * u, 44 * u, 0.55, { seed: 34 })
      })
      const dt = at(s, 0), step = 0.08, hot = []
      let n = 0
      rows.forEach((row, i) => {
        const y = cy - th / 2 + i * f.lineH + f.lineH / 2
        ctx.save(); ctx.translate(W / 2, y); ctx.scale(row.kk, row.kk)
        row.blocks.forEach(b => {
          put(ctx, E, dt - n++ * step, { x: b.x, y: b.y, rot: b.rot, seed: b.seed, amp: 1.5 }, c => {
            scrap(c, E, b.w, b.h, { fill: b.bg, seed: b.seed, torn: b.torn, rough: 3, tex: b.hot ? 'dots' : null, texColor: 'rgba(255,255,255,0.25)' })
            c.font = `${b.wt} ${b.sz}px ${b.fam}`; c.fillStyle = b.color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.t, 0, b.sz * 0.05)
          })
          if (b.hot) hot.push([W / 2 + b.x * row.kk, y + b.y * row.kk, b.w * row.kk, b.h * row.kk])
        })
        ctx.restore()
      })
      const pp = E.k(dt, n * step + 0.25, 0.5, E.ease.inOut)
      hot.forEach(([x, y, w, h], q) => penEllipse(ctx, E, x, y, w / 2 + 26 * u, h / 2 + 20 * u, pp, { color: k.pen, w: 7, seed: 9 + q }))
    },

    // 要点：一条一张纸条，左端一个编号小纸块，右端一截胶带；横屏右边空着时贴一张网点图片块
    bullets(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, por = E.portrait
      const top = heading(ctx, s, E, k, sc.title), avail = B.y + B.h - top
      const gap = E.pick(20, 26) * u, rowH = Math.min((avail - gap * (n - 1)) / n, E.pick(150, 180) * u), bs = Math.min(rowH * 0.8, E.pick(94, 92) * u)
      const pad = 30 * u, listW = por ? B.w - 60 * u : B.w * 0.68
      const fs = fitAll(E, sc.items, { role: 'body', weight: 700, size: Math.min(E.pick(58, 50) * u, rowH * 0.4), maxW: listW - bs * 0.55 - pad * 2, maxLines: 2, maxH: rowH * 0.74, lineGap: 1.22 })
      const y0 = top + (avail - rowH * n - gap * (n - 1)) / 2, P = PAPERS(k)
      let right = 0
      sc.items.forEach((it, i) => {
        const f = fs[i], pp = P[i % P.length], w = Math.max(f.width + pad * 2 + bs * 0.55, rowH * 2.4), h = rowH * 0.86
        const x = B.x + bs * 0.45 + (i % 2 ? E.pick(44, 24) * u : 0) + w / 2, y = y0 + i * (rowH + gap) + rowH / 2
        right = Math.max(right, x + w / 2)
        put(ctx, E, at(s, i + 1), { x, y, rot: i % 2 ? 0.012 : -0.016, seed: 40 + i }, c => {
          scrap(c, E, w, h, { fill: pp.fill, seed: 41 + i * 7, tex: pp.tex, texColor: pp.texColor, rough: 5 })
          c.font = E.font('body', 700, f.size); c.fillStyle = k.ink
          drawLines(c, f.lines, -w / 2 + bs * 0.55 + pad, -f.lines.length * f.lineH / 2, f.lineH, 'left')
          tape(c, E, w / 2 - 4 * u, -h * 0.08, 92 * u, 32 * u, 1.25 + (i % 2) * 0.45, { seed: 45 + i, color: i % 3 === 1 ? PINK_TAPE : undefined })
          c.save(); c.translate(-w / 2, 0); c.rotate(-0.08 + (i % 2) * 0.14); badge(c, E, k, String(i + 1), bs, i); c.restore()
        })
      })
      const room = B.x + B.w - right
      if (!por && room > 380 * u) {
        const pw = Math.min(room - 90 * u, 470 * u), ph = Math.min(avail * 0.86, pw * 1.22), px = right + room / 2 + 10 * u, py = top + avail / 2
        put(ctx, E, at(s, 0, -0.15), { x: px, y: py, rot: 0.035, seed: 48 }, c => {
          photo(c, E, pw, ph, { fill: k.blush, dot: E.rgba(k.hot, 0.5), seed: 49, corner: [0, 1] })
          clipWire(c, E, -pw * 0.28, -ph / 2 + 10 * u, 0.12, 130)
          tape(c, E, pw / 2 - 20 * u, ph / 2 - 24 * u, 150 * u, 42 * u, -0.75, { seed: 47, color: PINK_TAPE })
        })
      }
    },

    // 大数字：每一位一块剪字，拍在网点图片块上；单位是一张黑纸条，贴完红笔圈起来；label 是报纸条，note 是蓝笔手写
    number(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W
      let i = 1
      const il = sc.label ? i++ : -1, inn = sc.note ? i++ : -1
      const R = ransomFit(E, String(sc.value), { size: E.pick(280, 230) * u, maxW: B.w * (sc.unit ? E.pick(0.58, 0.64) : 0.84), maxLines: 1 })
      const RO = { seed: 5, palette: ransomPal(k), step: 0.09 }, nb = ransomLines(ctx, E, R, 0, 0, { ...RO, dry: true })
      const uf = sc.unit && E.fit(sc.unit, { role: 'body', weight: 900, size: Math.max(R.size * 0.34, 40 * u), maxW: B.w * 0.26, maxLines: 1 }), us = uf && slipSize(uf, 0.5, 0.35)
      const lf = sc.label && E.fit(sc.label, { role: 'body', weight: 700, size: E.pick(52, 46) * u, maxW: B.w * 0.8, maxLines: 2, lineGap: 1.25 }), ls = lf && slipSize(lf, 0.7, 0.45)
      const nf = sc.note && E.fit(sc.note, { role: 'body', weight: 600, size: E.pick(42, 40) * u, maxW: B.w * 0.72, maxLines: 2, lineGap: 1.3 })
      const wAll = nb.w + (us ? us.w + 24 * u : 0), pw = wAll + 170 * u, ph = nb.h + 110 * u
      const hL = ls ? ls.h + 34 * u : 0, hN = nf ? nf.lines.length * nf.lineH + 30 * u : 0
      const pTop = B.y + (B.h - ph - hL - hN) / 2, cy = pTop + ph / 2, nx = W / 2 - wAll / 2 + nb.w / 2
      const land = at(s, 0) - (nb.n - 1) * RO.step - 0.2, j = shake(E, [[land, 12, 0.3]])
      ctx.save(); ctx.translate(j.x, j.y)
      put(ctx, E, at(s, 0, -0.25), { x: W / 2, y: cy, rot: 0.015, seed: 51 }, c => {
        photo(c, E, pw, ph, { fill: mix(k.mustard, '#ffffff', 0.35), dot: E.rgba(k.rust, 0.4), seed: 52, corner: [0, 0] })
        tape(c, E, 0, -ph / 2 + 4 * u, 170 * u, 44 * u, 0.04, { seed: 53 })
      })
      ransomLines(ctx, E, R, nx, cy - nb.h / 2, { ...RO, dt: at(s, 0) })
      if (uf) put(ctx, E, land + 0.05, { x: W / 2 + wAll / 2 - us.w / 2, y: cy + R.size * 0.3, rot: 0.06, seed: 54 }, c => slip(c, E, uf, { fill: k.ink, color: k.white, role: 'body', wt: 900, seed: 55, padX: 0.5, padY: 0.35 }))
      penEllipse(ctx, E, W / 2, cy, wAll / 2 + 52 * u, nb.h / 2 + 26 * u, E.k(land, 0.3, 0.55, E.ease.inOut), { color: k.pen, w: 7, seed: 9 })
      let y = pTop + ph
      if (lf) { const ly = y + 34 * u + ls.h / 2; put(ctx, E, at(s, il), { x: W / 2, y: ly, rot: -0.012, seed: 56 }, c => slip(c, E, lf, { fill: k.news, color: k.ink, seed: 57, tex: 'news', texColor: 'rgba(40,30,20,0.06)', padX: 0.7, padY: 0.45 })); y += hL }
      if (nf) {
        const dn = at(s, inn), N = nf.lines.reduce((a, l) => a + [...l].length, 0), vis = N * E.clamp(dn / 0.7)
        let before = 0
        nf.lines.forEach((ln, q) => { const L = [...ln].length; hand(ctx, E, ln, W / 2, y + 30 * u + q * nf.lineH + nf.lineH / 2, nf.size, { color: k.bluepen, p: E.clamp((vis - before) / L), rot: -0.02, seed: 60 + q }); before += L })
      }
      ctx.restore()
    },

    // 柱状图：撕下来的报纸条当柱子，从一条白纸条后面抽上来，顶上压一截胶带；高亮的那根是强调色网点纸，数值签被红笔圈住。竖屏改成横条
    bars(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, por = E.portrait
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const top = heading(ctx, s, E, k, sc.title), avail = B.y + B.h - top
      const strip = (c, w, h, i, torn) => {
        scrap(c, E, w, h, { fill: i === hi ? k.hot : mix(k.news, k.gray, 0.28), seed: 60 + i, torn, tex: i === hi ? 'dots' : 'news', texColor: i === hi ? 'rgba(255,255,255,0.3)' : 'rgba(40,30,20,0.16)', rough: 5 })
      }
      const tag = (c, f, i) => slip(c, E, f, { fill: i === hi ? k.ink : k.white, color: i === hi ? k.white : k.ink, role: 'num', wt: 900, seed: 70 + i, torn: '', padX: 0.35, padY: 0.25, rough: 3 })
      const grow = i => E.ease.out(E.clamp(at(s, i + 1) / 0.45))
      let ring = null
      if (!por) {
        const slot = B.w / n, bw = Math.min(slot * 0.58, 200 * u)
        const lfs = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 700, size: 36 * u, maxW: slot * 0.88, maxLines: 2, lineGap: 1.2 })
        const vfs = fitAll(E, vals.map(v => formatNumber(v, dec) + unit), { role: 'num', weight: 900, size: 44 * u, maxW: slot * 0.8, maxLines: 1 })
        const labH = Math.max(...lfs.map(f => f.lines.length * f.lineH)) + 36 * u, vh = slipSize(vfs[0], 0.35, 0.25).h
        const base = B.y + B.h - labH, hMax = base - (top + vh + 26 * u)
        sc.items.forEach((it, i) => {
          if (at(s, i + 1) < 0) return
          const q = grow(i), h = Math.max(hMax * vals[i] / max, 26 * u), x = B.x + slot * i + slot / 2
          ctx.save(); ctx.beginPath(); ctx.rect(x - bw, 0, bw * 2, base + 8 * u); ctx.clip()
          ctx.translate(x, base - h / 2 + (1 - q) * (h + 30 * u)); ctx.rotate(i % 2 ? 0.01 : -0.012)
          strip(ctx, bw, h, i, 't'); tape(ctx, E, 0, -h / 2 + 8 * u, bw * 0.86, 34 * u, i % 2 ? 0.08 : -0.06, { seed: 64 + i })
          ctx.restore()
          const ty = base - h - vh / 2 - 12 * u
          put(ctx, E, at(s, i + 1, 0.32), { x, y: ty, rot: i % 2 ? -0.04 : 0.03, seed: 75 + i }, c => tag(c, vfs[i], i))
          if (i === hi) ring = [x, ty, slipSize(vfs[i], 0.35, 0.25).w, vh, at(s, i + 1, 0.55)]
        })
        put(ctx, E, at(s, 0, -0.1), { x: B.x + B.w / 2, y: base + labH / 2 - 2 * u, rot: -0.004, seed: 80, still: true }, c => scrap(c, E, B.w + 60 * u, labH + 8 * u, { fill: k.white, seed: 81, torn: 'tb', rough: 6 }))
        sc.items.forEach((it, i) => {
          const f = lfs[i]; ctx.save(); ctx.globalAlpha = E.clamp(at(s, i + 1) * 4)
          ctx.font = E.font('body', 700, f.size); ctx.fillStyle = i === hi ? k.pen : k.ink
          drawLines(ctx, f.lines, B.x + slot * i + slot / 2, base + (labH - f.lines.length * f.lineH) / 2, f.lineH, 'center'); ctx.restore()
        })
      } else {
        const rowH = Math.min(avail / n, 250 * u), y0 = top + (avail - rowH * n) / 2, gx = B.x + 24 * u, x0 = gx + 22 * u
        const lfs = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 700, size: 36 * u, maxW: B.w - 120 * u, maxLines: 1 })
        const vfs = fitAll(E, vals.map(v => formatNumber(v, dec) + unit), { role: 'num', weight: 900, size: 42 * u, maxW: 220 * u, maxLines: 1 })
        const vw = Math.max(...vfs.map(f => slipSize(f, 0.35, 0.25).w)), wMax = B.x + B.w - x0 - vw - 30 * u, bh = rowH * 0.36
        sc.items.forEach((it, i) => {
          const y = y0 + rowH * i, d = at(s, i + 1)
          if (d < 0) return
          const q = grow(i), L = Math.max(wMax * vals[i] / max, 26 * u), by = y + rowH * 0.64
          put(ctx, E, d, { x: x0 + 14 * u + slipSize(lfs[i], 0.4, 0.3).w / 2, y: y + rowH * 0.24, rot: i % 2 ? 0.012 : -0.012, seed: 85 + i }, c => slip(c, E, lfs[i], { fill: k.cream, color: i === hi ? k.pen : k.ink, seed: 86 + i, torn: 'lr', padX: 0.4, padY: 0.3 }))
          ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4 * u, by - bh, B.w * 2, bh * 2); ctx.clip()
          ctx.translate(x0 + L / 2 - (1 - q) * (L + 30 * u), by); ctx.rotate(i % 2 ? 0.008 : -0.008)
          strip(ctx, L, bh, i, 'r'); tape(ctx, E, L / 2 - 10 * u, 0, bh * 0.95, 30 * u, Math.PI / 2 + 0.08, { seed: 64 + i })
          ctx.restore()
          const tx = x0 + L + 24 * u + vw / 2
          put(ctx, E, at(s, i + 1, 0.32), { x: tx, y: by, rot: i % 2 ? -0.04 : 0.03, seed: 75 + i }, c => tag(c, vfs[i], i))
          if (i === hi) ring = [tx, by, vw, slipSize(vfs[i], 0.35, 0.25).h, at(s, i + 1, 0.55)]
        })
        put(ctx, E, at(s, 0, -0.1), { x: gx, y: y0 + rowH * n / 2, rot: 0.004, seed: 80, still: true }, c => scrap(c, E, 44 * u, rowH * n + 40 * u, { fill: k.white, seed: 81, torn: 'lr', rough: 5 }))
      }
      if (ring) penEllipse(ctx, E, ring[0], ring[1], ring[2] / 2 + 22 * u, ring[3] / 2 + 16 * u, E.k(ring[4], 0, 0.45, E.ease.inOut), { color: k.pen, w: 6, seed: 12 })
    },

    // 流程：一张一张纸卡错落贴成一串，卡和卡之间用胶带连起来，缝里红笔画箭头；编号是卡角上的小纸块
    steps(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, n = sc.items.length, por = E.portrait
      const top = heading(ctx, s, E, k, sc.title), avail = B.y + B.h - top, P = PAPERS(k), bs = E.pick(78, 72) * u
      let C, opts
      if (!por) {
        const gap = 72 * u, cw = (B.w - gap * (n - 1)) / n, ch = Math.min(avail * 0.8, 420 * u), zig = Math.max(0, Math.min(26 * u, (avail - ch) / 2 - 8 * u))
        C = sc.items.map((_, i) => ({ x: B.x + cw / 2 + i * (cw + gap), y: top + avail / 2 + (i % 2 ? zig : -zig), w: cw, h: ch }))
        opts = { role: 'body', weight: 800, size: 56 * u, maxW: cw - 64 * u, maxLines: 4, maxH: ch - bs - 80 * u, lineGap: 1.24 }
      } else {
        const gap = 46 * u, ch = Math.min((avail - gap * (n - 1)) / n, 250 * u), cw = B.w - 50 * u, y0 = top + (avail - ch * n - gap * (n - 1)) / 2
        C = sc.items.map((_, i) => ({ x: B.x + B.w / 2 + (i % 2 ? 22 : -22) * u, y: y0 + ch / 2 + i * (ch + gap), w: cw, h: ch }))
        opts = { role: 'body', weight: 800, size: 52 * u, maxW: cw - bs - 110 * u, maxLines: 3, maxH: ch * 0.8, lineGap: 1.24 }
      }
      const fs = fitAll(E, sc.items, opts)
      C.forEach((c0, i) => {
        const f = fs[i], pp = P[(i + 2) % P.length], d = at(s, i + 1)
        put(ctx, E, d, { x: c0.x, y: c0.y, rot: i % 2 ? 0.018 : -0.016, seed: 100 + i }, c => {
          scrap(c, E, c0.w, c0.h, { fill: pp.fill, seed: 101 + i * 5, tex: pp.tex, texColor: pp.texColor, rough: 6 })
          c.font = E.font('body', 800, f.size); c.fillStyle = k.ink
          if (!por) drawLines(c, f.lines, 0, bs * 0.3 - f.lines.length * f.lineH / 2, f.lineH, 'center')
          else drawLines(c, f.lines, -c0.w / 2 + bs + 70 * u, -f.lines.length * f.lineH / 2, f.lineH, 'left')
          c.save(); c.translate(-c0.w / 2 + (por ? bs * 0.75 : 36 * u), por ? 0 : -c0.h / 2 + 30 * u); c.rotate(i % 2 ? 0.1 : -0.12); badge(c, E, k, String(i + 1), bs, i); c.restore()
        })
        if (i === 0) return
        const a = C[i - 1], q = E.k(d, 0.15, 0.35, E.ease.out)
        if (!por) {
          const x1 = a.x + a.w / 2, x2 = c0.x - c0.w / 2, ym = (a.y + c0.y) / 2
          penArrow(ctx, E, x1 + 10 * u, ym, x2 - 10 * u, ym, q, { color: k.pen, w: 6, bend: 0.25, head: 18, seed: 20 + i })
          put(ctx, E, d - 0.1, { x: (x1 + x2) / 2, y: Math.max(a.y + a.h / 2, c0.y + c0.h / 2) - 30 * u, rot: i % 2 ? -0.18 : 0.16, seed: 110 + i, still: true }, c => tape(c, E, 0, 0, x2 - x1 + 110 * u, 36 * u, 0, { seed: 111 + i, color: i % 2 ? PINK_TAPE : undefined }))
        } else {
          const y1 = a.y + a.h / 2, y2 = c0.y - c0.h / 2, xm = B.x + B.w / 2
          penArrow(ctx, E, xm, y1 + 6 * u, xm, y2 - 6 * u, q, { color: k.pen, w: 6, bend: 0.3, head: 16, seed: 20 + i })
          put(ctx, E, d - 0.1, { x: B.x + B.w - 70 * u, y: (y1 + y2) / 2, rot: Math.PI / 2 + (i % 2 ? 0.16 : -0.16), seed: 110 + i, still: true }, c => tape(c, E, 0, 0, y2 - y1 + 100 * u, 36 * u, 0, { seed: 111 + i, color: i % 2 ? PINK_TAPE : undefined }))
        }
      })
    },

    // 对比：两张不同颜色的撕纸从两边滑进来；右边是强调色网点纸，条目打红笔勾；中间拍一张 VS 爆炸星
    compare(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, por = E.portrait
      const top = heading(ctx, s, E, k, sc.title), avail = B.y + B.h - top, gap = E.pick(84, 76) * u, pad = E.pick(46, 40) * u
      const half = por ? (avail - gap) / 2 : (B.w - gap) / 2
      const boxes = por ? [[B.x + B.w / 2, top + half / 2, B.w, half], [B.x + B.w / 2, top + half * 1.5 + gap, B.w, half]] : [[B.x + half / 2, top + avail / 2, half, avail], [B.x + B.w - half / 2, top + avail / 2, half, avail]]
      const fills = [mix(k.sky, '#ffffff', 0.35), mix(k.hot, '#ffffff', 0.18)], sides = [sc.left, sc.right]
      const pals = [ransomPal(k), [k.ink, k.white, k.mustard, k.blue, k.lime, k.cream, k.alt]]
      const G = sides.map((side, i) => {
        const [, , w, h] = boxes[i], R = ransomFit(E, side.title, { size: E.pick(54, 48) * u, maxW: w - pad * 2, maxLines: 1 })
        const items = side.items || [], iy0 = -h / 2 + pad + R.lineH + 24 * u, rowH = Math.min((h / 2 - pad - iy0) / Math.max(1, items.length), 150 * u)
        return { R, items, iy0, rowH, o: { role: 'body', weight: 700, size: Math.min(E.pick(50, 44) * u, rowH * 0.42), maxW: w - pad * 2 - 56 * u, maxLines: 2, maxH: rowH * 0.92, lineGap: 1.22 } }
      })
      const all = G.flatMap(g => g.items), size = all.length ? Math.min(...G.flatMap(g => g.items.map(t => E.fit(t, g.o).size))) : 0
      sides.forEach((side, i) => {
        const [cx, cy, w, h] = boxes[i], g = G[i], d = at(s, i + 1), tc = isLight(fills[i]) ? k.ink : k.white
        put(ctx, E, d, { x: cx, y: cy, rot: i ? 0.012 : -0.014, seed: 120 + i, kind: 'slide', dir: por ? (i ? 1 : -1) : i ? 1 : -1 }, c => {
          scrap(c, E, w, h, { fill: fills[i], seed: 121 + i * 5, tex: i ? 'dots' : 'grid', texColor: i ? 'rgba(255,255,255,0.3)' : undefined, rough: 8 })
          tape(c, E, -w / 2 + 40 * u, -h / 2 + 10 * u, 140 * u, 40 * u, -0.7, { seed: 123 + i })
          tape(c, E, w / 2 - 40 * u, -h / 2 + 10 * u, 140 * u, 40 * u, 0.7, { seed: 125 + i, color: i ? undefined : PINK_TAPE })
          ransomLines(c, E, g.R, -w / 2 + pad, -h / 2 + pad, { align: 'left', dt: d - 0.2, step: 0.04, seed: 130 + i * 9, palette: pals[i] })
          g.items.forEach((t, q) => {
            const f = E.fit(t, { ...g.o, size }), y = g.iy0 + g.rowH * q + g.rowH / 2, mx = -w / 2 + pad + 18 * u, pq = E.k(d, 0.45 + q * 0.12, 0.25, E.ease.out)
            if (i) penCheck(c, E, mx, y, 30 * u, pq, { color: k.pen, w: 6, seed: 140 + q })
            else pen(c, E, [[mx - 14 * u, y], [mx + 14 * u, y - 2 * u]], pq, { color: k.ink, w: 6, seed: 140 + q })
            c.font = E.font('body', 700, f.size); c.fillStyle = tc
            drawLines(c, f.lines, mx + 38 * u, y - f.lines.length * f.lineH / 2, f.lineH, 'left')
          })
        })
      })
      const vx = B.x + B.w / 2, vy = por ? top + half + gap / 2 : top + avail / 2
      put(ctx, E, at(s, 2, 0.2), { x: vx, y: vy, rot: -0.12, seed: 150 }, c => {
        burst(c, E, E.pick(92, 76) * u, { fill: k.mustard, seed: 5, dots: 'rgba(181,98,47,0.3)' })
        c.font = E.font('title', 900, E.pick(68, 56) * u); c.fillStyle = k.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VS', 0, 3 * u)
      })
    },

    // 引语：一张贴上去的便签，字一个一个手写出来；左上角拍一块剪下来的大引号，出处是订书钉钉住的一条白纸条
    quote(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W
      const f = E.fit(sc.text, { role: 'body', weight: 700, size: E.pick(78, 74) * u, maxW: B.w * E.pick(0.64, 0.76), maxLines: E.pick(4, 6), lineGap: 1.5 })
      const bf = sc.by && E.fit('— ' + sc.by, { role: 'body', weight: 700, size: E.pick(38, 34) * u, maxW: B.w * 0.6, maxLines: 1 }), bs = bf && slipSize(bf, 0.7, 0.4)
      const pad = E.pick(86, 70) * u, nw = Math.max(f.width / 0.94 + pad * 2, B.w * E.pick(0.46, 0.66)), nh = f.lines.length * f.lineH + pad * 2 + 10 * u
      const ncy = B.y + (B.h - nh - (bs ? bs.h * 0.7 : 0)) / 2 + nh / 2, d = at(s, 0)
      put(ctx, E, d, { x: W / 2, y: ncy, rot: -0.02, seed: 160 }, c => {
        scrap(c, E, nw, nh, { fill: k.note, seed: 161, torn: '', rough: 3 })
        const g = c.createLinearGradient(nw * 0.2, nh * 0.2, nw / 2, nh / 2); g.addColorStop(0, 'rgba(120,80,10,0)'); g.addColorStop(1, 'rgba(120,80,10,0.16)')
        c.fillStyle = g; c.fillRect(-nw / 2, -nh / 2, nw, nh)
        staple(c, E, -nw * 0.18, -nh / 2 + 26 * u, 0.06); staple(c, E, nw * 0.22, -nh / 2 + 24 * u, -0.05)
        const N = f.lines.reduce((a, l) => a + [...l].length, 0), vis = N * E.clamp((d - 0.25) / Math.min(1.4, 0.06 * N + 0.3))
        let before = 0
        f.lines.forEach((ln, q) => {
          const L = [...ln].length
          hand(c, E, ln, 0, -f.lines.length * f.lineH / 2 + q * f.lineH + f.lineH / 2 + 8 * u, f.size, { color: k.ink, p: E.clamp((vis - before) / L), wt: 700, seed: 170 + q })
          before += L
        })
      })
      const qs = E.pick(120, 104) * u
      put(ctx, E, d - 0.12, { x: W / 2 - nw / 2 + qs * 0.2, y: ncy - nh / 2 + qs * 0.25, rot: -0.14, seed: 163 }, c => {
        scrap(c, E, qs * 0.86, qs, { fill: k.ink, seed: 164, rough: 4 })
        // 中文字体里的引号偏在字框右上角：按字形的实际外框摆到纸块正中
        c.font = E.font('title', 900, qs * 1.5); c.fillStyle = k.hot; c.textAlign = 'left'; c.textBaseline = 'alphabetic'
        const m = c.measureText('“'); c.fillText('“', (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2)
      })
      if (bf) put(ctx, E, at(s, 1), { x: W / 2 + nw / 2 - bs.w / 2 - 20 * u, y: ncy + nh / 2 + bs.h * 0.15, rot: 0.03, seed: 165 }, c => {
        slip(c, E, bf, { fill: k.white, color: k.ink, seed: 166, torn: 'lr', padX: 0.7, padY: 0.4 }); tape(c, E, bs.w / 2 - 6 * u, -bs.h * 0.3, 90 * u, 30 * u, 0.9, { seed: 167, color: PINK_TAPE })
      })
    },

    // 片尾：标题剪字贴在一条黑纸上，副标题红笔手写；cta 是一张剪下来的优惠券（虚线框加剪刀）
    end(ctx, s, E) {
      const k = pal(this.c), u = E.u, B = E.L.box, sc = s.scene, W = E.W
      let i = 0
      const it = i++, is = sc.subtitle ? i++ : -1, ic = sc.cta ? i++ : -1
      const R = ransomFit(E, sc.title, { size: E.pick(132, 100) * u, maxW: B.w * E.pick(0.82, 0.86), maxLines: E.pick(2, 3) })
      const RO = { seed: 8, step: 0.07, palette: [k.cream, k.pen, k.mustard, k.white, k.alt, k.news, k.hot, k.blue, k.lime, k.kraft] }, rb = ransomLines(ctx, E, R, W / 2, 0, { ...RO, dry: true })
      const sf = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 700, size: E.pick(60, 48) * u, maxW: B.w * 0.8, maxLines: 2, lineGap: 1.3 })
      const cf = sc.cta && E.fit(sc.cta, { role: 'body', weight: 900, size: E.pick(58, 48) * u, maxW: B.w * 0.6, maxLines: 1 })
      const bw = Math.min(rb.w + 150 * u, E.W - 40 * u), bh = rb.h + 76 * u, cw = cf ? cf.width + 200 * u : 0, chh = cf ? cf.lineH + 90 * u : 0
      const hS = sf ? sf.lines.length * sf.lineH + 44 * u : 0, hC = cf ? chh + 56 * u : 0, y0 = B.y + (B.h - bh - hS - hC) / 2
      const land = at(s, it) - (rb.n - 1) * RO.step - 0.2, j = shake(E, [[land, 8, 0.3]])
      ctx.save(); ctx.translate(j.x, j.y)
      put(ctx, E, at(s, it, -0.25), { x: W / 2, y: y0 + bh / 2, rot: -0.012, seed: 180 }, c => {
        scrap(c, E, bw, bh, { fill: k.ink, seed: 181, torn: 'lr', rough: 8, tex: 'dots', texColor: 'rgba(255,245,225,0.06)' })
        tape(c, E, -bw / 2 + 10 * u, 0, 130 * u, 40 * u, 1.3, { seed: 182 }); tape(c, E, bw / 2 - 10 * u, 0, 130 * u, 40 * u, -1.3, { seed: 183, color: PINK_TAPE })
      })
      ransomLines(ctx, E, R, W / 2, y0 + bh / 2 - rb.h / 2, { ...RO, dt: at(s, it) })
      let y = y0 + bh
      if (sf) {
        const ds = at(s, is), N = sf.lines.reduce((a, l) => a + [...l].length, 0), vis = N * E.clamp(ds / 0.6)
        let before = 0
        sf.lines.forEach((ln, q) => { const L = [...ln].length; hand(ctx, E, ln, W / 2, y + 44 * u + q * sf.lineH + sf.lineH / 2, sf.size, { color: k.pen, p: E.clamp((vis - before) / L), wt: 700, rot: -0.015, seed: 190 + q }); before += L })
        y += hS
      }
      if (cf) put(ctx, E, at(s, ic), { x: W / 2, y: y + 56 * u + chh / 2, rot: 0.02, seed: 200 }, c => {
        scrap(c, E, cw, chh, { fill: k.cream, seed: 201, torn: '', rough: 3 })
        const m = 14 * u
        c.save(); c.strokeStyle = E.rgba(k.ink, 0.7); c.lineWidth = 3 * u; c.setLineDash([14 * u, 10 * u]); c.strokeRect(-cw / 2 + m, -chh / 2 + m, cw - 2 * m, chh - 2 * m); c.restore()
        c.save(); c.translate(-cw / 2 + 64 * u, -chh / 2 + m); scissors(c, E, 22 * u, k.ink); c.restore()
        c.font = E.font('body', 900, cf.size); c.fillStyle = k.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(cf.lines[0], 0, 2 * u)
        tape(c, E, cw / 2 - 16 * u, -chh / 2 + 6 * u, 110 * u, 36 * u, 0.7, { seed: 202, color: PINK_TAPE })
      })
      ctx.restore()
    },
  },

  caption(ctx, s, E) { caption(ctx, s, E) },
  transitionDur: 0.3,
  transition(ctx, A, B, p, E, info) { tornSweep(ctx, A, B, p, E, info) },

  // 默认版式会调用的零件（九种版式都重画了，只有自己写的 custom 场借用时才用到）：撕纸卡片、纸条柱子、编号纸块、红笔下划线
  card(ctx, E, x, y, w, h, o = {}) { const k = pal(this.c); ctx.save(); ctx.translate(x + w / 2, y + h / 2); scrap(ctx, E, w, h, { fill: o.tone === 'accent' ? k.hot : k.white, seed: (o.seed ?? 1) * 17, rough: 6 }); ctx.restore() },
  bar(ctx, E, x, y, w, h, o = {}) {
    if (Math.abs(w) < 1 || Math.abs(h) < 1) return
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); scrap(ctx, E, Math.abs(w), Math.abs(h), { fill: o.color ?? this.c.accent, seed: (o.seed ?? 1) * 13, torn: 't', rough: 4 }); ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.translate(x, y); badge(ctx, E, pal(this.c), o.badge ? String(i + 1) : '', r * 2, i); ctx.restore() },
  underline(ctx, E, x, y, w, p) { pen(ctx, E, [[x, y + 4 * E.u], [x + w, y]], p, { color: this.c.line, w: 6, seed: 4 }) },

  music: { style: 'bright', prog: ['D', 'Bm', 'G', 'A'], lead: 'marimba', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'thud' },
  // 几个画面动作上的音效：片头标题贴完一记闷响，数字被红笔圈起来时沙沙一下，VS 贴纸拍上，优惠券贴好时叮一声
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const c = S.cues, sc = S.scene
      if (S.layout === 'title') out.push({ t: S.t0 + c[sc.kicker ? 1 : 0] + 0.07 * [...sc.title].length + 0.1, kind: 'thud', gain: 0.45 })
      if (S.layout === 'number') out.push({ t: S.t0 + c[0] + 0.09 * [...String(sc.value)].length + 0.25, kind: 'type', gain: 0.35 })
      if (S.layout === 'compare') out.push({ t: S.t0 + c[2] + 0.2, kind: 'pop', gain: 0.4 })
      if (S.layout === 'end' && sc.cta) out.push({ t: S.t0 + c[c.length - 1] + 0.2, kind: 'chime', gain: 0.3 })
    }
    return out
  },
}
