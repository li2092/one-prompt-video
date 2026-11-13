// 黏土道具：舞台（抹过的墙 + 焦糖色黏土桌）、圆头小机器人、黏土圆台、桌上的小摆件、黏土勾。
// 移植自风格库的 S-黏土卡通（lib/props.mjs）。改动：舞台高度按引擎的内容区和字幕带算；颜色走 pal(E)；
// 去掉原样片题材专用的图标、圆环和走路循环，新加圆台、小摆件和手臂指向。
import { pal, shade, sprite, blob, ball, put, ground, noodle, ellPts, pathPts, boil, partial } from './clay.mjs'
import { clamp, rng, rgba, mix } from '../../../core.mjs'

// ---------- 舞台 ----------
// FRONT：桌沿（下面是桌子的前立面，字幕牌立在上面）；TOP：桌面后沿；G：物件站立的高度
export function stageLay(E) {
  const u = E.u, FRONT = E.L.box.y + E.L.box.h + 12 * u
  return { FRONT, TOP: FRONT - 112 * u, G: FRONT - 44 * u }
}
const WALLS = ['#FBE2D2', '#FADDE6', '#FBEDC4', '#DCEAF8', '#DAF1E4', '#E8E0F7']
// 每场换一种马卡龙墙色，片头片尾用主题的 bg；"colors" 换了 bg 时，其余几种从新的 bg 配出来
export function wallTone(E, i, n) {
  const c = E.theme.c
  if (i === 0 || i === n - 1) return c.bg
  const tones = c.bg.toUpperCase() === WALLS[0] ? WALLS : [c.bg, mix(c.bg, c.accent2, 0.16), mix(c.bg, '#F7D98A', 0.22), mix(c.bg, c.card, 0.4), mix(c.bg, c.accent, 0.1), mix(c.bg, '#C3B0EA', 0.18)]
  return tones[1 + (i - 1) % (tones.length - 1)]
}
function wallCanvas(E, color) {
  return E.once('clay:wall:' + color, () => {
    const W = E.W, H = E.H, c = E.createCanvas(W, H), g = c.getContext('2d'), r = rng(color.length * 31 + parseInt(color.slice(1), 16) % 997)
    g.fillStyle = color; g.fillRect(0, 0, W, H)
    // 抹开的大块明暗：手掌抹平黏土留下的不均匀
    for (let i = 0; i < 9; i++) {
      const x = r() * W, y = r() * H, rad = (0.18 + r() * 0.25) * Math.max(W, H), light = r() < 0.5, gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, light ? 'rgba(255,255,255,0.16)' : rgba(shade(color, -0.25), 0.1)); gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr; g.fillRect(0, 0, W, H)
    }
    // 抹痕：长而浅的弧
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = r() * H, rad = (40 + r() * 140) * E.u, a = r() * Math.PI * 2, span = 0.5 + r() * 0.6
      g.lineWidth = (2 + r() * 3) * E.u; g.lineCap = 'round'
      g.strokeStyle = rgba(shade(color, -0.3), 0.05); g.beginPath(); g.arc(x, y, rad, a, a + span); g.stroke()
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x + 2, y + 2, rad, a, a + span); g.stroke()
    }
    const img = g.getImageData(0, 0, W, H), d = img.data, rr = rng(5)
    for (let i = 0; i < d.length; i += 4) { const v = (rr() - 0.5) * 9; d[i] += v; d[i + 1] += v; d[i + 2] += v }
    g.putImageData(img, 0, 0)
    return c
  })
}
export function stage(ctx, E, i, n) {
  const S = stageLay(E), K = pal(E), u = E.u, W = E.W
  ctx.drawImage(wallCanvas(E, wallTone(E, i, n)), 0, 0)
  const g = ctx.createLinearGradient(0, S.TOP - 140 * u, 0, S.TOP + 4 * u)
  g.addColorStop(0, 'rgba(120,60,40,0)'); g.addColorStop(1, 'rgba(120,60,40,0.16)')
  ctx.fillStyle = g; ctx.fillRect(0, S.TOP - 140 * u, W, 150 * u)
  const tw = Math.round(W * 1.32), th = Math.round(S.FRONT - S.TOP + 30 * u), fh = Math.round(E.H - S.FRONT + 120 * u)
  const top = blob(E, 'tabletop', tw, th, 40 * u, { color: shade(K.table, 0.12), seed: 11, prints: 3, dents: 8, depth: 14 * u, lx: 0.5, ly: 0.1, hx: 0.42, hy: 0.25, gloss: 0.5 })
  const front = blob(E, 'tablefront', tw - 10, fh, 44 * u, { color: shade(K.table, -0.12), seed: 12, prints: 4, dents: 10, depth: 18 * u, lx: 0.5, ly: 0.02, gloss: 0.2 })
  put(ctx, front, W / 2, S.FRONT - 22 * u, { ax: 0.5, ay: 0 })
  put(ctx, top, W / 2, S.TOP, { ax: 0.5, ay: 0 })
}

