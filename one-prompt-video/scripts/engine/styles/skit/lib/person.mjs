// 扁平矢量人物（Canvas 路径，成年人约 1:6.5 头身）。移植自风格库的 E-实习生小剧场，去掉了原片的角色设定：
// 这里只有两个普通的办公室角色 a（年轻、乱发、上衣用强调色）和 b（年长、灰发、眼镜、开衫用第二强调色）。
// 坐标单位 = 头高 h；原点在髋关节；默认面朝右（3/4 侧前方），facing: -1 镜像。
// 近侧手臂画在躯干前，远侧手臂在躯干后。手臂是两段式 IK：给手腕目标点，自动求肘部。
import { mix, roundRect } from '../../../core.mjs'

export function cast(c) {
  return {
    a: {
      skin: '#EFCDB0', skinShade: '#DBAF8F', hair: '#26211E', hairHi: '#3B332E', hairStyle: 'messy',
      top: c.accent, topShade: mix(c.accent, '#000000', 0.18), inner: '#F6F1E9', bottom: '#3E4A60', bottomShade: '#323C4F',
      shoe: '#F4F0EA', sole: '#C9C1B6', build: 1, sleeve: 0.68, mouthCol: '#9A5646',
    },
    b: {
      skin: '#DDB291', skinShade: '#C69673', hair: '#8F8880', hairHi: '#ABA59D', hairStyle: 'gray',
      top: c.accent2, topShade: mix(c.accent2, '#000000', 0.18), inner: '#EFE8DC', bottom: '#8C8378', bottomShade: '#776F65',
      shoe: '#4A3A30', sole: '#33281F', build: 1.06, sleeve: 1, glasses: true, age: true, mouthCol: '#8E5544',
    },
  }
}

const DEF = {
  facing: 1, lean: 0, headTilt: 0, look: [0, 0], blink: 0, brow: 'neutral', mouth: 'neutral',
  breath: 0, near: null, far: null, nearHand: 'fist', farHand: 'fist', nearBend: 1, farBend: 1, sweat: 0, headTurn: 1,
}

// 待机：呼吸、眨眼（t 的纯函数）
export function idle(t, seed = 1) {
  const breath = Math.sin(t * 2 * Math.PI / 3.8 + seed)
  const period = 3.3 + (seed % 3) * 0.55
  const k = Math.floor((t + seed * 0.71) / period)
  const h = Math.sin(k * 91.7 + seed * 13.3) * 43758.5453
  const tb = k * period + (h - Math.floor(h)) * (period - 0.5) + 0.2 - seed * 0.71
  const d = Math.abs(t - tb)
  return { breath, blink: d < 0.07 ? 1 : d < 0.13 ? 1 - (d - 0.07) / 0.06 : 0 }
}

function limb(ctx, ax, ay, bx, by, wa, wb, col) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6, nx = -dy / L, ny = dx / L
  ctx.fillStyle = col
  ctx.beginPath()
  ctx.moveTo(ax + nx * wa / 2, ay + ny * wa / 2); ctx.lineTo(bx + nx * wb / 2, by + ny * wb / 2)
  ctx.lineTo(bx - nx * wb / 2, by - ny * wb / 2); ctx.lineTo(ax - nx * wa / 2, ay - ny * wa / 2)
  ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.arc(ax, ay, wa / 2, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(bx, by, wb / 2, 0, Math.PI * 2); ctx.fill()
}

function shoe(ctx, x, y, ch, shade) {
  ctx.fillStyle = shade ? ch.sole : ch.shoe
  ctx.beginPath()
  ctx.moveTo(x - 0.12, y - 0.1); ctx.lineTo(x + 0.1, y - 0.08)
  ctx.quadraticCurveTo(x + 0.44, y - 0.04, x + 0.45, y + 0.1)
  ctx.lineTo(x + 0.45, y + 0.14); ctx.lineTo(x - 0.13, y + 0.14)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = ch.sole; ctx.fillRect(x - 0.13, y + 0.1, 0.58, 0.045)
}

