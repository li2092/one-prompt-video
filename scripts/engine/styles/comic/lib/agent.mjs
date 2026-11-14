// 主角：代码画的小人（移植自风格库的 V-漫画分镜 的 lib/agent.mjs）。显示器脑袋（白壳黑屏，屏上白色五官），
// 头顶三根粗描边尖刺（中间顶强调色的球），胸口一盏强调色的灯。颜色取主题的 c，字体取引擎的字体。
// 原点在两脚中间的地面上，s = 脑袋宽度，全身约 2.6s 高（含尖刺）。
// o.face 眼睛：dot happy star shock wide dizzy smug sad blink
// o.mouth 嘴：smile grin o open flat wavy smirk sad
// o.pose 手：idle cheer thumbs point hips shrug panic hold wave reach
// o.legs 腿：stand run jump wide
// o.fx 头边符号：sweat shock blush q excl sparkle
import { K, toneFill } from './comic.mjs'

const POSES = {
  idle: [0.22, 0.25, 0.22, 0.25], cheer: [2.7, 0.2, 2.7, 0.2], thumbs: [0.22, 0.25, 1.15, 1.6], point: [0.22, 0.25, 1.55, 0.05],
  hips: [0.75, 2.0, 0.75, 2.0], shrug: [1.1, -1.5, 1.1, -1.5], panic: [2.4, 0.6, 2.2, 0.8], hold: [0.9, 1.0, 0.9, 1.0],
  wave: [0.22, 0.25, 2.3, 0.5], reach: [1.3, 0.2, 1.3, 0.2],
}

