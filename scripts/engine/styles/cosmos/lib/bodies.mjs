// 天体和星图上的线。star、moon、orbit、orbPt、chart、shock、comet、leader、armillary、galaxy 移植自风格库的 Y-宇宙星图，
// 改为从主题取色、尺寸乘 E.u；planet（带明暗和环的行星）、corona（日冕）、constellation（星座连线）、glint（四芒小星）是新写的。
import { clamp, lerp, ease } from '../../../core.mjs'
import { TAU, pal, glow, mulberry } from './space.mjs'

const { PI, sin, cos } = Math

// 恒星：外晕、日冕、四道衍射芒（两长两短，缓慢转动）、星核，轻轻呼吸。o: { color, alpha, halo, t, spikes, spike（芒长倍数）, spin }
export function star(ctx, E, x, y, r, o = {}) {
  const k = pal(E), col = o.color || k.gold, a = o.alpha ?? 1
  if (a <= 0 || r <= 0) return
  const T = o.t ?? 0, pulse = 1 + 0.04 * sin(T * 2.1)
  ctx.save(); ctx.globalAlpha *= a
  glow(ctx, E, x, y, r * (o.halo ?? 7) * pulse, col, 0.75)
  glow(ctx, E, x, y, r * 2.8, col, 1)
  glow(ctx, E, x, y, r * 1.6, k.core, 0.9)
  if (o.spikes !== false) {
    ctx.globalCompositeOperation = 'lighter'
    const rot = (o.spin ?? 0) + T * 0.05, m = o.spike ?? 1, L = [r * 9 * pulse * m, r * 5.5 * m]
    for (let i = 0; i < 4; i++) {
      const ang = rot + i * PI / 2, ex = x + cos(ang) * L[i % 2], ey = y + sin(ang) * L[i % 2]
      const g = ctx.createLinearGradient(x, y, ex, ey)
      g.addColorStop(0, E.rgba(k.core, 0.9)); g.addColorStop(0.25, E.rgba(col, 0.45)); g.addColorStop(1, E.rgba(col, 0))
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.2 * E.u, r * 0.12); ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, k.core); g.addColorStop(1, E.rgba(col, 0.9))
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.restore()
}

// 小天体（卫星）：亮点 + 柔光；hollow = 还没点亮的空位（虚线小圈）
export function moon(ctx, E, x, y, r, col, o = {}) {
  const a = o.alpha ?? 1, u = E.u
  if (a <= 0) return
  ctx.save(); ctx.globalAlpha *= a
  if (o.hollow) {
    ctx.strokeStyle = E.rgba(col, 0.85); ctx.lineWidth = 2 * u; ctx.setLineDash([4 * u, 4 * u])
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore(); return
  }
  glow(ctx, E, x, y, r * 4.5, col, 0.9)
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, TAU); ctx.fill()
  ctx.restore()
}

// 轨道椭圆：p = 画出的比例；o: { color, lw, alpha, start, dash, glow, part: 'back'（远侧上半）|'front'（近侧下半） }
export function orbit(ctx, x, y, rx, ry, tilt, p = 1, o = {}) {
  if (p <= 0) return
  const a = o.alpha ?? 1, lw = o.lw ?? 2
  // Skia 画整圈 2π 的 ellipse 会什么都不画，留一丝缺口
  let s0 = o.start ?? -PI / 2, s1 = s0 + TAU * Math.min(p, 0.9995)
  if (o.part === 'back') { s0 = PI; s1 = PI + PI * p }
  if (o.part === 'front') { s0 = 0; s1 = PI * p }
  ctx.save(); ctx.strokeStyle = o.color
  if (o.dash) ctx.setLineDash(o.dash)
  if (o.glow !== false) { ctx.globalAlpha *= a * 0.22; ctx.lineWidth = lw * 4; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, tilt, s0, s1); ctx.stroke(); ctx.globalAlpha /= 0.22 } else ctx.globalAlpha *= a
  ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, tilt, s0, s1); ctx.stroke()
  ctx.restore()
}
export function orbPt(x, y, rx, ry, tilt, th) {
  const ex = cos(th) * rx, ey = sin(th) * ry
  return [x + ex * cos(tilt) - ey * sin(tilt), y + ex * sin(tilt) + ey * cos(tilt)]
}

