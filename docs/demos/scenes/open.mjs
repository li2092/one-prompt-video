// 开场：一句话逐字打出来，按下回车，变成片名。
// data: { hint, prompt, kicker, title, sub, foot, hit }   hit 是片名出现的时刻（秒），放在配乐的重拍上
import { clamp, lerp, outCubic, inCubic, outBack, hash, rgba, stars, glow, pill } from './fx.mjs'

export default function (ctx, s, E) {
  const { W, H, u, theme } = E, c = theme.c, d = s.scene.data, t = s.t
  const cx = W / 2, cy = H / 2, hit = d.hit, k = t - hit

  // 星点：打字时慢慢飘，回车前加速拉成线，片名出来以后一直往外飞
  const charge = clamp((t - (hit - 0.9)) / 0.9)
  stars(ctx, E, t + inCubic(charge) * 6 + (k > 0 ? 8 + k * 2.2 : 0), { cx, cy, n: 220, boost: k > 0 ? Math.max(0.12, 1.6 * Math.exp(-k * 2.2)) : inCubic(charge) * 1.2, color: '#cfd8ff', alpha: 0.9 })

  if (k < 0) {
    // ── 输入框 ──
    const grow = outCubic((t - 0.4) / 0.6), squashY = 1 - 0.96 * outCubic((t - (hit - 0.6)) / 0.28), squashX = 1 - inCubic((t - (hit - 0.36)) / 0.36)
    const bw = 1380 * u * grow * squashX, bh = 156 * u * squashY
    if (grow > 0 && bw > 2) {
      const x = cx - bw / 2, y = cy - bh / 2
      glow(ctx, cx, cy, (420 + 500 * charge) * u, c.accent, 0.16 + 0.5 * charge)
      ctx.save()
      pill(ctx, x, y, bw, bh)
      ctx.fillStyle = rgba('#ffffff', 0.06 + 0.9 * charge); ctx.fill()
      const g = ctx.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, c.accent); g.addColorStop(1, c.accent2)
      ctx.strokeStyle = g; ctx.lineWidth = 4 * u; ctx.shadowColor = c.accent; ctx.shadowBlur = 36 * u; ctx.stroke()
      ctx.restore()
      if (squashY > 0.9) {
        const chars = [...d.prompt], n = Math.round(chars.length * clamp((t - 1.1) / (hit - 1.1 - 1.7)))
        const shown = chars.slice(0, n).join('')
        const f = E.fit(d.prompt, { role: 'body', weight: 500, size: 62 * u, maxW: 1380 * u - 170 * u, maxLines: 1, quiet: true })
        ctx.font = E.font('body', 500, f.size); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const tx = cx - f.width / 2
        ctx.globalAlpha = clamp((t - 0.9) / 0.3)
        ctx.fillStyle = c.fg; ctx.fillText(shown, tx, cy)
        if (n < chars.length || Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = c.accent2; ctx.fillRect(tx + ctx.measureText(shown).width + 8 * u, cy - f.size * 0.6, 6 * u, f.size * 1.2) }
        ctx.globalAlpha = 1
      }
      // 上面的一行小字
      const a = clamp((t - 0.5) / 0.5) * (1 - clamp((t - (hit - 0.7)) / 0.2))
      if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = c.muted; ctx.font = E.font('body', 500, 40 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.hint, cx, cy - 150 * u); ctx.globalAlpha = 1 }
    }
    // 收成一个亮点
    glow(ctx, cx, cy, (30 + 260 * inCubic(charge)) * u, '#ffffff', inCubic(charge))
    return
  }

  // ── 片名 ──
  glow(ctx, cx, cy, Math.hypot(W, H) * 0.7, '#ffffff', 0.95 * Math.exp(-k * 4.5))
  glow(ctx, cx, cy - 30 * u, 900 * u, c.accent, 0.34 * (0.6 + 0.4 * Math.exp(-k)))
  // 冲击波
  const rr = outCubic(k / 1.5) * Math.hypot(W, H) * 0.62
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = rgba('#ffffff', 0.7 * Math.pow(1 - clamp(k / 1.5), 2)); ctx.lineWidth = (2 + 22 * (1 - clamp(k / 1.5))) * u
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke()
  // 放射的光条
  for (let i = 0; i < 64; i++) {
    const a = hash(i, 7) * Math.PI * 2, v = 0.5 + hash(i, 8), q = clamp(k / (0.9 + 0.8 * hash(i, 9)))
    const r1 = outCubic(q) * 1150 * u * v, r0 = r1 * (0.55 + 0.4 * q)
    ctx.strokeStyle = rgba(i % 3 ? c.accent2 : '#ffffff', 0.75 * (1 - q)); ctx.lineWidth = (1.5 + 4 * hash(i, 10)) * u
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke()
  }
  ctx.restore()

  const zoom = 1 + 0.045 * clamp(k / (s.dur - hit))
  ctx.save(); ctx.translate(cx, cy); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy)
  // 片名：逐个字母砸下来
  const f = E.fit(d.title, { role: 'title', weight: 800, size: 196 * u, maxW: 1640 * u, maxLines: 1, quiet: true })
  const font = E.font('title', 800, f.size), ty = cy - 40 * u
  ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const letters = [...d.title], x0 = cx - f.width / 2
  let acc = ''
  letters.forEach((ch, i) => {
    const lx = x0 + ctx.measureText(acc).width, lw = ctx.measureText(ch).width; acc += ch
    const p = clamp((k - 0.02 - i * 0.032) / 0.34)
    if (p <= 0) return
    const sc = lerp(2.6, 1, outBack(p))
    ctx.save(); ctx.translate(lx + lw / 2, ty); ctx.scale(sc, sc); ctx.globalAlpha = clamp(p * 2.2)
    ctx.shadowColor = c.accent; ctx.shadowBlur = (30 + 60 * (1 - p)) * u
    const g = ctx.createLinearGradient(0, -f.size * 0.55, 0, f.size * 0.55); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9cffb')
    ctx.fillStyle = g; ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
  // 一道扫过去的光
  const sw = clamp((k - 0.9) / 1.0)
  if (sw > 0 && sw < 1) {
    const bx = lerp(x0 - 300 * u, x0 + f.width + 300 * u, sw)
    ctx.save(); ctx.beginPath(); ctx.moveTo(bx - 70 * u, ty - f.size); ctx.lineTo(bx + 110 * u, ty - f.size); ctx.lineTo(bx + 10 * u, ty + f.size); ctx.lineTo(bx - 170 * u, ty + f.size); ctx.closePath(); ctx.clip()
    ctx.font = font; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40 * u; ctx.fillText(d.title, x0, ty)
    ctx.restore()
  }
  // 片名下面的一道线
  const lp = outCubic((k - 0.5) / 0.7)
  if (lp > 0) {
    const lw = f.width * 0.62 * lp, ly = ty + f.size * 0.62
    const g = ctx.createLinearGradient(cx - lw / 2, 0, cx + lw / 2, 0); g.addColorStop(0, rgba(c.accent, 0)); g.addColorStop(0.5, c.accent2); g.addColorStop(1, rgba(c.accent, 0))
    ctx.fillStyle = g; ctx.fillRect(cx - lw / 2, ly, lw, 5 * u)
  }
  // 上面的小字和下面的一句话
  const kp = clamp((k - 0.25) / 0.5)
  if (kp > 0) { ctx.globalAlpha = kp; ctx.fillStyle = c.accent2; ctx.font = E.font('mono', 600, 34 * u); ctx.textAlign = 'center'; ctx.fillText([...d.kicker].join(' '), cx, ty - f.size * 0.82); ctx.globalAlpha = 1 }
  const sp = clamp((k - 1.2) / 0.7)
  if (sp > 0) {
    const chars = [...d.sub], size = 70 * u, gap = lerp(2.2, 1.18, outCubic(sp)) * size
    ctx.font = E.font('body', 600, size); ctx.textAlign = 'center'; ctx.fillStyle = c.fg; ctx.globalAlpha = sp
    const wide = /[　-鿿＀-￯]/.test(d.sub)
    if (wide) chars.forEach((ch, i) => ctx.fillText(ch, cx + (i - (chars.length - 1) / 2) * gap, ty + f.size * 0.62 + 110 * u))
    else { ctx.translate(0, (1 - outCubic(sp)) * 24 * u); ctx.fillText(d.sub, cx, ty + f.size * 0.62 + 110 * u) }
    ctx.globalAlpha = 1
  }
  // 最底下的一行（网址之类）
  const fp = clamp((k - 2.0) / 0.6)
  if (d.foot && fp > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = fp; ctx.fillStyle = c.accent2; ctx.font = E.font('mono', 500, 40 * u); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.foot, cx, ty + f.size * 0.62 + 230 * u); ctx.globalAlpha = 1 }
  ctx.restore()
}
