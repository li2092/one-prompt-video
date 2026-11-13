// 风格包：新闻播报（news）。电视新闻演播室：深蓝渐变底、LED 墙、缓慢转动的线框地球、斜向光带；
// 外框是左上角的 LIVE 角标、下三分之一的「快讯」标题条、底部的滚动字幕条；换场是一道蓝白红光带擦过去。
// 九种版式各是一种镜头：节目片头、过肩机位、要点板、全屏数字快讯、数据大屏、事件经过、分屏连线、采访同期声、演播室全景。
// 画法库移植自风格库的 T-新闻播报，见 lib/ 和 NOTES.md。标题条、滚动条里的字只来自这一场的 s.scene。
import { P, setPal, text, glowText, measure, pop, rise, wipe, panel, softShadow, tag, chipLabel, pip, globe, anchor, desk, rollNum, beam, arrowHead } from './lib/news.mjs'
import { frame, studioBg, drawBug, headFit, drawHeadline, drawTicker, drawCap, bandWipe } from './lib/chrome.mjs'
import { formatNumber, decimalsOf, drawLines } from '../../core.mjs'

const TAU = Math.PI * 2

// 下三分之一标题条写哪一段字、跟着第几个元素翻出来；mode 为 name 时是采访人名条
function headOf(sc, layout) {
  switch (layout) {
    case 'title': return sc.subtitle ? { text: sc.subtitle, i: sc.kicker ? 2 : 1 } : sc.kicker ? { text: sc.kicker, i: 0 } : null
    case 'number': return sc.label ? { text: sc.label, i: 1 } : null
    case 'quote': return sc.by ? { text: sc.by, i: 1, mode: 'name' } : null
    case 'end': return sc.subtitle ? { text: sc.subtitle, i: 1 } : null
    case 'statement': case 'custom': return null
    default: return sc.title ? { text: sc.title, i: 0 } : null
  }
}
// 滚动条：这一场自己的几段字，按顺序循环滚动
function tickOf(sc, layout) {
  const L = [], add = t => { if (t) L.push(String(t)) }
  switch (layout) {
    case 'title': add(sc.title); add(sc.subtitle); add(sc.kicker); break
    case 'statement': add(sc.text); break
    case 'bullets': add(sc.title); sc.items.forEach(add); break
    case 'steps': add(sc.title); sc.items.forEach((it, k) => add(`${k + 1}  ${it}`)); break
    case 'bars': add(sc.title); sc.items.forEach(it => add(`${it.label}  ${formatNumber(it.value, decimalsOf(it.value))}${sc.unit || ''}`)); break
    case 'number': add(String(sc.value) + (sc.unit || '')); add(sc.label); add(sc.note); break
    case 'compare': add(sc.title); [sc.left, sc.right].forEach(d => { add(d.title); (d.items || []).forEach(add) }); break
    case 'quote': add('“' + sc.text + '”' + (sc.by ? '  ' + sc.by : '')); break
    case 'end': add(sc.title); add(sc.subtitle); add(sc.cta); break
  }
  return L
}
// 城市天际线剪影（分屏连线窗口的底部，像远端现场的画面），亮着几盏灯
function skyline(ctx, E, x, y, w, h, seed, col) {
  const u = E.u, r = E.rng(seed)
  for (let xx = x; xx < x + w;) {
    const bw = (34 + r() * 70) * u, bh = h * (0.3 + r() * 0.7)
    ctx.fillStyle = E.rgba(P.bg0, 0.5); ctx.fillRect(xx, y - bh, bw - 5 * u, bh)
    for (let k = 0; k < 4; k++) {
      const wx = xx + (6 + r() * (bw / u - 22)) * u, wy = y - bh + (8 + r() * (bh / u - 16)) * u
      if (r() < 0.5 && E.hash(Math.floor(E.T * 0.7 + k), Math.floor(wx)) < 0.85) { ctx.fillStyle = E.rgba(col, 0.55); ctx.fillRect(wx, wy, 6 * u, 8 * u) }
    }
    xx += bw
  }
}
// 几段字用同一个字号（取各自能放下的最小字号）
function fitAll(E, texts, opts) {
  const size = Math.min(...texts.map((t, i) => E.fit(t, opts[i]).size))
  return texts.map((t, i) => E.fit(t, { ...opts[i], size }))
}
// 还没轮到的格子：虚线占位
function ghost(ctx, E, x, y, w, h, r) {
  ctx.save(); ctx.strokeStyle = E.rgba(P.ice, 0.22); ctx.lineWidth = 2 * E.u; ctx.setLineDash([10 * E.u, 8 * E.u])
  E.roundRect(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore()
}
// 入场后扫过卡片的一道光（k 从 0 走到 1）
function sweep(ctx, E, x, y, w, h, k) {
  if (k <= 0 || k >= 1) return
  const sx = x + w * E.lerp(-0.2, 1.2, k), g = ctx.createLinearGradient(sx - 90 * E.u, 0, sx + 90 * E.u, 0)
  g.addColorStop(0, E.rgba(P.white, 0)); g.addColorStop(0.5, E.rgba(P.white, 0.5)); g.addColorStop(1, E.rgba(P.white, 0))
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); ctx.restore()
}
// 大屏：场一开始从下方浮上来，一道光扫过
function board(ctx, s, E, R, o = {}) {
  const pin = rise(E, s.t, -0.15, 0.45, 30)
  ctx.save(); ctx.globalAlpha *= pin.a; ctx.translate(0, pin.dy)
  panel(ctx, E, R.x, R.y, R.w, R.h, { sheen: (s.t - 0.2) / 1.4, ...o })
  ctx.restore()
}
// 前景地球：光晕、线框，可加两道轨道环
function bigGlobe(ctx, E, x, y, R, k, rings) {
  const halo = ctx.createRadialGradient(x, y, R * 0.1, x, y, R * 1.5)
  halo.addColorStop(0, E.rgba(P.blue, 0.3 * k)); halo.addColorStop(1, E.rgba(P.blue, 0))
  ctx.fillStyle = halo; ctx.fillRect(0, 0, E.W, E.H)
  globe(ctx, E, x, y, R * (0.84 + 0.16 * k), E.T * 0.22, { alpha: 0.4 * k, lw: 1.8, meridians: 16, parallels: 9, seg: 48 })
  for (let j = 0; rings && j < 2; j++) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((j ? -0.3 : 0.22) + Math.sin(E.T * 0.3 + j) * 0.05)
    ctx.strokeStyle = E.rgba(j ? P.gold : P.cyan, 0.45 * k); ctx.lineWidth = 2 * E.u
    ctx.setLineDash([R * 0.08, R * 0.04]); ctx.lineDashOffset = E.T * 60 * E.u * (j ? 1 : -1)
    ctx.beginPath(); ctx.ellipse(0, 0, R * (1.2 + j * 0.12), R * (0.27 + j * 0.06), 0, 0, TAU); ctx.stroke(); ctx.restore()
  }
}
// 一句话按行居中画，highlight 那一截用金色发光（高亮词可能被折到两行：按它在整句里的位置逐行切）
function hlLines(ctx, E, f, hl, cx, y0) {
  const u = E.u, h = hl ? String(hl) : '', hs = h ? f.lines.join('').indexOf(h) : -1
  ctx.font = E.font('title', 900, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
  let off = 0
  f.lines.forEach((ln, k) => {
    const y = y0 + k * f.lineH + f.lineH / 2
    let x = cx - ctx.measureText(ln).width / 2
    const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + h.length - off)
    off += ln.length
    const segs = hs < 0 || a1 <= a0 ? [[ln, false]] : [[ln.slice(0, a0), false], [ln.slice(a0, a1), true], [ln.slice(a1), false]]
    for (const [str, on] of segs) {
      if (!str) continue
      const w = ctx.measureText(str).width
      if (on) { ctx.fillStyle = E.rgba(P.gold, 0.18); ctx.fillRect(x - 6 * u, y + f.size * 0.22, w + 12 * u, f.size * 0.3); glowText(ctx, str, x, y, 26 * u, P.gold) }
      ctx.fillStyle = on ? P.gold : P.white; ctx.fillText(str, x, y)
      x += w
    }
  })
}

