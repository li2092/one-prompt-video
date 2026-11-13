// 风格包：等轴测机房（isometric）。冷浅灰底上的 2.5D 机房：送料机、传送带、盖章检查站、门架、机柜、柱体和货箱，
// 零件落位时先加速下落、触地压扁回弹、扬起一圈尘、镜头轻震；地面是随机位缓缓转动的网格。
// 字全部在屏幕空间：白底圆角牌带引线，钉在机器上。字幕是白色圆角底板，转场沿等轴测斜线（1:2）百叶擦除。
// 画法库移植自风格库的 D-等轴测机房，见 lib/ 和 NOTES.md。
import { clamp, lerp, rgba, mix, formatNumber, decimalsOf, textUnits, roundRect } from '../../core.mjs'
import { captionChunks, rolling } from '../../layouts.mjs'
import { pal, lum, makeCam, fitCam, P, unP, box, plane, faceText, World, floorGrid, contact, dust, slot, glow, fall, shake, PRESENT, LAND, shade } from './lib/iso.mjs'
import { belt, stream, cube, feeder, press, arch, toolRack, recorder, fence, crate } from './lib/parts.mjs'
import { board, pop, lead, words, tag, tagSize, keycap } from './lib/sign.mjs'

const K = th => pal(th.c)
// 一场里机位水平来回转一点（度）
const swing = (E, s, a = 2.5) => a * (E.ease.sine(clamp(s.t / s.dur)) * 2 - 1)
// 取景两次：静止的那台用来排字（字号、牌子位置每帧不变），转动的那台用来画机器
function cams(E, s, pts, R, o) { return [fitCam(pts, R, o), fitCam(pts, R, { ...o, yaw: o.yaw + swing(E, s, o.orb) })] }
// 上面一块字、下面一片机器：先试一次取景，量出机器实际占多高，再把两块一起在内容区里竖直居中。返回 [字的上沿, 机器的矩形]
function stack(E, textH, gap, pts, yaw) {
  const A = E.L.box, probe = fitCam(pts, { x: A.x, y: 0, w: A.w, h: A.h - textH - gap }, { yaw })
  const y0 = A.y + Math.max(0, (A.h - textH - gap - probe.bh) / 2)
  return [y0, { x: A.x, y: y0 + textH + gap, w: A.w, h: probe.bh }]
}
// 几段字用同一个字号（取各自放得下的最小字号）
function fitAll(E, texts, o) {
  const oi = i => (Array.isArray(o) ? o[i] : o), size = Math.min(...texts.map((t, i) => E.fit(t, oi(i)).size))
  return texts.map((t, i) => E.fit(t, { ...oi(i), size, quiet: true }))
}
// 落位：第 j 件在 t0 + j * gap 开始落下；返回状态和落地时刻
const drops = (t, t0, n, gap = 0.1, H = 4) => Array.from({ length: n }, (_, j) => fall(t - t0 - j * gap, H))
const landsOf = (t0, n, gap = 0.1) => Array.from({ length: n }, (_, j) => t0 + j * gap + LAND)
// 屏幕上画一块小立方体（标题旁、要点前的图标）
function miniCube(ctx, k, x, y, r, col, mark) {
  const c = makeCam({ yaw: 45, s: r, cx: x, cy: y + r * 0.45 })
  box(ctx, c, { x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, col, top: shade(col, 1.15), edge: rgba('#1c1a2b', 0.22), lw: 1,
    onTop: mark ? (g) => { g.strokeStyle = '#fff'; g.lineWidth = 0.13; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0.22, 0.55); g.lineTo(0.42, 0.75); g.lineTo(0.8, 0.28); g.stroke() } : null })
}
// 整块字落位：从上方落下，触地压扁回弹（by 是这块字的下沿）
function dropIn(ctx, E, dt, cx, by, fn) {
  const st = fall(dt, 4)
  if (st.a <= 0) return
  ctx.save(); ctx.globalAlpha *= st.a; ctx.translate(cx, by - st.z * 40 * E.u); ctx.scale(2 - st.sq, st.sq); ctx.translate(-cx, -by); fn(); ctx.restore()
}
// 高亮词可能被折到两行：按它在整句里的位置，逐行切成 [字, 是否高亮]
function hiSegs(lines, hl) {
  const hs = hl ? lines.join('').indexOf(hl) : -1
  let off = 0
  return lines.map(ln => { const a0 = Math.max(0, hs - off), a1 = Math.min(ln.length, hs + hl.length - off); off += ln.length; return hs < 0 || a1 <= a0 ? [[ln, false]] : [[ln.slice(0, a0), false], [ln.slice(a0, a1), true], [ln.slice(a1), false]].filter(g => g[0]) })
}

// 场标题：左边一块落下来的小立方体，标题字，下面一条细线，强调色的一截随入场画出
function head(ctx, s, E, k, text) {
  const A = E.L.box, u = E.u
  if (!text) return A.y
  const p = s.p(0), r = E.pick(30, 30) * u
  const f = E.fit(text, { role: 'title', weight: 900, size: E.pick(64, 64) * u, maxW: A.w - r * 2.6, maxLines: 2, oneLine: true })
  const h = f.lines.length * f.lineH, st = fall(s.t - s.cue(0), 3)
  if (st.a > 0) { ctx.save(); ctx.globalAlpha *= st.a; miniCube(ctx, k, A.x + r * 0.9, A.y + h / 2 - r * 0.95 - st.z * 30 * u, r * 0.95, k.accent); ctx.restore() }
  pop(ctx, p, A.x + r * 2.4, A.y + h / 2, () => words(ctx, E, f, A.x + r * 2.4, A.y, 'left', k.fg, 'title', 900))
  const y = A.y + h + 16 * u, q = E.ease.out(clamp(p * 1.3 - 0.3))
  ctx.fillStyle = k.line; ctx.fillRect(A.x, y, A.w * q, 3 * u)
  ctx.fillStyle = k.accent; ctx.fillRect(A.x, y - 1.5 * u, Math.min(f.width + r * 2.4, A.w) * q, 6 * u)
  return y + E.pick(44, 50) * u
}

// 一条生产线：送料机 → 传送带 → 盖章检查站 → 货箱堆，后面一台记录仪和工具架。st(j) 给出第 j 件的状态
const LINE = { belt: { x0: -4.4, x1: 4.2, y: 0 }, feed: [-5.1, 0], press: 0.6, rec: [2.9, -2.1], tools: [-2.2, -2.75], crates: [[5.0, -0.25, 0, 0.8], [5.0, 0.7, 0, 0.66], [5.0, -0.25, 0.69, 0.62]] }
const LINE_PTS = [[-6, -3.4, 0], [6, -3.4, 0], [6.2, 1.4, 0], [-6, 1.4, 0], [-5.1, 0, 2.1], [0.6, -1.3, 1.7], [-2.2, -3.2, 1.5], [5, 0, 1.6]]
function factory(W, k, t, st, o = {}) {
  const L = LINE, b = st(0)
  const cs = stream(t, L.belt, { t0: -6, period: 0.95, stop: L.press })
  let stamp = -1, lamp = null
  for (const q of cs) { if (q.stamp >= 0) { stamp = q.stamp; lamp = 'ok' } }
  belt(W, k, L.belt, b, t)
  feeder(W, k, L.feed[0], L.feed[1], st(1), t)
  press(W, k, L.press, 0, st(2), stamp, lamp ?? 'on')
  recorder(W, k, L.rec[0], L.rec[1], st(3), t)
  if (o.tools) toolRack(W, k, L.tools[0], L.tools[1], st(4), t)
  L.crates.forEach(([x, y, z, s], j) => { const c = st(5 + j); crate(W, k, x, y, z + c.z, s, j === 1 ? k.violet : k.steel, c.a) })
  if (b.a > 0.5) for (const q of cs) cube(W, k, { ...q, a: q.a * b.a }, q.mark ? k.accent2 : k.violet, b.z)
  if (o.fence) fence(W, k, { x0: -6.2, x1: 6.2, y0: -3.6, y1: 1.6 }, 1, o.fence, o.fenceHL ?? 0)
}

