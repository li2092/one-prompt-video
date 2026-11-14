// 道具：纸卡、胶带、图钉、便签、白板、举牌、工位（侧面的桌椅和笔记本）、长桌、文件夹、活页夹、木夹子、
// 对话气泡、勾、手绘圈、手绘箭头、马克笔线、盆栽。桌椅和笔记本移植自风格库的 E-实习生小剧场。
// 投影不用 shadowBlur：往下错开画两层半透明暖灰，出帧快。
import { mix, clamp, roundRect as rr } from '../../../core.mjs'

const TAU = Math.PI * 2
export const WOOD = { wood: '#C9A47A', light: '#D8B98F', shade: '#A9875F', metal: '#B9B2A8', note: '#F6E7C4' }

// 一张带投影的纸卡（左上角 x,y）
export function paper(ctx, x, y, w, h, r, fill, u, o = {}) {
  const sh = (o.sh ?? 5) * u
  if (sh > 0) {
    ctx.fillStyle = 'rgba(80,60,40,0.09)'; rr(ctx, x + sh * 0.3, y + sh, w, h, r); ctx.fill()
    ctx.fillStyle = 'rgba(80,60,40,0.07)'; rr(ctx, x, y + sh * 0.45, w, h, r); ctx.fill()
  }
  ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill()
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = (o.lw ?? 1.6) * u; rr(ctx, x, y, w, h, r); ctx.stroke() }
}

export function tape(ctx, x, y, w, rot, u) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
  ctx.fillStyle = 'rgba(255,252,238,0.66)'; ctx.fillRect(-w / 2, -w * 0.17, w, w * 0.34)
  ctx.strokeStyle = 'rgba(150,125,95,0.2)'; ctx.lineWidth = u; ctx.strokeRect(-w / 2, -w * 0.17, w, w * 0.34)
  ctx.restore()
}

export function pin(ctx, x, y, r, col) {
  ctx.fillStyle = 'rgba(80,60,40,0.18)'; ctx.beginPath(); ctx.arc(x + r * 0.35, y + r * 0.5, r, 0, TAU); ctx.fill()
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, TAU); ctx.fill()
}

// 便签：上沿一条背胶的深色，右下角翘起一点
export function sticky(ctx, x, y, w, h, fill, u) {
  paper(ctx, x, y, w, h, 3 * u, fill, u, { sh: 4 })
  ctx.fillStyle = 'rgba(120,90,40,0.07)'; ctx.fillRect(x, y, w, Math.min(h * 0.16, 16 * u))
  const c = Math.min(w, h) * 0.18
  ctx.fillStyle = mix(fill, '#7a5a30', 0.2)
  ctx.beginPath(); ctx.moveTo(x + w - c, y + h); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c * 0.9, y + h - c * 0.9); ctx.closePath(); ctx.fill()
}

// 白板：金属框、白底、下沿笔槽和两支笔
export function whiteboard(ctx, x, y, w, h, u, accent) {
  paper(ctx, x, y, w, h, 10 * u, WOOD.metal, u, { sh: 7 })
  ctx.fillStyle = '#FDFCF8'; rr(ctx, x + 9 * u, y + 9 * u, w - 18 * u, h - 18 * u, 5 * u); ctx.fill()
  ctx.strokeStyle = 'rgba(160,150,140,0.12)'; ctx.lineWidth = 10 * u; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x + w * 0.7, y + h * 0.25); ctx.quadraticCurveTo(x + w * 0.82, y + h * 0.2, x + w * 0.9, y + h * 0.3); ctx.stroke()
  ctx.fillStyle = '#A39B90'; rr(ctx, x + w * 0.55, y + h - 4 * u, w * 0.36, 12 * u, 4 * u); ctx.fill()
  ctx.fillStyle = accent; rr(ctx, x + w * 0.6, y + h - 12 * u, 70 * u, 9 * u, 4 * u); ctx.fill()
  ctx.fillStyle = '#3A3F4B'; rr(ctx, x + w * 0.6 + 86 * u, y + h - 12 * u, 70 * u, 9 * u, 4 * u); ctx.fill()
}

