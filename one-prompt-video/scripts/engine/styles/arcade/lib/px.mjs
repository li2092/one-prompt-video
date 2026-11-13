// 街机关卡：像素网格底层（移植自风格库的 G-街机关卡 lib/px.mjs）。
// 所有图形按"格"画：一格 = S 个屏幕像素（短边 1080 时 S=6）。坐标在 view 里取整，贴图用最近邻放大，没有抗锯齿的圆滑边。
// 5×7 点阵字库、阈值化的中文像素大字、像素面板也在这里。离屏画布一律用 E.createCanvas。
let mk = null
export const useE = E => { mk = E.createCanvas }

export const PAL = {
  white: '#fcfcfc', black: '#000000', ink: '#101018', grassHi: '#80d010',
  soil: '#5c4a9c', soilHi: '#9c88dc', soilDk: '#2c2050', turf: '#b4e04c', turfDk: '#4c8c3c', trunk: '#3c2c4c',
  coin: '#fcd800', coinHi: '#fcfcb0', coinDk: '#ac7c00', orange: '#fc9838', red: '#e83828',
  blue: '#2038ec', cyan: '#3cbcfc', pink: '#fc74b4', gray: '#bcbcbc', grayDk: '#747474',
  green: '#00b800', greenHi: '#b8f818', sand: '#fcd8a8',
}

const cache = new Map()
export const memo = (key, fn) => { let v = cache.get(key); if (v === undefined) { v = fn(); cache.set(key, v) } return v }

// ---------- 视图 ----------
export const cellOf = E => Math.max(2, Math.round(6 * Math.min(E.W, E.H) / 1080))
// view(E, { cx, cy, S, dx, dy })：世界坐标（格）里的 (cx, cy) 落在屏幕中心；默认世界原点在屏幕左上角
export function view(E, o = {}) {
  mk = E.createCanvas
  const B = cellOf(E), S = Math.max(1, Math.round(o.S ?? B))
  const cx = o.cx ?? E.W / B / 2, cy = o.cy ?? E.H / B / 2
  // 镜头一格一格地走（像素游戏的卷轴）
  const ox = Math.round(E.W / 2 - Math.round(cx) * S) + Math.round(o.dx ?? 0) * B
  const oy = Math.round(E.H / 2 - Math.round(cy) * S) + Math.round(o.dy ?? 0) * B
  return mkView(E, S, ox, oy)
}
export const screenView = E => { mk = E.createCanvas; return mkView(E, cellOf(E), 0, 0) }

function mkView(E, S, ox, oy) {
  const V = {
    S, ox, oy, E,
    x0: -ox / S, x1: (E.W - ox) / S, y0: -oy / S, y1: (E.H - oy) / S,
    r(ctx, x, y, w, h, col) {
      const X0 = Math.round(x), Y0 = Math.round(y), W = Math.round(x + w) - X0, H = Math.round(y + h) - Y0
      if (W <= 0 || H <= 0) return
      ctx.fillStyle = col; ctx.fillRect(ox + X0 * S, oy + Y0 * S, W * S, H * S)
    },
    disc(ctx, cx, cy, rad, col) {
      cx = Math.round(cx); cy = Math.round(cy); rad = Math.max(0, Math.round(rad))
      ctx.fillStyle = col
      for (let dy = -rad; dy <= rad; dy++) {
        const hw = Math.floor(Math.sqrt(Math.max(0, rad * rad - dy * dy)) + 0.35)
        ctx.fillRect(ox + (cx - hw) * S, oy + (cy + dy) * S, (hw * 2 + 1) * S, S)
      }
    },
    // 像素线（Bresenham），th 格粗，dash 格一段的虚线
    line(ctx, x0, y0, x1, y1, col, th = 1, dash = 0, phase = 0) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
      ctx.fillStyle = col
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
      let err = dx + dy, n = 0
      for (;;) {
        if (!dash || Math.floor((n + phase) / dash) % 2 === 0) ctx.fillRect(ox + x0 * S, oy + y0 * S, th * S, th * S)
        if (x0 === x1 && y0 === y1) break
        const e2 = 2 * err
        if (e2 >= dy) { err += dy; x0 += sx }
        if (e2 <= dx) { err += dx; y0 += sy }
        n++
      }
    },
    box(ctx, x, y, w, h, col, th = 1, dash = 0, phase = 0) {
      if (!dash) { V.r(ctx, x, y, w, th, col); V.r(ctx, x, y + h - th, w, th, col); V.r(ctx, x, y, th, h, col); V.r(ctx, x + w - th, y, th, h, col); return }
      V.line(ctx, x, y, x + w - th, y, col, th, dash, phase); V.line(ctx, x + w - th, y, x + w - th, y + h - th, col, th, dash, phase)
      V.line(ctx, x + w - th, y + h - th, x, y + h - th, col, th, dash, phase); V.line(ctx, x, y + h - th, x, y, col, th, dash, phase)
    },
    // 贴图：img 是 1 格 = 1 像素的小画布，k 倍放大，flip 水平翻转
    img(ctx, img, x, y, k = 1, flip = false) {
      const X0 = ox + Math.round(x) * S, Y0 = oy + Math.round(y) * S, w = img.width * k * S, h = img.height * k * S
      ctx.imageSmoothingEnabled = false
      if (flip) { ctx.save(); ctx.translate(X0 + w, Y0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); ctx.restore() }
      else ctx.drawImage(img, X0, Y0, w, h)
    },
  }
  return V
}

