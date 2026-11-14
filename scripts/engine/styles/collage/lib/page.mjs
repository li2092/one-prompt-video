// 剪贴拼贴的底、字幕和转场。移植自风格库的 N-剪贴拼贴 的 style.mjs。
// 底：牛皮纸上压一张按场换色的杂志页（淡色、带正文栏、角上一块粗网点、一个错版大号印刷字只露一部分），
// 两张粗网点色页从杂志页下面的对角露出来，边上再贴几张旧纸边角和胶带。每场算一次，存成整图。
// 字幕：每行一条撕下来的白报纸条，相邻两行歪向不同方向。转场：新一页从左往右盖上来，撕边露白芯、带投影。
import { pal, scrap, tape, grain, hash, tornPoly, polyPath, halftone, misreg, CORE } from './clip.mjs'
import { captionChunks } from '../../../layouts.mjs'
import { textUnits } from '../../../core.mjs'

// 每场的杂志页：tint 主页的色调；under 两张底页 [底色, 网点色]；ht 主页上网点色块 [颜色, 所在角]；wk 大号印刷字所在角
const MAG = [
  { tint: '#f2e6d0', under: [['mustard', 'pen'], ['sky', 'blue']], ht: ['hot', 'tr'], wk: 'bl' },
  { tint: '#e2ebe5', under: [['blush', 'pen'], ['mustard', 'rust']], ht: ['alt', 'bl'], wk: 'br' },
  { tint: '#ece4cf', under: [['sky', 'blue'], ['hot', 'pen']], ht: ['blue', 'br'], wk: 'br' },
  { tint: '#f4e1d6', under: [['mustard', 'rust'], ['alt', 'ink']], ht: ['mustard', 'tr'], wk: 'bl' },
  { tint: '#f0e7c6', under: [['sky', 'blue'], ['blush', 'hot']], ht: ['hot', 'bl'], wk: 'br' },
  { tint: '#e3e7ee', under: [['mustard', 'pen'], ['lime', 'olive']], ht: ['pen', 'tr'], wk: 'bl' },
  { tint: '#f1e2ca', under: [['alt', 'ink'], ['hot', 'pen']], ht: ['blue', 'br'], wk: 'bl' },
]
// 边角旧纸：[x, y, w, h（占画面比例）, 角度, 底色, 纹理]
const EDGE = [
  [[0.02, 0.1, 0.34, 0.5, -0.12, 'news', 'news'], [0.98, 0.92, 0.42, 0.42, 0.08, 'blush', 'dots'], [0.96, 0.06, 0.22, 0.2, 0.2, 'sky', 'grid']],
  [[0.97, 0.12, 0.36, 0.42, 0.1, 'news', 'grid'], [0.03, 0.9, 0.4, 0.36, -0.06, 'mustard', 'dots'], [0.02, 0.05, 0.2, 0.16, -0.25, 'cream', 'lines']],
  [[0.02, 0.5, 0.2, 0.95, 0.03, 'news', 'news'], [0.99, 0.5, 0.16, 0.9, -0.04, 'sky', 'dots'], [0.9, 0.97, 0.34, 0.16, 0.05, 'cream', 'news']],
  [[0.03, 0.08, 0.38, 0.3, -0.08, 'cream', 'lines'], [0.97, 0.95, 0.36, 0.4, -0.1, 'news', 'news'], [1.0, 0.3, 0.16, 0.3, 0.3, 'blush', 'dots']],
  [[0.98, 0.08, 0.4, 0.3, 0.07, 'news', 'news'], [0.02, 0.93, 0.34, 0.36, 0.1, 'sky', 'grid'], [0.0, 0.35, 0.12, 0.3, -0.2, 'mustard', 'dots']],
  [[0.02, 0.12, 0.3, 0.42, 0.06, 'news', 'news'], [0.98, 0.88, 0.32, 0.44, -0.08, 'cream', 'lines'], [0.97, 0.04, 0.26, 0.14, -0.12, 'lime', 'dots']],
  [[0.97, 0.1, 0.34, 0.4, -0.1, 'news', 'news'], [0.03, 0.92, 0.38, 0.38, 0.07, 'blush', 'dots'], [0.02, 0.06, 0.18, 0.18, 0.3, 'sky', 'grid']],
]
// 杂志页角上的大号印刷字：装饰词，按版式取
const WORD = { title: 'ISSUE', statement: 'NOTE', bullets: 'TIPS', number: 'DATA', bars: 'CHART', steps: 'HOW', compare: 'VS', quote: 'QUOTE', end: 'NEXT', custom: 'PAGE' }
const CORNER = { tl: [0, 0], tr: [1, 0], bl: [0, 1], br: [1, 1] }

