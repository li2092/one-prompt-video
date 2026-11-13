// 机房零件：传送带、带上的方块流、送料机、盖章检查站、门架、工具架、记录仪、围栏、货箱。
// 移植自风格库的 D-等轴测机房（lib/machine.mjs）。原来各模块钉在一张固定的布局里，这里改成可以摆在任意位置的零件；
// 颜色全部从调色板 k 取。每个零件的状态是 { a, z, sq, q }（见 iso.fall），零件只管画，不管什么时候出现。
import { clamp, lerp, ease, rgba, roundRect, mix } from '../../../core.mjs'
import { P, box, plane, contact, dust, glow, shade } from './iso.mjs'

export const BT = 0.26   // 传送带顶面高度
export const MSG = 0.42  // 方块边长
const sq = (h, s) => h * (s.sq ?? 1)
const hlEdge = (k, hl) => (hl > 0.001 ? { edge: rgba(k.accent, 0.25 + 0.65 * hl), lw: 1.5 + 2.5 * hl } : {})

// ---------- 传送带（沿 x）：B = { x0, x1, y, w? } ----------
export function belt(W, k, B, st, t, o = {}) {
  if (st.a <= 0.002) return
  const ctx = W.ctx, c = W.c, len = B.x1 - B.x0, cx = (B.x0 + B.x1) / 2, bw = B.w ?? 0.9, z = st.z, h = sq(0.26, st)
  W.ground(() => {
    ctx.globalAlpha *= st.a
    contact(ctx, c, cx, B.y, len, bw, 0.08)
    box(ctx, c, { x: cx, y: B.y, z, w: len, d: bw, h, col: k.steel, top: k.belt, ...hlEdge(k, o.hl ?? 0) })
    // 履带纹路往前走
    ctx.save(); plane(ctx, c, B.x0, B.y - bw / 2, z + h)
    ctx.beginPath(); ctx.rect(0.05, 0.08, len - 0.1, bw - 0.16); ctx.clip()
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.05
    const sp = 0.4, off = ((t * 2.2 * (o.run ?? 1)) % sp + sp) % sp
    ctx.beginPath(); for (let x = off - sp; x < len + sp; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, bw) } ctx.stroke()
    ctx.restore()
    box(ctx, c, { x: cx, y: B.y - bw / 2 - 0.03, z: z + h - 0.02, w: len, d: 0.07, h: 0.08, col: k.rail, edge: null })
  })
  // 前侧导轨压在方块下沿之上
  W.obj(cx, B.y + bw / 2 + 0.03, z + 0.2, () => box(ctx, c, { x: cx, y: B.y + bw / 2 + 0.03, z: z + h - 0.02, w: len, d: 0.07, h: 0.08, col: k.rail, edge: null, alpha: st.a }), -0.6)
  if (st.q > 0 && st.q < 1) W.ground(() => dust(ctx, c, k, cx, B.y, st.q, len * 0.3))
}

// ---------- 带上的方块流 ----------
// 每 period 秒从 x0 出一个，速度 V；stop 处停 pause 秒（盖章），盖过的带勾。返回每块的位置和状态
export function stream(t, B, { t0 = -8, period = 0.9, V = 2.2, stop = null, pause = 0.26, from = 0 } = {}) {
  const out = [], len = B.x1 - B.x0, kmax = Math.floor((t - t0) / period)
  for (let n = Math.max(from, kmax - 14); n <= kmax; n++) {
    const age = t - (t0 + n * period)
    if (age < 0) continue
    let d = V * age, stamp = -1, mark = false
    if (stop != null) {
      const ds = stop - B.x0, ts = ds / V
      if (age >= ts) { const dt = age - ts; d = dt < pause ? ds : ds + V * (dt - pause); if (dt < pause) stamp = dt / pause; mark = dt >= pause * 0.5 }
    }
    if (d > len) continue
    out.push({ n, x: B.x0 + d, y: B.y, z: BT, s: lerp(0.5, 1, clamp(d / 0.35)), a: Math.min(clamp(d / 0.2), 1 - clamp((d - len + 0.35) / 0.35)), stamp, mark })
  }
  return out
}
export function cube(W, k, q, col, dz = 0) {
  const s = MSG * q.s
  W.obj(q.x, q.y, q.z + dz + 0.2, () => box(W.ctx, W.c, {
    x: q.x, y: q.y, z: q.z + dz, w: s, d: s, h: s, col, alpha: q.a, top: shade(col, 1.12), edge: rgba('#1c1a2b', 0.22),
    onTop: q.mark ? (g, w, d) => { g.strokeStyle = '#fff'; g.lineWidth = 0.06; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(w * 0.22, d * 0.55); g.lineTo(w * 0.42, d * 0.75); g.lineTo(w * 0.8, d * 0.28); g.stroke() } : null,
  }))
}

