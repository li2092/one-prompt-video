// 聊天区：一场的消息自上而下排好，按 s.p(i) 依次弹出；放不下时整体缩小字号再排。
// 气泡、卡片消息、语音条、清单卡、链接卡、点击波纹沿用原样片 lib/chat.mjs 的画法，内容全部换成由 s.scene 来。
import { clamp, drawLines, formatNumber, decimalsOf, mix, fitText } from '../../../core.mjs'
import { rolling } from '../../../layouts.mjs'
import { rr, icon, badge, avatar, skel, ellipsis, outE, backE, kk } from './ui.mjs'
import { geo, drawHeader } from './phone.mjs'

const BODY = 31, SUB = 28
// 第 i 个元素入场以后过了几秒
export const since = (s, i) => s.t - (s.cue ? s.cue(i) : 0.35)
// 排字。试排（probe 不为空）时直接用 fitText 量，不进报告，只记下有没有被缩小、有没有放不下；
// 定下字号倍数以后再用 E.fit 正式排一遍，「字太多」只按最后用的那一版报
let probe = null
function fit(E, text, size, maxW, o = {}) {
  const role = o.role || 'body', weight = o.w || 400, maxLines = o.lines || 4, lineGap = o.gap || 1.34
  if (!probe) return E.fit(String(text), { role, weight, size, maxW, maxLines, lineGap, oneLine: o.oneLine, minSize: o.min, quiet: o.quiet })
  const f = fitText(ctx0(E), String(text), { font: sz => E.font(role, weight, sz), maxW, maxLines, size, minSize: o.min, lineGap, oneLine: o.oneLine })
  if (f.size < size * 0.999 && !o.quiet) probe.shrunk = true
  if (f.overflow) probe.over = true
  return f
}
function put(ctx, E, f, x, y, color, role, w, align = 'left') { ctx.fillStyle = color; ctx.font = E.font(role, w, f.size); drawLines(ctx, f.lines, x, y, f.lineH, align) }
const sumH = f => f.lines.length * f.lineH

function bubble(ctx, C, who, x, y, w, h, Z, o = {}) {
  const r = (o.r ?? 20) * Z, sm = 6 * Z, rad = who === 'center' ? r : who === 'me' ? [r, sm, r, r] : [sm, r, r, r]
  ctx.save(); ctx.shadowColor = 'rgba(40,30,20,0.12)'; ctx.shadowBlur = 8 * Z; ctx.shadowOffsetY = 2 * Z
  ctx.fillStyle = o.fill || (who === 'me' ? C.accent2 : C.card); rr(ctx, x, y, w, h, rad); ctx.fill(); ctx.restore()
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 2.5 * Z; rr(ctx, x, y, w, h, rad); ctx.stroke() }
}
// 卡片的抬头：图标方块 + 标题，返回抬头高度
function cardHead(ctx, E, C, m, x, y, Z, ic) {
  const pad = m.pad
  if (!m.ft) return
  ctx.fillStyle = C.accSoft; rr(ctx, x + pad, y + 14 * Z, 48 * Z, 48 * Z, 12 * Z); ctx.fill()
  icon(ctx, ic, x + pad + 24 * Z, y + 38 * Z, 28 * Z, C.accent, 2.6 * Z)
  put(ctx, E, m.ft, x + pad + 62 * Z, y + 14 * Z + Math.max(0, (48 * Z - sumH(m.ft)) / 2), C.ink, 'title', 700)
  ctx.fillStyle = C.line; ctx.fillRect(x + pad, y + m.headH, m.w - pad * 2, 1.5 * Z)
}
function headFit(E, m, L, cw) {
  m.pad = 20 * L.Z
  m.ft = m.title ? fit(E, m.title, 30 * L.Z, cw - m.pad * 2 - 62 * L.Z, { role: 'title', w: 700, lines: 2, gap: 1.22 }) : null
  m.headH = m.ft ? Math.max(48 * L.Z, sumH(m.ft)) + 28 * L.Z : 6 * L.Z
}

