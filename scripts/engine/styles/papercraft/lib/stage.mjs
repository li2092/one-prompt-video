// 纸艺景箱：天空底卡、吊线纸云、纸太阳或纸月亮、三层剪纸山丘（远、中、近），镜头一格一格推近时各层按景深视差。
// 移植自风格库的 O-纸艺定格。山丘和云的贴图第一次用到时画好存起来（E.once，关掉 boil），太阳和布景道具每帧现画。
// 每种版式一套配色和一件道具；用户用 colors 换了 bg 时，整套布景往新的 bg 色调靠。
import { P, cutCircle, cutPoly, fillPaper, card, hs, hash, jit, withoutBoil, frameNo, shade } from './paper.mjs'

const LOOKS = {
  meadow: { sky: '#DCE8E2', far: '#E9B99A', mid: '#B9C99A', near: '#8FAE80', front: '#6F9468', sun: '#F2C068', seed: 1, sunL: [0.9, 0.17], sunP: [0.84, 0.1], cloudsL: [[0.06, 120, 0.8], [0.34, 190, 0.6], [1.02, 300, 0.75]], cloudsP: [[0.12, 230, 0.8], [0.62, 160, 0.6]] },
  sand: { sky: '#F5E5BD', far: '#E6C88E', mid: '#E3A27C', near: '#C98364', front: '#A86A50', sun: '#F7F0DF', seed: 2, sunL: [0.12, 0.18], sunP: [0.16, 0.1], cloudsL: [[0.62, 110, 0.7], [0.88, 210, 0.85]], cloudsP: [[0.72, 190, 0.75], [0.36, 330, 0.6]] },
  mist: { sky: '#DCE3E6', far: '#B7C7D4', mid: '#9DB3C8', near: '#7E9CC0', front: '#5F7EA3', sun: '#F3D39A', seed: 3, sunL: [0.93, 0.3], sunP: [0.86, 0.12], cloudsL: [[0.5, 120, 0.6]], cloudsP: [[0.3, 160, 0.6]] },
  green: { sky: '#E4EDDD', far: '#C4D8BE', mid: '#A9C9AF', near: '#86B39C', front: '#5E9C88', sun: '#F7F0DF', seed: 4, sunL: [0.3, 0.12], sunP: [0.2, 0.08], cloudsL: [[0.1, 260, 0.7], [0.7, 110, 0.8], [0.95, 300, 0.55]], cloudsP: [[0.15, 520, 0.6], [0.85, 230, 0.7]] },
  peach: { sky: '#F7E0CF', far: '#EFC2A6', mid: '#E7A887', near: '#D9886A', front: '#B96A4F', sun: '#F2C068', seed: 5, sunL: [0.86, 0.13], sunP: [0.85, 0.08], cloudsL: [[0.1, 330, 0.6], [0.7, 330, 0.5]], cloudsP: [[0.18, 300, 0.55], [0.8, 430, 0.5]] },
  wood: { sky: '#EFE3CF', far: '#DCC6A4', mid: '#C9AC84', near: '#B08F68', front: '#8E7151', sun: '#F7F0DF', seed: 6, floor: true, sunL: [0.06, 0.2], sunP: [0.12, 0.08], cloudsL: [[0.92, 330, 0.65]], cloudsP: [[0.84, 560, 0.55]] },
  night: { sky: '#3F4270', sky2: '#9C7FA6', far: '#8A77A0', mid: '#6F6290', near: '#5A4E78', front: '#463D60', sun: '#F5E7C2', seed: 7, moon: true, sunL: [0.07, 0.13], sunP: [0.17, 0.09], cloudsL: [[0.62, 230, 0.55]], cloudsP: [[0.7, 520, 0.5]] },
}
// 版式 → [配色, 道具]
const BY_LAYOUT = { title: ['meadow', 'mill'], statement: ['sand', null], bullets: ['peach', 'gears'], number: ['mist', null], bars: ['green', 'flags'], steps: ['meadow', null], compare: ['wood', null], quote: ['peach', null], end: ['night', 'stars'], custom: ['meadow', null] }
const DEFAULT_BG = '#F7EBD3'
const DEPTH = { deco: 0.28, far: 0.42, mid: 0.68, near: 1.22 }

