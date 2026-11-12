// 九种版式的缩略图一张张落成一面墙，再按拍子换六种内置主题，最后换成一套自己配的颜色。
// 缩略图是真的出片结果，先跑 trailer/make-stills.mjs 生成。
// data: { layoutsLabel, themesLabel, customLabel, customChip, beat, flipAt, stills }
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { clamp, lerp, outCubic, outBack, hash, rgba, glow } from './fx.mjs'

const { loadImage } = createRequire(path.join(process.cwd(), 'x.js'))('@napi-rs/canvas')
const root = fileURLToPath(new URL('../', import.meta.url))
const THEMES = ['keynote', 'grid', 'minimal', 'pop', 'blueprint', 'whiteboard', 'custom']
// 换主题的顺序：先是开场用的 keynote，然后每拍换一个，最后一个是自己配色的
const ORDER = ['keynote', 'grid', 'minimal', 'pop', 'blueprint', 'whiteboard', 'keynote', 'custom']
const NAMES = ['title', 'statement', 'bullets', 'number', 'bars', 'steps', 'compare', 'quote', 'end']
// 缩略图按目录缓存：data.stills 是相对 docs/demos 的目录，默认 trailer/stills
const CACHE = {}
async function load(rel) {
  const IMG = {}
  for (const th of THEMES) { IMG[th] = []; for (let i = 0; i < 9; i++) IMG[th].push(await loadImage(path.join(root, rel, `${th}-${i + 1}.jpg`))) }
  return IMG
}
for (const rel of ['trailer/stills', 'trailer-en/stills']) { try { CACHE[rel] = await load(rel) } catch { /* 没生成的那一套不用 */ } }

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }

