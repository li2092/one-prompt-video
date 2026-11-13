// 漫画分镜的画法库：分格、网点、集中线、速度线、旁白框、气泡、冲击字、拟声字、爆炸框。
// 移植自风格库的 V-漫画分镜 的 lib/comic.mjs。改动：颜色从主题的 c 取（K），字体用引擎的字体，
// 入场按 0..1 的进度（s.p(i)）算，不再按旁白逐词的时刻；网点贴图用 E.once 缓存。

// 主题的八个颜色在漫画里的用处：墨（字和线）、纸（页面）、白（格子里）、红（唯一的强调色）、灰、黑框、红底上的字、格框
export function K(E) {
  const c = E.theme.c
  return { ink: c.fg, paper: c.bg, white: c.card, red: c.accent, gray: c.muted, dark: c.accent2, on: c.onAccent, line: c.line }
}

// ---------- 分格 ----------
// 四边形格子：pts = [左上, 右上, 右下, 左下]。x y w h 是斜边以内的内容框，X0 Y0 X1 Y1 是连斜角在内的外包框（铺网点用）
export function quad(pts) {
  const [a, b, c, d] = pts, xs = pts.map(q => q[0]), ys = pts.map(q => q[1])
  const x = Math.max(a[0], d[0]), r = Math.min(b[0], c[0]), y = Math.max(a[1], b[1]), bt = Math.min(c[1], d[1])
  // m：按四边中点算的框（格子中线处的宽和高），斜度不大时排字用它，比斜边以内的框宽松
  const mx0 = (a[0] + d[0]) / 2, mx1 = (b[0] + c[0]) / 2, my0 = (a[1] + b[1]) / 2, my1 = (c[1] + d[1]) / 2
  const m = { x: mx0, y: my0, r: mx1, b: my1, w: mx1 - mx0, h: my1 - my0, cx: (mx0 + mx1) / 2, cy: (my0 + my1) / 2 }
  return { pts, x, y, r, b: bt, w: r - x, h: bt - y, cx: (x + r) / 2, cy: (y + bt) / 2, m, X0: Math.min(...xs), Y0: Math.min(...ys), X1: Math.max(...xs), Y1: Math.max(...ys) }
}
export const rect = (x0, y0, x1, y1) => quad([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
export function polyPath(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath() }

// 一排 n 格，竖向格缝斜切：格缝上端往右偏 sl、下端往左偏 sl，相邻格缝方向交替。ws 是各格的相对宽度
export function cols(R, n, gap, sl = 0, ws) {
  ws = ws || Array(n).fill(1)
  const tot = ws.reduce((a, b) => a + b, 0), avail = R.w - gap * (n - 1), g = []
  let x = R.x
  for (let k = 0; k < n - 1; k++) { x += avail * ws[k] / tot; g.push({ c: x + gap / 2, s: sl * (k % 2 ? -1 : 1) }); x += gap }
  return ws.map((_, k) => {
    const L = g[k - 1], Rg = g[k]
    return quad([[L ? L.c + gap / 2 + L.s : R.x, R.y], [Rg ? Rg.c - gap / 2 + Rg.s : R.r, R.y], [Rg ? Rg.c - gap / 2 - Rg.s : R.r, R.b], [L ? L.c + gap / 2 - L.s : R.x, R.b]])
  })
}
// 一列 n 格，横向格缝倾斜：格缝左端往下偏 sl、右端往上偏 sl，相邻格缝方向交替
export function rows(R, n, gap, sl = 0, hs) {
  hs = hs || Array(n).fill(1)
  const tot = hs.reduce((a, b) => a + b, 0), avail = R.h - gap * (n - 1), g = []
  let y = R.y
  for (let k = 0; k < n - 1; k++) { y += avail * hs[k] / tot; g.push({ c: y + gap / 2, s: sl * (k % 2 ? -1 : 1) }); y += gap }
  return hs.map((_, k) => {
    const T = g[k - 1], B = g[k]
    return quad([[R.x, T ? T.c + gap / 2 + T.s : R.y], [R.r, T ? T.c + gap / 2 - T.s : R.y], [R.r, B ? B.c - gap / 2 - B.s : R.b], [R.x, B ? B.c - gap / 2 + B.s : R.b]])
  })
}

// 画一格：p 是这一格的入场进度。p 为 0 时是铅笔虚线的空格（还没画到），之后 0.24 秒砸进来；
// draw(ctx, P) 在格内作画（已裁切）。o.big 砸得更重，o.tilt 斜压在页面上，o.bg 格子底色，o.ghost=false 不画空格
export function panel(ctx, E, P, p, draw, o = {}) {
  const u = E.u, k = K(E)
  if (p <= 0) {
    if (o.ghost === false) return
    ctx.save(); polyPath(ctx, P.pts); ctx.fillStyle = E.rgba(k.white, 0.45); ctx.fill()
    ctx.setLineDash([14 * u, 10 * u]); ctx.lineWidth = 2.5 * u; ctx.strokeStyle = E.rgba(k.ink, 0.25); ctx.stroke(); ctx.restore()
    return
  }
  const q = E.clamp(p / 0.8), s = 1 + 0.07 * (1 - E.ease.outBack(q)) * (o.big ? 1.6 : 1)
  ctx.save()
  ctx.translate(P.cx, P.cy); ctx.scale(s, s); ctx.rotate((o.rot || 0) * (1 - q) * 3 + (o.tilt || 0)); ctx.translate(-P.cx, -P.cy)
  ctx.globalAlpha *= E.clamp(q * 3)
  // 格子的硬投影，像压在纸上
  ctx.save(); ctx.translate(8 * u, 9 * u); polyPath(ctx, P.pts); ctx.fillStyle = E.rgba(k.ink, 0.16); ctx.fill(); ctx.restore()
  polyPath(ctx, P.pts); ctx.fillStyle = o.bg || k.white; ctx.fill()
  ctx.save(); polyPath(ctx, P.pts); ctx.clip(); draw(ctx, P); ctx.restore()
  polyPath(ctx, P.pts); ctx.lineJoin = 'miter'; ctx.lineWidth = (o.lw || 7) * u; ctx.strokeStyle = o.border || k.line; ctx.stroke()
  ctx.restore()
}

// 整页抖一下：list = [[进度, 幅度]]，元素落地（进度 0.45 到 1）时抖
export function shake(E, t, list) {
  let x = 0, y = 0
  for (const [p, amp] of list) {
    if (p < 0.45 || p >= 1) continue
    const d = 1 - (p - 0.45) / 0.55
    x += amp * E.u * d * E.noise1(t * 42, 3); y += amp * E.u * d * E.noise1(t * 42, 9)
  }
  return { x, y }
}

// ---------- 网点 ----------
// 均匀网点贴图（45° 网格）
function toneTex(E, step, r, color) {
  step = Math.round(step * 2) / 2; r = Math.round(r * 10) / 10
  return E.once(`comic-tone-${step}-${r}-${color}`, () => {
    const size = 512, c = E.createCanvas(size, size), x = c.getContext('2d')
    x.fillStyle = color
    for (let j = -1; j * step * 0.5 < size + step; j++) for (let i = -1; i * step < size + step; i++) { x.beginPath(); x.arc(i * step + (j % 2 ? step / 2 : 0), j * step * 0.5, r, 0, Math.PI * 2); x.fill() }
    return c
  })
}
// 在当前路径里铺网点（先自己建好路径，再调用）
export function toneFill(ctx, E, x, y, w, h, o = {}) {
  const tex = toneTex(E, (o.step || 9) * E.u, (o.r || 2.2) * E.u, o.color || K(E).ink)
  ctx.save(); ctx.clip()
  if (o.alpha) ctx.globalAlpha *= o.alpha
  for (let yy = y; yy < y + h; yy += tex.height) for (let xx = x; xx < x + w; xx += tex.width) ctx.drawImage(tex, xx, yy)
  ctx.restore()
}
// 渐变网点：沿 dir 方向点子由小变大（down 越往下越密 | up 越往上越密 | radial 四周密中间空）
export function gradTone(E, w, h, dir = 'down', o = {}) {
  w = Math.max(8, Math.round(w / 8) * 8); h = Math.max(8, Math.round(h / 8) * 8)
  const step = (o.step || 11) * E.u, rmax = (o.rmax || 4.6) * E.u, color = o.color || K(E).ink
  return E.once(`comic-grad-${w}x${h}-${dir}-${step}-${rmax}-${color}`, () => {
    const c = E.createCanvas(w, h), x = c.getContext('2d')
    x.fillStyle = color
    for (let j = 0; j * step * 0.5 < h + step; j++) for (let i = -1; i * step < w + step; i++) {
      const px = i * step + (j % 2 ? step / 2 : 0), py = j * step * 0.5
      let f
      if (dir === 'down') f = py / h
      else if (dir === 'up') f = 1 - py / h
      else f = Math.min(1, Math.hypot((px - w / 2) / (w / 2), (py - h / 2) / (h / 2)) / 1.25)
      const r = rmax * Math.pow(Math.max(0, f), 1.4)
      if (r < 0.5) continue
      x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill()
    }
    return c
  })
}

// ---------- 集中线、速度线 ----------
// 集中线：从格子外缘指向中心椭圆的细楔形，每秒重抖 12 次
export function focusLines(ctx, E, t, R, cx, cy, rx, ry, o = {}) {
  const n = o.n || 90, rng = E.rng((o.seed || 7) * 1000 + Math.floor(t * 12)), far = Math.hypot(R.w, R.h) * 1.2
  ctx.save(); ctx.fillStyle = o.color || K(E).ink
  for (let i = 0; i < n; i++) {
    const a = (i + rng() * 0.8) / n * Math.PI * 2, inner = 1 + rng() * (o.jit || 0.55), wd = (0.004 + rng() * 0.012) * (o.thick || 1)
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rx * inner, cy + Math.sin(a) * ry * inner)
    ctx.lineTo(cx + Math.cos(a - wd) * far, cy + Math.sin(a - wd) * far); ctx.lineTo(cx + Math.cos(a + wd) * far, cy + Math.sin(a + wd) * far)
    ctx.closePath(); ctx.fill()
  }
  ctx.restore()
}
// 速度线：沿 ang 方向的平行细线，长短不一，整体随时间流动
export function speedLines(ctx, E, t, R, ang = 0, o = {}) {
  const u = E.u, n = o.n || 46, rng = E.rng(o.seed || 3), span = Math.hypot(R.w, R.h)
  ctx.save(); ctx.translate(R.cx, R.cy); ctx.rotate(ang); ctx.strokeStyle = o.color || K(E).ink; ctx.lineCap = 'round'
  for (let i = 0; i < n; i++) {
    const y = (rng() - 0.5) * span, len = (0.15 + rng() * 0.45) * span, x = ((rng() * span + t * (o.speed || 1.6) * span) % (span * 1.6)) - span * 0.8
    ctx.lineWidth = (1.5 + rng() * 3.5) * u; ctx.beginPath(); ctx.moveTo(x - len, y); ctx.lineTo(x, y); ctx.stroke()
  }
  ctx.restore()
}

// ---------- 入场 ----------
// p 是入场进度（0..1，约 0.3 秒走完）。kind: pop 弹出 / slam 从大砸下再回弹 / drop 落下 / fade
export function put(ctx, E, p, x, y, fn, o = {}) {
  if (p <= 0) return
  const dt = p * 0.3, kind = o.kind || 'pop'
  let s = 1, a = 1, dy = 0
  if (kind === 'pop') { s = E.ease.outBack(p); a = E.clamp(dt / 0.08) }
  else if (kind === 'slam') { const q = E.clamp(dt / 0.14); s = E.lerp(1.6, 1, E.ease.in(q)) + (q >= 1 && p < 1 ? 0.07 * Math.exp(-(dt - 0.14) * 13) * Math.sin((dt - 0.14) * 38) : 0); a = E.clamp(dt / 0.05) }
  else if (kind === 'drop') { dy = -(1 - E.ease.outBack(p)) * (o.h || 120) * E.u; a = E.clamp(dt / 0.08) }
  else a = E.clamp(p / 0.8)
  if (a <= 0.001 || s <= 0.001) return
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y + dy); ctx.rotate(o.rot || 0); ctx.scale(s, s); fn(ctx); ctx.restore()
}