// 机柜（bullets）里一层抽屉：正面朝 +x，左边一排灯，右边一道把手
function drawer(ctx, c, k, x, y, z, w, d, h, lit, t, seed, hl) {
  box(ctx, c, { x, y, z, w, d, h, col: k.body, top: k.bodyTop, ...(hl > 0.01 ? { edge: rgba(k.accent, 0.4 + 0.5 * hl), lw: 1.5 + 2 * hl } : {}) })
  ctx.save(); plane(ctx, c, x + w / 2 + 0.002, y + d / 2, z + h, 'yz')
  ctx.fillStyle = k.dark; roundRect(ctx, 0.12, h * 0.22, d * 0.42, h * 0.56, 0.05); ctx.fill()
  for (let j = 0; j < 4; j++) {
    const on = lit > 0.5 && (j === 0 || Math.sin(t * (3 + j) + seed * 1.7 + j) > -0.3)
    ctx.fillStyle = on ? (j === 0 ? k.accent2 : mix(k.violet, '#ffffff', 0.3)) : k.slate
    ctx.fillRect(0.2 + j * d * 0.085, h * 0.42, d * 0.05, h * 0.16)
  }
  ctx.fillStyle = k.rail; roundRect(ctx, d * 0.62, h * 0.4, d * 0.26, h * 0.2, 0.04); ctx.fill()
  ctx.restore()
}

// 柱体（bars）：方柱，朝 +y 的立面上有刻度线，强调的一根顶上有灯
function column(W, k, x, y, h, w, col, hi, t) {
  const ctx = W.ctx, c = W.c
  W.obj(x, y, h / 2, () => {
    box(ctx, c, { x, y, z: 0.12, w, d: w, h, col, top: shade(col, 1.12) })
    if (h > 0.4) {
      ctx.save(); plane(ctx, c, x - w / 2, y + w / 2 + 0.002, 0.12 + h, 'xz'); ctx.strokeStyle = rgba('#ffffff', 0.32); ctx.lineWidth = 0.025
      ctx.beginPath(); for (let zz = 0.5; zz < h - 0.1; zz += 0.5) { ctx.moveTo(0.1, zz); ctx.lineTo(zz % 1 === 0 ? w * 0.45 : w * 0.25, zz) } ctx.stroke(); ctx.restore()
    }
    if (hi) {
      const on = Math.sin(t * 6) > -0.4
      box(ctx, c, { x, y, z: 0.12 + h, w: w * 0.36, d: w * 0.36, h: 0.16, col: on ? k.accent2 : k.rail, edge: null })
      if (on) { const [lx, ly] = P(c, x, y, h + 0.5); glow(ctx, lx, ly, c.s * 0.7, k.accent2, 0.35) }
    }
  })
}