function hand(ctx, x, y, ang, style, col, line) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang)
  ctx.fillStyle = col
  if (style === 'point') {
    ctx.beginPath(); ctx.ellipse(0.08, 0, 0.11, 0.085, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(0.12, -0.06); ctx.lineTo(0.33, -0.05); ctx.arc(0.33, -0.025, 0.027, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0.12, 0.0); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.ellipse(0.06, -0.08, 0.05, 0.03, -0.5, 0, Math.PI * 2); ctx.fill()
  } else if (style === 'open') {
    ctx.beginPath(); ctx.ellipse(0.12, 0, 0.15, 0.1, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(0.05, -0.1, 0.07, 0.035, -0.9, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = line; ctx.lineWidth = 0.014
    for (const yy of [-0.03, 0.02]) { ctx.beginPath(); ctx.moveTo(0.16, yy); ctx.lineTo(0.25, yy); ctx.stroke() }
  } else {
    ctx.beginPath(); ctx.ellipse(0.08, 0, 0.115, 0.09, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(0.07, -0.075, 0.05, 0.032, -0.4, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// 两段式手臂：S 肩，T 手腕目标；bend 选肘部朝向
function arm(ctx, S, T, ch, far, style, bend) {
  const a = 1.12, b = 1.0
  const dx = T[0] - S[0], dy = T[1] - S[1], D = Math.hypot(dx, dy) || 1e-6, ux = dx / D, uy = dy / D
  const d = Math.min(Math.max(D, 0.35), a + b - 0.002)
  const A = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)))) * bend
  const E = [S[0] + a * (ux * Math.cos(A) - uy * Math.sin(A)), S[1] + a * (ux * Math.sin(A) + uy * Math.cos(A))]
  const W = [S[0] + ux * d, S[1] + uy * d]
  const top = far ? ch.topShade : ch.top, skin = far ? ch.skinShade : ch.skin, sl = ch.sleeve
  limb(ctx, S[0], S[1], E[0], E[1], 0.27, 0.21, top)
  const M = [E[0] + (W[0] - E[0]) * sl, E[1] + (W[1] - E[1]) * sl]
  if (sl < 1) limb(ctx, E[0], E[1], W[0], W[1], 0.18, 0.14, skin)
  limb(ctx, E[0], E[1], M[0], M[1], 0.21, sl < 1 ? 0.2 : 0.17, top)
  const ang = Math.atan2(W[1] - E[1], W[0] - E[0])
  if (sl < 1) { // 卷起的袖口
    ctx.save(); ctx.translate(M[0], M[1]); ctx.rotate(ang)
    ctx.fillStyle = far ? ch.topShade : mix(ch.top, '#ffffff', 0.18)
    ctx.beginPath(); ctx.ellipse(0, 0, 0.05, 0.115, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
  hand(ctx, W[0], W[1], ang, style, skin, ch.skinShade)
}

function torsoPath(ctx) {
  ctx.beginPath()
  ctx.moveTo(-0.28, -1.86)
  ctx.quadraticCurveTo(-0.47, -1.83, -0.47, -1.56)
  ctx.bezierCurveTo(-0.46, -1.12, -0.37, -0.82, -0.35, -0.52)
  ctx.bezierCurveTo(-0.35, -0.22, -0.41, -0.02, -0.41, 0.16)
  ctx.lineTo(0.41, 0.16)
  ctx.bezierCurveTo(0.41, 0.0, 0.33, -0.26, 0.33, -0.56)
  ctx.bezierCurveTo(0.34, -0.92, 0.47, -1.14, 0.46, -1.5)
  ctx.quadraticCurveTo(0.45, -1.84, 0.24, -1.88)
  ctx.closePath()
}

function hairFront(ctx, ch) {
  ctx.fillStyle = ch.hair
  ctx.beginPath()
  if (ch.hairStyle === 'gray') {
    const hl = -0.33
    ctx.moveTo(-0.42, 0.24)
    ctx.bezierCurveTo(-0.5, -0.3, -0.3, -0.64, 0.06, -0.62)
    ctx.bezierCurveTo(0.36, -0.61, 0.5, -0.42, 0.45, hl + 0.08)
    ctx.bezierCurveTo(0.34, hl - 0.02, 0.16, hl - 0.04, 0.0, hl + 0.02)
    ctx.bezierCurveTo(-0.08, hl + 0.06, -0.12, -0.12, -0.13, 0.06)
  } else {
    ctx.moveTo(-0.42, 0.22)
    ctx.bezierCurveTo(-0.52, -0.2, -0.44, -0.5, -0.24, -0.6)
    ctx.quadraticCurveTo(-0.18, -0.7, -0.06, -0.64)
    ctx.quadraticCurveTo(0.04, -0.72, 0.14, -0.63)
    ctx.quadraticCurveTo(0.28, -0.68, 0.32, -0.56)
    ctx.quadraticCurveTo(0.52, -0.48, 0.48, -0.2)
    ctx.lineTo(0.4, -0.26); ctx.lineTo(0.34, -0.16)
    ctx.bezierCurveTo(0.22, -0.26, 0.06, -0.26, -0.02, -0.2)
    ctx.bezierCurveTo(-0.1, -0.14, -0.12, -0.06, -0.13, 0.06)
  }
  ctx.lineTo(-0.17, 0.1)
  ctx.quadraticCurveTo(-0.24, 0.0, -0.3, 0.12)
  ctx.quadraticCurveTo(-0.32, 0.24, -0.36, 0.3)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = ch.hairHi; ctx.lineWidth = 0.03
  ctx.beginPath(); ctx.moveTo(-0.22, -0.46); ctx.quadraticCurveTo(0.0, -0.59, 0.24, -0.51); ctx.stroke()
}

function face(ctx, ch) {
  ctx.fillStyle = ch.skin
  ctx.beginPath()
  ctx.moveTo(-0.38, -0.04)
  ctx.bezierCurveTo(-0.4, -0.56, 0.38, -0.62, 0.41, -0.08)
  ctx.bezierCurveTo(0.43, 0.16, 0.33, 0.38, 0.14, 0.48)
  ctx.bezierCurveTo(0.03, 0.53, -0.18, 0.44, -0.3, 0.27)
  ctx.bezierCurveTo(-0.37, 0.16, -0.38, 0.06, -0.38, -0.04)
  ctx.closePath(); ctx.fill()
}

function ear(ctx, ch) {
  ctx.fillStyle = ch.skin
  ctx.beginPath(); ctx.ellipse(-0.24, 0.05, 0.07, 0.105, -0.15, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = ch.skinShade; ctx.lineWidth = 0.02
  ctx.beginPath(); ctx.arc(-0.24, 0.05, 0.04, -1.8, 1.4); ctx.stroke()
}

const BROWS = {
  neutral: [[-0.06, -0.1, 0.1, -0.11], [0.21, -0.11, 0.35, -0.1]],
  up: [[-0.06, -0.15, 0.1, -0.17], [0.21, -0.17, 0.35, -0.15]],
  worry: [[-0.06, -0.1, 0.1, -0.16], [0.21, -0.16, 0.35, -0.1]],
  focus: [[-0.06, -0.125, 0.1, -0.105], [0.21, -0.105, 0.35, -0.125]],
}

function features(ctx, ch, p) {
  const ink = '#2B2F38', lx = p.look[0] * 0.025, ly = p.look[1] * 0.02
  for (const [x, y, s] of [[0.03, 0.03, 1], [0.29, 0.03, 0.82]]) {
    ctx.fillStyle = ink
    if (p.blink > 0.75) {
      ctx.strokeStyle = ink; ctx.lineWidth = 0.022
      ctx.beginPath(); ctx.moveTo(x - 0.04 * s, y + 0.005); ctx.quadraticCurveTo(x, y + 0.03, x + 0.04 * s, y + 0.005); ctx.stroke()
    } else {
      const wide = p.brow === 'up' ? 1.15 : 1
      ctx.beginPath(); ctx.ellipse(x + lx, y + ly, 0.036 * s * wide, Math.max(0.01, 0.052 * wide * (1 - p.blink)), 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath(); ctx.arc(x + lx + 0.012 * s, y + ly - 0.016, 0.011, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.strokeStyle = mix(ch.hair, '#2B2F38', 0.4); ctx.lineWidth = 0.032
  for (const [x1, y1, x2, y2] of BROWS[p.brow] || BROWS.neutral) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 0.02, x2, y2); ctx.stroke()
  }
  ctx.strokeStyle = ch.skinShade; ctx.lineWidth = 0.026
  ctx.beginPath(); ctx.moveTo(0.34, -0.01); ctx.quadraticCurveTo(0.44, 0.13, 0.35, 0.16); ctx.stroke()
  const mx = 0.2, my = 0.3
  ctx.strokeStyle = ch.mouthCol; ctx.fillStyle = ch.mouthCol; ctx.lineWidth = 0.026
  ctx.beginPath()
  switch (p.mouth) {
    case 'smile': ctx.moveTo(mx - 0.08, my - 0.025); ctx.quadraticCurveTo(mx, my + 0.055, mx + 0.08, my - 0.035); ctx.stroke(); break
    case 'grin': ctx.moveTo(mx - 0.085, my - 0.03); ctx.quadraticCurveTo(mx, my + 0.08, mx + 0.085, my - 0.04); ctx.closePath(); ctx.fill(); break
    case 'open': ctx.ellipse(mx, my, 0.045, 0.032, 0, 0, Math.PI * 2); ctx.fill(); break
    case 'o': ctx.ellipse(mx + 0.01, my, 0.03, 0.04, 0, 0, Math.PI * 2); ctx.fill(); break
    case 'flat': ctx.moveTo(mx - 0.065, my); ctx.lineTo(mx + 0.065, my - 0.005); ctx.stroke(); break
    case 'frown': ctx.moveTo(mx - 0.07, my + 0.02); ctx.quadraticCurveTo(mx, my - 0.03, mx + 0.07, my + 0.015); ctx.stroke(); break
    default: ctx.moveTo(mx - 0.065, my); ctx.quadraticCurveTo(mx, my + 0.018, mx + 0.065, my - 0.008); ctx.stroke()
  }
  ctx.fillStyle = 'rgba(200,119,90,0.16)'
  ctx.beginPath(); ctx.ellipse(0.0, 0.17, 0.07, 0.045, 0, 0, Math.PI * 2); ctx.fill()
  if (ch.age) {
    ctx.strokeStyle = ch.skinShade; ctx.lineWidth = 0.016
    ctx.beginPath(); ctx.moveTo(0.3, 0.17); ctx.quadraticCurveTo(0.27, 0.25, 0.3, 0.32); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0.06, -0.22); ctx.lineTo(0.22, -0.23); ctx.stroke()
  }
  if (ch.glasses) {
    ctx.strokeStyle = '#2F3B52'; ctx.lineWidth = 0.024
    for (const [x, w] of [[-0.06, 0.18], [0.22, 0.14]]) { roundRect(ctx, x, -0.04, w, 0.13, 0.04); ctx.stroke() }
    ctx.beginPath(); ctx.moveTo(0.12, 0.0); ctx.quadraticCurveTo(0.17, -0.02, 0.22, 0.0); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-0.06, 0.0); ctx.lineTo(-0.2, -0.01); ctx.stroke()
  }
}

// 冒汗：额角一滴汗，p = 0..1（变大、往下滑一点）。原样片的汗滴偏小，人物缩到三分之一画高后看不清，这里放大到 1.5 倍
function sweatDrop(ctx, p) {
  const s = (0.75 + 0.25 * p) * 1.5
  ctx.save()
  ctx.translate(0.5, -0.28 + 0.16 * p); ctx.scale(s, s)
  ctx.globalAlpha *= Math.min(1, p * 3)
  ctx.fillStyle = '#8EC5E8'
  ctx.beginPath()
  ctx.moveTo(0, -0.13)
  ctx.bezierCurveTo(0.03, -0.06, 0.075, -0.01, 0.075, 0.035)
  ctx.arc(0, 0.035, 0.075, 0, Math.PI)
  ctx.bezierCurveTo(-0.075, -0.01, -0.03, -0.06, 0, -0.13)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.beginPath(); ctx.ellipse(-0.025, 0.03, 0.017, 0.03, 0.3, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// 站姿人物。X,Y = 髋关节屏幕坐标；h = 头高（像素）
export function drawPerson(ctx, ch, X, Y, h, pose = {}) {
  const p = { ...DEF, ...pose }
  ctx.save()
  ctx.translate(X, Y); ctx.scale(h * p.facing, h)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const br = p.breath, lean = p.lean, sy = -0.012 * br
  const rot = (x, y) => [x * Math.cos(lean) - y * Math.sin(lean), x * Math.sin(lean) + y * Math.cos(lean)]
  const Sn = rot(-0.27 * ch.build, -1.72 + sy), Sf = rot(0.3 * ch.build, -1.76 + sy)
  arm(ctx, Sf, p.far || [0.32, 0.3], ch, true, p.farHand, p.farBend)
  limb(ctx, 0.14, 0.0, 0.16, 1.56, 0.36, 0.25, ch.bottomShade)
  limb(ctx, 0.16, 1.56, 0.17, 3.06, 0.24, 0.18, ch.bottomShade)
  shoe(ctx, 0.17, 3.08, ch, true)
  limb(ctx, -0.12, 0.02, -0.1, 1.6, 0.38, 0.26, ch.bottom)
  limb(ctx, -0.1, 1.6, -0.1, 3.1, 0.25, 0.19, ch.bottom)
  shoe(ctx, -0.1, 3.12, ch, false)
  ctx.save()
  ctx.rotate(lean)
  ctx.save()
  ctx.translate(0, 0.16); ctx.scale(ch.build, 1 + 0.008 * br); ctx.translate(0, -0.16)
  torsoPath(ctx); ctx.fillStyle = ch.top; ctx.fill()
  ctx.save(); ctx.clip()
  ctx.fillStyle = ch.topShade
  ctx.beginPath(); ctx.moveTo(-0.6, -2); ctx.lineTo(-0.24, -2); ctx.bezierCurveTo(-0.16, -1.2, -0.22, -0.5, -0.2, 0.3); ctx.lineTo(-0.6, 0.3); ctx.closePath(); ctx.fill()
  ctx.fillStyle = ch.inner
  ctx.beginPath(); ctx.moveTo(-0.06, -1.9); ctx.lineTo(0.24, -1.9); ctx.lineTo(0.1, -1.56); ctx.closePath(); ctx.fill()
  if (ch.hairStyle === 'gray') { // 开衫门襟
    ctx.strokeStyle = ch.topShade; ctx.lineWidth = 0.03
    ctx.beginPath(); ctx.moveTo(0.1, -1.56); ctx.quadraticCurveTo(0.14, -0.8, 0.12, 0.2); ctx.stroke()
    ctx.fillStyle = ch.inner
    for (const yy of [-1.2, -0.85, -0.5]) { ctx.beginPath(); ctx.arc(0.16, yy, 0.025, 0, Math.PI * 2); ctx.fill() }
  }
  ctx.restore(); ctx.restore()
  ctx.fillStyle = ch.skinShade
  ctx.fillRect(-0.07, -2.14, 0.22, 0.28)
  ctx.strokeStyle = ch.topShade; ctx.lineWidth = 0.028
  ctx.beginPath(); ctx.moveTo(-0.1, -1.9); ctx.lineTo(0.1, -1.6); ctx.lineTo(0.26, -1.9); ctx.stroke()
  // 头。转头 = 头部水平镜像，headTurn 1 朝前、-1 朝后；过渡中间最窄保留 30% 宽
  ctx.save()
  ctx.translate(0.04, -2.08 + sy * 0.5); ctx.rotate(p.headTilt); ctx.translate(0.03, -0.5)
  if (p.headTurn !== 1) { const ht = p.headTurn; ctx.scale((ht < 0 ? -1 : 1) * Math.max(0.3, Math.abs(ht)), 1) }
  face(ctx, ch); hairFront(ctx, ch); ear(ctx, ch); features(ctx, ch, p)
  if (p.sweat > 0) sweatDrop(ctx, p.sweat)
  ctx.restore()
  ctx.restore()
  arm(ctx, Sn, p.near || [-0.2, 0.32], ch, false, p.nearHand, p.nearBend)
  ctx.restore()
}

// 头部中心在屏幕上的位置（放感叹号、问号、对话气泡用）
export function headPos(X, Y, h, pose = {}) {
  const f = pose.facing ?? 1, lean = pose.lean ?? 0, x = 0.07, y = -2.58
  return [X + (x * Math.cos(lean) - y * Math.sin(lean)) * h * f, Y + (x * Math.sin(lean) + y * Math.cos(lean)) * h]
}
