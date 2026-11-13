// 关卡布景和公共件（移植自风格库的 G-街机关卡 lib/world.mjs、lib/actors.mjs）：
// 天空 / 长条云 / 台地 / 树 / 地面、星空、光点、城市天际线、领奖台、HUD、粒子、彩纸、机器人。
import { mix } from '../../../core.mjs'
import { PAL, view, screenView, ptext, cellOf, blink } from './px.mjs'
import { icon, groundTile, coin, sparkle, bot, botFlash, BOT_W, GEAR, gearImg } from './sprites.mjs'

// 版式（格）：S 每格像素，LW×LH 整屏，b* 是内容区，GY 是地面顶（内容区下沿，字幕压在地面上）
export function G(E) {
  const S = cellOf(E), b = E.L.box
  return { S, P: E.portrait, LW: Math.ceil(E.W / S), LH: Math.ceil(E.H / S), bx: b.x / S, by: b.y / S, bw: b.w / S, bh: b.h / S, br: (b.x + b.w) / S, bb: (b.y + b.h) / S, GY: Math.floor((b.y + b.h) / S), cx: E.W / 2 / S }
}

// 天空：分段平涂 + 两行棋盘格抖动过渡（像素游戏的渐变）
export function sky(ctx, V, LW, LH, cols) {
  if (typeof cols === 'string') { V.r(ctx, 0, 0, LW, LH, cols); return }
  const n = cols.length, band = Math.ceil(LH / n)
  cols.forEach((c, i) => V.r(ctx, 0, i * band, LW, band + 1, c))
  for (let i = 1; i < n; i++) {
    const y = i * band
    for (let x = 0; x < LW; x += 2) { V.r(ctx, x, y - 2, 1, 1, cols[i]); V.r(ctx, x + 1, y - 1, 1, 1, cols[i]); V.r(ctx, x + 1, y, 1, 1, cols[i - 1]) }
  }
}
// 长条云：两层扁条，下沿一道暗边
export function streak(ctx, V, x, y, w, col, sh) {
  V.r(ctx, x, y, w, 2, col); V.r(ctx, x + 3, y - 1, Math.round(w * 0.5), 1, col); V.r(ctx, x + 2, y + 2, w - 4, 1, sh)
}
// 视差星空：n 颗星按 speed（格/秒）往左卷，cols 闪烁色
export function stars(ctx, V, t, LW, LH, n, speed, cols, seed = 1, size = 1) {
  for (let i = 0; i < n; i++) {
    const bx = (i * 73 + seed * 29) % LW, y = (i * 131 + seed * 53) % LH
    const x = ((bx - Math.floor(t * speed)) % LW + LW) % LW
    const c = cols[Math.floor(t * 4 + i * 0.7 + seed) % cols.length]
    if (c) V.r(ctx, x, y, size, size, c)
  }
}
// 慢慢上漂的光点（地下关、星空关）
export function motes(ctx, V, t, LW, y0, y1, n, cols, seed = 1) {
  const H = y1 - y0
  for (let i = 0; i < n; i++) {
    const sp = 3 + ((i * 7 + seed) % 5), y = y1 - (((i * 47 + seed * 13) + t * sp) % H)
    const x = (i * 59 + seed * 31) % LW + Math.round(Math.sin(t * 1.3 + i) * 2), c = cols[(i + Math.floor(t * 3 + i * 0.5)) % cols.length]
    V.r(ctx, x, y, 1, 1, c)
    if (i % 3 === 0) { V.r(ctx, x - 1, y, 1, 1, c); V.r(ctx, x + 1, y, 1, 1, c); V.r(ctx, x, y - 1, 1, 1, c); V.r(ctx, x, y + 1, 1, 1, c) }
  }
}
// 平顶台地：上窄下宽三层，横向岩层纹，顶边和左边一道亮
export function mesa(ctx, V, x, base, w, h, col, line, hi) {
  const a = Math.round(h * 0.45), b = Math.round(h * 0.75)
  for (const [tx, ty, tw, th] of [[x, base - h, w, a], [x - 4, base - h + a, w + 8, b - a], [x - 9, base - h + b, w + 18, h - b]]) {
    V.r(ctx, tx, ty, tw, th, col)
    for (let y = ty + 3; y < ty + th; y += 4) V.r(ctx, tx + 2, y, tw - 4, 1, line)
    V.r(ctx, tx, ty, tw, 1, hi); V.r(ctx, tx, ty, 1, th, hi)
  }
}
// 圆冠树：细树干、圆树冠，左上一块亮
export function tree(ctx, V, x, base, h, r, col, hi) {
  V.r(ctx, x - 1, base - h, 2, h, PAL.trunk)
  const cy = base - h - r + 2
  V.disc(ctx, x, cy, r, col)
  V.disc(ctx, x - Math.round(r * 0.35), cy - Math.round(r * 0.35), Math.round(r * 0.45), hi)
}
// 地面：菱格土铺到屏幕底，越往下越暗（不抢字幕）。turf = [草色, 草下暗线]，给外景加一层草皮
export function ground(ctx, V, gy, x0, x1, pal, turf) {
  const img = groundTile(pal), a = Math.floor(x0 / 16) * 16
  for (let x = a; x < x1; x += 16) for (let y = gy; y < V.y1; y += 16) V.img(ctx, img, x, y)
  if (turf) {
    V.r(ctx, a, gy, x1 - a, 3, turf[0]); V.r(ctx, a, gy + 3, x1 - a, 1, turf[1])
    for (let x = a; x < x1; x += 6) { V.r(ctx, x + 1, gy - 1, 3, 1, turf[0]); V.r(ctx, x + 4, gy + 1, 1, 1, turf[1]) }
  }
  if (gy + 20 < V.y1) V.r(ctx, x0, gy + 20, x1 - x0, V.y1 - gy - 19, 'rgba(0,0,0,0.25)')
}
// 平台游戏外景（卷轴）：青绿天、长条云、远处平顶台地、中景圆冠树、草皮和菱格土。
// sx = 镜头左缘世界坐标（格）；o.hills=false 不画台地和树；返回最近一层的视图
export function overworld(ctx, E, g, sx, o = {}) {
  const SV = screenView(E), bg = o.sky, lt = k => mix(bg, PAL.white, k)
  sky(ctx, SV, g.LW, g.LH, [mix(bg, PAL.ink, 0.22), bg, lt(0.18), lt(0.36)])
  const at = (k, dr = 0) => view(E, { cx: g.LW / 2 + sx * k + dr, cy: g.LH / 2 })
  const VF = at(0.1, (o.drift ?? 0) * 0.4), fy = g.P ? [96, 132, 80, 150] : [44, 64, 36, 74]
  for (let i = -2; i < 14; i++) streak(ctx, VF, i * (g.P ? 64 : 80) + 12, fy[(i + 8) % 4], 16 + ((i + 9) % 3) * 6, lt(0.45), lt(0.28))
  if (o.hills !== false) {
    const VM = at(0.18), col = mix(bg, '#d0b4f4', 0.7)
    for (let i = -2; i < 12; i++) mesa(ctx, VM, i * 120 + 30 + (i % 2) * 14, o.gy, [34, 56, 26][(i + 6) % 3], [30, 20, 42][(i + 6) % 3] * (g.P ? 1.3 : 1), col, mix(col, PAL.ink, 0.1), mix(col, PAL.white, 0.3))
  }
  const V0 = at(0.25, o.drift ?? 0), cy = g.P ? [76, 112, 66] : [34, 52, 28]
  for (let i = -2; i < 10; i++) streak(ctx, V0, i * (g.P ? 110 : 150) + 30, cy[(i + 3) % 3], 30 + ((i + 6) % 3) * 8, lt(0.8), lt(0.5))
  if (o.hills !== false) {
    const V1 = at(0.55), col = mix(bg, '#0c3c3c', 0.55), hi = mix(col, '#c8f4a0', 0.3)
    for (let i = -2; i < 16; i++) { const j = (i + 8) % 4; tree(ctx, V1, i * 46 + 20 + j * 5, o.gy, [8, 12, 6, 10][j], [7, 9, 5, 8][j], col, hi); if (j === 1) tree(ctx, V1, i * 46 + 37, o.gy, 6, 5, col, hi) }
  }
  const V = at(1)
  ground(ctx, V, o.gy, V.x0 - 16, V.x1 + 16, o.groundPal, [PAL.turf, PAL.turfDk])
  return V
}
// 城市天际线（黄昏关）：高低不一的楼，有的楼顶是天线（红灯闪），窗户有亮有暗、偶尔换一盏
export function skyline(ctx, V, gy, x0, x1, col, win, t, seed = 1) {
  for (let i = Math.floor(x0 / 22) - 1; i * 22 < x1; i++) {
    const h0 = Math.imul(i + 1000, 2654435761) ^ (seed * 40503), hs = k => ((h0 >>> k) & 0xff)
    const w = 14 + (hs(1) % 3) * 4, h = 24 + (hs(5) % 5) * 8, x = i * 22 + (hs(9) % 4)
    V.r(ctx, x, gy - h, w, h, col)
    if (hs(13) % 3 === 0) { V.r(ctx, x + (w >> 1), gy - h - 7, 1, 7, col); if (blink(t + i * 0.37, 1.5)) V.r(ctx, x + (w >> 1), gy - h - 8, 1, 1, PAL.red) }
    else if (hs(13) % 3 === 1) V.r(ctx, x + 3, gy - h - 3, w - 6, 3, col)
    for (let wy = gy - h + 4, r = 0; wy < gy - 4; wy += 5, r++) for (let wx = x + 2, q = 0; wx < x + w - 3; wx += 4, q++) {
      const lit = (Math.imul(h0 ^ (r * 31 + q * 7), 2246822519) >>> 28) < 6, flip = (Math.floor(t * 0.7) + r * 3 + q * 5 + i) % 23 === 0
      if (lit !== flip) V.r(ctx, wx, wy, 2, 2, win)
    }
  }
}
// 领奖台：三级台阶 [二, 一, 三]，左下角 (x, gy)，每级宽 w、高 hs[k]；rise 0..1 台子从地里升起。返回三级台面的 y
export function podium(ctx, V, x, gy, w, hs, cols, rise, unit = 1) {
  return [1, 0, 2].map((rank, k) => {
    const h = Math.round(hs[rank] * rise), xx = x + k * w, col = cols[rank], top = gy - h
    if (h > 0) {
      V.r(ctx, xx, top, w, h, PAL.ink)
      V.r(ctx, xx + 1, top + 1, w - 2, h - 1, col)
      V.r(ctx, xx + 1, top + 1, w - 2, 2, mix(col, PAL.white, 0.45)); V.r(ctx, xx + w - 3, top + 3, 2, h - 3, mix(col, PAL.ink, 0.3))
      if (h >= 7 * unit + 5) ptext(ctx, V, String(rank + 1), xx + w / 2, top + 3 + unit, unit, PAL.ink, { align: 'center' })
    }
    return top
  })
}
// 彩纸：t0 以后从屏幕上方往下飘，到 y1 再从头来；两种朝向轮换，像在翻
const h01 = (i, s) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v) }
export function confetti(ctx, V, t, t0, LW, y1, n, cols, seed = 1) {
  const d = t - t0
  if (d < 0) return
  for (let i = 0; i < n; i++) {
    const sp = 18 + h01(i, seed) * 22, yr = d * sp - h01(i, seed + 1) * 70
    if (yr < 0) continue
    const y = (yr % (y1 + 6)) - 4, x = Math.round(h01(i, seed + 2) * LW + Math.sin(t * 2.2 + i) * 3), f = (Math.floor(t * 6) + i) % 2
    V.r(ctx, x, y, f ? 2 : 1, f ? 1 : 2, cols[i % cols.length])
  }
}