// ---------- 文字 ----------
// 冲击大字：黑外描边 + 白内描边 + 填色。s 是一段字，或 [[字, 颜色], …]（一行里几段不同颜色）。返回字宽
export function impact(ctx, E, s, x, y, size, o = {}) {
  const k = K(E), segs = typeof s === 'string' ? [[s, o.fill || k.ink]] : s, full = segs.map(g => g[0]).join('')
  ctx.font = E.font(o.role || 'title', o.w || 900, size); ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.textAlign = 'left'
  const w = ctx.measureText(full).width, al = o.align || 'center', x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x
  if (o.out !== false) {
    if ((o.ow ?? 0.3) > 0) { ctx.lineWidth = size * (o.ow ?? 0.3); ctx.strokeStyle = o.line || k.ink; ctx.strokeText(full, x0, y) }
    ctx.lineWidth = size * (o.iw ?? 0.17); ctx.strokeStyle = o.halo || k.white; ctx.strokeText(full, x0, y)
  }
  let cx = x0
  for (const [tx, col] of segs) { ctx.fillStyle = col; ctx.fillText(tx, cx, y); cx += ctx.measureText(tx).width }
  return w
}
// 拟声字：粗描边的大字，只当音效，不承载信息。q 是它自己的出现进度
export function sfxWord(ctx, E, q, s, x, y, size, o = {}) {
  if (q <= 0) return
  const k = K(E), sc = E.lerp(1.8, 1, E.ease.out(q))
  ctx.save(); ctx.globalAlpha *= E.clamp(q * 3); ctx.translate(x, y); ctx.rotate(o.rot ?? -0.12); ctx.scale(sc, sc)
  ctx.font = `900 ${size.toFixed(1)}px ${E.fonts.hand}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.34; ctx.strokeStyle = k.ink; ctx.strokeText(s, 0, 0)
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = k.white; ctx.strokeText(s, 0, 0)
  ctx.lineWidth = size * 0.05; ctx.strokeStyle = o.fill || k.ink; ctx.strokeText(s, 0, 0)
  ctx.fillStyle = o.fill || k.ink; ctx.fillText(s, 0, 0)
  ctx.restore()
}
// 旁白框：方框黑边加硬投影。s 是一行或几行字；anchor: 'lt' 'ct' 'rt' 'lc' 'c' 'rc' 'lb' 'cb' 'rb'。返回框的位置
export function box(ctx, E, s, x, y, size, o = {}) {
  const u = E.u, k = K(E), ls = Array.isArray(s) ? s : [s], lh = o.lh || size * 1.2
  ctx.font = E.font(o.role || 'body', o.w || 900, size)
  const w = Math.max(...ls.map(l => ctx.measureText(l).width)) + size * 0.9, h = size * 0.3 + lh * ls.length, an = o.anchor || 'c'
  let bx = x - w / 2, by = y - h / 2
  if (an[0] === 'l') bx = x; else if (an[0] === 'r') bx = x - w
  if (an[1] === 't') by = y; else if (an[1] === 'b') by = y - h
  ctx.save()
  if (o.rot) { ctx.translate(bx + w / 2, by + h / 2); ctx.rotate(o.rot); ctx.translate(-bx - w / 2, -by - h / 2) }
  ctx.fillStyle = k.ink; ctx.fillRect(bx + 5 * u, by + 5 * u, w, h)
  ctx.fillStyle = o.fill || k.white; ctx.fillRect(bx, by, w, h)
  ctx.lineWidth = (o.lw || 4) * u; ctx.strokeStyle = k.line; ctx.strokeRect(bx, by, w, h)
  ctx.fillStyle = o.color || k.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ls.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + h / 2 + (i - (ls.length - 1) / 2) * lh + size * 0.04))
  ctx.restore()
  return { x: bx, y: by, w, h }
}
// 只量旁白框多大，不画
export function boxSize(ctx, E, s, size, o = {}) {
  const ls = Array.isArray(s) ? s : [s], lh = o.lh || size * 1.2
  ctx.font = E.font(o.role || 'body', o.w || 900, size)
  return { w: Math.max(...ls.map(l => ctx.measureText(l).width)) + size * 0.9, h: size * 0.3 + lh * ls.length }
}
// 对话气泡：kind = speech 椭圆 / shout 爆炸边。rx ry 是椭圆半径，tail 是尾巴尖的坐标（相对气泡中心）
export function bubble(ctx, E, x, y, rx, ry, o = {}) {
  const k = K(E)
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = (o.lw || 5) * E.u; ctx.strokeStyle = k.ink; ctx.fillStyle = o.fill || k.white
  if (o.tail) {
    // 尾巴根部宽度固定（不随尾巴长短变细），尖端指向说话的人
    const [tx, ty] = o.tail, a = Math.atan2(ty, tx), w = Math.min(rx, ry) * 0.2, bx = Math.cos(a) * rx * 0.75, by = Math.sin(a) * ry * 0.75
    ctx.beginPath(); ctx.moveTo(x + bx - Math.sin(a) * w, y + by + Math.cos(a) * w); ctx.lineTo(x + tx, y + ty); ctx.lineTo(x + bx + Math.sin(a) * w, y + by - Math.cos(a) * w)
    ctx.closePath(); ctx.fill(); ctx.stroke()
  }
  ctx.beginPath()
  if (o.kind === 'shout') {
    const n = 22, rng = E.rng(o.seed || 5)
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, f = i % 2 ? 1 : 1.16 + rng() * 0.12; ctx.lineTo(x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f) }
    ctx.closePath()
  } else ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.stroke(); ctx.fill()
  ctx.restore()
}
// 爆炸星框：rx ry 两个半径，o.spin 让尖角绕着转
export function burst(ctx, E, x, y, rx, ry, o = {}) {
  const k = K(E), n = o.n || 18
  ctx.save(); ctx.translate(x, y); ctx.beginPath()
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2 + (o.spin || 0), f = i % 2 ? o.inner || 0.74 : 1; ctx.lineTo(Math.cos(a) * rx * f, Math.sin(a) * ry * f) }
  ctx.closePath()
  ctx.fillStyle = E.rgba(k.ink, 1); ctx.save(); ctx.translate(8 * E.u, 9 * E.u); ctx.fill(); ctx.restore()
  ctx.fillStyle = o.fill || k.white; ctx.fill()
  ctx.lineWidth = (o.lw || 6) * E.u; ctx.strokeStyle = k.ink; ctx.lineJoin = 'miter'; ctx.stroke()
  ctx.restore()
}
// 实心三角箭头（格缝里指示阅读方向），ang 是指向
export function tri(ctx, E, x, y, size, ang, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = color || K(E).ink
  ctx.beginPath(); ctx.moveTo(size * 0.6, 0); ctx.lineTo(-size * 0.4, -size * 0.55); ctx.lineTo(-size * 0.4, size * 0.55); ctx.closePath(); ctx.fill(); ctx.restore()
}
