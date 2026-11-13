// 移植自风格库的 R-复古录像带：背景（放射光、演播室布景、彩条测试卡）、换台转场、录像带回放质感（最上层）、
// 隐藏字幕、屏显角标、片尾关机。
import { mix, rgba, clamp, ease, textUnits } from '../../../core.mjs'
import { captionChunks } from '../../../layouts.mjs'
import { P, FIX, snow, glyph, SNOW_RATE } from './tape.mjs'

// ---------- 背景 ----------
// 片头、大数字、片尾用放射光；柱状图用压暗的彩条测试卡；其余是演播室布景。每场的底色在 bg 上混一点不同的色，像换了一个台
const KIND = { title: 'rays', number: 'rays', end: 'rays', bars: 'bars' }
const TINT = [null, '#6a1640', '#0f2a66', '#0b4a4a', '#4a2a12']
const tone = i => (TINT[i % TINT.length] ? mix(P.bg, TINT[i % TINT.length], 0.45) : P.bg)

function base(E, kind, b0, glow) {
  const { W, H } = E, cv = E.createCanvas(W, H), c = cv.getContext('2d')
  c.fillStyle = b0; c.fillRect(0, 0, W, H)
  const cx = W / 2, cy = H * (E.portrait ? 0.5 : 0.56), g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.6)
  g.addColorStop(0, rgba(glow, 0.24)); g.addColorStop(0.5, rgba(glow, 0.07)); g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  if (kind === 'studio') studio(c, E, b0, glow)
  if (kind === 'bars') testcard(c, E, b0)
  return cv
}
// 演播室布景（静态）：竖条墙板、墙上一道半透明四色条纹、地台透视线、两束顶灯、地上光斑
function studio(c, E, b0, glow) {
  const { W, H, u } = E, fy = H * (E.portrait ? 0.72 : 0.76), pw = (E.portrait ? 75 : 120) * u
  for (let x = 0, k = 0; x < W; x += pw, k++) {
    c.fillStyle = k % 2 ? rgba(mix(b0, '#ffffff', 0.08), 0.6) : 'rgba(0,0,0,0.12)'; c.fillRect(x, 0, pw, fy)
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(x, 0, 3 * u, fy)
  }
  const sy = fy - H * 0.13, sh = 46 * u
  P.stripes.forEach((col, i) => { c.fillStyle = rgba(col, 0.3); c.fillRect(0, sy + i * sh / 4, W, sh / 4 + 0.5) })
  const fg = c.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, mix(b0, '#000000', 0.25)); fg.addColorStop(1, mix(b0, '#000000', 0.55))
  c.fillStyle = fg; c.fillRect(0, fy, W, H - fy)
  c.fillStyle = rgba(glow, 0.5); c.fillRect(0, fy, W, 4 * u)
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 2 * u
  for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(W / 2 + i * W * 0.05, fy); c.lineTo(W / 2 + i * W * 0.22, H); c.stroke() }
  for (const sx of [0.22, 0.78]) {
    const x0 = W * sx, g = c.createLinearGradient(0, 0, 0, fy)
    g.addColorStop(0, 'rgba(255,244,214,0.15)'); g.addColorStop(1, 'rgba(255,244,214,0)')
    c.fillStyle = g; c.beginPath(); c.moveTo(x0 - 30 * u, 0); c.lineTo(x0 + 30 * u, 0); c.lineTo(x0 + W * 0.16, fy); c.lineTo(x0 - W * 0.16, fy); c.closePath(); c.fill()
    const pg = c.createRadialGradient(x0, fy + 30 * u, 0, x0, fy + 30 * u, W * 0.2)
    pg.addColorStop(0, 'rgba(255,244,214,0.13)'); pg.addColorStop(1, 'rgba(255,244,214,0)')
    c.save(); c.translate(x0, fy + 30 * u); c.scale(1, 0.25); c.translate(-x0, -(fy + 30 * u)); c.fillStyle = pg; c.fillRect(0, 0, W, H * 2); c.restore()
  }
}
// 通用七色彩条测试卡，压暗作底：上段七色竖条，中段反序窄条，下段灰阶块
function testcard(c, E, b0) {
  const { W, H } = E, bw = W / 7, h1 = H * 0.67, h2 = H * 0.08
  const rows = [
    [0, h1, ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']],
    [h1, h2, ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0']],
    [h1 + h2, H - h1 - h2, ['#00214c', '#ffffff', '#32006a', '#131313', '#090909', '#131313', '#1d1d1d']],
  ]
  c.save(); c.globalAlpha = 0.2
  for (const [y, h, cols] of rows) cols.forEach((col, i) => { c.fillStyle = col; c.fillRect(i * bw, y, bw + 1, h) })
  c.restore()
  c.fillStyle = rgba(b0, 0.35); c.fillRect(0, 0, W, H)
}
// 放射光：从画面下方中心发出，缓慢转动；光芒只比底色亮一点，中心再压暗，转起来也不抢字
function rays(ctx, E, b0, glow) {
  const { W, H } = E, cx = W / 2, cy = H * (E.portrait ? 0.62 : 0.78), R = Math.hypot(W, H), n = 20, rot = E.T * 0.06
  ctx.fillStyle = mix(mix(b0, glow, 0.16), '#ffffff', 0.05)
  for (let i = 0; i < n; i += 2) {
    const a0 = rot + i * Math.PI * 2 / n, a1 = a0 + Math.PI * 2 / n
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); ctx.closePath(); ctx.fill()
  }
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.32)
  g.addColorStop(0, rgba(b0, 0.85)); g.addColorStop(1, rgba(b0, 0))
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
}
export function background(ctx, E, s) {
  const kind = KIND[s.layout] || 'studio', b0 = tone(s.index), glow = [P.acc, P.acc2, FIX.cyan, FIX.teal][s.index % 4]
  ctx.drawImage(E.once(`vhs-bg:${kind}:${b0}:${glow}`, () => base(E, kind, b0, glow)), 0, 0)
  if (kind === 'rays') rays(ctx, E, b0, glow)
}

