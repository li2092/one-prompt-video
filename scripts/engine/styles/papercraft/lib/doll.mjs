// 纸片小人：头是一张芥黄六角卡纸，竖向对折立起来（右半边背光、中间一道折痕、右下露出纸厚，脸会眨眼、换表情）；
// 身子是一圈打孔的纸框（孔是镂空的，能看见后面的景），手脚用金色铆钉钉在框上，天线顶上一只纸风车一格一格转。
// 移植自风格库的 O-纸艺定格。单位：s = 1 时总高约 330，原点在两脚中间的地面。纸框颜色跟主题的 accent2 走。
import { P, card, cutCircle, cutPoly, fillPaper, place, frameNo, shadow, shade, brad } from './paper.mjs'

const TAU = Math.PI * 2

// 脸：画在头的中心坐标系里，w = 头宽。kind: smile happy proud worried o flat
function face(ctx, w, kind, seed, look, ink) {
  const e = w * 0.21, ey = -w * 0.06, er = w * 0.058, lx = look * w * 0.05
  const blink = kind !== 'happy' && kind !== 'proud' && (frameNo() + seed * 7) % 25 === 0
  ctx.save(); ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w * 0.035
  ctx.fillStyle = 'rgba(238,130,110,0.45)'
  ctx.beginPath(); ctx.arc(-w * 0.31, w * 0.11, w * 0.07, 0, TAU); ctx.arc(w * 0.31, w * 0.11, w * 0.07, 0, TAU); ctx.fill()
  ctx.fillStyle = ink
  if (blink || kind === 'proud') {
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * e + lx, ey, er * 1.05, 0.15, Math.PI - 0.15); ctx.stroke() }
  } else if (kind === 'happy') {
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * e, ey + er * 0.5, er * 1.15, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke() }
  } else {
    const r = kind === 'o' ? er * 1.25 : er
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * e + lx, ey, r, 0, TAU); ctx.fill() }
    ctx.fillStyle = 'rgba(255,253,247,0.9)'
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * e + lx + r * 0.35, ey - r * 0.35, r * 0.32, 0, TAU); ctx.fill() }
  }
  if (kind === 'worried') {
    ctx.lineWidth = w * 0.03
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx * (e - er * 1.4), ey - er * 2.8); ctx.lineTo(sx * (e + er * 1.2), ey - er * 2.8); ctx.stroke() }
  }
  ctx.lineWidth = w * 0.035
  const my = w * 0.17
  ctx.beginPath()
  if (kind === 'happy' || kind === 'proud') {
    ctx.moveTo(-w * 0.12, my - w * 0.02); ctx.quadraticCurveTo(0, my + w * 0.17, w * 0.12, my - w * 0.02); ctx.closePath()
    ctx.fillStyle = '#B95A3A'; ctx.fill(); ctx.stroke()
  } else if (kind === 'smile') { ctx.moveTo(-w * 0.09, my); ctx.quadraticCurveTo(0, my + w * 0.09, w * 0.09, my); ctx.stroke() }
  else if (kind === 'worried') { ctx.moveTo(-w * 0.1, my + w * 0.03); ctx.quadraticCurveTo(-w * 0.05, my - w * 0.03, 0, my + w * 0.02); ctx.quadraticCurveTo(w * 0.05, my + w * 0.07, w * 0.1, my); ctx.stroke() }
  else if (kind === 'o') { ctx.arc(0, my + w * 0.02, w * 0.045, 0, TAU); ctx.stroke() }
  else { ctx.moveTo(-w * 0.08, my + w * 0.02); ctx.lineTo(w * 0.08, my + w * 0.02); ctx.stroke() }
  ctx.restore()
}

// 多边形每个角切成两点（柔一点的剪角）
function softPoly(pts, c) {
  const out = []
  pts.forEach((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length], d1 = Math.hypot(a[0] - p[0], a[1] - p[1]), d2 = Math.hypot(b[0] - p[0], b[1] - p[1])
    out.push([p[0] + (a[0] - p[0]) * c / d1, p[1] + (a[1] - p[1]) * c / d1], [p[0] + (b[0] - p[0]) * c / d2, p[1] + (b[1] - p[1]) * c / d2])
  })
  return out
}