// 这一场的布景：配色（按用户的 bg 调过）、道具、地面高度、三层山脊高度
export function stageOf(E, layout, c) {
  const [id, prop] = BY_LAYOUT[layout] || BY_LAYOUT.custom, base = LOOKS[id], own = c.bg.toLowerCase() !== DEFAULT_BG.toLowerCase()
  const th = { ...base, id, prop }
  if (own) for (const k of ['sky', 'sky2', 'far', 'mid', 'near', 'front']) if (th[k]) th[k] = mixHex(th[k], c.bg, k === 'sky' || k === 'sky2' ? 0.55 : 0.3)
  const b = E.L.box, u = E.u, floor = b.y + b.h - E.pick(60, 80) * u
  return { th, key: id + (own ? c.bg : ''), u, W: E.W, H: E.H, M: Math.round(E.W * 0.06), floor, tops: { far: floor - E.pick(300, 330) * u, mid: floor - E.pick(150, 170) * u, near: floor + E.pick(40, 44) * u } }
}
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  return '#' + [16, 8, 0].map(sh => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k).toString(16).padStart(2, '0')).join('')
}

const WAVES = { far: [[900, 60], [380, 18]], mid: [[640, 38], [260, 14]], near: [[520, 26], [210, 9]], front: [[430, 18], [170, 7]] }
function hillPath(g, top, seed, waves) {
  const pts = [], x0 = -g.M, x1 = g.W + g.M, n = 90
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n
    let y = top
    waves.forEach(([len, a], j) => { y += Math.sin(x / (len * g.u) * Math.PI * 2 + seed * 1.7 + j * 2.1) * a * g.u })
    pts.push([x, y + hs(seed, i) * 1.2 * g.u])
  }
  return pts
}
function ridgeY(g, which, x) {
  const pts = hillPath(g, g.tops[which], g.th.seed * 10 + which.length, WAVES[which])
  return pts[Math.max(0, Math.min(90, Math.round((x + g.M) / (g.W + 2 * g.M) * 90)))][1]
}
function hillFill(x, g, pts, col, blur) {
  x.beginPath(); x.moveTo(-g.M, g.H + g.M); for (const [px, py] of pts) x.lineTo(px, py); x.lineTo(g.W + g.M, g.H + g.M); x.closePath()
  x.save(); x.shadowColor = 'rgba(70,40,18,0.30)'; x.shadowBlur = blur * g.u; x.shadowOffsetY = -5 * g.u; x.fillStyle = col; x.fill(); x.restore()
  x.save(); x.strokeStyle = 'rgba(255,250,240,0.3)'; x.lineWidth = 2 * g.u; x.stroke(); x.restore()
}

// 一层山丘的贴图：远、中层上点几棵纸树；近景层再叠一条更深的前沿纸条（wood 换成木地板）
function layer(E, g, which) {
  return E.once(`pc-${g.key}-${which}`, () => withoutBoil(() => {
    const th = g.th, u = g.u, top = g.tops[which], pad = 160 * u
    const c = E.createCanvas(g.W + 2 * g.M, g.H + g.M - (top - pad)), x = c.getContext('2d')
    x.translate(g.M, -(top - pad))
    const pts = hillPath(g, top, th.seed * 10 + which.length, WAVES[which])
    if (which === 'near' && th.floor) {
      const fy0 = top + E.pick(10, 20) * u, bh = 44 * u
      x.save(); x.beginPath(); x.rect(-g.M, fy0, g.W + 2 * g.M, g.H + g.M - fy0); x.clip()
      for (let r = 0; r < 16; r++) {
        const y = fy0 + r * bh
        x.fillStyle = shade(th.near, r % 2 ? -0.06 : 0.02); x.fillRect(-g.M, y, g.W + 2 * g.M, bh)
        x.fillStyle = 'rgba(70,40,18,0.28)'; x.fillRect(-g.M, y, g.W + 2 * g.M, 2 * u)
        for (let k = 0; k < 9; k++) x.fillRect(-g.M + ((k + (r % 2) * 0.5) * 340 + hs(th.seed + r, k) * 40) * u, y, 2 * u, bh)
      }
      x.restore()
      x.save(); x.shadowColor = 'rgba(70,40,18,0.35)'; x.shadowBlur = 20 * u; x.shadowOffsetY = -4 * u; x.fillStyle = shade(th.near, 0.08); x.fillRect(-g.M, fy0 - 6 * u, g.W + 2 * g.M, 10 * u); x.restore()
    } else hillFill(x, g, pts, th[which], 26)
    if (which === 'near' && !th.floor) hillFill(x, g, hillPath(g, top + E.pick(70, 90) * u, th.seed * 10 + 9, WAVES.front), th.front, 22)
    if (which !== 'near') {
      const n = which === 'mid' ? 5 : 4
      for (let i = 0; i < n; i++) {
        const px = -g.M + (g.W + 2 * g.M) * (i + 0.5 + hs(th.seed + i, 3) * 0.3) / n
        const py = pts[Math.max(0, Math.min(90, Math.round((px + g.M) / (g.W + 2 * g.M) * 90)))][1] + 12 * u
        const s = (which === 'mid' ? 1 : 0.7) * (0.8 + 0.4 * hash(th.seed, i)) * u
        x.save(); x.translate(px, py); x.scale(s, s)
        x.fillStyle = shade(th[which], -0.3); x.fillRect(-5, -40, 10, 42)
        x.beginPath(); x.moveTo(0, -150); x.lineTo(40, -40); x.lineTo(-40, -40); x.closePath()
        x.shadowColor = 'rgba(70,40,18,0.25)'; x.shadowBlur = 10 * u; x.shadowOffsetY = 3 * u; x.fillStyle = shade(th[which], which === 'mid' ? -0.16 : -0.1); x.fill()
        x.restore()
      }
    }
    return { c, x0: -g.M, y0: top - pad }
  }))
}