// 星图网格：同心圆 + 放射线 + 外圈刻度
export function chart(ctx, E, x, y, R, rot, a = 1, o = {}) {
  if (a <= 0) return
  const u = E.u, rings = o.rings ?? 4
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.strokeStyle = o.color || pal(E).faint; ctx.lineWidth = 1 * u
  for (let i = 1; i <= rings; i++) {
    ctx.globalAlpha = a * (i === rings ? 0.55 : 0.32); ctx.setLineDash(i === rings ? [] : [3 * u, 7 * u])
    ctx.beginPath(); ctx.arc(0, 0, R * i / rings, 0, TAU); ctx.stroke()
  }
  ctx.setLineDash([2 * u, 9 * u]); ctx.globalAlpha = a * 0.28
  const r0 = o.inner ?? 0.18
  for (let i = 0; i < 12; i++) { const an = i * PI / 6; ctx.beginPath(); ctx.moveTo(cos(an) * R * r0, sin(an) * R * r0); ctx.lineTo(cos(an) * R, sin(an) * R); ctx.stroke() }
  ctx.setLineDash([]); ctx.globalAlpha = a * 0.5
  for (let i = 0; i < 72; i++) { const an = i * TAU / 72, l = (i % 6 === 0 ? 12 : 5) * u; ctx.beginPath(); ctx.moveTo(cos(an) * R, sin(an) * R); ctx.lineTo(cos(an) * (R + l), sin(an) * (R + l)); ctx.stroke() }
  ctx.restore()
}

// 冲击环：t0 起一圈向外扩散的光环
export function shock(ctx, E, x, y, t, t0, R, col, dur = 1.1) {
  const p = clamp((t - t0) / dur)
  if (p <= 0 || p >= 1) return
  ctx.save(); ctx.globalAlpha *= (1 - p) * 0.8
  ctx.strokeStyle = col; ctx.lineWidth = (2 + 6 * (1 - p)) * E.u
  ctx.beginPath(); ctx.arc(x, y, R * ease.out(p), 0, TAU); ctx.stroke()
  ctx.restore()
}

// 彗星：从 (x0,y0) 飞向 (x1,y1)，p = 0..1，带尾迹
export function comet(ctx, E, x0, y0, x1, y1, p, col, o = {}) {
  if (p <= 0 || p >= 1) return
  const e = (o.ease || ease.inOut)(p), tl = o.tail ?? 0.35
  const hx = lerp(x0, x1, e), hy = lerp(y0, y1, e), tx = lerp(x0, x1, Math.max(0, e - tl)), ty = lerp(y0, y1, Math.max(0, e - tl))
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= o.alpha ?? 1
  const g = ctx.createLinearGradient(tx, ty, hx, hy)
  g.addColorStop(0, E.rgba(col, 0)); g.addColorStop(1, E.rgba(col, 0.9))
  ctx.strokeStyle = g; ctx.lineWidth = (o.lw ?? 3) * E.u; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke()
  const r = (o.r ?? 26) * E.u
  glow(ctx, E, hx, hy, r, col, 1); glow(ctx, E, hx, hy, r * 0.4, '#ffffff', 1)
  ctx.restore()
}

// 标注引线：起点一个小圆，沿折线推进
export function leader(ctx, E, pts, p, col, a = 1) {
  if (p <= 0 || a <= 0) return
  const seg = []
  let total = 0
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l }
  let rem = total * clamp(p)
  ctx.save(); ctx.globalAlpha *= a * 0.85; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5 * E.u
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length && rem > 0; i++) { const f = Math.min(1, rem / seg[i - 1]); ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); rem -= seg[i - 1] }
  ctx.stroke()
  ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 3.5 * E.u, 0, TAU); ctx.fill()
  ctx.restore()
}

