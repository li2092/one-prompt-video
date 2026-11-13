// 吉祥物（移植自风格库的 J-综艺花字，去掉了肚子上的字）：圆滚滚的软糖身体、天线星星、大眼睛，跟着 128 拍一拍一颠。
// mood：happy 开心 / smug 得意 / sweat 冒汗 / shock 震惊 / cheer 双手举高 / point 伸手指（aim 是指向的角度）/ mic 举着话筒
// 原点在身体中心，s = 身体高度；头顶的星星到脚底约 1.37 s。t 用于待机颠动和眨眼。
import { P, fatLine, sparkle } from './fx.mjs'
import { mix, rgba } from '../../../core.mjs'

const BEAT = 60 / 128

export function mascot(ctx, E, t, { s, mood = 'happy', look = 0, bounce = 1, bump = 99, aim = Math.PI, reach = 0.7 * s } = {}) {
  const u = E.u, body = P.cyan, body2 = P.blue
  const ph = (t / BEAT) % 1, hop = Math.sin(ph * Math.PI) * s * 0.035 * bounce
  let sq = 1 - 0.035 * bounce * Math.cos(ph * Math.PI * 2)
  if (mood === 'shock') sq = 1.06
  const bp = bump >= 0 && bump < 0.35 ? Math.sin(bump / 0.35 * Math.PI) * 0.12 : 0
  ctx.save()
  ctx.translate(0, -hop)
  ctx.scale((2 - sq) * (1 + bp), sq * (1 + bp))
  const w = s * 0.92, h = s, L = Math.max(3 * u, s * 0.032)
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  // 脚
  for (const d of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(d * w * 0.2, h * 0.47, w * 0.13, h * 0.07, 0, 0, Math.PI * 2)
    ctx.fillStyle = body2; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = P.ink; ctx.stroke()
  }
  // 手臂（在身体后面）：每只手是 [x, y]（身体宽高的倍数）
  const arms = {
    happy: [[-0.62, 0.2], [0.62, 0.2]], smug: [[-0.5, 0.33], [0.5, 0.33]], sweat: [[-0.3, -0.05], [0.56, 0.24]],
    shock: [[-0.66, -0.38], [0.66, -0.38]], cheer: [[-0.7, -0.52], [0.7, -0.52]], mic: [[-0.7, -0.3], [0.46, 0.3]],
  }[mood] || [[-0.55, 0.3], [0.55, 0.3]]
  if (mood === 'point') {
    const d = Math.cos(aim) < 0 ? 0 : 1, sx = (d ? 1 : -1) * w * 0.42, sy = h * 0.08
    arms[d] = [(sx + Math.cos(aim) * reach) / w, (sy + Math.sin(aim) * reach) / h]
  }
  arms.forEach(([ax, ay], k) => {
    const sx = (k ? 1 : -1) * w * 0.42, sy = h * 0.08
    const wave = (mood === 'happy' || mood === 'cheer') && k === 1 ? Math.sin(t * 9) * 0.08 : mood === 'mic' && k === 0 ? Math.sin(t * 8) * 0.06 : 0
    const ex = ax * w, ey = (ay + wave) * h
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey)
    ctx.lineWidth = s * 0.11 + L * 2; ctx.strokeStyle = P.ink; ctx.stroke()
    ctx.lineWidth = s * 0.11; ctx.strokeStyle = body2; ctx.stroke()
    if (mood === 'point' && (Math.cos(aim) < 0 ? k === 0 : k === 1)) {
      const fx = ex + Math.cos(aim) * s * 0.1, fy = ey + Math.sin(aim) * s * 0.1
      fatLine(ctx, E, [[ex, ey], [fx, fy]], P.white, s * 0.04 / u)
    }
    ctx.beginPath(); ctx.arc(ex, ey, s * 0.075, 0, Math.PI * 2); ctx.fillStyle = P.white; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = P.ink; ctx.stroke()
  })
  // 天线
  ctx.beginPath(); ctx.moveTo(0, -h * 0.46); ctx.quadraticCurveTo(w * 0.08, -h * 0.6, w * 0.02, -h * 0.68)
  ctx.lineWidth = L * 1.4; ctx.strokeStyle = P.ink; ctx.stroke()
  sparkle(ctx, E, w * 0.02, -h * 0.72, s * (0.11 + 0.025 * Math.sin(t * 6)), { color: P.yellow, rot: t * 1.5 })
  // 身体
  const bodyPath = () => {
    ctx.beginPath(); ctx.moveTo(0, -h * 0.5)
    ctx.bezierCurveTo(w * 0.42, -h * 0.5, w * 0.52, -h * 0.2, w * 0.5, h * 0.12)
    ctx.bezierCurveTo(w * 0.48, h * 0.42, w * 0.28, h * 0.48, 0, h * 0.48)
    ctx.bezierCurveTo(-w * 0.28, h * 0.48, -w * 0.48, h * 0.42, -w * 0.5, h * 0.12)
    ctx.bezierCurveTo(-w * 0.52, -h * 0.2, -w * 0.42, -h * 0.5, 0, -h * 0.5)
    ctx.closePath()
  }
  ctx.save(); ctx.translate(s * 0.05, s * 0.05); bodyPath(); ctx.fillStyle = P.ink; ctx.fill(); ctx.restore()
  bodyPath()
  const g = ctx.createLinearGradient(0, -h * 0.5, 0, h * 0.5); g.addColorStop(0, body); g.addColorStop(1, body2)
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = L * 1.3; ctx.strokeStyle = P.ink; ctx.stroke()
  ctx.beginPath(); ctx.ellipse(-w * 0.26, -h * 0.3, w * 0.09, h * 0.05, -0.6, 0, Math.PI * 2); ctx.fillStyle = rgba(P.white, 0.75); ctx.fill()
  ctx.beginPath(); ctx.ellipse(0, h * 0.27, w * 0.2, h * 0.11, 0, 0, Math.PI * 2); ctx.fillStyle = rgba(P.white, 0.5); ctx.fill()
  // 腮红
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.ellipse(d * w * 0.31, h * 0.04, w * 0.075, h * 0.04, 0, 0, Math.PI * 2); ctx.fillStyle = rgba(P.hot, 0.55); ctx.fill() }
  // 眼睛
  const ex = w * 0.19, ey = -h * 0.1, blink = (t + 0.4) % 3.1 < 0.1
  const open = ['happy', 'point', 'mic'].includes(mood)
  ctx.lineWidth = L * 1.2; ctx.strokeStyle = P.ink
  for (const d of [-1, 1]) {
    ctx.save(); ctx.translate(d * ex, ey)
    if (open && !blink) {
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.085, s * 0.105, 0, 0, Math.PI * 2); ctx.fillStyle = P.white; ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(look * s * 0.03, s * 0.01, s * 0.055, 0, Math.PI * 2); ctx.fillStyle = P.ink; ctx.fill()
      ctx.beginPath(); ctx.arc(look * s * 0.03 - s * 0.02, -s * 0.015, s * 0.018, 0, Math.PI * 2); ctx.fillStyle = P.white; ctx.fill()
    } else if (mood === 'smug' || mood === 'cheer') {
      ctx.beginPath(); ctx.arc(0, s * 0.03, s * 0.07, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = L * 1.6; ctx.stroke()
      if (mood === 'smug') { ctx.beginPath(); ctx.moveTo(-s * 0.07, -s * 0.1 - d * s * 0.015); ctx.lineTo(s * 0.07, -s * 0.12 + d * s * 0.015); ctx.lineWidth = L * 1.3; ctx.stroke() }
    } else if (mood === 'sweat') {
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.085, s * 0.1, 0, 0, Math.PI * 2); ctx.fillStyle = P.white; ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(-s * 0.03, s * 0.03, s * 0.035, 0, Math.PI * 2); ctx.fillStyle = P.ink; ctx.fill()
      ctx.beginPath(); ctx.moveTo(-d * s * 0.08, -s * 0.18); ctx.lineTo(d * s * 0.07, -s * 0.125); ctx.lineWidth = L * 1.3; ctx.stroke()
    } else if (mood === 'shock') {
      ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, Math.PI * 2); ctx.fillStyle = P.white; ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, s * 0.025, 0, Math.PI * 2); ctx.fillStyle = P.ink; ctx.fill()
    } else { ctx.beginPath(); ctx.moveTo(-s * 0.07, 0); ctx.lineTo(s * 0.07, 0); ctx.lineWidth = L * 1.6; ctx.stroke() }
    ctx.restore()
  }
  // 嘴
  ctx.save(); ctx.translate(0, h * 0.08); ctx.lineWidth = L * 1.3; ctx.strokeStyle = P.ink
  if (mood === 'happy' || mood === 'point' || mood === 'cheer') {
    ctx.beginPath(); ctx.moveTo(-s * 0.09, 0); ctx.quadraticCurveTo(0, s * 0.14, s * 0.09, 0); ctx.closePath(); ctx.fillStyle = P.ink; ctx.fill()
    ctx.beginPath(); ctx.ellipse(0, s * 0.045, s * 0.04, s * 0.02, 0, 0, Math.PI * 2); ctx.fillStyle = P.hot; ctx.fill()
  } else if (mood === 'smug') {
    ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.01); ctx.quadraticCurveTo(s * 0.02, s * 0.07, s * 0.1, -s * 0.03); ctx.stroke()
  } else if (mood === 'sweat') {
    ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.03)
    for (let i = 1; i <= 4; i++) ctx.lineTo(-s * 0.08 + i * s * 0.04, s * (i % 2 ? 0 : 0.03))
    ctx.stroke()
  } else {
    // 震惊、举话筒：张大的圆嘴（举话筒时一开一合）
    const k = mood === 'mic' ? 0.6 + 0.4 * Math.abs(Math.sin(t * 9)) : 1
    ctx.beginPath(); ctx.ellipse(0, s * 0.04, s * 0.05, s * 0.075 * k, 0, 0, Math.PI * 2); ctx.fillStyle = P.ink; ctx.fill()
  }
  ctx.restore()
  // 话筒：右手握着，网罩凑到嘴边
  if (mood === 'mic') {
    const hx = 0.46 * w, hy = 0.3 * h, mx = 0.27 * w, my = 0.14 * h
    fatLine(ctx, E, [[hx + s * 0.03, hy + s * 0.06], [mx, my]], P.ink, s * 0.045 / u)
    ctx.beginPath(); ctx.arc(hx, hy, s * 0.075, 0, Math.PI * 2); ctx.fillStyle = P.white; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = P.ink; ctx.stroke()
    ctx.beginPath(); ctx.arc(mx, my, s * 0.085, 0, Math.PI * 2); ctx.fillStyle = mix(P.white, P.ink, 0.25); ctx.fill(); ctx.lineWidth = L * 1.2; ctx.stroke()
    ctx.beginPath(); ctx.moveTo(mx - s * 0.06, my); ctx.lineTo(mx + s * 0.06, my); ctx.moveTo(mx, my - s * 0.06); ctx.lineTo(mx, my + s * 0.06); ctx.lineWidth = L * 0.7; ctx.stroke()
  }
  if (mood === 'sweat') {
    const dy = ((t * 0.9) % 1) * s * 0.12
    ctx.save(); ctx.translate(w * 0.47, -h * 0.3 + dy)
    ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.quadraticCurveTo(s * 0.06, 0, 0, s * 0.04); ctx.quadraticCurveTo(-s * 0.06, 0, 0, -s * 0.1)
    ctx.fillStyle = mix(P.cyan, P.white, 0.5); ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore()
  }
  ctx.restore()
  // 身体外（不跟着压扁）：震惊的感叹号、得意和欢呼的星星
  if (mood === 'shock') {
    for (const d of [-1, 1]) {
      ctx.save(); ctx.translate(d * w * 0.72, -h * 0.5); ctx.rotate(d * 0.25)
      fatLine(ctx, E, [[0, -s * 0.12], [0, s * 0.02]], P.yellow, s * 0.045 / u)
      ctx.beginPath(); ctx.arc(0, s * 0.1, s * 0.035, 0, Math.PI * 2); ctx.fillStyle = P.yellow; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = P.ink; ctx.stroke()
      ctx.restore()
    }
  }
  if (mood === 'smug' || mood === 'cheer') {
    sparkle(ctx, E, w * 0.66, -h * 0.34, s * 0.09 * (0.6 + 0.4 * Math.abs(Math.sin(t * 5))), { color: P.white, rot: t })
    sparkle(ctx, E, -w * 0.7, -h * 0.14, s * 0.06 * (0.6 + 0.4 * Math.abs(Math.sin(t * 5 + 1.5))), { color: P.yellow, rot: -t })
  }
}
