// 风格包：数据仪表盘（dashboard），移植自风格库的 U-数据仪表盘。
// 暗色数据大屏：深蓝黑点阵底，内容全装在整圈细边加四角括号的面板里。每一场先以灰色骨架出现，再按 s.p(i) 一块一块点亮；
// 强调色只标「当前点亮的那一块」和 highlight，点亮过的部分退回 calm 色。图表里的数只来自 s.scene，
// 装饰面板（折线、小柱、转环、点阵、日志带）只有不带标注的线条和形状，并且一直在缓慢变化。
import { P, setPal, panel, brackets, ghostBar, capsule, polyline, dot, arc, ticks, shock, check, sweep, pulse } from './lib/dash.mjs'
import { decoPanel } from './lib/deco.mjs'
import { geo, drawBg, header, drawCaption, scanWipe } from './lib/frame.mjs'
import { rolling } from '../../layouts.mjs'
import { clamp, lerp, drawLines, formatNumber, decimalsOf } from '../../core.mjs'

const TAU = Math.PI * 2
const R = (x, y, w, h) => ({ x, y, w, h })
function split(r, fr, gap, vert) {
  const tot = fr.reduce((a, b) => a + b, 0), avail = (vert ? r.h : r.w) - gap * (fr.length - 1)
  let o = vert ? r.y : r.x
  return fr.map(f => { const d = avail * f / tot, q = vert ? R(r.x, o, r.w, d) : R(o, r.y, d, r.h); o += d + gap; return q })
}
const cols = (r, fr, gap) => split(r, fr, gap, false)
const rows = (r, fr, gap) => split(r, fr, gap, true)

// 第 k 块面板的骨架什么时候出现（场一开始依次亮出灰框）
const boot = (s, k) => clamp((s.t - 0.02 - k * 0.06) / 0.26)
const litOf = p => clamp(p * 1.5)
// 第 i 个元素是不是「当前点亮的那一块」：下一个元素点亮时它退回 calm
const curOf = (s, i, last) => (i >= last ? 1 : 1 - clamp(s.p(i + 1) * 1.6))
const tone = (E, c) => E.mix(P.calm, P.acc, clamp(c))
// 几段字用同一个字号（取各自能放下的最小字号）
function fitAll(E, texts, opt) {
  const size = Math.min(...texts.map(t => E.fit(t, opt).size))
  return texts.map(t => E.fit(t, { ...opt, size }))
}

// 一段排好的字：骨架条淡出，字淡入并轻轻上移
function showText(ctx, E, f, x, y, p, o) {
  const a = E.ease.out(clamp(p * 1.4)), font = E.font(o.role, o.weight, f.size)
  if (a < 1) {
    ctx.save(); ctx.font = font
    f.lines.forEach((ln, k) => { const w = ctx.measureText(ln).width; ghostBar(ctx, E, o.align === 'center' ? x - w / 2 : x, y + k * f.lineH + f.lineH / 2 - f.size * 0.16, w, f.size * 0.32, (1 - clamp(a * 2.2)) * (o.ga ?? 1)) })
    ctx.restore()
  }
  if (a <= 0) return
  ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = o.color; ctx.font = font
  drawLines(ctx, f.lines, x, y + (1 - a) * 14 * E.u, f.lineH, o.align || 'left'); ctx.restore()
}

// 逐行写出：每行从左到右露出，写到的位置有一根光标，没写到的部分是骨架条。
// hl 那一段写完后变强调色，套上四角括号的选框。返回整段写完的时刻（相对 t 的起点）
function wipeLines(ctx, E, f, x, y0, t, o) {
  const u = E.u, per = o.per ?? 0.34, gap = o.gap ?? 0.16, font = E.font('title', o.weight ?? 800, f.size)
  const hl = o.hl ? String(o.hl) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1
  const done = (f.lines.length - 1) * gap + per, hq = hs >= 0 ? E.ease.out(clamp((t - done) / 0.35)) : 0
  const segs = []
  let off = 0
  ctx.save(); ctx.font = font; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  f.lines.forEach((ln, j) => {
    const lw = ctx.measureText(ln).width, x0 = o.align === 'center' ? x - lw / 2 : x, cy = y0 + j * f.lineH + f.lineH / 2
    const q = E.ease.inOut(clamp((t - j * gap) / per))
    const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off)
    off += ln.length
    if (q < 1) ghostBar(ctx, E, x0 + lw * q, cy - f.size * 0.16, lw * (1 - q), f.size * 0.32, o.ga ?? 1)
    if (q <= 0) return
    ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20 * u, cy - f.lineH, lw * q + 20 * u, f.lineH * 2); ctx.clip()
    if (hs < 0 || a1 <= a0) { ctx.fillStyle = o.color; ctx.fillText(ln, x0, cy) }
    else {
      const pre = ln.slice(0, a0), mid = ln.slice(a0, a1), wPre = ctx.measureText(pre).width, wMid = ctx.measureText(mid).width
      ctx.fillStyle = o.color; ctx.fillText(pre, x0, cy); ctx.fillText(ln.slice(a1), x0 + wPre + wMid, cy)
      ctx.fillStyle = E.mix(o.color, P.acc, hq); ctx.fillText(mid, x0 + wPre, cy)
      segs.push({ x: x0 + wPre, y: cy, w: wMid })
    }
    ctx.restore()
    if (q < 1) {
      const cx = x0 + lw * q
      ctx.fillStyle = E.rgba(P.acc, 0.25); ctx.fillRect(cx - 4 * u, cy - f.size * 0.6, 11 * u, f.size * 1.2)
      ctx.fillStyle = P.acc; ctx.fillRect(cx, cy - f.size * 0.55, 3 * u, f.size * 1.1)
    }
  })
  ctx.restore()
  if (hq > 0) for (const sg of segs) {
    const pd = 12 * u, h = f.size * 1.2
    ctx.fillStyle = E.rgba(P.acc, 0.12 * hq); ctx.fillRect(sg.x - pd, sg.y - h / 2, sg.w + 2 * pd, h)
    brackets(ctx, E, sg.x - pd, sg.y - h / 2, sg.w + 2 * pd, h, { L: 16 * u * hq, k: 0, w: 3, col: P.acc, glow: hq })
  }
  return done
}

// 场标题放进面板的标题栏
const headTitle = (E, text, w) => E.fit(text, { role: 'title', weight: 700, size: 44 * E.u, maxW: w - 220 * E.u, maxLines: 1 })

