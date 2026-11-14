// 风格包：复古录像带（vhs）。八九十年代电视节目在录像带上回放：演播室布景、放射光、彩条测试卡作底；
// 最上层是整帧的录像带质感（红色通道错位、重影、横纹噪点、跟踪线、磁头噪声、扫描线、显像管圆角），角上 PLAY / PAUSE / SP 走带计时；
// 字幕是老电视的隐藏字幕（黑底白字）；换场是换台（撕裂、雪花、新台滚动稳住）；片尾老电视关机缩成一条亮线。
// 九种版式：节目片头、暂停画面、录像带架、录像机计数器、电平柱、一排电视依次开机、换台前后两台电视、节目卡、片尾。
// 画法库移植自风格库的 R-复古录像带，见 lib/ 和 NOTES.md。画面上的字只来自这一场的 s.scene。
import { P, FIX, SHADE, CAB, SNOW_RATE, setPal, put, retro, bold, label, stripes, pill, pillH, quoteMark, cassette, cassetteWin, tv, tvGeom, screenOn, spine, vcr, glyph, bigGlyph, sparkle, snow } from './lib/tape.mjs'
import { background as drawBg, transition as changeChannel, overlay as tapeLayer } from './lib/screen.mjs'
import { drawLines, formatNumber, decimalsOf, roundRect, mix, rgba, clamp, lerp, ease } from '../../core.mjs'
import { rolling } from '../../layouts.mjs'

// 几段字用同一个字号（取各自能放下的最小字号）
function fitAll(E, texts, opt) {
  const size = Math.min(...texts.map(t => E.fit(t, opt).size))
  return texts.map(t => E.fit(t, { ...opt, size, minSize: opt.size * 0.55, quiet: true }))
}
// 场标题：一道横穿全屏的四色条纹从左扫出，上面盖一枚奶油色胶囊。返回标题下面可用区域的 y
function head(ctx, s, E, text) {
  const { W, u } = E, B = E.L.box
  if (!text) return B.y
  const f = E.fit(text, { role: 'title', weight: 900, size: 48 * u, maxW: B.w * 0.8, maxLines: 2, lineGap: 1.2, oneLine: true })
  const h = pillH(f), cy = B.y + h / 2 + 2 * u
  stripes(ctx, 0, cy, W, h * 0.42, E.k(s.t, s.cue(0) - 0.05, 0.5, ease.out))
  put(ctx, s.t - s.cue(0), W / 2, cy, 'stamp', u, () => pill(ctx, f, E.font('title', 900, f.size), u))
  return B.y + h + 36 * u
}
// 复古立体大字（可以几行），以 (x, y) 为整块的中心
function retroBlock(ctx, E, f, x, y, grad) {
  const font = E.font('title', 900, f.size)
  f.lines.forEach((ln, j) => retro(ctx, ln, x, y + (j - (f.lines.length - 1) / 2) * f.lineH, font, f.size, { grad }))
}
// 大字落定后，四周三颗闪光
function twinkle(ctx, E, cx, cy, hw, hh, dt) {
  if (dt < 0.4) return
  for (const [dx, dy, ph] of [[-1, -0.55, 0], [1, -0.4, 1.1], [0.9, 0.55, 2.2]]) {
    sparkle(ctx, cx + dx * hw, cy + dy * hh, 34 * E.u * Math.max(0, Math.sin((dt - 0.4) * 5 + ph)) * clamp((dt - 0.4) * 4))
  }
}
// 片头和片尾共用：一块复古大字，上面可以有胶囊（kicker），下面有副标题胶囊，最后可以有一个按钮
function marquee(ctx, s, E, o) {
  const { W, u } = E, por = E.portrait, B = E.L.box
  const size = (por ? 150 : o.size) * u
  const big = E.fit(o.title, { role: 'title', weight: 900, size, maxW: B.w - size * 0.36, maxLines: por ? 3 : 2, lineGap: 1.16, oneLine: true })
  const kick = o.kicker ? E.fit(o.kicker, { role: 'title', weight: 900, size: 42 * u, maxW: B.w * 0.7, maxLines: 1 }) : null
  const sub = o.subtitle ? E.fit(o.subtitle, { role: 'body', weight: 800, size: 44 * u, maxW: B.w * 0.78, maxLines: 2, lineGap: 1.25 }) : null
  const cta = o.cta ? E.fit(o.cta, { role: 'title', weight: 900, size: 44 * u, maxW: B.w * 0.6, maxLines: 1 }) : null
  const gap = 44 * u, hT = big.lines.length * big.lineH, cH = cta ? cta.size * 1.8 : 0
  const hK = kick ? pillH(kick) + gap : 0, hS = sub ? pillH(sub) + gap * 1.3 : 0, hC = cta ? cH + gap * 1.2 : 0
  let y = B.y + (B.h - hK - hT - hS - hC) / 2
  const ky = y + (kick ? pillH(kick) / 2 : 0); y += hK
  const ty = y + hT / 2; y += hT
  const sy = y + gap * 1.3 + (sub ? pillH(sub) / 2 : 0); y += hS
  const cy = y + gap * 1.2 + cH / 2
  const dT = s.t - s.cue(o.it)
  // 四色条纹：一道粗的扫过大字的腰（片头从左，片尾从右），一道细的反方向扫回
  const band = (yy, h, p, flip) => { if (p <= 0) return; ctx.save(); if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1) } stripes(ctx, 0, yy, W, h, p); ctx.restore() }
  band(ty, big.size * 0.5, E.k(dT, -0.05, 0.6, ease.out), o.flip)
  band(ty + hT / 2 + gap * 0.42, 16 * u, E.k(dT, 0.25, 0.6, ease.out), !o.flip)
  if (dT > 0) {
    const k = lerp(0.55, 1, ease.outBack(clamp(dT / 0.55)))
    ctx.save(); ctx.globalAlpha *= clamp(dT / 0.1); ctx.translate(W / 2, ty); ctx.scale(k, k)
    retroBlock(ctx, E, big, 0, 0, o.grad)
    ctx.restore()
    twinkle(ctx, E, W / 2, ty, big.width / 2 + big.size * 0.3, hT, dT)
  }
  if (kick) put(ctx, s.t - s.cue(o.ik), W / 2, ky, 'stamp', u, () => pill(ctx, kick, E.font('title', 900, kick.size), u, { fill: P.acc }), -0.03)
  if (sub) put(ctx, s.t - s.cue(o.isub), W / 2, sy, 'up', u, () => pill(ctx, sub, E.font('body', 800, sub.size), u))
  if (cta) put(ctx, s.t - s.cue(o.icta), W / 2, cy, 'stamp', u, () => {
    // 录制键式的按钮：强调色底、左边一个一秒一闪的红点
    const w = cta.width + cta.size * 2.6, h = cH, dot = Math.floor(s.t * 2) % 2 === 0
    ctx.fillStyle = SHADE; roundRect(ctx, -w / 2 + 8 * u, -h / 2 + 9 * u, w, h, 16 * u); ctx.fill()
    ctx.fillStyle = P.acc; roundRect(ctx, -w / 2, -h / 2, w, h, 16 * u); ctx.fill()
    ctx.lineWidth = 5 * u; ctx.strokeStyle = P.ink; ctx.stroke()
    glyph(ctx, 'rec', -w / 2 + cta.size * 0.95, 0, cta.size * 0.3, dot ? FIX.red : mix(FIX.red, P.ink, 0.6))
    ctx.fillStyle = P.on; ctx.font = E.font('title', 900, cta.size); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(cta.lines[0], -w / 2 + cta.size * 1.6, 2 * u)
  })
}

