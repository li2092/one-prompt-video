// 公共工具：数学、缓动、颜色、字体解析、排字。画面只由时刻决定：不读系统时间，不用 Math.random。
import fs from 'node:fs'
import path from 'node:path'

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
export const lerp = (a, b, p) => a + (b - a) * p
export const ease = {
  linear: p => p,
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  inOut: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  back: p => { const c = 1.70158; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2) },
  expo: p => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
}
// 从 t0 开始、历时 d 秒的进度（0 到 1，带缓动）
export const prog = (t, t0, d, e = ease.out) => e(clamp((t - t0) / Math.max(1e-6, d)))

// 种子随机：同一个种子永远得到同一串数
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export function hash(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b); h ^= Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d); h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

export function hexToRgb(h) {
  const s = h.replace('#', ''), f = s.length === 3 ? [...s].map(c => c + c).join('') : s
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16))
}
export const rgba = (hex, a = 1) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` }
export function mix(h1, h2, p) {
  const a = hexToRgb(h1), b = hexToRgb(h2)
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], p)).toString(16).padStart(2, '0')).join('')
}

// ---------- 字体 ----------
// 画图库不会自动找中文字体：字体名写错或没装，中文会画成方框。所以按系统逐个找，找到第一个装了的。
const CANDIDATES = {
  sans: ['Noto Sans SC', 'Noto Sans CJK SC', 'Source Han Sans SC', 'Source Han Sans CN', 'PingFang SC', 'Hiragino Sans GB', 'Heiti SC', 'Microsoft YaHei', 'Microsoft YaHei UI', 'DengXian', 'SimHei', 'WenQuanYi Micro Hei', 'WenQuanYi Zen Hei', 'Droid Sans Fallback', 'Noto Sans CJK JP', 'Noto Sans CJK TC'],
  serif: ['Noto Serif SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', 'STSong', 'SimSun', 'NSimSun', 'FangSong', 'AR PL UMing CN'],
  hand: ['LXGW WenKai', 'Kaiti SC', 'STKaiti', 'KaiTi', 'KaiTi_GB2312', 'AR PL UKai CN', 'Xingkai SC', 'Hannotate SC'],
  mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'Cascadia Mono', 'DejaVu Sans Mono', 'Liberation Mono', 'Courier New'],
  latin: ['Inter', 'Helvetica Neue', 'Segoe UI', 'Arial', 'DejaVu Sans', 'Liberation Sans'],
}
const FONT_EXT = /\.(ttf|otf|ttc)$/i

// 返回 { sans, serif, hand, mono, latin, found, missing }；每一项是能直接放进 ctx.font 的字体列表
export function resolveFonts(GlobalFonts, userDir, prefer) {
  if (userDir && fs.existsSync(userDir)) {
    for (const f of fs.readdirSync(userDir)) if (FONT_EXT.test(f)) GlobalFonts.registerFromPath(path.join(userDir, f))
  }
  const have = new Set(GlobalFonts.families.map(f => f.family))
  const pick = list => list.find(n => have.has(n))
  const found = {}
  for (const k of Object.keys(CANDIDATES)) found[k] = pick(CANDIDATES[k])
  if (prefer && have.has(prefer)) found.sans = prefer
  const q = n => `"${n}"`
  const sans = found.sans
  const stack = (...names) => names.filter(Boolean).map(q).join(',') || 'sans-serif'
  return {
    sans: stack(found.latin, sans),
    cjk: stack(sans),
    serif: stack(found.serif, sans),
    hand: stack(found.hand, sans),
    mono: stack(found.mono, sans),
    found,
    missing: sans ? null : '没有找到中文字体，中文会显示成方框。',
  }
}

// ---------- 排字 ----------
const CJK = /[⺀-鿿豈-﫿＀-￯　-〿]/
const NO_LINE_START = /[，。、；：？！）》」』”’,.;:?!)\]%…]/
const NO_LINE_END = /[（《「『“‘(\[]/
const BREAK_AFTER = /[，。、；：？！,;:?!]/
export const isCJK = ch => CJK.test(ch)
export const hasCJK = s => CJK.test(String(s))

// 把一段话拆成不可再拆的小块：一个汉字一块，一个英文词或一串数字一块
function tokens(text) {
  const out = []
  let buf = ''
  for (const ch of String(text)) {
    if (ch === '\n') { if (buf) out.push(buf); buf = ''; out.push('\n') }
    else if (isCJK(ch)) { if (buf) out.push(buf); buf = ''; out.push(ch) }
    else if (ch === ' ') { if (buf) out.push(buf); buf = ''; out.push(' ') }
    else buf += ch
  }
  if (buf) out.push(buf)
  return out
}

// 按宽度折行。标点不放行首，左括号和左引号不放行尾。
export function wrapText(ctx, text, maxW) {
  const lines = []
  let line = ''
  const push = () => { lines.push(line.trimEnd()); line = '' }
  for (const tk of tokens(text)) {
    if (tk === '\n') { push(); continue }
    if (line === '' && tk === ' ') continue
    const next = line + tk
    if (ctx.measureText(next).width <= maxW || line === '') { line = next; continue }
    if (NO_LINE_START.test(tk[0])) { line = next; continue }
    // 这一行靠后的位置有逗号、顿号这类标点的，就在标点后面断开，不把一个词切成两半
    const chars = [...line]
    let cut = -1
    for (let k = chars.length - 2; k >= Math.floor(chars.length * 0.5); k--) if (BREAK_AFTER.test(chars[k])) { cut = k; break }
    if (cut > 0) { lines.push(chars.slice(0, cut + 1).join('').trimEnd()); line = (chars.slice(cut + 1).join('') + tk).trimStart(); continue }
    const last = chars[chars.length - 1]
    if (last && NO_LINE_END.test(last)) { const head = [...line].slice(0, -1).join(''); lines.push(head.trimEnd()); line = last + tk; continue }
    push(); line = tk === ' ' ? '' : tk
  }
  if (line.trim() !== '' || lines.length === 0) lines.push(line.trimEnd())
  return lines
}

// 在给定的宽和行数里放下一段字：放不下就缩小字号，缩到下限还放不下就报告溢出。
// font(size) 返回 ctx.font 字符串。返回 { size, lines, lineH, overflow }
export function fitText(ctx, text, { font, maxW, maxLines = 2, size, minSize = size * 0.55, lineGap = 1.28, maxH = Infinity, oneLine = false }) {
  let s = size
  // 短标题：宁可缩小一点放进一行，也不折成两行（折行容易把一个词切开）
  if (oneLine && !String(text).includes('\n')) {
    for (let q = size; q >= size * 0.68; q *= 0.95) { ctx.font = font(q); const w = ctx.measureText(text).width; if (w <= maxW) return { size: q, lines: [String(text)], lineH: q * lineGap, width: w, overflow: false } }
  }
  for (;;) {
    ctx.font = font(s)
    let lines = wrapText(ctx, text, maxW)
    const widths = lines.map(l => ctx.measureText(l).width)
    if (lines.length > 1 && widths[widths.length - 1] < Math.max(...widths) * 0.34) {
      // 最后一行只剩一两个字：行数不变的前提下把行宽收窄，各行就匀了
      let lo = maxW * 0.45, hi = maxW
      for (let k = 0; k < 7; k++) { const mid = (lo + hi) / 2; if (wrapText(ctx, text, mid).length <= lines.length) hi = mid; else lo = mid }
      lines = wrapText(ctx, text, hi)
    }
    const wide = Math.max(...lines.map(l => ctx.measureText(l).width))
    const lineH = s * lineGap
    const ok = lines.length <= maxLines && wide <= maxW + 0.5 && lines.length * lineH <= maxH
    if (ok || s <= minSize) return { size: s, lines, lineH, width: wide, overflow: !ok }
    s = Math.max(minSize, s * 0.94)
  }
}

export function drawLines(ctx, lines, x, y, lineH, align = 'left') {
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH + lineH / 2))
}

export function roundRect(ctx, x, y, w, h, r = 0) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr); ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h); ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}

// 数一段字要读多久（秒）：汉字每秒约 5 个，英文每秒约 3 个词
export function readSeconds(text) {
  const s = String(text || '')
  let cjk = 0
  for (const ch of s) if (isCJK(ch) && !/[　-〿＀-￯]/.test(ch)) cjk++
  const words = (s.replace(CJK, ' ').match(/[A-Za-z0-9][A-Za-z0-9'%.-]*/g) || []).length
  return cjk / 5 + words / 3
}

// 把数字写成带千分位的字符串；保留原文里的小数位数
export function formatNumber(v, decimals = 0) {
  const n = Number(v)
  if (!isFinite(n)) return String(v)
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
export const decimalsOf = v => { const m = /\.(\d+)/.exec(String(v)); return m ? m[1].length : 0 }