// 举牌：白卡纸、粗墨线边
export function sign(ctx, x, y, w, h, u, bg, border) {
  paper(ctx, x, y, w, h, 16 * u, bg, u, { sh: 7 })
  ctx.strokeStyle = border; ctx.lineWidth = 4 * u; rr(ctx, x, y, w, h, 16 * u); ctx.stroke()
}

// 侧面的工位桌：x0..x0+w，桌面上沿 y
export function desk(ctx, x0, y, w, floor, u) {
  const th = 18 * u
  ctx.fillStyle = WOOD.shade
  ctx.fillRect(x0 + w - 44 * u, y + th, 15 * u, floor - y - th)
  ctx.fillRect(x0 + 34 * u, y + th, 15 * u, floor - y - th)
  ctx.fillStyle = WOOD.wood
  rr(ctx, x0 + w * 0.64, y + th, 0.3 * w, (floor - y - th) * 0.5, 4 * u); ctx.fill()
  ctx.fillStyle = WOOD.shade
  ctx.fillRect(x0 + w * 0.76, y + th + (floor - y - th) * 0.22, 0.06 * w, 4 * u)
  ctx.fillStyle = WOOD.light; rr(ctx, x0, y, w, th, 5 * u); ctx.fill()
  ctx.fillStyle = WOOD.shade; ctx.fillRect(x0 + 6 * u, y + th - 4 * u, w - 12 * u, 4 * u)
}

export function chair(ctx, seatX, seatY, h, floor) {
  ctx.save(); ctx.translate(seatX, 0)
  const col = '#7A6F86', colD = '#625872'
  ctx.fillStyle = colD
  ctx.fillRect(-0.06 * h, seatY + 0.1 * h, 0.12 * h, floor - seatY - 0.22 * h)
  ctx.fillRect(-0.55 * h, floor - 0.16 * h, 1.1 * h, 0.07 * h)
  for (const x of [-0.5, 0.5]) { ctx.beginPath(); ctx.arc(x * h, floor - 0.06 * h, 0.06 * h, 0, TAU); ctx.fill() }
  ctx.fillStyle = col; rr(ctx, -0.78 * h, seatY - 1.55 * h, 0.26 * h, 1.3 * h, 0.12 * h); ctx.fill()
  ctx.fillStyle = colD; ctx.fillRect(-0.62 * h, seatY - 0.3 * h, 0.08 * h, 0.4 * h)
  ctx.fillStyle = col; rr(ctx, -0.7 * h, seatY, 1.25 * h, 0.2 * h, 0.08 * h); ctx.fill()
  ctx.restore()
}

// 笔记本电脑（侧面）：x 键盘中心，y 桌面，s 宽
export function laptop(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y)
  ctx.fillStyle = '#B9B2A8'; rr(ctx, -s * 0.5, -s * 0.045, s, s * 0.045, s * 0.015); ctx.fill()
  ctx.fillStyle = '#9F978C'
  ctx.beginPath(); ctx.moveTo(s * 0.22, -s * 0.05); ctx.lineTo(s * 0.5, -s * 0.06); ctx.lineTo(s * 0.44, -s * 0.74); ctx.lineTo(s * 0.16, -s * 0.7); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#C5BEB4'
  ctx.beginPath(); ctx.moveTo(s * 0.24, -s * 0.08); ctx.lineTo(s * 0.47, -s * 0.09); ctx.lineTo(s * 0.42, -s * 0.71); ctx.lineTo(s * 0.19, -s * 0.68); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(255,246,226,0.85)'; ctx.lineWidth = s * 0.014
  ctx.beginPath(); ctx.moveTo(s * 0.16, -s * 0.7); ctx.lineTo(s * 0.22, -s * 0.05); ctx.stroke()
  ctx.restore()
}

