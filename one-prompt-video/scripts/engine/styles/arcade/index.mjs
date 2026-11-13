// 街机关卡（arcade）：8-bit 平台游戏风。所有图形落在 6px 像素网格上，每种版式是一个游戏画面：
// title 标题画面、statement 黄昏城市里的消息框、bullets 星空装备栏、number 奖励关分数跳字、bars 方块塔 / 竖屏血条、
// steps 海上世界地图、compare 1P 对 2P、quote 地下关 NPC 对话、end 领奖台通关画面。字幕是 RPG 对话框，最上层是扫描线和 HUD。
// 场和场之间是像素马赛克转场。画法库（像素网格、点阵字、中文像素字、贴图、小机器人、布景）移植自风格库的 G-街机关卡，见 lib/ 和 NOTES.md。
import { clamp, mix, formatNumber, decimalsOf, textUnits, drawLines } from '../../core.mjs'
import { COUNT, captionChunks, rolling } from '../../layouts.mjs'
import { PAL, useE, cellOf, screenView, view, ptext, pwidth, panel, step, blink, popQ } from './lib/px.mjs'
import { G, sky, stars, motes, ground, overworld, skyline, podium, confetti, hud, burst, fireworks, coinRain, drawBot, hop } from './lib/world.mjs'
import { coin, icon, BOT_W, BOT_H, GEAR_ORDER, botShadow, block8, trophy, sparkle } from './lib/sprites.mjs'
import { hiLines, bigLines, segLines, highlightSegs, reveal, revealSegs, valueText } from './lib/text.mjs'

const dk = (col, k) => mix(col, '#000000', k)
const lt = (col, k) => mix(col, '#ffffff', k)
// 量化下落入场：p=0 不画，之后四档（上方 → 稍上 → 压下一格 → 落定）
const drop4 = (p, h) => [-h, -Math.round(h / 3), 1, 0][Math.min(3, Math.floor(p * 4))]
const walk = t => (Math.floor(t * 10) % 2 ? 'walkA' : 'walkB')

// 场标题：黑底双线牌子，左边一枚转动的金币。返回牌子下面可用区域的 y（px）
function heading(ctx, s, E, c, text, center = false, draw = true) {
  const g = G(E), S = g.S, a = E.L.box
  if (!text) return a.y
  const f = E.fit(text, { role: 'title', weight: 900, size: (g.P ? 60 : 58) * E.u, maxW: a.w - 22 * S, maxLines: 2, oneLine: true })
  const cw = Math.ceil(f.width / S) + 20, ch = Math.ceil(f.lines.length * f.lineH / S) + 6, p = s.p(0)
  if (draw && p > 0) {
    const V = screenView(E), x0 = Math.round(center ? g.cx - cw / 2 : g.bx), y0 = Math.round(g.by) + drop4(p, 6)
    panel(ctx, V, x0, y0, cw, ch, { fill: c.card, line: c.line, line2: c.bg })
    V.img(ctx, coin(Math.floor(E.T * 6)), x0 + 5, Math.round(y0 + ch / 2 - 5))
    hiLines(ctx, E, f, (x0 + 16) * S, (y0 + 3) * S, c.fg, { role: 'title', weight: 900, shadow: false, outline: false })
  }
  return a.y + (ch + 5) * S
}
// RPG 对话框的尖角：从面板下沿 (x, y) 往下，dir 往哪边斜
function tail(ctx, V, x, y, dir, fill, line) {
  for (let j = -2; j < 6; j++) {
    const w = Math.min(7, 7 - j), xx = x + dir * Math.max(0, j)
    if (j >= 0) V.r(ctx, xx - 1, y + j, w + 2, 1, line)
    V.r(ctx, xx, y + j, w, 1, fill)
  }
}
// 悬浮台（主角站在上面）：深色台面、亮边，底下三个喷口火苗一闪一闪
function hoverPad(ctx, V, x, y, w, c, t) {
  V.r(ctx, x + 1, y, w - 2, 6, PAL.ink); V.r(ctx, x, y + 1, w, 4, PAL.ink)
  V.r(ctx, x + 1, y + 1, w - 2, 1, lt(c.muted, 0.4)); V.r(ctx, x + 1, y + 2, w - 2, 3, dk(c.muted, 0.5))
  for (let k = 0; k < 3; k++) {
    const fx = Math.round(x + w * (k + 0.5) / 3) - 2, f = (Math.floor(t * 12) + k) % 3
    V.r(ctx, fx, y + 6, 4, 2 + f, PAL.orange); V.r(ctx, fx + 1, y + 6, 2, 1 + f, c.accent)
  }
}
// 一摞圆角块的柱子：从 gy 往上 h 格，宽 w 格
function blockTower(ctx, V, x, gy, w, h, pal) {
  const S = V.S, img = block8(pal)
  ctx.save(); ctx.beginPath(); ctx.rect(x * S, (gy - h) * S, w * S, h * S); ctx.clip()
  for (let yy = gy - 8; yy > gy - h - 8; yy -= 8) for (let xx = x; xx < x + w; xx += 8) V.img(ctx, img, xx, yy)
  ctx.restore()
}
// 星空关底：紫色底、两层视差星、上漂光点
function starfield(ctx, E, g, t, base) {
  const SV = screenView(E)
  SV.r(ctx, 0, 0, g.LW, g.LH, base)
  for (let y = 0; y < g.LH; y += 8) SV.r(ctx, 0, y, g.LW, 1, lt(base, 0.05))
  stars(ctx, SV, t, g.LW, g.LH, 50, 3, [PAL.white, '#7c6cdc', '#7c6cdc', '#3c2c8c', null], 1)
  stars(ctx, SV, t, g.LW, g.LH, 18, 9, [PAL.white, '#b8a8fc', PAL.white, '#7c6cdc'], 4, 2)
  motes(ctx, SV, t, g.LW, 0, g.LH, g.P ? 14 : 18, ['#5c4cbc', '#9c8cfc', '#5c4cbc'], 7)
  return SV
}

