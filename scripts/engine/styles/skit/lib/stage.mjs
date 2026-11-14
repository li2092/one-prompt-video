// 舞台：办公室（米黄墙、细竖纹、踢脚线、木地板）、站着的人物，和表情动作的小工具：
// 点头、蹦一下、说话、拍手、挥手、转头，头顶的感叹号、问号和闪光。都是时刻的纯函数。
// 墙地和转头移植自风格库的 E-实习生小剧场。
import { clamp, ease } from '../../../core.mjs'
import { drawPerson, idle, headPos } from './person.mjs'

export const kf = (t, t0, d) => clamp((t - t0) / d)
export const ob = p => (p <= 0 ? 0 : ease.outBack(clamp(p)))

export function room(ctx, E, F, k) {
  const u = E.u, x0 = -100, x1 = E.W + 100
  ctx.fillStyle = k.wall; ctx.fillRect(x0, -100, x1 - x0, F + 100)
  ctx.fillStyle = 'rgba(160,130,90,0.045)'
  for (let x = 30 * u; x < x1; x += 84 * u) ctx.fillRect(x, -100, 3 * u, F + 100)
  ctx.fillStyle = k.wallDeep; ctx.fillRect(x0, F - 26 * u, x1 - x0, 26 * u)
  ctx.fillStyle = k.floor; ctx.fillRect(x0, F, x1 - x0, E.H - F + 100)
  ctx.fillStyle = 'rgba(120,90,60,0.12)'; ctx.fillRect(x0, F, x1 - x0, 3 * u)
  ctx.fillStyle = 'rgba(120,90,60,0.06)'
  for (let i = 1; i < 6; i++) ctx.fillRect(x0, F + i * 46 * u * (1 + i * 0.25), x1 - x0, 2 * u)
}

// 站着的人物：x 是两脚中点，lift 是离地多高（蹦起来时）。返回髋关节和头部中心
export function actor(ctx, X, who, x, pose = {}, lift = 0) {
  const h = X.hd, id = idle(X.t + (who === 'a' ? 0 : 1.7), who === 'a' ? 3 : 5), up = clamp(lift / h)
  ctx.fillStyle = `rgba(90,70,50,${0.1 * (1 - up * 0.6)})`
  ctx.beginPath(); ctx.ellipse(x, X.F, 0.85 * h * (1 - up * 0.3), 0.09 * h, 0, 0, Math.PI * 2); ctx.fill()
  const hipY = X.F - 3.25 * h - lift
  const p = { breath: id.breath, ...pose, blink: Math.max(id.blink, pose.blink || 0) }
  drawPerson(ctx, X.cast[who], x, hipY, h, p)
  return { hipY, head: headPos(x, hipY, h, p), x }
}

// 把屏幕上的一点换算成人物的手腕目标（头高为单位、按朝向翻转）
export const aim = (x, hipY, h, facing, px, py) => [(px - x) / h * facing, (py - hipY) / h]
// 点头：t0 起 0.6 秒内上下点两下
export const nod = (t, t0, amp = 0.1) => { const d = t - t0; return d < 0 || d > 0.6 ? 0 : amp * Math.sin(d * 18) * (1 - d / 0.6) }
export const nods = (t, cues, amp) => cues.reduce((a, c) => a + nod(t, c, amp), 0)
// 蹦一下：返回 0..1..0
export const hop = (t, t0, d = 0.36) => { const q = (t - t0) / d; return q < 0 || q > 1 ? 0 : Math.sin(q * Math.PI) }
// 说话：嘴一张一合
export const talk = (t, t0, t1) => (t >= t0 && t < t1 ? (Math.floor(t * 9) % 3 === 2 ? 'smile' : 'open') : null)
// 拍手：两只手在胸前合拢又分开
export function clap(t) { const q = (1 + Math.sin(t * 22)) / 2; return { near: [0.46 + 0.14 * q, -1.45], far: [0.8 - 0.14 * q, -1.5], nearHand: 'open', farHand: 'open' } }
// 挥手：远侧手臂举过头顶左右摆
export const wave = t => [0.55 + 0.22 * Math.sin(t * 11), -3.35]
// 转头：t0 时用 d 秒转过去，t1 时再转回来（一次过渡，中间保持朝向）
export function turnAt(t, t0, t1 = Infinity, d = 0.26) {
  const p = clamp((t - t0) / d) - clamp((t - t1) / d)
  return Math.cos(Math.PI * ease.inOut(p))
}

// 头顶的小符号：'!'、'?' 或 'spark'（三道闪光）。(x, y) 是符号中心，s 是大小
export function emote(ctx, E, kind, x, y, s, p, col, halo) {
  if (p <= 0) return
  const e = ob(p)
  ctx.save(); ctx.translate(x, y); ctx.scale(e, e); ctx.globalAlpha *= clamp(p * 3)
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (kind === 'spark') {
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.13
    for (const a of [-2.5, -1.57, -0.64]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3); ctx.lineTo(Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75); ctx.stroke() }
  } else {
    ctx.font = E.font('title', 900, s); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineWidth = s * 0.18; ctx.strokeStyle = halo; ctx.strokeText(kind, 0, 0)
    ctx.fillStyle = col; ctx.fillText(kind, 0, 0)
  }
  ctx.restore()
}
