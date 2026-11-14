// 内置的风格主题。主题只管「长什么样、怎么动、配什么乐」，不管内容；同一份 video.json 换主题不用改别的。
// 新主题：复制一个对象，改颜色、字体、bg、card 就能用；在 video.json 里也可以用 "colors" 覆盖颜色。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { rgba, mix, rng, hash, roundRect, lerp, clamp } from './core.mjs'

const TAU = Math.PI * 2
// 按比例调亮或调暗一个颜色（k 大于 1 调亮），色相不变。背景的渐变、底纹都从主题的 bg 色算出来，"colors" 换了 bg 它们跟着变
const scale = (hex, k) => '#' + [1, 3, 5].map(i => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join('')

// ---------- 所有主题共用的默认画法 ----------
const base = {
  radius: 18,
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 800, wBody: 500,
  solidAccent: false,   // 强调色的卡片是不是实心的（实心的上面用 onAccent 色写字）
  motion: 'rise',       // rise 上移淡入 | pop 弹出 | fade 淡入 | slam 砸入 | draw 画出来
  transition: 'fade',   // 场和场之间：cut 硬切 | fade 快速淡变 | slide 横推
  card(ctx, E, x, y, w, h, o = {}) {
    const c = this.c
    ctx.save()
    roundRect(ctx, x, y, w, h, this.radius * E.u)
    ctx.fillStyle = o.tone === 'accent' ? c.accent : c.card
    ctx.fill()
    if (c.line) { ctx.lineWidth = 2 * E.u; ctx.strokeStyle = o.tone === 'accent' ? c.accent : c.line; ctx.stroke() }
    ctx.restore()
  },
  line(ctx, E, x1, y1, x2, y2, o = {}) {
    const p = o.p ?? 1
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = (o.width ?? 4) * E.u; ctx.strokeStyle = o.color ?? this.c.accent
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(lerp(x1, x2, p), lerp(y1, y2, p)); ctx.stroke(); ctx.restore()
  },
  bar(ctx, E, x, y, w, h, o = {}) {
    ctx.save(); roundRect(ctx, x, y, w, h, Math.min(10 * E.u, Math.abs(w) / 2, Math.abs(h) / 2)); ctx.fillStyle = o.color ?? this.c.accent; ctx.fill(); ctx.restore()
  },
  mark(ctx, E, x, y, r, i, o = {}) {
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = o.color ?? this.c.accent; ctx.fill(); ctx.restore()
  },
  underline(ctx, E, x, y, w, p) { this.line(ctx, E, x, y, x + w, y, { p, width: 6 }) },
  sfx: { enter: 'tick', cut: 'whoosh', accent: 'chime' },
}

// 手绘线：一条线拆成几段，每段的端点按种子偏一点；种子每秒换 8 次，读起来是手在画，不是噪点
function wobblyPath(ctx, pts, amp, seed) {
  const r = rng(seed)
  ctx.beginPath()
  pts.forEach(([x, y], i) => { const jx = (r() - 0.5) * amp, jy = (r() - 0.5) * amp; if (i === 0) ctx.moveTo(x + jx, y + jy); else ctx.lineTo(x + jx, y + jy) })
}
function segPoints(x1, y1, x2, y2, p = 1, step = 60) {
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.ceil(len / step)), pts = []
  for (let i = 0; i <= n; i++) { const q = (i / n) * p; pts.push([lerp(x1, x2, q), lerp(y1, y2, q)]) }
  return pts
}
const tick8 = E => Math.floor(E.T * 8)

