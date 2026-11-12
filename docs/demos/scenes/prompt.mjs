// 自己写的一场：一句话 → video.json → MP4 的示意（横屏用）。
// data: { who, prompt, file, lines: [...], out, specs }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
const out3 = x => 1 - Math.pow(1 - clamp(x), 3)

export default function (ctx, s, E) {
  const { W, H, u, theme } = E, c = theme.c, d = s.scene.data
  const L = E.safe.l, R = W - E.safe.r, top = E.safe.t, bot = H - E.safe.b
  const pad = 40 * u, gap = 96 * u

  // 1. 输入框：一句话逐字打出来
  const bh = 140 * u, bw = R - L
  E.enter(ctx, s.p(0), W / 2, top + bh / 2, () => {
    theme.card(ctx, E, L, top, bw, bh, { tone: 'plain', p: out3(s.p(0)), seed: 1 })
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.font = E.font('body', 700, 44 * u); ctx.fillStyle = c.accent
    ctx.fillText(d.who, L + pad, top + bh / 2)
    const x0 = L + pad + ctx.measureText(d.who).width + 24 * u
    const f = E.fit(d.prompt, { role: 'body', weight: 500, size: 50 * u, maxW: R - pad - x0 - 30 * u, maxLines: 1 })
    const chars = [...d.prompt], span = Math.max(0.6, s.cue(1) - s.cue(0) - 0.9)
    const n = Math.round(chars.length * clamp((s.t - s.cue(0) - 0.35) / span))
    const shown = chars.slice(0, n).join('')
    ctx.font = E.font('body', 500, f.size); ctx.fillStyle = c.fg
    ctx.fillText(shown, x0, top + bh / 2)
    if (n < chars.length || Math.floor(s.t * 2) % 2 === 0) {
      ctx.fillStyle = c.accent
      ctx.fillRect(x0 + ctx.measureText(shown).width + 6 * u, top + bh / 2 - f.size * 0.55, 5 * u, f.size * 1.1)
    }
  })

  // 2. 左边：模型写出来的 video.json，一行一行出现
  const y1 = top + bh + gap, h1 = bot - y1, w1 = bw * 0.6, x2 = L + w1 + gap, w2 = R - x2
  const p1 = s.p(1), p2 = s.p(2)
  theme.line(ctx, E, L + w1 / 2, top + bh + 14 * u, L + w1 / 2, y1 - 14 * u, { p: out3(p1 * 1.6), color: c.accent, width: 5 * u })
  E.enter(ctx, p1, L + w1 / 2, y1 + h1 / 2, () => {
    theme.card(ctx, E, L, y1, w1, h1, { tone: 'plain', p: out3(p1), seed: 2 })
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.font = E.font('mono', 600, 32 * u); ctx.fillStyle = c.accent
    ctx.fillText(d.file, L + pad, y1 + pad + 10 * u)
    const rows = d.lines.length, rowH = Math.min((y1 + h1 - pad * 2 - 84 * u) / rows, 78 * u)
    const ty = y1 + pad + 84 * u + (y1 + h1 - pad - (y1 + pad + 84 * u) - rowH * rows) / 2
    const size = Math.min(42 * u, rowH * 0.62)
    ctx.font = E.font('mono', 500, size)
    const widest = Math.max(...d.lines.map(t => ctx.measureText(t).width)), k = Math.min(1, (w1 - pad * 2) / widest)
    ctx.font = E.font('mono', 500, size * k)
    d.lines.forEach((line, i) => {
      const a = clamp((s.t - s.cue(1) - 0.25 - i * 0.14) / 0.25)
      if (a <= 0) return
      ctx.globalAlpha = a
      ctx.fillStyle = /"layout"/.test(line) ? c.accent : c.fg
      ctx.fillText(line, L + pad, ty + rowH * i + rowH / 2)
      ctx.globalAlpha = 1
    })
  })

  // 3. 右边：成片
  theme.line(ctx, E, L + w1 + 14 * u, y1 + h1 / 2, x2 - 14 * u, y1 + h1 / 2, { p: out3(p2 * 1.6), color: c.accent, width: 5 * u })
  E.enter(ctx, p2, x2 + w2 / 2, y1 + h1 / 2, () => {
    theme.card(ctx, E, x2, y1, w2, h1, { tone: 'accent', p: out3(p2), seed: 3 })
    const ink = theme.solidAccent ? c.onAccent : c.fg
    const sw = w2 - pad * 2, sh = sw * 9 / 16, sx = x2 + pad, sy = y1 + Math.max(pad, (h1 - sh - 130 * u) / 2)
    ctx.fillStyle = c.bg; ctx.fillRect(sx, sy, sw, sh)
    ctx.strokeStyle = ink; ctx.lineWidth = 3 * u; ctx.strokeRect(sx, sy, sw, sh)
    const r = sh * 0.2, cx = sx + sw / 2, cy = sy + sh / 2
    ctx.fillStyle = c.accent; ctx.beginPath()
    ctx.moveTo(cx - r * 0.7, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx - r * 0.7, cy + r); ctx.closePath(); ctx.fill()
    const prog = clamp((s.t - s.cue(2) - 0.3) / Math.max(0.5, s.dur - s.cue(2) - 0.8))
    ctx.fillStyle = c.accent; ctx.fillRect(sx, sy + sh - 8 * u, sw * prog, 8 * u)
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    const nf = E.fit(d.out, { role: 'body', weight: 700, size: 44 * u, maxW: sw, maxLines: 1 })
    ctx.font = E.font('body', 700, nf.size); ctx.fillStyle = ink
    ctx.fillText(d.out, sx, sy + sh + 50 * u)
    const sf = E.fit(d.specs, { role: 'body', weight: 500, size: 32 * u, maxW: sw, maxLines: 1 })
    ctx.font = E.font('body', 500, sf.size); ctx.globalAlpha = 0.8
    ctx.fillText(d.specs, sx, sy + sh + 100 * u); ctx.globalAlpha = 1
  })
}