// ---------- 送料机：出口朝 +x，顶上一叠纸 ----------
export function feeder(W, k, x, y, st, t, o = {}) {
  if (st.a <= 0.002) return
  const ctx = W.ctx, c = W.c, w = 1.3, d = 1.5, h = sq(1.2, st)
  W.ground(() => contact(ctx, c, x, y, w, d, 0.12 * st.a))
  W.obj(x, y, st.z + 0.6, () => {
    ctx.globalAlpha *= st.a
    box(ctx, c, { x, y, z: st.z, w, d, h, col: k.body, top: k.bodyTop, ...hlEdge(k, o.hl ?? 0) })
    ctx.save(); plane(ctx, c, x + w / 2, y + 0.42, st.z + 0.62, 'yz'); roundRect(ctx, 0, 0, 0.84, 0.36, 0.06); ctx.fillStyle = k.dark; ctx.fill(); ctx.restore()
    for (let i = 0; i < 4; i++) {
      const wob = Math.sin(t * 2.2 + i) * 0.02
      box(ctx, c, { x: x - 0.05 + wob, y: y + 0.05 * (i % 2), z: st.z + h + i * 0.07, w: 0.85, d: 1.0, h: 0.05, col: i % 2 ? k.lilac2 : k.card, edge: rgba('#1c1a2b', 0.12) })
    }
    box(ctx, c, { x: x + w / 2 - 0.02, y: y - 0.55, z: st.z + 0.15, w: 0.04, d: 0.25, h: sq(0.8, st), col: k.accent, edge: null })
  })
  if (st.q > 0 && st.q < 1) W.ground(() => dust(ctx, c, k, x, y, st.q, 1.0))
}