// ---------- 机器人 ----------
// (x, y) 是脚底中心；s 是头宽（像素）。整只高约 1.56 s。
// o: t 场内秒数, mood: neutral | happy | worried | o, look: -1..1, armL/armR: 角度（0 下垂，π/2 平举，π 向上）, reachL/reachR,
//    sweat: 0..1, squash: {sx,sy}, jump: 像素, tilt: 弧度, ant: 天线额外摆动, turn: -1..1 侧身, a: 透明度, seed
const BLINKS = (() => { const r = rng(77), a = []; let t = 0.9; while (t < 400) { a.push(t); t += 2.2 + r() * 1.8 } return a })()
function blinkAmt(T, off) {
  const t = T + off
  let best = 9
  for (const b of BLINKS) { const d = Math.abs(t - b); if (d < best) best = d; if (b > t + 1) break }
  return clamp(1 - best / 0.075)
}
export const robotH = s => s * 1.56
export function robot(ctx, E, x, y, s, o = {}) {
  const K = pal(E), t = o.t ?? 0, k = s / 300, bo = boil(E.T, o.seed ?? 3, 1)
  ground(ctx, x, y + 2, s * 0.95 * (1 - clamp((o.jump || 0) / (s * 1.4)) * 0.5), o.a ?? 1)
  ctx.save()
  if (o.a != null) ctx.globalAlpha *= o.a
  const turn = clamp(o.turn || 0, -1, 1), th = turn * 0.6, ct = Math.cos(th), st = Math.sin(th)
  ctx.translate(x + bo.x * E.u, y + bo.y * E.u - (o.jump || 0)); ctx.rotate((o.tilt || 0) + bo.r)
  const breathe = 1 + Math.sin(t * 2.4 + (o.seed || 0)) * 0.012, sq = o.squash || { sx: 1, sy: 1 }
  const lag = clamp((1 - sq.sy) * 4, -1, 1)          // 被压扁时为正：天线、耳朵往下甩
  ctx.scale(k * sq.sx, k * sq.sy * breathe)
  const body = blob(E, 'rb-body', 184, 132, 52, { color: K.robot, seed: 21 })
  const head = blob(E, 'rb-head', 300, 236, 98, { color: K.robot, seed: 22, prints: 2 })
  const face = blob(E, 'rb-face', 226, 150, 64, { color: K.face, seed: 23, prints: 1, depth: 8 })
  const foot = ball(E, 'rb-foot', 70, 40, { color: K.robotDark, seed: 24 })
  const ear = ball(E, 'rb-ear', 44, 60, { color: K.lav, seed: 25 })
  const light = ball(E, 'rb-light', 38, 38, { color: K.accent, seed: 26, depth: 4 })
  const hand = ball(E, 'rb-hand', 40, 40, { color: K.face, seed: 27, depth: 4 })
  const antB = ball(E, 'rb-ant', 42, 42, { color: K.accent, seed: 28, depth: 5 })
  put(ctx, foot, -54 * (0.85 + 0.15 * ct) + st * 14, -16)
  put(ctx, foot, 54 * (0.85 + 0.15 * ct) + st * 14, -16)
  put(ctx, body, st * 6, -84, { sx: 1 - 0.07 * Math.abs(turn) })
  put(ctx, light, st * 52, -88, { sx: 0.75 + 0.25 * ct })
  // 天线：侧身时根部跟着头偏；压扁时往下甩
  const ax = Math.sin(t * 2.8 + 1) * 6 + (o.ant || 0) + st * 26, ay = -446 + lag * 34
  noodle(ctx, g => { g.beginPath(); g.moveTo(st * 30, -372); g.quadraticCurveTo(st * 30 + (ax - st * 30) * 0.3, (-372 + ay) / 2 - 6, ax, ay + 8) }, K.lav, 12)
  put(ctx, antB, ax, ay, { sx: 1 + lag * 0.12, sy: 1 - lag * 0.12 })
  // 耳朵、头：侧身时朝向那侧的耳朵转到头后，另一只转到前面
  const eY = -262 + lag * 16, eX = 154 * (0.82 + 0.18 * ct)
  const earAt = side => put(ctx, ear, side * eX + st * 20, eY, { sx: 1 - 0.25 * Math.abs(st), rot: side * lag * 0.15 })
  const front = Math.abs(turn) > 0.15 ? (turn > 0 ? -1 : 1) : 0
  if (front !== 1) earAt(1)
  if (front !== -1) earAt(-1)
  put(ctx, head, st * 8, -262, { sx: 1 - 0.05 * Math.abs(turn) })
  if (front) earAt(front)
  const fx = st * 62, es = 0.8 + 0.2 * ct
  put(ctx, face, fx, -256, { sx: 0.84 + 0.16 * ct })
  // 脸
  const lk = (o.look || 0) * 14 + fx, ey = -266, mood = o.mood || 'neutral', bl = blinkAmt(E.T, o.seed || 0)
  ctx.fillStyle = 'rgba(245,140,160,0.5)'
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * 86 * es + fx, -226, 22 * es, 12, 0, 0, Math.PI * 2); ctx.fill() }
  if (mood === 'happy') {
    for (const sx of [-1, 1]) noodle(ctx, g => { g.beginPath(); g.arc(sx * 52 * es + lk, ey + 8, 17, Math.PI * 1.15, Math.PI * 1.85) }, K.ink, 9)
    ctx.fillStyle = shade(K.accent, -0.15); ctx.beginPath(); ctx.moveTo(-26 + lk, -224); ctx.quadraticCurveTo(lk, -186, 26 + lk, -224); ctx.closePath(); ctx.fill()
  } else {
    for (const sx of [-1, 1]) {
      const ry = 25 * (1 - bl * 0.92)
      ctx.fillStyle = K.ink; ctx.beginPath(); ctx.ellipse(sx * 52 * es + lk, ey, 17, ry, 0, 0, Math.PI * 2); ctx.fill()
      if (ry > 8) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(sx * 52 * es + lk - 5, ey - 9, 6, 0, Math.PI * 2); ctx.fill() }
    }
    if (mood === 'worried') {
      for (const sx of [-1, 1]) noodle(ctx, g => { g.beginPath(); g.moveTo(sx * 30 * es + lk, ey - 46); g.lineTo(sx * 72 * es + lk, ey - 36) }, K.ink, 7)
      noodle(ctx, g => { g.beginPath(); g.moveTo(-22 + lk, -214); g.bezierCurveTo(-10 + lk, -226, lk, -202, 10 + lk, -214); g.quadraticCurveTo(16 + lk, -222, 22 + lk, -214) }, K.ink, 6)
    } else if (mood === 'o') { ctx.fillStyle = K.ink; ctx.beginPath(); ctx.ellipse(lk, -214, 9, 11, 0, 0, Math.PI * 2); ctx.fill() }
    else noodle(ctx, g => { g.beginPath(); g.arc(lk, -232, 18, Math.PI * 0.2, Math.PI * 0.8) }, K.ink, 6)
  }
  // 手臂（画在最前面）
  const arm = (side, ang, reach) => {
    const sx0 = side * 88 * (0.88 + 0.12 * ct) + st * 10, sy0 = -128, L = 80 * (reach || 1)
    const hx = sx0 + side * Math.sin(ang) * L, hy = sy0 + Math.cos(ang) * L
    noodle(ctx, g => { g.beginPath(); g.moveTo(sx0, sy0); g.quadraticCurveTo(sx0 + side * Math.sin(ang) * L * 0.5 + side * 6, sy0 + Math.cos(ang) * L * 0.5, hx, hy) }, K.robotDark, 26)
    put(ctx, hand, hx, hy)
  }
  arm(-1, o.armL ?? 0.32, o.reachL)
  arm(1, o.armR ?? 0.32, o.reachR)
  if (o.sweat > 0.01) {
    const dr = sprite(E, 'sweat', 30, 44, g => { g.beginPath(); g.moveTo(15, 0); g.bezierCurveTo(22, 14, 30, 22, 30, 30); g.arc(15, 30, 15, 0, Math.PI); g.bezierCurveTo(0, 22, 8, 14, 15, 0); g.fill() }, { color: '#A9DDF6', seed: 31, depth: 4, prints: 0 })
    const sl = (t * 0.6) % 1
    put(ctx, dr, 168, -330 + sl * 40, { a: o.sweat * (1 - sl * 0.6) })
  }
  ctx.restore()
}
// 手臂指向画面上的 (tx, ty)：返回 robot() 要的角度。side：-1 左臂，1 右臂
export function armTo(x, y, s, side, tx, ty) {
  const k = s / 300, dx = tx - (x + side * 88 * k), dy = ty - (y - 128 * k)
  return clamp(Math.atan2(side * dx, dy), 0.25, 3.0)
}

