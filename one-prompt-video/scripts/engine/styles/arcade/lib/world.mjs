// 关卡布景和公共件（移植自风格库的 G-街机关卡 lib/world.mjs、lib/actors.mjs）：
// 天空 / 云 / 山 / 地面、星空、光点、城堡剪影、HUD、粒子、机器人、旗杆。
import { PAL, view, screenView, ptext, cellOf, blink } from './px.mjs'
import { icon, groundTile, coin, sparkle, bot, botFlash, BOT_W, GEAR, gearImg, flagImg } from './sprites.mjs'

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
export function cloud(ctx, V, x, y) {
  const c = PAL.white, s = PAL.cloudSh
  V.disc(ctx, x, y + 2, 6, s); V.disc(ctx, x + 8, y - 1, 8, s); V.disc(ctx, x + 17, y + 2, 6, s)
  V.disc(ctx, x, y + 1, 6, c); V.disc(ctx, x + 8, y - 2, 8, c); V.disc(ctx, x + 17, y + 1, 6, c)
  V.r(ctx, x - 6, y + 1, 29, 6, c); V.r(ctx, x - 5, y + 6, 27, 1, s)
}
export function farCloud(ctx, V, x, y) { V.r(ctx, x, y, 14, 3, PAL.farCloud); V.r(ctx, x + 3, y - 2, 7, 2, PAL.farCloud); V.r(ctx, x + 2, y + 3, 12, 1, PAL.farCloudDk) }
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
// 山：阶梯三角；灌木
export function hill(ctx, V, x, base, h, col = '#00a844', hi = PAL.grassHi) {
  for (let j = 0; j < h; j++) { const w = Math.round((h - j) * 1.6); V.r(ctx, x - w, base - j - 1, w * 2, 1, col) }
  V.r(ctx, x - 2, base - h + 3, 1, 2, hi); V.r(ctx, x + 2, base - h + 5, 1, 2, hi); V.r(ctx, x - 5, base - h + 9, 1, 2, hi)
}
export function bush(ctx, V, x, base, n = 3) {
  for (let i = 0; i < n; i++) V.disc(ctx, x + i * 7, base - 4, 5, PAL.grassHi)
  V.r(ctx, x - 5, base - 4, n * 7 + 4, 4, PAL.grassHi)
  for (let i = 0; i < n; i++) V.r(ctx, x + i * 7 - 1, base - 6, 2, 1, PAL.green)
}
// 地面：砖块铺到屏幕底，越往下越暗（不抢字幕）
export function ground(ctx, V, gy, x0, x1, pal) {
  const img = groundTile(pal), a = Math.floor(x0 / 16) * 16
  for (let x = a; x < x1; x += 16) for (let y = gy; y < V.y1; y += 16) V.img(ctx, img, x, y)
  if (gy + 20 < V.y1) V.r(ctx, x0, gy + 20, x1 - x0, V.y1 - gy - 19, 'rgba(0,0,0,0.25)')
}
// 平台游戏外景（卷轴）：sx = 镜头左缘世界坐标（格）；返回最近一层的视图
export function overworld(ctx, E, g, sx, o = {}) {
  const SV = screenView(E)
  sky(ctx, SV, g.LW, g.LH, o.sky)
  const at = (k, dr = 0) => view(E, { cx: g.LW / 2 + sx * k + dr, cy: g.LH / 2 })
  const VF = at(0.1, (o.drift ?? 0) * 0.4), fy = g.P ? [96, 132, 80, 150] : [44, 64, 36, 74]
  for (let i = -2; i < 14; i++) farCloud(ctx, VF, i * (g.P ? 64 : 80) + 12, fy[(i + 8) % 4])
  const V0 = at(0.25, o.drift ?? 0), cy = g.P ? [76, 112, 66] : [34, 52, 28]
  for (let i = -2; i < 10; i++) cloud(ctx, V0, i * (g.P ? 110 : 150) + 30, cy[(i + 3) % 3])
  if (o.hills !== false) {
    const V1 = at(0.55)
    for (let i = -1; i < 12; i++) { const x = i * 96 + 40; hill(ctx, V1, x, o.gy, i % 2 ? 22 : 34); bush(ctx, V1, x + 44, o.gy, 2 + (i % 2)) }
  }
  const V = at(1)
  ground(ctx, V, o.gy, V.x0 - 16, V.x1 + 16, o.groundPal)
  return V
}
// 城堡剪影一排（黄昏关、夜景）
export function castles(ctx, V, gy, x0, x1, col, win) {
  for (let x = Math.floor(x0 / 90) * 90 + 20; x < x1; x += 90) {
    V.r(ctx, x, gy - 40, 30, 40, col); for (let j = 0; j < 4; j++) V.r(ctx, x + j * 8, gy - 44, 5, 4, col)
    V.r(ctx, x + 12, gy - 22, 6, 10, win)
  }
}
// 城堡（终点）：砖墙、垛口、门洞，(x, gy) 是左下角
export function castle(ctx, V, x, gy, k, wall, dark) {
  const w = 44 * k, h = 30 * k
  V.r(ctx, x, gy - h, w, h, wall); for (let j = 0; j < 6; j++) V.r(ctx, x + j * 8 * k, gy - h - 5 * k, 5 * k, 5 * k, wall)
  V.r(ctx, x + 10 * k, gy - h - 18 * k, 24 * k, 18 * k, wall); for (let j = 0; j < 3; j++) V.r(ctx, x + 10 * k + j * 9 * k, gy - h - 22 * k, 6 * k, 4 * k, wall)
  for (let yy = gy - h - 18 * k; yy < gy; yy += 4 * k) V.r(ctx, x, yy, w, 1, dark)
  V.r(ctx, x + 17 * k, gy - 14 * k, 10 * k, 14 * k, PAL.ink); V.disc(ctx, x + 22 * k, gy - 14 * k, 5 * k, PAL.ink)
  V.r(ctx, x + 19 * k, gy - h - 12 * k, 6 * k, 6 * k, PAL.ink)
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
const h01 = (i, s) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v) }
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
// 旗杆：底在 (x, gy)，高 h；flagP 0..1 旗子从底升到顶
export function flagPole(ctx, V, x, gy, h, flagP, col) {
  V.r(ctx, x - 3, gy - 4, 8, 4, PAL.grassDk)
  V.r(ctx, x, gy - h, 2, h - 4, PAL.grayDk); V.r(ctx, x + 1, gy - h, 1, h - 4, PAL.white)
  V.disc(ctx, x + 1, gy - h - 2, 2, PAL.green)
  V.img(ctx, flagImg(col), x + 2, Math.round(gy - 14 - (h - 20) * flagP), 1)
}
