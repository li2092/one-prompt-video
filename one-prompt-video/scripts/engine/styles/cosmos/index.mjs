// 风格包：宇宙星图（cosmos）。深空、星云和三层视差星点做底，每种版式是一幅星图：
// title 是三道轨道环绕的恒星旁的片名，statement 是两组星座之间的一句话，bullets 是一道轨道弧上依次点亮的行星，
// number 是日食时日冕围着的大数字，bars 是从地平线升起的光柱，steps 是一条航线串起的几站，
// compare 是一对双星，quote 是一颗带环行星旁的题记，end 是一个旋涡星系下的收束句。
// 字幕是无底框的白字加三星连线标记，最上层是角标和一条轨道进度线，转场是光圈跃迁。
// 星场、星云、星体、轨道、环、星图网格、彗星、引线、星系的画法移植自风格库的 Y-宇宙星图（见 lib/ 和 NOTES.md）。
import { captionChunks, rolling } from '../../layouts.mjs'
import { clamp, lerp, ease, formatNumber, decimalsOf, textUnits } from '../../core.mjs'
import { TAU, pal, space, cam, glow, mulberry } from './lib/space.mjs'
import { star, moon, planet, orbit, orbPt, chart, shock, comet, leader, armillary, galaxy, galaxySprite, corona, constellation, glint } from './lib/bodies.mjs'
import { words, fitSame, head, outFade } from './lib/text.mjs'

const { PI, sin, cos } = Math
const two = i => String(i + 1).padStart(2, '0')