export default {
  name: '等轴测机房', mood: '2.5D 的机器、传送带和检查站，讲流程、讲系统怎么运转', bpm: 108,
  c: { bg: '#eef0f6', fg: '#1c1a2b', muted: '#585d74', accent: '#6d28d9', accent2: '#16a34a', card: '#ffffff', line: '#d3d7e4', onAccent: '#ffffff' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 900, wBody: 700, radius: 18,
  motion: 'rise', solidAccent: true,

  // 冷浅灰底，中间提亮的晕影
  bg(ctx, E) {
    const { W, H } = E, c = this.c
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
    ctx.drawImage(E.once('iso-vign:' + c.bg, () => {
      const cv = E.createCanvas(W, H), g = cv.getContext('2d'), rg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.45, Math.max(W, H) * 0.8)
      rg.addColorStop(0, rgba('#ffffff', lum(c.bg) > 0.5 ? 0.5 : 0.05)); rg.addColorStop(1, rgba(mix(c.bg, c.fg, 0.12), 0.35)); g.fillStyle = rg; g.fillRect(0, 0, W, H)
      return cv
    }), 0, 0)
  },

  layouts: {
    // 片头：整条生产线一件件落位，镜头随落地轻震；标题从上方落下压扁回弹，kicker 是强调色的牌
    title(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, A = E.L.box
      let n = 0
      const ik = sc.kicker ? n++ : -1, it = n++, is = sc.subtitle ? n++ : -1
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(132, 116) * u, maxW: A.w * 0.92, maxLines: E.pick(2, 3), lineGap: 1.14, oneLine: true })
      const kick = sc.kicker && E.fit(sc.kicker, { role: 'body', weight: 700, size: 38 * u, maxW: A.w * 0.7, maxLines: 1 })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 500, size: E.pick(46, 44) * u, maxW: A.w * 0.84, maxLines: 2 })
      const kS = kick && tagSize(E, kick), hK = kick ? kS.h + 28 * u : 0, hT = big.lines.length * big.lineH, hS = sub ? sub.lines.length * sub.lineH + 30 * u : 0
      const yaw = E.pick(24, 56), [y0, R] = stack(E, hK + hT + hS, E.pick(30, 60) * u, LINE_PTS, yaw)
      const lands = landsOf(0.08, 8)
      const [, c] = cams(E, s, LINE_PTS, R, { yaw, dy: shake(s.t, [...lands, s.cue(it) + LAND], u, 4) })
      floorGrid(ctx, c, k, { R: 9 })
      const W = new World(ctx, c), st = drops(s.t, 0.08, 8)
      factory(W, k, s.t, j => st[j], { tools: true })
      W.flush()
      const cx = E.W / 2
      if (kick) tag(ctx, E, k, kick, cx - kS.w / 2, y0, { p: s.p(ik), kind: 'accent', align: 'center' })
      const ty = y0 + hK
      dropIn(ctx, E, s.t - s.cue(it), cx, ty + hT, () => words(ctx, E, big, cx, ty, 'center', k.fg, 'title', 900))
      if (sub) pop(ctx, s.p(is), cx, ty + hT + 60 * u, () => words(ctx, E, sub, cx, ty + hT + 30 * u, 'center', k.muted, 'body', 500))
    },

    // 一句话：写在一块带厚度的白牌上，牌子挂着吊索从上方落下、两条腿着地扬尘；高亮词垫一块强调色键帽
    statement(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, A = E.L.box, por = E.portrait
      const bw = A.w * E.pick(0.8, 1), pad = E.pick(64, 48) * u, legH = E.pick(150, 210) * u
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(100, 92) * u, maxW: bw - pad * 2, maxLines: E.pick(3, 5), maxH: A.h - legH - pad * 2 - 40 * u, lineGap: 1.32 })
      const bh = f.lines.length * f.lineH + pad * 2, bx = E.W / 2 - bw / 2, by = A.y + (A.h - bh - legH) / 2, floorY = by + bh + legH
      const dt = s.t - s.cue(0), st = fall(dt, 5), land = s.cue(0) + LAND
      // 地面和腿：先定机位，再从屏幕上的腿脚位置反推世界坐标
      const c = makeCam({ yaw: 40 + swing(E, s, 2), s: E.pick(120, 110) * u, cx: E.W / 2, cy: floorY + shake(s.t, [land], u, 6) })
      floorGrid(ctx, c, k, { R: 10, a: 0.1 })
      const W = new World(ctx, c), drop = st.z * 40 * u
      const legs = [bx + bw * 0.14, bx + bw * 0.86]
      // 腿边的布景：横屏放在两条腿外侧，竖屏放在两条腿之间；从屏幕位置反推地面坐标
      const off = E.pick(-190, 150) * u, [lx, ly] = unP(c, legs[0] + off, floorY - 16 * u), [rx, ry] = unP(c, legs[1] - off, floorY - 16 * u)
      crate(W, k, lx, ly, 0, 0.8, k.steel); crate(W, k, lx, ly, 0.69, 0.64, k.violet); crate(W, k, lx + 0.95, ly + 0.25, 0, 0.6, k.steel)
      recorder(W, k, rx, ry, PRESENT, s.t, { w: 1.1 })
      W.flush()
      if (st.a > 0) {
        ctx.save(); ctx.globalAlpha *= st.a
        for (const lx of legs) {
          ctx.fillStyle = shade(k.steel, 0.8); ctx.fillRect(lx - 9 * u, by + bh - drop, 18 * u, legH * st.sq + 4 * u)
          ctx.fillStyle = shade(k.steel, 1.05); ctx.fillRect(lx - 9 * u, by + bh - drop, 6 * u, legH * st.sq + 4 * u)
          ctx.fillStyle = k.rail; ctx.fillRect(lx - 22 * u, floorY - drop - 8 * u, 44 * u, 10 * u)
        }
        ctx.restore()
        if (st.q > 0) for (const lx of legs) { ctx.save(); ctx.translate(lx - E.W / 2, 0); dust(ctx, c, k, 0, 0, st.q, 0.5); ctx.restore() }
        // 吊索：落下时拉着，落地后收上去
        const up = clamp((dt - 0.55) / 0.4)
        if (up < 1) {
          ctx.save(); ctx.globalAlpha *= st.a * (1 - up); ctx.strokeStyle = k.rail; ctx.lineWidth = 3 * u
          const hy = lerp(by - drop, -40 * u, E.ease.in(up))
          ctx.beginPath(); ctx.moveTo(E.W / 2, -10 * u); ctx.lineTo(E.W / 2, hy - 18 * u); ctx.moveTo(E.W / 2 - bw * 0.3, by - drop); ctx.lineTo(E.W / 2, hy - 18 * u); ctx.lineTo(E.W / 2 + bw * 0.3, by - drop); ctx.stroke()
          ctx.fillStyle = k.accent; ctx.fillRect(E.W / 2 - 16 * u, hy - 34 * u, 32 * u, 22 * u); ctx.restore()
        }
        ctx.save(); ctx.globalAlpha *= st.a; ctx.translate(E.W / 2, by + bh - drop); ctx.scale(2 - st.sq, st.sq); ctx.translate(-E.W / 2, -(by + bh))
        keycap(ctx, E, bx, by, bw, bh, { col: k.card, dz: 16 * u, r: 22 * u, line: k.line })
        // 牌子上沿一排小灯，落地后依次亮起
        for (let j = 0; j < 7; j++) { const on = clamp((dt - 0.5 - j * 0.06) / 0.1); ctx.fillStyle = mix(k.steel, j % 3 === 1 ? k.accent : k.accent2, on); ctx.beginPath(); ctx.arc(bx + bw / 2 + (j - 3) * 26 * u, by + 22 * u, 6 * u, 0, Math.PI * 2); ctx.fill() }
        const segs = hiSegs(f.lines, sc.highlight ? String(sc.highlight) : ''), q = clamp((dt - 0.45) / 0.35)
        ctx.font = E.font('title', 900, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        segs.forEach((sg, li) => {
          const yy = by + pad + li * f.lineH + f.lineH / 2, lw = sg.reduce((a, g) => a + ctx.measureText(g[0]).width, 0)
          let x = E.W / 2 - lw / 2
          for (const [txt, hi] of sg) {
            const w = ctx.measureText(txt).width
            if (hi && q > 0) { keycap(ctx, E, x - 8 * u, yy - f.size * 0.62, (w + 16 * u) * E.ease.out(q), f.size * 1.24, { col: k.accent, dz: 7 * u, r: 10 * u }); ctx.font = E.font('title', 900, f.size) }
            ctx.fillStyle = hi && q > 0.5 ? k.onAccent : k.fg; ctx.fillText(txt, x, yy); x += w
          }
        })
        ctx.restore()
      }
    },

    // 要点：一座机柜，每条是一层抽屉，依次推进去、灯亮起来；右边一列牌子用引线钉在各自那层
    bullets(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, n = sc.items.length, A = E.L.box
      const top = head(ctx, s, E, k, sc.title), R = { x: A.x, y: top, w: A.w, h: A.y + A.h - top }
      const fw = E.pick(1.9, 1.5), fd = E.pick(1.3, 1.05), gz = 0.16, base = 0.3, rw = R.w * E.pick(0.3, 0.4), yaw = 38
      const ptsOf = Ht => [[-fw / 2 - 0.2, fd / 2 + 0.2, 0], [fw / 2 + 0.2, -fd / 2 - 0.2, 0], [fw / 2 + 0.2, fd / 2 + 0.2, 0], [-fw / 2 - 0.2, -fd / 2 - 0.2, Ht + 0.2], [fw / 2 + 0.2, -fd / 2 - 0.2, Ht + 0.2], [-fw / 2 - 0.2, fd / 2 + 0.2, Ht + 0.2]]
      // 抽屉高度跟着地方走：机柜按宽度放满时，高度也正好放满
      const b0 = fitCam(ptsOf(base), { x: 0, y: 0, w: rw, h: 1e6 }, { yaw })
      const hu = clamp((R.h / (rw / b0.uw) - b0.uh) / (n * 0.866) - gz, 0.85, 1.5), Ht = base + n * (hu + gz) + 0.05, pts = ptsOf(Ht)
      const [c0, c] = cams(E, s, pts, { x: R.x, y: R.y, w: rw, h: R.h }, { yaw, ax: 0.6 })
      const zOf = i => base + (n - 1 - i) * (hu + gz), rowH = (hu + gz) * c0.cp * c0.s
      // 抽屉够高时牌子和抽屉对齐；条目多、抽屉矮时牌子在整个高度上均匀排开，引线斜着拉过去
      const rT = Math.min(R.h / n, 160 * u), even = rowH < E.pick(100, 120) * u, row = even ? rT : rowH
      const yRow = i => (even ? R.y + (R.h - rT * n) / 2 + rT * (i + 0.5) : P(c0, fw / 2, -fd * 0.1, zOf(i) + hu / 2)[1])
      const tx = R.x + rw + E.pick(80, 40) * u, tw = R.x + R.w - tx, bs = E.pick(46, 46) * u
      const fs = fitAll(E, sc.items, { role: 'body', weight: 700, size: Math.min(E.pick(50, 52) * u, row * 0.42), maxW: tw - bs - 70 * u, maxLines: 2, maxH: row * 0.86 - 30 * u, lineGap: 1.22 })
      let newest = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0) newest = i
      floorGrid(ctx, c, k, { R: 6, a: 0.1 })
      contact(ctx, c, 0, 0, fw, fd, 0.14)
      // 柜体：底座、背板、左侧板
      box(ctx, c, { x: 0, y: 0, z: 0, w: fw, d: fd, h: base - 0.04, col: k.dark, top: k.slate })
      box(ctx, c, { x: 0, y: -fd / 2 - 0.05, z: 0, w: fw, d: 0.1, h: Ht, col: k.steel, top: k.bodyTop })
      box(ctx, c, { x: -fw / 2 - 0.05, y: 0, z: 0, w: 0.1, d: fd + 0.1, h: Ht, col: k.steel, top: k.bodyTop })
      for (let i = n - 1; i >= 0; i--) {
        const p = s.p(i + 1), z = zOf(i)
        slot(ctx, c, k, 0, -fd / 2, fw, hu, 1 - clamp(p * 3), { axis: 'xz', t: s.t, z: z + hu })
        if (p <= 0) continue
        const e = E.ease.out(p), lit = clamp((s.t - s.cue(i + 1) - 0.4) / 0.15)
        ctx.save(); ctx.globalAlpha *= clamp(p * 3)
        drawer(ctx, c, k, (1 - e) * 2.4, 0.02, z, fw - 0.1, fd - 0.06, hu, lit, s.t, i, i === newest ? lit : 0)
        ctx.restore()
      }
      box(ctx, c, { x: -0.02, y: -0.02, z: Ht, w: fw + 0.14, d: fd + 0.14, h: 0.12, col: k.accent, top: k.violet })
      const Wd = new World(ctx, c)
      crate(Wd, k, -fw / 2 - 0.75, fd / 2 + 0.15, 0, 0.7, k.steel); crate(Wd, k, -fw / 2 - 0.75, fd / 2 + 0.15, 0.6, 0.56, k.violet)
      Wd.flush()
      sc.items.forEach((it, i) => {
        const p = s.p(i + 1), f = fs[i], z = zOf(i) + hu / 2
        const [ax, ay] = P(c, fw / 2 + 0.06, -fd * 0.1, z), yr = yRow(i), S = tagSize(E, f, { lead: bs + 22 * u })
        const q = clamp((s.t - s.cue(i + 1) - 0.2) / 0.4)
        lead(ctx, E, k, ax, ay, tx, yr, q, i === newest ? k.accent : undefined)
        tag(ctx, E, k, f, tx, yr - S.h / 2, { p: q, lead: bs + 22 * u })
        pop(ctx, q, tx, yr, () => { keycap(ctx, E, tx + S.padX * 0.6, yr - bs / 2 - 3 * u, bs, bs, { col: i === newest ? k.accent : k.fg, dz: 5 * u, r: 9 * u }); ctx.fillStyle = i === newest ? k.onAccent : k.bg; ctx.font = E.font('num', 800, bs * 0.56); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), tx + S.padX * 0.6 + bs / 2, yr - 2 * u) })
      })
    },

    // 一个大数字：一台大屏机柜，数字在屏上从 0 滚到目标值；label、note 是钉在屏幕下沿的牌子
    number(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, A = E.L.box
      let n = 1
      const il = sc.label ? n++ : -1, inn = sc.note ? n++ : -1
      const lab = sc.label && E.fit(sc.label, { role: 'body', weight: 700, size: E.pick(50, 52) * u, maxW: A.w * 0.8, maxLines: 2 })
      const note = sc.note && E.fit(sc.note, { role: 'body', weight: 500, size: E.pick(36, 38) * u, maxW: A.w * 0.7, maxLines: 2 })
      const lS = lab && tagSize(E, lab), nS = note && tagSize(E, note)
      const below = (lab ? lS.h + E.pick(56, 70) * u : 0) + (note ? nS.h + 22 * u : 0)
      const sw = E.pick(6.6, 5.0), sh = E.pick(3.0, 3.6), dep = 0.8, leg = 0.5, side = E.pick(1.6, 0.8)
      const pts = [[-sw / 2 - side, -dep / 2, 0], [sw / 2 + side, -dep / 2, 0], [sw / 2 + side, dep / 2 + 0.9, 0], [-sw / 2 - side, dep / 2 + 0.9, 0], [-sw / 2, -dep / 2, leg + sh + 0.4], [sw / 2, -dep / 2, leg + sh + 0.4]]
      const yaw = E.pick(20, 24), probe = fitCam(pts, { x: A.x, y: A.y, w: A.w, h: A.h - below }, { yaw })
      const R = { x: A.x, y: A.y + (A.h - below - probe.bh) / 2, w: A.w, h: probe.bh }
      const [, c] = cams(E, s, pts, R, { yaw, orb: 2 })
      floorGrid(ctx, c, k, { R: 9, a: 0.1 })
      const W = new World(ctx, c)
      for (const sx of [-1, 1]) { const x = sx * (sw / 2 + side - 0.6), y = E.pick(0.3, 1.0); crate(W, k, x, y, 0, 0.8, k.steel); crate(W, k, x, y, 0.69, 0.62, sx > 0 ? k.violet : k.steel) }
      W.flush()
      contact(ctx, c, 0, 0, sw, dep, 0.14)
      for (const lx of [-sw * 0.32, sw * 0.32]) box(ctx, c, { x: lx, y: 0, z: 0, w: 0.3, d: 0.4, h: leg + 0.1, col: k.rail })
      box(ctx, c, { x: 0, y: 0, z: leg, w: sw, d: dep, h: sh, col: k.body, top: k.bodyTop })
      for (let j = 0; j < 3; j++) { const on = Math.sin(s.t * 4 + j * 2.1) > 0; box(ctx, c, { x: sw / 2 - 0.4 - j * 0.32, y: 0, z: leg + sh, w: 0.18, d: 0.18, h: 0.12, col: on ? (j ? k.accent : k.accent2) : k.rail, edge: null }) }
      // 屏幕：朝 +y 的立面；1 格 = 100 字号单位
      const ix = 0.22, iz = 0.22, iw = (sw - ix * 2) * 100, ih = (sh - iz * 2) * 100, on = clamp((s.t - s.cue(0)) / 0.25)
      faceText(ctx, c, -sw / 2 + ix, dep / 2 + 0.002, leg + sh - iz, 'xz', g => {
        roundRect(g, 0, 0, iw, ih, 10); g.fillStyle = k.dark; g.fill()
        g.save(); roundRect(g, 0, 0, iw, ih, 10); g.clip()
        g.fillStyle = rgba(k.accent, 0.12 * on); g.fillRect(0, 0, iw, ih)
        g.fillStyle = rgba('#000000', 0.18); for (let y = 0; y < ih; y += 9) g.fillRect(0, y, iw, 3)
        if (on > 0) {
          const str = String(sc.value), us = ih * 0.2
          g.font = E.font('body', 800, us); const uw = sc.unit ? g.measureText(sc.unit).width + 18 : 0
          // 屏幕窄（竖屏）时按宽度定字号：先量 100 号字有多宽
          g.font = E.font('num', 800, 100); const sz = Math.min(ih * 0.66, (iw * 0.88 - uw) / g.measureText(str).width * 100)
          const f = E.fit(str, { role: 'num', weight: 800, size: sz, maxW: iw * 0.88 - uw, maxLines: 1, minSize: sz * 0.5, lineGap: 1 })
          const shown = rolling(sc.value, clamp((s.t - s.cue(0)) / Math.min(1.4, s.dur * 0.35)))
          g.font = E.font('num', 800, f.size); const wn = g.measureText(str).width, x0 = iw / 2 - (wn + uw) / 2
          g.globalAlpha = on * (0.85 + 0.15 * Math.sin(s.t * 40) * (1 - on)); g.textBaseline = 'middle'
          g.shadowColor = k.violet; g.shadowBlur = 24; g.fillStyle = k.scr; g.textAlign = 'right'; g.fillText(shown, x0 + wn, ih / 2 + 6)
          if (sc.unit) { g.font = E.font('body', 800, us); g.textAlign = 'left'; g.fillStyle = k.scr2; g.fillText(sc.unit, x0 + wn + 18, ih / 2 + f.size * 0.22) }
        }
        g.restore()
        const sweep = clamp((s.t - s.cue(0)) / 0.5)
        if (sweep > 0 && sweep < 1) { g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(0, ih * sweep - 8, iw, 16) }
      })
      // 牌子：label 钉在屏幕下沿，note 在它下面
      const [ax, ay] = P(c, 0, dep / 2, leg)
      let y = R.y + R.h + E.pick(56, 70) * u
      if (lab) {
        const p = s.p(il)
        lead(ctx, E, k, ax, ay, E.W / 2, y, p)
        tag(ctx, E, k, lab, E.W / 2 - lS.w / 2, y, { p, align: 'center' }); y += lS.h + 22 * u
      }
      if (note) tag(ctx, E, k, note, E.W / 2 - nS.w / 2, y, { p: s.p(inn), kind: 'ghost', align: 'center', weight: 500 })
    },

    // 柱状图：一排等轴测方柱立在各自的地砖上，按数值升起；数值牌浮在柱顶，标签写在地砖前
    bars(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, n = sc.items.length, A = E.L.box, por = E.portrait
      const top = head(ctx, s, E, k, sc.title)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals)), dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const valTag = (i, e, x, y, align) => {
        const vf = E.fit(formatNumber(vals[i] * e, dec) + unit, { role: 'num', weight: 800, size: 40 * u, maxW: 260 * u, maxLines: 1, silent: true }), vS = tagSize(E, vf, { padX: 16 * u, padY: 8 * u })
        tag(ctx, E, k, vf, align === 'left' ? x : x - vS.w / 2, align === 'left' ? y - vS.h / 2 : y - vS.h, { p: clamp(s.p(i + 1) * 2), kind: i === hi ? 'accent' : 'light', padX: 16 * u, padY: 8 * u, role: 'num', weight: 800 })
      }
      if (por) {
        // 竖屏：一根立柱上挑出一层层横梁，按数值往右伸出来；标签在立柱左边一列，数值牌挂在梁头
        const R = { x: A.x, y: top + 10 * u, w: A.w, h: A.y + A.h - top - 10 * u }, valW = 190 * u, Lm = 5, bd = 1.1, bh = 0.7, yaw = 14
        const lf = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 700, size: 44 * u, maxW: R.w * 0.28, maxLines: 2, maxH: R.h / n * 0.7, lineGap: 1.18 })
        const labW = Math.max(...lf.map(f => f.width)) + 26 * u, WR = { x: R.x + labW, y: R.y, w: R.w - labW - valW, h: R.h }
        const b0 = fitCam([[-0.6, -bd / 2, 0], [Lm, bd / 2, 0], [-0.6, bd / 2, bh], [Lm, -bd / 2, bh]], { x: 0, y: 0, w: WR.w, h: 1e6 }, { yaw })
        const zg = Math.max(bh + 0.6, R.h / n / (0.866 * b0.s)), zOf = i => (n - 1 - i) * zg + 0.4, Ht = zOf(0) + bh + 0.35
        const pts = [[-0.6, -bd / 2 - 0.1, 0], [Lm, bd / 2, 0], [-0.6, bd / 2 + 0.3, 0], [Lm, -bd / 2, 0], [-0.6, -bd / 2, Ht + 0.12], [Lm, -bd / 2, zOf(0) + bh]]
        const [c0, c] = cams(E, s, pts, WR, { yaw, orb: 2, ax: 0 })
        floorGrid(ctx, c, k, { x: Lm / 2, R: 8, a: 0.1 })
        contact(ctx, c, -0.3, 0, 0.7, bd + 0.4, 0.14)
        box(ctx, c, { x: -0.3, y: 0, z: 0, w: 0.5, d: bd + 0.4, h: Ht, col: k.steel, top: k.bodyTop })
        box(ctx, c, { x: -0.3, y: 0, z: Ht, w: 0.7, d: bd + 0.6, h: 0.12, col: k.accent, top: k.violet })
        for (let i = n - 1; i >= 0; i--) {
          const p = s.p(i + 1), e = E.ease.out(p), L = Math.max(0.05, Lm * vals[i] / max * e), z = zOf(i), col = i === hi ? k.accent : k.rail
          slot(ctx, c, k, Lm / 2, 0, Lm, bd, 1 - clamp(p * 2), { z: z + bh, t: s.t, col: k.slate })
          if (p <= 0) continue
          box(ctx, c, { x: L / 2, y: 0, z, w: L, d: bd, h: bh, col, top: shade(col, 1.12) })
          ctx.save(); plane(ctx, c, 0, bd / 2 + 0.002, z + bh, 'xz'); ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.lineWidth = 0.025
          ctx.beginPath(); for (let x = 0.5; x < L - 0.05; x += 0.5) { ctx.moveTo(x, 0.06); ctx.lineTo(x, x % 1 === 0 ? bh * 0.55 : bh * 0.3) } ctx.stroke(); ctx.restore()
          const ly = P(c0, 0, 0, z + bh / 2)[1], f = lf[i]
          ctx.save(); ctx.globalAlpha *= clamp(p * 2); words(ctx, E, f, WR.x - 26 * u, ly - f.lines.length * f.lineH / 2, 'right', i === hi ? k.accent : k.fg); ctx.restore()
          const [vx, vy] = P(c, L, 0, z + bh / 2)
          valTag(i, e, vx + 18 * u, vy, 'left')
        }
        return
      }
      const labH = E.pick(96, 110) * u, valH = E.pick(80, 84) * u
      const R = { x: A.x, y: top + valH, w: A.w, h: A.y + A.h - top - valH - labH }
      // 柱子沿世界里 (1, -1) 的方向排开：yaw 45 时正好是屏幕上的一横排
      const g = 1.6, tile = 1.25, cw = 0.86, span = (n - 1) * g * Math.SQRT2 + tile * Math.SQRT2
      const s0 = R.w / span, hM = Math.max(1.5, (R.h / s0 - tile * 0.72) / 0.866)
      const at = i => { const d = (i - (n - 1) / 2) * g / Math.SQRT2; return [d, -d] }
      const pts = []
      for (let i = 0; i < n; i++) { const [x, y] = at(i); pts.push([x - tile / 2, y - tile / 2, 0], [x + tile / 2, y + tile / 2, 0], [x - tile / 2, y + tile / 2, 0], [x + tile / 2, y - tile / 2, 0], [x, y, hM + 0.12]) }
      const [c0, c] = cams(E, s, pts, R, { yaw: 45, orb: 2, ay: 1 })
      floorGrid(ctx, c, k, { R: Math.max(8, n * 1.4), a: 0.1 })
      const W = new World(ctx, c)
      const slotW = g * c0.s * 0.96
      const lf = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 700, size: E.pick(38, 38) * u, maxW: slotW, maxLines: 2, maxH: labH - 16 * u, lineGap: 1.18 })
      sc.items.forEach((it, i) => {
        const [x, y] = at(i), p = s.p(i + 1), e = E.ease.out(p), h = hM * vals[i] / max * e
        W.obj(x, y, 0.05, () => box(ctx, c, { x, y, z: 0, w: tile, d: tile, h: 0.12, col: i === hi ? k.lilac2 : k.steel, top: i === hi ? k.lilac : k.bodyTop }), -1)
        if (p <= 0) W.ground(() => slot(ctx, c, k, x, y, cw, cw, 1, { z: 0.13, t: s.t }))
        else column(W, k, x, y, Math.max(0.02, h), cw, i === hi ? k.accent : k.rail, i === hi && p >= 1, s.t)
      })
      W.flush()
      sc.items.forEach((it, i) => {
        const [x, y] = at(i), p = s.p(i + 1), e = E.ease.out(p), h = hM * vals[i] / max * e
        if (p <= 0) return
        const [vx, vy] = P(c, x, y, 0.12 + h), [lx, ly] = P(c, x + tile / 2, y + tile / 2, 0)
        valTag(i, e, vx, vy - 22 * u, 'center')
        ctx.save(); ctx.globalAlpha *= clamp(p * 2); words(ctx, E, lf[i], lx, ly + 14 * u, 'center', i === hi ? k.accent : k.fg); ctx.restore()
      })
    },

    // 流程：一条传送带上的几座门架，依次落位；一只货箱沿带子走到最新的一站。横屏牌子立在门架上方，竖屏带子竖着走、牌子在右边
    steps(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, n = sc.items.length, A = E.L.box, por = E.portrait
      const top = head(ctx, s, E, k, sc.title), R = { x: A.x, y: top, w: A.w, h: A.y + A.h - top }
      const D = 3.2, AH = 2.0, xs = i => i * D, B = { x0: -1.4, x1: (n - 1) * D + 1.4, y: 0 }
      const pts = [[B.x0, -0.9, 0], [B.x1, 0.9, 0], [B.x0, 0.9, 0], [B.x1, -0.9, 0], [0, 0.66, AH + 0.75], [B.x1 - 1.4, 0.66, AH + 0.75]]
      let cur = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0) cur = i
      // 先量牌子，再给机器留地方
      // 横屏牌子一字排开在各站上方：宽度不超过两站的间距（扣掉牌子自己的内边距）
      const fsz = E.pick(46, 48) * u, tagO = por ? { maxW: R.w * 0.5, maxLines: 3 } : { maxW: Math.min(R.w * D / ((n - 1) * D + 3.8) - fsz * 1.24 - 24 * u, 480 * u), maxLines: 3 }
      const fs = fitAll(E, sc.items, { role: 'body', weight: 700, size: fsz, ...tagO, lineGap: 1.22 })
      const tagH = Math.max(...fs.map(f => tagSize(E, f).h))
      const WR = por ? { x: R.x, y: R.y, w: R.w * 0.44, h: R.h } : { x: R.x, y: R.y + tagH + 40 * u, w: R.w, h: R.h - tagH - 40 * u }
      const [c0, c] = cams(E, s, pts, WR, por ? { yaw: 83, orb: 2, ax: 0.3 } : { yaw: 17, orb: 2 })
      const lands = sc.items.map((_, i) => s.cue(i + 1) + LAND)
      c.cy += shake(s.t, lands, u, 4)
      floorGrid(ctx, c, k, { x: (B.x0 + B.x1) / 2, R: (B.x1 - B.x0) * 0.7, a: 0.1 })
      const W = new World(ctx, c)
      belt(W, k, B, PRESENT, s.t, { run: 0.6 })
      // 货箱：停在最新到达的那一站，新的一站落位时沿带子走过去
      const from = cur <= 0 ? B.x0 + 0.5 : xs(cur - 1), to = cur < 0 ? B.x0 + 0.5 : xs(cur), mv = cur < 0 ? 0 : E.ease.inOut(clamp((s.t - s.cue(cur + 1)) / 0.7))
      const bx = lerp(from, to, mv), bump = Math.abs(Math.sin(mv * Math.PI)) * 0.08
      crate(W, k, bx, 0, 0.26 + bump, 0.62, k.accent)
      const nf = E.font('num', 800, 34)
      sc.items.forEach((_, i) => {
        const dt = s.t - s.cue(i + 1), st = fall(dt, 4), lit = clamp((dt - 0.6) / 0.2) * (i <= cur ? 1 : 0)
        if (st.a <= 0) W.ground(() => slot(ctx, c, k, xs(i), 0, 0.6, 1.8, 1, { t: s.t, col: k.slate }))
        arch(W, k, xs(i), 0, st, { lit, hl: i === cur ? lit : 0, num: i + 1, font: nf, H: AH, faceX: por })
      })
      W.flush()
      sc.items.forEach((it, i) => {
        const q = clamp((s.t - s.cue(i + 1) - 0.25) / 0.4), f = fs[i], S = tagSize(E, f)
        const py = por ? 0 : 0.66, px = xs(i) + (por ? 0.14 : 0), [ax, ay] = P(c, px, py, AH + 0.75), [x0, y0] = P(c0, px, py, AH + 0.75)
        let tx, ty
        if (por) { tx = R.x + R.w * 0.47; ty = clamp(y0 - S.h / 2, R.y, R.y + R.h - S.h) } else { tx = clamp(x0 - S.w / 2, R.x, R.x + R.w - S.w); ty = Math.min(y0 - S.h - 40 * u, R.y + tagH - S.h) }
        lead(ctx, E, k, ax, ay, por ? tx : tx + S.w / 2, por ? ty + S.h / 2 : ty + S.h, q, i === cur ? k.accent : undefined)
        tag(ctx, E, k, f, tx, ty, { p: q, kind: 'light', align: por ? 'left' : 'center' })
      })
    },

    // 对比：两条生产线。左边一条普通的（灰色方块、门架不亮），右边一条装了盖章检查站和记录仪（强调色方块，盖章带勾）
    compare(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, A = E.L.box, por = E.portrait
      const top = head(ctx, s, E, k, sc.title), gap = E.pick(70, 40) * u, avail = A.y + A.h - top
      const halves = por ? [[A.x, top, A.w, (avail - gap) / 2], [A.x, top + (avail + gap) / 2, A.w, (avail - gap) / 2]] : [[A.x, top, (A.w - gap) / 2, avail], [A.x + (A.w + gap) / 2, top, (A.w - gap) / 2, avail]]
      const sides = [sc.left, sc.right]
      const tfs = sides.map(sd => E.fit(sd.title, { role: 'title', weight: 900, size: E.pick(48, 48) * u, maxW: (por ? A.w * 0.5 : halves[0][2]) - 60 * u, maxLines: 1 }))
      const tH = Math.max(...tfs.map(f => tagSize(E, f).h)), most = Math.max(1, ...sides.map(sd => (sd.items || []).length))
      const geo = halves.map(([x, y, w, h], i) => {
        const items = sides[i].items || [], lh = clamp(most * 82 * u, h * 0.32, h * 0.5)   // 横屏下半截给条目，条目多就多给
        const WR = por ? { x, y: y + tH + 16 * u, w: w * 0.5, h: h - tH - 16 * u } : { x: x + w * 0.04, y: y + tH + 16 * u, w: w * 0.92, h: h - lh - tH - 32 * u }
        const L = por ? { x: x + w * 0.53, y: y + tH + 24 * u, w: w * 0.47, h: h - tH - 24 * u } : { x: x + 20 * u, y: y + h - lh, w: w - 40 * u, h: lh }
        const rowH = Math.min(L.h / Math.max(1, items.length), 130 * u)
        return { WR, L, items, rowH, o: { role: 'body', weight: 700, size: Math.min(E.pick(44, 44) * u, rowH * 0.46), maxW: L.w - 70 * u, maxLines: 2, maxH: rowH * 0.94, lineGap: 1.2 } }
      })
      const all = fitAll(E, geo.flatMap(g => g.items), geo.flatMap(g => g.items.map(() => g.o)))
      const B = { x0: -2.4, x1: 2.9, y: 0 }, pts = [[-3.7, -1.9, 0], [3.0, -1.9, 0], [3.0, 0.6, 0], [-3.7, 0.6, 0], [-3.0, 0, 1.9], [1.0, -1.3, 1.6]]
      sides.forEach((side, i) => {
        const G = geo[i], strong = i === 1, p = s.p(i + 1), t0 = s.cue(i + 1)
        if (p <= 0) { const [x, y, w, h] = halves[i]; ctx.save(); ctx.setLineDash([12 * u, 10 * u]); ctx.strokeStyle = rgba(k.muted, 0.5); ctx.lineWidth = 2.5 * u; roundRect(ctx, x, y, w, h, 24 * u); ctx.stroke(); ctx.restore(); return }
        const [, c] = cams(E, s, pts, G.WR, { yaw: E.pick(32, 52), orb: 2, dy: shake(s.t, landsOf(t0, 4, 0.09), u, 3) })
        floorGrid(ctx, c, k, { R: 5.5, a: 0.1 })
        const W = new World(ctx, c), st = drops(s.t, t0, 4, 0.09)
        const cs = stream(s.t, B, { t0: t0 + 0.4, period: strong ? 0.8 : 1.1, stop: strong ? 1.0 : null, V: strong ? 2.4 : 1.6 })
        let stamp = -1
        for (const q of cs) if (q.stamp >= 0) stamp = q.stamp
        belt(W, k, B, st[0], s.t, { run: strong ? 1.1 : 0.7 })
        feeder(W, k, -3.0, 0, st[1], s.t)
        if (strong) { press(W, k, 1.0, 0, st[2], stamp, stamp >= 0 ? 'ok' : 'on'); recorder(W, k, -0.9, -1.6, st[3], s.t) }
        else { arch(W, k, 1.0, 0, st[2], { lit: 0, H: 1.3 }); crate(W, k, -0.9, -1.5, st[3].z, 0.75, k.steel, st[3].a) }
        if (st[0].a > 0.5) for (const q of cs) cube(W, k, q, strong ? (q.mark ? k.accent2 : k.violet) : k.slate, st[0].z)
        W.flush()
        const tf = tfs[i], tS = tagSize(E, tf), [x, y, w] = halves[i]
        const tx = por ? x : x + w / 2 - tS.w / 2
        tag(ctx, E, k, tf, tx, y, { p, kind: strong ? 'accent' : 'dark', role: 'title', weight: 900 })
        const fsI = i ? all.slice(geo[0].items.length) : all.slice(0, geo[0].items.length), iy = G.L.y + (por ? (G.L.h - G.rowH * fsI.length) / 2 : 0)
        fsI.forEach((f, j) => {
          const q = clamp((s.t - t0 - 0.25 - j * 0.12) / 0.35), cy = iy + G.rowH * j + G.rowH / 2
          pop(ctx, q, G.L.x, cy, () => {
            miniCube(ctx, k, G.L.x + 18 * u, cy - 14 * u, 17 * u, strong ? k.accent : k.slate, strong)
            words(ctx, E, f, G.L.x + 56 * u, cy - f.lines.length * f.lineH / 2, 'left', k.fg)
          })
        })
      })
      // 两条线中间：一道虚线
      ctx.save(); ctx.setLineDash([10 * u, 12 * u]); ctx.strokeStyle = rgba(k.muted, 0.35); ctx.lineWidth = 2 * u; ctx.beginPath()
      if (por) { const y = top + avail / 2; ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y) } else { const x = A.x + A.w / 2; ctx.moveTo(x, top); ctx.lineTo(x, A.y + A.h) }
      ctx.stroke(); ctx.restore()
    },

    // 引语：一台记录仪把话「打」出来——白色大牌用引线钉在它的屏幕上，左上角一块强调色键帽是引号；出处是深色牌
    quote(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, A = E.L.box, por = E.portrait
      const cw = por ? A.w : A.w * 0.6, pad = E.pick(60, 50) * u
      const f = E.fit(sc.text, { role: 'title', weight: 700, size: E.pick(68, 64) * u, maxW: cw - pad * 2, maxLines: E.pick(5, 6), maxH: A.h * E.pick(0.7, 0.5), lineGap: 1.4 })
      const by = sc.by && E.fit('— ' + sc.by, { role: 'body', weight: 700, size: E.pick(36, 38) * u, maxW: cw * 0.8, maxLines: 1 })
      const ch = f.lines.length * f.lineH + pad * 2, bS = by && tagSize(E, by)
      const cx = por ? A.x : A.x + A.w - cw, cy = por ? A.y + 40 * u : A.y + (A.h - ch - (by ? bS.h + 30 * u : 0)) / 2
      const WR = por ? { x: A.x, y: cy + ch + (by ? bS.h + 60 * u : 60 * u), w: A.w * 0.9, h: A.y + A.h - cy - ch - (by ? bS.h + 60 * u : 60 * u) } : { x: A.x, y: A.y + A.h * 0.18, w: A.w * 0.34, h: A.h * 0.82 }
      const pts = [[-4.4, -1.2, 0], [1.4, -1.2, 0], [1.4, 1.2, 0], [-4.4, 1.2, 0], [0, 0, 2.2]]
      const [, c] = cams(E, s, pts, WR, { yaw: 36, orb: 2 })
      floorGrid(ctx, c, k, { x: -1.5, R: 6, a: 0.1 })
      const W = new World(ctx, c), B = { x0: -4.2, x1: -0.9, y: 0.1 }
      belt(W, k, B, PRESENT, s.t)
      for (const q of stream(s.t, B, { t0: -4, period: 0.7 })) cube(W, k, q, k.violet)
      recorder(W, k, 0, 0, PRESENT, s.t, { w: 1.7, h: 1.9, hl: clamp(s.p(0) * 2) * 0.6 })
      W.flush()
      const p = s.p(0), [ax, ay] = P(c, 0, 0.45, 1.3)
      lead(ctx, E, k, ax, ay, por ? cx + cw * 0.72 : cx, por ? cy + ch : cy + ch * 0.6, p, k.accent)
      pop(ctx, p, cx + cw / 2, cy + ch / 2, () => {
        board(ctx, E, k, cx, cy, cw, ch, 'light', 28 * u)
        // 逐行打出来
        const shown = Math.min(f.lines.length, Math.floor((s.t - s.cue(0)) / 0.12) + 1)
        words(ctx, E, { ...f, lines: f.lines.slice(0, shown) }, cx + cw / 2, cy + pad, 'center', k.fg, 'title', 700)
        const qs = 76 * u
        keycap(ctx, E, cx - qs * 0.3, cy - qs * 0.45, qs, qs, { col: k.accent, dz: 8 * u, r: 14 * u })
        ctx.fillStyle = k.onAccent; ctx.font = E.font('title', 900, qs * 1.1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('“', cx + qs * 0.2, cy - qs * 0.45 + qs * 0.62)
      })
      if (by) tag(ctx, E, k, by, por ? cx : cx + cw - bS.w, cy + ch + 24 * u, { p: s.p(1), kind: 'dark' })
    },

    // 片尾：整座机房运转起来，四周的围栏一节节升起；标题落下，按钮是一枚会被按下去的强调色键帽
    end(ctx, s, E) {
      const k = K(this), u = E.u, sc = s.scene, A = E.L.box
      let n = 0
      const it = n++, is = sc.subtitle ? n++ : -1, ic = sc.cta ? n++ : -1
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(116, 104) * u, maxW: A.w * 0.9, maxLines: 3, lineGap: 1.16, oneLine: true })
      const sub = sc.subtitle && E.fit(sc.subtitle, { role: 'body', weight: 500, size: E.pick(46, 44) * u, maxW: A.w * 0.8, maxLines: 2 })
      const cta = sc.cta && E.fit(sc.cta, { role: 'body', weight: 800, size: E.pick(44, 44) * u, maxW: A.w * 0.6, maxLines: 1 })
      const hT = big.lines.length * big.lineH, hS = sub ? sub.lines.length * sub.lineH + 26 * u : 0, cS = cta && tagSize(E, cta, { padX: 56 * u, padY: 22 * u }), hC = cta ? cS.h + 40 * u : 0
      const pts = LINE_PTS.concat([[-6.3, -3.7, 0], [6.3, 1.7, 0]]), yaw = E.pick(28, 56), [y0, R] = stack(E, hT + hS + hC, E.pick(36, 60) * u, pts, yaw)
      const [, c] = cams(E, s, pts, R, { yaw, orb: 3 })
      floorGrid(ctx, c, k, { R: 9 })
      const W = new World(ctx, c)
      factory(W, k, s.t, () => PRESENT, { tools: true, fence: clamp((s.t - 0.2) / 1.4), fenceHL: E.inOut(s.t, 1.4, 3.2, 0.3, 0.6) })
      W.flush()
      const cx = E.W / 2
      dropIn(ctx, E, s.t - s.cue(it), cx, y0 + hT, () => words(ctx, E, big, cx, y0, 'center', k.fg, 'title', 900))
      let y = y0 + hT
      if (sub) { pop(ctx, s.p(is), cx, y + hS / 2, () => words(ctx, E, sub, cx, y + 26 * u, 'center', k.muted, 'body', 500)); y += hS }
      if (cta) {
        const p = s.p(ic), yy = y + 40 * u, press = Math.max(0, Math.sin((s.t - s.cue(ic) - 0.6) * 3.2)) ** 8 * (p >= 1 ? 1 : 0), dz = 12 * u
        pop(ctx, p, cx, yy + cS.h / 2, () => {
          keycap(ctx, E, cx - cS.w / 2, yy + press * dz * 0.7, cS.w, cS.h, { col: k.accent, dz: dz * (1 - press * 0.7), r: cS.h * 0.3 })
          words(ctx, E, cta, cx, yy + cS.padY + press * dz * 0.7, 'center', k.onAccent, 'body', 800)
        })
      }
    },
  },

  // 字幕：白色圆角底板，细边，柔和投影，深色字，最多两行
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const { W, H, u } = E, c = this.c
    const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(x => textUnits(x)), total = lens.reduce((a, b) => a + b, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const a = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 500, size: E.pick(40, 44) * u, maxW: W - E.safe.l * 2 - 60 * u, maxLines: 2, lineGap: 1.42, quiet: true })
    const padX = 30 * u, padY = 16 * u, w = f.width + padX * 2, h = f.lines.length * f.lineH + padY * 2 - (f.lineH - f.size) * 0.6
    const cy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0), x = W / 2 - w / 2, y = cy - h / 2
    ctx.globalAlpha = a
    ctx.save(); ctx.shadowColor = 'rgba(40,36,80,0.14)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 6 * u
    roundRect(ctx, x, y, w, h, 18 * u); ctx.fillStyle = rgba(c.card, 0.92); ctx.fill(); ctx.restore()
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = c.line; roundRect(ctx, x, y, w, h, 18 * u); ctx.stroke()
    ctx.fillStyle = c.fg; ctx.font = E.font('body', 500, f.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    f.lines.forEach((ln, i) => ctx.fillText(ln, W / 2, cy + (i - (f.lines.length - 1) / 2) * f.lineH + f.size * 0.03))
  },

  // 最上层：左上角一块小铭牌，状态灯 + LINE 编号，后面一排小方块标出走到第几场
  overlay(ctx, E) {
    const u = E.u, k = K(this), x = E.pick(40, 48) * u, y = E.pick(34, 70) * u, h = 40 * u
    ctx.globalAlpha = 0.9 * clamp(E.T / 0.6)
    ctx.font = E.font('mono', 600, 20 * u); const label = 'LINE ' + String(E.sceneIndex + 1).padStart(2, '0'), tw = ctx.measureText(label).width
    const n = E.sceneCount, w = 46 * u + tw + 18 * u + n * 16 * u
    board(ctx, E, k, x, y, w, h, 'light', h / 2)
    const on = Math.sin(E.T * 5) > -0.3
    ctx.fillStyle = on ? k.accent2 : k.steel; ctx.beginPath(); ctx.arc(x + 24 * u, y + h / 2, 7 * u, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = k.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 40 * u, y + h / 2 + 1 * u)
    for (let i = 0; i < n; i++) { ctx.fillStyle = i < E.sceneIndex ? k.violet : i === E.sceneIndex ? k.accent : k.steel; ctx.fillRect(x + 40 * u + tw + 16 * u + i * 16 * u, y + h / 2 - 5 * u, 10 * u, 10 * u) }
  },

  // 转场：沿等轴测斜线（1:2）切成九条，依次翻开
  transitionDur: 0.5,
  transition(ctx, A, B, p, E) {
    const { W, H } = E, nb = 9, bw = (W + H * 2) / nb
    ctx.drawImage(A, 0, 0)
    ctx.save(); ctx.beginPath()
    for (let j = 0; j < nb; j++) {
      const f = E.ease.inOut(clamp(p * 1.7 - (j / nb) * 0.7))
      if (f <= 0) continue
      const x0 = -H * 2 + j * bw + bw * (1 - f) / 2, x1 = x0 + bw * f + 1
      ctx.moveTo(x0, H); ctx.lineTo(x1, H); ctx.lineTo(x1 + 2 * H, 0); ctx.lineTo(x0 + 2 * H, 0); ctx.closePath()
    }
    ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore()
  },

  // 默认版式会借用的零件（九种版式都重画了，这些只在别处借用默认摆法时用到）
  card(ctx, E, x, y, w, h, o = {}) { const k = K(this); keycap(ctx, E, x, y, w, h, { col: o.tone === 'accent' ? k.accent : k.card, dz: 10 * E.u, r: 18 * E.u, line: o.tone === 'accent' ? undefined : k.line }) },
  bar(ctx, E, x, y, w, h, o = {}) { const col = o.color ?? this.c.accent; ctx.save(); ctx.fillStyle = shade(col, 0.75); ctx.fillRect(x + 8 * E.u, y - 8 * E.u, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, w, h); ctx.restore() },
  mark(ctx, E, x, y, r, i, o = {}) { miniCube(ctx, K(this), x, y - r * 0.2, r * 0.9, o.color ?? this.c.accent) },
  underline(ctx, E, x, y, w, p) { if (p > 0) keycap(ctx, E, x, y - 4 * E.u, w * p, 10 * E.u, { col: this.c.accent, dz: 4 * E.u, r: 3 * E.u }) },

  music: { style: 'calm', prog: ['Dm9', 'Bbmaj7', 'Fadd9', 'Csus4'], lead: 'epiano', drums: true },
  sfx: { enter: 'tick', cut: 'whoosh', accent: 'chime' },
  // 落位的闷响：片头整条线落地、一句话的牌子着地、流程里每座门架落位
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      if (S.layout === 'title' || S.layout === 'end') out.push({ t: S.t0 + 0.08 + LAND, kind: 'thud', gain: 0.45 })
      if (S.layout === 'statement') out.push({ t: S.t0 + S.cues[0] + LAND, kind: 'thud', gain: 0.55 })
      if (S.layout === 'steps') S.cues.slice(1).forEach(c => out.push({ t: S.t0 + c + LAND, kind: 'thud', gain: 0.3 }))
      if (S.layout === 'compare') S.cues.slice(1).forEach(c => out.push({ t: S.t0 + c + LAND, kind: 'thud', gain: 0.35 }))
    }
    return out
  },
}