// ---------- 贴图 ----------
// rows：字符串数组；pal：{字符: 颜色}，'.' 透明
export function sprite(rows, pal, key) {
  return memo('spr:' + (key || rows.join('|')) + JSON.stringify(pal), () => {
    const h = rows.length, w = Math.max(...rows.map(r => r.length))
    const c = mk(w, h), x = c.getContext('2d')
    rows.forEach((row, j) => [...row].forEach((ch, i) => { const col = pal[ch]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1) } }))
    return c
  })
}
// 整张贴图换成单色（受击闪白、剪影）
export function tint(img, col, key) {
  return memo('tint:' + key + col, () => {
    const c = mk(img.width, img.height), x = c.getContext('2d')
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height)
    return c
  })
}

// ---------- 5×7 点阵字库（大写、数字、少量符号） ----------
export const GLYPH = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110', 2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11111 00010 00100 00010 00001 10001 01110', 4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000', 8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100', ',': '00000 00000 00000 00000 01100 00100 01000', ':': '00000 01100 01100 00000 01100 01100 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100', '?': '01110 10001 00001 00010 00100 00000 00100', '-': '00000 00000 00000 11111 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000', '=': '00000 00000 11111 00000 11111 00000 00000', '×': '00000 10001 01010 00100 01010 10001 00000',
  '/': '00001 00010 00010 00100 01000 01000 10000', "'": '00100 00100 01000 00000 00000 00000 00000', '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000', '#': '01010 01010 11111 01010 11111 01010 01010', '%': '11001 11010 00010 00100 01000 01011 10011',
  '·': '00000 00000 00000 01100 01100 00000 00000', '>': '01000 00100 00010 00001 00010 00100 01000', '<': '00010 00100 01000 10000 01000 00100 00010',
  '♥': '00000 01010 11111 11111 01110 00100 00000', '▶': '10000 11000 11100 11110 11100 11000 10000', '▼': '00000 11111 11111 01110 01110 00100 00000',
  '$': '00100 01111 10100 01110 00101 11110 00100', '&': '01100 10010 10100 01000 10101 10010 01101', '*': '00100 10101 01110 11111 01110 10101 00100',
}
export const hasGlyph = ch => ch === ' ' || GLYPH[ch.toUpperCase()] != null
// 一个字符 = 5 格宽 + 1 格间距；空格 4 格
export const pwidth = (s, unit = 1) => [...String(s).toUpperCase()].reduce((a, c) => a + (c === ' ' ? 4 : 6), 0) * unit - unit
function glyphCanvas(s, col) {
  return memo('pf:' + s + col, () => {
    const w = pwidth(s, 1) + 1, c = mk(Math.max(1, w), 7), x = c.getContext('2d')
    x.fillStyle = col
    let cx = 0
    for (const ch of s) {
      if (ch === ' ') { cx += 4; continue }
      const g = GLYPH[ch] || GLYPH['?']
      g.split(' ').forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') x.fillRect(cx + i, j, 1, 1) }))
      cx += 6
    }
    return c
  })
}
// 像素字：x,y 为格（左上），unit = 每点几格；outline 八方向描边，shadow 右下硬阴影
export function ptext(ctx, V, s, x, y, unit, col, o = {}) {
  s = String(s).toUpperCase()
  const w = pwidth(s, unit)
  const ax = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x
  const ay = o.valign === 'middle' ? y - 3.5 * unit : y
  if (o.shadow) V.img(ctx, glyphCanvas(s, o.shadow), ax + (o.sd ?? unit), ay + (o.sd ?? unit), unit)
  if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) V.img(ctx, glyphCanvas(s, o.outline), ax + dx, ay + dy, unit)
  V.img(ctx, glyphCanvas(s, col), ax, ay, unit)
  return w
}

