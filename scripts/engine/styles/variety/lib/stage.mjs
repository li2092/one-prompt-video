// 舞台（移植自风格库的 J-综艺花字）：每场一套高饱和渐变底 + 慢转放射线 + 斜向漂移的波点；顶部一条弹幕；
// 字幕是白字深紫粗描边加硬投影；转场是十二角星爆开，星的边缘三层描边。
import { P, setPal, rays } from './fx.mjs'
import { mix, rgba, clamp, ease, textUnits } from '../../../core.mjs'
import { captionChunks } from '../../../layouts.mjs'

// 五套底色按场轮换，全部从主题色算出来；rim 是转场时那颗星的边色
const sets = c => [
  { a: c.bg, b: mix(c.bg, c.accent, 0.45), rim: c.accent },
  { a: mix(c.muted, c.accent2, 0.62), b: c.accent2, rim: c.bg },
  { a: mix(c.accent2, c.line, 0.4), b: c.bg, rim: c.muted },
  { a: mix(c.muted, c.accent2, 0.2), b: mix(c.muted, c.accent2, 0.75), rim: c.accent },
  { a: c.bg, b: mix(c.accent2, c.line, 0.2), rim: mix(c.accent, c.muted, 0.4) },
]
export const sceneSet = (c, i) => sets(c)[i % 5]

export function drawBg(ctx, E, s, c) {
  setPal(c)
  const k = s.index % 5, th = sceneSet(c, k)
  const base = E.once('variety-bg' + k, () => {
    const cv = E.createCanvas(E.W, E.H), g = cv.getContext('2d')
    const lg = g.createLinearGradient(0, 0, E.W * 0.3, E.H)
    lg.addColorStop(0, th.a); lg.addColorStop(1, th.b)
    g.fillStyle = lg; g.fillRect(0, 0, E.W, E.H)
    // 四角压暗一点，让中间更亮
    const v = g.createRadialGradient(E.W / 2, E.H / 2, Math.min(E.W, E.H) * 0.35, E.W / 2, E.H / 2, Math.hypot(E.W, E.H) * 0.6)
    v.addColorStop(0, rgba(c.line, 0)); v.addColorStop(1, rgba(c.line, 0.3))
    g.fillStyle = v; g.fillRect(0, 0, E.W, E.H)
    return cv
  })
  ctx.drawImage(base, 0, 0)
  rays(ctx, E, E.W / 2, E.H * (E.portrait ? 0.42 : 0.46), 20, E.T * 0.12, rgba(c.fg, 0.1))
  // 波点：右上、左下两角最大，往中间变小；整张斜向漂移
  const st = 46 * E.u
  const dots = E.once('variety-dots', () => {
    const cv = E.createCanvas(E.W + st * 2, E.H + st * 2), g = cv.getContext('2d'), D = Math.hypot(E.W, E.H)
    g.fillStyle = rgba(c.fg, 0.2)
    for (let y = 0; y < E.H + st * 2; y += st) for (let x = 0; x < E.W + st * 2; x += st) {
      const ox = (Math.round(y / st) % 2) * st / 2
      const d = Math.min(Math.hypot(x + ox - E.W, y) / D, Math.hypot(x + ox, y - E.H) / D)
      const rr = Math.max(0, 0.5 - d) * 2 * st * 0.32
      if (rr > 0.8) { g.beginPath(); g.arc(x + ox, y, rr, 0, Math.PI * 2); g.fill() }
    }
    return cv
  })
  const d = (E.T * 22 * E.u) % st
  ctx.drawImage(dots, -d, d - st)
}