// ---------- 主题 ----------
export const THEMES = {
  grid: {
    ...base, id: 'grid', solidAccent: true, name: '网格图解', mood: '讲概念、讲原理，像书里的配图', bpm: 90,
    c: { bg: '#f7f5ef', fg: '#1f1b2e', muted: '#6f6a80', accent: '#6c3fd6', accent2: '#e2577a', card: '#ffffff', line: '#cfc6ee', onAccent: '#ffffff' },
    wTitle: 700, radius: 14, motion: 'rise', transition: 'slide',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
      const g = 54 * u, ox = (E.T * 6 * u) % g
      ctx.lineWidth = 1 * u
      for (let x = -ox; x < W + g; x += g) { ctx.strokeStyle = rgba(c.accent, Math.round((x + ox) / g) % 4 === 0 ? 0.16 : 0.07); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0, k = 0; y < H + g; y += g, k++) { ctx.strokeStyle = rgba(c.accent, k % 4 === 0 ? 0.16 : 0.07); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
    },
    music: { style: 'calm', prog: ['Cmaj7', 'Am7', 'Fmaj7', 'G'], lead: 'epiano', drums: false },
    sfx: { enter: 'tick', cut: 'whoosh', accent: 'chime' },
  },

  minimal: {
    ...base, id: 'minimal', name: '极简留白', mood: '安静、克制，品牌片和片头', bpm: 72,
    c: { bg: '#fbfbf9', fg: '#141414', muted: '#8a8a86', accent: '#2f5bea', accent2: '#141414', card: '#fbfbf9', line: '#dcdcd6', onAccent: '#ffffff' },
    wTitle: 300, wBody: 400, radius: 0, motion: 'fade', transition: 'fade',
    bg(ctx, E) {
      const { W, H, u } = E
      ctx.fillStyle = this.c.bg; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = this.c.line; ctx.lineWidth = 1.5 * u
      // 贴着底边的一条细线和一个随全片进度走的点
      const m = E.safe.l, y = H - 44 * u
      ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(W - m, y); ctx.stroke()
      ctx.fillStyle = this.c.accent; ctx.beginPath(); ctx.arc(lerp(m, W - m, clamp(E.T / E.total)), y, 6 * u, 0, TAU); ctx.fill()
    },
    card(ctx, E, x, y, w, h, o = {}) {
      ctx.save(); ctx.lineWidth = 1.5 * E.u; ctx.strokeStyle = o.tone === 'accent' ? this.c.accent : this.c.line
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke()
      if (o.tone === 'accent') { ctx.lineWidth = 4 * E.u; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.25, y); ctx.stroke() }
      ctx.restore()
    },
    underline(ctx, E, x, y, w, p) { this.line(ctx, E, x, y, x + Math.min(w, 120 * E.u), y, { p, width: 3 }) },
    markHollow: true,
    mark(ctx, E, x, y, r, i, o = {}) {
      ctx.save(); ctx.beginPath()
      if (o.badge) { ctx.arc(x, y, r, 0, TAU); ctx.lineWidth = 2 * E.u; ctx.strokeStyle = o.color ?? this.c.accent; ctx.stroke() } else { ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fillStyle = o.color ?? this.c.accent; ctx.fill() }
      ctx.restore()
    },
    music: { style: 'ambient', prog: ['Cmaj9', 'Am9', 'Fmaj7', 'Cmaj7'], lead: 'piano', drums: false },
    sfx: { enter: 'click', cut: 'swell', accent: 'chime' },
  },

  pop: {
    ...base, id: 'pop', solidAccent: true, name: '波普快剪', mood: '热闹、快节奏，短视频平台', bpm: 120,
    c: { bg: '#ffd23f', fg: '#151515', muted: '#3b3b3b', accent: '#ff3d7f', accent2: '#2b6cff', card: '#ffffff', line: '#151515', onAccent: '#ffffff' },
    wTitle: 900, wBody: 700, radius: 22, motion: 'pop', transition: 'cut',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      // 每场换一种底色。"colors" 换了 bg 时，另外三种从新的 bg 和两个强调色配出来
      const tones = c.bg === THEMES.pop.c.bg ? [c.bg, '#7cf0c8', '#ffb3d1', '#9ecbff'] : [c.bg, mix(c.bg, c.accent2, 0.3), mix(c.bg, c.accent, 0.3), mix(c.bg, '#ffffff', 0.45)]
      const base0 = tones[E.sceneIndex % tones.length]
      ctx.fillStyle = base0; ctx.fillRect(0, 0, W, H)
      // 放射线，慢慢转
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(E.T * 0.05)
      const R = Math.hypot(W, H)
      ctx.fillStyle = rgba('#ffffff', 0.22)
      for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, (i / 18) * TAU, ((i + 0.5) / 18) * TAU); ctx.closePath(); ctx.fill() }
      ctx.restore()
      // 角上的半调网点
      ctx.fillStyle = rgba('#151515', 0.14)
      const g = 26 * u
      for (let y = 0; y < H * 0.34; y += g) for (let x = 0; x < W * 0.3; x += g) {
        const d = 1 - Math.hypot(x / (W * 0.3), y / (H * 0.34)); if (d <= 0) continue
        ctx.beginPath(); ctx.arc(W - x - g / 2, H - y - g / 2, g * 0.42 * d, 0, TAU); ctx.fill()
      }
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, r = this.radius * u
      ctx.save()
      roundRect(ctx, x + 10 * u, y + 10 * u, w, h, r); ctx.fillStyle = this.c.line; ctx.fill()
      roundRect(ctx, x, y, w, h, r); ctx.fillStyle = o.tone === 'accent' ? this.c.accent : this.c.card; ctx.fill()
      ctx.lineWidth = 6 * u; ctx.strokeStyle = this.c.line; ctx.stroke()
      ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) {
      const u = E.u
      ctx.save(); ctx.fillStyle = this.c.line; ctx.fillRect(x + 8 * u, y + 8 * u, w, h)
      ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(x, y, w, h); ctx.lineWidth = 6 * u; ctx.strokeStyle = this.c.line; ctx.strokeRect(x, y, w, h); ctx.restore()
    },
    mark(ctx, E, x, y, r, i, o = {}) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.12 + (i % 2) * 0.24)
      ctx.fillStyle = o.color ?? [this.c.accent, this.c.accent2][i % 2]; ctx.strokeStyle = this.c.line; ctx.lineWidth = 5 * E.u
      ctx.beginPath(); ctx.rect(-r, -r, 2 * r, 2 * r); ctx.fill(); ctx.stroke(); ctx.restore()
    },
    underline(ctx, E, x, y, w, p) { ctx.save(); ctx.fillStyle = this.c.accent; ctx.fillRect(x, y - 2 * E.u, w * p, 16 * E.u); ctx.restore() },
    music: { style: 'drive', prog: ['C', 'G', 'Am', 'F'], lead: 'marimba', drums: true },
    sfx: { enter: 'pop', cut: 'thud', accent: 'chime' },
  },

  keynote: {
    ...base, id: 'keynote', name: '发布会', mood: '深色、从容、有分量，新品和重大结论', bpm: 100,
    c: { bg: '#0a0d1c', fg: '#f4f5fb', muted: '#9aa0bd', accent: '#7c8cff', accent2: '#ff7ac6', card: '#161a33', line: '#2d3360', onAccent: '#0a0d1c' },
    wTitle: 700, radius: 26, motion: 'rise', transition: 'fade',
    bg(ctx, E) {
      const { W, H } = E, c = this.c
      const own = c.bg !== THEMES.keynote.c.bg
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, own ? scale(c.bg, 0.7) : '#070916'); g.addColorStop(0.55, c.bg); g.addColorStop(1, own ? mix(c.bg, c.accent, 0.18) : '#1b1240')
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const blobs = [[0.22, 0.3, c.accent, 0.20], [0.8, 0.72, c.accent2, 0.16], [0.6, 0.15, '#3fd0ff', 0.10]]
      blobs.forEach(([bx, by, col, a], i) => {
        const x = (bx + 0.05 * Math.sin(E.T * 0.21 + i * 2.1)) * W, y = (by + 0.06 * Math.cos(E.T * 0.17 + i * 1.3)) * H, R = Math.max(W, H) * 0.42
        const rg = ctx.createRadialGradient(x, y, 0, x, y, R); rg.addColorStop(0, rgba(col, a)); rg.addColorStop(1, rgba(col, 0))
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H)
      })
      // 缓慢上浮的微粒
      for (let i = 0; i < 46; i++) {
        const x = hash(i, 1) * W, sp = 8 + hash(i, 2) * 22, y = H - ((hash(i, 3) * H + E.T * sp * E.u) % H), a = 0.10 + hash(i, 4) * 0.25
        ctx.fillStyle = rgba('#ffffff', a); ctx.beginPath(); ctx.arc(x, y, (1 + hash(i, 5) * 1.8) * E.u, 0, TAU); ctx.fill()
      }
    },
    card(ctx, E, x, y, w, h, o = {}) {
      ctx.save(); roundRect(ctx, x, y, w, h, this.radius * E.u)
      const g = ctx.createLinearGradient(x, y, x, y + h)
      if (o.tone === 'accent') { g.addColorStop(0, rgba(this.c.accent, 0.42)); g.addColorStop(1, rgba(this.c.accent2, 0.22)) } else { g.addColorStop(0, rgba('#ffffff', 0.10)); g.addColorStop(1, rgba('#ffffff', 0.04)) }
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5 * E.u; ctx.strokeStyle = rgba('#ffffff', o.tone === 'accent' ? 0.45 : 0.18); ctx.stroke(); ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) {
      ctx.save(); roundRect(ctx, x, y, w, h, Math.min(12 * E.u, Math.abs(w) / 2, Math.abs(h) / 2))
      const col = o.color ?? this.c.accent, g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, col); g.addColorStop(1, mix(col, this.c.accent2, 0.55))
      ctx.fillStyle = g; ctx.shadowColor = rgba(col, 0.55); ctx.shadowBlur = 28 * E.u; ctx.fill(); ctx.restore()
    },
    underline(ctx, E, x, y, w, p) {
      ctx.save(); const g = ctx.createLinearGradient(x, y, x + w, y); g.addColorStop(0, this.c.accent); g.addColorStop(1, this.c.accent2)
      ctx.fillStyle = g; ctx.fillRect(x, y, Math.min(w, 260 * E.u) * p, 5 * E.u); ctx.restore()
    },
    music: { style: 'bright', prog: ['Am9', 'Fmaj7', 'C', 'G'], lead: 'pluck', drums: true },
    sfx: { enter: 'tick', cut: 'swell', accent: 'chime' },
  },

  blueprint: {
    ...base, id: 'blueprint', name: '工程蓝图', mood: '讲结构、讲架构、讲组装', bpm: 90,
    c: { bg: '#0f3f86', fg: '#eaf2ff', muted: '#a9c4ee', accent: '#ffd866', accent2: '#7fe3ff', card: '#0f3f86', line: '#cfe0ff', onAccent: '#0c2f66' },
    fontTitle: 'sans', fontBody: 'mono', fontNum: 'mono', wTitle: 700, wBody: 400, radius: 0, motion: 'draw', transition: 'fade',
    bg(ctx, E) {
      const { W, H, u } = E
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, scale(this.c.bg, 1.25)); g.addColorStop(1, scale(this.c.bg, 0.75))
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const s = 40 * u
      for (let x = 0, k = 0; x <= W; x += s, k++) { ctx.strokeStyle = rgba('#ffffff', k % 5 === 0 ? 0.20 : 0.07); ctx.lineWidth = (k % 5 === 0 ? 1.5 : 1) * u; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0, k = 0; y <= H; y += s, k++) { ctx.strokeStyle = rgba('#ffffff', k % 5 === 0 ? 0.20 : 0.07); ctx.lineWidth = (k % 5 === 0 ? 1.5 : 1) * u; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
      // 图框和四角的对位标记
      const m = 36 * u
      ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 2 * u; ctx.strokeRect(m, m, W - 2 * m, H - 2 * m)
      for (const [cx, cy] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) { ctx.beginPath(); ctx.moveTo(cx - 14 * u, cy); ctx.lineTo(cx + 14 * u, cy); ctx.moveTo(cx, cy - 14 * u); ctx.lineTo(cx, cy + 14 * u); ctx.stroke() }
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, p = o.p ?? 1, col = o.tone === 'accent' ? this.c.accent : this.c.line
      ctx.save(); ctx.fillStyle = rgba(scale(this.c.bg, 0.75), 0.55); ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = col; ctx.lineWidth = 2 * u; ctx.setLineDash([2 * (w + h)]); ctx.lineDashOffset = 2 * (w + h) * (1 - p); ctx.strokeRect(x, y, w, h); ctx.setLineDash([])
      const k = 16 * u; ctx.lineWidth = 4 * u; ctx.globalAlpha = p
      for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + sx * k, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * k); ctx.stroke() }
      ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, col = o.color ?? this.c.accent
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
      ctx.fillStyle = rgba(col, 0.18); ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = 2 * u
      const x0 = Math.min(x, x + w), x1 = Math.max(x, x + w), y0 = Math.min(y, y + h), y1 = Math.max(y, y + h)
      for (let d = x0 - (y1 - y0); d < x1; d += 14 * u) { ctx.beginPath(); ctx.moveTo(d, y1); ctx.lineTo(d + (y1 - y0), y0); ctx.stroke() }
      ctx.restore(); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3 * u; ctx.strokeRect(x, y, w, h); ctx.restore()
    },
    markHollow: true,
    mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.strokeStyle = o.color ?? this.c.accent; ctx.lineWidth = 3 * E.u; ctx.fillStyle = scale(this.c.bg, 0.75); ctx.beginPath(); ctx.rect(x - r, y - r, 2 * r, 2 * r); ctx.fill(); ctx.stroke(); ctx.restore() },
    line(ctx, E, x1, y1, x2, y2, o = {}) {
      base.line.call(this, ctx, E, x1, y1, x2, y2, { width: 2.5, ...o })
      if ((o.p ?? 1) >= 1 && o.ticks !== false) { const u = E.u, a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2, k = 9 * u; ctx.save(); ctx.strokeStyle = o.color ?? this.c.accent; ctx.lineWidth = 2.5 * u; for (const [px, py] of [[x1, y1], [x2, y2]]) { ctx.beginPath(); ctx.moveTo(px - Math.cos(a) * k, py - Math.sin(a) * k); ctx.lineTo(px + Math.cos(a) * k, py + Math.sin(a) * k); ctx.stroke() } ctx.restore() }
    },
    music: { style: 'calm', prog: ['Dm9', 'Bbmaj7', 'F', 'C'], lead: 'pluck', drums: false },
    sfx: { enter: 'type', cut: 'whoosh', accent: 'chime' },
  },

  whiteboard: {
    ...base, id: 'whiteboard', name: '手绘白板', mood: '老师边画边讲，讲流程和因果', bpm: 100,
    c: { bg: '#fdfdfb', fg: '#1d1d1f', muted: '#5f6368', accent: '#1f5fd1', accent2: '#d93a2b', card: '#fdfdfb', line: '#1d1d1f', onAccent: '#ffffff' },
    fontTitle: 'hand', fontBody: 'hand', fontNum: 'hand', wTitle: 700, wBody: 500, radius: 0, motion: 'draw', transition: 'slide',
    bg(ctx, E) {
      const { W, H, u } = E
      ctx.fillStyle = this.c.bg; ctx.fillRect(0, 0, W, H)
      // 没擦干净的痕迹
      for (let i = 0; i < 7; i++) { const x = hash(i, 11) * W, y = hash(i, 12) * H, R = (160 + hash(i, 13) * 260) * u, g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, rgba('#6b7280', 0.05)); g.addColorStop(1, rgba('#6b7280', 0)); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, 2 * R, 2 * R) }
      ctx.strokeStyle = '#c9ccd1'; ctx.lineWidth = 10 * u; ctx.strokeRect(5 * u, 5 * u, W - 10 * u, H - 10 * u)
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, p = o.p ?? 1, per = 2 * (w + h), seed = (o.seed ?? 1) * 97 + tick8(E)
      const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]
      let left = per * p, pts = [corners[0]]
      for (let i = 0; i < 4 && left > 0; i++) { const [ax, ay] = corners[i], [bx, by] = corners[i + 1], L = Math.hypot(bx - ax, by - ay), q = Math.min(1, left / L); pts = pts.concat(segPoints(ax, ay, bx, by, q, 90 * u).slice(1)); left -= L }
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 5 * u; ctx.strokeStyle = o.tone === 'accent' ? this.c.accent : this.c.line
      wobblyPath(ctx, pts, 5 * u, seed); ctx.stroke(); ctx.restore()
    },
    line(ctx, E, x1, y1, x2, y2, o = {}) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = (o.width ?? 5) * E.u; ctx.strokeStyle = o.color ?? this.c.accent
      wobblyPath(ctx, segPoints(x1, y1, x2, y2, o.p ?? 1, 70 * E.u), 4 * E.u, (o.seed ?? 3) * 131 + tick8(E)); ctx.stroke(); ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, col = o.color ?? this.c.accent, seed = (o.seed ?? 5) * 53 + tick8(E)
      const x0 = Math.min(x, x + w), x1 = Math.max(x, x + w), y0 = Math.min(y, y + h), y1 = Math.max(y, y + h)
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.strokeStyle = rgba(col, 0.85); ctx.lineWidth = 4 * u; ctx.lineCap = 'round'
      const r = rng(seed)
      for (let d = x0 - (y1 - y0); d < x1; d += 16 * u) { ctx.beginPath(); ctx.moveTo(d + (r() - 0.5) * 5 * u, y1); ctx.lineTo(d + (y1 - y0) + (r() - 0.5) * 5 * u, y0); ctx.stroke() }
      ctx.restore()
      this.card(ctx, E, x0, y0, x1 - x0, y1 - y0, { seed: o.seed ?? 5 })
    },
    mark(ctx, E, x, y, r, i, o = {}) {
      const n = 14, pts = []; for (let k = 0; k <= n + 1; k++) { const a = (k / n) * TAU; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]) }
      ctx.save(); ctx.lineWidth = 4.5 * E.u; ctx.lineJoin = 'round'; ctx.strokeStyle = o.color ?? this.c.accent2; wobblyPath(ctx, pts, 3.5 * E.u, (i + 7) * 71 + tick8(E)); ctx.stroke(); ctx.restore()
    },
    markHollow: true,
    underline(ctx, E, x, y, w, p) { this.line(ctx, E, x, y + 4 * E.u, x + w, y, { p, width: 6, color: this.c.accent2, seed: 9 }) },
    music: { style: 'bright', prog: ['C', 'Am', 'F', 'G'], lead: 'marimba', drums: false },
    sfx: { enter: 'type', cut: 'whoosh', accent: 'pop' },
  },

  neon: {
    ...base, id: 'neon', name: '霓虹夜色', mood: '发光的线条和透视网格，科技、游戏、电子音乐', bpm: 110,
    c: { bg: '#0b0714', fg: '#f5f0ff', muted: '#a79bc9', accent: '#00e5ff', accent2: '#ff2bd6', card: '#150d26', line: '#4a3a86', onAccent: '#0b0714' },
    wTitle: 800, radius: 10, motion: 'pop', transition: 'cut',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
      // 地平线上一团光，下面是朝镜头滚过来的透视网格
      const hy = H * 0.66
      const glow = ctx.createRadialGradient(W / 2, hy, 0, W / 2, hy, Math.max(W, H) * 0.55); glow.addColorStop(0, rgba(c.accent2, 0.24)); glow.addColorStop(1, rgba(c.accent2, 0))
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = rgba(c.accent, 0.16); ctx.lineWidth = 1.5 * u
      for (let i = -30; i <= 30; i++) { ctx.beginPath(); ctx.moveTo(W / 2, hy); ctx.lineTo(W / 2 + i * 160 * u, H); ctx.stroke() }
      for (let k = 0; k < 12; k++) { const q = ((k + (E.T * 0.35) % 1) / 12) ** 2.2, y = hy + (H - hy) * q; ctx.globalAlpha = 0.25 + 0.75 * q; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
      ctx.globalAlpha = 1
      ctx.strokeStyle = rgba(c.accent2, 0.5); ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke()
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, col = o.tone === 'accent' ? this.c.accent : this.c.accent2
      ctx.save(); roundRect(ctx, x, y, w, h, this.radius * u)
      ctx.fillStyle = rgba(this.c.card, 0.85); ctx.fill()
      if (o.tone === 'accent') { ctx.fillStyle = rgba(col, 0.12); ctx.fill() }
      ctx.shadowColor = col; ctx.shadowBlur = 22 * u; ctx.lineWidth = 2.5 * u; ctx.strokeStyle = col; ctx.stroke(); ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) {
      const col = o.color ?? this.c.accent
      ctx.save(); roundRect(ctx, x, y, w, h, Math.min(6 * E.u, Math.abs(w) / 2, Math.abs(h) / 2)); ctx.shadowColor = col; ctx.shadowBlur = 26 * E.u; ctx.fillStyle = col; ctx.fill(); ctx.restore()
    },
    markHollow: true,
    mark(ctx, E, x, y, r, i, o = {}) {
      const col = o.color ?? [this.c.accent, this.c.accent2][i % 2]
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = this.c.bg; ctx.fill(); ctx.shadowColor = col; ctx.shadowBlur = 18 * E.u; ctx.lineWidth = 3 * E.u; ctx.strokeStyle = col; ctx.stroke(); ctx.restore()
    },
    underline(ctx, E, x, y, w, p) { ctx.save(); ctx.shadowColor = this.c.accent2; ctx.shadowBlur = 20 * E.u; ctx.fillStyle = this.c.accent2; ctx.fillRect(x, y, w * p, 5 * E.u); ctx.restore() },
    music: { style: 'drive', prog: ['Am', 'F', 'C', 'G'], lead: 'pluck', drums: true },
    sfx: { enter: 'tick', cut: 'glitch', accent: 'chime' },
  },

  paper: {
    ...base, id: 'paper', solidAccent: true, name: '报刊杂志', mood: '衬线大标题和细线，评论、读书、人文话题', bpm: 80,
    c: { bg: '#f3ecdd', fg: '#1c1a17', muted: '#7a7266', accent: '#b3261e', accent2: '#1d4e6f', card: '#f9f4e9', line: '#1c1a17', onAccent: '#fbf6ec' },
    fontTitle: 'serif', fontBody: 'serif', fontNum: 'serif', wTitle: 900, wBody: 500, radius: 0, motion: 'fade', transition: 'fade',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
      // 纸面的细颗粒，位置固定
      for (let i = 0; i < 900; i++) { ctx.fillStyle = rgba(c.fg, 0.03 + hash(i, 23) * 0.05); ctx.fillRect(hash(i, 21) * W, hash(i, 22) * H, 2 * u, 2 * u) }
      // 报头的粗细双线，页脚一条细线
      const m = E.safe.l * 0.5
      ctx.fillStyle = c.fg; ctx.fillRect(m, 40 * u, W - 2 * m, 6 * u); ctx.fillRect(m, 52 * u, W - 2 * m, 1.5 * u); ctx.fillRect(m, H - 42 * u, W - 2 * m, 1.5 * u)
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, c = this.c
      ctx.save()
      if (o.tone === 'accent') { ctx.fillStyle = c.accent; ctx.fillRect(x, y, w, h) }
      else { ctx.fillStyle = c.card; ctx.fillRect(x, y, w, h); ctx.strokeStyle = rgba(c.line, 0.35); ctx.lineWidth = 1.5 * u; ctx.strokeRect(x, y, w, h); ctx.fillStyle = c.line; ctx.fillRect(x, y, w, 5 * u) }
      ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) { ctx.save(); ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(x, y, w, h); ctx.restore() },
    mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore() },
    underline(ctx, E, x, y, w, p) { ctx.save(); ctx.fillStyle = this.c.accent; ctx.fillRect(x, y, w * p, 6 * E.u); ctx.fillRect(x, y + 10 * E.u, w * p, 1.5 * E.u); ctx.restore() },
    music: { style: 'calm', prog: ['Fmaj7', 'Dm7', 'Bbmaj7', 'C'], lead: 'piano', drums: false },
    sfx: { enter: 'click', cut: 'whoosh', accent: 'chime' },
  },

  terminal: {
    ...base, id: 'terminal', solidAccent: true, name: '终端', mood: '等宽字和绿色光标，代码、命令行、开发工具', bpm: 96,
    c: { bg: '#0b1410', fg: '#d9ffe6', muted: '#74b08a', accent: '#39ff88', accent2: '#ffcc4d', card: '#0f1d17', line: '#2f6a4a', onAccent: '#06130b' },
    fontTitle: 'mono', fontBody: 'mono', fontNum: 'mono', wTitle: 700, wBody: 400, radius: 6, motion: 'draw', transition: 'cut',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
      const v = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2); v.addColorStop(0, rgba(c.accent, 0.07)); v.addColorStop(1, rgba(c.accent, 0))
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)
      // 扫描线
      ctx.fillStyle = rgba('#000000', 0.16); for (let y = 0; y < H; y += 6 * u) ctx.fillRect(0, y, W, 2 * u)
      // 窗口的标题栏和三个圆点
      ctx.fillStyle = rgba(c.fg, 0.07); ctx.fillRect(0, 0, W, 46 * u)
      ;['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc((34 + i * 30) * u, 23 * u, 8 * u, 0, TAU); ctx.fill() })
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, acc = o.tone === 'accent'
      ctx.save(); roundRect(ctx, x, y, w, h, this.radius * u); ctx.fillStyle = acc ? this.c.accent : this.c.card; ctx.fill()
      if (!acc) { ctx.setLineDash([10 * u, 8 * u]); ctx.lineWidth = 2 * u; ctx.strokeStyle = this.c.line; ctx.stroke() }
      ctx.restore()
    },
    // 条形画成一格一格的方块，从左下角排起
    bar(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, x0 = Math.min(x, x + w), y0 = Math.min(y, y + h), bw = Math.abs(w), bh = Math.abs(h), cell = 20 * u, gap = 4 * u
      ctx.save(); ctx.fillStyle = o.color ?? this.c.accent
      for (let dy = 0; dy < bh; dy += cell) for (let dx = 0; dx < bw; dx += cell) { const sw = Math.min(cell - gap, bw - dx), sh = Math.min(cell - gap, bh - dy); if (sw > 0 && sh > 0) ctx.fillRect(x0 + dx, y0 + bh - dy - sh, sw, sh) }
      ctx.restore()
    },
    mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore() },
    // 标题下面一条线，画完以后线尾有一个闪烁的光标
    underline(ctx, E, x, y, w, p) { const u = E.u; ctx.save(); ctx.fillStyle = this.c.accent; ctx.fillRect(x, y, w * p, 4 * u); if (p >= 1 && Math.floor(E.T * 2) % 2 === 0) ctx.fillRect(x + w + 10 * u, y - 22 * u, 14 * u, 26 * u); ctx.restore() },
    music: { style: 'bright', prog: ['Am7', 'Fmaj7', 'C', 'G'], lead: 'pluck', drums: true },
    sfx: { enter: 'type', cut: 'glitch', accent: 'pop' },
  },

  ink: {
    ...base, id: 'ink', solidAccent: true, name: '水墨', mood: '宣纸、远山和朱红印章，传统文化、诗词、历史', bpm: 66,
    c: { bg: '#f4efe4', fg: '#1b1b1b', muted: '#6b655a', accent: '#b8322a', accent2: '#2f5d50', card: '#f4efe4', line: '#1b1b1b', onAccent: '#fff8ee' },
    fontTitle: 'serif', fontBody: 'serif', fontNum: 'serif', wTitle: 700, wBody: 500, radius: 6, motion: 'fade', transition: 'fade',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
      // 右上角一轮淡日
      ctx.fillStyle = rgba(c.accent, 0.16); ctx.beginPath(); ctx.arc(W - 96 * u, 110 * u, 62 * u, 0, TAU); ctx.fill()
      // 三层远山，越近越深，各自慢慢横移，山脚化进纸里
      for (let k = 0; k < 3; k++) {
        const y0 = H * (0.80 + k * 0.06), amp = (70 - k * 14) * u, sh = E.T * (4 + k * 5) * u
        ctx.beginPath(); ctx.moveTo(0, H)
        for (let x = 0; x <= W + 12 * u; x += 12 * u) { const q = (x + sh) / u; ctx.lineTo(x, y0 - amp * (0.55 * Math.sin(q * 0.0041 + k * 1.7) + 0.3 * Math.sin(q * 0.0097 + k * 4.1) + 0.15 * Math.sin(q * 0.023 + k))) }
        ctx.lineTo(W + 12 * u, H); ctx.closePath()
        const g = ctx.createLinearGradient(0, y0 - amp, 0, H); g.addColorStop(0, rgba(c.fg, 0.10 + k * 0.05)); g.addColorStop(1, rgba(c.fg, 0))
        ctx.fillStyle = g; ctx.fill()
      }
    },
    card(ctx, E, x, y, w, h, o = {}) {
      const u = E.u, c = this.c
      ctx.save(); roundRect(ctx, x, y, w, h, this.radius * u)
      if (o.tone === 'accent') { ctx.fillStyle = c.accent; ctx.fill() } else { ctx.fillStyle = rgba(c.card, 0.7); ctx.fill(); ctx.lineWidth = 2 * u; ctx.strokeStyle = rgba(c.line, 0.6); ctx.stroke() }
      ctx.restore()
    },
    // 标记画成一方印章
    mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); roundRect(ctx, x - r, y - r, 2 * r, 2 * r, r * 0.28); ctx.fillStyle = o.color ?? this.c.accent; ctx.fill(); ctx.restore() },
    // 标题下面一笔：起笔粗，收笔尖
    underline(ctx, E, x, y, w, p) {
      const u = E.u, L = w * p; if (L <= 0) return
      ctx.save(); ctx.fillStyle = this.c.fg; ctx.beginPath(); ctx.moveTo(x, y - 1 * u); ctx.quadraticCurveTo(x + L * 0.3, y - 3 * u, x + L, y + 3 * u); ctx.quadraticCurveTo(x + L * 0.3, y + 11 * u, x, y + 9 * u); ctx.closePath(); ctx.fill(); ctx.restore()
    },
    music: { style: 'ambient', prog: ['Am9', 'Fmaj7', 'Cmaj7', 'Em7'], lead: 'pluck', drums: false },
    sfx: { enter: 'click', cut: 'swell', accent: 'chime' },
  },

  bold: {
    ...base, id: 'bold', solidAccent: true, name: '黑白大字', mood: '粗黑体、硬切、只用一种强调色，观点、口号、榜单', bpm: 126,
    c: { bg: '#f2f1ed', fg: '#0d0d0d', muted: '#55534e', accent: '#ff3b1f', accent2: '#0d0d0d', card: '#ffffff', line: '#0d0d0d', onAccent: '#ffffff' },
    wTitle: 900, wBody: 600, radius: 0, motion: 'slam', transition: 'cut',
    bg(ctx, E) {
      const { W, H, u } = E, c = this.c
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H)
      // 右下角一个很大的场次数字；顶上一条粗带，随全片进度填上强调色
      ctx.font = E.font('num', 900, 620 * u); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = rgba(c.fg, 0.06)
      ctx.fillText(String(E.sceneIndex + 1).padStart(2, '0'), W - 30 * u, H + 60 * u)
      ctx.fillStyle = c.fg; ctx.fillRect(0, 0, W, 22 * u)
      ctx.fillStyle = c.accent; ctx.fillRect(0, 0, W * clamp(E.T / E.total), 22 * u)
    },
    card(ctx, E, x, y, w, h, o = {}) {
      ctx.save(); ctx.fillStyle = o.tone === 'accent' ? this.c.accent : this.c.card; ctx.fillRect(x, y, w, h); ctx.lineWidth = 6 * E.u; ctx.strokeStyle = this.c.line; ctx.strokeRect(x, y, w, h); ctx.restore()
    },
    bar(ctx, E, x, y, w, h, o = {}) { ctx.save(); ctx.fillStyle = o.color ?? this.c.accent; ctx.fillRect(x, y, w, h); ctx.restore() },
    mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.fillStyle = o.color ?? this.c.fg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore() },
    underline(ctx, E, x, y, w, p) { ctx.save(); ctx.fillStyle = this.c.accent; ctx.fillRect(x, y, w * p, 18 * E.u); ctx.restore() },
    music: { style: 'drive', prog: ['Em', 'C', 'G', 'D'], lead: 'pluck', drums: true },
    sfx: { enter: 'click', cut: 'thud', accent: 'pop' },
  },
}