export function bgImage(E, s) {
  return E.once(`collage:bg:${s.index}`, () => {
    const { W, H, u } = E, por = E.portrait, k = pal(E.theme.c), id = s.index
    const M = MAG[id % MAG.length]
    const c = E.createCanvas(W, H), g = c.getContext('2d')
    // 牛皮纸：底色加大块深浅斑和颗粒
    g.fillStyle = k.kraft; g.fillRect(0, 0, W, H)
    const r = E.rng(id * 31 + 7)
    for (let i = 0; i < 28; i++) {
      const x = r() * W, y = r() * H, rad = (120 + r() * 320) * u, gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, r() < 0.55 ? 'rgba(120,80,40,0.10)' : 'rgba(235,205,160,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    g.fillStyle = g.createPattern(grain(E), 'repeat'); g.globalAlpha = 0.9; g.fillRect(0, 0, W, H); g.globalAlpha = 1
    // 两张粗网点色页，从主页下面的左上、右下对角露出来；页上一个错版的大号场次数字
    M.under.forEach(([fill, dot], i) => {
      const w = (por ? 0.78 : 0.6) * W, h = (por ? 0.42 : 0.62) * H
      const x = i ? W - w * 0.36 : w * 0.36, y = i ? H - h * (por ? 0.62 : 0.36) : h * 0.3
      g.save(); g.translate(x, y); g.rotate(i ? -0.05 : 0.06)
      scrap(g, E, w, h, { fill: k[fill], seed: 700 + i * 13 + id, rough: 9 })
      polyPath(g, tornPoly(w - 5 * u, h - 5 * u, 801 + i * 13 + id, 9 * u, 'tblr')); g.clip()
      halftone(g, -w / 2, -h / 2, w, h, E.rgba(k[dot], 0.55), 22 * u, 0.26, (fx, fy) => 0.15 + 0.95 * Math.pow(E.clamp(Math.hypot(i ? fx : 1 - fx, i ? fy : 1 - fy) / 1.2), 1.3))
      g.globalAlpha = 0.6
      misreg(g, E, String(id + 1).padStart(2, '0'), i ? -w * 0.2 : w * 0.18, i ? h * 0.12 : -h * 0.05, (por ? 0.17 : 0.34) * H, { fam: E.fonts.serif })
      g.restore()
    })
    // 主杂志页：淡色，很淡的分栏正文行、一角一大块粗网点、错版大号印刷字、栏目色条
    {
      const w = (por ? 0.9 : 0.84) * W, h = (por ? 0.86 : 0.8) * H
      g.save(); g.translate(W * 0.5 + (hash(id, 3) - 0.5) * 30 * u, H * 0.47); g.rotate((hash(id, 5) - 0.5) * 0.04)
      scrap(g, E, w, h, { fill: E.mix(k.cream, M.tint, 0.75), seed: 900 + id, rough: 8 })
      polyPath(g, tornPoly(w - 5 * u, h - 5 * u, 1001 + id, 8 * u, 'tblr')); g.clip()
      g.fillStyle = 'rgba(40,30,20,0.06)'
      const cols = por ? 3 : 5, cw = w / cols
      for (let q = 0; q < cols; q++) for (let yy = -h / 2 + 40 * u, n = 0; yy < h / 2 - 20 * u; yy += 22 * u, n++) {
        if (hash(n + q * 40, 11) < 0.06) continue
        g.fillRect(-w / 2 + q * cw + 26 * u, yy, (cw - 52 * u) * (0.7 + 0.3 * hash(n, q + 2)), 8 * u)
      }
      const [hc, hk] = M.ht, [cx, cy] = CORNER[hk]
      halftone(g, -w / 2, -h / 2, w, h, E.rgba(k[hc], 0.36), 26 * u, 0.785, (fx, fy) => E.clamp(1.08 - Math.hypot((fx - cx) * (por ? 1 : 1.3), (fy - cy) * (por ? 1.4 : 1)) * 1.55))
      const [wx, wy] = CORNER[M.wk], size = (por ? 0.1 : 0.21) * H
      g.globalAlpha = 0.09
      misreg(g, E, WORD[s.layout] || 'PAGE', (wx - 0.5) * w + (wx ? -1 : 1) * size * 0.05, (wy - 0.5) * h + (wy ? -1 : 1) * size * (por ? 0.5 : 0.28), size, { align: wx ? 'right' : 'left' })
      g.globalAlpha = 1
      g.fillStyle = E.rgba(k[M.under[1][0]], 0.8)
      g.fillRect(wx ? -w / 2 : w / 2 - w * 0.3, wy ? -h / 2 : h / 2 - 18 * u, w * 0.3, 18 * u)
      g.restore()
    }
    // 边角旧纸，一截胶带压住靠里的一角
    EDGE[id % EDGE.length].forEach(([fx, fy, fw, fh, rot, fill, tex], i) => {
      const w = fw * 0.72 * (por ? Math.max(W, H) * 0.62 : W), h = fh * 0.72 * (por ? H * 0.5 : H)
      g.save(); g.translate(fx * W, fy * H); g.rotate(rot); scrap(g, E, w, h, { fill: k[fill], seed: 500 + i * 17 + id, tex, rough: 8 }); g.restore()
      tape(g, E, fx * W + (fx < 0.5 ? 1 : -1) * w * 0.38, fy * H + (fy < 0.5 ? 1 : -1) * h * 0.4, 150 * u, 40 * u, rot + (fx < 0.5 ? -0.7 : 0.7), { seed: 600 + i })
    })
    // 暗角
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,35,10,0.28)')
    g.fillStyle = vg; g.fillRect(0, 0, W, H)
    return c
  })
}

