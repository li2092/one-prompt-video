// 大屏的外框，移植自风格库的 U-数据仪表盘 style.mjs：深色点阵底、缓慢下行的扫描带、竖屏底部的滚动日志带、
// 页眉、带四角括号的字幕条、一条扫描线自上而下刷新整屏的转场。
// 原样片页眉里的书名、计时都去掉了：页眉只有「LIVE」「ONLINE」两个装饰短词、骨架条和不带数字的场次格。
import { P, brackets, live, ghostBar } from './dash.mjs'
import { logRows } from './deco.mjs'
import { captionChunks } from '../../../layouts.mjs'
import { textUnits, drawLines } from '../../../core.mjs'

// 摆面板的区域：横屏左右各留 96，竖屏 40；上面让出页眉，下面让出字幕带。tall 为竖屏和方屏（面板上下叠）
export function geo(E) {
  const { W, H, u } = E, b = E.L.box, tall = W / H < 1.3
  const mx = (E.portrait ? 40 : tall ? 64 : 96) * u
  return { x: mx, y: b.y, w: W - 2 * mx, h: b.h, tall, hy: E.portrait ? 118 * u : 52 * u, ly: E.portrait ? 146 * u : 80 * u }
}

// 不动的底：竖向渐变、顶部一团淡光、32 格点阵、暗角，只画一次
function base(E) {
  return E.once('dash-bg', () => {
    const { W, H, u } = E, cv = E.createCanvas(W, H), g = cv.getContext('2d')
    const lg = g.createLinearGradient(0, 0, 0, H)
    lg.addColorStop(0, E.mix(P.bg, P.panel, 0.4)); lg.addColorStop(1, P.bg)
    g.fillStyle = lg; g.fillRect(0, 0, W, H)
    const rg = g.createRadialGradient(W * 0.5, H * 0.36, 0, W * 0.5, H * 0.36, Math.max(W, H) * 0.7)
    rg.addColorStop(0, E.rgba(P.acc, 0.06)); rg.addColorStop(0.5, E.rgba(P.acc2, 0.025)); rg.addColorStop(1, E.rgba(P.acc2, 0))
    g.fillStyle = rg; g.fillRect(0, 0, W, H)
    const G = 32 * u
    g.fillStyle = E.rgba(P.dim, 0.1)
    for (let y = G / 2; y < H; y += G) for (let x = G / 2; x < W; x += G) g.fillRect(x - u, y - u, 2 * u, 2 * u)
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)')
    g.fillStyle = vg; g.fillRect(0, 0, W, H)
    return cv
  })
}

export function drawBg(ctx, E) {
  const { W, H, u } = E
  ctx.drawImage(base(E), 0, 0)
  // 缓慢下行的一道淡扫描带
  const y = ((E.T * 0.09) % 1.3 - 0.15) * H, bh = 160 * u
  const g = ctx.createLinearGradient(0, y - bh, 0, y + bh)
  g.addColorStop(0, E.rgba(P.acc, 0)); g.addColorStop(0.5, E.rgba(P.acc, 0.03)); g.addColorStop(1, E.rgba(P.acc, 0))
  ctx.fillStyle = g; ctx.fillRect(0, y - bh, W, 2 * bh)
  // 竖屏：面板区下面到画面底边是一条不带字的滚动日志带（只填画面，不承载内容）
  if (E.portrait) {
    const G = geo(E), top = G.y + G.h + 30 * u
    if (H - top > 80 * u) logRows(ctx, E, { x: G.x + 20 * u, y: top, w: G.w - 40 * u, h: H - top }, 1, 7, { rh: 40, speed: 30, alpha: 0.55 })
  }
}

