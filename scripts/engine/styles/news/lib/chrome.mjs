// 新闻播报的外框，移植自风格库的 T-新闻播报 style.mjs：演播室背景、左上角标、下三分之一标题条、
// 滚动字幕条、字幕条、光带擦除转场。原样片的频道名和按旁白锚词编的标题、滚动词表都去掉了：
// 这里标题条和滚动条的字只从这一场自己的 s.scene 里取，装饰字只有「LIVE」「快讯」「播报」。
import { P, text, tag, globe, measure, grainSheet } from './news.mjs'
import { captionChunks } from '../../../layouts.mjs'
import { textUnits } from '../../../core.mjs'

// 外框位置。竖屏整体收在画面下部的平台界面区以上，最下面是演播室地面
export function frame(E) {
  const { W, H, u } = E, por = E.portrait, cap = E.captionH > 0
  const mx = (por ? 54 : 96) * u, tickH = 58 * u
  const tickY = por ? H - 291 * u : H - tickH
  const capY = tickY - (por ? 82 : 66) * u, headH = (por ? 66 : 64) * u
  const headY = cap ? capY - (por ? 120 : 103) * u : tickY - headH / 2 - 26 * u
  const top = (por ? 218 : 118) * u, bot = headY - headH / 2 - (por ? 26 : 18) * u
  return { mx, tickY, tickH, capY, headY, headH, bugY: (por ? 172 : 62) * u, floorY: tickY + tickH, B: { x: mx, y: top, w: W - 2 * mx, h: bot - top } }
}

// 演播室背景：深蓝径向渐变、LED 墙竖格、线框地球（globe=false 时不画，留给版式自己画前景地球）、斜向光带、横向镜头光、竖屏地面、暗角、颗粒
// 不动的两层（底色和 LED 墙；地面和暗角）各画一次存起来，每帧贴上去
function staticLayer(E, name, draw) {
  return E.once('news-bg-' + name, () => { const c = E.createCanvas(E.W, E.H); draw(c.getContext('2d')); return c })
}
export function studioBg(ctx, E, o = {}) {
  const { W, H, u, T } = E, por = E.portrait
  ctx.drawImage(staticLayer(E, 'base', x => {
    const g = x.createRadialGradient(W * 0.5, H * 0.32, 0, W * 0.5, H * 0.4, Math.max(W, H) * 0.8)
    g.addColorStop(0, P.bg2); g.addColorStop(0.45, P.bg1); g.addColorStop(1, P.bg0)
    x.fillStyle = g; x.fillRect(0, 0, W, H)
    x.fillStyle = E.rgba(P.blue2, 0.05)
    for (let xx = (W / 2) % (96 * u); xx < W; xx += 96 * u) x.fillRect(xx, 0, 1.5 * u, H)
  }), 0, 0)
  if (o.globe !== false) {
    const gx = por ? W * 0.5 : W * 0.74, gy = por ? H * 0.36 : H * 0.44, R = (por ? 430 : 400) * u
    const glow = ctx.createRadialGradient(gx, gy, R * 0.2, gx, gy, R * 1.4)
    glow.addColorStop(0, E.rgba(P.blue, 0.18)); glow.addColorStop(1, E.rgba(P.blue, 0))
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    globe(ctx, E, gx, gy, R, T * 0.2, { alpha: 0.13, lw: 1.3 })
  }
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 3; i++) {
    const x = ((((i * 0.37 + T * (0.025 + i * 0.012)) % 1.4) + 1.4) % 1.4 - 0.2) * W, bw = (90 + i * 70) * u
    ctx.save(); ctx.translate(x, H * 0.5); ctx.rotate(-0.42)
    const bg = ctx.createLinearGradient(-bw, 0, bw, 0)
    bg.addColorStop(0, E.rgba(P.blue2, 0)); bg.addColorStop(0.5, E.rgba(P.blue2, 0.06 - i * 0.012)); bg.addColorStop(1, E.rgba(P.blue2, 0))
    ctx.fillStyle = bg; ctx.fillRect(-bw, -H * 1.2, bw * 2, H * 2.4)
    ctx.restore()
  }
  const fy = por ? H * 0.12 : H * 0.15, fp = 0.5 + 0.3 * Math.sin(T * 0.15), fg = ctx.createLinearGradient(0, 0, W, 0)
  fg.addColorStop(0, E.rgba(P.cyan, 0)); fg.addColorStop(fp, E.rgba(P.cyan, 0.12)); fg.addColorStop(1, E.rgba(P.cyan, 0))
  ctx.fillStyle = fg; ctx.fillRect(0, fy, W, 2 * u)
  ctx.restore()
  ctx.drawImage(staticLayer(E, 'top', x => {
    if (por) {
      const f0 = frame(E).floorY, flg = x.createLinearGradient(0, f0, 0, H)
      flg.addColorStop(0, E.mix(P.bg1, P.blue, 0.12)); flg.addColorStop(1, P.bg0)
      x.fillStyle = flg; x.fillRect(0, f0, W, H - f0)
      x.strokeStyle = E.rgba(P.cyan, 0.12); x.lineWidth = 1.5 * u
      for (let k = -8; k <= 8; k++) { x.beginPath(); x.moveTo(W / 2 + k * 40 * u, f0); x.lineTo(W / 2 + k * 260 * u, H); x.stroke() }
      for (let k = 1; k < 7; k++) { const yy = f0 + (H - f0) * Math.pow(k / 7, 1.8); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke() }
    }
    const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.78)
    g.addColorStop(0, E.rgba(P.bg0, 0)); g.addColorStop(1, E.rgba(P.bg0, 0.5))
    x.fillStyle = g; x.fillRect(0, 0, W, H)
  }), 0, 0)
  const f = Math.floor(T * 15)
  ctx.save()
  ctx.globalAlpha = 0.03; ctx.globalCompositeOperation = 'overlay'
  ctx.drawImage(grainSheet(E), -((f * 97) % 256), -((f * 61) % 256))
  ctx.restore()
}