// 字幕：每行一条撕下来的白报纸条，黑字，左右撕边，相邻两行歪向不同方向
export function caption(ctx, s, E) {
  const say = s.scene.say
  if (!say) return
  const { W, H, u } = E, k = pal(E.theme.c)
  const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((a, b) => a + b, 0), span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  // 换场后 0.18 秒起淡入，和转场的新页错开
  const a = Math.min(E.clamp((s.t - t0 - (idx === 0 ? 0.18 : 0)) / 0.18), idx === chunks.length - 1 ? 1 : E.clamp((t1 - s.t) / 0.12))
  if (a <= 0) return
  const size = E.pick(44, 40) * u
  const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 700, size, maxW: E.pick(1320, 760) * u, maxLines: 2, lineGap: 1.42, quiet: true })
  const cy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0), seed = s.index * 17 + idx * 5
  ctx.font = E.font('body', 700, f.size)
  f.lines.forEach((ln, j) => {
    const y = cy + (j - (f.lines.length - 1) / 2) * (f.lineH + 6 * u), w = ctx.measureText(ln).width + f.size * 1.1
    ctx.save(); ctx.globalAlpha = E.clamp(a * 1.5); ctx.translate(W / 2, y + (1 - E.ease.out(a)) * 10 * u); ctx.rotate(((seed + j) % 2 ? 1 : -1) * 0.006)
    scrap(ctx, E, w, f.lineH, { fill: E.mix(k.cream, '#ffffff', 0.45), seed: seed * 3 + j, torn: 'lr', rough: 5, shadow: 0.8 })
    ctx.font = E.font('body', 700, f.size); ctx.fillStyle = k.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(ln, 0, f.size * 0.05)
    ctx.restore()
  })
}

// 转场：新一页从左往右盖上来，前沿是锯齿撕边加白芯加投影
export function tornSweep(ctx, A, B, p, E, info) {
  const { W, H, u } = E, X = E.lerp(-140 * u, W + 140 * u, E.ease.inOut(p)), seed = (info.to + 1) * 13, edge = []
  for (let i = 0; i <= 48; i++) { const y = (i / 48) * H; edge.push([X + (hash(i, seed) - 0.5) * 34 * u + Math.sin(i * 0.7 + seed) * 22 * u + (y / H - 0.5) * 110 * u, y]) }
  const side = (dx, jit) => { ctx.beginPath(); ctx.moveTo(-10, -10); edge.forEach(([x, y], i) => ctx.lineTo(x + dx + (jit ? hash(i, seed + 3) * jit : 0), y)); ctx.lineTo(-10, H + 10); ctx.closePath() }
  ctx.drawImage(A, 0, 0)
  side(16 * u, 0); ctx.fillStyle = 'rgba(40,25,10,0.28)'; ctx.fill()
  side(7 * u, 6 * u); ctx.fillStyle = CORE; ctx.fill()
  ctx.save(); side(0, 0); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore()
}