// 环形骨架：三道倾斜的轨道环 + 环上的卫星。先画 part:'back'（星体之前），再画 'front'。o: { p, alpha, color, spin, moons }
export function armillary(ctx, E, x, y, R, part, o = {}) {
  const p = o.p ?? 1, a = o.alpha ?? 1, col = o.color || pal(E).cyan, sp = o.spin ?? 0, u = E.u
  if (p <= 0 || a <= 0) return
  ;[[1.0, 0.36, -0.35], [0.86, 0.5, 0.55], [1.12, 0.22, 0.12]].forEach(([m, inc, tl], i) => {
    const rx = R * m, ry = R * m * inc, tilt = tl + sp * (i % 2 ? -0.15 : 0.12), pi = clamp(p * 1.5 - i * 0.25)
    orbit(ctx, x, y, rx, ry, tilt, pi, { part, color: col, lw: (part === 'back' ? 1.6 : 2.4) * u, alpha: a * (part === 'back' ? 0.45 : 1) })
    if (o.moons !== false && pi >= 1) {
      const th = sp * (1.3 + 0.4 * i) + i * 2.1, front = sin(th) > 0
      if ((part === 'front') === front) { const [mx, my] = orbPt(x, y, rx, ry, tilt, th); moon(ctx, E, mx, my, (front ? 8 : 6) * u, col, { alpha: a * (front ? 1 : 0.5) }) }
    }
  })
}

// 旋涡星系贴图（两条旋臂的星点 + 核心），倾斜压扁后旋转着画
export function galaxySprite(E, cols, seed) {
  return E.once('cosmos:gal' + seed, () => {
    const N = 760, cv = E.createCanvas(N, N), c = cv.getContext('2d'), r = mulberry(seed), R = N * 0.46
    c.globalCompositeOperation = 'lighter'
    const g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, R)
    g.addColorStop(0, E.rgba(cols[0], 0.5)); g.addColorStop(0.25, E.rgba(cols[1], 0.16)); g.addColorStop(1, E.rgba(cols[1], 0))
    c.fillStyle = g; c.fillRect(0, 0, N, N)
    for (let i = 0; i < 4200; i++) {
      const arm = i % 2, q = Math.pow(r(), 0.75), th = arm * PI + q * 4.6 + (r() - 0.5) * 0.55 * (1 - q * 0.4), rad = q * R * (0.92 + r() * 0.16)
      const sz = 0.7 + r() * 1.8 * (1 - q * 0.6)
      c.globalAlpha = 0.25 + 0.6 * r(); c.fillStyle = r() < 0.3 ? '#ffffff' : cols[q < 0.3 ? 0 : r() < 0.7 ? 1 : 2]
      c.fillRect(N / 2 + cos(th) * rad, N / 2 + sin(th) * rad, sz, sz)
    }
    c.globalAlpha = 1
    const kk = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.09)
    kk.addColorStop(0, 'rgba(255,255,255,0.95)'); kk.addColorStop(0.4, E.rgba(cols[0], 0.6)); kk.addColorStop(1, E.rgba(cols[0], 0))
    c.fillStyle = kk; c.fillRect(0, 0, N, N)
    return cv
  })
}
export function galaxy(ctx, sp, x, y, R, rot, incl = 0.5, a = 1, tilt = -0.35) {
  if (a <= 0) return
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a
  ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, incl); ctx.rotate(rot)
  ctx.drawImage(sp, -R, -R, R * 2, R * 2)
  ctx.restore()
}

// 四芒小星：一点亮核加一横一竖两道细芒
export function glint(ctx, E, x, y, r, col, a = 1) {
  if (a <= 0 || r <= 0) return
  glow(ctx, E, x, y, r * 3, col, 0.7 * a)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= a; ctx.fillStyle = E.rgba('#ffffff', 0.9)
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    ctx.beginPath(); ctx.moveTo(x - dx * r * 2.2, y - dy * r * 2.2); ctx.lineTo(x + dy * r * 0.22, y + dx * r * 0.22)
    ctx.lineTo(x + dx * r * 2.2, y + dy * r * 2.2); ctx.lineTo(x - dy * r * 0.22, y - dx * r * 0.22); ctx.closePath(); ctx.fill()
  }
  ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fill()
  ctx.restore()
}