// 不属于 E.fit 排的短字（编号、数值）：深色柔影，转场时随上一场淡出
function tag(ctx, E, s, str, x, y, o = {}) {
  const a = (o.alpha ?? 1) * outFade(s)
  if (a <= 0) return
  ctx.save(); ctx.globalAlpha *= a; ctx.font = E.font(o.role || 'mono', o.weight || 500, o.size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = o.glow ? E.rgba(o.glow, 0.6) : 'rgba(1,2,8,0.9)'; ctx.shadowBlur = o.size * 0.3; ctx.fillStyle = o.color || pal(E).text
  ctx.fillText(str, x, y); ctx.restore()
}
// 星座的两种形状（在一个 0..1 的方框里的相对位置和连线）；不是真实的星座
const FIGS = [
  { pts: [[0.02, 0.66], [0.2, 0.42], [0.38, 0.55], [0.56, 0.3], [0.78, 0.16], [0.97, 0.4], [0.74, 0.7]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { pts: [[0.04, 0.3], [0.28, 0.56], [0.5, 0.36], [0.68, 0.74], [0.96, 0.52], [0.46, 0.94]], edges: [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5]] },
]
// 一段二次曲线航线，取 0..q 的一截折线
function arcPts(A, B, q, bend) {
  const c = [(A[0] + B[0]) / 2 + bend[0], (A[1] + B[1]) / 2 + bend[1]], out = []
  for (let j = 0; j <= 28; j++) { const v = j / 28 * q, w = 1 - v; out.push([w * w * A[0] + 2 * w * v * c[0] + v * v * B[0], w * w * A[1] + 2 * w * v * c[1] + v * v * B[1]]) }
  return out
}
function route(ctx, E, pts, col) {
  if (pts.length < 2) return
  const u = E.u
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = col
  for (const [lw, al, dash] of [[8, 0.12, []], [2.4, 0.85, [9 * u, 9 * u]]]) {
    ctx.globalAlpha = al; ctx.lineWidth = lw * u; ctx.setLineDash(dash)
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
  }
  ctx.restore()
}
// 光柱：从基线升起，底部最亮、往上渐淡，三层宽窄叠出柔边；horiz 时横着长
function beam(ctx, E, x, y, len, bw, col, horiz) {
  if (len <= 0.5) return
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (const [m, al] of [[2.6, 0.08], [1.3, 0.2], [0.55, 0.6], [0.14, 0.9]]) {
    const w = bw * m, g = horiz ? ctx.createLinearGradient(x, 0, x + len, 0) : ctx.createLinearGradient(0, y, 0, y - len)
    const c = m < 0.2 ? '#ffffff' : col
    g.addColorStop(0, E.rgba(c, al)); g.addColorStop(1, E.rgba(c, al * 0.3))
    ctx.fillStyle = g
    if (horiz) ctx.fillRect(x, y - w / 2, len, w); else ctx.fillRect(x - w / 2, y - len, w, len)
  }
  ctx.restore()
}
// 新点亮的那一颗：外面套一圈小轨道，一颗小卫星绕着走
function marker(ctx, E, x, y, r, t, col) {
  const u = E.u
  orbit(ctx, x, y, r * 1.9, r * 0.7, -0.4, 1, { color: col, lw: 1.5 * u, alpha: 0.8 })
  const [mx, my] = orbPt(x, y, r * 1.9, r * 0.7, -0.4, t * 2.2)
  moon(ctx, E, mx, my, 3.5 * u, col)
}
// 跃迁放射线（种子固定）
const STREAKS = (() => { const r = mulberry(99); return Array.from({ length: 90 }, () => ({ a: r() * TAU, d: 0.15 + r() * 0.85, w: 0.6 + r() * 1.8, c: r() < 0.3 ? 'cyan' : r() < 0.5 ? 'gold' : 'white' })) })()

export default {
  name: '宇宙星图', mood: '深空、星云、发光的星体和轨道，讲全局、讲层次、系列开篇和预告', bpm: 88,
  c: { bg: '#070b1f', fg: '#eef2ff', muted: '#aab6d4', accent: '#ffcf6e', accent2: '#5fdcff', card: '#0d1530', line: '#5e6b8c', onAccent: '#1b1405' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 700, wBody: 500, radius: 16,
  motion: 'rise', solidAccent: false, markHollow: true,
  music: { style: 'ambient', prog: ['Dm9', 'Fmaj9', 'Cadd9', 'G'], lead: 'epiano', drums: false },
  sfx: { enter: 'tick', cut: 'whoosh', accent: 'chime' },
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      if (S.layout === 'title') out.push({ t: S.t0 + 0.1, kind: 'swell', gain: 0.35 })
      if (S.layout === 'steps') out.push({ t: S.t0 + S.cues[S.cues.length - 1] + 0.4, kind: 'chime', gain: 0.25 })
      if (S.layout === 'end') out.push({ t: S.t0 + S.cues[0] + 0.15, kind: 'swell', gain: 0.3 })
    }
    return out
  },

  bg(ctx, E, s) { space(ctx, E, cam(s), s.index) },

  layouts: {
    // 一颗恒星，三道倾斜的轨道环从它后面绕到前面；片名在它旁边（竖屏在它下面），一根引线把两者连起来
    title(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, W = E.W
      let i = 0
      const pk = sc.kicker ? s.p(i++) : 0, ti = i, pt = s.p(i++), ps = sc.subtitle ? s.p(i++) : 0
      const R = P ? Math.min(a.w * 0.36, 300 * u) : Math.min(a.h * 0.34, 270 * u)
      const sx = P ? W / 2 : a.x + R * 1.12, sy = P ? a.y + R * 0.95 : a.y + a.h * 0.5
      const grow = ease.out(clamp(t / 0.9)), spin = t * 0.45, ring = clamp((t - 0.1) / 1.6)
      chart(ctx, E, sx, sy, R * 1.25, -t * 0.02, 0.8 * clamp(t / 1.2))
      armillary(ctx, E, sx, sy, R, 'back', { p: ring, spin })
      star(ctx, E, sx, sy, E.pick(38, 34) * u * (0.5 + 0.5 * grow), { t, alpha: grow })
      armillary(ctx, E, sx, sy, R, 'front', { p: ring, spin })
      shock(ctx, E, sx, sy, t, s.cue(ti), R * 1.7, k.gold, 1.3)
      const tw = P ? a.w : a.x + a.w - (sx + R * 1.12 + 70 * u), tx = P ? W / 2 : a.x + a.w - tw, al = P ? 'center' : 'left'
      const big = E.fit(sc.title, { role: 'title', weight: 800, size: E.pick(124, 112) * u, maxW: tw, maxLines: 3, lineGap: 1.16, oneLine: true })
      const kick = sc.kicker && E.fit(sc.kicker, { role: 'body', weight: 500, size: E.pick(38, 36) * u, maxW: tw, maxLines: 1 })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 400, size: E.pick(46, 44) * u, maxW: tw, maxLines: 2, lineGap: 1.32 })
      const hk = kick ? kick.lineH + 18 * u : 0, hb = big.lines.length * big.lineH, hs = sub ? sub.lines.length * sub.lineH + 28 * u : 0, hAll = hk + hb + hs
      const yA = P ? sy + R * 0.75 + 40 * u : a.y
      let y = P ? yA + (a.y + a.h - yA - hAll) * 0.42 : sy - hAll / 2
      if (P) leader(ctx, E, [[sx, sy + R * 0.66], [sx, y - 26 * u]], ease.out(pt), k.faint, 0.9)
      else leader(ctx, E, [[sx + R * 1.18, sy], [tx - 30 * u, sy]], ease.out(pt), k.faint, 0.9)
      if (kick) { words(ctx, E, s, kick, tx, y, al, { p: pk, color: k.cyan, weight: 500 }); y += hk }
      words(ctx, E, s, big, tx, y, al, { p: pt, role: 'title', weight: 800, glow: k.gold })
      if (sub) words(ctx, E, s, sub, tx, y + hb + 28 * u, al, { p: ps, color: k.dim, weight: 400 })
    },

    // 一句话浮在两组星座之间：一组在左上（竖屏右上），一组在右下（竖屏左下），先后连出来；高亮词金色发光，一颗彗星划过
    statement(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, p = s.p(0), W = E.W
      const f = E.fit(sc.text, { role: 'title', weight: 700, size: E.pick(104, 92) * u, maxW: a.w * E.pick(0.84, 1), maxLines: E.pick(3, 5), lineGap: 1.32 })
      const h = f.lines.length * f.lineH, y0 = a.y + (a.h - h) / 2, gap = 44 * u
      // 句子上方一条带、下方一条带里各放一组；带太窄时贴着句子往外放
      const band = (yA, yB, left, upper) => {
        const w = a.w * (P ? 0.62 : 0.44), hh = Math.min(Math.max(yB - yA, 100 * u), w * 0.42)
        return { x: left ? a.x : a.x + a.w - w, y: yB - yA < 100 * u ? (upper ? yB - hh : yA) : yA + (yB - yA - hh) / 2, w, h: hh }
      }
      const boxes = [band(a.y, y0 - gap, !P, true), band(y0 + h + gap, a.y + a.h, P, false)]
      FIGS.forEach((F, j) => {
        const B = boxes[j], pts = F.pts.map(([px, py]) => [B.x + px * B.w, B.y + py * B.h])
        constellation(ctx, E, pts, F.edges, clamp((t - 0.1 - j * 0.4) / 1.4), t, { color: j ? k.violet : k.cyan })
      })
      const cy = y0 + h / 2
      comet(ctx, E, W * 0.92, a.y - 30 * u, W * 0.08, cy + h * 0.9, clamp((t - 0.05) / 1.3), k.cyan, { tail: 0.4, ease: ease.out })
      const hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1
      let off = 0
      const lines = f.lines.map(ln => {
        const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off); off += ln.length
        return hs < 0 || a1 <= a0 ? [[ln, k.text]] : [[ln.slice(0, a0), k.text], [ln.slice(a0, a1), k.gold, k.gold], [ln.slice(a1), k.text]].filter(g => g[0])
      })
      words(ctx, E, s, { ...f, lines }, W / 2, y0, 'center', { p, role: 'title', weight: 700 })
    },

    // 一颗恒星和它的轨道：横屏恒星在左边，轨道弧穿过画面中部；竖屏恒星在画面左外侧只露出一片暖光。
    // 弧上的行星一颗颗点亮，受光面朝着恒星，每颗旁边是一条要点，最新那颗套一圈小轨道
    bullets(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, n = sc.items.length
      const top = head(ctx, s, E, sc.title), avail = a.y + a.h - top
      const rowH = Math.min(avail / n, E.pick(170, 200) * u), y0 = top + (avail - rowH * n) / 2, cy = y0 + rowH * n / 2, dy = rowH * n / 2
      const R = P ? Math.max(dy * 2.2, 600 * u) : Math.max(dy * 1.55, 400 * u), ox = P ? a.x + 130 * u - R : a.x + 110 * u, rp = Math.min(rowH * 0.2, E.pick(26, 26) * u)
      if (P) glow(ctx, E, ox + R * 0.36, cy, R * 1.05, k.gold, 0.6)
      else { star(ctx, E, ox, cy, 40 * u * ease.out(clamp(t / 0.8)), { t, halo: 8, spike: 0.75 }); chart(ctx, E, ox, cy, R * 0.62, t * 0.02, 0.6 * clamp(t / 1), { rings: 3 }) }
      // 轨道只画在要点这一段的高度里，不碰场标题和字幕
      ctx.save(); ctx.beginPath(); ctx.rect(0, y0 - 14 * u, E.W, rowH * n + 28 * u); ctx.clip()
      const q = ease.out(clamp(t / 1.1)), half = Math.PI * 0.5
      for (const [m, al, dash] of [[P ? 0.8 : 0.74, 0.5, true], [1, 1, false]]) {
        ctx.save(); ctx.strokeStyle = dash ? k.faint : k.cyan; ctx.globalAlpha = al
        if (dash) ctx.setLineDash([6 * u, 8 * u]); else { ctx.lineWidth = 8 * u; ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.arc(ox, cy, R, -half, -half + 2 * half * q); ctx.stroke(); ctx.globalAlpha = al }
        ctx.lineWidth = (dash ? 1.5 : 2.2) * u; ctx.beginPath(); ctx.arc(ox, cy, R * m, -half, -half + 2 * half * q); ctx.stroke(); ctx.restore()
      }
      ctx.restore()
      const ys = sc.items.map((_, i) => y0 + rowH * (i + 0.5)), xs = ys.map(y => ox + Math.sqrt(Math.max(0, R * R - (y - cy) ** 2))), txs = xs.map(x => x + rp * 1.5 + 34 * u)
      const FS = fitSame(E, sc.items, i => ({ role: 'body', weight: 500, size: Math.min(E.pick(62, 56) * u, rowH * 0.42), maxW: a.x + a.w - txs[i], maxLines: 2, maxH: rowH * 0.92, lineGap: 1.24 }))
      let newest = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0) newest = i
      sc.items.forEach((_, i) => {
        const p = s.p(i + 1), x = xs[i], y = ys[i], col = i % 2 ? k.violet : k.cyan, f = FS[i]
        if (p < 1) moon(ctx, E, x, y, rp * 0.9, k.faint, { hollow: true, alpha: clamp(t / 0.6) * (1 - p) })
        if (p > 0) {
          planet(ctx, E, x, y, rp * (0.5 + 0.5 * ease.outBack(p)), { color: col, light: Math.atan2(cy - y, ox - x), alpha: clamp(p * 2) })
          shock(ctx, E, x, y, t, s.cue(i + 1), rp * 3.4, col, 0.7)
          if (i === newest) marker(ctx, E, x, y, rp, t, col)
        }
        tag(ctx, E, s, two(i), x - rp - 16 * u, y, { size: 22 * u, align: 'right', color: k.cyan, alpha: 0.4 + 0.6 * clamp(p * 2) })
        words(ctx, E, s, f, txs[i], y - f.lines.length * f.lineH / 2, 'left', { p, weight: 500 })
      })
    },

    // 日食：月面从右上滑过来挡住太阳，日冕和冕流亮起，接触的一瞬边上闪一颗钻石环；数字写在月面上滚上去，外面一圈星图刻度
    number(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, W = E.W
      let i = 1
      const p0 = s.p(0), pl = sc.label ? s.p(i++) : 0, pn = sc.note ? s.p(i++) : 0, side = !P && !!(sc.label || sc.note)
      const R = P ? Math.min(a.w * 0.36, a.h * 0.23) : Math.min(a.h * 0.36, a.w * 0.19), cx = side ? a.x + a.w * 0.3 : W / 2
      // 说明和小字：横屏在右边，引线从月面边上连过去；竖屏在下面，和圆盘合成一块上下居中
      const lx = side ? cx + R * 1.55 : W / 2, lw = side ? a.x + a.w - lx : a.w * 0.9, al = side ? 'left' : 'center'
      const lab = sc.label && E.fit(sc.label, { role: 'body', weight: 600, size: E.pick(60, 56) * u, maxW: lw, maxLines: E.pick(3, 2), lineGap: 1.25 })
      const note = sc.note && E.fit(sc.note, { role: 'body', weight: 400, size: 40 * u, maxW: lw, maxLines: 2, lineGap: 1.3 })
      const hL = lab ? lab.lines.length * lab.lineH : 0, hN = note ? note.lines.length * note.lineH + 22 * u : 0
      const cy = P ? a.y + Math.max(R * 1.25, (a.h - R * 2.42 - hL - hN) / 2 + R) : a.y + a.h * 0.5
      // 月面一开始就压住太阳的一半，避免切进来时先露一整个亮盘
      const cover = ease.inOut(p0), mx = cx + (1 - cover) * R * 1.15, my = cy - (1 - cover) * R * 0.15
      glow(ctx, E, cx, cy, R * 2.6, k.gold, 0.35)
      ctx.save(); const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.7, k.core); sg.addColorStop(1, k.gold)
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R * 0.97, 0, TAU); ctx.fill(); ctx.restore()
      corona(ctx, E, cx, cy, R, t, cover)
      chart(ctx, E, cx, cy, R * 1.34, t * 0.02, 0.7 * clamp(t / 1), { rings: 1, inner: 0.8 })
      ctx.save(); const mg = ctx.createRadialGradient(mx - R * 0.3, my - R * 0.3, 0, mx, my, R)
      mg.addColorStop(0, E.mix(k.bg0, k.cyan, 0.08)); mg.addColorStop(1, k.bg0)
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.fill()
      ctx.strokeStyle = E.rgba(k.core, 0.7 * cover); ctx.lineWidth = 2 * u; ctx.stroke(); ctx.restore()
      const ring = Math.max(0, 1 - Math.abs(t - s.cue(0) - 0.62) / 0.5)
      if (ring > 0) star(ctx, E, cx + cos(3.0) * R, cy + sin(3.0) * R, 13 * u, { t, alpha: ring, halo: 9 })
      // 数字：按最终的宽度定位，滚动时不左右跳
      const str = String(sc.value)
      ctx.font = E.font('body', 700, R * 0.29); const uw0 = sc.unit ? ctx.measureText(sc.unit).width + 16 * u : 0
      const f = E.fit(str, { role: 'num', weight: 700, size: R * 0.95, maxW: R * 1.62 - uw0, maxLines: 1, lineGap: 1, minSize: R * 0.3, quiet: true })
      const us = f.size * 0.3
      ctx.font = E.font('body', 700, us); const uw = sc.unit ? ctx.measureText(sc.unit).width + 16 * u : 0
      ctx.font = E.font('num', 700, f.size); const wNum = ctx.measureText(str).width, x0 = mx - (wNum + uw) / 2
      const shown = rolling(sc.value, clamp((t - s.cue(0)) / Math.min(1.4, s.dur * 0.35)))
      tag(ctx, E, s, shown, x0 + wNum, my + f.size * 0.03, { role: 'num', weight: 700, size: f.size, align: 'right', color: k.gold, glow: k.gold, alpha: clamp(p0 * 1.6) })
      if (sc.unit) tag(ctx, E, s, sc.unit, x0 + wNum + 16 * u, my + f.size * 0.2, { role: 'body', weight: 700, size: us, align: 'left', alpha: clamp(p0 * 1.6) })
      let ly = side ? cy - (hL + hN) / 2 : cy + R * 1.42
      if (side) leader(ctx, E, [[cx + cos(-0.3) * R * 1.05, cy + sin(-0.3) * R * 1.05], [lx - 70 * u, ly + (lab ? lab.lineH : note.lineH) / 2], [lx - 24 * u, ly + (lab ? lab.lineH : note.lineH) / 2]], ease.out(lab ? pl : pn), k.dim)
      if (lab) { words(ctx, E, s, lab, lx, ly, al, { p: pl, weight: 600 }); ly += hL }
      if (note) words(ctx, E, s, note, lx, ly + 22 * u, al, { p: pn, color: k.dim, weight: 400 })
    },

    // 地平线上升起的光柱：横屏竖着长，竖屏横着长；柱顶一颗星，最大的（或 highlight 指定的）是金色带芒的那颗；背后是星图的刻度线
    bars(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, n = sc.items.length
      const top = head(ctx, s, E, sc.title)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || '', g0 = ease.out(s.p(0))
      const grid = (x1, y1, x2, y2) => { ctx.save(); ctx.strokeStyle = E.rgba(k.faint, 0.45); ctx.lineWidth = 1 * u; ctx.setLineDash([3 * u, 9 * u]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore() }
      if (!P) {
        const labH = 100 * u, base = a.y + a.h - labH, hMax = base - (top + 90 * u), slot = a.w / n, bw = Math.min(slot * 0.2, 44 * u)
        for (let g = 1; g <= 4; g++) grid(a.x, base - hMax * g / 4, a.x + a.w * g0, base - hMax * g / 4)
        const hz = ctx.createLinearGradient(0, base, 0, base + labH)
        hz.addColorStop(0, E.rgba(k.cyan, 0.16)); hz.addColorStop(1, E.rgba(k.cyan, 0))
        ctx.fillStyle = hz; ctx.fillRect(a.x - 60 * u, base, (a.w + 120 * u) * g0, labH)
        orbit(ctx, a.x + a.w / 2, base, a.w / 2 + 60 * u, 0.5, 0, g0, { color: k.cyan, lw: 2 * u, start: PI })
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), q = ease.out(p), h = hMax * vals[i] / max * q, x = a.x + slot * (i + 0.5), col = i === hi ? k.gold : k.cyan
          if (p > 0) {
            beam(ctx, E, x, base, h, bw, col, false)
            if (i === hi) star(ctx, E, x, base - h, 14 * u, { t, color: col, halo: 6, spike: 0.6 }); else glint(ctx, E, x, base - h, 7 * u, col)
            tag(ctx, E, s, formatNumber(vals[i] * q, dec) + unit, x, base - h - 46 * u, { role: 'num', weight: 700, size: 50 * u, color: i === hi ? k.gold : k.text, alpha: clamp(p * 2) })
          }
          const lf = E.fit(it.label, { role: 'body', weight: 500, size: 38 * u, maxW: slot * 0.92, maxLines: 2, maxH: labH - 14 * u })
          words(ctx, E, s, lf, x, base + 16 * u, 'center', { p, weight: 500 })
        })
      } else {
        const valW = 190 * u, avail = a.y + a.h - top, rowH = Math.min(avail / n, 210 * u), y0 = top + (avail - rowH * n) / 2, wMax = a.w - valW - 30 * u, bw = Math.min(rowH * 0.14, 24 * u)
        for (let g = 1; g <= 4; g++) grid(a.x + wMax * g / 4, y0, a.x + wMax * g / 4, y0 + rowH * n * g0)
        orbit(ctx, a.x, y0 + rowH * n / 2, rowH * n / 2 + 30 * u, 0.5, PI / 2, g0, { color: k.cyan, lw: 2 * u, start: PI })
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), q = ease.out(p), w = wMax * vals[i] / max * q, y = y0 + rowH * i, by = y + rowH * 0.66, col = i === hi ? k.gold : k.cyan
          const lf = E.fit(it.label, { role: 'body', weight: 500, size: 40 * u, maxW: a.w, maxLines: 1 })
          words(ctx, E, s, lf, a.x + 18 * u, y + rowH * 0.36 - lf.lineH / 2, 'left', { p, weight: 500 })
          if (p <= 0) return
          beam(ctx, E, a.x, by, w, bw, col, true)
          if (i === hi) star(ctx, E, a.x + w, by, 12 * u, { t, color: col, halo: 6, spike: 0.5 }); else glint(ctx, E, a.x + w, by, 6 * u, col)
          tag(ctx, E, s, formatNumber(vals[i] * q, dec) + unit, a.x + w + 34 * u, by, { role: 'num', weight: 700, size: 46 * u, align: 'left', color: i === hi ? k.gold : k.text, alpha: clamp(p * 2) })
        })
      }
    },

    // 一条航线串起几站：虚线航迹一段段画出去，彗星头在线尖上，到站时那颗行星点亮；终点是金色的。横屏一排、字在站下；竖屏蛇形往下、字在右
    steps(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, n = sc.items.length
      const top = head(ctx, s, E, sc.title), avail = a.y + a.h - top, rS = E.pick(34, 30) * u
      let pts, start, bend, FS, tpos
      if (!P) {
        // 站和站下的字合成一块，在标题下面的区域里上下居中；中间几站拱起来一点
        const slot = a.w / n, amp = Math.min(54 * u, avail * 0.07), head0 = 30 * u + 2 * rS + amp + 46 * u
        FS = fitSame(E, sc.items, () => ({ role: 'body', weight: 500, size: 52 * u, maxW: slot * 0.86, maxLines: 3, maxH: avail - head0, lineGap: 1.28 }))
        const blockH = head0 + Math.max(...FS.map(f => f.lines.length * f.lineH)), yc = top + Math.max(0, (avail - blockH) * 0.45) + 30 * u + rS + amp
        pts = sc.items.map((_, i) => [a.x + slot * (i + 0.5), yc - amp * sin(PI * (i + 0.5) / n)])
        start = [a.x - 40 * u, pts[0][1] + 30 * u]
        bend = () => [0, -Math.min(slot * 0.22, 80 * u)]
        tpos = i => [pts[i][0], pts[i][1] + rS + 46 * u, 'center']
      } else {
        const rowH = Math.min(avail / n, 260 * u), y0 = top + (avail - rowH * n) / 2, tx = a.x + 220 * u
        pts = sc.items.map((_, i) => [a.x + 104 * u + 44 * u * sin(i * 2.2 + 0.4), y0 + rowH * (i + 0.5)])
        start = [a.x - 30 * u, y0]
        bend = i => [(i % 2 ? -1 : 1) * 70 * u, 0]
        FS = fitSame(E, sc.items, () => ({ role: 'body', weight: 500, size: 52 * u, maxW: a.x + a.w - tx, maxLines: 3, maxH: rowH * 0.9, lineGap: 1.26 }))
        tpos = i => [tx, pts[i][1] - FS[i].lines.length * FS[i].lineH / 2, 'left']
      }
      let newest = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) >= 0.55) newest = i
      sc.items.forEach((_, i) => {
        const p = s.p(i + 1), q = clamp(p / 0.55), lit = clamp((p - 0.55) / 0.45), [x, y] = pts[i], col = i === n - 1 ? k.gold : k.cyan
        const A = i ? pts[i - 1] : start, seg = q > 0 ? arcPts(A, [x, y], q, bend(i)) : []
        route(ctx, E, seg, k.cyan)
        if (q > 0 && q < 1) { const [hx, hy] = seg[seg.length - 1]; glow(ctx, E, hx, hy, 24 * u, k.cyan, 1); glow(ctx, E, hx, hy, 9 * u, '#ffffff', 1) }
        if (lit <= 0) moon(ctx, E, x, y, rS * 0.9, k.faint, { hollow: true, alpha: clamp(t / 0.6) })
        else {
          planet(ctx, E, x, y, rS * (0.5 + 0.5 * ease.outBack(lit)), { color: col, light: -2.2, alpha: clamp(lit * 2) })
          shock(ctx, E, x, y, t, s.cue(i + 1) + 0.33, rS * 3.6, col, 0.8)
          if (i === newest) marker(ctx, E, x, y, rS, t, col)
        }
        if (P) tag(ctx, E, s, two(i), x - rS - 18 * u, y, { size: 22 * u, align: 'right', color: k.cyan, alpha: 0.4 + 0.6 * lit })
        else tag(ctx, E, s, two(i), x, y - rS - 30 * u, { size: 22 * u, color: k.cyan, alpha: 0.4 + 0.6 * lit })
        const [tx, ty, al] = tpos(i)
        words(ctx, E, s, FS[i], tx, ty, al, { p: clamp(p * 1.5 - 0.3), weight: 500 })
      })
    },

    // 双星：一冷一暖两颗星在同一条扁轨道的两端互相绕着，质心一个小十字；冷的那颗是左边，金色的是推荐的右边。竖屏上下排
    compare(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t
      const top = head(ctx, s, E, sc.title), avail = a.y + a.h - top, sides = [sc.left, sc.right], cool = E.mix(k.cyan, '#ffffff', 0.45)
      const wob = 0.12 * sin(t * 0.5), d0 = ease.out(clamp(t / 1.1))
      let S, cols
      if (!P) {
        const gap = 90 * u, colW = (a.w - gap) / 2, sy = top + 74 * u, cxs = [a.x + colW / 2, a.x + a.w - colW / 2], bx = (cxs[0] + cxs[1]) / 2, rx = (cxs[1] - cxs[0]) / 2, ry = rx * 0.14
        orbit(ctx, bx, sy, rx, ry, 0, d0, { color: k.faint, lw: 1.5 * u, dash: [6 * u, 8 * u], glow: false, alpha: 0.9 })
        S = [orbPt(bx, sy, rx, ry, 0, PI + wob), orbPt(bx, sy, rx, ry, 0, wob)]
        cols = cxs.map(cx => ({ x: cx - colW / 2, w: colW, cx, ty: sy + 86 * u, al: 'center' }))
        ctx.save(); ctx.globalAlpha = d0; ctx.strokeStyle = k.dim; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(bx - 12 * u, sy); ctx.lineTo(bx + 12 * u, sy); ctx.moveTo(bx, sy - 12 * u); ctx.lineTo(bx, sy + 12 * u); ctx.stroke(); ctx.restore()
      } else {
        const gap = 60 * u, bh = (avail - gap) / 2, sx = a.x + 56 * u, sys = [top + 60 * u, top + bh + gap + 60 * u], by = (sys[0] + sys[1]) / 2, ry = (sys[1] - sys[0]) / 2
        orbit(ctx, sx, by, ry, ry * 0.14, PI / 2, d0, { color: k.faint, lw: 1.5 * u, dash: [6 * u, 8 * u], glow: false, alpha: 0.9 })
        S = [orbPt(sx, by, ry, ry * 0.14, PI / 2, PI + wob), orbPt(sx, by, ry, ry * 0.14, PI / 2, wob)]
        cols = sys.map((yy, i) => ({ x: a.x + 130 * u, w: a.w - 130 * u, ty: yy, al: 'left', bottom: i ? a.y + a.h : yy - 60 * u + bh }))
      }
      const TF = fitSame(E, sides.map(sd => sd.title), i => ({ role: 'title', weight: 700, size: E.pick(60, 56) * u, maxW: cols[i].w, maxLines: 2, lineGap: 1.16 }))
      const hT = Math.max(...TF.map(f => f.lines.length * f.lineH)), iy0 = cols.map((c, i) => (P ? c.ty - TF[i].lineH / 2 : c.ty) + (P ? TF[i].lines.length * TF[i].lineH : hT) + 26 * u)
      const rowH = cols.map((c, i) => Math.min(((P ? c.bottom : a.y + a.h) - iy0[i]) / Math.max(1, (sides[i].items || []).length), 140 * u))
      const all = sides.flatMap((sd, i) => (sd.items || []).map(it => [it, i]))
      const FI = fitSame(E, all.map(x => x[0]), j => { const i = all[j][1]; return { role: 'body', weight: 500, size: Math.min(E.pick(48, 46) * u, rowH[i] * 0.44), maxW: cols[i].w - 50 * u, maxLines: 2, maxH: rowH[i] * 0.92, lineGap: 1.22 } })
      sides.forEach((side, i) => {
        const p = s.p(i + 1), strong = i === 1, C = cols[i], [x, y] = S[i], col = strong ? k.gold : cool
        if (p > 0) {
          star(ctx, E, x, y, (strong ? 36 : 26) * u * (0.6 + 0.4 * ease.outBack(p)), { t, color: col, alpha: clamp(p * 2), halo: strong ? 8 : 5, spike: 0.28, spin: i })
          shock(ctx, E, x, y, t, s.cue(i + 1), 160 * u, col, 0.8)
        }
        const tf = TF[i], tyy = P ? C.ty - tf.lineH / 2 : C.ty
        words(ctx, E, s, tf, P ? C.x : C.cx, tyy, C.al, { p, role: 'title', weight: 700, color: strong ? k.gold : k.text, glow: strong ? k.gold : null })
        const fs = FI.filter((_, j) => all[j][1] === i), bwid = Math.max(0, ...fs.map(f => f.width)) + 40 * u
        const bx0 = P ? C.x : clamp(C.cx - bwid / 2, C.x, C.x + C.w - bwid)
        fs.forEach((f, j) => {
          const yy = iy0[i] + rowH[i] * (j + 0.5), q = clamp(p * 1.4 - 0.2 - j * 0.12)
          if (strong) glint(ctx, E, bx0 + 9 * u, yy, 6 * u, k.gold, q)
          else if (q > 0) { ctx.save(); ctx.globalAlpha = q; ctx.strokeStyle = k.dim; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.arc(bx0 + 9 * u, yy, 6 * u, 0, TAU); ctx.stroke(); ctx.restore() }
          words(ctx, E, s, f, bx0 + 40 * u, yy - f.lines.length * f.lineH / 2, 'left', { p: q, weight: 500 })
        })
      })
    },

    // 题记：一颗带环的气态行星从右边（竖屏右上）升起，光从引语那边照过来；一颗小卫星绕着它走；引语左对齐，出处像星图上的注记
    quote(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t
      const p0 = s.p(0), p1 = sc.by ? s.p(1) : 0, rise = ease.out(clamp(t / 1.4))
      const Rp = P ? a.w * 0.2 : a.h * 0.3, px = P ? a.x + a.w * 0.72 : a.x + a.w * 0.85, py = (P ? a.y + Rp * 1.05 : a.y + a.h * 0.42) + (1 - rise) * 70 * u
      const th = t * 0.6 + 1, mo = orbPt(px, py, Rp * 1.5, Rp * 0.42, 0.42, th), front = sin(th) > 0
      if (!front) moon(ctx, E, mo[0], mo[1], 7 * u, k.cyan, { alpha: rise * 0.6 })
      planet(ctx, E, px, py, Rp, { color: E.mix(k.violet, k.cyan, 0.3), light: -2.5, alpha: rise, bands: true, ring: { k: 1.7, inc: 0.24, tilt: -0.3, color: E.mix(k.gold, k.dim, 0.45) } })
      if (front) moon(ctx, E, mo[0], mo[1], 9 * u, k.cyan, { alpha: rise })
      const gut = E.pick(96, 84) * u, tx = a.x + gut, tw = P ? a.w - gut : a.w * 0.55 - gut
      const f = E.fit(sc.text, { role: 'title', weight: 600, size: E.pick(80, 70) * u, maxW: tw, maxLines: E.pick(5, 7), lineGap: 1.42 })
      const by = sc.by && E.fit(sc.by, { role: 'body', weight: 400, size: 38 * u, maxW: tw - 80 * u, maxLines: 1 })
      const hT = f.lines.length * f.lineH, hB = by ? by.lineH + 44 * u : 0, yA = P ? py + Rp * 1.2 + 40 * u : a.y
      const y0 = yA + (a.y + a.h - yA - hT - hB) / 2
      tag(ctx, E, s, '“', a.x + gut * 0.42, y0 + E.pick(70, 62) * u, { role: 'title', weight: 800, size: E.pick(190, 170) * u, color: k.gold, glow: k.gold, alpha: 0.9 * ease.out(p0) })
      words(ctx, E, s, f, tx, y0, 'left', { p: p0, role: 'title', weight: 600 })
      if (by) {
        const yy = y0 + hT + 44 * u + by.lineH / 2, q = ease.out(p1)
        glint(ctx, E, tx + 8 * u, yy, 6 * u, k.gold, q)
        ctx.save(); ctx.globalAlpha = q * outFade(s); ctx.strokeStyle = k.dim; ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(tx + 24 * u, yy); ctx.lineTo(tx + 24 * u + 40 * u * q, yy); ctx.stroke(); ctx.restore()
        words(ctx, E, s, by, tx + 80 * u, yy - by.lineH / 2, 'left', { p: p1, color: k.dim, weight: 400 })
      }
    },

    // 收尾：镜头拉远，一个旋涡星系在上半幅慢慢转，偶尔一颗流星划过；收束句和副标题在下面，按钮的字被一圈小轨道围着，一颗卫星绕它走
    end(ctx, s, E) {
      const k = pal(E), u = E.u, a = E.L.box, sc = s.scene, P = E.portrait, t = s.t, W = E.W
      let i = 0
      const pt = s.p(i++), ps = sc.subtitle ? s.p(i++) : 0, pc = sc.cta ? s.p(i++) : 0
      const big = E.fit(sc.title, { role: 'title', weight: 800, size: E.pick(108, 100) * u, maxW: a.w * 0.9, maxLines: 3, lineGap: 1.18, oneLine: true })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 400, size: E.pick(46, 44) * u, maxW: a.w * 0.84, maxLines: 2, lineGap: 1.3 })
      const cta = sc.cta && E.fit(sc.cta, { role: 'body', weight: 700, size: 44 * u, maxW: a.w * 0.6, maxLines: 1 })
      const hb = big.lines.length * big.lineH, hs = sub ? sub.lines.length * sub.lineH + 24 * u : 0, hc = cta ? cta.size * 2.2 + 44 * u : 0
      let y = a.y + a.h - hb - hs - hc - E.pick(0, 60) * u
      const gy = (a.y + y) / 2, gR = Math.min(E.pick(620, 540) * u, (y - a.y + 60 * u) / 0.72), ga = ease.out(clamp(t / 1.4))
      galaxy(ctx, galaxySprite(E, [k.gold, k.cyan, k.violet], 117), W / 2, gy, gR * (0.86 + 0.14 * ga), t * 0.06, 0.34, ga * 0.95, -0.12)
      glow(ctx, E, W / 2, gy, gR * 0.22, k.gold, 0.5 * ga)
      const cyc = Math.floor(t / 2.6), cp = (t % 2.6) / 1.1, r1 = mulberry(31 + cyc)
      const cx0 = W * (0.55 + 0.4 * r1()), cy0 = a.y + (y - a.y) * 0.3 * r1()
      comet(ctx, E, cx0, cy0, cx0 - W * 0.35, cy0 + (y - a.y) * 0.4, cp, k.white, { tail: 0.5, r: 14, lw: 2, ease: ease.out, alpha: 0.8 })
      shock(ctx, E, W / 2, gy, t, s.cue(0), gR * 0.8, k.cyan, 1.4)
      words(ctx, E, s, big, W / 2, y, 'center', { p: pt, role: 'title', weight: 800, glow: k.cyan })
      y += hb
      if (sub) { words(ctx, E, s, sub, W / 2, y + 24 * u, 'center', { p: ps, color: k.dim, weight: 400 }); y += hs }
      if (cta) {
        ctx.font = E.font('body', 700, cta.size)
        const cw = ctx.measureText(cta.lines[0]).width, ccy = y + 44 * u + cta.size * 1.1, erx = cw / 2 + 70 * u, ery = cta.size * 1.1, q = ease.out(pc)
        if (q > 0) {
          ctx.save(); ctx.globalAlpha = q * 0.7; ctx.fillStyle = k.card; ctx.beginPath(); ctx.ellipse(W / 2, ccy, erx, ery, 0, 0, TAU); ctx.fill(); ctx.restore()
          orbit(ctx, W / 2, ccy, erx, ery, 0, q, { color: k.cyan, lw: 2 * u, start: PI })
          if (q >= 1) { const [mx, my] = orbPt(W / 2, ccy, erx, ery, 0, PI + (t - s.cue(i - 1)) * 1.4); moon(ctx, E, mx, my, 5 * u, k.cyan) }
        }
        words(ctx, E, s, cta, W / 2, ccy - cta.lineH / 2, 'center', { p: pc, color: k.gold, weight: 700, glow: k.gold })
      }
    },
  },

  // 字幕：无底框白字，深色柔影（星场在字幕带后面已经压暗）；上方一小段三颗星的连线
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const k = pal(E), u = E.u, P = E.portrait, W = E.W
    const chunks = captionChunks(say, P ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((x, y) => x + y, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const al = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
    const size = E.pick(40, 44) * u
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 400, size, maxW: Math.min(W - E.safe.l * 2, E.pick(1300, 900) * u), maxLines: 2, lineGap: 1.48, quiet: true })
    const cy = E.H - E.captionH / 2 - (P ? 30 * u : 0), top = cy - (f.lines.length - 1) * f.lineH / 2
    ctx.globalAlpha = al
    const my = top - size * 1.05, pts = [[W / 2 - 26 * u, my + 3 * u], [W / 2, my - 3 * u], [W / 2 + 26 * u, my + 2 * u]]
    ctx.strokeStyle = E.rgba(k.cyan, 0.55); ctx.lineWidth = 1.2 * u
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke()
    ctx.fillStyle = k.cyan
    pts.forEach(([x, y], i) => { ctx.beginPath(); ctx.arc(x, y, (i === 1 ? 3.2 : 2.2) * u, 0, TAU); ctx.fill() })
    ctx.font = E.font('body', 400, f.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = k.text
    ctx.shadowColor = 'rgba(0,0,6,0.95)'; ctx.shadowBlur = 14 * u
    const dy = (1 - ease.out(al)) * 6 * u
    f.lines.forEach((ln, j) => ctx.fillText(ln, W / 2, top + j * f.lineH + dy))
  },

  // 最上层：左上一个装饰小字，右上场次，下面一条虚线轨道上一颗亮点走全片进度
  overlay(ctx, E, s) {
    const k = pal(E), u = E.u, P = E.portrait, W = E.W, y = (P ? 118 : 56) * u, mx = (P ? 64 : 96) * u
    ctx.textBaseline = 'middle'; ctx.font = E.font('body', 500, 22 * u); ctx.fillStyle = k.dim
    E.spacedText(ctx, 'STAR MAP', mx, y, 5 * u, 'left')
    const tot = ' / ' + String(s.count).padStart(2, '0'), wt = ctx.measureText(tot).width
    ctx.textAlign = 'left'; ctx.fillText(tot, W - mx - wt, y)
    ctx.fillStyle = k.cyan; ctx.textAlign = 'right'; ctx.fillText(two(s.index), W - mx - wt, y)
    const ly = y + (P ? 34 : 30) * u, x1 = mx + (W - 2 * mx) * clamp(E.T / E.total)
    ctx.lineWidth = 1 * u; ctx.strokeStyle = E.rgba(k.faint, 0.7); ctx.setLineDash([2 * u, 6 * u])
    ctx.beginPath(); ctx.moveTo(mx, ly); ctx.lineTo(W - mx, ly); ctx.stroke(); ctx.setLineDash([])
    ctx.strokeStyle = E.rgba(k.cyan, 0.75); ctx.beginPath(); ctx.moveTo(mx, ly); ctx.lineTo(x1, ly); ctx.stroke()
    glow(ctx, E, x1, ly, 14 * u, k.cyan, 1)
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x1, ly, 2.5 * u, 0, TAU); ctx.fill()
  },

  // 转场（0.7 秒）：上一场向前推进放大、略转、淡出；新场从中心以光圈展开，光圈边一道青色亮环，期间星光拉成放射线
  transitionDur: 0.7,
  transition(ctx, A, B, p, E) {
    const { W, H } = E, k = pal(E), b = E.L.box, An = { x: W / 2, y: b.y + b.h / 2 }, diag = Math.hypot(W, H), q = ease.in(p)
    ctx.fillStyle = k.bg0; ctx.fillRect(0, 0, W, H)
    ctx.save(); ctx.globalAlpha = 1 - ease.inOut(clamp(p * 1.15))
    ctx.translate(An.x, An.y); ctx.rotate(0.06 * q); ctx.scale(1 + 0.9 * q, 1 + 0.9 * q); ctx.translate(-An.x, -An.y)
    ctx.drawImage(A, 0, 0); ctx.restore()
    const R = diag * 0.55 * ease.inOut(clamp((p - 0.12) / 0.88))
    if (R > 0) {
      ctx.save(); ctx.beginPath(); ctx.arc(An.x, An.y, R, 0, TAU); ctx.clip()
      const sc = 1.12 - 0.12 * ease.out(p)
      ctx.translate(An.x, An.y); ctx.rotate(-0.05 * (1 - p)); ctx.scale(sc, sc); ctx.translate(-An.x, -An.y)
      ctx.drawImage(B, 0, 0); ctx.restore()
      ctx.save(); ctx.globalAlpha = sin(PI * clamp(p)) * 0.8; ctx.strokeStyle = k.cyan; ctx.lineWidth = 2.5 * E.u; ctx.shadowColor = k.cyan; ctx.shadowBlur = 18 * E.u
      ctx.beginPath(); ctx.arc(An.x, An.y, R, 0, TAU); ctx.stroke(); ctx.restore()
    }
    const kk = sin(PI * clamp(p))
    if (kk > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
      for (const st of STREAKS) {
        const r0 = diag * (0.05 + 0.5 * st.d) * (0.6 + p), len = diag * 0.12 * kk * (0.4 + st.d)
        const x0 = An.x + cos(st.a) * r0, y0 = An.y + sin(st.a) * r0, x1 = An.x + cos(st.a) * (r0 + len), y1 = An.y + sin(st.a) * (r0 + len)
        const g = ctx.createLinearGradient(x0, y0, x1, y1)
        g.addColorStop(0, E.rgba(k[st.c], 0)); g.addColorStop(1, E.rgba(k[st.c], 0.7 * kk))
        ctx.strokeStyle = g; ctx.lineWidth = st.w * E.u; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
      }
      ctx.restore()
      glow(ctx, E, An.x, An.y, 260 * E.u * kk, '#ffffff', 0.35 * kk)
    }
  },

  // 默认版式会调用的零件（九种版式都重画了，这些只在自定义场借用时用到）：深色半透明卡片带青色角标、光柱、小星、轨道下划线
  card(ctx, E, x, y, w, h, o = {}) {
    const k = pal(E), u = E.u, col = o.tone === 'accent' ? k.gold : k.cyan
    ctx.save(); E.roundRect(ctx, x, y, w, h, this.radius * u); ctx.fillStyle = E.rgba(k.card, 0.72); ctx.fill()
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = E.rgba(o.tone === 'accent' ? k.gold : k.faint, 0.8); ctx.stroke()
    ctx.strokeStyle = col; ctx.lineWidth = 2.5 * u; const c = 18 * u
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y + h, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * c, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * c); ctx.stroke() }
    ctx.restore()
  },
  line(ctx, E, x1, y1, x2, y2, o = {}) {
    const p = o.p ?? 1
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = o.color ?? pal(E).cyan; ctx.lineWidth = (o.width ?? 3) * E.u
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); ctx.stroke(); ctx.restore()
  },
  bar(ctx, E, x, y, w, h, o = {}) {
    const horiz = Math.abs(w) > Math.abs(h) * 1.5
    if (horiz) beam(ctx, E, x, y + h / 2, w, Math.abs(h) * 0.6, o.color ?? pal(E).gold, true)
    else beam(ctx, E, x + w / 2, y + h, h, Math.abs(w) * 0.6, o.color ?? pal(E).gold, false)
  },
  mark(ctx, E, x, y, r, i, o = {}) { const k = pal(E); if (o.badge) { ctx.save(); ctx.strokeStyle = o.color ?? k.cyan; ctx.lineWidth = 2 * E.u; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore() } else glint(ctx, E, x, y, r * 0.5, o.color ?? (i % 2 ? k.cyan : k.gold)) },
  underline(ctx, E, x, y, w, p) { const k = pal(E); this.line(ctx, E, x, y, x + w, y, { p, width: 2, color: k.cyan }); if (p > 0) moon(ctx, E, x + w * p, y, 5 * E.u, k.cyan) },
}