// 黑板粉笔：线条的画法和手绘白板相同，换成深色的板面和粉笔的颜色
THEMES.chalk = {
  ...THEMES.whiteboard, id: 'chalk', name: '黑板粉笔', mood: '课堂板书，讲题、讲公式、讲步骤', bpm: 92,
  c: { bg: '#21443a', fg: '#f4f1e6', muted: '#b7c9be', accent: '#ffd866', accent2: '#ff9f8f', card: '#21443a', line: '#f4f1e6', onAccent: '#21443a' },
  transition: 'fade',
  bg(ctx, E) {
    const { W, H, u } = E, c = this.c
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, scale(c.bg, 1.12)); g.addColorStop(1, scale(c.bg, 0.8))
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    // 没擦干净的粉笔灰
    for (let i = 0; i < 9; i++) { const x = hash(i, 31) * W, y = hash(i, 32) * H, R = (180 + hash(i, 33) * 300) * u, d = ctx.createRadialGradient(x, y, 0, x, y, R); d.addColorStop(0, rgba('#ffffff', 0.05)); d.addColorStop(1, rgba('#ffffff', 0)); ctx.fillStyle = d; ctx.fillRect(x - R, y - R, 2 * R, 2 * R) }
    // 木头边框
    ctx.strokeStyle = '#8a5a36'; ctx.lineWidth = 18 * u; ctx.strokeRect(9 * u, 9 * u, W - 18 * u, H - 18 * u)
  },
  music: { style: 'calm', prog: ['C', 'Am', 'F', 'G'], lead: 'epiano', drums: false },
}