export default {
  name: '新闻播报', mood: '演播室、标题条、滚动字幕条，快讯、周报、要点速递', bpm: 100,
  c: { bg: '#061a44', fg: '#ffffff', muted: '#9fb6dd', accent: '#e0213a', accent2: '#ffc845', card: '#1f6fff', line: '#5fd4ff', onAccent: '#ffffff' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 900, wBody: 700, radius: 10,
  motion: 'rise', solidAccent: true,
  transitionDur: 0.6,
  transition(ctx, A, B, p, E) { setPal(E, this.c); bandWipe(ctx, A, B, p, E) },

  // title、number 自己在前景画大地球，end 的大屏里有地球，背景里就不再画那颗
  bg(ctx, E, s) { setPal(E, this.c); studioBg(ctx, E, { globe: !['title', 'number', 'end'].includes(s.layout) }) },

  layouts: {
    // 节目片头：前景一颗大地球带两道轨道环；节目名横幅从左刷出，下沿一道红线；kicker 是横幅上方的红标签，副标题进下三分之一标题条
    title(ctx, s, E) {
      setPal(E, this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = frame(E).B
      const onPlate = !!(sc.kicker && sc.subtitle), pt = s.p(sc.kicker ? 1 : 0)
      const gx = W / 2, gy = B.y + B.h * (por ? 0.42 : 0.47), R = por ? B.w * 0.48 : B.h * 0.58
      bigGlobe(ctx, E, gx, gy, R, E.ease.out(E.clamp(s.t / 1.4)), true)
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: (por ? 112 : 132) * u, maxW: W - (por ? 150 : 320) * u, maxLines: por ? 3 : 2, lineGap: 1.16, oneLine: true })
      const th = big.lines.length * big.lineH, ph = th + (por ? 76 : 84) * u, py = gy - ph / 2
      wipe(ctx, E, 0, py, W, ph, E.ease.out(E.clamp(pt * 1.3)), () => {
        const g = ctx.createLinearGradient(0, py, 0, py + ph)
        g.addColorStop(0, E.rgba(P.blue2, 0.93)); g.addColorStop(1, E.rgba(E.mix(P.blue, P.bg1, 0.45), 0.95))
        ctx.fillStyle = g; ctx.fillRect(0, py, W, ph)
        const sx = ((s.t * 0.32) % 1.5 - 0.25) * W, sg = ctx.createLinearGradient(sx - 220 * u, 0, sx + 220 * u, 0)
        sg.addColorStop(0, E.rgba(P.white, 0)); sg.addColorStop(0.5, E.rgba(P.white, 0.16)); sg.addColorStop(1, E.rgba(P.white, 0))
        ctx.fillStyle = sg; ctx.fillRect(0, py, W, ph)
        ctx.fillStyle = E.rgba(P.white, 0.8); ctx.fillRect(0, py, W, 3 * u)
        ctx.fillStyle = P.red; ctx.fillRect(0, py + ph - 7 * u, W, 7 * u)
        ctx.font = E.font('title', 900, big.size)
        ctx.fillStyle = E.rgba(P.bg0, 0.4); drawLines(ctx, big.lines, W / 2, py + (ph - th) / 2 + 2 * u, big.lineH, 'center')
        ctx.fillStyle = P.white; drawLines(ctx, big.lines, W / 2, py + (ph - th) / 2 - 3 * u, big.lineH, 'center')
      })
      if (onPlate) {
        const q = pop(E, s.t, s.cue(0), 0.35)
        if (q.a > 0) {
          const f = E.fit(sc.kicker, { role: 'title', weight: 900, size: 40 * u, maxW: W * 0.7, maxLines: 1 }), w = f.width + f.size * 1.1
          ctx.save(); ctx.globalAlpha *= q.a; ctx.translate(W / 2, py - f.size * 1.2); ctx.scale(q.s, q.s)
          tag(ctx, E, f.lines[0], -w / 2, 0, { fs: f.size, w })
          ctx.restore()
        }
      }
    },

    // 过肩机位：大屏占画面大半，那句话从左刷出，高亮词金色发光；前景是一个被画面切掉的主播背影
    statement(ctx, s, E) {
      setPal(E, this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = frame(E).B
      const S = por ? { x: B.x, y: B.y, w: B.w, h: B.h * 0.64 } : { x: B.x, y: B.y, w: B.w * 0.7, h: B.h }
      board(ctx, s, E, S)
      const p = s.p(0)
      ctx.save(); ctx.beginPath(); ctx.rect(S.x, S.y, S.w, S.h); ctx.clip()
      globe(ctx, E, S.x + S.w / 2, S.y + S.h / 2, Math.min(S.w, S.h) * 0.4, E.T * 0.5, { alpha: (0.18 + 0.3 * (1 - E.clamp(p * 2))) * E.clamp(s.t / 0.3), lw: 1.5 })
      ctx.restore()
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: (por ? 88 : 92) * u, maxW: S.w - (por ? 90 : 140) * u, maxLines: por ? 5 : 4, maxH: S.h - 110 * u, lineGap: 1.3 })
      const hT = f.lines.length * f.lineH, y0 = S.y + (S.h - hT) / 2
      wipe(ctx, E, S.x, y0 - 24 * u, S.w, hT + 48 * u, E.ease.out(p), () => hlLines(ctx, E, f, sc.highlight, S.x + S.w / 2, y0))
      const as = (por ? 300 : 410) * u
      const ax = por ? W * 0.5 : S.x + S.w + (W - S.x - S.w) * 0.56, ay = por ? B.y + B.h + 150 * u : B.y + B.h + 230 * u
      anchor(ctx, E, ax, ay, as, E.T, { talk: 0.5 })
    },

    // 要点板：大屏上一条一张浅色卡，左边红色编号块，从下方浮上来并扫过一道光；没轮到的是虚线占位
    bullets(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, por = E.portrait, sc = s.scene, n = sc.items.length, B = frame(E).B
      board(ctx, s, E, B)
      const pad = (por ? 34 : 44) * u, gap = (por ? 22 : 26) * u
      const cols = !por && n >= 4 ? 2 : 1, rows = Math.ceil(n / cols), iw = B.w - pad * 2, ih = B.h - pad * 2
      const cw = (iw - gap * (cols - 1)) / cols, ch = Math.min((ih - gap * (rows - 1)) / rows, (por ? 200 : 210) * u)
      const y0 = B.y + pad + (ih - ch * rows - gap * (rows - 1)) / 2
      const nb = Math.min(ch * 0.56, 76 * u), nw = nb * 1.45, tx = 28 * u + nw + 30 * u
      const opt = { role: 'title', weight: 900, size: Math.min((por ? 50 : 58) * u, ch * 0.38), maxW: cw - tx - 30 * u, maxLines: 2, maxH: ch * 0.84, lineGap: 1.22 }
      const FS = fitAll(E, sc.items, sc.items.map(() => opt))
      sc.items.forEach((it, i) => {
        const odd = cols === 2 && i === n - 1 && n % 2
        const x = odd ? B.x + pad + (iw - cw) / 2 : B.x + pad + (i % cols) * (cw + gap), y = y0 + Math.floor(i / cols) * (ch + gap)
        ghost(ctx, E, x, y, cw, ch, 12 * u)
        const r = rise(E, s.t, s.cue(i + 1), 0.45, 56)
        if (r.a <= 0) return
        ctx.save(); ctx.globalAlpha *= r.a; ctx.translate(0, r.dy)
        softShadow(ctx, E, x, y, cw, ch, 12 * u, 0.6)
        ctx.fillStyle = P.ice; E.roundRect(ctx, x, y, cw, ch, 12 * u); ctx.fill()
        ctx.fillStyle = P.red; E.roundRect(ctx, x + 28 * u, y + (ch - nb) / 2, nw, nb, 6 * u); ctx.fill()
        text(ctx, String(i + 1).padStart(2, '0'), x + 28 * u + nw / 2, y + ch / 2 + 2 * u, { font: E.font('num', 900, nb * 0.56), align: 'center', color: P.on })
        const f = FS[i]
        ctx.fillStyle = P.ink; ctx.font = E.font('title', 900, f.size); drawLines(ctx, f.lines, x + tx, y + (ch - f.lines.length * f.lineH) / 2, f.lineH, 'left')
        sweep(ctx, E, x, y, cw, ch, (s.t - s.cue(i + 1)) / 0.7)
        ctx.restore()
      })
    },

    // 全屏数字快讯：不套大屏，地球推到前景；数字逐位翻牌落定，金色发光，两侧各一道光线拉开；note 是数字下面的胶囊条，label 进标题条
    number(ctx, s, E) {
      setPal(E, this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = frame(E).B
      const inote = sc.note ? (sc.label ? 2 : 1) : -1
      const cx = W / 2, cy = B.y + B.h * (sc.note ? 0.45 : 0.5)
      bigGlobe(ctx, E, cx, cy, por ? B.w * 0.5 : B.h * 0.6, E.ease.out(E.clamp(s.t / 1.2)), false)
      const str = String(sc.value), size = (por ? 250 : 300) * u
      const uw0 = sc.unit ? measure(ctx, sc.unit, E.font('title', 900, size * 0.3)) + 24 * u : 0
      const f = E.fit(str, { role: 'num', weight: 900, size, maxW: B.w * 0.86 - uw0, maxLines: 1, minSize: size * 0.3, lineGap: 1 })
      const font = E.font('num', 900, f.size), wN = measure(ctx, str, font), ufont = E.font('title', 900, f.size * 0.3)
      const uw = sc.unit ? measure(ctx, sc.unit, ufont) + 24 * u : 0, x0 = cx - (wN + uw) / 2
      const q = pop(E, s.t, s.cue(0), 0.4), roll = E.clamp((s.t - s.cue(0)) / Math.min(1.4, s.dur * 0.35))
      const lp = E.ease.out(E.clamp((s.t - s.cue(0) - 0.15) / 0.6))
      for (const dir of [-1, 1]) {
        const xa = cx + dir * ((wN + uw) / 2 + 44 * u), xb = dir < 0 ? B.x : B.x + B.w
        if (lp <= 0 || dir * (xb - xa) <= 0) continue
        ctx.save(); ctx.globalAlpha *= 0.85; beam(ctx, E, xa, cy, xb, cy, lp, P.cyan, 2.5); ctx.restore()
        ctx.fillStyle = P.gold; ctx.fillRect(xa - 3 * u, cy - 14 * u, 6 * u, 28 * u)
      }
      if (q.a > 0) {
        const k = 1 + 0.35 * (1 - E.ease.out(q.k))
        ctx.save(); ctx.globalAlpha *= q.a; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy)
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, (wN + uw) * 0.6)
        halo.addColorStop(0, E.rgba(P.gold, 0.22)); halo.addColorStop(1, E.rgba(P.gold, 0))
        ctx.fillStyle = halo; ctx.fillRect(cx - (wN + uw), cy - f.size, (wN + uw) * 2, f.size * 2)
        rollNum(ctx, E, str, x0, cy, font, roll, { color: P.gold, glow: 30 * u, glowCol: P.gold })
        if (sc.unit) text(ctx, sc.unit, x0 + wN + 24 * u, cy + f.size * 0.2, { font: ufont, color: P.white })
        ctx.restore()
      }
      if (inote >= 0) {
        const nf = E.fit(sc.note, { role: 'body', weight: 700, size: (por ? 36 : 38) * u, maxW: B.w * 0.78, maxLines: 1 })
        const r = rise(E, s.t, s.cue(inote), 0.4, 26)
        if (r.a > 0) chipLabel(ctx, E, nf, cx, cy + f.size * 0.6 + nf.size * 1.3 + r.dy, { alpha: r.a })
      }
    },

    // 数据大屏：横屏竖柱、竖屏横条；柱子是带 LED 细纹的渐变，最高（或指定）的一根金色发光，数值随柱子滚上去
    bars(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, por = E.portrait, sc = s.scene, n = sc.items.length, B = frame(E).B
      board(ctx, s, E, B)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || '', pad = (por ? 40 : 54) * u
      const fill = (x, y, w, h, i, horiz) => {
        if (w <= 0.5 || h <= 0.5) return
        const col = i === hi ? P.gold : P.blue2, g = horiz ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y + h, 0, y)
        g.addColorStop(0, E.mix(col, P.bg1, 0.5)); g.addColorStop(1, col)
        ctx.save()
        if (i === hi) for (const [d, a] of [[18, 0.08], [9, 0.16]]) { E.roundRect(ctx, x - d * u, y - d * u, w + 2 * d * u, h + 2 * d * u, (6 + d) * u); ctx.fillStyle = E.rgba(P.gold, a); ctx.fill() }
        ctx.fillStyle = g; E.roundRect(ctx, x, y, w, h, 6 * u); ctx.fill()
        E.roundRect(ctx, x, y, w, h, 6 * u); ctx.clip()
        ctx.fillStyle = E.rgba(P.bg0, 0.22)
        if (horiz) for (let xx = x + 10 * u; xx < x + w; xx += 12 * u) ctx.fillRect(xx, y, 3 * u, h)
        else for (let yy = y + h - 10 * u; yy > y; yy -= 12 * u) ctx.fillRect(x, yy, w, 3 * u)
        ctx.fillStyle = E.rgba(P.white, 0.85)
        if (horiz) ctx.fillRect(x + w - 4 * u, y, 4 * u, h); else ctx.fillRect(x, y, w, 4 * u)
        ctx.restore()
      }
      const lab = (it, i, size, maxW, maxLines, maxH) => E.fit(it.label, { role: 'body', weight: 700, size, maxW, maxLines, maxH, lineGap: 1.2 })
      if (!por) {
        const labH = 92 * u, x0 = B.x + pad, iw = B.w - pad * 2, base = B.y + B.h - pad - labH, top = B.y + pad + 80 * u, hMax = base - top
        const slot = iw / n, bw = Math.min(slot * 0.5, 160 * u)
        ctx.save(); ctx.strokeStyle = E.rgba(P.ice, 0.1); ctx.lineWidth = 1.5 * u; ctx.setLineDash([8 * u, 8 * u])
        for (let k = 1; k <= 4; k++) { const y = base - hMax * k / 4; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + iw, y); ctx.stroke() }
        ctx.restore()
        beam(ctx, E, x0, base, x0 + iw, base, E.ease.out(E.clamp(s.t / 0.6)), P.cyan, 3)
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), q = E.ease.outExpo(p), h = hMax * vals[i] / max * q, x = x0 + slot * i + (slot - bw) / 2
          ctx.fillStyle = E.rgba(P.blue2, 0.06); ctx.fillRect(x, top, bw, hMax)
          fill(x, base - h, bw, h, i, false)
          if (p <= 0) return
          const a = E.clamp(p * 2), lf = lab(it, i, 34 * u, slot * 0.92, 2, labH - 18 * u)
          text(ctx, formatNumber(vals[i] * q, dec) + unit, x + bw / 2, base - h - 34 * u, { font: E.font('num', 900, 46 * u), align: 'center', color: i === hi ? P.gold : P.white, alpha: a, glow: i === hi ? 18 * u : 0, glowCol: P.gold })
          ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = i === hi ? P.gold : P.ice; ctx.font = E.font('body', 700, lf.size); drawLines(ctx, lf.lines, x + bw / 2, base + 16 * u, lf.lineH, 'center'); ctx.restore()
        })
      } else {
        const avail = B.h - pad * 2, rowH = Math.min(avail / n, 240 * u), y0 = B.y + pad + (avail - rowH * n) / 2, valW = 200 * u, x0 = B.x + pad, wMax = B.w - pad * 2 - valW
        beam(ctx, E, x0, y0, x0, y0 + rowH * n, E.ease.out(E.clamp(s.t / 0.6)), P.cyan, 3)
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), q = E.ease.outExpo(p), y = y0 + rowH * i, bh = rowH * 0.34, by = y + rowH * 0.52, w = wMax * vals[i] / max * q
          ctx.fillStyle = E.rgba(P.blue2, 0.06); ctx.fillRect(x0, by, wMax, bh)
          fill(x0, by, w, bh, i, true)
          if (p <= 0) return
          const a = E.clamp(p * 2), lf = lab(it, i, 38 * u, B.w - pad * 2 - 20 * u, 1)
          ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = i === hi ? P.gold : P.ice; ctx.font = E.font('body', 700, lf.size); drawLines(ctx, lf.lines, x0 + 18 * u, y + rowH * 0.06, lf.lineH, 'left'); ctx.restore()
          text(ctx, formatNumber(vals[i] * q, dec) + unit, x0 + w + 20 * u, by + bh / 2, { font: E.font('num', 900, 44 * u), color: i === hi ? P.gold : P.white, alpha: a, glow: i === hi ? 16 * u : 0, glowCol: P.gold })
        })
      }
    },

    // 事件经过：一条轨道上几个节点依次点亮（光束沿轨道走过去，当前节点金色、外扩一圈），每个节点下面挂一张深色卡
    steps(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, por = E.portrait, sc = s.scene, n = sc.items.length, B = frame(E).B
      board(ctx, s, E, B)
      const pad = (por ? 36 : 50) * u, r = 36 * u
      let lit = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0.4) lit = i
      const node = (x, y, i) => {
        const on = s.p(i + 1) > 0.4, cur = i === lit
        ctx.save()
        if (on) for (const [d, a] of [[16, 0.1], [8, 0.2]]) { ctx.fillStyle = E.rgba(cur ? P.gold : P.cyan, a); ctx.beginPath(); ctx.arc(x, y, r + d * u, 0, TAU); ctx.fill() }
        ctx.fillStyle = on ? (cur ? P.gold : P.blue) : P.bg1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
        ctx.lineWidth = 3 * u; ctx.strokeStyle = on ? P.white : E.rgba(P.ice, 0.35); ctx.stroke()
        text(ctx, String(i + 1), x, y + 2 * u, { font: E.font('num', 900, r), align: 'center', color: on ? (cur ? P.ink : P.white) : E.rgba(P.ice, 0.5) })
        if (cur) { const k = ((s.t - s.cue(i + 1)) % 1.2) / 1.2; ctx.globalAlpha *= 1 - k; ctx.strokeStyle = P.gold; ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.8 * k), 0, TAU); ctx.stroke() }
        ctx.restore()
      }
      // 卡片位置：横屏挂在节点下面一排，竖屏在左侧竖轨道的右边一列
      let xs, ys, cw, ch, cx0
      if (!por) {
        const slot = (B.w - pad * 2) / n
        cw = slot - 44 * u; ch = Math.min(B.h - pad * 2 - r * 2 - 50 * u, 250 * u)
        const ty = B.y + (B.h - r * 2 - 50 * u - ch) / 2 + r
        xs = sc.items.map((_, i) => B.x + pad + slot * (i + 0.5)); ys = xs.map(() => ty)
      } else {
        const gap = 24 * u
        ch = Math.min((B.h - pad * 2 - gap * (n - 1)) / n, 220 * u)
        const y0 = B.y + (B.h - ch * n - gap * (n - 1)) / 2, tx = B.x + pad + r
        ys = sc.items.map((_, i) => y0 + i * (ch + gap) + ch / 2); xs = ys.map(() => tx)
        cx0 = tx + r + 40 * u; cw = B.x + B.w - pad - cx0
      }
      ctx.save(); ctx.strokeStyle = E.rgba(P.ice, 0.18); ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(xs[0], ys[0]); ctx.lineTo(xs[n - 1], ys[n - 1]); ctx.stroke(); ctx.restore()
      for (let i = 1; i < n; i++) beam(ctx, E, xs[i - 1], ys[i - 1], xs[i], ys[i], E.ease.out(E.clamp(s.p(i + 1) * 2.2)), P.cyan, 4)
      const opt = { role: 'title', weight: 800, size: (por ? 46 : 50) * u, maxW: cw - 44 * u, maxLines: por ? 2 : 3, maxH: ch - 40 * u, lineGap: 1.24 }
      const FS = fitAll(E, sc.items, sc.items.map(() => opt))
      sc.items.forEach((it, i) => {
        const x = por ? cx0 : xs[i] - cw / 2, y = por ? ys[i] - ch / 2 : ys[i] + r + 50 * u, cur = i === lit, f = FS[i]
        ghost(ctx, E, x, y, cw, ch, 10 * u)
        const rr = rise(E, s.t, s.cue(i + 1) + 0.1, 0.45, 50)
        if (rr.a > 0) {
          ctx.save(); ctx.globalAlpha *= rr.a; ctx.translate(0, rr.dy)
          ctx.strokeStyle = E.rgba(cur ? P.gold : P.cyan, 0.8); ctx.lineWidth = 2.5 * u; ctx.beginPath()
          if (por) { ctx.moveTo(xs[i] + r, ys[i]); ctx.lineTo(x, ys[i]) } else { ctx.moveTo(xs[i], ys[i] + r); ctx.lineTo(xs[i], y) }
          ctx.stroke()
          panel(ctx, E, x, y, cw, ch, { corner: 16 * u, border: cur ? P.gold : E.rgba(P.blue2, 0.6), cornerCol: cur ? P.gold : P.cyan, shadow: false })
          ctx.fillStyle = P.white; ctx.font = E.font('title', 800, f.size)
          drawLines(ctx, f.lines, por ? x + 30 * u : x + cw / 2, y + (ch - f.lines.length * f.lineH) / 2, f.lineH, por ? 'left' : 'center')
          ctx.restore()
        }
        node(xs[i], ys[i], i)
      })
    },

    // 分屏连线：两个画中画窗口，窗口上沿各挂一块标题牌（右边推荐的一方用红牌、带闪烁红点）；两窗之间一道光束，光点来回走，中间一个双向箭头圆标
    compare(ctx, s, E) {
      setPal(E, this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = frame(E).B
      const labH = 62 * u, gap = (por ? 90 : 130) * u, pad = 36 * u
      const A0 = por ? { x: B.x, y: B.y + labH, w: B.w, h: (B.h - gap - labH * 2) / 2 } : { x: B.x, y: B.y + labH, w: (B.w - gap) / 2, h: B.h - labH }
      const R = [A0, por ? { ...A0, y: A0.y + A0.h + gap + labH } : { ...A0, x: B.x + (B.w + gap) / 2 }], sides = [sc.left, sc.right]
      // 竖屏的窗口矮而宽：三四条时排成两列
      const colsOf = d => (por && (d.items || []).length > 2 ? 2 : 1)
      const rowsOf = (d, i) => Math.min((R[i].h - pad * 2) / Math.max(1, Math.ceil((d.items || []).length / colsOf(d))), 150 * u)
      const all = [], opts = []
      sides.forEach((d, i) => (d.items || []).forEach(it => { all.push(it); opts.push({ role: 'body', weight: 800, size: Math.min(50 * u, rowsOf(d, i) * 0.4), maxW: (R[i].w - pad * 2) / colsOf(d) - 50 * u, maxLines: 2, maxH: rowsOf(d, i) * 0.9, lineGap: 1.2 }) }))
      const FS = all.length ? fitAll(E, all, opts) : []
      let k0 = 0
      sides.forEach((d, i) => {
        const Q = R[i], strong = i === 1, items = d.items || [], rowH = rowsOf(d, i), fs = FS.slice(k0, k0 + items.length), cols = colsOf(d), colW = (Q.w - pad * 2) / cols
        k0 += items.length
        if (s.p(i + 1) < 1) ghost(ctx, E, Q.x, Q.y - labH, Q.w, Q.h + labH, 0)
        const rr = rise(E, s.t, s.cue(i + 1), 0.45, 50)
        if (rr.a <= 0) return
        ctx.save(); ctx.globalAlpha *= rr.a; ctx.translate(0, rr.dy)
        pip(ctx, E, Q.x, Q.y, Q.w, Q.h, { dot: strong, border: strong ? P.red2 : E.rgba(P.white, 0.85) }, () => {
          skyline(ctx, E, Q.x, Q.y + Q.h, Q.w, Q.h * 0.3, 7 + i * 5, strong ? P.gold : P.cyan)
          const y0 = Q.y + (Q.h - rowH * Math.ceil(items.length / cols)) / 2
          fs.forEach((f, k) => {
            const cy = y0 + rowH * Math.floor(k / cols) + rowH / 2, x = Q.x + pad + colW * (k % cols), q = E.clamp((s.t - s.cue(i + 1) - 0.12 - k * 0.1) / 0.3)
            ctx.save(); ctx.globalAlpha *= q
            ctx.fillStyle = strong ? P.gold : P.cyan; ctx.fillRect(x, cy - 7 * u, 14 * u, 14 * u)
            ctx.fillStyle = P.white; ctx.font = E.font('body', 800, f.size); drawLines(ctx, f.lines, x + 38 * u, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
            ctx.restore()
          })
        })
        const tf = E.fit(d.title, { role: 'title', weight: 900, size: 40 * u, maxW: Q.w - 60 * u, maxLines: 1 }), tw = tf.width + tf.size * 1.2
        ctx.fillStyle = strong ? P.red : P.blue; ctx.fillRect(Q.x, Q.y - labH, tw, labH)
        text(ctx, tf.lines[0], Q.x + tw / 2, Q.y - labH / 2 + 2 * u, { font: E.font('title', 900, tf.size), color: P.white, align: 'center' })
        ctx.restore()
      })
      const lp = E.clamp((s.p(2) - 0.3) / 0.7)
      if (lp > 0) {
        const [a, b] = R, x1 = por ? W / 2 : a.x + a.w, y1 = por ? a.y + a.h : a.y + a.h / 2, x2 = por ? W / 2 : b.x, y2 = por ? b.y - labH : b.y + b.h / 2
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, cr = (por ? 34 : 40) * u
        beam(ctx, E, mx, my, x1, y1, lp, P.cyan, 3); beam(ctx, E, mx, my, x2, y2, lp, P.cyan, 3)
        for (let j = 0; j < 2; j++) {
          const k = ((s.t * 0.8 + j * 0.5) % 1), px = E.lerp(x1, x2, k), py = E.lerp(y1, y2, k)
          ctx.save(); ctx.globalAlpha *= lp; ctx.fillStyle = P.white; ctx.shadowColor = P.cyan; ctx.shadowBlur = 12 * u; ctx.beginPath(); ctx.arc(px, py, 5 * u, 0, TAU); ctx.fill(); ctx.restore()
        }
        const q = pop(E, s.t, s.cue(2) + 0.2, 0.35)
        if (q.a > 0) {
          ctx.save(); ctx.globalAlpha *= q.a; ctx.translate(mx, my); ctx.scale(q.s, q.s); if (por) ctx.rotate(Math.PI / 2)
          ctx.fillStyle = P.bg1; ctx.strokeStyle = P.cyan; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(0, 0, cr, 0, TAU); ctx.fill(); ctx.stroke()
          ctx.strokeStyle = P.white; ctx.lineWidth = 4 * u; ctx.beginPath(); ctx.moveTo(-cr * 0.45, -cr * 0.22); ctx.lineTo(cr * 0.4, -cr * 0.22); ctx.moveTo(cr * 0.45, cr * 0.22); ctx.lineTo(-cr * 0.4, cr * 0.22); ctx.stroke()
          arrowHead(ctx, E, cr * 0.5, -cr * 0.22, 0, 10 * u, P.white); arrowHead(ctx, E, -cr * 0.5, cr * 0.22, Math.PI, 10 * u, P.white)
          ctx.restore()
        }
      }
    },

    // 采访同期声：一个画中画是采访镜头（虚化的灯光、金色轮廓光的人物剪影），引语是带大引号的同期声字幕条，从左刷出；出处进人名条
    quote(ctx, s, E) {
      setPal(E, this.c)
      const u = E.u, por = E.portrait, sc = s.scene, B = frame(E).B
      const C = por ? { x: B.x, y: B.y, w: B.w, h: B.h * 0.44 } : { x: B.x, y: B.y, w: B.w * 0.4, h: B.h }
      const Q = por ? { x: B.x, y: B.y + B.h * 0.49, w: B.w, h: B.h * 0.51 } : { x: B.x + B.w * 0.44, y: B.y, w: B.w * 0.56, h: B.h }
      const cin = rise(E, s.t, -0.15, 0.45, 30)
      ctx.save(); ctx.globalAlpha *= cin.a; ctx.translate(0, cin.dy)
      pip(ctx, E, C.x, C.y, C.w, C.h, { dot: true }, () => {
        for (let k = 0; k < 14; k++) {
          const bx = C.x + E.hash(k, 3) * C.w, by = C.y + E.hash(k, 4) * C.h * 0.75, br = (30 + E.hash(k, 5) * 70) * u
          const g = ctx.createRadialGradient(bx, by, 0, bx, by, br), col = [P.cyan, P.blue2, P.gold][k % 3]
          g.addColorStop(0, E.rgba(col, 0.2 * (0.6 + 0.4 * Math.sin(E.T * 0.8 + k)))); g.addColorStop(1, E.rgba(col, 0))
          ctx.fillStyle = g; ctx.fillRect(bx - br, by - br, br * 2, br * 2)
        }
        const as = por ? C.h * 0.5 : C.h * 0.42
        anchor(ctx, E, C.x + C.w * 0.5, C.y + C.h - 16 * u, as, E.T + 3, { rim: P.gold, talk: 0.8 })
      })
      ctx.restore()
      const p = s.p(0), padQ = (por ? 44 : 54) * u, mk = (por ? 120 : 150) * u
      const f = E.fit(sc.text, { role: 'title', weight: 800, size: (por ? 62 : 66) * u, maxW: Q.w - padQ * 2, maxLines: 5, maxH: Q.h - padQ * 2 - mk * 0.4, lineGap: 1.36 })
      const hT = f.lines.length * f.lineH, bh = Math.min(Q.h, hT + padQ * 2 + mk * 0.4), by = Q.y + (Q.h - bh) / 2
      wipe(ctx, E, Q.x, by, Q.w, bh, E.ease.out(p), () => {
        ctx.fillStyle = E.rgba(P.bg0, 0.74); E.roundRect(ctx, Q.x, by, Q.w, bh, 10 * u); ctx.fill()
        ctx.strokeStyle = E.rgba(P.blue2, 0.5); ctx.lineWidth = 1.6 * u; ctx.stroke()
        ctx.fillStyle = P.gold; ctx.fillRect(Q.x + 10 * u, by, Q.w - 20 * u, 4 * u)
        text(ctx, '“', Q.x + padQ * 0.5, by + mk * 0.42, { font: E.font('title', 900, mk), color: P.gold, glow: 16 * u, glowCol: P.gold })
        text(ctx, '”', Q.x + Q.w - padQ * 0.5, by + bh - mk * 0.02, { font: E.font('title', 900, mk), color: P.gold, align: 'right', alpha: 0.85 })
        ctx.fillStyle = P.white; ctx.font = E.font('title', 800, f.size); drawLines(ctx, f.lines, Q.x + padQ, by + padQ + mk * 0.3, f.lineH, 'left')
      })
    },

    // 演播室全景收尾：主播坐在台后，大屏上地球转着，收束的话从左刷出，cta 是大屏上的红色按钮；副标题进标题条
    end(ctx, s, E) {
      setPal(E, this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = frame(E).B
      const icta = sc.cta ? (sc.subtitle ? 2 : 1) : -1
      const S = por ? { x: B.x, y: B.y, w: B.w, h: B.h * 0.5 } : { x: B.x + B.w * 0.47, y: B.y + 12 * u, w: B.w * 0.53, h: B.h * 0.76 }
      const dh = por ? 62 * u : B.h * 0.18 - 22 * u, deskY = B.y + B.h - dh - 22 * u
      const A = por ? { x: W / 2, s: 250 * u, dw: B.w * 0.86 } : { x: B.x + B.w * 0.23, s: 330 * u, dw: 720 * u }
      board(ctx, s, E, S)
      const p0 = s.p(0)
      ctx.save(); ctx.beginPath(); ctx.rect(S.x, S.y, S.w, S.h); ctx.clip()
      globe(ctx, E, S.x + S.w / 2, S.y + S.h * 0.52, Math.min(S.w, S.h) * 0.42, E.T * 0.5, { alpha: (0.16 + 0.24 * (1 - E.clamp(p0 * 2))) * E.clamp(s.t / 0.3), lw: 1.5 })
      ctx.restore()
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: (por ? 84 : 86) * u, maxW: S.w - 90 * u, maxLines: 3, maxH: S.h * 0.56, lineGap: 1.2, oneLine: true })
      const cta = sc.cta ? E.fit(sc.cta, { role: 'title', weight: 900, size: 40 * u, maxW: S.w * 0.7, maxLines: 1 }) : null
      const hT = big.lines.length * big.lineH, hC = cta ? cta.size * 1.6 + 40 * u : 0, ty = S.y + (S.h - hT - hC) / 2
      wipe(ctx, E, S.x, ty - 16 * u, S.w, hT + 32 * u, E.ease.out(p0), () => {
        ctx.font = E.font('title', 900, big.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        big.lines.forEach((ln, k) => glowText(ctx, ln, S.x + S.w / 2, ty + k * big.lineH + big.lineH / 2, 22 * u, P.blue2))
        ctx.fillStyle = P.white; drawLines(ctx, big.lines, S.x + S.w / 2, ty, big.lineH, 'center')
      })
      if (cta) {
        const q = pop(E, s.t, s.cue(icta), 0.35), w = cta.width + cta.size * 1.8
        if (q.a > 0) {
          ctx.save(); ctx.globalAlpha *= q.a; ctx.translate(S.x + S.w / 2, ty + hT + 40 * u + cta.size * 0.8); ctx.scale(q.s, q.s)
          tag(ctx, E, cta.lines[0], -w / 2, 0, { fs: cta.size, w, h: cta.size * 1.6, r: 8 * u })
          ctx.restore()
        }
      }
      anchor(ctx, E, A.x, deskY, A.s, E.T)
      desk(ctx, E, A.x, deskY, A.dw, dh, { sweep: ((s.t * 0.4) % 1.4) - 0.2 })
    },
  },

  caption(ctx, s, E) { setPal(E, this.c); drawCap(ctx, s, E, frame(E)) },

  // 最上层：左上角标、下三分之一标题条（跟着它那一项入场翻出来，换场前压扁收起）、滚动字幕条
  overlay(ctx, E, s) {
    setPal(E, this.c)
    const fr = frame(E), hd = headOf(s.scene, s.layout)
    drawBug(ctx, E, fr)
    if (hd) {
      let flip = E.ease.outBack(s.p(hd.i))
      if (s.index < s.count - 1) flip *= E.ease.in(E.clamp((s.dur - s.t) / 0.13))
      drawHeadline(ctx, E, fr, headFit(E, fr, hd.text), hd.mode, flip)
    }
    drawTicker(ctx, E, fr, s, tickOf(s.scene, s.layout))
  },

  // 默认版式会调用的零件（九种版式都重画了，只在 custom 场借用时用到）：大屏卡片、发光柱、编号块、青线加红短线
  card(ctx, E, x, y, w, h, o = {}) { setPal(E, this.c); panel(ctx, E, x, y, w, h, { corner: 18 * E.u, border: o.tone === 'accent' ? P.red : undefined, top: o.tone === 'accent' ? E.mix(P.red, P.bg1, 0.4) : undefined }) },
  bar(ctx, E, x, y, w, h, o = {}) {
    const col = o.color ?? this.c.accent
    ctx.save(); ctx.fillStyle = col; ctx.shadowColor = E.rgba(col, 0.5); ctx.shadowBlur = 18 * E.u; E.roundRect(ctx, x, y, w, h, 6 * E.u); ctx.fill(); ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.fillStyle = o.color ?? this.c.accent; E.roundRect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.2); ctx.fill(); ctx.restore() },
  underline(ctx, E, x, y, w, p) { ctx.save(); ctx.fillStyle = this.c.line; ctx.fillRect(x, y, w * p, 4 * E.u); ctx.fillStyle = this.c.accent; ctx.fillRect(x, y + 8 * E.u, Math.min(w, 120 * E.u) * p, 5 * E.u); ctx.restore() },

  // 配乐：新闻片头式的 C 小调 i–VI–III–VII，锯齿铺底、八分低音、有鼓。音效：入场 tick，换场 whoosh（配光带擦除），数字落地 thud
  music: { style: 'drive', prog: ['Cm', 'Ab', 'Eb', 'Bb'], lead: 'pluck', drums: true },
  sfx: { enter: 'tick', cut: 'whoosh', accent: 'thud' },
  // 片头横幅、片尾那句话落下时各一声钟（原样片的台标动机），数据大屏的高亮柱长出时一声轻钟
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const sc = S.scene, at = k => S.t0 + S.cues[Math.min(k, S.cues.length - 1)]
      if (S.layout === 'title') out.push({ t: at(sc.kicker ? 1 : 0), kind: 'chime', gain: 0.28 })
      if (S.layout === 'end') out.push({ t: at(0), kind: 'chime', gain: 0.28 })
      if (S.layout === 'bars') { const v = sc.items.map(it => Number(it.value)), hi = sc.highlight != null ? sc.highlight - 1 : v.indexOf(Math.max(...v)); out.push({ t: at(hi + 1) + 0.2, kind: 'chime', gain: 0.18 }) }
    }
    return out
  },
}