// ---------- HUD：{ lives, score, coins, stage, c } ----------
export function hud(ctx, E, h) {
  const V = screenView(E), g = G(E), c = h.c
  const pt = (s, x, y, col = c.fg, al) => ptext(ctx, V, s, x, y, 1, col, { shadow: PAL.ink, align: al })
  const hearts = (x, y) => { for (let i = 0; i < 3; i++) V.img(ctx, icon(i < h.lives ? 'heart' : 'heartE', { R: c.accent2, W: PAL.white }), x + i * 9, y) }
  const scoreS = String(Math.max(0, Math.round(h.score))).padStart(6, '0'), coinS = '×' + String(h.coins).padStart(2, '0')
  const cf = coin([0, 1, 2, 3][Math.floor(E.T * 6) % 4])
  if (g.LW >= 260) {
    const y = 5
    pt('1P', 12, y); hearts(28, y)
    pt('SCORE', 66, y, c.accent); pt(scoreS, 100, y)
    V.img(ctx, cf, 152, y - 1); pt(coinS, 162, y)
    pt(h.stage, g.LW - 12, y, c.fg, 'right')
  } else {
    const y = g.P ? 12 : 2, y2 = y + (g.P ? 11 : 9)
    pt('1P', 10, y); hearts(26, y); pt(h.stage, g.LW - 10, y, c.fg, 'right')
    pt('SCORE', 10, y2, c.accent); pt(scoreS, 44, y2)
    V.img(ctx, cf, g.LW - 40, y2 - 1); pt(coinS, g.LW - 10, y2, c.fg, 'right')
  }
}