// ---------- 换台转场 ----------
// 0–0.38 上一台横向撕裂、雪花渐起；0.38–0.55 满屏雪花；0.55–1 新台从上往下滚动稳住、雪花退去。雪花每秒只换 12 张（省码率）
export function transition(ctx, A, B, p, E) {
  const { W, H, u } = E, fr = Math.floor(E.T * SNOW_RATE)
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  if (p < 0.38) {
    const q = p / 0.38, sh = Math.round(16 * u)
    for (let y = 0; y < H; y += sh) {
      const h = Math.min(sh, H - y), dx = E.noise1(y * 0.02 + fr * 3.1, 5) * q * q * 160 * u
      ctx.drawImage(A, 0, y, W, h, dx, y, W, h)
    }
    snow(ctx, E, 0, 0, W, H, fr, q * 0.7)
  } else if (p < 0.55) {
    snow(ctx, E, 0, 0, W, H, fr, 1)
    ctx.fillStyle = rgba(P.bg, 0.25); ctx.fillRect(0, 0, W, H)
  } else {
    const q = (p - 0.55) / 0.45, off = (1 - ease.out(q)) * H * 0.45, bar = 36 * u
    ctx.drawImage(B, 0, off); ctx.drawImage(B, 0, off - H - bar)
    ctx.fillStyle = '#000'; ctx.fillRect(0, off - bar, W, bar)
    snow(ctx, E, 0, 0, W, H, fr, (1 - q) * 0.5)
  }
}