// 弹幕：顶部一条单行，字只来自这一场的 s.scene（list 里每一条带它跟着第几个元素出现），
// 某一项入场以后才会飘出来，不提前剧透；一轮飘完再从头来，一场里每条最多两次。
export function danmu(ctx, E, s, list) {
  const u = E.u, size = E.pick(30, 28) * u, speed = E.pick(340, 250) * u, gap = 80 * u
  const y = E.pick(54, 100) * u, bh = size * 1.6
  const plan = E.once('variety-dm' + s.index, () => {
    ctx.font = E.font('body', 900, size)
    const out = []
    let free = 0.2, k = 0
    for (let round = 0; round < 2; round++) for (const it of list) {
      const t = Math.max(s.cue(it.i) + 0.2, free)
      if (t > s.dur - 0.5) continue
      const w = ctx.measureText(it.str).width
      out.push({ str: it.str, t, w, k: k++ })
      free = t + (w + gap) / speed
    }
    return out
  })
  const cols = [P.white, P.yellow, P.cyan, P.white, mix(P.pink, P.white, 0.6)]
  ctx.save()
  ctx.fillStyle = rgba(P.ink, 0.3); ctx.fillRect(0, y - bh / 2, E.W, bh)
  ctx.font = E.font('body', 900, size); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  for (const it of plan) {
    const x = E.W - (s.t - it.t) * speed
    if (s.t < it.t || x + it.w < 0) continue
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = P.ink; ctx.strokeText(it.str, x, y + u)
    ctx.fillStyle = cols[it.k % cols.length]; ctx.fillText(it.str, x, y + u)
  }
  ctx.restore()
}

// 字幕：按标点切段轮流显示（和引擎默认的切法、时间分配一样），白字深紫粗描边加硬投影，换段时弹一下
export function caption(ctx, s, E) {
  const say = s.scene.say
  if (!say) return
  const u = E.u
  const chunks = captionChunks(say, E.portrait ? 14 : 26), lens = chunks.map(c => textUnits(c)), total = lens.reduce((x, y) => x + y, 0)
  const span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  const a = Math.min(clamp((s.t - t0) / 0.15), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.1))
  if (a <= 0) return
  const size = E.pick(46, 46) * u, maxW = E.W - E.safe.l * 2
  const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 900, size, maxW, maxLines: 2, quiet: true })
  const cy = E.H - E.captionH / 2 - (E.portrait ? 30 * u : 0), y0 = cy - f.lines.length * f.lineH / 2
  const since = s.t - t0, pop = since < 0.18 ? 1 + 0.08 * Math.sin(since / 0.18 * Math.PI) : 1
  ctx.save(); ctx.globalAlpha = clamp(a * 1.6)
  ctx.font = E.font('body', 900, f.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  f.lines.forEach((ln, j) => {
    const y = y0 + j * f.lineH + f.lineH / 2 + (1 - ease.outBack(clamp(a))) * 14 * u
    ctx.save(); ctx.translate(E.W / 2, y); ctx.scale(pop, pop)
    ctx.lineWidth = f.size * 0.3; ctx.strokeStyle = P.ink; ctx.fillStyle = P.ink
    ctx.strokeText(ln, 4 * u, 6 * u); ctx.fillText(ln, 4 * u, 6 * u)
    ctx.strokeText(ln, 0, 0)
    ctx.fillStyle = P.white; ctx.fillText(ln, 0, 0)
    ctx.restore()
  })
  ctx.restore()
}

// 转场：新场在一颗旋转放大的十二角星里出现，星的边缘是深紫、本场的边色、白三层描边
export function starWipe(ctx, A, B, p, E, info, c) {
  setPal(c)
  const u = E.u, q = ease.inOut(p), n = 12, inner = 0.74
  const R = (Math.hypot(E.W, E.H) / 2 / inner + 160 * u) * q, rot = q * 0.9
  const path = () => {
    ctx.beginPath()
    for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? R * inner : R; const x = E.W / 2 + Math.cos(a) * r, y = E.H / 2 + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
    ctx.closePath()
  }
  ctx.drawImage(A, 0, 0)
  if (R <= 1) return
  ctx.save(); path(); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore()
  ctx.save(); ctx.lineJoin = 'round'
  path(); ctx.strokeStyle = P.ink; ctx.lineWidth = 64 * u; ctx.stroke()
  path(); ctx.strokeStyle = sceneSet(c, info.to).rim; ctx.lineWidth = 44 * u; ctx.stroke()
  path(); ctx.strokeStyle = P.white; ctx.lineWidth = 14 * u; ctx.stroke()
  ctx.restore()
}