// ---------- 盖章检查站：机身在带子后方（by - 1.3），横臂伸到带子上方，压头随 stamp（0..1）落下 ----------
export function press(W, k, x, by, st, stamp = -1, lamp = null, o = {}) {
  if (st.a <= 0.002) return
  const ctx = W.ctx, c = W.c, y = by - 1.3, z = st.z, hl = o.hl ?? 0
  W.ground(() => contact(ctx, c, x, y, 1.0, 0.9, 0.13 * st.a))
  W.obj(x, y, z + 0.5, () => {
    ctx.globalAlpha *= st.a
    box(ctx, c, { x, y, z, w: 0.95, d: 0.85, h: sq(1.05, st), col: k.body, top: k.bodyTop, ...hlEdge(k, hl) })
    ctx.save(); plane(ctx, c, x - 0.32, y + 0.425, z + sq(0.88, st), 'xz'); roundRect(ctx, 0, 0, 0.64, 0.32, 0.05); ctx.fillStyle = k.lilac2; ctx.fill(); ctx.restore()
    box(ctx, c, { x, y, z: z + sq(1.05, st), w: 1.15, d: 1.05, h: 0.12, col: k.accent, top: k.violet, ...hlEdge(k, hl) })
    const lc = lamp === 'ok' ? k.accent2 : lamp === 'on' ? k.accent : k.steel
    box(ctx, c, { x: x - 0.25, y: y - 0.2, z: z + sq(1.17, st), w: 0.22, d: 0.22, h: 0.16, col: lc, top: shade(lc, 1.2), edge: null })
    if (lamp) { const [lx, ly] = P(c, x - 0.25, y - 0.2, z + 1.4); glow(ctx, lx, ly, c.s * 0.55, lc, 0.4) }
  })
  W.obj(x, by - 0.3, z + 1.2, () => {
    ctx.globalAlpha *= st.a
    const zArm = z + 1.38, zHead = z + lerp(1.0, BT + MSG + 0.01, Math.sin(Math.PI * clamp(stamp)))
    box(ctx, c, { x, y: y + 0.25, z: z + 1.17, w: 0.18, d: 0.18, h: 0.25, col: k.rail, edge: null })
    box(ctx, c, { x, y: (y + 0.25 + by) / 2, z: zArm, w: 0.18, d: by - y + 0.1, h: 0.14, col: k.steel, ...hlEdge(k, hl) })
    box(ctx, c, { x, y: by, z: zHead + 0.2, w: 0.09, d: 0.09, h: Math.max(0.01, zArm - zHead - 0.2), col: k.rail, edge: null })
    box(ctx, c, { x, y: by, z: zHead, w: 0.5, d: 0.5, h: 0.2, col: k.accent, top: k.violet })
  }, 0.3)
  if (st.q > 0 && st.q < 1) W.ground(() => dust(ctx, c, k, x, y, st.q, 0.9))
}

// ---------- 门架：跨在带子上的两根立柱和横梁，梁上一盏灯，梁前可挂一块号牌 ----------
// o: lit 灯亮 0..1，hl 描边，num 号牌上的字，H 高度
export function arch(W, k, x, by, st, o = {}) {
  if (st.a <= 0.002) return
  const ctx = W.ctx, c = W.c, z = st.z, H = sq(o.H ?? 1.5, st), hl = o.hl ?? 0, lit = o.lit ?? 0, sp = 0.66
  for (const py of [by - sp, by + sp]) {
    W.ground(() => contact(ctx, c, x, py, 0.22, 0.22, 0.15 * st.a))
    W.box({ x, y: py, z, w: 0.22, d: 0.22, h: H, col: k.steel, alpha: st.a })
  }
  W.obj(x, by, z + H, () => {
    ctx.globalAlpha *= st.a
    box(ctx, c, { x, y: by, z: z + H, w: 0.3, d: sp * 2 + 0.3, h: 0.2, col: mix(k.steel, k.accent, lit * 0.8), top: mix(k.bodyTop, k.violet, lit) })
    if (hl > 0.01) { const [gx, gy] = P(c, x, by, z + H); glow(ctx, gx, gy, c.s * 1.4, k.accent, 0.22 * hl) }
    const lc = mix(k.rail, k.accent2, lit)
    box(ctx, c, { x, y: by - 0.35, z: z + H + 0.2, w: 0.2, d: 0.2, h: 0.14, col: lc, top: shade(lc, 1.2), edge: null })
    if (lit > 0.01) { const [lx, ly] = P(c, x, by - 0.35, z + H + 0.4); glow(ctx, lx, ly, c.s * 0.6, k.accent2, 0.4 * lit) }
    if (o.num != null) {
      // 号牌：立在梁上的一块小板，默认朝 +y；faceX 时朝 +x（机位从正面看带子时用）
      const pw = 0.62, ph = 0.5, fx = o.faceX, px = fx ? x + 0.1 : x, py = fx ? by : by + sp - 0.05, pz = z + H + 0.2
      box(ctx, c, { x: px, y: py, z: pz, w: fx ? 0.08 : pw, d: fx ? pw : 0.08, h: ph, col: lit > 0.5 ? k.accent : k.dark, top: k.steel })
      ctx.save(); fx ? plane(ctx, c, px + 0.04, py + pw / 2, pz + ph, 'yz') : plane(ctx, c, x - pw / 2, py + 0.04, pz + ph, 'xz'); ctx.fillStyle = k.onAccent
      ctx.font = o.font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.scale(0.01, 0.01); ctx.fillText(String(o.num), pw * 50, ph * 52); ctx.restore()
    }
  }, 0.3)
  if (st.q > 0 && st.q < 1) W.ground(() => dust(ctx, c, k, x, by, st.q, 1.0))
}

