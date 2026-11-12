// 全代码 2D 短片的最小工程：一个圆头角色踩着拍子跳三下。照这个骨架换成自己的角色、场景和故事。
// 三条规矩：画面只由时刻 t 决定；随机数从种子算；每帧开头把画布状态重设一遍。
const W = 1920, H = 1080, FPS = 30
const BPM = 120, BEAT = 60 / BPM            // 先定速度：120 拍每分钟，一拍正好 15 帧，切点才能落在帧上
window.DUR = 12 * BEAT                       // 全片 12 拍 = 6 秒
// 画面事件表：音效的时刻从这里取，不另写一份
window.EVENTS = [[2 * BEAT, 'land'], [4 * BEAT, 'land'], [6 * BEAT, 'land'], [8 * BEAT, 'blink']]

const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H
const ctx = canvas.getContext('2d')
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const hash = (a, b = 0) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d); return ((h ^ (h >>> 13)) >>> 0) / 4294967296 }
// 关键帧取值：[[时刻, 值, 缓动], …]
const ease = { lin: p => p, out: p => 1 - (1 - p) ** 3, in: p => p ** 3, io: p => (p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2) }
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, v0] = keys[i - 1], [t1, v1, e = 'io'] = keys[i]; return v0 + (v1 - v0) * ease[e]((t - t0) / (t1 - t0)) }
  return keys[keys.length - 1][1]
}
// 手绘感的轮廓：抖动的种子每秒换 8 次，读成手在画；每帧都换就成了噪点
function blob(cx, cy, rx, ry, t, seed) {
  const n = 28, k = Math.floor(t * 8)
  ctx.beginPath()
  for (let i = 0; i <= n; i++) { const a = (i % n) / n * Math.PI * 2, j = 1 + (hash(i % n, seed + k) - .5) * .035; const x = cx + Math.cos(a) * rx * j, y = cy + Math.sin(a) * ry * j; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }
  ctx.closePath()
}
function character(x, y, sx, sy, t, eyes) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy)      // 挤压拉伸：以脚底为原点缩放
  ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1b1b1f'; ctx.fillStyle = '#ff5a5f'
  blob(0, -150, 150, 150, t, 3); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#fff'
  for (const ex of [-52, 52]) { ctx.beginPath(); ctx.ellipse(ex, -180, 30, 38 * eyes + 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.save(); ctx.fillStyle = '#1b1b1f'; ctx.beginPath(); ctx.arc(ex + 8, -176, 12 * Math.min(1, eyes + .2), 0, Math.PI * 2); ctx.fill(); ctx.restore() }
  ctx.beginPath(); ctx.arc(0, -110, 34, .15 * Math.PI, .85 * Math.PI); ctx.stroke()
  ctx.restore()
}
window.renderAt = (t) => {
  t = clamp(Number(t) || 0, 0, window.DUR - 1e-6)
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#f6c56b'; ctx.fillRect(0, 800, W, 280)
  ctx.strokeStyle = '#1b1b1f'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(0, 800); ctx.lineTo(W, 800); ctx.stroke()
  // 每两拍跳一下：起跳前压扁（预备），空中拉长，落地再压扁（缓冲）
  const b = t / BEAT, hop = Math.floor(b / 2), u = (b / 2) % 1, jumping = hop < 3
  const x = kf(b, [[0, 420], [2, 780, 'io'], [4, 1140, 'io'], [6, 1500, 'io'], [12, 1500]])
  const air = jumping ? Math.sin(clamp((u - .18) / .7) * Math.PI) : 0
  const squash = jumping ? (u < .18 ? 1 - .22 * ease.out(u / .18) : u > .88 ? 1 - .22 * (1 - ease.out((u - .88) / .12)) : 1 + .12 * air) : 1 + .02 * Math.sin(t * 3)
  const eyes = b > 8 && b < 8.4 ? .1 : 1                   // 第 8 拍眨一下眼
  ctx.fillStyle = 'rgba(27,27,31,.18)'; ctx.beginPath(); ctx.ellipse(x, 806, 150 * (1 - .4 * air), 22 * (1 - .4 * air), 0, 0, Math.PI * 2); ctx.fill()
  character(x, 800 - air * 260, 1 / Math.sqrt(squash), squash, t, eyes)
  const fade = Math.min(clamp(t / .4), clamp((window.DUR - t) / .5))
  if (fade < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fade})`; ctx.fillRect(0, 0, W, H) }
}
window.renderAt(Number(new URLSearchParams(location.search).get('t')) || 0)   // ?t=3.5 打开到指定时刻
window.ready = true