export function agent(ctx, E, x, y, s, o = {}) {
  const k = K(E), t = o.t || 0, lw = Math.max(3 * E.u, s * 0.07)
  ctx.save()
  ctx.translate(x, y + (o.bob ? Math.sin(t * 7) * s * 0.025 : 0))
  if (o.flip) ctx.scale(-1, 1)
  if (o.lean) ctx.rotate(o.lean)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = k.ink

  // ---- 腿 ----
  const legs = o.legs || 'stand', hipY = -0.52 * s
  const leg = (side, fx, fy, kx, ky) => {
    const hx = side * 0.16 * s
    ctx.lineWidth = s * 0.13; ctx.strokeStyle = k.ink; ctx.beginPath(); ctx.moveTo(hx, hipY); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke()
    ctx.lineWidth = s * 0.06; ctx.strokeStyle = k.white; ctx.beginPath(); ctx.moveTo(hx, hipY); ctx.quadraticCurveTo(kx, ky, fx, fy); ctx.stroke()
    ctx.strokeStyle = k.ink; ctx.fillStyle = k.ink; ctx.beginPath(); ctx.ellipse(fx + side * 0.05 * s, fy - 0.03 * s, 0.13 * s, 0.07 * s, 0, 0, Math.PI * 2); ctx.fill()
  }
  if (legs === 'run') {
    const ph = Math.sin(t * 14)
    leg(-1, -0.12 * s - ph * 0.22 * s, -0.02 * s + Math.max(0, ph) * -0.12 * s, -0.2 * s, -0.3 * s)
    leg(1, 0.12 * s + ph * 0.22 * s, -0.02 * s + Math.max(0, -ph) * -0.12 * s, 0.2 * s, -0.3 * s)
  } else if (legs === 'jump') { leg(-1, -0.3 * s, -0.12 * s, -0.42 * s, -0.4 * s); leg(1, 0.3 * s, -0.12 * s, 0.42 * s, -0.4 * s) }
  else if (legs === 'wide') { leg(-1, -0.36 * s, 0, -0.3 * s, -0.3 * s); leg(1, 0.36 * s, 0, 0.3 * s, -0.3 * s) }
  else { leg(-1, -0.2 * s, 0, -0.19 * s, -0.25 * s); leg(1, 0.2 * s, 0, 0.19 * s, -0.25 * s) }

  // ---- 胳膊 ----
  let [aL, eL, aR, eR] = POSES[o.pose || 'idle'] || POSES.idle
  if (o.pose === 'panic') { aL += Math.sin(t * 20) * 0.4; aR += Math.sin(t * 20 + 1.6) * 0.4 }
  if (o.pose === 'wave') eR += Math.sin(t * 12) * 0.5
  const shY = -0.98 * s
  const arm = (side, a, e) => {
    const sx = side * 0.34 * s, x1 = sx + side * Math.sin(a) * 0.3 * s, y1 = shY + Math.cos(a) * 0.3 * s, b = a + e
    const x2 = x1 + side * Math.sin(b) * 0.28 * s, y2 = y1 + Math.cos(b) * 0.28 * s
    ctx.lineWidth = s * 0.12; ctx.strokeStyle = k.ink; ctx.beginPath(); ctx.moveTo(sx, shY); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.lineWidth = s * 0.05; ctx.strokeStyle = k.white; ctx.beginPath(); ctx.moveTo(sx, shY); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    ctx.fillStyle = k.white; ctx.strokeStyle = k.ink; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.arc(x2, y2, 0.085 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    if (side === 1 && o.pose === 'thumbs') { ctx.lineWidth = s * 0.07; ctx.beginPath(); ctx.moveTo(x2, y2 - 0.06 * s); ctx.lineTo(x2 + 0.02 * s, y2 - 0.2 * s); ctx.stroke() }
  }

  // ---- 身体：右侧一块网点阴影，胸口一盏灯两道散热口 ----
  ctx.lineWidth = lw; ctx.fillStyle = k.white; ctx.strokeStyle = k.ink
  E.roundRect(ctx, -0.34 * s, -1.1 * s, 0.68 * s, 0.62 * s, 0.16 * s); ctx.fill()
  ctx.save(); E.roundRect(ctx, -0.34 * s, -1.1 * s, 0.68 * s, 0.62 * s, 0.16 * s); ctx.clip()
  ctx.beginPath(); ctx.rect(0.12 * s, -1.2 * s, 0.4 * s, 0.8 * s); toneFill(ctx, E, 0.1 * s, -1.2 * s, 0.4 * s, 0.8 * s, { step: 7, r: 1.7 })
  ctx.restore()
  E.roundRect(ctx, -0.34 * s, -1.1 * s, 0.68 * s, 0.62 * s, 0.16 * s); ctx.stroke()
  ctx.fillStyle = k.red; ctx.beginPath(); ctx.arc(-0.12 * s, -0.86 * s, 0.07 * s, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.stroke()
  ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(0.04 * s, -0.9 * s); ctx.lineTo(0.2 * s, -0.9 * s); ctx.moveTo(0.04 * s, -0.8 * s); ctx.lineTo(0.2 * s, -0.8 * s); ctx.stroke()
  arm(-1, aL, eL); arm(1, aR, eR)

  // ---- 脑袋 ----
  const hy = -1.98 * s
  spikes(ctx, E, s, hy, o.antenna ? Math.sin(t * 18) * 0.12 * s : 0, lw)
  ctx.lineWidth = lw; ctx.fillStyle = k.white; ctx.strokeStyle = k.ink
  ;[-1, 1].forEach(sd => { E.roundRect(ctx, sd * 0.56 * s - 0.06 * s, -1.62 * s, 0.12 * s, 0.24 * s, 0.04 * s); ctx.fill(); ctx.stroke() })
  ctx.fillStyle = k.ink; E.roundRect(ctx, -0.5 * s, hy + 0.05 * s, 1.1 * s, 0.88 * s, 0.2 * s); ctx.fill()
  ctx.fillStyle = k.white; E.roundRect(ctx, -0.55 * s, hy, 1.1 * s, 0.88 * s, 0.2 * s); ctx.fill(); ctx.stroke()
  ctx.fillStyle = k.ink; E.roundRect(ctx, -0.44 * s, hy + 0.1 * s, 0.88 * s, 0.66 * s, 0.13 * s); ctx.fill()
  ctx.strokeStyle = E.rgba(k.white, 0.35); ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(-0.34 * s, hy + 0.2 * s); ctx.lineTo(-0.24 * s, hy + 0.2 * s); ctx.stroke()
  face(ctx, E, k, hy + 0.43 * s, s, o, t)
  fx(ctx, E, k, s, hy, o, t)
  ctx.restore()
}

// 刺头：原点在头顶中点（hy），wob 是尖端的横向晃动
function spikes(ctx, E, s, hy, wob, lw) {
  const k = K(E), SP = [[-0.3, 0.26, -0.28], [0, 0.42, 0.04], [0.3, 0.3, 0.26]]
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = k.ink; ctx.fillStyle = k.white
  ctx.beginPath(); ctx.moveTo(-0.44 * s, hy + 0.02 * s)
  for (const [bx, h, dx] of SP) { ctx.lineTo((bx - 0.13) * s, hy + 0.02 * s); ctx.lineTo((bx + dx) * s + wob, hy - h * s); ctx.lineTo((bx + 0.13) * s, hy + 0.02 * s) }
  ctx.lineTo(0.44 * s, hy + 0.02 * s); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = k.red; ctx.beginPath(); ctx.arc(0.04 * s + wob, hy - 0.42 * s, 0.075 * s, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.stroke()
  ctx.restore()
}

function face(ctx, E, k, fy, s, o, t) {
  let f = o.face || 'dot'
  if (f === 'dot' && ((t + (o.seed || 0) * 0.7) % 3.3) < 0.11) f = 'blink'   // 自动眨眼
  const ex = 0.19 * s, ey = fy - 0.06 * s, lk = o.look || [0, 0]
  ctx.save(); ctx.translate(lk[0] * s * 0.06, lk[1] * s * 0.04)
  ctx.fillStyle = k.white; ctx.strokeStyle = k.white; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.055
  for (const sd of [-1, 1]) {
    const x = sd * ex, y = ey
    ctx.beginPath()
    if (f === 'happy') { ctx.arc(x, y + 0.04 * s, 0.08 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke() }
    else if (f === 'star') { const r = 0.11 * s; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) } ctx.closePath(); ctx.fill() }
    else if (f === 'shock') { ctx.arc(x, y, 0.11 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.ink; ctx.beginPath(); ctx.arc(x, y, 0.025 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.white }
    else if (f === 'wide') { ctx.arc(x, y, 0.09 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.ink; ctx.beginPath(); ctx.arc(x + 0.02 * s, y + 0.01 * s, 0.04 * s, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.white }
    else if (f === 'dizzy') { const rot = t * 8 * sd; for (let i = 0; i <= 26; i++) { const a = i / 26 * Math.PI * 4 + rot, r = 0.012 * s + i / 26 * 0.09 * s; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) } ctx.lineWidth = s * 0.035; ctx.stroke(); ctx.lineWidth = s * 0.055 }
    else if (f === 'smug') { ctx.moveTo(x - 0.09 * s, y); ctx.lineTo(x + 0.09 * s, y); ctx.arc(x, y, 0.09 * s, 0, Math.PI); ctx.fill() }
    else if (f === 'sad') { ctx.arc(x, y - 0.03 * s, 0.08 * s, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke() }
    else if (f === 'blink') { ctx.moveTo(x - 0.07 * s, y + 0.02 * s); ctx.lineTo(x + 0.07 * s, y + 0.02 * s); ctx.stroke() }
    else { E.roundRect(ctx, x - 0.05 * s, y - 0.1 * s, 0.1 * s, 0.2 * s, 0.05 * s); ctx.fill() }
  }
  const my = fy + 0.17 * s
  ctx.beginPath()
  switch (o.mouth || 'smile') {
    case 'grin': ctx.moveTo(-0.15 * s, my - 0.03 * s); ctx.lineTo(0.15 * s, my - 0.03 * s); ctx.arc(0, my - 0.03 * s, 0.15 * s, 0, Math.PI); ctx.fill(); break
    case 'o': ctx.ellipse(0, my, 0.05 * s, 0.06 * s, 0, 0, Math.PI * 2); ctx.lineWidth = s * 0.04; ctx.stroke(); break
    case 'open': ctx.ellipse(0, my + 0.01 * s, 0.09 * s, 0.11 * s, 0, 0, Math.PI * 2); ctx.fill(); break
    case 'flat': ctx.moveTo(-0.1 * s, my); ctx.lineTo(0.1 * s, my); ctx.stroke(); break
    case 'wavy': for (let i = 0; i <= 12; i++) ctx.lineTo(-0.14 * s + i / 12 * 0.28 * s, my + Math.sin(i / 12 * Math.PI * 3) * 0.025 * s); ctx.lineWidth = s * 0.04; ctx.stroke(); break
    case 'smirk': ctx.moveTo(-0.11 * s, my); ctx.quadraticCurveTo(0.04 * s, my + 0.05 * s, 0.13 * s, my - 0.06 * s); ctx.stroke(); break
    case 'sad': ctx.arc(0, my + 0.06 * s, 0.09 * s, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); break
    default: ctx.arc(0, my - 0.05 * s, 0.1 * s, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke()
  }
  if ((o.fx || []).includes('blush')) {
    ctx.strokeStyle = k.red; ctx.lineWidth = s * 0.025
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const x = sd * 0.3 * s + i * 0.035 * s - 0.035 * s; ctx.beginPath(); ctx.moveTo(x, my - 0.05 * s); ctx.lineTo(x - 0.02 * s, my + 0.01 * s); ctx.stroke() }
  }
  ctx.restore()
}

function fx(ctx, E, k, s, hy, o, t) {
  const list = o.fx || []
  ctx.save(); ctx.lineCap = 'round'
  if (list.includes('sweat')) {
    ctx.save(); ctx.translate(0.66 * s, hy + 0.15 * s + ((t * 1.2) % 1) * 0.2 * s)
    ctx.beginPath(); ctx.moveTo(0, -0.12 * s); ctx.quadraticCurveTo(0.09 * s, 0.02 * s, 0, 0.06 * s); ctx.quadraticCurveTo(-0.09 * s, 0.02 * s, 0, -0.12 * s)
    ctx.fillStyle = k.white; ctx.fill(); ctx.lineWidth = s * 0.035; ctx.strokeStyle = k.ink; ctx.stroke(); ctx.restore()
  }
  if (list.includes('shock')) {
    ctx.strokeStyle = k.ink; ctx.lineWidth = s * 0.05
    const j = Math.sin(t * 30) * 0.02 * s
    ;[[-0.62, -0.1, -0.85, -0.3], [-0.3, -0.28, -0.4, -0.55], [0.62, -0.1, 0.85, -0.3]].forEach(([a, b, c, d]) => { ctx.beginPath(); ctx.moveTo(a * s, hy + b * s + j); ctx.lineTo(c * s, hy + d * s + j); ctx.stroke() })
  }
  const glyph = (ch, x, y, size, col) => {
    ctx.save(); ctx.font = E.font('title', 900, size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = k.white; ctx.strokeText(ch, x, y); ctx.fillStyle = col; ctx.fillText(ch, x, y); ctx.restore()
  }
  if (list.includes('q')) glyph('?', 0.75 * s, hy - 0.15 * s + Math.sin(t * 5) * 0.03 * s, 0.5 * s, k.ink)
  if (list.includes('excl')) glyph('!', 0.72 * s, hy - 0.12 * s, 0.6 * s, k.red)
  if (list.includes('sparkle')) {
    const q = 0.75 + 0.25 * Math.sin(t * 9)
    ;[[-0.8, -0.2, 0.32], [0.82, -0.05, 0.26], [0.6, -0.45, 0.18]].forEach(([a, b, r], i) => {
      ctx.save(); ctx.translate(a * s, hy + b * s); ctx.scale(i === 1 ? q : 2 - q, i === 1 ? q : 2 - q); ctx.fillStyle = k.ink
      ctx.beginPath(); for (let j = 0; j < 8; j++) { const aa = j / 8 * Math.PI * 2, rr = j % 2 ? r * s * 0.12 : r * s * 0.5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr) } ctx.closePath(); ctx.fill(); ctx.restore()
    })
  }
  ctx.restore()
}