// ---------- 效果 ----------
// 闪白：三档量化透明度
export function flash(ctx, E, t, t0, dur = 0.24, col = PAL.white, max = 0.7) {
  const p = (t - t0) / dur
  if (p < 0 || p >= 1) return
  ctx.save(); ctx.globalAlpha = max * [1, 0.65, 0.3][Math.min(2, Math.floor(p * 3))]; ctx.fillStyle = col; ctx.fillRect(0, 0, E.W, E.H); ctx.restore()
}
// 爆点：方块碎屑放射
export function burst(ctx, V, t, t0, x, y, cols = [PAL.coin, PAL.white, PAL.orange], n = 14, speed = 60, life = 0.7, seed = 1, big = 1) {
  const d = t - t0
  if (d < 0 || d > life) return
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed, sp = speed * (0.6 + ((i * 37 + seed * 11) % 10) / 20)
    const sz = (d < life * 0.6 ? 2 : 1) * big
    V.r(ctx, x + Math.cos(a) * sp * d, y + Math.sin(a) * sp * d + 40 * d * d, sz, sz, cols[i % cols.length])
  }
}
export function fireworks(ctx, V, t, t0, pts, cols, big = 1) { pts.forEach(([x, y, dt], i) => burst(ctx, V, t, t0 + dt, x, y, cols, 16 + 6 * (big - 1), 50 + 20 * (big - 1), 0.9, i * 3 + 1, big)) }
// 全屏金币雨
export function coinRain(ctx, V, t, t0, LW, LH, n = 36, dur = 1.6, k = 2, seed = 3, top = 0) {
  const d = t - t0
  if (d < 0 || d > dur + 1.2) return
  for (let i = 0; i < n; i++) {
    const dd = d - h01(i, seed) * dur
    if (dd < 0) continue
    const x = Math.round(((i + h01(i, seed + 1) * 0.8) / n) * (LW - 8 * k)), y = top - 6 + Math.round(dd * (60 + h01(i, seed + 2) * 60) + dd * dd * 40)
    if (y > LH || y < top) continue
    V.img(ctx, coin(Math.floor(dd * 14) + i), x, y, k)
  }
}