// ---------- 工具架：背板带孔，台面上几件工具轻轻起伏 ----------
export function toolRack(W, k, x, y, st, t) {
  if (st.a <= 0.002) return
  const ctx = W.ctx, c = W.c, z = st.z
  W.ground(() => contact(ctx, c, x, y - 0.1, 3.0, 1.0, 0.12 * st.a))
  W.obj(x, y, z + 0.5, () => {
    ctx.globalAlpha *= st.a
    box(ctx, c, { x, y: y - 0.38, z, w: 3.0, d: 0.12, h: sq(1.25, st), col: k.steel, top: k.bodyTop })
    ctx.save(); plane(ctx, c, x - 1.4, y - 0.32, z + sq(1.15, st), 'xz'); ctx.fillStyle = rgba('#3c405a', 0.18)
    for (let i = 0; i < 13; i++) for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(0.12 + i * 0.22, 0.15 + j * 0.25, 0.035, 0, Math.PI * 2); ctx.fill() }
    ctx.restore()
    box(ctx, c, { x, y: y + 0.05, z, w: 3.0, d: 0.8, h: sq(0.14, st), col: k.steel })
    ;[[-1.0, 0.42, 0.42, 0.42, k.accent], [-0.32, 0.3, 0.3, 0.72, k.slate], [0.35, 0.56, 0.38, 0.3, k.violet], [1.0, 0.36, 0.36, 0.52, k.dark]].forEach(([dx, w, d, h, col], i) => {
      box(ctx, c, { x: x + dx, y: y + 0.08, z: z + 0.14 + Math.max(0, Math.sin(t * 3 + i * 1.7)) * 0.05, w, d, h: sq(h, st), col })
    })
  })
  if (st.q > 0 && st.q < 1) W.ground(() => dust(ctx, c, k, x, y, st.q, 1.3))
}

// ---------- 记录仪：一台机柜，正面（朝 +y）屏幕上日志行不断上滚，顶上灯闪 ----------
export function recorder(W, k, x, y, st, t, o = {}) {
  if (st.a <= 0.002) return
  const ctx = W.ctx, c = W.c, w = o.w ?? 1.0, d = 0.9, z = st.z, h = sq(o.h ?? 0.95, st)
  W.ground(() => contact(ctx, c, x, y, w, d, 0.13 * st.a))
  W.obj(x, y, z + 0.5, () => {
    ctx.globalAlpha *= st.a
    box(ctx, c, { x, y, z, w, d, h, col: k.body, top: k.bodyTop, ...hlEdge(k, o.hl ?? 0) })
    const sw = w - 0.24, sh = Math.min(h - 0.3, 0.56 * h / 0.95 + 0.1)
    ctx.save(); plane(ctx, c, x - sw / 2, y + d / 2 + 0.001, z + h - 0.14, 'xz')
    roundRect(ctx, 0, 0, sw, sh, 0.05); ctx.fillStyle = k.dark; ctx.fill()
    ctx.beginPath(); ctx.rect(0.04, 0.04, sw - 0.08, sh - 0.08); ctx.clip()
    const LH = 0.11, sc = t * 0.35 / LH, k0 = Math.floor(sc), f = sc - k0, LW = [0.5, 0.36, 0.58, 0.28, 0.46, 0.4, 0.54, 0.32], LC = [k.scr, k.slate, k.accent2, k.scr, k.slate, k.violet]
    for (let i = 0; i < Math.ceil(sh / LH) + 1; i++) {
      const n = k0 + i, yy = 0.08 + (i - f) * LH
      ctx.fillStyle = LC[n % LC.length]; ctx.fillRect(0.08, yy, 0.05, 0.045)
      ctx.fillStyle = rgba(k.scr2, 0.75); ctx.fillRect(0.17, yy, LW[n % LW.length] * sw / 0.76, 0.045)
    }
    ctx.restore()
    box(ctx, c, { x: x + w / 2 - 0.02, y: y - 0.15, z: z + 0.12, w: 0.04, d: 0.3, h: sq(0.7, st) * h / 0.95, col: k.accent, edge: null })
    const on = Math.sin(t * 5) > -0.2, lc = on ? k.red : k.rail
    box(ctx, c, { x: x + w / 2 - 0.25, y: y - 0.2, z: z + h, w: 0.2, d: 0.2, h: 0.14, col: lc, top: shade(lc, 1.2), edge: null })
    if (on) { const [lx, ly] = P(c, x + w / 2 - 0.25, y - 0.2, z + h + 0.25); glow(ctx, lx, ly, c.s * 0.4, k.red, 0.3) }
  })
  if (st.q > 0 && st.q < 1) W.ground(() => dust(ctx, c, k, x, y, st.q, 0.9))
}