// 每种消息：m() 量出宽高 [w, h]，d() 画在 (x, y)
const K = {
  sys: {
    m(m, E, L) { const Z = L.Z; m.f = fit(E, m.text, SUB * Z, L.vw - 100 * Z, { w: 500, lines: 2 }); return [m.f.width + 44 * Z, sumH(m.f) + 18 * Z] },
    d(ctx, m, x, y, s, E, L, C) { ctx.fillStyle = E.rgba(C.ink, 0.08); rr(ctx, x, y, m.w, m.h, Math.min(m.h / 2, 26 * L.Z)); ctx.fill(); put(ctx, E, m.f, x + m.w / 2, y + 9 * L.Z, C.sub, 'body', 500, 'center') },
  },
  text: {
    m(m, E, L) { const Z = L.Z; m.f = fit(E, m.text, (m.size || BODY) * Z, L.maxW - 36 * Z, { w: m.wt || 400 }); return [m.f.width + 36 * Z, sumH(m.f) + 22 * Z] },
    d(ctx, m, x, y, s, E, L, C) { bubble(ctx, C, m.who, x, y, m.w, m.h, L.Z); put(ctx, E, m.f, x + 18 * L.Z, y + 11 * L.Z, m.who === 'me' ? C.outInk : m.muted ? C.sub : C.ink, 'body', m.wt || 400) },
  },
  // 大字消息（statement）：高亮词垫一道强调色，落地后描一圈强调色边、右上角钉一枚图钉
  big: {
    m(m, E, L) { const Z = L.Z; m.f = fit(E, m.text, 46 * Z, L.fullW - 56 * Z, { role: 'title', w: 800, lines: 6, gap: 1.3 }); return [m.f.width + 56 * Z, sumH(m.f) + 44 * Z] },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, f = m.f, q = outE(kk(since(s, m.el), 0.3, 0.45))
      bubble(ctx, C, 'a', x, y, m.w, m.h, Z)
      if (q > 0) { ctx.save(); ctx.globalAlpha *= q; ctx.strokeStyle = C.accent; ctx.lineWidth = 3 * Z; rr(ctx, x, y, m.w, m.h, [6 * Z, 20 * Z, 20 * Z, 20 * Z]); ctx.stroke(); ctx.restore() }
      ctx.font = E.font('title', 800, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      const hl = m.hl ? String(m.hl) : '', hs = hl ? f.lines.join('').indexOf(hl) : -1
      let off = 0
      f.lines.forEach((line, k) => {
        const ly = y + 22 * Z + k * f.lineH + f.lineH / 2, x0 = x + 28 * Z
        const a0 = Math.max(0, hs - off), a1 = Math.min(line.length, hs + hl.length - off)
        off += line.length
        if (hs < 0 || a1 <= a0) { ctx.fillStyle = C.ink; ctx.fillText(line, x0, ly); return }
        const pre = line.slice(0, a0), mid = line.slice(a0, a1), wPre = ctx.measureText(pre).width, wMid = ctx.measureText(mid).width
        ctx.fillStyle = C.accMid; rr(ctx, x0 + wPre - 4 * Z, ly + f.size * 0.08, (wMid + 8 * Z) * q, f.size * 0.42, 6 * Z); ctx.fill()
        ctx.fillStyle = C.ink; ctx.fillText(pre, x0, ly)
        ctx.fillStyle = C.accent; ctx.fillText(mid, x0 + wPre, ly)
        ctx.fillStyle = C.ink; ctx.fillText(line.slice(a1), x0 + wPre + wMid, ly)
      })
      badge(ctx, 'pin', x + m.w - 4 * Z, y + 4 * Z, 20 * Z * backE(q), C.accent)
    },
  },
  // 名片（title）：强调色横幅、群头像、标题和副标题、一排按钮
  profile: {
    m(m, E, L) {
      const Z = L.Z, cw = Math.min(L.vw - 60 * Z, 620 * Z), pad = 28 * Z
      m.ft = fit(E, m.title, 46 * Z, cw - pad * 2, { role: 'title', w: 800, lines: 3, gap: 1.2 })
      m.fs = m.sub ? fit(E, m.sub, 29 * Z, cw - pad * 2, { lines: 3 }) : null
      m.ban = 100 * Z; m.av = 112 * Z
      return [cw, m.ban + m.av / 2 + 20 * Z + sumH(m.ft) + (m.fs ? 12 * Z + sumH(m.fs) : 0) + 26 * Z + 58 * Z + 24 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, cx = x + m.w / 2
      bubble(ctx, C, 'center', x, y, m.w, m.h, Z, { r: 26 })
      ctx.save(); rr(ctx, x, y, m.w, m.ban, [26 * Z, 26 * Z, 0, 0]); ctx.clip()
      const g = ctx.createLinearGradient(x, y, x + m.w, y + m.ban); g.addColorStop(0, C.accent); g.addColorStop(1, mix(C.accent, C.accent2, 0.55))
      ctx.fillStyle = g; ctx.fillRect(x, y, m.w, m.ban)
      ctx.fillStyle = 'rgba(255,255,255,0.16)'
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(x + m.w * (0.08 + i * 0.11), y + m.ban * (0.3 + 0.4 * (i % 2)), (6 + (i % 3) * 5) * Z, 0, 7); ctx.fill() }
      ctx.restore()
      ctx.fillStyle = C.card; rr(ctx, cx - m.av / 2 - 6 * Z, y + m.ban - m.av / 2 - 6 * Z, m.av + 12 * Z, m.av + 12 * Z, m.av * 0.32); ctx.fill()
      avatar(ctx, 'group', cx - m.av / 2, y + m.ban - m.av / 2, m.av, C)
      let ty = y + m.ban + m.av / 2 + 20 * Z
      put(ctx, E, m.ft, cx, ty, C.ink, 'title', 800, 'center'); ty += sumH(m.ft)
      if (m.fs) { const q = s.p(m.subEl); ctx.save(); ctx.globalAlpha *= clamp(q * 2); put(ctx, E, m.fs, cx, ty + 12 * Z + (1 - outE(q)) * 10 * Z, C.sub, 'body', 400, 'center'); ctx.restore(); ty += 12 * Z + sumH(m.fs) }
      ty += 26 * Z
      ;['msg', 'link', 'dots'].forEach((ic, i) => { const bx = cx + (i - 1) * 96 * Z; ctx.fillStyle = C.accSoft; ctx.beginPath(); ctx.arc(bx, ty + 29 * Z, 29 * Z, 0, 7); ctx.fill(); icon(ctx, ic, bx, ty + 29 * Z, 28 * Z, C.accent, 2.6 * Z) })
    },
  },
  // 大数字卡片（number）：数字滚上去，单位跟在后面，label 在下面
  num: {
    m(m, E, L) {
      const Z = L.Z, cw = L.fullW
      m.pad = 26 * Z
      m.fu = m.unit ? fit(E, m.unit, 40 * Z, cw * 0.4, { w: 700, lines: 1, oneLine: true }) : null
      m.fv = fit(E, m.value, 124 * Z, cw - m.pad * 2 - (m.fu ? m.fu.width + 12 * Z : 0), { role: 'num', w: 800, lines: 1, gap: 1.02, min: 124 * Z * 0.35, quiet: true })
      m.fl = m.label ? fit(E, m.label, 30 * Z, cw - m.pad * 2, { w: 500, lines: 3 }) : null
      return [cw, 64 * Z + m.fv.lineH + (m.fl ? 10 * Z + sumH(m.fl) : 0) + 26 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, pad = m.pad
      bubble(ctx, C, 'a', x, y, m.w, m.h, Z)
      ctx.fillStyle = C.accSoft; rr(ctx, x, y, m.w, 48 * Z, [6 * Z, 20 * Z, 0, 0]); ctx.fill()
      icon(ctx, 'chart', x + pad + 12 * Z, y + 24 * Z, 24 * Z, C.accent)
      for (let i = 0; i < 3; i++) { ctx.fillStyle = C.accMid; ctx.beginPath(); ctx.arc(x + m.w - pad - i * 16 * Z, y + 24 * Z, 4 * Z, 0, 7); ctx.fill() }
      const ny = y + 64 * Z + m.fv.lineH / 2, shown = rolling(m.value, clamp(since(s, m.el) / Math.min(1.4, s.dur * 0.35)))
      ctx.font = E.font('num', 800, m.fv.size); ctx.fillStyle = C.accent; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(shown, x + pad, ny)
      const wv = ctx.measureText(String(m.value)).width
      if (m.fu) { ctx.font = E.font('body', 700, m.fu.size); ctx.fillStyle = C.ink; ctx.textBaseline = 'alphabetic'; ctx.fillText(m.unit, x + pad + wv + 12 * Z, ny + m.fv.size * 0.36) }
      if (m.fl) { const q = s.p(m.labelEl); ctx.save(); ctx.globalAlpha *= clamp(q * 2); put(ctx, E, m.fl, x + pad, ny + m.fv.lineH / 2 + 10 * Z + (1 - outE(q)) * 10 * Z, C.ink, 'body', 500); ctx.restore() }
    },
  },
  // 投票式图表卡（bars）：每项一条横槽，值按比例填满，最大的或指定的一项用强调色
  poll: {
    m(m, E, L) {
      const Z = L.Z, cw = L.fullW, n = m.items.length
      headFit(E, m, L, cw)
      m.vals = m.items.map(it => Number(it.value)); m.max = Math.max(...m.vals, 1e-9); m.dec = Math.max(...m.items.map(it => decimalsOf(it.value)))
      m.hi = m.highlight != null ? Number(m.highlight) - 1 : m.vals.indexOf(Math.max(...m.vals))
      m.fsz = (n > 5 ? 26 : 28) * Z
      ctx0(E).font = E.font('num', 700, m.fsz); m.valW = ctx0(E).measureText(formatNumber(m.max, m.dec) + (m.unit || '')).width
      m.fl = m.items.map(it => fit(E, it.label, m.fsz, cw - m.pad * 2 - m.valW - 52 * Z, { w: 500, lines: 1, oneLine: true }))
      m.rowH = (n > 5 ? 56 : 64) * Z
      return [cw, m.headH + 12 * Z + n * m.rowH + 10 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, pad = m.pad, tw = m.w - pad * 2, th = m.rowH - 12 * Z
      bubble(ctx, C, 'a', x, y, m.w, m.h, Z); cardHead(ctx, E, C, m, x, y, Z, 'chart')
      m.items.forEach((it, i) => {
        const q = outE(s.p(m.el + 1 + i)), hi = i === m.hi, ry = y + m.headH + 12 * Z + i * m.rowH, cy = ry + th / 2
        ctx.fillStyle = C.screen; rr(ctx, x + pad, ry, tw, th, 12 * Z); ctx.fill()
        if (q > 0) { ctx.fillStyle = hi ? C.accMid : mix(C.card, C.ink, 0.1); rr(ctx, x + pad, ry, Math.max(th * 0.5, tw * m.vals[i] / m.max * q), th, 12 * Z); ctx.fill() }
        if (hi && q > 0) { ctx.save(); ctx.globalAlpha *= q; ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5 * Z; rr(ctx, x + pad, ry, tw, th, 12 * Z); ctx.stroke(); ctx.restore() }
        ctx.save(); ctx.globalAlpha *= 0.35 + 0.65 * clamp(q * 2)
        put(ctx, E, m.fl[i], x + pad + 16 * Z, cy - sumH(m.fl[i]) / 2, C.ink, 'body', hi ? 700 : 500)
        ctx.restore()
        if (q > 0) { ctx.save(); ctx.globalAlpha *= clamp(q * 2); ctx.font = E.font('num', 700, m.fsz); ctx.fillStyle = hi ? C.accent : C.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(formatNumber(m.vals[i] * q, m.dec) + (m.unit || ''), x + pad + tw - 16 * Z, cy); ctx.restore() }
      })
    },
  },
  // 清单卡（steps）：序号圆点连成一条线，每步入场时圆点填色、文字从骨架条换成正文
  check: {
    m(m, E, L) {
      const Z = L.Z, cw = L.fullW
      headFit(E, m, L, cw)
      m.fi = m.items.map(it => fit(E, it, 29 * Z, cw - m.pad * 2 - 58 * Z, { w: 500, lines: 3 }))
      m.rows = m.fi.map(f => Math.max(60 * Z, sumH(f) + 20 * Z))
      return [cw, m.headH + 10 * Z + m.rows.reduce((a, b) => a + b, 0) + 10 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, pad = m.pad, cx = x + pad + 19 * Z, r = 18 * Z
      bubble(ctx, C, 'a', x, y, m.w, m.h, Z); cardHead(ctx, E, C, m, x, y, Z, 'list')
      const ys = []; let ry = y + m.headH + 10 * Z
      m.rows.forEach(h => { ys.push(ry + h / 2); ry += h })
      const qs = m.items.map((_, i) => s.p(m.el + 1 + i))
      ctx.fillStyle = C.line; ctx.fillRect(cx - 1.5 * Z, ys[0], 3 * Z, ys[ys.length - 1] - ys[0])
      let reach = ys[0]
      qs.forEach((q, i) => { if (i > 0 && q > 0) reach = ys[i - 1] + (ys[i] - ys[i - 1]) * outE(q) })
      ctx.fillStyle = C.accent; ctx.fillRect(cx - 1.5 * Z, ys[0], 3 * Z, reach - ys[0])
      m.items.forEach((it, i) => {
        const q = qs[i], cy = ys[i], f = m.fi[i], tx = x + pad + 58 * Z
        ctx.fillStyle = C.card; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill()
        ctx.strokeStyle = C.faint; ctx.lineWidth = 2.4 * Z; ctx.stroke()
        if (q > 0) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(cx, cy, r * Math.min(1.08, backE(q)), 0, 7); ctx.fill() }
        ctx.font = E.font('num', 800, 20 * Z); ctx.fillStyle = q > 0.3 ? C.onAccent : C.faint; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), cx, cy + Z)
        if (q < 0.4) { ctx.save(); ctx.globalAlpha *= 1 - q * 2.5; skel(ctx, tx, cy - 7 * Z, Math.min(f.width, m.w * 0.5), 14 * Z, C.skel); ctx.restore() }
        if (q > 0) { ctx.save(); ctx.globalAlpha *= q; put(ctx, E, f, tx + (1 - outE(q)) * 14 * Z, cy - sumH(f) / 2, C.ink, 'body', 500); ctx.restore() }
      })
    },
  },
  // 一方说的话（compare）：粗体的立场一行，下面一条条；自己发的（右边）每条带对勾，角上一颗星
  side: {
    m(m, E, L) {
      const Z = L.Z, inner = L.maxW - 40 * Z
      m.ft = fit(E, m.title, 31 * Z, inner, { role: 'title', w: 800, lines: 2 })
      m.fi = (m.items || []).map(it => fit(E, it, 28 * Z, inner - 38 * Z, { lines: 3 }))
      let w = m.ft.width, h = sumH(m.ft) + (m.fi.length ? 18 * Z : 0)
      m.fi.forEach(f => { w = Math.max(w, f.width + 38 * Z); h += sumH(f) + 8 * Z })
      return [w + 40 * Z, h + 28 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, me = m.who === 'me', ink = me ? C.outInk : C.ink
      bubble(ctx, C, m.who, x, y, m.w, m.h, Z)
      let ty = y + 14 * Z
      put(ctx, E, m.ft, x + 20 * Z, ty, ink, 'title', 800); ty += sumH(m.ft)
      if (m.fi.length) { ctx.fillStyle = E.rgba(ink, 0.14); ctx.fillRect(x + 20 * Z, ty + 8 * Z, m.w - 40 * Z, 1.5 * Z); ty += 18 * Z }
      m.fi.forEach(f => {
        const cy = ty + Math.min(f.lineH, sumH(f)) / 2
        if (me) badge(ctx, 'check', x + 32 * Z, cy, 11 * Z, C.accent, C.onAccent)
        else { ctx.fillStyle = C.sub; ctx.beginPath(); ctx.arc(x + 32 * Z, cy, 5 * Z, 0, 7); ctx.fill() }
        put(ctx, E, f, x + 58 * Z, ty, ink, 'body', 400); ty += sumH(f) + 8 * Z
      })
      if (me) badge(ctx, 'star', x + 4 * Z, y + 4 * Z, 17 * Z * backE(outE(kk(since(s, m.el), 0.25, 0.3))), C.accent, C.onAccent)
    },
  },
  // 语音消息加转文字（quote）：播放条跟着这一场走，下面是转出来的原话
  voice: {
    m(m, E, L) {
      const Z = L.Z, cw = L.fullW
      m.pad = 22 * Z
      m.ft = fit(E, m.text, 36 * Z, cw - m.pad * 2, { role: 'title', w: 600, lines: 7, gap: 1.42 })
      return [cw, 22 * Z + 50 * Z + 22 * Z + sumH(m.ft) + 24 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, pad = m.pad, cy = y + 22 * Z + 25 * Z, prog = clamp((since(s, m.el) - 0.3) / Math.max(1, s.dur - 1.6))
      bubble(ctx, C, 'a', x, y, m.w, m.h, Z)
      const playing = prog > 0 && prog < 1
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x + pad + 22 * Z, cy, 22 * Z, 0, 7); ctx.fill()
      if (playing) { ctx.fillStyle = C.onAccent; ctx.fillRect(x + pad + 15 * Z, cy - 8 * Z, 5 * Z, 16 * Z); ctx.fillRect(x + pad + 24 * Z, cy - 8 * Z, 5 * Z, 16 * Z) }
      else icon(ctx, 'play', x + pad + 23 * Z, cy, 22 * Z, C.onAccent)
      const x0 = x + pad + 58 * Z, x1 = x + m.w - pad, n = Math.floor((x1 - x0) / (8 * Z))
      for (let i = 0; i < n; i++) {
        const hgt = (0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + 0.4) * Math.cos(i * 0.53))) * 30 * Z
        const live = playing && Math.abs(i / n - prog) < 0.04 ? 1 + 0.35 * Math.sin(E.T * 30 + i) : 1
        ctx.fillStyle = i / n < prog ? C.accent : C.faint
        rr(ctx, x0 + i * 8 * Z, cy - hgt * live / 2, 4 * Z, hgt * live, 2 * Z); ctx.fill()
      }
      ctx.fillStyle = C.line; ctx.fillRect(x + pad, y + 22 * Z + 50 * Z + 10 * Z, m.w - pad * 2, 1.5 * Z)
      const ty = y + 22 * Z + 50 * Z + 22 * Z
      put(ctx, E, m.ft, x + pad, ty, C.ink, 'title', 600)
    },
  },
  // 链接卡片（end）：预览图、标题、副标题、一个按钮；按钮出来以后被点一下
  link: {
    m(m, E, L) {
      const Z = L.Z, cw = L.fullW
      m.pad = 22 * Z; m.prevH = 150 * Z
      m.ft = fit(E, m.title, 36 * Z, cw - m.pad * 2, { role: 'title', w: 800, lines: 3, gap: 1.24 })
      m.fs = m.sub ? fit(E, m.sub, 28 * Z, cw - m.pad * 2, { lines: 2 }) : null
      m.fc = m.cta ? fit(E, m.cta, 30 * Z, cw - m.pad * 2 - 40 * Z, { w: 700, lines: 1, oneLine: true }) : null
      return [cw, m.prevH + 20 * Z + sumH(m.ft) + (m.fs ? 8 * Z + sumH(m.fs) : 0) + (m.fc ? 22 * Z + 68 * Z : 0) + 22 * Z]
    },
    d(ctx, m, x, y, s, E, L, C) {
      const Z = L.Z, pad = m.pad
      bubble(ctx, C, 'a', x, y, m.w, m.h, Z)
      ctx.save(); rr(ctx, x, y, m.w, m.prevH, [6 * Z, 20 * Z, 0, 0]); ctx.clip()
      ctx.fillStyle = C.accSoft; ctx.fillRect(x, y, m.w, m.prevH)
      ctx.fillStyle = E.rgba(C.accent, 0.12)
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + m.w * (0.12 + i * 0.27), y + m.prevH * (i % 2 ? 0.85 : 0.2), (30 + i * 12) * Z, 0, 7); ctx.fill() }
      ctx.restore()
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x + m.w / 2, y + m.prevH / 2, 38 * Z, 0, 7); ctx.fill()
      icon(ctx, 'play', x + m.w / 2 + 3 * Z, y + m.prevH / 2, 36 * Z, C.onAccent)
      let ty = y + m.prevH + 20 * Z
      put(ctx, E, m.ft, x + pad, ty, C.ink, 'title', 800); ty += sumH(m.ft)
      if (m.fs) { const q = s.p(m.subEl); ctx.save(); ctx.globalAlpha *= clamp(q * 2); put(ctx, E, m.fs, x + pad, ty + 8 * Z, C.sub, 'body', 400); ctx.restore(); ty += 8 * Z + sumH(m.fs) }
      if (m.fc) {
        const q = s.p(m.ctaEl), by = ty + 22 * Z, bw = m.w - pad * 2, bh = 68 * Z, k = 0.7 + 0.3 * backE(q)
        if (q > 0) {
          ctx.save(); ctx.globalAlpha *= clamp(q * 2.5); ctx.translate(x + m.w / 2, by + bh / 2); ctx.scale(k, k)
          ctx.fillStyle = C.accent; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill()
          ctx.fillStyle = C.onAccent; ctx.font = E.font('body', 700, m.fc.size); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m.fc.lines[0], 0, Z)
          ctx.restore()
        }
        const tq = kk(s.t, s.dur * 0.7, 0.6)
        if (q >= 1 && tq > 0 && tq < 1) {
          const tx = x + m.w * 0.66, tyy = by + bh * 0.55
          ctx.save(); ctx.strokeStyle = E.rgba(C.accent, 1 - tq); ctx.lineWidth = 4 * Z
          ctx.beginPath(); ctx.arc(tx, tyy, 10 * Z + tq * 60 * Z, 0, 7); ctx.stroke()
          ctx.fillStyle = E.rgba(C.ink, 0.35 * (1 - tq)); ctx.beginPath(); ctx.arc(tx, tyy, 20 * Z, 0, 7); ctx.fill(); ctx.restore()
        }
      }
    },
  },
}