// 吊线纸云
function clouds(E, g) {
  return E.once(`pc-${g.key}-deco`, () => {
    const th = g.th, u = g.u, c = E.createCanvas(g.W + 2 * g.M, g.floor), x = c.getContext('2d'), night = !!th.moon
    x.translate(g.M, 0)
    for (const [fx, cy0, s0] of E.portrait ? th.cloudsP : th.cloudsL) {
      const cx = g.W * fx, cy = cy0 * u, s = s0 * u
      x.save(); x.strokeStyle = night ? 'rgba(230,220,240,0.35)' : 'rgba(90,70,50,0.35)'; x.lineWidth = 1.6 * u
      x.beginPath(); x.moveTo(cx, -10); x.lineTo(cx, cy - 40 * s); x.stroke(); x.restore()
      x.save(); x.translate(cx, cy); x.scale(s, s); x.shadowColor = 'rgba(40,24,10,0.2)'; x.shadowBlur = 14 * u; x.shadowOffsetY = 5 * u
      x.beginPath(); for (const [dx, dy, r] of [[-60, 10, 42], [-10, -14, 56], [52, 6, 44], [10, 22, 40]]) { x.moveTo(dx + r, dy); x.arc(dx, dy, r, 0, Math.PI * 2) }
      x.fillStyle = night ? '#B7AECB' : '#FFF9EE'; x.fill(); x.restore()
    }
    return { c, x0: -g.M }
  })
}

function sun(ctx, E, g) {
  const th = g.th, [fx, fy] = E.portrait ? th.sunP : th.sunL, x = g.W * fx, y = g.H * fy, R = 88 * g.u
  ctx.save(); ctx.shadowColor = 'rgba(40,24,10,0.25)'; ctx.shadowBlur = 18 * g.u; ctx.shadowOffsetY = 5 * g.u
  if (th.moon) {
    ctx.beginPath(); ctx.arc(x, y, R * 0.8, Math.PI * 0.3, Math.PI * 1.7); ctx.arc(x + R * 0.38, y - R * 0.05, R * 0.62, Math.PI * 1.42, Math.PI * 0.58, true); ctx.closePath()
    ctx.fillStyle = th.sun; ctx.fill()
  } else {
    cutCircle(ctx, x, y, R, th.seed + 70, 1.4); ctx.fillStyle = th.sun; ctx.fill()
    cutCircle(ctx, x, y, R * 0.7, th.seed + 71, 1.2); ctx.fillStyle = shade(th.sun, 0.14); ctx.fill()
  }
  ctx.restore()
}