// 正面的长桌：桌面上沿 y，前挡板高 apron（标签贴在上面）
export function longDesk(ctx, x0, x1, y, floor, apron, u) {
  ctx.fillStyle = WOOD.shade
  for (const x of [x0 + 18 * u, x1 - 34 * u]) ctx.fillRect(x, y, 16 * u, floor - y)
  ctx.fillStyle = 'rgba(90,70,50,0.10)'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, floor, (x1 - x0) * 0.55, 10 * u, 0, 0, TAU); ctx.fill()
  ctx.fillStyle = WOOD.wood; rr(ctx, x0, y + 12 * u, x1 - x0, apron, 4 * u); ctx.fill()
  ctx.fillStyle = WOOD.light; rr(ctx, x0 - 14 * u, y, x1 - x0 + 28 * u, 18 * u, 5 * u); ctx.fill()
  ctx.fillStyle = WOOD.shade; ctx.fillRect(x0 - 8 * u, y + 14 * u, x1 - x0 + 16 * u, 4 * u)
}

// 一层文件夹（正面看是一块薄板）：底边中心 (cx, y)，宽 w 厚 th；j 是第几层，用来错开和加纸边
export function folder(ctx, cx, y, w, th, col, j, u) {
  const dx = (((j * 37) % 7) - 3) * 1.6 * u
  ctx.fillStyle = col; rr(ctx, cx - w / 2 + dx, y - th, w, th, Math.min(4 * u, th / 3)); ctx.fill()
  ctx.fillStyle = 'rgba(60,40,20,0.16)'; ctx.fillRect(cx - w / 2 + dx + 3 * u, y - Math.max(1.5 * u, th * 0.14), w - 6 * u, Math.max(1.5 * u, th * 0.14))
  if (th > 9 * u) { ctx.fillStyle = 'rgba(251,247,239,0.92)'; ctx.fillRect(cx + dx + (j % 2 ? -w * 0.34 : w * 0.08), y - th * 0.62, w * 0.26, th * 0.3) }
}

// 活页夹（书脊朝外立着）：左下角 x、底 y
export function binder(ctx, x, y, w, h, col, u) {
  ctx.fillStyle = col; rr(ctx, x, y - h, w, h, 3 * u); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + w - Math.max(1.5 * u, w * 0.12), y - h, Math.max(1.5 * u, w * 0.12), h)
  if (w > 12 * u) {
    ctx.fillStyle = 'rgba(251,247,239,0.9)'; ctx.fillRect(x + w * 0.2, y - h * 0.8, w * 0.6, h * 0.26)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(x + w * 0.5, y - h * 0.22, Math.min(w * 0.18, h * 0.08), 0, TAU); ctx.fill()
  }
}

// 木夹子：夹口在 (x, y)，高 s
export function clip(ctx, x, y, s) {
  ctx.fillStyle = '#B88C5E'; rr(ctx, x - s * 0.16, y - s * 0.55, s * 0.32, s * 1.05, s * 0.06); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x - s * 0.01, y - s * 0.55, s * 0.02, s * 1.05)
  ctx.fillStyle = '#8F9399'; ctx.fillRect(x - s * 0.2, y - s * 0.12, s * 0.4, s * 0.08)
}

// 对话气泡：左上角 x,y；tri = 尾巴三角形的三个点（两个根部点在气泡边上，第三个是尖）
export function bubble(ctx, x, y, w, h, tri, fill, stroke, u) {
  const r = Math.min(h * 0.3, 60 * u)
  const tail = () => { ctx.beginPath(); ctx.moveTo(...tri[0]); ctx.lineTo(...tri[2]); ctx.lineTo(...tri[1]); ctx.closePath() }
  ctx.fillStyle = 'rgba(80,60,40,0.10)'; rr(ctx, x + 3 * u, y + 7 * u, w, h, r); ctx.fill()
  ctx.lineWidth = 3.5 * u; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'
  rr(ctx, x, y, w, h, r); ctx.stroke(); tail(); ctx.stroke()
  ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill(); tail(); ctx.fill()
}