// ---------- 黏土圆台 ----------
// 立着的圆柱：顶面椭圆、正面、底边圆。h 是顶面中心到底边中心的高度；返回 { sp, ry }。
// 画的时候 put(ctx, sp, x, G, { ay: (h + ry) / (h + 2 * ry) })：底边中心落在 G，顶面中心在 G - h
export function drum(E, key, w, h, color, deco, o = {}) {
  const ry = Math.round(w * 0.16), H = Math.round(h + 2 * ry), seed = o.seed ?? 70
  const sp = sprite(E, `drum:${key}:${w}x${H}:${color}`, w, H, g => {
    g.fillRect(0, ry, w, H - 2 * ry)
    pathPts(g, ellPts(w / 2, ry, w / 2, ry, seed, 0.5)); g.fill()
    pathPts(g, ellPts(w / 2, H - ry, w / 2, ry, seed + 1, 0.5)); g.fill()
  }, { color, seed, shadow: o.shadow, prints: 2, ly: 0.05, hy: 0.06, deco: (g, w, hh) => {
    g.globalCompositeOperation = 'source-atop'
    // 顶面：亮一点，边上一圈暗缝
    g.fillStyle = rgba(shade(color, -0.3), 0.5); g.beginPath(); g.ellipse(w / 2, ry + 3, w / 2, ry, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = shade(color, 0.32); g.beginPath(); g.ellipse(w / 2, ry - 1, w / 2 - 3, ry - 3, 0, 0, Math.PI * 2); g.fill()
    if (deco) deco(g, w, hh, ry)
  } })
  return { sp, ry, H }
}

// ---------- 小摆件（桌上的黏土小物，只是装饰） ----------
// kind: balls 三个叠起来的小球 | blocks 两块小方块 | plant 一盆小草 | pencil 一支躺着的铅笔。sz 是大小（像素）
export function prop(ctx, E, kind, x, G, sz, seed = 1) {
  const K = pal(E), bo = boil(E.T, seed * 13 + 5, 0.6 * E.u), X = x + bo.x
  if (kind === 'balls') {
    ground(ctx, x, G, sz * 1.7)
    const cs = [K.tones[1], K.tones[3], K.tones[0]]
    put(ctx, ball(E, 'pb0', Math.round(sz * 0.62), Math.round(sz * 0.58), { color: cs[0], seed: 501 }), X - sz * 0.34, G - sz * 0.27)
    put(ctx, ball(E, 'pb1', Math.round(sz * 0.56), Math.round(sz * 0.52), { color: cs[1], seed: 502 }), X + sz * 0.3, G - sz * 0.25)
    put(ctx, ball(E, 'pb2', Math.round(sz * 0.5), Math.round(sz * 0.48), { color: cs[2], seed: 503 }), X - sz * 0.02, G - sz * 0.66)
  } else if (kind === 'blocks') {
    ground(ctx, x, G, sz * 1.6)
    put(ctx, blob(E, 'pk0', Math.round(sz * 0.7), Math.round(sz * 0.6), sz * 0.12, { color: K.tones[2], seed: 511 }), X - sz * 0.2, G, { ay: 1, rot: -0.04 })
    put(ctx, blob(E, 'pk1', Math.round(sz * 0.5), Math.round(sz * 0.44), sz * 0.1, { color: K.tones[4], seed: 512 }), X + sz * 0.38, G, { ay: 1, rot: 0.05 })
    put(ctx, blob(E, 'pk2', Math.round(sz * 0.46), Math.round(sz * 0.4), sz * 0.1, { color: K.accent, seed: 513 }), X - sz * 0.14, G - sz * 0.56, { ay: 1, rot: 0.12 })
  } else if (kind === 'plant') {
    ground(ctx, x, G, sz * 1.1)
    const leaf = ball(E, 'pl-leaf', Math.round(sz * 0.3), Math.round(sz * 0.62), { color: K.green, seed: 521, depth: 4 })
    const sway = Math.sin(E.T * 1.6 + seed) * 0.05
    for (const [dx, r] of [[-0.18, -0.5], [0.18, 0.5], [0, 0]]) put(ctx, leaf, X + dx * sz, G - sz * 0.62, { ay: 0.9, rot: r + sway })
    put(ctx, blob(E, 'pl-pot', Math.round(sz * 0.6), Math.round(sz * 0.52), sz * 0.12, { color: K.accent, seed: 522 }), X, G, { ay: 1 })
  } else if (kind === 'pencil') {
    const L = Math.round(sz * 1.6), w = Math.round(L * 0.16)
    ground(ctx, x, G + 2, L * 0.9)
    const sp = sprite(E, `pencil:${L}`, L, w, g => { pathPts(g, [[0, w * 0.5], [L * 0.2, 0], [L, 0], [L, w], [L * 0.2, w]]); g.fill() }, { color: K.tones[0], seed: 61, depth: 4, deco: (g, L2, w2) => {
      g.globalCompositeOperation = 'source-atop'
      g.fillStyle = shade(K.cream, 0.2); g.beginPath(); g.moveTo(0, w2 / 2); g.lineTo(L2 * 0.2, 0); g.lineTo(L2 * 0.2, w2); g.fill()
      g.fillStyle = K.ink; g.beginPath(); g.moveTo(0, w2 / 2); g.lineTo(L2 * 0.07, w2 * 0.33); g.lineTo(L2 * 0.07, w2 * 0.67); g.fill()
      g.fillStyle = K.pink; g.fillRect(L2 * 0.86, 0, L2 * 0.14, w2)
    } })
    put(ctx, sp, X, G - w * 0.5, { rot: -0.06 })
  }
}

// 黏土勾：逐笔画出来
export function check(ctx, E, x, y, s, p, color) {
  noodle(ctx, partial([[x - s * 0.5, y], [x - s * 0.12, y + s * 0.38], [x + s * 0.55, y - s * 0.42]], p), color || pal(E).green, s * 0.22)
}
// 立在桌上的小牌子支架
export function stand(ctx, E, x, y0, G, a = 1) {
  if (a <= 0) return
  const K = pal(E), u = E.u
  ctx.save(); ctx.globalAlpha *= a
  ground(ctx, x, G, 120 * u)
  noodle(ctx, g => { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, G - 14 * u) }, shade(K.table, -0.12), 16 * u)
  put(ctx, ball(E, 'stand-base', Math.round(90 * u), Math.round(34 * u), { color: shade(K.table, -0.12), seed: 301, depth: 5 }), x, G - 12 * u)
  ctx.restore()
}