// 布景道具：纸风车（远山上，一格一格转）、吊挂纸齿轮、三角旗、吊线纸星星。PROP_AT 是画在哪一层
const PROP_AT = { mill: 'far', gears: 'sky', flags: 'sky', stars: 'sky' }
function prop(ctx, E, g, where) {
  const th = g.th, W = g.W, u = g.u, f = frameNo(), p = th.prop
  if (!p || PROP_AT[p] !== where) return
  if (p === 'mill') {
    const x = W * E.pick(0.86, 0.84), gy = ridgeY(g, 'far', x) + 14 * u
    ctx.save(); ctx.translate(x, gy); ctx.scale(u * E.pick(1, 0.85), u * E.pick(1, 0.85))
    cutPoly(ctx, [[-22, 0], [22, 0], [12, -170], [-12, -170]], 340); fillPaper(ctx, P.white, 0.8)
    ctx.translate(0, -175); ctx.rotate(f * 0.4)
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); cutPoly(ctx, [[0, -8], [0, 8], [112, 14], [112, -10]], 342 + i); fillPaper(ctx, i % 2 ? '#D9734E' : P.mustard, 0.6); ctx.restore() }
    cutCircle(ctx, 0, 0, 10, 347); fillPaper(ctx, '#3E2B20', 0.3, false)
    ctx.restore()
  } else if (p === 'gears') {
    const gs = E.portrait ? [[0.1, 150, 62, 1], [0.92, 210, 48, -1]] : [[0.05, 160, 70, 1], [0.96, 300, 54, -1], [0.89, 170, 38, 1]]
    gs.forEach(([fx, y0, r0, dir], i) => {
      const x = W * fx, y = y0 * u, r = r0 * u
      ctx.save(); ctx.strokeStyle = 'rgba(90,70,50,0.35)'; ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, y - r); ctx.stroke(); ctx.restore()
      ctx.save(); ctx.translate(x, y); ctx.rotate(dir * f * 0.2)
      const pts = []; for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, rr = (k % 4 < 2) ? r : r * 0.8; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]) }
      cutPoly(ctx, pts, 350 + i, 0.6); fillPaper(ctx, [P.mustard, '#4F948B', P.coral][i], 0.8)
      cutCircle(ctx, 0, 0, r * 0.3, 355 + i); fillPaper(ctx, th.sky, 0, false)
      ctx.restore()
    })
  } else if (p === 'flags') {
    const y0 = 34 * u, sag = 50 * u, n = E.pick(16, 9), cols = ['#D9734E', P.mustard, P.white, P.blue]
    ctx.save(); ctx.strokeStyle = 'rgba(70,60,50,0.5)'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(-20, y0); ctx.quadraticCurveTo(W / 2, y0 + sag * 2, W + 20, y0); ctx.stroke(); ctx.restore()
    for (let i = 0; i < n; i++) {
      const q = (i + 0.5) / n, x = -20 + (W + 40) * q, y = y0 + sag * 4 * q * (1 - q)
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(f * 0.9 + i) * 0.05)
      cutPoly(ctx, [[-24 * u, 0], [24 * u, 0], [0, 42 * u]], 310 + i); fillPaper(ctx, cols[i % 4], 0.6)
      ctx.restore()
    }
  } else if (p === 'stars') {
    const st = E.portrait ? [[0.1, 120], [0.36, 200], [0.6, 90], [0.9, 150], [0.95, 380], [0.5, 330]] : [[0.3, 80], [0.42, 210], [0.55, 60], [0.7, 170], [0.82, 280], [0.93, 80], [0.05, 330]]
    st.forEach(([fx, y0], i) => {
      const x = W * fx, y = y0 * u, r = (16 + 10 * hash(370, i)) * u
      ctx.save(); ctx.strokeStyle = 'rgba(230,220,240,0.3)'; ctx.lineWidth = 1.3 * u; ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, y - r); ctx.stroke(); ctx.restore()
      const tw = ((f + i * 3) % 9 < 1) ? 0.8 : 1, pts = []
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = (k % 2 ? r * 0.45 : r) * tw; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]) }
      cutPoly(ctx, pts, 371 + i, 0.5); fillPaper(ctx, '#F6DD8E', 0.5)
    })
  }
}

// 镜头：z 是推近的倍数；d 是这一层的景深（越近推得越多）。以画面中心偏下为轴
function withCam(ctx, g, z, d, fn) {
  const s = 1 + (z - 1) * d, ax = g.W / 2, ay = g.H * 0.6
  ctx.save(); ctx.translate(ax, ay); ctx.scale(s, s); ctx.translate(-ax, -ay); fn(ctx); ctx.restore()
}
const layerJit = (ctx, which, amp) => { const j = jit(500 + which.length * 7, amp); ctx.translate(j.x, j.y) }

// 内容后面的层：天空、纸云和太阳、远山、中山
export function stageBack(ctx, E, g, z) {
  const th = g.th
  const sk = ctx.createLinearGradient(0, 0, 0, g.H * 0.8)
  sk.addColorStop(0, th.sky); sk.addColorStop(1, th.sky2 || shade(th.sky, 0.35))
  ctx.fillStyle = sk; ctx.fillRect(0, 0, g.W, g.H)
  withCam(ctx, g, z, DEPTH.deco, c => { layerJit(c, 'deco', 0.6); sun(c, E, g); const L = clouds(E, g); c.drawImage(L.c, L.x0, 0); prop(c, E, g, 'sky') })
  withCam(ctx, g, z, DEPTH.far, c => { layerJit(c, 'far', 0.7); const L = layer(E, g, 'far'); c.drawImage(L.c, L.x0, L.y0); prop(c, E, g, 'far') })
  withCam(ctx, g, z, DEPTH.mid, c => { layerJit(c, 'mid', 0.8); const L = layer(E, g, 'mid'); c.drawImage(L.c, L.x0, L.y0) })
}
// 内容前面的层：近景山丘（或木地板）
export function stageFront(ctx, E, g, z) {
  const L = layer(E, g, 'near')
  withCam(ctx, g, z, DEPTH.near, c => { layerJit(c, 'near', 0.9); c.drawImage(L.c, L.x0, L.y0) })
}
