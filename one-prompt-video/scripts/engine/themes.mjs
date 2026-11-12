// 六种风格主题。主题只管「长什么样、怎么动、配什么乐」，不管内容；同一份 video.json 换主题不用改别的。
// 新主题：复制一个对象，改颜色、字体、bg、card 就能用；在 video.json 里也可以用 "colors" 覆盖颜色。
import { rgba, mix, rng, hash, roundRect, lerp, clamp } from './core.mjs'

const TAU = Math.PI * 2

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

// ---------- 六种主题 ----------
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
      const tones = [c.bg, '#7cf0c8', '#ffb3d1', '#9ecbff']
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
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#070916'); g.addColorStop(0.55, c.bg); g.addColorStop(1, '#1b1240')
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
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2); g.addColorStop(0, '#16509f'); g.addColorStop(1, '#0b2f69')
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
      ctx.save(); ctx.fillStyle = rgba('#0b2f69', 0.55); ctx.fillRect(x, y, w, h)
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
    mark(ctx, E, x, y, r, i, o = {}) { ctx.save(); ctx.strokeStyle = o.color ?? this.c.accent; ctx.lineWidth = 3 * E.u; ctx.fillStyle = '#0b2f69'; ctx.beginPath(); ctx.rect(x - r, y - r, 2 * r, 2 * r); ctx.fill(); ctx.stroke(); ctx.restore() },
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
}

export const THEME_IDS = Object.keys(THEMES)

// video.json 里的 "colors" 可以覆盖主题色
export function getTheme(id, colors) {
  const t = THEMES[id]
  if (!t) return null
  return colors ? { ...t, c: { ...t.c, ...colors } } : t
}