// 头（中心为原点），w×h：六角卡纸对折立起，底下露出纸厚
function head(ctx, w, h, o) {
  const fill = P.mustard, seed = o.seed || 61, th = w * 0.035
  const pts = softPoly([[-w / 2, 0], [-w * 0.27, -h / 2], [w * 0.27, -h / 2], [w / 2, 0], [w * 0.27, h / 2], [-w * 0.27, h / 2]], w * 0.06)
  ctx.save(); ctx.translate(th, th * 1.3); cutPoly(ctx, pts, seed + 5, 0.8); fillPaper(ctx, shade(fill, -0.28), 1, false); ctx.restore()
  cutPoly(ctx, pts, seed, 0.8); fillPaper(ctx, fill, 0)
  ctx.save(); cutPoly(ctx, pts, seed, 0.8); ctx.clip()
  ctx.fillStyle = 'rgba(140,80,20,0.13)'; ctx.fillRect(0, -h, w, 2 * h)
  ctx.strokeStyle = 'rgba(255,244,210,0.75)'; ctx.lineWidth = w * 0.014; ctx.beginPath(); ctx.moveTo(-w * 0.007, -h / 2); ctx.lineTo(-w * 0.007, h / 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(120,70,20,0.25)'; ctx.lineWidth = w * 0.01; ctx.beginPath(); ctx.moveTo(w * 0.008, -h / 2); ctx.lineTo(w * 0.008, h / 2); ctx.stroke()
  ctx.restore()
  face(ctx, w, o.face || 'smile', o.seed || 1, o.look || 0, o.ink)
}

function rr(ctx, x, y, w, h, r, ccw = false) {
  if (!ccw) { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r) }
  else { ctx.moveTo(x + r, y); ctx.arcTo(x, y, x, y + h, r); ctx.arcTo(x, y + h, x + w, y + h, r); ctx.arcTo(x + w, y + h, x + w, y, r); ctx.arcTo(x + w, y, x, y, r) }
  ctx.closePath()
}
// 打孔纸框（中心为原点）：外 w×h，边宽 b；四边一排圆孔（镂空），右下露出纸厚
function frameBody(ctx, w, h, b, col) {
  const r = Math.min(w, h) * 0.16, ri = Math.max(4, r - b * 0.6)
  const path = () => {
    ctx.beginPath(); rr(ctx, -w / 2, -h / 2, w, h, r); rr(ctx, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, ri, true)
    const hr = b * 0.17, sp = b * 1.45, holes = []
    const ny = Math.max(1, Math.floor((h - 2 * b - sp * 0.4) / sp)), nx = Math.max(1, Math.floor((w - 2 * b - sp * 0.4) / sp))
    for (let i = 0; i < ny; i++) { const y = (i - (ny - 1) / 2) * sp; holes.push([-w / 2 + b / 2, y], [w / 2 - b / 2, y]) }
    for (let i = 0; i < nx; i++) { const x = (i - (nx - 1) / 2) * sp; holes.push([x, -h / 2 + b / 2], [x, h / 2 - b / 2]) }
    for (const [x, y] of holes) { ctx.moveTo(x + hr, y); ctx.arc(x, y, hr, 0, TAU) }
  }
  const th = Math.max(3, b * 0.13)
  ctx.save(); ctx.translate(th, th * 1.3); path(); shadow(ctx, 1.2); ctx.fillStyle = shade(col, -0.32); ctx.fill('evenodd'); ctx.restore()
  path(); ctx.fillStyle = col; ctx.fill('evenodd')
  ctx.save(); ctx.strokeStyle = 'rgba(255,250,240,0.38)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore()
}
// 天线顶上的纸风车
function pinwheel(ctx, r, seed) {
  ctx.save(); ctx.rotate(frameNo() * 0.45)
  for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * Math.PI / 2); cutPoly(ctx, [[0, 0], [r, -r * 0.1], [r * 0.15, -r * 0.95]], seed + i, 0.4); fillPaper(ctx, i % 2 ? P.mustard : P.coral, 0.5); ctx.restore() }
  cutCircle(ctx, 0, 0, r * 0.18, seed + 5); fillPaper(ctx, P.gold, 0.3, false)
  ctx.restore()
}
function limb(ctx, x, y, ang, len, w, col, seed, end) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang)
  card(ctx, -w / 2, -w * 0.3, w, len + w * 0.3, col, { r: w / 2, seed, lift: 0.9 })
  if (end) end(ctx, len)
  ctx.restore()
}

// 小人。o: { seed, face, look (-1..1), armL, armR (弧度，0 下垂，正值往外抬), hop, tilt, walk, body 纸框颜色, ink 脸的颜色, noGround }
export function doll(ctx, x, y, s, o = {}) {
  const seed = o.seed || 1, body = o.body || '#4F948B', dk = shade(body, -0.25), lt = shade(body, 0.35), f = frameNo()
  place(ctx, x, y - (o.hop || 0), { s, rot: o.tilt || 0, seed: seed * 13 + 1, amp: 1.1 }, c => {
    const BY = -176
    if (!o.noGround) { c.save(); c.globalAlpha *= 0.22; c.fillStyle = '#4a2c14'; c.beginPath(); c.ellipse(0, 4 + (o.hop || 0) / s, 120, 16, 0, 0, TAU); c.fill(); c.restore() }
    for (const sx of [-1, 1]) {
      const step = o.walk ? Math.sin(f * Math.PI / 2 + (sx > 0 ? Math.PI : 0)) * 0.22 : 0
      limb(c, sx * 40, -70, step, 64, 28, dk, seed + 10 + sx, (cc, L) => card(cc, -26 + sx * 6, L - 8, 52, 22, dk, { r: 10, seed: seed + 20 + sx, lift: 0.6 }))
    }
    const armY = BY - 52
    const hand = (cc, L, sd) => { cutCircle(cc, 0, L, 18, sd); fillPaper(cc, lt, 0.6) }
    limb(c, -118, armY, o.armL ?? 0.15, 100, 26, body, seed + 30, (cc, L) => hand(cc, L, seed + 31))
    limb(c, 118, armY, -(o.armR ?? 0.15), 100, 26, body, seed + 32, (cc, L) => hand(cc, L, seed + 33))
    card(c, -90, BY - 80, 180, 160, dk, { r: 26, seed: seed + 43, lift: 0, edge: false })
    card(c, -4, BY - 158, 8, 52, '#B8936A', { r: 4, seed: seed + 40, lift: 0.5 })
    c.save(); c.translate(0, BY - 160); pinwheel(c, 34, seed + 41); c.restore()
    c.save(); c.translate(0, BY); frameBody(c, 240, 218, 30, body); c.restore()
    brad(c, -118, armY, 7); brad(c, 118, armY, 7); brad(c, -40, -70, 6); brad(c, 40, -70, 6)
    c.save(); c.translate(0, BY); c.rotate(o.headTilt || 0)
    head(c, 142, 130, { face: o.face, seed, look: o.look, ink: o.ink || '#3E2B20' })
    c.restore()
  })
}
// 小人的大致尺寸（s = 1）：宽约 300（含手臂），高约 330
export const DOLL_W = 300, DOLL_H = 330