// 逐笔画出的勾
export function check(ctx, x, y, s, p, col, lw = 0.16) {
  if (p <= 0) return
  ctx.save(); ctx.translate(x, y)
  ctx.strokeStyle = col; ctx.lineWidth = s * lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const pts = [[-0.42, 0.02], [-0.12, 0.32], [0.46, -0.36]], seg = [0.424, 0.894]
  let rem = clamp(p) * (seg[0] + seg[1])
  ctx.beginPath(); ctx.moveTo(pts[0][0] * s, pts[0][1] * s)
  for (let i = 0; i < 2 && rem > 0; i++) {
    const f = Math.min(1, rem / seg[i]); rem -= seg[i]
    ctx.lineTo((pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f) * s, (pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f) * s)
  }
  ctx.stroke(); ctx.restore()
}

// 手绘圈：逐段画出，末端多绕一点
export function handCircle(ctx, x, y, rx, ry, p, col, lw, seed = 1) {
  if (p <= 0) return
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  const n = 80, end = 1.12 * clamp(p)
  for (let i = 0; i <= n * end; i++) {
    const a = -2.2 + (i / n) * TAU, wob = 1 + 0.03 * Math.sin(i * 0.31 + seed) + 0.04 * (i / n)
    const px = x + Math.cos(a) * rx * wob, py = y + Math.sin(a) * ry * wob
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.stroke(); ctx.restore()
}

// 手绘箭头：二次曲线，画完再加箭头
export function handArrow(ctx, ax, ay, bx, by, p, col, lw, bend = 0.2) {
  if (p <= 0) return
  const mx = (ax + bx) / 2 - (by - ay) * bend, my = (ay + by) / 2 + (bx - ax) * bend
  const q = t => [(1 - t) * (1 - t) * ax + 2 * (1 - t) * t * mx + t * t * bx, (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * my + t * t * by]
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath()
  const n = 24, e = clamp(p)
  for (let i = 0; i <= n * e; i++) { const [px, py] = q(i / n); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) }
  ctx.stroke()
  if (e > 0.95) {
    const [px, py] = q(1), [qx, qy] = q(0.9), a = Math.atan2(py - qy, px - qx), s = lw * 4.2
    ctx.beginPath(); ctx.moveTo(px - Math.cos(a - 0.5) * s, py - Math.sin(a - 0.5) * s); ctx.lineTo(px, py); ctx.lineTo(px - Math.cos(a + 0.5) * s, py - Math.sin(a + 0.5) * s); ctx.stroke()
  }
  ctx.restore()
}

// 马克笔线：手抖的一条线，逐段画出
export function marker(ctx, x0, y, w, p, col, lw, seed = 1) {
  if (p <= 0) return
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); ctx.moveTo(x0, y)
  const n = 14
  for (let i = 1; i <= n * clamp(p); i++) ctx.lineTo(x0 + w * i / n, y + Math.sin(i * 1.7 + seed) * lw * 0.3)
  ctx.stroke(); ctx.restore()
}

// 盆栽：底边中心 (x, y)，高 s
export function plant(ctx, x, y, s) {
  const lf = ['#7E9F78', '#6C8C67', '#8DAE85']
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.32, L = s * (0.62 + 0.18 * ((i * 5) % 3) / 2)
    ctx.save(); ctx.translate(x, y - s * 0.34); ctx.rotate(a + Math.PI / 2)
    ctx.fillStyle = lf[i % 3]; ctx.beginPath(); ctx.ellipse(0, -L / 2, s * 0.08, L / 2, 0, 0, TAU); ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#B98E6A'
  ctx.beginPath(); ctx.moveTo(x - s * 0.22, y - s * 0.38); ctx.lineTo(x + s * 0.22, y - s * 0.38); ctx.lineTo(x + s * 0.17, y); ctx.lineTo(x - s * 0.17, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#A57B58'; ctx.fillRect(x - s * 0.24, y - s * 0.42, s * 0.48, s * 0.07)
}