// 页眉：左边闪烁的点加 LIVE、一组跳动的小柱、两根骨架条；右边 ONLINE 和场次格；下面一条渐变细线
export function header(ctx, E, s) {
  const u = E.u, G = geo(E), x0 = G.x, x1 = G.x + G.w, y = G.hy
  live(ctx, E, x0, y, P.acc)
  const ex = x0 + 100 * u
  ctx.fillStyle = E.rgba(P.acc, 0.6)
  for (let k = 0; k < 5; k++) { const h = (5 + 14 * (0.5 + 0.5 * E.noise1(E.T * 3 + k * 1.7, 9))) * u; ctx.fillRect(ex + k * 8 * u, y + 9 * u - h, 5 * u, h) }
  ghostBar(ctx, E, ex + 64 * u, y - 4 * u, (E.portrait ? 100 : 140) * u, 8 * u, 0.9)
  if (!G.tall) ghostBar(ctx, E, ex + 222 * u, y - 4 * u, 80 * u, 8 * u, 0.6)
  const n = s.count, gap = 6 * u, sw = Math.min((E.portrait ? 26 : 34) * u, G.w * 0.4 / n - gap), sh = 6 * u
  let sx = x1 - n * (sw + gap) + gap
  ctx.font = E.font('mono', 600, 18 * u); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.faint
  E.spacedText(ctx, 'ONLINE', sx - 18 * u, y + 1 * u, 3 * u, 'right')
  for (let i = 0; i < n; i++) {
    if (i === s.index) { ctx.fillStyle = E.rgba(P.acc, 0.25); ctx.fillRect(sx - 3 * u, y - sh / 2 - 3 * u, sw + 6 * u, sh + 6 * u) }
    ctx.fillStyle = i < s.index ? E.rgba(P.acc, 0.45) : i === s.index ? P.acc : P.ghost
    ctx.fillRect(sx, y - sh / 2, sw, sh)
    sx += sw + gap
  }
  const lg = ctx.createLinearGradient(x0, 0, x1, 0)
  lg.addColorStop(0, E.rgba(P.acc, 0.5)); lg.addColorStop(0.5, P.line); lg.addColorStop(1, E.rgba(P.acc2, 0.4))
  ctx.fillStyle = lg; ctx.fillRect(x0, G.ly, x1 - x0, 1.5 * u)
}

// 字幕：深色底、细边、四角小括号，和面板同一套画法。分段和时间按引擎默认的算法
export function drawCaption(ctx, s, E) {
  const say = s.scene.say
  if (!say) return
  const { W, H, u } = E
  const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((x, y) => x + y, 0)
  const span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  const a = Math.min(E.clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : E.clamp((t1 - s.t) / 0.12))
  const G = geo(E), size = (E.portrait ? 46 : 42) * u
  const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 500, size, maxW: G.w - 100 * u, maxLines: 2, quiet: true })
  const h = f.lines.length * f.lineH, cy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0)
  const padX = 38 * u, padY = 12 * u, w = f.width + padX * 2, bh = h + padY * 2, x0 = W / 2 - w / 2, y0 = cy - bh / 2
  ctx.save(); ctx.globalAlpha = a
  ctx.fillStyle = E.rgba(P.bg, 0.88); E.roundRect(ctx, x0, y0, w, bh, 8 * u); ctx.fill()
  ctx.strokeStyle = E.rgba(P.acc, 0.32); ctx.lineWidth = 1.4 * u; E.roundRect(ctx, x0, y0, w, bh, 8 * u); ctx.stroke()
  brackets(ctx, E, x0, y0, w, bh, { L: 12 * u, k: 0, w: 2.4, col: P.acc, a: 0.9 })
  ctx.fillStyle = P.text; ctx.font = E.font('body', 500, f.size)
  drawLines(ctx, f.lines, W / 2, cy - h / 2, f.lineH, 'center')
  ctx.restore()
}

// 转场：一条强调色扫描线自上而下，线以上已经是下一场
export function scanWipe(ctx, A, B, p, E) {
  const { W, H, u } = E, sy = Math.round(H * E.ease.inOut(p))
  ctx.drawImage(B, 0, 0)
  if (sy < H) ctx.drawImage(A, 0, sy, W, H - sy, 0, sy, W, H - sy)
  const g = ctx.createLinearGradient(0, sy - 90 * u, 0, sy)
  g.addColorStop(0, E.rgba(P.acc, 0)); g.addColorStop(1, E.rgba(P.acc, 0.16))
  ctx.fillStyle = g; ctx.fillRect(0, sy - 90 * u, W, 90 * u)
  ctx.fillStyle = E.rgba(P.acc, 0.25); ctx.fillRect(0, sy - 5 * u, W, 10 * u)
  ctx.fillStyle = P.acc; ctx.fillRect(0, sy - 1.5 * u, W, 3 * u)
}