let mctx = null
const ctx0 = E => (mctx ||= E.createCanvas(8, 8).getContext('2d'))

function typing(ctx, E, C, who, x, y, Z) {
  const w = 84 * Z, h = 48 * Z, bx = who === 'me' ? x - w : x
  bubble(ctx, C, who, bx, y, w, h, Z)
  for (let i = 0; i < 3; i++) {
    const b = Math.max(0, Math.sin((E.T * 2.2 - i * 0.18) * Math.PI * 2))
    ctx.fillStyle = mix(C.faint, C.sub, b); ctx.beginPath(); ctx.arc(bx + w / 2 + (i - 1) * 18 * Z, y + h / 2 - b * 5 * Z, 6 * Z, 0, 7); ctx.fill()
  }
}

// 画一整屏：标题栏里的联系人、（可选的）置顶条、消息列
// o = { name, nameEl, group, msgs: [{ kind, who: a|me|sys|center, el, last, from, fromEl, ... }], pin: { text, q }, bias }
//   el 是这条消息的入场元素号，last 是它里面最后一个元素号，from 是气泡上方的发送者名字
export function chat(ctx, s, E, C, o) {
  const G = geo(E), v = G.view, P = G.P, vw = Math.min(v.right, v.x + v.w) - v.x, msgs = o.msgs
  const lastEl = Math.max(...msgs.map(m => m.last ?? m.el))
  drawHeader(ctx, s, E, C, { ...o, pending: s.p(lastEl) <= 0 })
  const top = o.pin ? 60 * P : 0
  const measure = (k, trial) => {
    const Z = P * k, inX = v.x + 68 * Z, right = Math.min(v.right, v.x + v.w - 16 * Z)
    const L = { Z, inX, vw, right, maxW: Math.min(v.w - 68 * Z - 48 * Z, right - inX), fullW: right - inX }
    probe = trial ? {} : null
    let total = 0
    for (const m of msgs) {
      ;[m.w, m.h] = K[m.kind].m(m, E, L)
      m.lab = m.from ? fit(E, m.from, 24 * Z, L.maxW, { w: 500, lines: 1 }) : null
      m.labH = m.lab ? sumH(m.lab) + 4 * Z : 0
      total += m.labH + m.h + 18 * Z
    }
    const r = { L, total, room: v.h - top - 24 * Z, shrunk: probe && probe.shrunk, over: probe && probe.over }
    probe = null
    return r
  }
  // 字号倍数：消息少时放大（最多 1.3 倍，占满聊天区八成为止，不许因此缩字），多时缩小；每场只定一次
  const KS = [1.3, 1.18, 1.08, 1, 0.92, 0.85, 0.78, 0.71, 0.64]
  const kPick = E.once('chat:k:' + s.index, () => KS.find(k => { const r = measure(k, true); return !r.over && (k > 1 ? r.total <= r.room * 0.8 && !r.shrunk : r.total <= r.room) }) ?? KS[KS.length - 1])
  const { L, total } = measure(kPick, false), Z = L.Z
  let y = v.y + top + 14 * Z + Math.max(0, (v.h - top - 24 * Z - total) * (o.bias ?? 0.42))
  ctx.save(); ctx.beginPath(); ctx.rect(G.sc.x, v.y, G.sc.w, v.h); ctx.clip()
  let prev = null
  msgs.forEach(m => {
    const x = m.who === 'me' ? L.right - m.w : m.who === 'a' ? L.inX : v.x + (vw - m.w) / 2
    const by = y + m.labH, q = s.p(m.el), first = m.who === 'a' && (!prev || prev.who !== 'a')
    if (q <= 0) {
      // 对方正在输入：上一条快落地、这一条还没出来时，在它的位置先冒一个三点气泡
      if ((m.who === 'a' || m.who === 'me') && (!prev || s.p(prev.last ?? prev.el) >= 0.6)) {
        if (first) avatar(ctx, 'a', v.x + 16 * Z, by, 42 * Z, C)
        typing(ctx, E, C, m.who, m.who === 'me' ? L.right : x, by, Z)
      }
    } else {
      if (first) avatar(ctx, 'a', v.x + 16 * Z, by, 42 * Z, C)
      if (m.lab) { ctx.save(); ctx.globalAlpha *= clamp(s.p(m.fromEl ?? m.el) * 2); put(ctx, E, m.lab, x + 4 * Z, y, C.sub, 'body', 500); ctx.restore() }
      const k = 0.82 + 0.18 * backE(q), ox = m.who === 'me' ? x + m.w : m.who === 'a' ? x : x + m.w / 2
      ctx.save(); ctx.globalAlpha *= Math.min(1, q * 2.5); ctx.translate(ox, by); ctx.scale(k, k); ctx.translate(-ox, -by)
      K[m.kind].d(ctx, m, x, by, s, E, L, C)
      ctx.restore()
    }
    y += m.labH + m.h + 18 * Z; prev = m
  })
  // 置顶条：消息落地后从标题栏下面滑出来
  if (o.pin && o.pin.q > 0) {
    const h = 60 * P, yy = v.y - h * (1 - outE(o.pin.q))
    ctx.fillStyle = C.bar; ctx.fillRect(G.sc.x, yy, G.sc.w, h); ctx.fillStyle = C.line; ctx.fillRect(G.sc.x, yy + h - 1.5 * P, G.sc.w, 1.5 * P)
    badge(ctx, 'pin', G.sc.x + 40 * P, yy + h / 2, 17 * P, C.accent)
    ctx.font = E.font('body', 500, 26 * P); ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(ellipsis(ctx, o.pin.text, vw - 110 * P), G.sc.x + 70 * P, yy + h / 2)
  }
  ctx.restore()
}