export default {
  name: '街机关卡', mood: '8-bit 像素游戏，轻松向，讲步骤、比高低、产品介绍都行', bpm: 140,
  c: { bg: '#2aa6a8', fg: '#fcfcfc', muted: '#bcbcbc', accent: '#fcd800', accent2: '#e8386c', card: '#000000', line: '#fcfcfc', onAccent: '#101018' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'mono', wTitle: 900, wBody: 700, radius: 0,
  motion: 'pop', solidAccent: true,
  music: { style: 'drive', prog: ['C', 'G', 'Am', 'F'], lead: 'marimba', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'chime' },

  // 像素马赛克转场：上一场的格子 1→2→4→8→16 倍放大，过半换成这一场，再一档档缩回原样
  transitionDur: 0.5,
  transition(ctx, A, B, p, E) {
    const q = p < 0.5 ? p * 2 : (1 - p) * 2, lv = Math.round(q * 4), src = p < 0.5 ? A : B
    if (lv === 0) { ctx.drawImage(src, 0, 0); return }
    const b = cellOf(E) << lv, sw = Math.ceil(E.W / b), sh = Math.ceil(E.H / b)
    const small = E.once(`mosaic:${sw}x${sh}`, () => E.createCanvas(sw, sh)), sx = small.getContext('2d')
    sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high'
    sx.clearRect(0, 0, sw, sh); sx.drawImage(src, 0, 0, sw, sh)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, sw * b, sh * b)
  },

  bg(ctx, E) { ctx.fillStyle = this.c.bg; ctx.fillRect(0, 0, E.W, E.H) },

  layouts: {
    // 标题画面：白天外景卷轴，红色招牌上是像素大标题，主角在地面上跑着吃金币
    title(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, a = E.L.box, P = g.P, t = s.t
      const speed = 14, sx = t * speed
      overworld(ctx, E, g, sx, { sky: c.bg, gy: g.GY, drift: t * 3 })
      const SV = screenView(E)
      const k = P ? 3 : 2, bw = BOT_W * k, bh = BOT_H * k, bx = Math.round(g.bx + 4), by = g.GY - bh
      let hgt = 0
      for (let i = 0; i < 14; i++) {
        const ti = 0.9 + i * 1.3, cx = Math.round(bx + bw / 2 + speed * ti) - Math.round(sx), cy = by + Math.round(bh * 0.35)
        hgt = Math.max(hgt, hop(t, ti - 0.22, 0.44))
        if (t < ti) { if (cx > -10 && cx < g.LW + 10) SV.img(ctx, coin(Math.floor(t * 8) + i), cx - 4, cy - 5) }
        else burst(ctx, SV, t, ti, cx, cy - 6, [c.accent, PAL.white], 10, 50, 0.45, i + 1)
      }
      drawBot(ctx, SV, t, bx, by - Math.round(hgt * 8), k, { pose: hgt > 0 ? 'jump' : walk(t) })
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: (P ? 124 : 136) * E.u, maxW: a.w * 0.8, maxLines: 3, lineGap: 1.16, oneLine: true })
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 800, size: 54 * E.u, maxW: a.w * 0.9, maxLines: 2 }) : null
      const kick = sc.kicker ? E.fit(sc.kicker, { role: 'body', weight: 800, size: 40 * E.u, maxW: a.w * 0.7, maxLines: 1 }) : null
      const plW = Math.ceil(big.width / S) + 28, plH = Math.ceil(big.lines.length * big.lineH / S) + 12
      const kH = kick ? Math.ceil(kick.lineH / S) + 6 : 0, sH = sub ? Math.ceil(sub.lines.length * sub.lineH / S) : 0
      const top = g.by, bot = g.GY - bh - 6
      let total = (kick ? kH - 3 : 0) + plH + (sub ? 5 + sH : 0)
      const push = bot - top - total >= 18
      if (push) total += 13
      let y = Math.round(top + Math.max(0, (bot - top - total) / 2)), i = 0
      const pk = kick ? s.p(i++) : 0, pt = s.p(i++), ps = sub ? s.p(i++) : 0
      const ky = y
      if (kick) y += kH - 3
      // 招牌：切角的卡带标签，上沿一道亮条、下沿暗条，两头各一颗星
      if (pt > 0) {
        const x0 = Math.round(g.cx - plW / 2), y0 = y + drop4(pt, 24), col = c.accent2
        const slab = (dx, dy, w, h, f) => { SV.r(ctx, dx + 2, dy, w - 4, h, f); SV.r(ctx, dx + 1, dy + 1, w - 2, h - 2, f); SV.r(ctx, dx, dy + 2, w, h - 4, f) }
        slab(x0 + 2, y0 + 2, plW, plH, PAL.ink); slab(x0, y0, plW, plH, PAL.ink); slab(x0 + 1, y0 + 1, plW - 2, plH - 2, col)
        SV.r(ctx, x0 + 3, y0 + 2, plW - 6, 1, lt(col, 0.5)); SV.r(ctx, x0 + 3, y0 + 4, plW - 6, 1, lt(col, 0.25))
        SV.r(ctx, x0 + 3, y0 + plH - 3, plW - 6, 1, dk(col, 0.45))
        for (const sx of [x0 + 4, x0 + plW - 11]) SV.img(ctx, icon('star'), sx, Math.round(y0 + plH / 2 - 3))
        bigLines(ctx, E, big, g.cx * S, (y0 + 6) * S, c.fg, { align: 'center', sd: 2 })
      }
      if (kick && pk > 0) {
        const kw = Math.ceil(kick.width / S) + 10, x0 = Math.round(g.cx - kw / 2), y0 = ky + drop4(pk, 6)
        panel(ctx, SV, x0, y0, kw, kH, { fill: c.card, line: c.accent, double: false })
        hiLines(ctx, E, kick, g.cx * S, (y0 + 3) * S, c.accent, { align: 'center', shadow: false, outline: false })
      }
      y += plH
      if (sub && ps > 0) hiLines(ctx, E, sub, g.cx * S, (y + 5 + [4, 2, 0, 0][Math.min(3, Math.floor(ps * 4))]) * S, c.fg, { align: 'center' })
      if (sub) y += 5 + sH
      if (push && s.p(i - 1) >= 1 && Math.floor(t * 3) % 3 !== 2) ptext(ctx, SV, '▶ PUSH START', g.cx, y + 6, 1, c.fg, { align: 'center', shadow: PAL.ink })
    },

    // 一句话：黄昏城市关，消息框里逐字打出像素大字，高亮词是金币黄；主角站在框下面
    statement(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, P = g.P, t = s.t
      const SV = screenView(E)
      sky(ctx, SV, g.LW, g.LH, [dk(c.bg, 0.86), mix(dk(c.bg, 0.7), '#3c1c6c', 0.5), mix(dk(c.bg, 0.4), '#9c3c9c', 0.55), mix('#fc8c5c', c.bg, 0.15)])
      stars(ctx, SV, t, g.LW, Math.round(g.LH * 0.4), 40, 1, [PAL.white, lt(c.bg, 0.3), null, null], 6)
      const VF = view(E, { cx: g.LW / 2 + t * 2, cy: g.LH / 2 }), VB = view(E, { cx: g.LW / 2 + t * 4, cy: g.LH / 2 })
      skyline(ctx, VF, g.GY - 10, VF.x0 - 30, VF.x1 + 30, mix(dk(c.bg, 0.55), '#5c3c8c', 0.5), mix(c.accent, '#5c3c8c', 0.55), t, 7)
      skyline(ctx, VB, g.GY, VB.x0 - 30, VB.x1 + 30, mix(dk(c.bg, 0.78), '#1c0c2c', 0.4), mix(c.accent, PAL.orange, 0.4), t)
      ground(ctx, SV, g.GY, 0, g.LW, { B: '#6c6c7c', H: '#a8a8bc', K: '#202028' })
      const k = P ? 3 : 2, bw = BOT_W * k, bh = BOT_H * k, pad = P ? 7 : 8, sideW = P ? 0 : bw + 10
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: (P ? 96 : 104) * E.u, maxW: (g.bw - 2 * sideW - 2 * pad) * S, maxLines: P ? 6 : 3, lineGap: 1.34 })
      const pw = Math.ceil(f.width / S) + pad * 2, ph = Math.ceil(f.lines.length * f.lineH / S) + pad * 2 - 2
      const rTop = g.by, rBot = P ? g.GY - bh - 16 : g.GY - 4
      // 竖屏：框贴着主角头顶（尖角指向它）；横屏：框在内容区竖直居中，主角在左下
      const x0 = Math.round(g.cx - pw / 2), y0 = Math.round(P ? Math.max(rTop, rBot - ph) : rTop + Math.max(0, (rBot - rTop - ph) / 2))
      const bx = P ? Math.round(g.cx - bw / 2) : Math.round(g.bx + 2), by = g.GY - bh, p = s.p(0)
      const jump = hop(t, s.cue(0) + 0.3, 0.4)
      drawBot(ctx, SV, t, bx, by - Math.round(jump * 10), k, { pose: jump > 0 ? 'jump' : 'stand' })
      if (p >= 1 && (t - s.cue(0) > 1 || blink(t, 6))) ptext(ctx, SV, '!', P ? bx + bw + 6 : bx + bw / 2, by - Math.round(jump * 10) - (P ? -2 : 18), 2, c.accent, { align: 'center', outline: PAL.ink })
      if (p <= 0) return
      const open = Math.max(1 / 3, step(p * 1.5, 3)), hh = Math.max(4, Math.round(ph * open)), yy = y0 + Math.round((ph - hh) / 2)
      panel(ctx, SV, x0, yy, pw, hh, { fill: c.card, line: c.line, line2: c.bg })
      if (open < 1) return
      if (P) tail(ctx, SV, Math.round(g.cx - 3), y0 + ph, 0, c.card, c.line)
      else tail(ctx, SV, x0 + 6, y0 + ph, -1, c.card, c.line)
      const segs = highlightSegs(f.lines, sc.highlight ? String(sc.highlight) : '', c.fg, c.accent)
      const total = [...f.lines.join('')].length, n = (t - s.cue(0) - 0.2) * Math.max(18, total / 0.9)
      segLines(ctx, E, f, g.cx * S, (y0 + pad - 1) * S, revealSegs(segs, n))
      if (n >= total && blink(t, 3)) ptext(ctx, SV, '▼', x0 + pw - 10, y0 + ph - 11, 1, c.fg)
    },

    // 要点：星空装备栏。每条是一格装备，进来时图标落进格子，同一件装备落到主角身上
    bullets(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, P = g.P, t = s.t, n = sc.items.length
      const SV = starfield(ctx, E, g, t, mix('#140c34', c.bg, 0.12))
      const topC = heading(ctx, s, E, c, sc.title) / S
      const k = 3, bw = BOT_W * k, bh = BOT_H * k, by = g.GY - 4 - bh
      const zone = P ? 0 : bw + 26, bx = Math.round(P ? g.cx - bw / 2 : g.br - bw - 6)
      const regB = P ? by - 14 : g.GY - 2, pad = 4
      const mx = Math.round(g.bx), mw = Math.round(g.bw - zone), rowH = Math.min(P ? 30 : 26, (regB - topC - pad * 2) / n)
      const mh = Math.round(rowH * n + pad * 2), my = Math.round(topC + Math.max(0, (regB - topC - mh) / 2))
      panel(ctx, SV, mx, my, mw, mh, { fill: c.card, line: c.line, line2: c.bg })
      const size = Math.min((P ? 48 : 52) * E.u, rowH * S * 0.42)
      let cur = -1
      sc.items.forEach((it, i) => {
        const p = s.p(i + 1), cy = my + pad + rowH * i + rowH / 2, slot = 16, sx = mx + 11, sy = Math.round(cy - slot / 2), tx = sx + slot + 5
        const f = E.fit(it, { role: 'body', weight: 800, size, maxW: (mx + mw - 5 - tx) * S, maxLines: 2, maxH: rowH * S * 0.92 })
        if (p <= 0) { SV.box(ctx, sx, sy, slot, slot, dk(c.line, 0.55), 1, 2, Math.floor(t * 8)); return }
        cur = i
        SV.r(ctx, sx, sy, slot, slot, p < 1 && blink(t, 12) ? c.bg : dk(c.bg, 0.65))
        SV.box(ctx, sx, sy, slot, slot, c.accent, 1)
        SV.img(ctx, icon(GEAR_ORDER[i % 6]), sx + 2, sy + 2 + drop4(p, 6))
        burst(ctx, SV, t, s.cue(i + 1), sx + slot / 2, sy + slot / 2, [c.accent, PAL.white], 10, 50, 0.4, i + 1)
        hiLines(ctx, E, f, (tx + [-8, -3, 0][Math.min(2, Math.floor(p * 3))]) * S, cy * S - f.lines.length * f.lineH / 2, c.fg, { shadow: false, outline: false })
      })
      if (cur >= 0 && blink(t, 3)) ptext(ctx, SV, '▶', mx + 5, my + pad + rowH * cur + rowH / 2, 1, c.accent, { valign: 'middle' })
      const ids = GEAR_ORDER.slice(0, n), gearIn = {}
      ids.forEach((id, i) => { gearIn[id] = s.p(i + 1) })
      const all = s.p(n) >= 1, j = all ? hop(t % 1.4, 0.2, 0.4) : 0
      hoverPad(ctx, SV, bx - 8, by + bh, bw + 16, c, t)
      drawBot(ctx, SV, t, bx, by - Math.round(j * 8), k, { pose: j > 0 ? 'jump' : 'stand', gear: ids, gearIn, glow: all })
    },

    // 大数字：奖励关。调色板循环的同心方环，记分牌里的点阵数字从 0 跳到目标值，跳完金币雨和烟花
    number(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, a = E.L.box, P = g.P, t = s.t
      const SV = screenView(E), vs = String(sc.value)
      const lab = sc.label ? E.fit(sc.label, { role: 'body', weight: 800, size: (P ? 54 : 58) * E.u, maxW: a.w * 0.9, maxLines: 2 }) : null
      const note = sc.note ? E.fit(sc.note, { role: 'body', weight: 700, size: 38 * E.u, maxW: a.w * 0.86, maxLines: 2 }) : null
      const labH = lab ? Math.ceil(lab.lines.length * lab.lineH / S) + 5 : 0, noteH = note ? Math.ceil(note.lines.length * note.lineH / S) + 3 : 0
      const pad = 7, availH = g.bb - g.by - labH - noteH - 2 * pad - 4
      let u0 = Math.min(8, Math.floor(availH / 7)), wNum = 0, wUnit = 0, uf = null
      for (; u0 >= 2; u0--) {
        wNum = valueText(ctx, E, vs, 0, 0, u0, '#fff', { measure: true })
        uf = sc.unit ? E.fit(sc.unit, { role: 'title', weight: 900, size: 7 * u0 * S * 0.44, maxW: a.w * 0.4, maxLines: 1, silent: true }) : null
        wUnit = uf ? uf.width + 4 * S : 0
        if (wNum + wUnit + (2 * pad + 4) * S <= a.w) break
      }
      // 最小的点阵也放不下：交给 E.fit 量一次，放不下会记进报告
      if (u0 < 2) { u0 = 2; E.fit(vs + (sc.unit || ''), { role: 'title', weight: 900, size: 14 * S, maxW: a.w - (2 * pad + 4) * S, maxLines: 1 }) }
      if (sc.unit) uf = E.fit(sc.unit, { role: 'title', weight: 900, size: 7 * u0 * S * 0.44, maxW: a.w * 0.4, maxLines: 1 })
      const pw = Math.ceil((wNum + wUnit) / S) + 2 * pad + 4, ph = 7 * u0 + 2 * pad
      const y0 = Math.round(g.by + Math.max(0, (g.bb - g.by - ph - labH - noteH) / 2)), x0 = Math.round(g.cx - pw / 2), cyC = y0 + ph / 2
      // 调色板循环：同心方环每 0.1 秒往外挪一档颜色
      const CYC = [0.9, 0.8, 0.66, 0.5, 0.66, 0.8].map(q => dk(c.bg, q)), sh = Math.floor(t / 0.1)
      for (let r = Math.ceil(Math.max(g.LW, g.LH) / 6) + 2; r >= 0; r--) SV.r(ctx, g.cx - r * 6 - 3, cyC - r * 6 - 3, r * 12 + 6, r * 12 + 6, CYC[((r - sh) % 6 + 6) % 6])
      stars(ctx, SV, t, g.LW, g.LH, 30, 4, [PAL.white, lt(c.bg, 0.4), null], 3)
      const roll = Math.min(1.4, s.dur * 0.35), prog = clamp((t - s.cue(0)) / roll), tDone = s.cue(0) + roll
      const cols = [c.accent, PAL.white, PAL.pink, PAL.cyan]
      // 金币雨只下在记分牌两侧，不压字
      for (const [cx0, cx1] of [[0, x0 - 4], [x0 + pw + 4, g.LW]]) {
        if (cx1 - cx0 < 20) continue
        ctx.save(); ctx.beginPath(); ctx.rect(cx0 * S, 0, (cx1 - cx0) * S, E.H); ctx.clip()
        coinRain(ctx, view(E, { cx: g.LW / 2 - cx0, cy: g.LH / 2 }), t, tDone, cx1 - cx0, g.LH, Math.max(4, Math.round((cx1 - cx0) / 10)), 1.4, 2, 5 + cx0, g.by - 6)
        ctx.restore()
      }
      fireworks(ctx, SV, t, tDone, P ? [[40, y0 - 10, 0], [140, y0 - 16, 0.12], [90, y0 + ph + 30, 0.25]] : [[x0 - 20, y0 + 10, 0], [x0 + pw + 20, y0 + 6, 0.12], [g.cx, y0 - 8, 0.25]], cols)
      const p0 = s.p(0)
      if (p0 > 0) {
        const open = Math.max(1 / 3, step(p0 * 1.5, 3)), hh = Math.max(4, Math.round(ph * open))
        panel(ctx, SV, x0, y0 + Math.round((ph - hh) / 2), pw, hh, { fill: c.card, line: c.line, line2: c.accent })
        if (open >= 1) {
          if (x0 - 34 > 0) for (const [xx, ff] of [[x0 - 30, 0], [x0 + pw + 6, 2]]) SV.img(ctx, coin(Math.floor(t * 8) + ff), xx, Math.round(cyC - 15), 3)
          const xL = g.cx * S - (wNum + wUnit) / 2, hot = t >= tDone && t < tDone + 0.3 && blink(t, 16)
          valueText(ctx, E, rolling(vs, prog), xL + wNum, cyC * S, u0, hot ? c.fg : c.accent, { align: 'right', shadow: dk(c.accent, 0.62), sd: Math.max(1, Math.round(u0 / 3)) })
          if (uf) bigLines(ctx, E, uf, xL + wNum + 4 * S, cyC * S + 3.5 * u0 * S - uf.lineH, c.fg, { align: 'left', sd: 1 })
          burst(ctx, SV, t, tDone, g.cx, cyC, [c.accent, PAL.white, PAL.orange], 18, 80, 0.6, 2)
        }
      }
      let y = (y0 + ph + 5) * S, i = 1
      if (lab) { const p = s.p(i++); if (p > 0) hiLines(ctx, E, lab, g.cx * S, y + [4, 2, 0, 0][Math.min(3, Math.floor(p * 4))] * S, c.fg, { align: 'center' }); y += (labH - 2) * S }
      if (note) { const p = s.p(i++); if (p > 0) hiLines(ctx, E, note, g.cx * S, y + [4, 2, 0, 0][Math.min(3, Math.floor(p * 4))] * S, c.muted, { align: 'center', weight: 700 }) }
    },

    // 柱状图：横屏是一排方块塔，一层一层长高，最高（或指定）的那座是金块，主角站在旁边跳；竖屏是 RPG 状态栏里的血条
    bars(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, P = g.P, t = s.t, n = sc.items.length
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || ''
      const ep = i => E.ease.out(s.p(i + 1))
      if (!P) {
        const gy = Math.floor(g.bb - 17)
        overworld(ctx, E, g, t * 4, { sky: c.bg, gy, hills: false, drift: t * 2 })
        const SV = screenView(E), topC = heading(ctx, s, E, c, sc.title) / S
        const slot = g.bw / n, uV = slot >= 40 ? 2 : 1, valC = 7 * uV + 5, hMax = gy - topC - valC - 3
        const bwC = Math.max(8, Math.min(40, Math.floor(slot * 0.56 / 4) * 4))
        const stone = { B: dk(c.muted, 0.38), H: c.muted, K: dk(c.muted, 0.82) }, gold = { B: c.accent, H: lt(c.accent, 0.6), K: dk(c.accent, 0.6) }
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), x = Math.round(g.bx + slot * i + (slot - bwC) / 2), cxP = (x + bwC / 2) * S
          const full = Math.max(2, Math.round(hMax * vals[i] / max)), h = p >= 1 ? full : Math.round(full * ep(i) / 4) * 4
          const lf = E.fit(it.label, { role: 'body', weight: 800, size: 38 * E.u, maxW: slot * S * 0.94, maxLines: 2, maxH: (g.bb - gy - 2) * S })
          if (p <= 0) return
          if (h > 0) {
            blockTower(ctx, SV, x, gy, bwC, h, i === hi ? gold : stone)
            SV.box(ctx, x - 1, gy - h - 1, bwC + 2, h + 1, PAL.ink)
          }
          const top = gy - h
          // 主角站在金砖塔旁边的地上，塔长完时跳一下（最后一根就站左边）
          if (i === hi && p >= 1) {
            const land = hop(t, s.cue(i + 1) + 0.36, 0.4)
            drawBot(ctx, SV, t, i === n - 1 ? x - 19 : x + bwC + 3, gy - 18 - Math.round(land * 10), 1, { pose: land > 0 ? 'jump' : 'stand', flip: i === n - 1 })
          }
          const uI = valueText(ctx, E, formatNumber(vals[i], dec) + unit, 0, 0, uV, '#fff', { measure: true }) <= slot * S * 0.94 ? uV : 1
          valueText(ctx, E, formatNumber(vals[i] * ep(i), dec) + unit, cxP, (top - 3 - 3.5 * uI) * S, uI, i === hi ? c.accent : c.fg, { align: 'center', shadow: PAL.ink, outline: PAL.ink })
          hiLines(ctx, E, lf, cxP, (gy + 2) * S, c.fg, { align: 'center' })
        })
      } else {
        overworld(ctx, E, g, t * 4, { sky: c.bg, gy: g.GY, drift: t * 2 })
        const SV = screenView(E), topC = Math.round(heading(ctx, s, E, c, sc.title) / S)
        const pad = 6, rowH = Math.min(34, (g.GY - 6 - topC - 2 * pad) / n), ph = Math.round(rowH * n + 2 * pad), px0 = Math.round(g.bx), pw = Math.round(g.bw)
        panel(ctx, SV, px0, topC, pw, ph, { fill: c.card, line: c.line, line2: c.bg })
        sc.items.forEach((it, i) => {
          const p = s.p(i + 1), ry = topC + pad + rowH * i + 2, val = formatNumber(vals[i] * ep(i), dec) + unit, col = i === hi ? c.accent : c.fg
          const vw = valueText(ctx, E, formatNumber(vals[i], dec) + unit, 0, 0, 1, col, { measure: true })
          const lf = E.fit(it.label, { role: 'body', weight: 800, size: 40 * E.u, maxW: (pw - 2 * pad - 14) * S - vw - 4 * S, maxLines: 1 })
          const lh = Math.ceil(lf.lineH / S), bxs = px0 + pad + 12, bwS = px0 + pw - pad - 2 - bxs, nSeg = Math.floor(bwS / 4)
          if (p <= 0) return
          SV.img(ctx, icon('heart', { R: i === hi ? c.accent : c.accent2 }), px0 + pad + 1, ry + Math.round(lh / 2 - 3.5))
          hiLines(ctx, E, lf, bxs * S, ry * S, c.fg, { shadow: false, outline: false })
          valueText(ctx, E, val, (px0 + pw - pad - 2) * S, (ry + lh / 2) * S, 1, col, { align: 'right' })
          const yb = ry + lh + 2, filled = Math.round(nSeg * vals[i] / max * ep(i))
          SV.r(ctx, bxs - 1, yb - 1, nSeg * 4 + 1, 8, c.line)
          for (let k = 0; k < nSeg; k++) SV.r(ctx, bxs + k * 4, yb, 3, 6, k < filled ? (i === hi ? c.accent : c.accent2) : dk(c.muted, 0.75))
        })
        const room = g.GY - (topC + ph)
        if (room >= 44) drawBot(ctx, SV, t, Math.round(g.br - 40), g.GY - 36, 2, { pose: walk(t), flip: true })
      }
    },

    // 步骤：海上世界地图。每一步是一座岛，没到的岛上锁；主角沿虚线路一站站走过去，岛下面是这一步的字
    steps(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, P = g.P, t = s.t, n = sc.items.length
      const SV = screenView(E), sea = mix(c.bg, '#0040d0', 0.55), seaHi = lt(sea, 0.3), ph = Math.floor(t * 8)
      SV.r(ctx, 0, 0, g.LW, g.LH, sea)
      for (let j = 0, y = 2; y < g.LH; y += 10, j++) for (let x = -24; x < g.LW + 24; x += 24) { const xx = x + (j % 2 ? 12 : 0) + (ph % 12); SV.r(ctx, xx, y, 6, 1, seaHi); SV.r(ctx, xx + 6, y + 1, 4, 1, seaHi) }
      const topC = heading(ctx, s, E, c, sc.title) / S, regH = g.GY - 4 - topC
      const I = []
      let fs
      if (!P) {
        // 横屏：岛一排，字在岛下面；岛和字整组在标题下面竖直居中
        const slot = g.bw / n, r = Math.round(Math.min(22, slot / 2 - 7)), tw = Math.round(slot - 6)
        fs = sc.items.map(it => E.fit(it, { role: 'body', weight: 800, size: 46 * E.u, maxW: (tw - 8) * S, maxLines: 3, maxH: (regH - 2 * r - 22) * S }))
        const thMax = Math.max(...fs.map(f => Math.ceil(f.lines.length * f.lineH / S) + 6)), off = Math.max(0, (regH - (2 * r + 11 + thMax)) / 2)
        for (let i = 0; i < n; i++) I.push({ x: Math.round(g.bx + slot * (i + 0.5)), y: Math.round(topC + off + r + 3), r, tw })
      } else {
        const rowH = regH / n, r = Math.round(Math.min(18, rowH / 2 - 4)), tw = Math.round(g.br - (g.bx + 2 * r + 22))
        fs = sc.items.map(it => E.fit(it, { role: 'body', weight: 800, size: 46 * E.u, maxW: (tw - 8) * S, maxLines: 2, maxH: rowH * S * 0.8 }))
        for (let i = 0; i < n; i++) I.push({ x: Math.round(g.bx + r + 4 + (i % 2) * 10), y: Math.round(topC + rowH * (i + 0.5)), r, tw })
      }
      let cur = -1
      for (let i = 0; i < n; i++) if (s.p(i + 1) > 0) cur = i
      for (let i = 0; i + 1 < n; i++) {
        const q = step(s.p(i + 2) * 1.3, 6)
        if (q > 0) SV.line(ctx, I[i].x, I[i].y, I[i].x + (I[i + 1].x - I[i].x) * q, I[i].y + (I[i + 1].y - I[i].y) * q, PAL.white, 2, 3, -ph)
      }
      const unitN = I[0].r >= 20 ? 3 : 2
      I.forEach((o, i) => {
        const p = s.p(i + 1), on = p > 0, here = i === cur, r = on ? Math.round(o.r * Math.min(1, popQ(p))) : o.r, y = o.y - (here && blink(t, 2) ? 1 : 0)
        SV.disc(ctx, o.x, y + 3, r + 3, dk(sea, 0.4))
        SV.disc(ctx, o.x, y, r + 2, on ? PAL.sand : dk(c.muted, 0.35))
        SV.disc(ctx, o.x, y - 1, r - 1, on ? (here ? PAL.greenHi : PAL.green) : dk(c.muted, 0.55))
        SV.disc(ctx, o.x - Math.round(r * 0.3), y - Math.round(r * 0.35), Math.round(r * 0.35), on ? (here ? '#c8fc48' : PAL.grassHi) : dk(c.muted, 0.45))
        if (!on) { SV.img(ctx, icon('lock'), o.x - 8, y - 9, 2); return }
        if (p >= 1) ptext(ctx, SV, String(i + 1), o.x + 4 + pwidth(String(i + 1), unitN) / 2, y - 1, unitN, c.fg, { align: 'center', valign: 'middle', outline: PAL.ink, shadow: PAL.ink })
        if (here) for (let k = 0; k < 4; k++) { const a = t * 3 + k * Math.PI / 2; SV.img(ctx, sparkle(ph + k), o.x + Math.round(Math.cos(a) * (o.r + 7)) - 2, y + Math.round(Math.sin(a) * (o.r * 0.6 + 5)) - 2) }
      })
      // 每一步的字：横屏在岛下面，竖屏在岛右边
      I.forEach((o, i) => {
        const p = s.p(i + 1), tw = o.tw, f = fs[i]
        if (p <= 0) return
        const th = Math.ceil(f.lines.length * f.lineH / S) + 6, x0 = P ? Math.round(g.br - tw) : Math.round(o.x - tw / 2), y0 = (P ? Math.round(o.y - th / 2) : o.y + o.r + 6) + drop4(p, 4)
        panel(ctx, SV, x0, y0, tw, th, { fill: c.card, line: i === cur ? c.accent : c.line, double: false })
        hiLines(ctx, E, f, (x0 + tw / 2) * S, (y0 + 3) * S, c.fg, { align: 'center', shadow: false, outline: false })
      })
      if (cur >= 0) {
        const p = s.p(cur + 1), q = cur > 0 ? step(p, 8) : 1, A = I[Math.max(0, cur - 1)], B = I[cur]
        const x = Math.round(A.x + (B.x - A.x) * q) - 14, y = Math.round(A.y + (B.y - A.y) * q) - 17
        drawBot(ctx, SV, t, x, y, 1, { pose: q < 1 ? walk(t) : 'stand', flip: P && B.x < A.x })
      }
    },

    // 对比：1P 对 2P 的选人画面。左蓝右红，两张卡片中间是 VS 和对峙的两个主角；右边（推荐的一方）金框、主角全身装备
    compare(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, P = g.P, t = s.t
      const SV = screenView(E), blueH = dk(mix(c.bg, '#2020c0', 0.5), 0.55), redH = dk(c.accent2, 0.5), ph = Math.floor(t * 30) % 12
      const topC = Math.round(heading(ctx, s, E, c, sc.title, true, false) / S), gap = P ? 30 : 72
      const pw = P ? Math.round(g.bw) : Math.floor((g.bw - gap) / 2), pH = P ? Math.floor((g.GY - 3 - topC - gap) / 2) : g.GY - 3 - topC
      const boxes = P ? [[Math.round(g.bx), topC], [Math.round(g.bx), topC + pH + gap]] : [[Math.round(g.bx), topC], [Math.round(g.br - pw), topC]]
      const midX = Math.round(g.cx), midY = topC + pH + Math.round(gap / 2)
      // 两个主角在中间对峙：横屏在两张卡片之间、VS 下面（2 倍大），竖屏在两张卡片之间的带子里、VS 两边
      const kB = P ? 1 : 2, byB = P ? midY - 9 : topC + pH - 36
      const bots = P ? [midX - 40, midX + 24] : [midX - 35, midX + 3]
      const vy = P ? midY : Math.round((topC + byB - 24) / 2)
      // 底：两半 + 往外流的条纹 + 中间锯齿分界
      if (!P) {
        SV.r(ctx, 0, 0, midX, g.LH, blueH); SV.r(ctx, midX, 0, g.LW - midX, g.LH, redH)
        for (let y = 0, j = 0; y < g.GY; y += 12, j++) { for (let x = -24; x < midX; x += 24) SV.r(ctx, x + ph, y + (j % 2 ? 6 : 0), 8, 2, lt(blueH, 0.12)); for (let x = midX; x < g.LW + 24; x += 24) SV.r(ctx, x - ph, y + 6, 8, 2, lt(redH, 0.12)) }
        for (let y = Math.ceil(g.by / 8) * 8; y < byB - 32; y += 8) SV.r(ctx, midX - 2 + ((y / 8) % 2 ? 2 : -2), y, 4, 8, c.accent)
      } else {
        SV.r(ctx, 0, 0, g.LW, midY, blueH); SV.r(ctx, 0, midY, g.LW, g.LH - midY, redH)
        for (let x = 0, j = 0; x < g.LW; x += 12, j++) { for (let y = -24; y < midY; y += 24) SV.r(ctx, x, y + ph + (j % 2 ? 6 : 0), 2, 8, lt(blueH, 0.12)); for (let y = midY; y < g.LH + 24; y += 24) SV.r(ctx, x, y - ph, 2, 8, lt(redH, 0.12)) }
        for (let x = 0; x < g.LW; x += 8) SV.r(ctx, x, midY - 2 + ((x / 8) % 2 ? 2 : -2), 8, 4, c.accent)
      }
      ground(ctx, SV, g.GY, 0, g.LW, { B: '#3c3c5c', H: '#7c7c9c', K: '#0c0c2c' })
      heading(ctx, s, E, c, sc.title, true)
      ;[sc.left, sc.right].forEach((side, i) => {
        const p = s.p(i + 1), strong = i === 1, [bx0, y] = boxes[i], pad = 5, bX = bots[i]
        const x = bx0 + (p >= 1 ? 0 : [50, 24, 8, 0][Math.min(3, Math.floor(p * 4))] * (i ? 1 : -1)), tx = x + pad + 1, tw = pw - 2 * pad - 2
        const tf = E.fit(side.title, { role: 'title', weight: 900, size: 58 * E.u, maxW: tw * S, maxLines: 2, oneLine: true })
        const items = side.items || [], tH = Math.ceil(tf.lines.length * tf.lineH / S), iy = y + pad + tH + 4, rowH = Math.min(22, (y + pH - pad - iy) / Math.max(1, items.length))
        const fs = items.map(it => E.fit(it, { role: 'body', weight: 700, size: Math.min(50 * E.u, rowH * S * 0.46), maxW: (tw - 6) * S, maxLines: 2, maxH: rowH * S * 0.95 }))
        const tag = i ? '2P' : '1P', tagCol = i ? lt(c.accent2, 0.35) : lt(c.bg, 0.3)
        const tagAt = () => P ? ptext(ctx, SV, tag, i ? bX + 20 : bX - 4, byB + 9, 2, tagCol, { align: i ? 'left' : 'right', valign: 'middle', shadow: PAL.ink })
          : ptext(ctx, SV, tag, bX + 16, byB - (strong ? 24 : 17), 2, tagCol, { align: 'center', shadow: PAL.ink })
        if (p <= 0) {
          // 还没入场：虚线空位 + 黑影里一个问号（等对手上场）
          SV.box(ctx, bx0, y, pw, pH, i ? lt(redH, 0.3) : lt(blueH, 0.3), 1, 3, Math.floor(t * 8))
          SV.img(ctx, botShadow('stand', dk(i ? redH : blueH, 0.4)), bX, byB, kB, !!i)
          ptext(ctx, SV, '?', bX + 8 * kB, byB + 9 * kB, kB + 1, c.fg, { align: 'center', valign: 'middle', shadow: PAL.ink })
          return
        }
        panel(ctx, SV, x, y, pw, pH, { fill: mix(c.card, i ? redH : blueH, 0.3), line: strong ? c.accent : c.line, line2: strong ? c.accent2 : c.bg })
        drawBot(ctx, SV, t, bX, byB + drop4(p, 8), kB, { flip: !!i, gear: strong ? GEAR_ORDER.filter(id => id !== 'shield') : [], glow: strong && p >= 1 })
        tagAt()
        hiLines(ctx, E, tf, tx * S, (y + pad) * S, strong ? c.accent : c.fg, { role: 'title', weight: 900, shadow: false, outline: false })
        fs.forEach((f, k) => {
          const cy = iy + rowH * k + rowH / 2
          SV.r(ctx, tx, Math.round(cy - 2), 3, 3, strong ? c.accent : c.muted)
          hiLines(ctx, E, f, (tx + 6) * S, cy * S - f.lines.length * f.lineH / 2, c.fg, { weight: 700, shadow: false, outline: false })
        })
      })
      if (s.p(2) > 0) {
        const big = s.t - s.cue(2) < 0.08 ? 4 : 3
        ptext(ctx, SV, 'VS', midX, vy, big, c.accent, { align: 'center', valign: 'middle', outline: c.accent2, shadow: PAL.ink, sd: 2 })
        burst(ctx, SV, t, s.cue(2), midX, vy, [c.accent, PAL.white, PAL.orange], 18, 80, 0.6, 2)
      }
    },

    // 引语：地下关的 NPC 对话。左边头像框里是说话的角色，名字牌压在框上，引语逐字打出
    quote(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, P = g.P, t = s.t
      const SV = screenView(E), stonePal = { B: mix(c.bg, '#4c3c7c', 0.6), H: lt(c.bg, 0.2), K: PAL.ink }, img = block8(stonePal)
      SV.r(ctx, 0, 0, g.LW, g.LH, dk(c.bg, 0.9))
      const pil = Math.max(8, Math.floor((g.bx - 2) / 8) * 8), ceil = P ? 33 : 13
      for (let y = 0; y < g.GY; y += 8) for (let x = 0; x < pil; x += 8) { SV.img(ctx, img, x, y); SV.img(ctx, img, g.LW - pil + x, y) }
      // 天花板一排石块，挂几块往下垂的
      for (let x = pil; x < g.LW - pil; x += 8) { SV.img(ctx, img, x, ceil); if (((x - pil) / 8) % 7 === 3) SV.img(ctx, img, x, ceil + 8) }
      ground(ctx, SV, g.GY, 0, g.LW, stonePal)
      motes(ctx, SV, t, g.LW, g.by, g.GY, P ? 12 : 16, [dk(c.bg, 0.4), lt(c.bg, 0.3), dk(c.bg, 0.4)], 5)
      const pad = 6, frW = 58, frH = 64, tw = P ? g.bw - 2 * pad : g.bw - 2 * pad - frW - 5
      const f = E.fit(sc.text, { role: 'body', weight: 800, size: (P ? 64 : 72) * E.u, maxW: tw * S, maxLines: P ? 7 : 5, lineGap: 1.42 })
      const by = sc.by ? E.fit(sc.by, { role: 'body', weight: 800, size: 38 * E.u, maxW: (P ? g.bw - frW - 8 : tw - 10) * S, maxLines: 1 }) : null
      const tH = Math.ceil(f.lines.length * f.lineH / S), nameH = by ? Math.ceil(by.lineH / S) + 6 : 0
      const pH = P ? tH + 2 * pad : Math.max(frH, tH) + 2 * pad, totalH = P ? frH + 3 + pH : pH + (by ? nameH - 3 : 0)
      const y0 = Math.round(g.by + Math.max(0, (g.GY - 4 - g.by - totalH) / 2)), x0 = Math.round(g.bx), w0 = Math.round(g.bw)
      const panY = P ? y0 + frH + 3 : y0 + (by ? nameH - 3 : 0), frX = P ? x0 : x0 + pad, frY = P ? y0 : panY + Math.round((pH - frH) / 2)
      const p = s.p(0), total = [...f.lines.join('')].length, nT = (t - s.cue(0) - 0.25) * Math.max(20, total / 1.1), talking = p >= 1 && nT < total
      if (p > 0) {
        const open = Math.max(1 / 3, step(p * 1.5, 3)), hh = Math.max(4, Math.round(pH * open))
        panel(ctx, SV, x0, panY + Math.round((pH - hh) / 2), w0, hh, { fill: c.card, line: c.line, line2: c.bg })
        if (open >= 1) {
          const tx = P ? x0 + pad : x0 + pad + frW + 5
          hiLines(ctx, E, f, tx * S, (panY + pad + Math.round((pH - 2 * pad - tH) / 2)) * S, c.fg, { lines: reveal(f.lines, nT), shadow: false, outline: false })
          if (nT >= total && blink(t, 3)) ptext(ctx, SV, '▼', x0 + w0 - 10, panY + pH - 11, 1, c.fg)
        }
        panel(ctx, SV, frX, frY, frW, frH, { fill: dk(c.bg, 0.7), line: c.line, double: false })
        drawBot(ctx, SV, t, frX + 5, frY + 6 - (talking && blink(t, 6) ? 1 : 0), 3, { pal: { W: lt(c.accent2, 0.3), L: dk(c.accent2, 0.15), C: c.accent }, eyes: talking && blink(t, 1.5) ? 'hit' : 'ok' })
      }
      if (by && s.p(1) > 0) {
        const nw = Math.ceil(by.width / S) + 10, nx = P ? frX + frW + 3 : x0 + pad + frW + 5, ny = (P ? y0 + frH - nameH : y0) + drop4(s.p(1), 4)
        panel(ctx, SV, nx, ny, nw, nameH, { fill: c.card, line: c.accent, double: false })
        hiLines(ctx, E, by, (nx + 5) * S, (ny + 3) * S, c.accent, { shadow: false, outline: false })
      }
    },

    // 片尾：夜里的通关画面。领奖台从地里升起，三个机器人落到台上（冠军在中间、全身装备），旁边台座上的奖杯在闪；
    // 烟花、彩纸，STAGE CLEAR 下面是收束的话和一个选中的按钮。横屏领奖台在左下、奖杯在右下；竖屏两样并排在文字下面
    end(ctx, s, E) {
      useE(E)
      const c = this.c, g = G(E), S = g.S, sc = s.scene, a = E.L.box, P = g.P, t = s.t
      const SV = screenView(E)
      sky(ctx, SV, g.LW, g.LH, [dk(c.bg, 0.93), dk(c.bg, 0.86), dk(c.bg, 0.76)])
      stars(ctx, SV, t, g.LW, g.LH, 60, 2, [PAL.white, lt(c.bg, 0.4), dk(c.bg, 0.3), null], 1)
      stars(ctx, SV, t, g.LW, g.LH, 20, 6, [PAL.white, PAL.coinHi, PAL.white], 4, 2)
      const cols = [c.accent, PAL.white, PAL.pink, PAL.cyan], t0 = s.cue(0)
      for (let k = 0; k < 20; k++) { const tf = t0 + 0.4 + k * 0.6; if (tf > s.dur + 1) break; fireworks(ctx, SV, t, tf, [[Math.round(g.bx + ((k * 0.37 + 0.13) % 1) * g.bw), Math.round(g.by + 10 + ((k * 0.61) % 1) * (P ? 60 : 40)), 0]], cols, 2) }
      confetti(ctx, SV, t, t0 + 0.5, g.LW, g.GY, P ? 46 : 64, [c.accent, PAL.pink, PAL.cyan, PAL.white, c.accent2], 3)
      ground(ctx, SV, g.GY, 0, g.LW)
      const k = P ? 2 : 1, stW = P ? 34 : 22, hs = P ? [32, 25, 21] : [22, 16, 13], bw = BOT_W * k, bh = BOT_H * k
      const tW = 32, pedW = tW + 8, pedH = P ? 8 : 10, pedY = g.GY - pedH
      const podX = P ? Math.round(g.cx - (3 * stW + 8 + pedW) / 2) : Math.round(Math.max(6, g.bx - 12))
      const pedX = P ? podX + 3 * stW + 8 : Math.round(Math.min(g.LW - 6, g.br + 12) - pedW)
      const rise = step(clamp((t - t0) / 0.45), 5), tops = podium(ctx, SV, podX, g.GY, stW, hs, [c.accent, '#c8cce0', '#d0864c'], rise, k)
      // 台子升好以后三个机器人依次落下；冠军隔一会儿跳一下，二、三名换机身色、错开着小跳
      const pals = [{ W: lt(c.accent2, 0.35), L: dk(c.accent2, 0.1) }, null, { W: '#9ce0a8', L: '#4ca86c' }]
      for (let m = 0; m < 3 && rise >= 1; m++) {
        const pin = (t - t0 - 0.5 - m * 0.08) / 0.3, win = m === 1
        if (pin <= 0) continue
        const j = pin >= 1 ? hop((t - t0 + m * 0.37) % (win ? 1.1 : 1.6), 0.4, win ? 0.45 : 0.35) * (win ? 1 : 0.6) : 0
        const x = podX + m * stW + Math.round((stW - bw) / 2), y = tops[m] - bh + drop4(Math.min(1, pin), 10) - Math.round(j * 12)
        drawBot(ctx, SV, t, x, y, k, { pose: j > 0 ? 'jump' : 'stand', pal: pals[m], gear: win ? GEAR_ORDER.filter(id => id !== 'shield') : [], glow: win, flip: m === 2 })
      }
      // 奖杯：落到台座上，之后一上一下地晃、身边星光闪
      const pC = clamp((t - t0 - 0.2) / 0.36)
      if (pC > 0) {
        SV.r(ctx, pedX, pedY, pedW, pedH, PAL.ink); SV.r(ctx, pedX + 1, pedY + 1, pedW - 2, pedH - 1, '#3c3458'); SV.r(ctx, pedX + 1, pedY + 1, pedW - 2, 1, '#6c6488')
        const tx = pedX + 4, ty = pedY - tW + drop4(pC, 16) - (pC >= 1 && Math.floor(t * 2) % 2 ? 1 : 0)
        SV.img(ctx, trophy(c.accent), tx, ty, 2)
        if (pC >= 1) for (let m = 0; m < 3; m++) if (blink(t + m * 0.23, 3)) SV.img(ctx, sparkle(Math.floor(t * 6) + m), tx + [3, tW - 6, tW / 2 - 2][m], ty + [7, 3, -7][m])
      }
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: (P ? 112 : 120) * E.u, maxW: a.w * (P ? 0.84 : 0.7), maxLines: 3, lineGap: 1.2, oneLine: true })
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 800, size: 48 * E.u, maxW: a.w * (P ? 0.84 : 0.7), maxLines: 2 }) : null
      const cta = sc.cta ? E.fit(sc.cta, { role: 'body', weight: 900, size: 52 * E.u, maxW: a.w * 0.5, maxLines: 1 }) : null
      const bH = Math.ceil(big.lines.length * big.lineH / S), sH = sub ? Math.ceil(sub.lines.length * sub.lineH / S) + 4 : 0, cH = cta ? Math.ceil(cta.lineH / S) + 14 : 0
      const regB = P ? g.GY - Math.max(hs[0] + bh + 14, pedH + tW + 4) - 6 : g.GY - 4, total = 20 + bH + sH + cH
      let y = Math.round(g.by + Math.max(0, (regB - g.by - total) / 2)), i = 0
      const pT = s.p(i++)
      if (pT > 0) {
        if (t - s.cue(0) > 0.5 || blink(t, 8)) ptext(ctx, SV, 'STAGE CLEAR', g.cx, y, 2, c.accent, { align: 'center', shadow: PAL.ink, outline: PAL.ink })
        bigLines(ctx, E, big, g.cx * S, (y + 20 + drop4(pT, 16)) * S, c.fg, { align: 'center', sd: 2 })
      }
      y += 20 + bH
      if (sub) { const p = s.p(i++); if (p > 0) hiLines(ctx, E, sub, g.cx * S, (y + 4 + [4, 2, 0, 0][Math.min(3, Math.floor(p * 4))]) * S, c.fg, { align: 'center' }); y += sH }
      if (cta) {
        const p = s.p(i++), q = popQ(p)
        if (q > 0) {
          const bw = Math.round((Math.ceil(cta.width / S) + 16) * Math.min(1, q)), bh = Math.ceil(cta.lineH / S) + 6, x0 = Math.round(g.cx - bw / 2), y0 = y + 6
          SV.r(ctx, x0 + 2, y0 + 2, bw, bh, PAL.ink); SV.r(ctx, x0, y0, bw, bh, PAL.ink); SV.r(ctx, x0 + 1, y0 + 1, bw - 2, bh - 2, c.accent)
          SV.r(ctx, x0 + 1, y0 + 1, bw - 2, 1, lt(c.accent, 0.6)); SV.r(ctx, x0 + 1, y0 + bh - 2, bw - 2, 1, dk(c.accent, 0.45))
          if (q >= 1) {
            hiLines(ctx, E, cta, g.cx * S, (y0 + 3) * S, c.onAccent, { align: 'center', weight: 900, shadow: false, outline: false })
            if (blink(t, 3)) ptext(ctx, SV, '▶', x0 - 12, y0 + bh / 2, 2, c.fg, { valign: 'middle', shadow: PAL.ink })
          }
        }
      }
    },
  },

  // 字幕：RPG 对话框。一场的 say 按标点切段轮流显示，每段出来时框一格格展开，右下角 ▼ 闪
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const c = this.c, g = G(E), S = g.S, V = screenView(E)
    const chunks = captionChunks(say, g.P ? 16 : 28), lens = chunks.map(x => textUnits(x)), sum = lens.reduce((x, y) => x + y, 0)
    const span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = 0, t0 = 0
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / sum; idx = i; t0 = acc; if (s.t < acc + d) break; acc += d }
    const size = (g.P ? 44 : 40) * E.u
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'body', weight: 700, size, maxW: E.W - E.safe.l * 2 - 24 * S, maxLines: 2, quiet: true })
    const h = f.lines.length * f.lineH, cy = E.H - E.captionH / 2 - (g.P ? 30 * E.u : 0)
    const cw = Math.ceil(f.width / S) + 22, ch = Math.ceil(h / S) + 10, x0 = Math.round(g.cx - cw / 2), y0 = Math.round(cy / S - ch / 2)
    const open = Math.max(1 / 3, Math.min(1, Math.ceil(clamp((s.t - t0) / 0.12) * 3) / 3)), hh = Math.max(4, Math.round(ch * open))
    ctx.save(); ctx.globalAlpha = 0.94
    panel(ctx, V, x0, y0 + Math.round((ch - hh) / 2), cw, hh, { fill: c.card, line: c.line, line2: c.bg })
    ctx.restore()
    if (open < 1) return
    ctx.fillStyle = c.fg; ctx.font = E.font('body', 700, f.size)
    drawLines(ctx, f.lines, g.cx * S, (y0 + 5) * S + ((ch - 10) * S - h) / 2, f.lineH, 'center')
    if (blink(s.t, 3)) ptext(ctx, V, '▼', x0 + cw - 10, y0 + ch - 11, 1, c.fg)
  },

  // 最上层：很淡的扫描线和 HUD（1P、三颗心、SCORE、金币、关卡号）。分数和金币按入场的元素数涨，是游戏外壳，不是内容
  overlay(ctx, E, s) {
    const S = G(E).S
    ctx.fillStyle = 'rgba(0,0,0,0.07)'
    for (let y = Math.round(S * 0.67); y < E.H; y += S) ctx.fillRect(0, y, E.W, Math.max(1, Math.round(S / 3)))
    const cnt = Math.max(1, (COUNT[s.scene.layout] || (() => 1))(s.scene))
    let got = 0
    for (let i = 0; i < cnt; i++) if (s.t >= s.cue(i)) got++
    hud(ctx, E, { c: this.c, lives: 3, score: s.index * 1000 + got * 100, coins: s.index * 3 + got, stage: s.index === s.count - 1 ? 'GOAL' : `STAGE ${String(s.index + 1).padStart(2, '0')}` })
  },

  // 游戏音效：引擎已经给每个元素入场配了 pop、场和场之间配了 whoosh，这里只在吃金币、打字、装备落位、VS、通关这些时刻加，一场不超过三个。
  // 时刻和画面里的动画对齐：入场进度 p 在 cue 之后 0.36 秒走满（motion 'pop'），drop4 落定在 p=0.75
  sounds(TL) {
    const out = [], ED = 0.36
    for (const S of TL.scenes) {
      const at = (dt, kind, gain, pan = 0, seed = 1) => { if (dt >= 0 && dt < S.dur) out.push({ t: S.t0 + dt, kind, gain, pan, seed }) }
      const cue = i => S.cues[Math.min(i, S.cues.length - 1)], sc = S.scene, n = (sc.items || []).length
      switch (S.layout) {
        case 'title': for (let i = 0; i < 3; i++) at(0.9 + i * 1.3, 'tick', 0.34, -0.2); break                  // 主角吃到前三枚金币
        case 'statement': case 'quote': for (let i = 0; i < 3; i++) at(cue(0) + 0.3 + i * 0.12, 'type', 0.16, 0, i + 1); break   // 对话框开始打字
        case 'bullets': for (let i = 1; i < Math.min(n, 3); i++) at(cue(i) + ED * 0.75, 'click', 0.3); at(cue(n) + ED, 'chime', 0.24, 0.3); break   // 装备落位，最后一件装齐
        case 'number': { const done = cue(0) + Math.min(1.4, S.dur * 0.35); at(done, 'chime', 0.26); at(done + 0.3, 'tick', 0.3, -0.3); at(done + 0.55, 'tick', 0.3, 0.3); break }   // 分数跳完、金币雨
        case 'bars': { const v = sc.items.map(it => Number(it.value)), hi = sc.highlight != null ? Number(sc.highlight) - 1 : v.indexOf(Math.max(...v)); at(cue(hi + 1) + ED, 'chime', 0.24); break }   // 金块塔长满
        case 'steps': for (let i = 2; i < Math.min(n, 4); i++) at(cue(i) + ED, 'tick', 0.3); at(cue(n) + ED, 'chime', 0.24); break   // 走到岛上，走到最后一座
        case 'compare': at(cue(2), 'thud', 0.42); at(cue(2) + 0.02, 'glitch', 0.2); break                       // VS 砸下来
        case 'end': at(cue(0) + 0.2 + ED * 0.75, 'chime', 0.28); at(cue(0) + 0.4, 'thud', 0.22, -0.3); at(cue(0) + 1, 'thud', 0.22, 0.3); break   // 奖杯落定、头两朵烟花
      }
    }
    return out
  },

  // 默认摆法会用的零件（只有 custom 场会用到）：方角像素卡片、实心柱、方块标记、虚线下划线
  card(ctx, E, x, y, w, h, o = {}) {
    const S = G(E).S, acc = o.tone === 'accent'
    panel(ctx, screenView(E), Math.round(x / S), Math.round(y / S), Math.round(w / S), Math.round(h / S), { fill: acc ? this.c.accent : this.c.card, line: acc ? PAL.ink : this.c.line, line2: acc ? dk(this.c.accent, 0.4) : this.c.bg })
  },
  bar(ctx, E, x, y, w, h, o = {}) {
    const S = G(E).S, X = Math.round(Math.min(x, x + w) / S) * S, Y = Math.round(Math.min(y, y + h) / S) * S, W = Math.round(Math.abs(w) / S) * S, H = Math.round(Math.abs(h) / S) * S
    ctx.save(); ctx.fillStyle = PAL.ink; ctx.fillRect(X - S, Y - S, W + 2 * S, H + 2 * S); ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(X, Y, W, H); ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) { const S = G(E).S, R = Math.round(r / S) * S; ctx.save(); ctx.fillStyle = PAL.ink; ctx.fillRect(x - R - S, y - R - S, 2 * R + 2 * S, 2 * R + 2 * S); ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(x - R, y - R, 2 * R, 2 * R); ctx.restore() },
  underline(ctx, E, x, y, w, p) { const S = G(E).S; ctx.save(); ctx.fillStyle = this.c.accent; for (let k = 0; k * 3 * S < w * p; k++) ctx.fillRect(x + k * 3 * S, y, 2 * S, S); ctx.restore() },
  line(ctx, E, x1, y1, x2, y2, o = {}) { const p = o.p ?? 1; ctx.save(); ctx.lineCap = 'butt'; ctx.lineWidth = (o.width ?? 4) * E.u; ctx.strokeStyle = o.color ?? this.c.accent; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p); ctx.stroke(); ctx.restore() },
}