// ---------- 围栏：F = { x0, x1, y0, y1 }，rise 0..1 依次升起 ----------
export function fence(W, k, F, a, rise, hl = 0) {
  if (a <= 0.002 || rise <= 0.001) return
  const pts = [], seg = (x0, y0, x1, y1) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.95)); for (let i = 0; i < n; i++) pts.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]) }
  seg(F.x0, F.y1, F.x0, F.y0); seg(F.x0, F.y0, F.x1, F.y0); seg(F.x1, F.y0, F.x1, F.y1); seg(F.x1, F.y1, F.x0, F.y1)
  const N = pts.length, rr = i => ease.outBack(clamp(rise * 1.6 - (i / N) * 0.6))
  pts.forEach(([x, y], i) => {
    const h = 0.66 * rr(i)
    if (h <= 0.01) return
    W.box({ x, y, z: 0, w: 0.14, d: 0.14, h, col: k.accent, top: k.violet, alpha: a, edge: rgba(shade(k.accent, 0.6), 0.3 + hl * 0.3) })
    const [nx, ny] = pts[(i + 1) % N], hh = Math.min(rr(i), rr((i + 1) % N))
    if (hh <= 0.01) return
    const mx = (x + nx) / 2, my = (y + ny) / 2, horiz = Math.abs(ny - y) < 1e-6, L = Math.hypot(nx - x, ny - y) - 0.14
    W.box({ x: mx, y: my, z: 0.08, w: horiz ? L : 0.04, d: horiz ? 0.04 : L, h: 0.42 * hh, col: k.lilac2, top: k.lilac, alpha: a * (0.45 + 0.35 * hl), edge: null })
    W.box({ x: mx, y: my, z: 0.55 * hh, w: horiz ? L : 0.07, d: horiz ? 0.07 : L, h: 0.06, col: shade(k.accent, 0.85), alpha: a, edge: null })
  })
}

// ---------- 货箱：带封箱带的方箱 ----------
export function crate(W, k, x, y, z, s, col, a = 1) {
  if (a <= 0.002) return
  W.ground(() => { if (z < 0.05) contact(W.ctx, W.c, x, y, s, s, 0.1 * a) })
  W.box({ x, y, z, w: s, d: s, h: s * 0.86, col, alpha: a, top: shade(col, 1.1), onTop: (g, w, d) => { g.fillStyle = rgba('#ffffff', 0.35); g.fillRect(w * 0.42, 0, w * 0.16, d); g.fillRect(0, d * 0.42, w, d * 0.16) } })
}