// ---------- 最上层：录像带回放的质感 ----------
const tmpOf = E => E.once('vhs-tmp', () => E.createCanvas(E.W, E.H))
// 换台后信号稳定下来的那一秒：整屏淡淡一层横纹噪点（宽八分之一、高四分之一，平滑放大），只算一次，每秒换 10 张。
// 不做全片常驻：实测哪怕透明度只有 0.015，CRF 18 下每秒也要 300 KB 以上，全片会比别的风格包大一倍
function grain(E) {
  return E.once('vhs-grain', () => {
    const w = Math.ceil(E.W / 8), h = Math.ceil(E.H / 4), r = E.rng(91), out = []
    for (let k = 0; k < 8; k++) {
      const c = E.createCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h)
      for (let i = 0; i < w * h; i++) { const v = (r() * 255) | 0; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255 }
      x.putImageData(id, 0, 0); out.push(c)
    }
    return out
  })
}
// 显像管：扫描线、暗角、圆角黑边（全片共用，只算一次）
function crt(E) {
  return E.once('vhs-crt', () => {
    const { W, H, u } = E, cv = E.createCanvas(W, H), c = cv.getContext('2d')
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.55)
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)')
    c.fillStyle = g; c.fillRect(0, 0, W, H)
    // 圆角黑边：外框矩形和里面的圆角矩形放进同一条路径，奇偶填充只涂两者之间（core 的 roundRect 会先清路径，这里手写）
    const m = 6 * u, r = 56 * u, x1 = W - m, y1 = H - m
    c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, W, H)
    c.moveTo(m + r, m); c.arcTo(x1, m, x1, y1, r); c.arcTo(x1, y1, m, y1, r); c.arcTo(m, y1, m, m, r); c.arcTo(m, m, x1, m, r); c.closePath()
    c.fill('evenodd')
    c.fillStyle = 'rgba(0,0,0,0.13)'
    for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2)
    return cv
  })
}
// 色彩错位：拷一份只留红色，原画去掉红色，再把红色往左错开几个像素叠回去（整帧合成，不逐像素算）
function chroma(ctx, E) {
  const { W, H, u } = E, tmp = tmpOf(E), t = tmp.getContext('2d'), d = Math.max(2, Math.round(2.5 * u))
  t.globalCompositeOperation = 'copy'; t.drawImage(ctx.canvas, 0, 0)
  t.globalCompositeOperation = 'multiply'; t.fillStyle = '#ff0000'; t.fillRect(0, 0, W, H)
  t.globalCompositeOperation = 'source-over'
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = '#00ffff'; ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tmp, -d, 0)
  ctx.restore()
}
// 跟踪线：一条淡噪声带每 9.5 秒缓慢滚过，横向只错 2 个像素；靠近字幕带时淡掉
function tracking(ctx, E) {
  const { W, H, u } = E, ph = (E.T % 9.5) / 9.5, by = Math.round((ph * 1.25 - 0.12) * H), bh = Math.round(30 * u)
  const capY = H - E.captionH / 2, away = E.captionH ? clamp((Math.abs(by - capY) - E.captionH / 2 - 30 * u) / (60 * u)) : 1
  if (by < 0 || by + bh > H || away <= 0) return
  ctx.save(); ctx.globalAlpha = away
  ctx.drawImage(ctx.canvas, 0, by, W, bh, 2 * u, by, W, bh)
  ctx.globalCompositeOperation = 'screen'
  snow(ctx, E, 0, by + bh * 0.3, W, bh * 0.4, Math.floor(E.T * SNOW_RATE), 0.2 * away)
  ctx.restore()
}
// 底部磁头切换噪声：最下面一窄条横向错开、带一点雪花
function headSwitch(ctx, E) {
  const { W, H, u } = E, hb = Math.round(10 * u), y = H - hb - Math.round(6 * u)
  ctx.drawImage(ctx.canvas, 0, y, W, hb, Math.round(10 * u + 6 * u * E.noise1(Math.floor(E.T * 10) * 0.7, 9)), y, W, hb)
  snow(ctx, E, 0, y, W, hb, Math.floor(E.T * SNOW_RATE) + 2, 0.35)
}

// 隐藏字幕：电视机自己解出来叠在画面上，所以画在录像带质感之后，不带色边和噪点。每行一块黑底白字
function captions(ctx, s, E) {
  const say = s.scene.say
  if (!say || !E.captionH) return
  const { W, H, u } = E, por = E.portrait
  const chunks = captionChunks(say, por ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((a, b) => a + b, 0)
  const span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  const a = Math.min(clamp((s.t - t0) / 0.12), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.1))
  if (a <= 0) return
  const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 700, size: (por ? 44 : 40) * u, maxW: W - E.safe.l * 2, maxLines: 2, quiet: true })
  const lh = f.size * 1.5, cy = H - E.captionH / 2 - (por ? 30 * u : 0), y0 = cy - f.lines.length * lh / 2
  ctx.save(); ctx.globalAlpha = a; ctx.font = E.font('body', 700, f.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  f.lines.forEach((ln, j) => {
    const y = y0 + j * lh + lh / 2, w = ctx.measureText(ln).width + f.size * 0.8
    ctx.fillStyle = 'rgba(8,4,14,0.88)'; ctx.fillRect(W / 2 - w / 2, y - lh / 2, w, lh)
    ctx.fillStyle = '#fbf8ee'; ctx.fillText(ln, W / 2, y + 1)
  })
  ctx.restore()
}