// ---------- 中文像素大字 ----------
// 先按 hCells 像素高画到小画布，按 alpha 阈值二值化（没有半透明边），再加 1 格描边和硬阴影；1 格 = 1 像素，用 V.img 放大
export function ctextImg(E, s, hCells, col, o = {}) {
  const font = E.font(o.role || 'title', o.weight || 900, hCells)
  return memo(`ct:${s}|${hCells}|${col}|${o.outline}|${o.shadow}|${o.sd}|${font}`, () => {
    const tmp = mk(4, 4).getContext('2d'); tmp.font = font
    const tw = Math.ceil(tmp.measureText(s).width), pad = 4, sd = o.sd ?? 2
    const w = tw + pad * 2 + sd, h = Math.ceil(hCells * 1.3) + pad * 2 + sd
    const m = mk(w, h), mx = m.getContext('2d')
    mx.font = font; mx.textBaseline = 'middle'; mx.fillStyle = '#fff'
    mx.fillText(s, pad, pad + hCells * 0.62)
    const d = mx.getImageData(0, 0, w, h).data, on = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) on[i] = d[i * 4 + 3] > 120 ? 1 : 0
    const c = mk(w, h), x = c.getContext('2d')
    const paint = (dx, dy, color) => { x.fillStyle = color; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on[j * w + i]) x.fillRect(i + dx, j + dy, 1, 1) }
    if (o.shadow) for (let k = 1; k <= sd; k++) paint(k, k, o.shadow)
    if (o.outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) paint(dx, dy, o.outline)
    paint(0, 0, col)
    c.tw = tw; c.pad = pad
    return c
  })
}
// 画中文像素大字：x 为对齐点、y 为字的竖直中心（格）。返回字宽（格）
export function ctext(ctx, V, E, s, x, y, hCells, col, o = {}) {
  if (!s) return 0
  const img = ctextImg(E, s, hCells, col, o)
  const ax = o.align === 'left' ? x - img.pad : o.align === 'right' ? x - img.tw - img.pad : x - img.tw / 2 - img.pad
  V.img(ctx, img, ax, y - img.pad - hCells * 0.62, 1)
  return img.tw
}

// ---------- 像素面板（RPG 对话框：底色 + 双线框，四角缺一格） ----------
export function panel(ctx, V, x, y, w, h, o = {}) {
  const fill = o.fill ?? PAL.black, line = o.line ?? PAL.white
  V.r(ctx, x + 1, y, w - 2, h, fill); V.r(ctx, x, y + 1, w, h - 2, fill)
  V.r(ctx, x + 1, y + 1, w - 2, 1, line); V.r(ctx, x + 1, y + h - 2, w - 2, 1, line)
  V.r(ctx, x + 1, y + 1, 1, h - 2, line); V.r(ctx, x + w - 2, y + 1, 1, h - 2, line)
  if (o.double !== false) {
    const c2 = o.line2 ?? line
    V.r(ctx, x + 3, y + 3, w - 6, 1, c2); V.r(ctx, x + 3, y + h - 4, w - 6, 1, c2)
    V.r(ctx, x + 3, y + 3, 1, h - 6, c2); V.r(ctx, x + w - 4, y + 3, 1, h - 6, c2)
  }
}

// ---------- 工具 ----------
export const step = (p, n) => Math.floor(Math.max(0, Math.min(1, p)) * n) / n   // 量化，做"一格一格"的动作
export const blink = (t, hz = 8) => Math.floor(t * hz) % 2 === 0
// 弹出量化：0 → 0.4 → 1.15 → 1（三档 + 回弹），p 是入场进度
export const popQ = p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.34 ? 0.4 : p < 0.67 ? 1.15 : 1)