export default {
  name: '数据仪表盘', mood: '暗色数据大屏：面板、四角括号、图表，指标、评测、复盘、监控', bpm: 116,
  c: { bg: '#04070e', fg: '#eaf0fa', muted: '#9aabc8', accent: '#22d3ee', accent2: '#a78bfa', card: '#0b1424', line: '#1d2b47', onAccent: '#04070e' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 800, wBody: 500, radius: 8,
  motion: 'rise', solidAccent: false,
  transitionDur: 0.5,
  transition(ctx, A, B, p, E) { setPal(E, this.c); scanWipe(ctx, A, B, p, E) },
  bg(ctx, E) { setPal(E, this.c); drawBg(ctx, E) },

  layouts: {
    // 大屏开机：四块装饰面板的骨架依次亮出、点亮，中间主面板被一道扫描光扫过后出标题；kicker 是标题上方的胶囊，副标题在下面
    title(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, g = 20 * u
      let C, decos
      if (!G.tall) {
        const [l, c, r] = cols(G, [0.19, 0.62, 0.19], g), [l1, l2] = rows(l, [1, 1], g), [r1, r2] = rows(r, [1, 1], g)
        C = c; decos = [[l1, 'spark'], [l2, 'bars'], [r1, 'ring'], [r2, 'log']]
      } else {
        const [t, c, b] = rows(G, [0.22, 0.56, 0.22], g), [t1, t2] = cols(t, [1, 1], g), [b1, b2] = cols(b, [1, 1], g)
        C = c; decos = [[t1, 'spark'], [t2, 'ring'], [b1, 'bars'], [b2, 'log']]
      }
      let i = 0
      const ik = sc.kicker ? i++ : -1, it = i++, isub = sc.subtitle ? i++ : -1
      decos.forEach(([r, kind], k) => decoPanel(ctx, E, r, kind, { p: boot(s, k), lit: clamp((s.t - 0.2 - k * 0.12) / 0.35), seed: k + 1 }))
      const head = 46 * u, pb = boot(s, 4)
      panel(ctx, E, C, { p: pb, lit: litOf(s.p(0)), col: P.acc, head, live: true })
      if (pb <= 0) return
      sweep(ctx, E, R(C.x, C.y + head, C.w, C.h - head), (s.t - 0.1) / Math.max(0.4, s.cue(it) + 0.3), P.acc)
      const maxW = C.w - 120 * u, cx = C.x + C.w / 2
      const kick = sc.kicker ? E.fit(sc.kicker, { role: 'body', weight: 600, size: 34 * u, maxW: maxW * 0.8, maxLines: 1 }) : null
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 500, size: (G.tall ? 40 : 44) * u, maxW: maxW * 0.9, maxLines: 2 }) : null
      const kh = kick ? kick.size * 1.8 : 0, hK = kick ? kh + 34 * u : 0, hS = sub ? sub.lines.length * sub.lineH + 40 * u : 0
      const big = E.fit(sc.title, { role: 'title', weight: 800, size: (G.tall ? 96 : 112) * u, maxW, maxLines: G.tall ? 3 : 2, maxH: C.h - head - hK - hS - 40 * u, lineGap: 1.16, oneLine: true })
      const hB = big.lines.length * big.lineH
      let y = C.y + head + (C.h - head - hK - hB - hS) / 2
      if (kick) {
        const a = E.ease.out(clamp(s.p(ik) * 1.4)), w = kick.width + kick.size * 1.6
        ghostBar(ctx, E, cx - w / 2, y + kh / 2 - 5 * u, w, 10 * u, (1 - a) * pb)
        if (a > 0) {
          ctx.save(); ctx.globalAlpha *= a
          capsule(ctx, E, cx - w / 2, y, w, kh, P.acc)
          ctx.fillStyle = P.acc; ctx.font = E.font('body', 600, kick.size); drawLines(ctx, kick.lines, cx, y + (kh - kick.lineH) / 2, kick.lineH, 'center')
          ctx.restore()
        }
        y += hK
      }
      showText(ctx, E, big, cx, y, s.p(it), { role: 'title', weight: 800, color: P.text, align: 'center', ga: pb })
      const lp = E.ease.out(clamp(s.p(it) * 1.3 - 0.3))
      if (lp > 0) {
        const lw = Math.min(big.width, maxW) * lp
        ctx.fillStyle = E.rgba(P.acc, 0.22); ctx.fillRect(cx - lw / 2, y + hB + 6 * u, lw, 9 * u)
        ctx.fillStyle = P.acc; ctx.fillRect(cx - lw / 2, y + hB + 9 * u, lw, 3 * u)
      }
      if (sub) showText(ctx, E, sub, cx, y + hB + 40 * u, s.p(isub), { role: 'body', weight: 500, color: P.dim, align: 'center', ga: pb })
    },

    // 结论面板：那句话逐行写出（光标走过，没写到的是骨架条），高亮词写完后变强调色、套上选框；旁边的装饰面板随后点亮
    statement(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, g = 20 * u
      let M, decos
      if (!G.tall) { const [m, side] = cols(G, [0.74, 0.26], g); M = m; decos = rows(side, [1, 1, 1], g).map((r, k) => [r, ['ring', 'spark', 'matrix'][k]]) }
      else { const [m, b] = rows(G, [0.74, 0.26], g); M = m; decos = cols(b, [1, 1], g).map((r, k) => [r, ['spark', 'ring'][k]]) }
      const head = 46 * u, pb = boot(s, 0), t = s.t - s.cue(0)
      panel(ctx, E, M, { p: pb, lit: litOf(s.p(0)), col: P.acc, head, live: true })
      decos.forEach(([r, kind], k) => decoPanel(ctx, E, r, kind, { p: boot(s, k + 1), lit: clamp((t - 0.6 - k * 0.15) / 0.4), seed: k + 3 }))
      if (pb <= 0) return
      const f = E.fit(sc.text, { role: 'title', weight: 800, size: (G.tall ? 84 : 92) * u, maxW: M.w - 150 * u, maxLines: G.tall ? 6 : 4, maxH: M.h - head - 120 * u, lineGap: 1.32 })
      const y0 = M.y + head + (M.h - head - f.lines.length * f.lineH) / 2
      wipeLines(ctx, E, f, M.x + M.w / 2, y0, t, { align: 'center', color: P.text, hl: sc.highlight, ga: pb })
    },

    // 事件流面板：场标题在标题栏，每一条是一行日志，从右边滑进来、闪一下；最新那条是强调色，之前的退回 calm；空位是骨架行
    bullets(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, n = sc.items.length, g = 20 * u
      let M = G, decos = []
      if (!G.tall) { const [m, side] = cols(G, [0.7, 0.3], g); M = m; decos = rows(side, [1, 1], g).map((r, k) => [r, ['ring', 'spark'][k]]) }
      else if (G.h * 0.17 >= 130 * u) { const [m, b] = rows(G, [0.83, 0.17], g); M = m; decos = [[b, 'log']] }
      decos.forEach(([r, kind], k) => decoPanel(ctx, E, r, kind, { p: boot(s, k + 1), lit: clamp((s.t - s.cue(0) - 0.2 - k * 0.2) / 0.4), seed: k + 5 }))
      const head = 84 * u, pb = boot(s, 0)
      panel(ctx, E, M, { p: pb, lit: litOf(s.p(0)), col: tone(E, curOf(s, 0, n)), head, titleF: headTitle(E, sc.title, M.w), titleA: E.ease.out(clamp(s.p(0) * 1.4)), live: true })
      if (pb <= 0) return
      const top = M.y + head + 14 * u, avail = M.y + M.h - 14 * u - top
      const rowH = Math.min(avail / n, 150 * u), slots = Math.max(n, Math.floor(avail / rowH + 1e-6)), y0 = top + (avail - rowH * slots) / 2
      const tx = 116 * u, size = Math.min(50 * u, rowH * 0.4)
      const FS = fitAll(E, sc.items, { role: 'body', weight: 600, size, maxW: M.w - 28 * u - tx - 80 * u, maxLines: 2, maxH: rowH * 0.84, lineGap: 1.2 })
      for (let k = 0; k < slots; k++) {
        const rr = R(M.x + 14 * u, y0 + k * rowH + 4 * u, M.w - 28 * u, rowH - 8 * u), cy = rr.y + rr.h / 2
        const p = k < n ? s.p(k + 1) : 0, a = E.ease.out(clamp(p * 1.4))
        if (a < 1) {
          ctx.save(); ctx.globalAlpha *= pb * (1 - a) * (k < n ? 1 : 0.55)
          ctx.fillStyle = E.rgba(P.ghost, 0.22); E.roundRect(ctx, rr.x, rr.y, rr.w, rr.h, 6 * u); ctx.fill()
          ghostBar(ctx, E, rr.x + 20 * u, cy - 4 * u, 36 * u, 8 * u)
          ghostBar(ctx, E, rr.x + tx, cy - 5 * u, rr.w * (0.22 + 0.3 * E.hash(k, 3)), 10 * u)
          ctx.restore()
        }
        if (k >= n || a <= 0) continue
        const c = curOf(s, k + 1, n), col = tone(E, c), f = FS[k], fl = 1 - clamp((s.t - s.cue(k + 1)) / 0.7)
        ctx.save(); ctx.globalAlpha *= a; ctx.translate((1 - a) * 48 * u, 0)
        ctx.fillStyle = E.rgba(col, 0.05 + 0.06 * c + 0.16 * fl); E.roundRect(ctx, rr.x, rr.y, rr.w, rr.h, 6 * u); ctx.fill()
        if (c > 0.02) { ctx.strokeStyle = E.rgba(P.acc, 0.55 * c); ctx.lineWidth = 1.4 * u; E.roundRect(ctx, rr.x, rr.y, rr.w, rr.h, 6 * u); ctx.stroke() }
        ctx.font = E.font('mono', 500, 22 * u); ctx.fillStyle = E.mix(P.faint, P.acc, c); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(String(k + 1).padStart(2, '0'), rr.x + 20 * u, cy)
        dot(ctx, E, rr.x + 86 * u, cy, 7 * u, col, 0.3 + 0.7 * c * (0.55 + 0.45 * pulse(E.T, 1.2)))
        ctx.fillStyle = P.text; ctx.font = E.font('body', 600, f.size); drawLines(ctx, f.lines, rr.x + tx, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
        check(ctx, E, rr.x + rr.w - 42 * u, cy, 30 * u, col, clamp((s.t - s.cue(k + 1) - 0.15) / 0.3))
        ctx.restore()
      }
    },

    // 大 KPI 卡：数字从 0 滚上去，一圈仪表弧同时扫满（不表示比例），落定时一道冲击环；label、note 在仪表下面。两侧是装饰面板
    number(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, g = 20 * u
      let K, decos
      if (!G.tall) {
        const [l, k, r] = cols(G, [0.24, 0.52, 0.24], g), [l1, l2] = rows(l, [1, 1], g), [r1, r2] = rows(r, [1, 1], g)
        K = k; decos = [[l1, 'spark'], [l2, 'bars'], [r1, 'matrix'], [r2, 'log']]
      } else { const [k, b] = rows(G, [0.74, 0.26], g); K = k; decos = cols(b, [1, 1], g).map((r, j) => [r, ['spark', 'bars'][j]]) }
      const il = sc.label ? 1 : -1, inote = sc.note ? (sc.label ? 2 : 1) : -1
      const rollDur = Math.min(1.4, s.dur * 0.35), t = s.t - s.cue(0), roll = clamp(t / rollDur)
      decos.forEach(([r, kind], j) => decoPanel(ctx, E, r, kind, { p: boot(s, j + 1), lit: clamp((t - 0.4 - j * 0.18) / 0.4), seed: j + 7 }))
      const head = 46 * u, pb = boot(s, 0), lit = litOf(s.p(0))
      panel(ctx, E, K, { p: pb, lit, col: P.acc, head, live: true })
      if (pb <= 0) return
      ctx.save(); ctx.globalAlpha *= pb
      const lab = sc.label ? E.fit(sc.label, { role: 'body', weight: 600, size: 46 * u, maxW: K.w - 100 * u, maxLines: 2 }) : null
      const note = sc.note ? E.fit(sc.note, { role: 'body', weight: 400, size: 32 * u, maxW: K.w - 120 * u, maxLines: 2 }) : null
      const hLab = lab ? lab.lines.length * lab.lineH + 14 * u : 0, hNote = note ? note.lines.length * note.lineH + 8 * u : 0
      const top = K.y + head + 30 * u, bot = K.y + K.h - 26 * u - hLab - hNote
      const Rg = Math.max(60 * u, Math.min((K.w - 170 * u) / 2, (bot - top - 30 * u) / 1.8)), cx = K.x + K.w / 2, cy = top + 18 * u + Rg
      const a0 = Math.PI * 0.75, span = Math.PI * 1.5, th = Math.max(10 * u, Rg * 0.055)
      arc(ctx, E, cx, cy, Rg, th, a0, a0 + span, E.rgba(P.ghost, 0.9), 0, 'round')
      ticks(ctx, E, cx, cy, Rg + th / 2 + 8 * u, 36, E.rgba(P.faint, 0.7), { a0, span, major: 6 })
      ctx.save(); ctx.strokeStyle = E.rgba(P.calm, 0.28); ctx.lineWidth = 2 * u; ctx.setLineDash([6 * u, 10 * u]); ctx.lineDashOffset = -E.T * 20 * u
      ctx.beginPath(); ctx.arc(cx, cy, Rg - th - 18 * u, 0, TAU); ctx.stroke(); ctx.restore()
      if (roll > 0) {
        const ge = E.ease.out(roll), ea = a0 + span * ge
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rg * 0.95)
        halo.addColorStop(0, E.rgba(P.acc, 0.14 * lit)); halo.addColorStop(1, E.rgba(P.acc, 0))
        ctx.fillStyle = halo; ctx.fillRect(cx - Rg, cy - Rg, Rg * 2, Rg * 2)
        arc(ctx, E, cx, cy, Rg, th, a0, ea, P.acc, 1, 'round')
        dot(ctx, E, cx + Math.cos(ea) * Rg, cy + Math.sin(ea) * Rg, th * 0.42, P.text, roll >= 1 ? 0.3 + 0.7 * pulse(E.T, 1.1) : 0)
      }
      shock(ctx, E, cx, cy, clamp((t - rollDur) / 0.7), Rg * 0.85, Rg * 1.3, P.acc)
      const str = String(sc.value), size = Rg * 0.6
      ctx.font = E.font('body', 700, size * 0.3); const uw0 = sc.unit ? ctx.measureText(sc.unit).width + 14 * u : 0
      const f = E.fit(str, { role: 'num', weight: 700, size, maxW: Rg * 1.5 - uw0, maxLines: 1, minSize: size * 0.3, lineGap: 1, quiet: true })
      const nf = E.font('num', 700, f.size), uf = E.font('body', 700, f.size * 0.3)
      ctx.font = nf; const wN = ctx.measureText(str).width; ctx.font = uf; const uw = sc.unit ? ctx.measureText(sc.unit).width + 14 * u : 0
      const x0 = cx - (wN + uw) / 2, ny = cy - Rg * 0.04
      ctx.textBaseline = 'middle'
      if (t < 0) { ctx.font = nf; ctx.fillStyle = P.ghost; ctx.textAlign = 'center'; ctx.fillText('--', cx, ny) }
      else {
        ctx.save(); ctx.globalAlpha *= clamp(s.p(0) * 2)
        ctx.font = nf; ctx.fillStyle = P.acc; ctx.textAlign = 'right'; ctx.fillText(rolling(sc.value, roll), x0 + wN, ny)
        if (sc.unit) { ctx.font = uf; ctx.fillStyle = P.text; ctx.textAlign = 'left'; ctx.fillText(sc.unit, x0 + wN + 14 * u, ny + f.size * 0.2) }
        ctx.restore()
      }
      let y = cy + Rg * 0.71 + th + 14 * u
      if (lab) { showText(ctx, E, lab, cx, y, s.p(il), { role: 'body', weight: 600, color: P.text, align: 'center' }); y += lab.lines.length * lab.lineH + 14 * u }
      if (note) showText(ctx, E, note, cx, y, s.p(inote), { role: 'body', weight: 400, color: P.dim, align: 'center' })
      ctx.restore()
    },

    // 图表面板：开场一道扫描光扫过空图表；横屏竖柱、竖屏横条，柱子在灰色轨道里长出来，刚长出的那根闪强调色，
    // highlight（或最高）那根一直是强调色、带光晕；柱顶的数据点在呼吸。网格线没有刻度值
    bars(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, n = sc.items.length, M = G
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const head = 84 * u, pb = boot(s, 0)
      panel(ctx, E, M, { p: pb, lit: litOf(s.p(0)), col: tone(E, curOf(s, 0, n)), head, titleF: headTitle(E, sc.title, M.w), titleA: E.ease.out(clamp(s.p(0) * 1.4)), live: true })
      if (pb <= 0) return
      const colOf = (i, p) => (i === hi ? P.acc : E.mix(P.barN, P.acc, p > 0 ? 1 - clamp((s.t - s.cue(i + 1)) / 0.8) : 0))
      const valStr = (i, q) => formatNumber(vals[i] * q, dec) + unit
      const opt = { role: 'num', weight: 700, size: 40 * u, maxLines: 1 }
      ctx.save(); ctx.globalAlpha *= pb
      if (!G.tall) {
        const pad = 56 * u, labH = 96 * u, valH = 72 * u
        const pl = R(M.x + pad, M.y + head + valH, M.w - pad * 2, M.h - head - valH - labH - 10 * u), base = pl.y + pl.h
        ctx.save(); ctx.strokeStyle = P.grid; ctx.lineWidth = 1.2 * u; ctx.setLineDash([4 * u, 6 * u])
        for (let k = 0; k < 4; k++) { const y = pl.y + pl.h * k / 4; ctx.beginPath(); ctx.moveTo(pl.x - 10 * u, y); ctx.lineTo(pl.x + pl.w + 10 * u, y); ctx.stroke() }
        ctx.restore()
        ctx.fillStyle = P.line; ctx.fillRect(pl.x - 10 * u, base, pl.w + 20 * u, 2 * u)
        const slot = pl.w / n, bw = Math.min(slot * 0.5, 150 * u)
        const VF = fitAll(E, sc.items.map((_, i) => valStr(i, 1)), { ...opt, maxW: slot * 0.96 })
        const LF = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 600, size: 34 * u, maxW: slot * 0.92, maxLines: 2, maxH: labH - 16 * u, lineGap: 1.15 })
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), q = E.ease.outExpo(p), x = pl.x + slot * i + (slot - bw) / 2, h = pl.h * vals[i] / max * q, col = colOf(i, p)
          ctx.fillStyle = E.rgba(P.ghost, 0.22); ctx.fillRect(x, pl.y, bw, pl.h)
          if (h > 0.5) {
            if (i === hi) for (const [d, a] of [[12, 0.06], [6, 0.12]]) { ctx.fillStyle = E.rgba(P.acc, a); ctx.fillRect(x - d * u, base - h - d * u, bw + 2 * d * u, h + d * u) }
            const gr = ctx.createLinearGradient(0, base - h, 0, base); gr.addColorStop(0, col); gr.addColorStop(1, E.rgba(col, 0.3))
            ctx.fillStyle = gr; ctx.fillRect(x, base - h, bw, h)
            ctx.fillStyle = E.mix(col, P.text, 0.4); ctx.fillRect(x, base - h, bw, 3 * u)
          }
          if (p >= 1) dot(ctx, E, x + bw / 2, base - h, (i === hi ? 6 : 4.5) * u, i === hi ? P.acc : P.calm, (i === hi ? 0.5 : 0.2) + 0.5 * pulse(E.T, 1.1, i * 0.17))
          const a = clamp(p * 2), lf = LF[i]
          ghostBar(ctx, E, x + bw / 2 - Math.min(lf.width, slot * 0.6) / 2, base + 32 * u, Math.min(lf.width, slot * 0.6), 10 * u, 1 - a)
          if (a <= 0) return
          ctx.save(); ctx.globalAlpha *= a
          ctx.fillStyle = i === hi ? P.text : P.dim; ctx.font = E.font('body', 600, lf.size); drawLines(ctx, lf.lines, x + bw / 2, base + 16 * u, lf.lineH, 'center')
          ctx.font = E.font('num', 700, VF[i].size); ctx.fillStyle = i === hi ? P.acc : P.text; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
          ctx.fillText(valStr(i, q), x + bw / 2, base - h - 18 * u)
          ctx.restore()
        })
        sweep(ctx, E, pl, (s.t - 0.05) / Math.max(0.3, s.cue(1)), P.acc)
      } else {
        const pad = 36 * u, top = M.y + head + 26 * u, avail = M.y + M.h - 26 * u - top, x0 = M.x + pad
        const rowH = Math.min(avail / n, 230 * u), y0 = top + (avail - rowH * n) / 2
        const VF = fitAll(E, sc.items.map((_, i) => valStr(i, 1)), { ...opt, size: 38 * u, maxW: 200 * u })
        const wMax = M.w - pad * 2 - Math.max(...VF.map(f => f.width)) - 24 * u
        const LF = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 600, size: Math.min(36 * u, rowH * 0.3), maxW: M.w - pad * 2, maxLines: 1 })
        ctx.fillStyle = P.line; ctx.fillRect(x0 - 2 * u, y0, 2 * u, rowH * n)
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), q = E.ease.outExpo(p), y = y0 + rowH * i, bh = rowH * 0.3, by = y + rowH * 0.52, w = wMax * vals[i] / max * q, col = colOf(i, p), lf = LF[i]
          ctx.fillStyle = E.rgba(P.ghost, 0.22); ctx.fillRect(x0, by, wMax, bh)
          if (w > 0.5) {
            if (i === hi) for (const [d, a] of [[12, 0.06], [6, 0.12]]) { ctx.fillStyle = E.rgba(P.acc, a); ctx.fillRect(x0, by - d * u, w + d * u, bh + 2 * d * u) }
            const gr = ctx.createLinearGradient(x0, 0, x0 + w, 0); gr.addColorStop(0, E.rgba(col, 0.3)); gr.addColorStop(1, col)
            ctx.fillStyle = gr; ctx.fillRect(x0, by, w, bh)
            ctx.fillStyle = E.mix(col, P.text, 0.4); ctx.fillRect(x0 + w - 3 * u, by, 3 * u, bh)
          }
          if (p >= 1) dot(ctx, E, x0 + w, by + bh / 2, (i === hi ? 6 : 4.5) * u, i === hi ? P.acc : P.calm, (i === hi ? 0.5 : 0.2) + 0.5 * pulse(E.T, 1.1, i * 0.17))
          const a = clamp(p * 2)
          ghostBar(ctx, E, x0, y + rowH * 0.2, Math.min(lf.width, wMax * 0.5), 10 * u, 1 - a)
          if (a <= 0) return
          ctx.save(); ctx.globalAlpha *= a
          ctx.fillStyle = i === hi ? P.text : P.dim; ctx.font = E.font('body', 600, lf.size); drawLines(ctx, lf.lines, x0, y + rowH * 0.24 - lf.lineH / 2, lf.lineH, 'left')
          ctx.font = E.font('num', 700, VF[i].size); ctx.fillStyle = i === hi ? P.acc : P.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          ctx.fillText(valStr(i, q), x0 + w + 20 * u, by + bh / 2)
          ctx.restore()
        })
        sweep(ctx, E, R(x0, y0, wMax, rowH * n), (s.t - 0.05) / Math.max(0.3, s.cue(1)), P.acc)
      }
      ctx.restore()
    },

    // 流水线面板：轨道上的节点依次点亮，点亮的一段轨道上有光点流动；当前节点是强调色并一圈圈外扩，走过的退回 calm；
    // 每个节点挂一张小面板写这一步，没轮到的是虚线占位。横屏节点在上、卡在下，竖屏轨道竖在左边
    steps(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, n = sc.items.length, M = G
      const head = 84 * u, pb = boot(s, 0)
      panel(ctx, E, M, { p: pb, lit: litOf(s.p(0)), col: tone(E, curOf(s, 0, n)), head, titleF: headTitle(E, sc.title, M.w), titleA: E.ease.out(clamp(s.p(0) * 1.4)), live: true })
      if (pb <= 0) return
      ctx.save(); ctx.globalAlpha *= pb
      const r = (G.tall ? 30 : 34) * u
      let nodes, cards
      if (!G.tall) {
        const pad = 40 * u, slot = (M.w - pad * 2) / n, cw = slot - 30 * u
        const ch = Math.min(M.h - head - 90 * u - 2 * r - 46 * u, 330 * u), ty = M.y + head + (M.h - head - (2 * r + 46 * u + ch)) / 2 + r
        nodes = sc.items.map((_, i) => ({ x: M.x + pad + slot * (i + 0.5), y: ty }))
        cards = nodes.map(nd => R(nd.x - cw / 2, ty + r + 46 * u, cw, ch))
      } else {
        const pad = 30 * u, gap = 22 * u, top = M.y + head + 24 * u, avail = M.h - head - 48 * u
        const ch = Math.min((avail - gap * (n - 1)) / n, 250 * u), y0 = top + (avail - ch * n - gap * (n - 1)) / 2, nx = M.x + pad + r + 6 * u, cx0 = nx + r + 40 * u
        nodes = sc.items.map((_, i) => ({ x: nx, y: y0 + i * (ch + gap) + ch / 2 }))
        cards = nodes.map(nd => R(cx0, nd.y - ch / 2, M.x + M.w - pad - cx0, ch))
      }
      const A0 = nodes[0], A1 = nodes[n - 1]
      ctx.save(); ctx.strokeStyle = P.ghost; ctx.lineWidth = 4 * u; ctx.setLineDash([8 * u, 8 * u])
      ctx.beginPath(); ctx.moveTo(A0.x, A0.y); ctx.lineTo(A1.x, A1.y); ctx.stroke(); ctx.restore()
      for (let i = 1; i < n; i++) {
        const q = E.ease.out(clamp(s.p(i + 1) * 1.6))
        if (q <= 0) continue
        const a = nodes[i - 1], b = nodes[i], ex = lerp(a.x, b.x, q), ey = lerp(a.y, b.y, q)
        ctx.save(); ctx.lineCap = 'round'
        for (const [w, c] of [[11, E.rgba(P.calm, 0.16)], [3.5, P.calm]]) { ctx.strokeStyle = c; ctx.lineWidth = w * u; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke() }
        ctx.strokeStyle = E.rgba(P.text, 0.85); ctx.lineWidth = 3.5 * u; ctx.setLineDash([3 * u, 22 * u]); ctx.lineDashOffset = -E.T * 50 * u
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore()
      }
      const FS = fitAll(E, sc.items, { role: 'body', weight: 600, size: (G.tall ? 44 : 50) * u, maxW: cards[0].w - 44 * u, maxLines: G.tall ? 2 : 3, maxH: cards[0].h - 36 * u, lineGap: 1.22 })
      sc.items.forEach((it, i) => {
        const p = s.p(i + 1), a = E.ease.out(clamp(p * 1.4)), c = curOf(s, i + 1, n), col = tone(E, c), nd = nodes[i], cd = cards[i], f = FS[i]
        if (a < 1) panel(ctx, E, cd, { dash: true, p: 1 - a })
        if (a > 0) {
          ctx.save(); ctx.globalAlpha *= a
          ctx.strokeStyle = col; ctx.lineWidth = 2.5 * u; ctx.beginPath()
          if (G.tall) { ctx.moveTo(nd.x + r, nd.y); ctx.lineTo(cd.x, nd.y) } else { ctx.moveTo(nd.x, nd.y + r); ctx.lineTo(nd.x, cd.y) }
          ctx.stroke()
          panel(ctx, E, cd, { p: 1, lit: a * (0.35 + 0.65 * c), col })
          ctx.fillStyle = P.text; ctx.font = E.font('body', 600, f.size)
          const ty = cd.y + (cd.h - f.lines.length * f.lineH) / 2 + (1 - a) * 12 * u
          if (G.tall) drawLines(ctx, f.lines, cd.x + 28 * u, ty, f.lineH, 'left'); else drawLines(ctx, f.lines, cd.x + cd.w / 2, ty, f.lineH, 'center')
          ctx.restore()
        }
        ctx.save()
        if (p <= 0) {
          ctx.fillStyle = P.panel; ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, TAU); ctx.fill()
          ctx.strokeStyle = P.ghost; ctx.lineWidth = 2.5 * u; ctx.setLineDash([6 * u, 6 * u]); ctx.stroke(); ctx.setLineDash([])
          ctx.fillStyle = P.faint
        } else {
          if (c > 0.5) shock(ctx, E, nd.x, nd.y, ((s.t - s.cue(i + 1)) % 1.4) / 1.4, r, r * 2.1, P.acc)
          if (c > 0.02) { ctx.fillStyle = E.rgba(P.acc, 0.18 * c); ctx.beginPath(); ctx.arc(nd.x, nd.y, r + 12 * u, 0, TAU); ctx.fill() }
          ctx.fillStyle = E.mix(P.panel2, P.acc, c); ctx.beginPath(); ctx.arc(nd.x, nd.y, r, 0, TAU); ctx.fill()
          ctx.strokeStyle = col; ctx.lineWidth = 3 * u; ctx.stroke()
          ctx.fillStyle = c > 0.5 ? P.on : P.calm
        }
        ctx.font = E.font('num', 700, r * 0.95); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), nd.x, nd.y + 1 * u)
        ctx.restore()
      })
      ctx.restore()
    },

    // 左右对照：标题条一块，下面两张面板，左边点亮后退回 calm，右边（推荐的一方）是强调色；条目一行行落进来。
    // 两张面板之间一条连线，点亮后光点来回走，中间一个双向箭头的小圆标。竖屏上下叠
    compare(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, g = 20 * u, th = 84 * u, st = E.portrait
      const T = R(G.x, G.y, G.w, th), body = R(G.x, G.y + th + g, G.w, G.h - th - g), mid = (st ? 76 : 120) * u
      const boxes = st
        ? [R(body.x, body.y, body.w, (body.h - mid) / 2), R(body.x, body.y + (body.h + mid) / 2, body.w, (body.h - mid) / 2)]
        : [R(body.x, body.y, (body.w - mid) / 2, body.h), R(body.x + (body.w + mid) / 2, body.y, (body.w - mid) / 2, body.h)]
      panel(ctx, E, T, { p: boot(s, 0), lit: litOf(s.p(0)), col: tone(E, curOf(s, 0, 2)), head: th, titleF: headTitle(E, sc.title, T.w), titleA: E.ease.out(clamp(s.p(0) * 1.4)), live: true })
      const sides = [sc.left, sc.right], hh = 76 * u
      const maxN = Math.max(1, ...sides.map(d => (d.items || []).length)), rowH = Math.min((boxes[0].h - hh - 40 * u) / maxN, 150 * u)
      const all = sides.flatMap(d => d.items || [])
      const FS = all.length ? fitAll(E, all, { role: 'body', weight: 500, size: Math.min(46 * u, rowH * 0.42), maxW: boxes[0].w - 110 * u, maxLines: 2, maxH: rowH * 0.88, lineGap: 1.2 }) : []
      let k0 = 0
      sides.forEach((d, i) => {
        const B = boxes[i], p = s.p(i + 1), a = E.ease.out(clamp(p * 1.4)), col = i === 1 ? P.acc : tone(E, curOf(s, 1, 2)), items = d.items || [], pb = boot(s, i + 1)
        const sf = E.fit(d.title, { role: 'title', weight: 700, size: 40 * u, maxW: B.w - 120 * u, maxLines: 1 })
        panel(ctx, E, B, { p: pb, lit: litOf(p), col, head: hh, titleF: sf, titleA: a })
        const fs = FS.slice(k0, k0 + items.length), y0 = B.y + hh + Math.max(20 * u, (B.h - hh - rowH * maxN) / 2)
        k0 += items.length
        if (pb <= 0) return
        items.forEach((it, k) => {
          const cy = y0 + rowH * k + rowH / 2, q = E.ease.out(clamp((s.t - s.cue(i + 1) - 0.1 - k * 0.09) / 0.3)), f = fs[k]
          if (k < items.length - 1) {
            ctx.save(); ctx.strokeStyle = P.grid; ctx.lineWidth = 1.2 * u; ctx.setLineDash([4 * u, 6 * u])
            ctx.beginPath(); ctx.moveTo(B.x + 30 * u, y0 + rowH * (k + 1)); ctx.lineTo(B.x + B.w - 30 * u, y0 + rowH * (k + 1)); ctx.stroke(); ctx.restore()
          }
          ghostBar(ctx, E, B.x + 76 * u, cy - 5 * u, Math.min(f.width, B.w * 0.5), 10 * u, (1 - q) * pb)
          if (q <= 0) return
          ctx.save(); ctx.globalAlpha *= q; ctx.translate((1 - q) * 20 * u, 0)
          dot(ctx, E, B.x + 44 * u, cy, 6 * u, i === 1 ? P.acc : P.calm, 0.5)
          ctx.fillStyle = P.text; ctx.font = E.font('body', 500, f.size); drawLines(ctx, f.lines, B.x + 76 * u, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
          ctx.restore()
        })
      })
      const [A, B] = boxes, lp = E.ease.out(clamp(s.p(2) * 1.5))
      const p1 = st ? { x: G.x + G.w / 2, y: A.y + A.h } : { x: A.x + A.w, y: A.y + A.h / 2 }, p2 = st ? { x: p1.x, y: B.y } : { x: B.x, y: p1.y }
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, cr = 26 * u
      ctx.save(); ctx.globalAlpha *= boot(s, 3); ctx.strokeStyle = P.ghost; ctx.lineWidth = 3 * u; ctx.setLineDash([6 * u, 6 * u])
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.restore()
      if (lp <= 0) return
      ctx.save(); ctx.globalAlpha *= lp
      ctx.fillStyle = P.acc; ctx.fillRect(Math.min(p1.x, p2.x) - (st ? 1.5 * u : 0), Math.min(p1.y, p2.y) - (st ? 0 : 1.5 * u), st ? 3 * u : Math.abs(p2.x - p1.x), st ? Math.abs(p2.y - p1.y) : 3 * u)
      for (let j = 0; j < 2; j++) { const k = (s.t * 0.7 + j * 0.5) % 1; dot(ctx, E, lerp(p1.x, p2.x, k), lerp(p1.y, p2.y, k), 4 * u, P.text, 0.6) }
      ctx.translate(mx, my); if (st) ctx.rotate(Math.PI / 2)
      ctx.fillStyle = P.panel2; ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.fill()
      ctx.strokeStyle = P.acc; ctx.lineWidth = 2.5 * u; ctx.stroke()
      ctx.strokeStyle = P.text; ctx.lineWidth = 3 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath()
      const e = cr * 0.45, d = cr * 0.24
      ctx.moveTo(-e, -d); ctx.lineTo(e, -d); ctx.lineTo(e - 7 * u, -d - 6 * u); ctx.moveTo(e, d); ctx.lineTo(-e, d); ctx.lineTo(-e + 7 * u, d + 6 * u); ctx.stroke()
      ctx.restore()
    },

    // 批注面板：旁边一块装饰图表（没有标注的折线），引语点亮时折线上一个点被圈出来，一条引线连到批注面板；
    // 批注面板里是一个大引号和逐行写出的引语，出处是右下角的胶囊
    quote(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, g = 26 * u
      const [C, Q] = G.tall ? rows(G, [0.3, 0.7], g) : cols(G, [0.34, 0.66], g)
      const last = sc.by ? 1 : 0, t = s.t - s.cue(0), pc0 = boot(s, 0), litC = clamp((s.t - 0.15) / 0.4)
      panel(ctx, E, C, { p: pc0, lit: litC, col: P.calm, head: 40 * u })
      const pl = R(C.x + 24 * u, C.y + 64 * u, C.w - 48 * u, C.h - 96 * u), a = E.ease.out(clamp(s.p(0) * 1.4)), col = tone(E, curOf(s, 0, last))
      let m = null
      if (pc0 > 0) {
        ctx.save(); ctx.globalAlpha *= pc0; ctx.strokeStyle = P.grid; ctx.lineWidth = 1.2 * u; ctx.setLineDash([4 * u, 6 * u])
        for (let k = 1; k <= 3; k++) { const y = pl.y + pl.h * k / 4; ctx.beginPath(); ctx.moveTo(pl.x, y); ctx.lineTo(pl.x + pl.w, y); ctx.stroke() }
        ctx.restore()
        const pts = Array.from({ length: 16 }, (_, i) => ({ x: pl.x + pl.w * i / 15, y: pl.y + pl.h * (0.55 - 0.26 * E.noise1(i * 0.22 + E.T * 0.12, 4)) }))
        polyline(ctx, E, pts, E.ease.inOut(litC), P.calm, { area: pl.y + pl.h, width: 2.6 })
        m = pts[10]
        if (litC >= 1) for (let i = 0; i < 16; i += 3) if (i !== 9) dot(ctx, E, pts[i].x, pts[i].y, 3.5 * u, P.calm, 0)
      }
      panel(ctx, E, Q, { p: boot(s, 1), lit: litOf(s.p(0)), col, head: 46 * u })
      if (m && a > 0) {
        const an = G.tall ? { x: Q.x + 120 * u, y: Q.y } : { x: Q.x, y: Q.y + 120 * u }
        const path = G.tall ? [m, { x: m.x, y: C.y + C.h + g / 2 }, { x: an.x, y: C.y + C.h + g / 2 }, an] : [m, { x: C.x + C.w + g / 2, y: m.y }, { x: C.x + C.w + g / 2, y: an.y }, an]
        polyline(ctx, E, path, a, col, { width: 2, glow: false })
        dot(ctx, E, an.x, an.y, 5 * u, col, 0.4)
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5 * u; ctx.beginPath(); ctx.arc(m.x, m.y, (12 + 4 * pulse(E.T, 1.2)) * u * a, 0, TAU); ctx.stroke(); ctx.restore()
        dot(ctx, E, m.x, m.y, 5 * u, col, 0.6)
      }
      const pq = boot(s, 1)
      if (pq <= 0) return
      const pad = 56 * u, mk = 80 * u
      const byF = sc.by ? E.fit('— ' + sc.by, { role: 'body', weight: 500, size: 32 * u, maxW: Q.w * 0.7, maxLines: 1 }) : null
      const byH = byF ? byF.size * 1.7 + 40 * u : 0, avail = Q.h - 46 * u - mk - byH - 20 * u
      const f = E.fit(sc.text, { role: 'title', weight: 700, size: (G.tall ? 72 : 64) * u, maxW: Q.w - 2 * pad, maxLines: G.tall ? 7 : 5, maxH: avail, lineGap: 1.38 })
      ctx.save(); ctx.globalAlpha *= 0.25 + 0.75 * a; ctx.fillStyle = col; ctx.font = E.font('title', 900, 150 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText('“', Q.x + 30 * u, Q.y + 46 * u + 132 * u); ctx.restore()
      wipeLines(ctx, E, f, Q.x + pad, Q.y + 46 * u + mk + (avail - f.lines.length * f.lineH) / 2, t, { align: 'left', color: P.text, weight: 700, ga: pq, per: 0.3, gap: 0.12 })
      if (byF) {
        const ab = E.ease.out(clamp(s.p(1) * 1.4)), w = byF.width + byF.size * 1.6, h = byF.size * 1.7, bx = Q.x + Q.w - pad * 0.6 - w, by = Q.y + Q.h - 30 * u - h
        ghostBar(ctx, E, bx, by + h / 2 - 5 * u, w, 10 * u, (1 - ab) * pq)
        if (ab > 0) {
          ctx.save(); ctx.globalAlpha *= ab; ctx.translate((1 - ab) * 20 * u, 0)
          capsule(ctx, E, bx, by, w, h, P.acc)
          ctx.fillStyle = P.text; ctx.font = E.font('body', 500, byF.size); drawLines(ctx, byF.lines, bx + w / 2, by + (h - byF.lineH) / 2, byF.lineH, 'center')
          ctx.restore()
        }
      }
    },

    // 收尾：主面板被扫描光扫过、出收束的话和副标题，cta 是一块强调色的按钮；下面一排装饰面板随后一块接一块点亮，整屏在线
    end(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, G = geo(E), sc = s.scene, g = 20 * u
      const [M, B] = rows(G, G.tall ? [0.64, 0.36] : [0.7, 0.3], g)
      let tiles
      if (G.tall) { const [b1, b2] = rows(B, [1, 1], g); tiles = [...cols(b1, [1, 1], g), ...cols(b2, [1, 1], g)] } else tiles = cols(B, [1, 1, 1, 1], g)
      let i = 0
      const isub = sc.subtitle ? ++i : -1, icta = sc.cta ? ++i : -1
      const t = s.t - s.cue(0)
      tiles.forEach((r, k) => decoPanel(ctx, E, r, ['spark', 'ring', 'bars', 'matrix'][k], { p: boot(s, k + 1), lit: clamp((t - 0.3 - k * 0.16) / 0.35), seed: k + 11 }))
      const head = 46 * u, pb = boot(s, 0)
      panel(ctx, E, M, { p: pb, lit: litOf(s.p(0)), col: P.acc, head, live: true })
      if (pb <= 0) return
      sweep(ctx, E, R(M.x, M.y + head, M.w, M.h - head), (t + 0.25) / 0.9, P.acc)
      const maxW = M.w - 140 * u, cx = M.x + M.w / 2
      const big = E.fit(sc.title, { role: 'title', weight: 800, size: (G.tall ? 88 : 104) * u, maxW, maxLines: 2, lineGap: 1.18, oneLine: true })
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 500, size: (G.tall ? 40 : 42) * u, maxW: maxW * 0.9, maxLines: 2 }) : null
      const cta = sc.cta ? E.fit(sc.cta, { role: 'body', weight: 700, size: 38 * u, maxW: maxW * 0.6, maxLines: 1 }) : null
      const ch = cta ? cta.size * 2.1 : 0, hB = big.lines.length * big.lineH, hS = sub ? sub.lines.length * sub.lineH + 26 * u : 0, hC = cta ? ch + 44 * u : 0
      let y = M.y + head + (M.h - head - hB - hS - hC) / 2
      showText(ctx, E, big, cx, y, s.p(0), { role: 'title', weight: 800, color: P.text, align: 'center', ga: pb })
      y += hB
      if (sub) { y += 26 * u; showText(ctx, E, sub, cx, y, s.p(isub), { role: 'body', weight: 500, color: P.dim, align: 'center', ga: pb }); y += sub.lines.length * sub.lineH }
      if (cta) {
        y += 44 * u
        const p = s.p(icta), w = cta.width + cta.size * 2.4
        ghostBar(ctx, E, cx - w / 2, y + ch / 2 - 6 * u, w, 12 * u, (1 - clamp(p * 2)) * pb)
        if (p > 0) {
          const k = 0.85 + 0.15 * E.ease.outBack(clamp(p))
          ctx.save(); ctx.globalAlpha *= clamp(p * 2); ctx.translate(cx, y + ch / 2); ctx.scale(k, k)
          ctx.fillStyle = P.acc; E.roundRect(ctx, -w / 2, -ch / 2, w, ch, 6 * u); ctx.fill()
          brackets(ctx, E, -w / 2, -ch / 2, w, ch, { L: 14 * u, k: 7 * u, col: P.acc, glow: 0.5 + 0.5 * pulse(E.T, 0.8) })
          ctx.fillStyle = P.on; ctx.font = E.font('body', 700, cta.size); drawLines(ctx, cta.lines, 0, -cta.lineH / 2, cta.lineH, 'center')
          ctx.restore()
        }
      }
    },
  },

  caption(ctx, s, E) { setPal(E, this.c); drawCaption(ctx, s, E) },
  // 最上层：页眉（LIVE、跳动的小柱、骨架条、ONLINE、场次格、渐变细线）
  overlay(ctx, E, s) { setPal(E, this.c); header(ctx, E, s) },

  // 默认版式会调用的零件（九种版式都重画了，只在 custom 场借用时用到）：面板、渐变柱、发光圆点、带光晕的细线
  card(ctx, E, x, y, w, h, o = {}) { setPal(E, this.c); panel(ctx, E, R(x, y, w, h), { lit: 1, col: o.tone === 'accent' ? P.acc : P.calm }) },
  bar(ctx, E, x, y, w, h, o = {}) {
    const col = o.color ?? this.c.accent, g = ctx.createLinearGradient(0, y, 0, y + h)
    g.addColorStop(0, col); g.addColorStop(1, E.rgba(col, 0.3))
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) {
    const col = o.color ?? this.c.accent
    ctx.save(); ctx.fillStyle = E.rgba(col, 0.2); ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TAU); ctx.fill()
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore()
  },
  underline(ctx, E, x, y, w, p) {
    ctx.save(); ctx.fillStyle = E.rgba(this.c.accent, 0.22); ctx.fillRect(x, y - 3 * E.u, w * p, 9 * E.u)
    ctx.fillStyle = this.c.accent; ctx.fillRect(x, y, w * p, 3 * E.u); ctx.restore()
  },

  // 配乐：D 小调 i–VI–III–VII，有鼓、拨弦琶音（原样片 116 拍的合成器琶音）。音效：点亮 pop，换场 whoosh（配扫描线），计数开始 tick
  music: { style: 'drive', prog: ['Dm', 'Bb', 'F', 'C'], lead: 'pluck', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'tick' },
  // 片头标题、片尾那句话落下各一声钟；KPI 数字落定一声闷响；图表的高亮柱长出来一声轻钟
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const sc = S.scene, at = k => S.t0 + S.cues[Math.min(k, S.cues.length - 1)]
      if (S.layout === 'title') out.push({ t: at(sc.kicker ? 1 : 0), kind: 'chime', gain: 0.24 })
      if (S.layout === 'end') out.push({ t: at(0), kind: 'chime', gain: 0.24 })
      if (S.layout === 'number') out.push({ t: at(0) + Math.min(1.4, S.dur * 0.35), kind: 'thud', gain: 0.36 })
      if (S.layout === 'bars') { const v = sc.items.map(it => Number(it.value)), hi = sc.highlight != null ? sc.highlight - 1 : v.indexOf(Math.max(...v)); out.push({ t: at(hi + 1) + 0.1, kind: 'chime', gain: 0.18 }) }
    }
    return out
  },
}