// 行星：受光面亮、背光面沉进夜色，受光一侧一道大气亮边。o: { color, alpha, light（光从哪个方向来，弧度）, bands, ring: { k, inc, tilt, color } }
export function planet(ctx, E, x, y, r, o = {}) {
  const k = pal(E), col = o.color || k.cyan, a = o.alpha ?? 1, L = o.light ?? PI, rg = o.ring
  if (a <= 0 || r <= 0) return
  ctx.save(); ctx.globalAlpha *= a
  // 环分两半画：后半圈在星球之前，前半圈在之后；每半圈是三道宽窄不同的椭圆，中间留一道缝
  const ring = part => rg && [[1, 0.5, 0.06], [1.16, 0.85, 0.09], [1.3, 0.4, 0.05]].forEach(([m, al, w]) =>
    orbit(ctx, x, y, r * rg.k * m, r * rg.k * m * rg.inc, rg.tilt, 1, { part, color: rg.color || k.dim, lw: r * w, alpha: al * (part === 'back' ? 0.55 : 1), glow: false }))
  ring('back')
  glow(ctx, E, x, y, r * 2.4, col, 0.3)
  const g = ctx.createRadialGradient(x + cos(L) * r * 0.5, y + sin(L) * r * 0.5, r * 0.05, x, y, r)
  g.addColorStop(0, E.mix(col, '#ffffff', 0.5)); g.addColorStop(0.5, col); g.addColorStop(0.82, E.mix(col, k.bg0, 0.7)); g.addColorStop(1, E.mix(col, k.bg0, 0.88))
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  if (o.bands) {
    // 气态行星的纬向条纹，和环同一个倾角
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip(); ctx.translate(x, y); ctx.rotate(rg ? rg.tilt : 0)
    for (let i = -3; i <= 3; i++) { ctx.fillStyle = E.rgba(i % 2 ? k.bg0 : '#ffffff', 0.08 + 0.04 * (i % 2 ? 1 : 0)); ctx.fillRect(-r, i * r * 0.27 - r * 0.07, r * 2, r * (0.08 + 0.05 * ((i + 4) % 3))) }
    ctx.restore()
  }
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = E.rgba(E.mix(col, '#ffffff', 0.5), 0.7); ctx.lineWidth = Math.max(1.5 * E.u, r * 0.05)
  ctx.beginPath(); ctx.arc(x, y, r * 0.97, L - 1.1, L + 1.1); ctx.stroke()
  ctx.globalCompositeOperation = 'source-over'
  ring('front')
  ctx.restore()
}

// 日冕：外晕 + 一圈长短不一的冕流（按种子固定，慢慢转、轻轻闪）。画在月面之前，月面挡住中间
export function corona(ctx, E, x, y, R, t, a = 1) {
  if (a <= 0) return
  const k = pal(E), r = mulberry(77), u = E.u
  glow(ctx, E, x, y, R * 3.3, k.gold, 0.55 * a)
  glow(ctx, E, x, y, R * 1.7, k.core, 0.55 * a)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
  for (let i = 0; i < 72; i++) {
    const an = i / 72 * TAU + (r() - 0.5) * 0.08 + t * 0.03, len = R * (0.15 + Math.pow(r(), 2.2) * 1.0) * (0.85 + 0.15 * sin(t * 1.3 + i * 1.7))
    const x0 = x + cos(an) * R * 0.97, y0 = y + sin(an) * R * 0.97, x1 = x + cos(an) * (R + len), y1 = y + sin(an) * (R + len)
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, E.rgba(k.core, 0.55 * a)); g.addColorStop(1, E.rgba(k.gold, 0))
    ctx.strokeStyle = g; ctx.lineWidth = (1 + r() * 3) * u
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke()
  }
  ctx.restore()
}

// 星座：pts 是星的位置，edges 是连线；p 从 0 到 1 依次画出连线、点亮星点
export function constellation(ctx, E, pts, edges, p, t, o = {}) {
  if (p <= 0) return
  const k = pal(E), u = E.u, col = o.color || k.cyan, a = o.alpha ?? 1
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = E.rgba(col, 0.5); ctx.lineWidth = 1.4 * u
  edges.forEach(([i, j], n) => {
    const q = clamp(p * (edges.length + 2) - n - 1)
    if (q <= 0) return
    const [ax, ay] = pts[i], [bx, by] = pts[j], d = Math.hypot(bx - ax, by - ay), gx = (bx - ax) / d * 9 * u, gy = (by - ay) / d * 9 * u
    ctx.beginPath(); ctx.moveTo(ax + gx, ay + gy); ctx.lineTo(lerp(ax + gx, bx - gx, q), lerp(ay + gy, by - gy, q)); ctx.stroke()
  })
  ctx.restore()
  pts.forEach(([x, y], i) => {
    const q = clamp(p * pts.length * 1.2 - i)
    const big = (i * 7 + 3) % 4 === 0
    glint(ctx, E, x, y, (big ? 7 : 4.5) * u * (0.85 + 0.15 * sin(t * 2 + i * 1.9)), big ? k.gold : col, q * a)
  })
}