// ---------- 角色 ----------
// 机器人：(x, y) 为贴图左上（格），k 倍。o: { pose, eyes, flip, pal, hit, gear: [...], gearIn: {id: 0..1}, glow }
export function drawBot(ctx, V, t, x, y, k, o = {}) {
  const pose = o.pose || 'stand', flip = !!o.flip
  if (o.hit && !blink(t, 12)) V.img(ctx, botFlash(pose), x, y, k, flip)
  else V.img(ctx, bot(pose, o.eyes || 'ok', o.pal), x, y, k, flip)
  ;(o.gear || []).forEach((id, i) => {
    const gg = GEAR[id], img = gearImg(id), p = o.gearIn?.[id] ?? 1
    if (p <= 0) return
    const drop = Math.round((1 - Math.ceil(p * 4) / 4) * 14)   // 从上方落下就位（四档）
    const gx = flip ? BOT_W - gg.at[0] - img.width : gg.at[0]
    V.img(ctx, img, x + gx * k, y + (gg.at[1] - drop) * k, k, flip)
    if (o.glow && blink(t + 0.06 * i, 6)) V.img(ctx, sparkle(Math.floor(t * 10) + i), x + (gx + img.width) * k - 2, y + (gg.at[1] - drop) * k - 3)
  })
}
export const hop = (t, t0, dur) => { const p = (t - t0) / dur; return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p) }