export const THEME_IDS = Object.keys(THEMES)

// 风格包：styles/<id>/index.mjs。一个风格包是一整套画面，可以把九种版式都按自己的样子重画；用到时才加载。
const STYLE_DIR = new URL('./styles/', import.meta.url)
const styleDir = fileURLToPath(STYLE_DIR)
export const STYLE_IDS = fs.existsSync(styleDir) ? fs.readdirSync(styleDir, { withFileTypes: true }).filter(d => d.isDirectory() && fs.existsSync(fileURLToPath(new URL(d.name + '/index.mjs', STYLE_DIR)))).map(d => d.name).sort() : []
export const ALL_IDS = [...THEME_IDS, ...STYLE_IDS.filter(id => !THEMES[id])]
// id 也可以是一个 .mjs 文件的路径（自己写的风格包，相对 baseDir）
export async function loadTheme(id, colors, baseDir = process.cwd()) {
  if (THEMES[id]) return getTheme(id, colors)
  const own = String(id).endsWith('.mjs')
  if (!own && !STYLE_IDS.includes(id)) return null
  const mod = await import(own ? pathToFileURL(path.resolve(baseDir, id)).href : new URL(id + '/index.mjs', STYLE_DIR).href)
  if (!mod.default || typeof mod.default !== 'object' || !mod.default.c || typeof mod.default.bg !== 'function') throw new Error(`风格包 ${id} 要默认导出一个对象，至少有 c（八个颜色）和 bg(ctx, E)。写法见 references/style-packs.md`)
  const t = { ...base, ...mod.default, id: own ? path.basename(path.dirname(path.resolve(baseDir, id))) : id }
  return colors ? { ...t, c: { ...t.c, ...colors } } : t
}

// video.json 里的 "colors" 可以覆盖主题色
export function getTheme(id, colors) {
  const t = THEMES[id]
  if (!t) return null
  return colors ? { ...t, c: { ...t.c, ...colors } } : t
}