// 左上角标：转动的小地球、LIVE、闪烁的红点。不写台名
export function drawBug(ctx, E, fr) {
  const u = E.u, x = fr.mx, y = fr.bugY, h = 52 * u, fs = 28 * u, font = E.font('title', 900, fs)
  const tw = measure(ctx, 'LIVE', font), w = tw + 118 * u
  ctx.save()
  const g = ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, E.rgba(P.blue, 0.92)); g.addColorStop(1, E.rgba(P.bg1, 0.75))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x + w, y - h / 2); ctx.lineTo(x + w - 18 * u, y + h / 2); ctx.lineTo(x, y + h / 2); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = E.rgba(P.ice, 0.5); ctx.lineWidth = 1.5 * u; ctx.stroke()
  globe(ctx, E, x + 30 * u, y, 17 * u, E.T * 1.2, { alpha: 0.95, lw: 1.6, meridians: 6, parallels: 4, seg: 16, color: P.white, tilt: 0.3 })
  text(ctx, 'LIVE', x + 60 * u, y + 1 * u, { font, color: P.white })
  ctx.globalAlpha = Math.floor(E.T * 2) % 2 ? 1 : 0.3
  ctx.fillStyle = P.red2; ctx.beginPath(); ctx.arc(x + 60 * u + tw + 20 * u, y, 8 * u, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// 下三分之一标题条：左边红色「快讯」块（mode 为 name 时是金色引号块，作采访人名条），右边白条写字，斜切尾，下沿一道蓝线。
// flip 是纵向展开的比例（翻牌：展开带回弹，换场前压扁收起）
export function headFit(E, fr, text) {
  const u = E.u, tagW = 116 * u
  return E.fit(text, { role: 'title', weight: 900, size: (E.portrait ? 38 : 40) * u, maxW: E.W - fr.mx * 2 - tagW - 90 * u, maxLines: 2, lineGap: 1.25, oneLine: true })
}
export function drawHeadline(ctx, E, fr, f, mode, flip) {
  if (flip <= 0.001) return
  const u = E.u, x = fr.mx, h = Math.max(fr.headH, f.lines.length * f.lineH + 16 * u), cy = fr.headY + fr.headH / 2 - h / 2
  ctx.save()
  ctx.translate(0, cy); ctx.scale(1, flip)
  const name = mode === 'name'
  const tw = tag(ctx, E, name ? '' : '快讯', x, 0, { fs: 32 * u, w: name ? 76 * u : undefined, h, r: 0, color: name ? P.gold : P.red })
  if (name) {
    // 采访人名条：金色块里一个小人像
    const ix = x + tw / 2, k = Math.min(h, fr.headH) * 0.5
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(ix, -k * 0.32, k * 0.26, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.moveTo(ix - k * 0.52, k * 0.62); ctx.quadraticCurveTo(ix - k * 0.5, k * 0.02, ix, k * 0.02); ctx.quadraticCurveTo(ix + k * 0.5, k * 0.02, ix + k * 0.52, k * 0.62); ctx.closePath(); ctx.fill()
  }
  const bx = x + tw, w = f.width + 56 * u
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
  g.addColorStop(0, P.white); g.addColorStop(1, P.ice)
  ctx.fillStyle = g; ctx.fillRect(bx, -h / 2, w, h)
  ctx.beginPath(); ctx.moveTo(bx + w, -h / 2); ctx.lineTo(bx + w + 26 * u, -h / 2); ctx.lineTo(bx + w, h / 2); ctx.closePath(); ctx.fillStyle = P.ice; ctx.fill()
  ctx.fillStyle = name ? P.gold : P.blue; ctx.fillRect(x, h / 2, tw + w, 6 * u)
  ctx.fillStyle = P.ink; ctx.font = E.font('title', 900, f.size); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  f.lines.forEach((ln, i) => ctx.fillText(ln, bx + 28 * u, (i - (f.lines.length - 1) / 2) * f.lineH + 2 * u))
  ctx.restore()
}

// 滚动字幕条：左端红块写「播报」。items 是这一场自己的几段字，按顺序首尾相接循环滚动；
// 每场开头整条从下面翻上来，换场前 0.25 秒淡出
export function drawTicker(ctx, E, fr, s, items) {
  const { W, u } = E, por = E.portrait, ty = fr.tickY, th = fr.tickH
  const lab = (por ? 190 : 230) * u, fs = (por ? 30 : 32) * u
  ctx.save()
  ctx.fillStyle = E.rgba(P.bg0, 0.94); ctx.fillRect(0, ty, W, th)
  ctx.fillStyle = P.blue; ctx.fillRect(0, ty, W, 2 * u)
  const sep = 64 * u, v = 110 * u, kin = E.ease.out(E.clamp(s.t / 0.35))
  const a = Math.min(kin, s.index < s.count - 1 ? E.clamp((s.dur - s.t) / 0.25) : 1)
  if (items.length && a > 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(lab, ty, W - lab, th); ctx.clip()
    ctx.font = E.font('body', 600, fs); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.globalAlpha = a
    ctx.translate(0, (1 - kin) * th * 0.7)
    // 字很少时（一场只有一个短数字）把间隔拉开，一圈至少占条宽的六成，不密密麻麻地重复
    const strs = items.map(t => t.replace(/\s*\n\s*/g, ' ')), tw = strs.map(t => ctx.measureText(t).width), raw = tw.reduce((x, y) => x + y + sep, 0)
    const gap = sep + Math.max(0, (W - lab) * 0.6 - raw) / strs.length, ws = tw.map(w => w + gap), loop = ws.reduce((x, y) => x + y, 0)
    let x = lab + 28 * u - (s.t * v) % loop
    for (let k = 0; x < W; k++) {
      const j = k % strs.length
      if (x + ws[j] > lab) {
        ctx.fillStyle = P.white; ctx.fillText(strs[j], x, ty + th / 2 + 1 * u)
        ctx.save(); ctx.fillStyle = P.red2; ctx.translate(x + tw[j] + gap / 2, ty + th / 2); ctx.rotate(Math.PI / 4); ctx.fillRect(-5 * u, -5 * u, 10 * u, 10 * u); ctx.restore()
      }
      x += ws[j]
    }
    ctx.restore()
  }
  const lg = ctx.createLinearGradient(0, ty, 0, ty + th)
  lg.addColorStop(0, P.red2); lg.addColorStop(1, E.mix(P.red, '#000000', 0.2))
  ctx.fillStyle = lg
  ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(lab, ty); ctx.lineTo(lab - 16 * u, ty + th); ctx.lineTo(0, ty + th); ctx.closePath(); ctx.fill()
  ctx.font = E.font('title', 900, fs); ctx.fillStyle = P.white; ctx.textBaseline = 'middle'
  E.spacedText(ctx, '播报', (lab - 16 * u) / 2 + 4 * u, ty + th / 2 + 1 * u, 6 * u, 'center')
  ctx.restore()
}

// 字幕：深蓝半透明条上的白字，上沿一道青色细线；一场的 say 按标点切成几段轮流显示
export function drawCap(ctx, s, E, fr) {
  const say = s.scene.say
  if (!say) return
  const { W, u } = E, por = E.portrait
  const chunks = captionChunks(say, por ? 16 : 28), lens = chunks.map(c => textUnits(c)), total = lens.reduce((a, b) => a + b, 0), span = Math.max(0.5, s.dur - 0.3)
  let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
  for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
  const a = Math.min(E.clamp((s.t - t0) / 0.15), idx === chunks.length - 1 ? 1 : E.clamp((t1 - s.t) / 0.1))
  const size = (por ? 44 : 38) * u
  const f = E.fit(chunks[idx].replace(/[，、：:,。]$/u, ''), { role: 'body', weight: 600, size, maxW: W - fr.mx * 2 - size * 1.4, maxLines: 2, lineGap: 1.36, quiet: true })
  const pw = f.width + f.size * 1.4, ph = f.lines.length * f.lineH + f.size * 0.5, cy = fr.capY
  ctx.globalAlpha = a
  ctx.fillStyle = E.rgba(P.bg0, 0.78); E.roundRect(ctx, W / 2 - pw / 2, cy - ph / 2, pw, ph, 6 * u); ctx.fill()
  ctx.fillStyle = E.rgba(P.cyan, 0.55); ctx.fillRect(W / 2 - pw / 2 + 6 * u, cy - ph / 2, pw - 12 * u, 2 * u)
  ctx.font = E.font('body', 600, f.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  f.lines.forEach((ln, j) => {
    const y = cy + (j - (f.lines.length - 1) / 2) * f.lineH + f.size * 0.04
    ctx.fillStyle = E.rgba(P.bg0, 0.8); ctx.fillText(ln, W / 2, y + 2 * u)
    ctx.fillStyle = P.white; ctx.fillText(ln, W / 2, y)
  })
}

// 转场：新闻光带擦除。一条斜向光带（蓝、白芯、红色细线、青）从左扫到右，带后是下一场
export function bandWipe(ctx, A, B, p, E) {
  const { W, H, u } = E, e = E.ease.inOut(p), k = 0.32 * H
  const X = E.lerp(-0.25 * W - k, 1.25 * W + k, e)
  ctx.drawImage(A, 0, 0)
  ctx.save()
  ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(X + k, -10); ctx.lineTo(X - k, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.clip()
  ctx.drawImage(B, 0, 0)
  ctx.restore()
  const bw = 200 * u
  ctx.save()
  ctx.beginPath(); ctx.moveTo(X + k - bw * 0.5, -10); ctx.lineTo(X + k + bw * 0.5, -10); ctx.lineTo(X - k + bw * 0.5, H + 10); ctx.lineTo(X - k - bw * 0.5, H + 10); ctx.closePath(); ctx.clip()
  // 渐变沿光带的法线方向走，带子的边缘是一条直线（原样片按横条逐段平移，边缘是锯齿）
  const len = Math.hypot(2 * k, H), nx = H / len, ny = 2 * k / len, hw = bw * 0.5 * nx
  const g = ctx.createLinearGradient(X - nx * hw, H / 2 - ny * hw, X + nx * hw, H / 2 + ny * hw)
  g.addColorStop(0, E.rgba(P.blue, 0)); g.addColorStop(0.3, E.rgba(P.blue, 0.85)); g.addColorStop(0.5, E.rgba(P.ice, 0.95))
  g.addColorStop(0.56, E.rgba(P.red, 0.95)); g.addColorStop(0.62, E.rgba(P.red, 0.95)); g.addColorStop(0.68, E.rgba(P.cyan, 0.7)); g.addColorStop(1, E.rgba(P.blue, 0))
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20)
  ctx.restore()
}