export default {
  name: '复古录像带', mood: '老电视和录像带回放，复古节目包装；轻松科普、系列节目的片头片尾', bpm: 104,
  c: { bg: '#2a1a5c', fg: '#f6ecd2', muted: '#a99cc8', accent: '#ffd23a', accent2: '#ff3d7f', card: '#fbf4e2', line: '#1a0f2e', onAccent: '#1a0f2e' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'mono', wTitle: 900, wBody: 700, radius: 16,
  motion: 'pop', solidAccent: true,
  transitionDur: 0.5,
  transition(ctx, A, B, p, E) { setPal(this.c); changeChannel(ctx, A, B, p, E) },
  bg(ctx, E, s) { setPal(this.c); drawBg(ctx, E, s) },

  layouts: {
    // 节目片头：放射光、四色条纹扫过、斜体渐变立体大字弹出、闪光；kicker 是上方的黄胶囊，副标题是下方的奶油色胶囊。
    // 全片第一场先一拍雪花，信号锁定后画面从下往上滚出来
    title(ctx, s, E) {
      setPal(this.c)
      const sc = s.scene
      let n = 0
      const ik = sc.kicker ? n++ : -1, it = n++, isub = sc.subtitle ? n++ : -1
      marquee(ctx, s, E, { title: sc.title, kicker: sc.kicker, subtitle: sc.subtitle, size: 168, grad: 'sunset', it, ik, isub })
      if (s.index === 0 && s.t < 0.42) {
        const h = E.H * (1 - E.k(s.t, 0.28, 0.14, ease.linear))
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, E.W, h)
        snow(ctx, E, 0, 0, E.W, h, Math.floor(s.t * SNOW_RATE), 0.9)
      }
    },

    // 暂停画面：按下暂停，画面压暗，上下两道噪声带抖动（角标同时变成 PAUSE），那句话盖章落下，高亮词黄色、下面垫四色条纹
    statement(ctx, s, E) {
      setPal(this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = E.L.box
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: (por ? 96 : 110) * u, maxW: B.w * 0.9, maxLines: por ? 6 : 4, lineGap: 1.32 })
      const hT = f.lines.length * f.lineH, y0 = B.y + (B.h - hT) / 2, dt = s.t - s.cue(0)
      if (dt > -0.1) {
        const fr = Math.floor(E.T * SNOW_RATE)
        ctx.fillStyle = rgba(P.ink, 0.3 * clamp((dt + 0.1) * 5)); ctx.fillRect(0, 0, W, E.H)
        for (const [k, yy] of [[0, Math.max(B.y - 20 * u, y0 - 74 * u)], [1, Math.min(B.y + B.h - 6 * u, y0 + hT + 58 * u)]]) {
          const yj = yy + (E.hash(fr, k + 1) - 0.5) * 8 * u, hb = 16 * u
          snow(ctx, E, 0, yj, W, hb, fr + k * 3, 0.55)
          ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(0, yj + hb * 0.45, W, 2 * u)
        }
      }
      put(ctx, dt, W / 2, y0 + hT / 2, 'stamp', u, () => {
        ctx.font = E.font('title', 900, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        const hl = sc.highlight ? String(sc.highlight) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1, q = E.k(dt, 0.25, 0.4, ease.out)
        let off = 0
        f.lines.forEach((ln, k) => {
          const y = -hT / 2 + k * f.lineH + f.lineH / 2
          let x = -ctx.measureText(ln).width / 2
          const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off)
          off += ln.length
          const segs = hs < 0 || a1 <= a0 ? [[ln, false]] : [[ln.slice(0, a0), false], [ln.slice(a0, a1), true], [ln.slice(a1), false]]
          for (const [str, on] of segs) {
            if (!str) continue
            const w = ctx.measureText(str).width
            if (on) stripes(ctx, x - 6 * u, y + f.size * 0.52, w + 12 * u, f.size * 0.22, q)
            bold(ctx, str, x, y, f.size, on ? P.acc : P.fg)
            x += w
          }
        })
      })
    },

    // 录像带架：木框里一格一个凹槽，每条要点是一盘侧放的录像带，从右边插进格子；贴纸左端是色条和序号
    bullets(ctx, s, E) {
      setPal(this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = E.L.box, n = sc.items.length
      const top = head(ctx, s, E, sc.title), avail = B.y + B.h - top, pad = 16 * u, gap = 12 * u
      const rowH = Math.min((avail - pad * 2 - gap * (n - 1)) / n, (por ? 180 : 140) * u)
      const tw = Math.min(B.w - pad * 2, 1320 * u), rw = tw + pad * 2, rh = rowH * n + gap * (n - 1) + pad * 2
      const rx = W / 2 - rw / 2, ry = top + (avail - rh) / 2
      ctx.save(); ctx.globalAlpha *= clamp((s.t - s.cue(0) + 0.2) / 0.3)
      ctx.fillStyle = SHADE; roundRect(ctx, rx + 10 * u, ry + 12 * u, rw, rh, 14 * u); ctx.fill()
      const g = ctx.createLinearGradient(0, ry, 0, ry + rh); g.addColorStop(0, CAB.wood[0]); g.addColorStop(1, CAB.wood[1])
      ctx.fillStyle = g; roundRect(ctx, rx, ry, rw, rh, 14 * u); ctx.fill(); ctx.lineWidth = 5 * u; ctx.strokeStyle = P.ink; ctx.stroke()
      for (let i = 0; i < n; i++) { ctx.fillStyle = 'rgba(10,5,20,0.72)'; roundRect(ctx, rx + pad, ry + pad + i * (rowH + gap), tw, rowH, 8 * u); ctx.fill() }
      ctx.restore()
      const lh = rowH * 0.7, maxW = tw - 128 * u - Math.min(lh * 1.2, 90 * u) - 46 * u
      const FS = fitAll(E, sc.items, { role: 'body', weight: 800, size: Math.min((por ? 56 : 48) * u, lh * 0.5), maxW, maxLines: 2, maxH: lh * 0.92, lineGap: 1.15 })
      sc.items.forEach((it, i) => {
        const y = ry + pad + i * (rowH + gap) + rowH / 2, f = FS[i]
        put(ctx, s.t - s.cue(i + 1), W / 2, y, 'right', u, () => {
          const L = spine(ctx, u, tw, rowH, P.stripes[i % 4])
          ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.font = E.font('num', 700, Math.min(lh * 0.5, 44 * u)); ctx.fillText(String(i + 1), L.bx, 2 * u)
          ctx.font = E.font('body', 800, f.size); drawLines(ctx, f.lines, L.x, -f.lines.length * f.lineH / 2, f.lineH, 'left')
        })
      })
    },

    // 录像机计数器：录像机面板像老电视一样开机，青色荧光数字从 0 翻到目标值（背后是暗着的 8 字段）；
    // label 是下面的黄胶囊，note 是再下面一行小字
    number(ctx, s, E) {
      setPal(this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = E.L.box
      let n = 1
      const il = sc.label ? n++ : -1, inote = sc.note ? n++ : -1
      const str = String(sc.value), size = (por ? 230 : 210) * u, ufont = sz => E.font('body', 900, sz * 0.3)
      ctx.font = ufont(size); const uw0 = sc.unit ? ctx.measureText(sc.unit).width + 24 * u : 0
      const side = (por ? 130 : 200) * u
      const f = E.fit(str, { role: 'num', weight: 700, size, maxW: B.w - side - 90 * u - uw0, maxLines: 1, minSize: size * 0.3, lineGap: 1 })
      ctx.font = ufont(f.size); const uw = sc.unit ? ctx.measureText(sc.unit).width + 24 * u : 0
      const winW = f.width + uw + 80 * u, winH = f.size * 1.2, pw = winW + side, ph = winH + 170 * u
      const lab = sc.label ? E.fit(sc.label, { role: 'title', weight: 900, size: 48 * u, maxW: B.w * 0.86, maxLines: 2, lineGap: 1.2 }) : null
      const note = sc.note ? E.fit(sc.note, { role: 'body', weight: 700, size: 36 * u, maxW: B.w * 0.8, maxLines: 2 }) : null
      const hL = lab ? pillH(lab) + 50 * u : 0, hN = note ? note.lines.length * note.lineH + 30 * u : 0
      const py = B.y + (B.h - ph - hL - hN) / 2 + ph / 2, dt = s.t - s.cue(0), roll = clamp(dt / Math.min(1.4, s.dur * 0.35))
      put(ctx, dt, W / 2, py, 'crt', u, o => {
        const win = vcr(ctx, u, pw, ph, { w: winW, h: winH, cy: 10 * u }, s.t)
        const yc = win.y + win.h / 2, xr = win.x + win.w - 40 * u - uw, shown = rolling(sc.value, roll)
        ctx.font = E.font('num', 700, f.size); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
        ctx.fillStyle = rgba(FIX.cyan, 0.1); ctx.fillText(str.replace(/\d/g, '8'), xr, yc)
        ctx.strokeStyle = rgba(FIX.cyan, 0.14); ctx.lineWidth = f.size * 0.14; ctx.strokeText(shown, xr, yc)
        ctx.strokeStyle = rgba(FIX.cyan, 0.3); ctx.lineWidth = f.size * 0.06; ctx.strokeText(shown, xr, yc)
        ctx.fillStyle = '#c8f8ff'; ctx.fillText(shown, xr, yc)
        if (sc.unit) { ctx.font = ufont(f.size); ctx.textAlign = 'left'; ctx.fillStyle = FIX.cyan; ctx.fillText(sc.unit, xr + 24 * u, yc + f.size * 0.22) }
        if (o.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${o.flash})`; roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 20 * u); ctx.fill() }
      })
      let y = py + ph / 2
      if (lab) { y += 50 * u; put(ctx, s.t - s.cue(il), W / 2, y + pillH(lab) / 2, 'stamp', u, () => pill(ctx, lab, E.font('title', 900, lab.size), u, { fill: P.acc }), -0.02); y += pillH(lab) }
      if (note) { y += 30 * u; const ny = y; put(ctx, s.t - s.cue(inote), W / 2, ny, 'up', u, () => label(ctx, note, E.font('body', 700, note.size), 0, 0, P.fg)) }
    },

    // 电平柱：深色机架上一根根分段的发光柱（横屏竖着长、竖屏横着长），高亮的一根是强调色并带一圈光；数值随柱子涨上去
    bars(ctx, s, E) {
      setPal(this.c)
      const { u } = E, sc = s.scene, B = E.L.box, n = sc.items.length, wide = B.w > B.h * 1.5
      const top = head(ctx, s, E, sc.title)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const R = { x: B.x, y: top, w: B.w, h: B.y + B.h - top }, pad = 36 * u
      ctx.save(); ctx.globalAlpha *= clamp((s.t - s.cue(0) + 0.2) / 0.3)
      ctx.fillStyle = SHADE; roundRect(ctx, R.x + 10 * u, R.y + 12 * u, R.w, R.h, 18 * u); ctx.fill()
      ctx.fillStyle = 'rgba(12,8,20,0.86)'; roundRect(ctx, R.x, R.y, R.w, R.h, 18 * u); ctx.fill()
      ctx.lineWidth = 4 * u; ctx.strokeStyle = rgba(P.card, 0.35); ctx.stroke()
      ctx.restore()
      // 一根分段柱：从 (x, y) 起向上（横着的向右）长 lit 长，满格 full；没亮的格子淡淡露着
      const leds = (x, y, full, lit, thick, col, horiz) => {
        const seg = 14 * u, step = 20 * u
        for (let a = 0; a + seg <= full; a += step) {
          const on = clamp((lit - a) / seg)
          const box = k => (horiz ? ctx.fillRect(x + a, y, seg * k, thick) : ctx.fillRect(x, y - a - seg * k, thick, seg * k))
          ctx.fillStyle = 'rgba(246,236,210,0.07)'; box(1)
          if (on > 0) { ctx.fillStyle = col; box(on) }
        }
      }
      const glow = (x, y, w, h) => { if (w > 1 && h > 1) { ctx.strokeStyle = rgba(P.acc, 0.28); ctx.lineWidth = 10 * u; ctx.strokeRect(x - 8 * u, y - 8 * u, w + 16 * u, h + 16 * u) } }
      if (wide) {
        const labH = 84 * u, valH = 64 * u, base = R.y + R.h - pad - labH, hMax = base - (R.y + pad + valH)
        const slot = (R.w - pad * 2) / n, bw = Math.min(slot * 0.46, 150 * u)
        sc.items.forEach((it, i) => {
          const q = s.p(i + 1), p = ease.out(q), h = hMax * vals[i] / max * p, x = R.x + pad + slot * i + (slot - bw) / 2, hot = i === hi
          if (hot) glow(x, base - h, bw, h)
          leds(x, base, hMax, h, bw, hot ? P.acc : FIX.green, false)
          if (q <= 0) return
          const lf = E.fit(it.label, { role: 'body', weight: 700, size: 36 * u, maxW: slot * 0.92, maxLines: 2, maxH: labH - 14 * u, lineGap: 1.15 })
          ctx.save(); ctx.globalAlpha *= clamp(q * 2)
          ctx.font = E.font('num', 700, 44 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = hot ? P.acc : P.fg
          ctx.fillText(formatNumber(vals[i] * p, dec) + unit, x + bw / 2, base - h - 18 * u)
          ctx.fillStyle = hot ? P.acc : P.fg; ctx.font = E.font('body', 700, lf.size); drawLines(ctx, lf.lines, x + bw / 2, base + 14 * u, lf.lineH, 'center')
          ctx.restore()
        })
      } else {
        const rowH = Math.min((R.h - pad * 2) / n, 200 * u), y0 = R.y + pad + (R.h - pad * 2 - rowH * n) / 2, valW = 190 * u, x0 = R.x + pad, wMax = R.w - pad * 2 - valW
        sc.items.forEach((it, i) => {
          const q = s.p(i + 1), p = ease.out(q), y = y0 + rowH * i, thick = rowH * 0.3, by = y + rowH * 0.52, w = wMax * vals[i] / max * p, hot = i === hi
          if (hot) glow(x0, by, w, thick)
          leds(x0, by, wMax, w, thick, hot ? P.acc : FIX.green, true)
          if (q <= 0) return
          const lf = E.fit(it.label, { role: 'body', weight: 700, size: Math.min(38 * u, rowH * 0.34), maxW: R.w - pad * 2, maxLines: 1 })
          ctx.save(); ctx.globalAlpha *= clamp(q * 2); ctx.fillStyle = hot ? P.acc : P.fg
          ctx.font = E.font('body', 700, lf.size); drawLines(ctx, lf.lines, x0, y + rowH * 0.02, lf.lineH, 'left')
          ctx.font = E.font('num', 700, 40 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          ctx.fillText(formatNumber(vals[i] * p, dec) + unit, x0 + w + 20 * u, by + thick / 2)
          ctx.restore()
        })
      }
    },

    // 一排老电视依次开机：场一开始电视都在（黑屏），念到第几步那台就开机亮出这一步；两台之间一个播放三角；左上角编号牌开机后变成强调色
    steps(ctx, s, E) {
      setPal(this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = E.L.box, n = sc.items.length, wide = B.w > B.h * 1.5
      const top = head(ctx, s, E, sc.title), avail = B.y + B.h - top
      let w, h, ant, pos, panel = true
      if (wide) {
        const gap = (n >= 5 ? 44 : 64) * u
        w = (B.w - gap * (n - 1)) / n; h = Math.min(w * 0.74, (avail - 30 * u) / 1.3); ant = Math.min(h * 0.26, 80 * u); panel = w >= 340 * u
        const cy = top + (avail - h - ant) / 2 + ant + h / 2
        pos = sc.items.map((_, i) => [B.x + (w + gap) * i + w / 2, cy])
      } else {
        const gap = 36 * u
        h = Math.min((avail - gap * (n - 1)) / n, 300 * u); w = Math.min(B.w - 30 * u, h * 3.4); ant = 0
        const y0 = top + (avail - h * n - gap * (n - 1)) / 2
        pos = sc.items.map((_, i) => [W / 2, y0 + (h + gap) * i + h / 2])
      }
      const G = tvGeom(w, h, { panel })
      const FS = fitAll(E, sc.items, { role: 'body', weight: 800, size: (por ? 52 : 44) * u, maxW: G.sw - 40 * u, maxLines: wide ? 3 : 2, maxH: G.sh * 0.8, lineGap: 1.2 })
      const cabs = ['orange', 'teal', 'cream', 'plum', 'red'], d0 = s.t - s.cue(0)
      sc.items.forEach((it, i) => {
        const [x, y] = pos[i], dt = s.t - s.cue(i + 1), f = FS[i]
        if (i > 0 && dt > 0) {
          const [px, py] = pos[i - 1], k = Math.max(0.01, ease.outBack(clamp(dt / 0.3)))
          ctx.save(); ctx.translate(wide ? (px + x) / 2 : x, wide ? y : (py + y) / 2); if (!wide) ctx.rotate(Math.PI / 2); ctx.scale(k, k)
          bigGlyph(ctx, 'play', 0, 0, (wide ? 18 : 13) * u, P.acc, u); ctx.restore()
        }
        put(ctx, d0, x, y, 'pop', u, () => {
          tv(ctx, u, w, h, (c, sw, sh) => screenOn(c, u, sw, sh, dt, () => {
            c.fillStyle = P.fg; c.font = E.font('body', 800, f.size); drawLines(c, f.lines, 0, -f.lines.length * f.lineH / 2, f.lineH, 'center')
          }), { cab: cabs[i % cabs.length], ant, panel })
          const r = 30 * u, bx = -w / 2 + r * 0.4, by = -h / 2 + r * 0.4
          ctx.fillStyle = dt > 0 ? P.acc : P.muted; ctx.beginPath(); ctx.arc(bx, by, r, 0, 7); ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = P.ink; ctx.stroke()
          ctx.fillStyle = P.on; ctx.font = E.font('num', 700, r * 1.1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + 2 * u)
        })
      })
    },

    // 换台前后：两台电视（横屏左右、竖屏上下）。左边那台先开机；右边那台是强调色机壳，开机时先一阵换台雪花再亮出来；中间一个快进符号
    compare(ctx, s, E) {
      setPal(this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = E.L.box, wide = B.w > B.h * 1.5, sides = [sc.left, sc.right]
      const top = head(ctx, s, E, sc.title), avail = B.y + B.h - top
      let w, h, ant, pos
      if (wide) {
        const gap = 140 * u
        w = (B.w - gap) / 2; ant = 70 * u; h = Math.min(w * 0.74, avail - ant - 30 * u)
        const cy = top + (avail - h - ant) / 2 + ant + h / 2
        pos = [[B.x + w / 2, cy], [B.x + B.w - w / 2, cy]]
      } else {
        const gap = 64 * u
        w = B.w - 20 * u; ant = 0; h = (avail - gap) / 2
        pos = [[W / 2, top + h / 2], [W / 2, top + h * 1.5 + gap]]
      }
      // 屏幕又宽又矮（方形画幅上下叠放时）：标题放左边一栏，要点放右边；否则标题在上、要点在下
      const G = tvGeom(w, h), padT = 28 * u, side = G.sw > G.sh * 1.8, tw = side ? G.sw * 0.36 : G.sw
      const tFit = sides.map(d => E.fit(d.title, { role: 'title', weight: 900, size: 50 * u, maxW: tw - (side ? 40 : 60) * u, maxLines: side ? 3 : 2, lineGap: 1.15, oneLine: !side }))
      const tH = Math.max(...tFit.map(f => f.lines.length * f.lineH))
      const listTop = side ? -G.sh / 2 + 18 * u : -G.sh / 2 + padT + tH + 34 * u, listH = side ? G.sh - 36 * u : G.sh / 2 - 20 * u - listTop
      const rowH = Math.min(listH / Math.max(1, ...sides.map(d => (d.items || []).length)), 110 * u), lx = -G.sw / 2 + (side ? tw : 0)
      const all = sides.flatMap(d => d.items || [])
      const FS = all.length ? fitAll(E, all, { role: 'body', weight: 700, size: Math.min((por ? 44 : 42) * u, rowH * 0.52), maxW: G.sw - (side ? tw : 0) - 110 * u, maxLines: 2, maxH: rowH * 0.94, lineGap: 1.16 }) : []
      const cabs = [[mix(P.muted, '#ffffff', 0.15), mix(P.muted, P.ink, 0.45)], [P.acc, mix(P.acc, P.ink, 0.4)]]
      let k0 = 0
      const d0 = s.t - s.cue(0)
      sides.forEach((d, i) => {
        const [x, y] = pos[i], dt = s.t - s.cue(i + 1), tf = tFit[i], items = d.items || [], fs = FS.slice(k0, k0 + items.length), strong = i === 1
        k0 += items.length
        const on = strong ? dt - 0.22 : dt
        put(ctx, d0, x, y, 'pop', u, () => tv(ctx, u, w, h, (c, sw, sh) => {
          if (strong && dt > 0 && dt < 0.22) { snow(c, E, -sw / 2, -sh / 2, sw, sh, Math.floor(s.t * SNOW_RATE), 0.85); return }
          screenOn(c, u, sw, sh, on, () => {
            const th = tf.lines.length * tf.lineH, tx = side ? -sw / 2 + tw / 2 : 0, ty = side ? -th / 2 - 8 * u : -sh / 2 + padT
            c.fillStyle = strong ? P.acc : P.fg; c.font = E.font('title', 900, tf.size)
            drawLines(c, tf.lines, tx, ty, tf.lineH, 'center')
            stripes(c, tx - tw * 0.3, side ? ty + th + 14 * u : ty + tH + 14 * u, tw * 0.6, 10 * u)
            fs.forEach((f, k) => {
              const cy = listTop + rowH * k + rowH / 2
              glyph(c, 'play', lx + 50 * u, cy, 10 * u, strong ? P.acc : P.muted)
              c.fillStyle = P.fg; c.font = E.font('body', 700, f.size); drawLines(c, f.lines, lx + 76 * u, cy - f.lines.length * f.lineH / 2, f.lineH, 'left')
            })
          })
        }, { cab: cabs[i], ant }))
      })
      const d2 = s.t - s.cue(2)
      if (d2 > 0) {
        const k = Math.max(0.01, ease.outBack(clamp(d2 / 0.3)))
        ctx.save(); ctx.translate((pos[0][0] + pos[1][0]) / 2, (pos[0][1] + pos[1][1]) / 2); if (!wide) ctx.rotate(Math.PI / 2); ctx.scale(k, k)
        bigGlyph(ctx, 'ff', 0, 0, (wide ? 22 : 16) * u, P.acc, u); ctx.restore()
      }
    },

    // 录像带贴纸：一盘录像带从上方落下，引语手写在它的大贴纸上（卷盘慢慢转），左上角一枚复古立体大引号；出处是右下角压在带壳边上的黄胶囊
    quote(ctx, s, E) {
      setPal(this.c)
      const { W, u } = E, por = E.portrait, sc = s.scene, B = E.L.box
      const cw = por ? B.w : Math.min(B.w * 0.8, 1300 * u), pad = (por ? 46 : 56) * u, extra = cassetteWin(u, cw) + 96 * u
      const by = sc.by ? E.fit(sc.by, { role: 'body', weight: 800, size: (por ? 42 : 40) * u, maxW: cw * 0.6, maxLines: 1 }) : null
      const hB = by ? pillH(by) / 2 : 0
      const f = E.fit(sc.text, { role: 'title', weight: 800, size: (por ? 72 : 70) * u, maxW: cw - 64 * u - pad * 2, maxLines: por ? 7 : 5, maxH: B.h - extra - hB - pad * 2 - 40 * u, lineGap: 1.36 })
      const labH = f.lines.length * f.lineH + pad * 2 + 30 * u, ch = labH + extra
      const cy = B.y + (B.h - ch - hB) / 2 + ch / 2, dt = s.t - s.cue(0)
      put(ctx, dt, W / 2, cy, 'drop', u, () => {
        const L = cassette(ctx, u, cw, ch, labH, s.t * 2.2)
        ctx.fillStyle = P.ink; ctx.font = E.font('title', 800, f.size)
        drawLines(ctx, f.lines, L.x + pad, L.y + pad, f.lineH, 'left')
      })
      const qs = (por ? 120 : 130) * u
      put(ctx, dt - 0.2, W / 2 - cw / 2 + qs * 0.45, cy - ch / 2 + qs * 0.12, 'stamp', u, () => quoteMark(ctx, qs), -0.06)
      if (by) {
        const w = by.width + by.size * 1.3
        put(ctx, s.t - s.cue(1), W / 2 + cw / 2 - w / 2 - 30 * u, cy + ch / 2, 'right', u, () => pill(ctx, by, E.font('body', 800, by.size), u, { fill: P.acc, stripes: true }))
      }
    },

    // 片尾：放射光、四色条纹从右扫过、镀铬色立体大字；副标题奶油色胶囊；按钮是录制键的样子。全片最后老电视关机（在最上层做）
    end(ctx, s, E) {
      setPal(this.c)
      const sc = s.scene
      let n = 0
      const it = n++, isub = sc.subtitle ? n++ : -1, icta = sc.cta ? n++ : -1
      marquee(ctx, s, E, { title: sc.title, subtitle: sc.subtitle, cta: sc.cta, size: 150, grad: 'chrome', flip: true, it, isub, icta })
    },
  },

  // 字幕在最上层里画（老电视的隐藏字幕是电视机自己叠上去的，不该带录像带的色边和噪点），这里不画
  caption() {},
  overlay(ctx, E, s) { setPal(this.c); tapeLayer(ctx, E, s) },

  // 默认版式会调用的零件（九种版式都重画了，只在 custom 场借用时用到）：深色屏幕卡片、分段电平柱、播放三角、四色条纹下划线
  card(ctx, E, x, y, w, h, o = {}) {
    setPal(this.c)
    const u = E.u, acc = o.tone === 'accent'
    ctx.save(); ctx.fillStyle = SHADE; roundRect(ctx, x + 8 * u, y + 9 * u, w, h, 16 * u); ctx.fill()
    ctx.fillStyle = acc ? P.acc : 'rgba(12,8,20,0.86)'; roundRect(ctx, x, y, w, h, 16 * u); ctx.fill()
    ctx.lineWidth = 4 * u; ctx.strokeStyle = acc ? P.ink : rgba(P.card, 0.6); ctx.stroke(); ctx.restore()
  },
  bar(ctx, E, x, y, w, h, o = {}) {
    const u = E.u, horiz = w > h * 1.5
    ctx.save(); ctx.fillStyle = o.color ?? this.c.accent
    if (horiz) for (let a = 0; a < w; a += 20 * u) ctx.fillRect(x + a, y, Math.min(14 * u, w - a), h)
    else for (let a = 0; a < h; a += 20 * u) ctx.fillRect(x, y + h - a - Math.min(14 * u, h - a), w, Math.min(14 * u, h - a))
    ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) { setPal(this.c); if (o.badge) { ctx.save(); ctx.fillStyle = P.acc; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore() } else bigGlyph(ctx, 'play', x, y, r * 0.8, o.color ?? P.acc, E.u) },
  underline(ctx, E, x, y, w, p) { setPal(this.c); stripes(ctx, x, y, w, 12 * E.u, p) },

  // 配乐：104 拍的 Fmaj7–E7–Am7–Gm7 循环，电钢主奏、有鼓。音效：入场是录像机按键声，换台是雪花声，盖章落下一声闷响
  music: { style: 'drive', prog: ['Fmaj7', 'E7', 'Am7', 'Gm7'], lead: 'epiano', drums: true },
  sfx: { enter: 'click', cut: 'glitch', accent: 'thud' },
  // 片头第一拍的雪花、标题弹出时一记铺底、换台对比时右边那台的雪花、片尾关机
  sounds(TL) {
    const out = []
    if (TL.scenes[0].layout === 'title') out.push({ t: 0.02, kind: 'glitch', gain: 0.3 })
    for (const S of TL.scenes) {
      const at = k => S.t0 + S.cues[Math.min(k, S.cues.length - 1)]
      if (S.layout === 'title') out.push({ t: at(S.scene.kicker ? 1 : 0), kind: 'swell', gain: 0.35 })
      if (S.layout === 'compare') out.push({ t: at(2), kind: 'glitch', gain: 0.2 })
    }
    out.push({ t: TL.total - 1.25, kind: 'thud', gain: 0.3 })
    return out
  },
}