export default function (ctx, s, E) {
  const { W, H, u, theme } = E, c = theme.c, d = s.scene.data, t = s.t, beat = d.beat, flipAt = d.flipAt
  const IMG = CACHE[d.stills || 'trailer/stills']
  if (!IMG) throw new Error('缩略图还没生成：先跑 docs/demos/trailer/make-stills.mjs')
  const cw = 384 * u, ch = 216 * u, gap = 28 * u, gw = cw * 3 + gap * 2, gh = ch * 3 + gap * 2
  const gx = W - 120 * u - gw, gy = (H - gh) / 2
  const landAt = i => 0.3 + i * beat / 2
  // 现在是第几个主题
  const step = clamp(Math.floor((t - flipAt) / beat), 0, 6), cur = t < flipAt ? 0 : step + 1

  const zoom = 1 + 0.05 * t / s.dur
  ctx.save(); ctx.translate(gx + gw / 2, H / 2); ctx.scale(zoom, zoom); ctx.transform(1, -0.03, 0, 1, 0, 0); ctx.translate(-(gx + gw / 2), -H / 2)
  for (let i = 0; i < 9; i++) {
    const col = i % 3, row = Math.floor(i / 3), p = clamp((t - landAt(i)) / 0.36)
    if (p <= 0) continue
    const x = gx + col * (cw + gap), y = gy + row * (ch + gap) + Math.sin(t * 0.9 + i * 1.7) * 5 * u
    const e = outBack(p), sc = lerp(2.3, 1, e), a = clamp(p * 2.5)
    const ox = lerp((hash(i, 21) - 0.5) * 900 * u, 0, outCubic(p)), oy = lerp((hash(i, 22) - 0.5) * 700 * u, 0, outCubic(p)), rot = lerp((hash(i, 23) - 0.5) * 0.5, 0, outCubic(p))
    // 换主题：整张牌翻过去
    let img = IMG[ORDER[cur]][i], sx = 1
    if (t >= flipAt) {
      const q = (t - flipAt - step * beat - col * 0.045 - row * 0.02) / 0.3
      if (q < 0.5) img = IMG[ORDER[step]][i]
      if (q > 0 && q < 1) sx = Math.max(0.02, Math.abs(Math.cos(q * Math.PI)))
    }
    ctx.save(); ctx.translate(x + cw / 2 + ox, y + ch / 2 + oy); ctx.rotate(rot); ctx.scale(sc * sx, sc); ctx.globalAlpha = a
    const flash = t < landAt(i) + 0.26 ? 0 : Math.exp(-(t - landAt(i) - 0.26) * 5)
    ctx.shadowColor = rgba(c.accent2, (0.45 + 0.55 * flash) * a); ctx.shadowBlur = (22 + 70 * flash) * u / sc
    rr(ctx, -cw / 2, -ch / 2, cw, ch, 14 * u); ctx.fillStyle = '#000'; ctx.fill(); ctx.shadowBlur = 0
    ctx.save(); rr(ctx, -cw / 2, -ch / 2, cw, ch, 14 * u); ctx.clip(); ctx.drawImage(img, -cw / 2, -ch / 2, cw, ch); ctx.restore()
    rr(ctx, -cw / 2, -ch / 2, cw, ch, 14 * u); ctx.strokeStyle = rgba('#ffffff', 0.28 + 0.7 * flash); ctx.lineWidth = (2 + 3 * flash) * u; ctx.stroke()
    ctx.restore()
  }
  ctx.restore()

  // 左边：大数字和一行说明
  const lx = 130 * u, my = H / 2
  const landed = Math.min(9, Math.max(0, Math.floor((t - 0.3 - 0.2) / (beat / 2)) + 1)), phase2 = t >= flipAt
  const fadeOut = phase2 ? 0 : 1 - clamp((t - (flipAt - 0.25)) / 0.25)
  const own = cur === 7
  const num = own ? '6+' : phase2 ? 6 : landed, label = own ? d.customLabel : phase2 ? d.themesLabel : d.layoutsLabel
  const chip = own ? d.customChip : phase2 ? `"theme": "${ORDER[cur]}"` : landed > 0 ? `"layout": "${NAMES[landed - 1]}"` : ''
  const since = own ? t - flipAt - 6 * beat : phase2 ? t - flipAt : t - landAt(Math.max(0, landed - 1)), pop = 1 + 0.16 * Math.exp(-Math.max(0, since) * 7)
  if (num) {
    ctx.save(); ctx.globalAlpha = phase2 ? clamp((t - flipAt) / 0.15) : fadeOut
    glow(ctx, lx + 150 * u, my - 110 * u, 420 * u, c.accent, 0.22)
    ctx.translate(lx, my - 110 * u); ctx.scale(pop, pop)
    const g = ctx.createLinearGradient(0, -170 * u, 0, 170 * u); g.addColorStop(0, '#ffffff'); g.addColorStop(1, c.accent2)
    ctx.fillStyle = g; ctx.font = E.font('num', 800, 380 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.shadowColor = c.accent; ctx.shadowBlur = 50 * u; ctx.fillText(String(num), -10 * u, 0)
    ctx.restore()
    ctx.save(); ctx.globalAlpha = phase2 ? clamp((t - flipAt) / 0.15) : fadeOut
    const lf = E.fit(label, { role: 'title', weight: 700, size: 84 * u, maxW: gx - lx - 40 * u, maxLines: 1, quiet: true })
    ctx.fillStyle = c.fg; ctx.font = E.font('title', 700, lf.size); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, lx, my + 150 * u)
    if (chip) {
      ctx.font = E.font('mono', 600, 30 * u); const w = ctx.measureText(chip).width + 44 * u, hh = 62 * u, yy = my + 232 * u
      rr(ctx, lx, yy, w, hh, 12 * u); ctx.fillStyle = rgba(c.accent, 0.22); ctx.fill(); ctx.strokeStyle = rgba(c.accent2, 0.7); ctx.lineWidth = 2 * u; ctx.stroke()
      ctx.fillStyle = c.fg; ctx.fillText(chip, lx + 22 * u, yy + hh / 2 + 1 * u)
    }
    ctx.restore()
  }
}