// 屏显角标：左上 PLAY ▶（片头前 2 秒闪烁；statement 场是 PAUSE ❚❚），右上 SP 和走带计时（片子自己的时分秒）
const pad2 = n => String(n).padStart(2, '0')
function osd(ctx, E, s) {
  const { W, u } = E, por = E.portrait, fs = (por ? 28 : 30) * u, y = (por ? 112 : 60) * u, xl = (por ? 62 : 84) * u
  const txt = (str, x, align) => {
    ctx.font = E.font('mono', 400, fs); ctx.textAlign = align; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(str, x + 3 * u, y + 3 * u)
    ctx.fillStyle = FIX.osd; ctx.fillText(str, x, y)
    return ctx.measureText(str).width
  }
  const pause = s.layout === 'statement'
  if (pause || E.T >= 2 || Math.floor(E.T * 2.5) % 2 === 0) {
    const gx = xl + txt(pause ? 'PAUSE' : 'PLAY', xl, 'left') + 24 * u, k = pause ? 'pause' : 'play'
    glyph(ctx, k, gx + 3 * u, y + 3 * u, fs * 0.36, 'rgba(0,0,0,0.6)'); glyph(ctx, k, gx, y, fs * 0.36, FIX.osd)
  }
  const T = Math.floor(E.T)
  txt(`SP  ${Math.floor(T / 3600)}:${pad2(Math.floor(T / 60) % 60)}:${pad2(T % 60)}`, W - xl, 'right')
}

// 片尾关机：画面压成一条越来越亮的横线，再缩成一个点（全片最后 1.25 秒起，赶在引擎淡到黑之前做完）
function powerOff(ctx, E) {
  const { W, H, u } = E, p = (E.T - (E.total - 1.25)) / 0.5
  if (p <= 0) return
  const tmp = tmpOf(E), t = tmp.getContext('2d')
  t.globalCompositeOperation = 'copy'; t.drawImage(ctx.canvas, 0, 0); t.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  const sy = Math.max(0.004, 1 - ease.in(clamp(p / 0.5))), sx = p < 0.5 ? 1 : Math.max(0.002, 1 - ease.out(clamp((p - 0.5) / 0.4)))
  if (p < 0.92) {
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sx, sy); ctx.drawImage(tmp, -W / 2, -H / 2)
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${clamp(p * 1.6) * 0.7})`; ctx.fillRect(-W / 2, -H / 2, W, H)
    ctx.restore()
  }
  if (p > 0.35) {
    const a = 0.9 * (1 - clamp((p - 0.85) / 0.25)), r = 160 * u, g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r)
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g; ctx.fillRect(W / 2 - r * Math.max(sx, 0.1), H / 2 - 30 * u, 2 * r * Math.max(sx, 0.1), 60 * u)
  }
}

export function overlay(ctx, E, s) {
  const { W, H } = E
  chroma(ctx, E)
  // 重影：整帧向右偏几个像素、用滤色淡淡叠一层
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.08; ctx.drawImage(ctx.canvas, Math.round(6 * E.u), 0); ctx.restore()
  // 每场开头（换台之后）约一秒的噪点，渐渐退去
  const ga = 0.06 * (1 - clamp((s.t - 0.3) / 0.4))
  if (ga > 0) { const G = grain(E); ctx.save(); ctx.globalAlpha = ga; ctx.drawImage(G[Math.floor(E.T * 10) % G.length], 0, 0, W, H); ctx.restore() }
  tracking(ctx, E)
  headSwitch(ctx, E)
  ctx.drawImage(crt(E), 0, 0)
  captions(ctx, s, E)
  osd(ctx, E, s)
  powerOff(ctx, E)
}
