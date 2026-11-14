// 风格包：办公室小剧场（skit）。移植自风格库的 E-实习生小剧场，画法库在 lib/。
// 扁平插画的办公室：米黄墙、木地板、木色桌。两个普通的办公室角色来演每一场：举牌、往白板上贴便签、在桌上摞文件夹、
// 把卡片一张张递过去夹到绳上、各举一块牌子、说出一只大气泡。新的一条内容出现时人物有反应（点头、转头、冒汗、举手、蹦一下）。
// 全片只有 a 的上衣是饱和色，走 this.c.accent。整场镜头以地面为轴慢推 2.5%；转场是快速横推。
import { mix, rgba, clamp, ease, drawLines, formatNumber, decimalsOf, textUnits } from '../../core.mjs'
import { captionChunks, rolling } from '../../layouts.mjs'
import { cast } from './lib/person.mjs'
import { room, actor, aim, nod, nods, hop, talk, clap, wave, turnAt, emote, kf, ob } from './lib/stage.mjs'
import { WOOD, paper, tape, pin, sticky, whiteboard, sign, desk, chair, laptop, longDesk, folder, binder, clip, bubble, check, handCircle, handArrow, marker, plant } from './lib/props.mjs'

const pal = c => ({
  wall: c.bg, wallDeep: mix(c.bg, '#9a7650', 0.12), floor: mix(c.bg, '#9a7650', 0.2), ink: c.fg, soft: mix(c.fg, c.bg, 0.32),
  paper: c.card, line: c.line, acc: c.accent, acc2: c.accent2, on: c.onAccent, muted: c.muted, note: mix(WOOD.note, c.card, 0.15),
})
// 一场的公共量：地面 F、人物头高 hd（站着约 6.5 个头高，占画面高度三分之一左右）
function setup(th, s, E) {
  const u = E.u, b = E.L.box
  return { u, b, por: E.portrait, r: b.x + b.w, F: b.y + b.h, hd: E.pick(56, 76) * u, t: s.t, sc: s.scene, k: E.once('skit-pal', () => pal(th.c)), cast: E.once('skit-cast', () => cast(th.c)) }
}
// 镜头：整场以地面中点为轴慢推 2.5%，地面不动
function cam(ctx, E, s, F) {
  const z = 1 + 0.025 * ease.inOut(clamp(s.t / Math.max(1, s.dur)))
  ctx.translate(E.W / 2, F); ctx.scale(z, z); ctx.translate(-E.W / 2, -F)
}
function txt(ctx, E, f, role, w, col, x, y, align = 'left') { ctx.font = E.font(role, w, f.size); ctx.fillStyle = col; drawLines(ctx, f.lines, x, y, f.lineH, align) }
// 几段字用同一个字号（取各自放得下的最小字号）
function fitAll(E, texts, o) { const size = Math.min(...texts.map(t => E.fit(t, { ...o, silent: true }).size)); return texts.map(t => E.fit(t, { ...o, size })) }
function popAt(ctx, p, cx, cy, fn) {
  if (p <= 0) return
  const e = 0.6 + 0.4 * ob(p)
  ctx.save(); ctx.globalAlpha *= clamp(p * 3); ctx.translate(cx, cy); ctx.scale(e, e); ctx.translate(-cx, -cy); fn(); ctx.restore()
}
function rotAt(ctx, x, y, a) { ctx.translate(x, y); ctx.rotate(a); ctx.translate(-x, -y) }
const L2 = (a, b, p) => [a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p]
// 抛、递东西的手臂：起手 → 举起 → 甩出 → 收回；连着几下时从上一下收回到一半的位置接着起手
function throwArm(t, cues, R, U, T) {
  let j = -1
  for (let q = 0; q < cues.length; q++) if (t >= cues[q] - 0.45) j = q
  if (j < 0) return { p: R, open: false }
  const io = ease.inOut, back = (tt, q) => L2(T, R, io(kf(tt, cues[q] + 0.05, 0.3))), c = cues[j], st = j > 0 ? back(c - 0.45, j - 1) : R
  if (t < c - 0.3) return { p: L2(st, U, io(kf(t, c - 0.45, 0.15))), open: true }
  if (t < c - 0.15) return { p: L2(U, T, io(kf(t, c - 0.3, 0.15))), open: true }
  return { p: back(t, j), open: t < c + 0.2 }
}
// 从手里飞到落点：0.26 秒的抛物线，落下后压扁回弹。fn 在落点坐标系里画
function flyIn(ctx, t, c, from, to, fn) {
  const f = kf(t, c - 0.2, 0.26)
  if (f <= 0) return
  const e = ease.out(f), x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e - Math.sin(e * Math.PI) * Math.abs(to[0] - from[0]) * 0.18
  const l = kf(t, c + 0.06, 0.25), sq = f >= 1 ? Math.sin(l * Math.PI) * (1 - l * 0.4) : 0, sc = 0.55 + 0.45 * e
  ctx.save(); ctx.translate(x, y); ctx.rotate((1 - e) * 0.8 * Math.sign(from[0] - to[0] || 1)); ctx.scale(sc * (1 + 0.06 * sq), sc * (1 - 0.1 * sq)); fn(); ctx.restore()
}
// 墙上的场标题：一张两角贴胶带的纸条，底下一道强调色马克笔线。返回纸条下沿
function wallTitle(ctx, s, E, X, text, cx, maxW) {
  if (!text) return X.b.y
  const { u, k, t } = X
  const f = E.fit(text, { role: 'title', weight: 900, size: E.pick(62, 62) * u, maxW: maxW - 80 * u, maxLines: 2, oneLine: true })
  const w = f.width + 80 * u, h = f.lines.length * f.lineH + 40 * u, x = cx - w / 2, y = X.b.y
  popAt(ctx, kf(t, s.cue(0) - 0.1, 0.4), cx, y + h / 2, () => {
    rotAt(ctx, cx, y + h / 2, -0.01)
    paper(ctx, x, y, w, h, 6 * u, k.paper, u)
    tape(ctx, x + 16 * u, y + 6 * u, 70 * u, -0.6, u); tape(ctx, x + w - 16 * u, y + 6 * u, 70 * u, 0.6, u)
    txt(ctx, E, f, 'title', 900, k.ink, cx, y + 16 * u, 'center')
    marker(ctx, cx - f.width / 2, y + h - 16 * u, f.width, kf(t, s.cue(0) + 0.15, 0.4), rgba(k.acc, 0.85), 7 * u)
  })
  return y + h
}
// 举在头顶的双手（手腕贴着牌子下沿 yb）
const overhead = (X, yb, hipY) => { const y = (yb - hipY) / X.hd; return { near: [-0.5, y], far: [0.64, y - 0.04], nearHand: 'fist', farHand: 'fist', nearBend: -1 } }

export default {
  name: '办公室小剧场', mood: '扁平插画的办公室，两个角色举牌、贴便签、摞文件夹来演内容，轻松的讲解、汇报、产品介绍', bpm: 116,
  c: { bg: '#F2E9D8', fg: '#2E2B33', muted: '#8A8176', accent: '#6D28D9', accent2: '#3E4A60', card: '#FBF7EF', line: '#DDD1BE', onAccent: '#FFFFFF' },
  fontTitle: 'sans', fontBody: 'hand', fontNum: 'sans', wTitle: 900, wBody: 500, radius: 14,
  motion: 'pop', solidAccent: true,
  music: { style: 'bright', prog: ['C', 'Am', 'F', 'G'], lead: 'pluck', drums: true },
  sfx: { enter: 'pop', cut: 'whoosh', accent: 'chime' },

  bg(ctx, E, s) { const X = setup(this, s, E); cam(ctx, E, s, X.F); room(ctx, E, X.F, X.k) },

  layouts: {
    // 片头：a 双手把一块大白卡举过头顶，上面是标题（落下一道马克笔线）和副标题；kicker 是拍在牌子左上角的强调色便签。
    // b 在右边，标题出来时一愣，接着拍手；横屏左边摆着工位（桌、椅、笔记本），竖屏换成一盆绿植
    title(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X
      cam(ctx, E, s, F)
      let i = 0
      const ck = sc.kicker ? s.cue(i++) : null, ct = s.cue(i++), cs = sc.subtitle ? s.cue(i++) : null, c0 = s.cue(0)
      const ax = E.W / 2 - 0.1 * hd, bx = X.r - E.pick(0.4, 0.55) * hd, hipY = F - 3.25 * hd
      const bw = por ? b.w * 0.96 : Math.min(b.w * (E.W / E.H < 1.5 ? 0.98 : 0.74), 1350 * u), pad = E.pick(46, 44) * u
      const handY = hipY - 3.58 * hd, maxH = handY - 6 * u - (b.y - 40 * u) - (sc.kicker ? 30 * u : 0)
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 500, size: E.pick(48, 46) * u, maxW: bw - pad * 2, maxLines: 2 }) : null
      const subH = sub ? sub.lines.length * sub.lineH + 34 * u : 0
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: (por ? 120 : E.W / E.H < 1.5 ? 116 : 140) * u, maxW: bw - pad * 2, maxLines: E.pick(2, 3), maxH: maxH - pad * 2 - subH, lineGap: 1.16, oneLine: true })
      const bigH = big.lines.length * big.lineH, bh = bigH + subH + pad * 2
      const raise = ob(kf(t, c0 - 0.3, 0.5)), lift = hop(t, ct + 0.05, 0.34) * 0.25 * hd
      const by = handY - 6 * u - bh + (1 - raise) * (bh * 0.4 + 1.5 * hd) - lift
      if (!por) { const dx = b.x + 0.2 * hd, dy = F - 2.57 * hd; chair(ctx, dx, F - 1.62 * hd, hd, F); desk(ctx, dx + 0.95 * hd, dy, 4.2 * hd, F, u); laptop(ctx, dx + 1.9 * hd, dy, 1.6 * hd) }
      plant(ctx, por ? b.x + 0.5 * hd : X.r + 1.0 * hd, F, 1.7 * hd)
      const bOK = t > ct + 0.1, clapOn = t > ct + 0.45 && t < ct + 1.6
      const B = actor(ctx, X, 'b', bx, {
        facing: -1, look: [0.6, -0.5], brow: bOK ? 'up' : 'neutral', mouth: bOK && !clapOn && t < ct + 0.45 ? 'o' : bOK ? 'grin' : 'smile',
        headTilt: cs != null ? nod(t, cs + 0.1) : 0, ...(clapOn ? clap(t) : {}),
      })
      emote(ctx, E, 'spark', B.head[0] - 0.1 * hd, B.head[1] - 1.0 * hd, 0.9 * hd, kf(t, ct + 0.45, 0.3) * (1 - kf(t, ct + 1.7, 0.3)), k.acc, k.wall)
      const hands = raise > 0 ? overhead(X, by + bh + 6 * u, hipY - lift) : {}
      actor(ctx, X, 'a', ax, { facing: 1, look: t > ct + 0.7 ? [1, 0] : [0.3, -1], brow: t > ct ? 'up' : 'focus', mouth: t > ct ? 'grin' : 'smile', ...hands }, lift)
      if (raise <= 0) return
      ctx.save(); ctx.globalAlpha *= clamp(raise * 3)
      const x0 = E.W / 2 - bw / 2
      sign(ctx, x0, by, bw, bh, u, k.paper, k.ink)
      popAt(ctx, kf(t, ct - 0.05, 0.4), E.W / 2, by + pad + bigH / 2, () => txt(ctx, E, big, 'title', 900, k.ink, E.W / 2, by + pad, 'center'))
      marker(ctx, E.W / 2 - big.width / 2, by + pad + bigH + 2 * u, big.width, kf(t, ct + 0.25, 0.45), rgba(k.acc, 0.85), 8 * u)
      if (sub) { const p = kf(t, cs, 0.35); ctx.save(); ctx.globalAlpha *= p; txt(ctx, E, sub, 'body', 500, k.soft, E.W / 2, by + pad + bigH + 34 * u + (1 - ease.out(p)) * 12 * u, 'center'); ctx.restore() }
      ctx.restore()
      if (sc.kicker) {
        const kf_ = E.fit(sc.kicker, { role: 'title', weight: 700, size: 40 * u, maxW: bw * 0.6, maxLines: 1 }), w = kf_.width + 48 * u, h = kf_.lineH + 26 * u, x = x0 + 34 * u, y = by - h * 0.55
        popAt(ctx, kf(t, ck + 0.2, 0.35), x + w / 2, y + h / 2, () => { rotAt(ctx, x + w / 2, y + h / 2, -0.05); sticky(ctx, x, y, w, h, k.acc, u); txt(ctx, E, kf_, 'title', 700, k.on, x + w / 2, y + 13 * u, 'center') })
      }
    },

    // 一句话：墙上从上往下展开一张大海报；高亮的词先刷一道马克笔，再被圈出来。
    // b 拿手指着那个词边说边比划，a 抬头看，词被圈出来时头上冒出感叹号，然后点头
    statement(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X
      cam(ctx, E, s, F)
      const c0 = s.cue(0), zw = por ? b.w : b.w - 3.1 * hd, pTop = b.y, pBot = por ? F - 6.6 * hd - 50 * u : F - 2.2 * hd, pad = E.pick(56, 50) * u
      const f = E.fit(sc.text, { role: 'title', weight: 900, size: E.pick(118, 108) * u, maxW: zw - pad * 2, maxLines: E.pick(4, 6), maxH: pBot - pTop - pad * 2 - 20 * u, lineGap: 1.3 })
      // 横屏海报跟着字宽收窄，两人站在海报两边
      const pw = por ? zw : Math.max(f.width + pad * 2 + 110 * u, zw * 0.55), px0 = E.W / 2 - pw / 2, px1 = E.W / 2 + pw / 2
      const ax = por ? b.x + 1.0 * hd : Math.max(b.x + 0.35 * hd, px0 - 1.3 * hd), bx = por ? X.r - 1.0 * hd : Math.min(X.r - 0.35 * hd, px1 + 1.3 * hd)
      const ph = Math.min(pBot - pTop, f.lines.length * f.lineH + pad * 2 + 20 * u), py = pTop + (pBot - pTop - ph) * 0.35
      const un = ease.out(kf(t, c0 - 0.2, 0.55)), hl = sc.highlight ? String(sc.highlight) : '', joined = f.lines.join(''), hs = hl ? joined.indexOf(hl) : -1
      const tHL = c0 + 0.8
      let spot = [(px0 + px1) / 2, py + ph / 2]
      if (un > 0) {
        ctx.save()
        ctx.beginPath(); ctx.rect(px0 - 30 * u, py - 30 * u, pw + 60 * u, ph * un + 30 * u); ctx.clip()
        paper(ctx, px0, py, pw, ph, 8 * u, k.paper, u, { sh: 7 })
        ctx.font = E.font('title', 900, f.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
        const y0 = py + pad + 10 * u, q = ease.out(kf(t, tHL - 0.3, 0.4))
        let off = 0, first = null
        f.lines.forEach((line, j) => {
          const y = y0 + j * f.lineH + f.lineH / 2, lw = ctx.measureText(line).width, x = (px0 + px1) / 2 - lw / 2
          const a0 = Math.max(0, hs - off), a1 = Math.min(line.length, hs + hl.length - off)
          off += line.length
          if (hs < 0 || a1 <= a0) { ctx.fillStyle = k.ink; ctx.fillText(line, x, y); return }
          const pre = line.slice(0, a0), mid = line.slice(a0, a1), wp = ctx.measureText(pre).width, wm = ctx.measureText(mid).width
          if (q > 0) marker(ctx, x + wp - 4 * u, y + f.size * 0.08, (wm + 8 * u), q, rgba(k.acc, 0.2), f.size * 0.62)
          ctx.fillStyle = k.ink; ctx.fillText(pre, x, y)
          ctx.fillStyle = q > 0.5 ? k.acc : k.ink; ctx.fillText(mid, x + wp, y)
          ctx.fillStyle = k.ink; ctx.fillText(line.slice(a1), x + wp + wm, y)
          if (!first) first = [x + wp + wm / 2, y, wm]
        })
        if (first) { handCircle(ctx, first[0], first[1], Math.min(first[2] / 2 + 26 * u, first[0] - px0 - 10 * u, px1 - first[0] - 10 * u), f.size * 0.7, kf(t, tHL + 0.15, 0.45), k.acc, 5 * u, 3); spot = [first[0], first[1]] }
        ctx.restore()
        if (un < 1) { ctx.fillStyle = mix(k.paper, '#8a7a66', 0.25); E.roundRect(ctx, px0 - 10 * u, py + ph * un - 12 * u, pw + 20 * u, 24 * u, 12 * u); ctx.fill() }
        tape(ctx, px0 + 30 * u, py + 4 * u, 90 * u, -0.5, u); tape(ctx, px1 - 30 * u, py + 4 * u, 90 * u, 0.5, u)
      }
      if (por) { const dx = (ax + bx) / 2 - 2.3 * hd, dy = F - 2.57 * hd; chair(ctx, dx, F - 1.62 * hd, hd, F); desk(ctx, dx + 0.95 * hd, dy, 3.6 * hd, F, u); laptop(ctx, dx + 1.9 * hd, dy, 1.6 * hd) }
      const hipY = F - 3.25 * hd, point = kf(t, c0 + 0.2, 0.3), says = talk(t, c0 + 0.3, c0 + 1.9)
      actor(ctx, X, 'b', bx, { facing: -1, look: [0.8, -0.6], mouth: says || 'smile', brow: 'up', near: L2([-0.2, 0.32], aim(bx, hipY, hd, -1, spot[0], spot[1]), ease.inOut(point)), nearHand: point > 0.5 ? 'point' : 'fist' })
      const hit = hs >= 0 ? tHL + 0.2 : c0 + 0.6
      const A = actor(ctx, X, 'a', ax, { facing: 1, look: [0.7, -0.8], brow: t > hit ? 'up' : 'neutral', mouth: t > hit && t < hit + 0.7 ? 'o' : t > hit ? 'smile' : 'neutral', headTilt: nod(t, hit + 0.7) })
      if (hs >= 0) emote(ctx, E, '!', A.head[0] + 0.2 * hd, A.head[1] - 1.25 * hd, 0.95 * hd, kf(t, hit, 0.3), k.acc, k.wall)
    },

    // 要点：墙上一块白板，标题用马克笔写在左上；每一条是 b 从手里甩到白板上的一张便签（图钉是强调色），
    // a 在另一边每来一张点一下头，最后一张到了举手
    bullets(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X, n = sc.items.length
      cam(ctx, E, s, F)
      const ax = por ? b.x + 0.75 * hd : b.x + 0.3 * hd, bx = por ? X.r - 0.75 * hd : X.r - 0.3 * hd, hipY = F - 3.25 * hd
      // 白板的高度跟着内容走，在墙上偏上居中；便签排成格子：横屏四条以内排一行，再多排两行；竖屏两条以内一列，再多两列。最后一行不满时居中
      const wx0 = por ? b.x - 14 * u : b.x + 1.25 * hd, wx1 = por ? X.r + 14 * u : X.r - 1.25 * hd, w0 = b.y - 14 * u, wmax = por ? F - 6.6 * hd - 40 * u : F - 1.9 * hd
      const ix0 = wx0 + 44 * u, ix1 = wx1 - 44 * u
      const tf = sc.title ? E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(60, 62) * u, maxW: ix1 - ix0, maxLines: 2, oneLine: true }) : null, tH = tf ? tf.lines.length * tf.lineH + 30 * u : 0
      const cols = por ? (n <= 2 ? 1 : 2) : Math.min(n <= 4 ? n : Math.ceil(n / 2), Math.max(1, Math.floor((ix1 - ix0 + 30 * u) / (290 * u)))), rows = Math.ceil(n / cols), gx = 30 * u, gy = 28 * u
      const cw = (ix1 - ix0 - gx * (cols - 1)) / cols, nh = Math.min((wmax - w0 - 74 * u - tH - gy * (rows - 1)) / rows, cols === 1 ? 230 * u : cw * 0.9), nw = Math.min(cw, cols === 1 || por ? cw : nh * 1.7)
      const FS = fitAll(E, sc.items, { role: 'body', weight: 500, size: Math.min(E.pick(58, 58) * u, nh * E.pick(0.3, 0.4)), maxW: nw - 56 * u, maxLines: 3, maxH: nh - E.pick(56, 34) * u, lineGap: 1.2 })
      const need = 74 * u + tH + rows * nh + (rows - 1) * gy, wy0 = w0 + Math.max(0, (wmax - w0 - need) * 0.4), wy1 = wy0 + Math.min(wmax - w0, need)
      whiteboard(ctx, wx0, wy0, wx1 - wx0, wy1 - wy0, u, k.acc)
      const top = wy0 + 34 * u, gt = top + tH
      if (tf) {
        const p = kf(t, s.cue(0) - 0.1, 0.45)
        ctx.save(); ctx.beginPath(); ctx.rect(ix0 - 10 * u, top - 10 * u, (tf.width + 20 * u) * p, tf.lines.length * tf.lineH + 20 * u); ctx.clip()
        txt(ctx, E, tf, 'title', 900, mix(k.ink, '#30405a', 0.4), ix0, top, 'left'); ctx.restore()
        marker(ctx, ix0, top + tf.lines.length * tf.lineH + 4 * u, Math.min(tf.width, 260 * u), kf(t, s.cue(0) + 0.3, 0.35), k.acc, 6 * u)
      }
      const cell = i => { const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), x = (ix0 + ix1) / 2 - (inRow * nw + (inRow - 1) * gx) / 2 + (i % cols) * (nw + gx); return [x + nw / 2, gt + r * (nh + gy) + nh / 2] }
      const cues = sc.items.map((_, i) => s.cue(i + 1)), th = throwArm(t, cues, [0.35, 0.28], [0.05, -2.95], [1.1, -2.35])
      const hand = [bx - th.p[0] * hd, hipY + th.p[1] * hd]
      actor(ctx, X, 'b', bx, { facing: -1, look: [0.9, -0.4], mouth: 'smile', near: th.p, nearHand: th.open ? 'open' : 'fist' })
      const last = cues[n - 1], cheer = t > last + 0.35
      const A = actor(ctx, X, 'a', ax, {
        facing: 1, look: [0.9, -0.5], mouth: cheer ? 'grin' : t > cues[0] ? 'smile' : 'neutral', brow: cheer ? 'up' : 'neutral',
        headTilt: nods(t, cues.map(c => c + 0.12), 0.09), ...(cheer ? { far: wave(t), farHand: 'open' } : {}),
      })
      emote(ctx, E, 'spark', A.head[0] + 0.1 * hd, A.head[1] - 1.0 * hd, 0.9 * hd, kf(t, last + 0.4, 0.3), k.acc, k.wall)
      sc.items.forEach((it, i) => {
        const f = FS[i]
        flyIn(ctx, t, cues[i], hand, cell(i), () => {
          ctx.rotate(0.022 * Math.sin(i * 2.3 + 1)); ctx.translate(-nw / 2, -nh / 2)
          sticky(ctx, 0, 0, nw, nh, k.note, u); pin(ctx, nw / 2, 15 * u, 10 * u, k.acc)
          txt(ctx, E, f, 'body', 500, k.ink, nw / 2, 22 * u + (nh - 22 * u - f.lines.length * f.lineH) / 2, 'center')
        })
      })
    },

    // 大数字：数字像刷在墙上的大字（强调色加一层错开的深色），从 0 滚到目标值；label 是钉在下面的一块纸牌，note 是一张便签。
    // a 抬头看着，数字滚的时候身子往后仰，滚完蹦一下、头上冒感叹号、冒汗；b 摊手介绍，说到 note 时两人点头
    number(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X, val = String(sc.value)
      cam(ctx, E, s, F)
      const c0 = s.cue(0)
      let i = 1
      const cl = sc.label ? s.cue(i++) : null, cn = sc.note ? s.cue(i++) : null
      const hipY = F - 3.25 * hd
      const zx0 = por ? b.x : b.x + 1.6 * hd, zx1 = por ? X.r : X.r - 1.6 * hd, zy0 = b.y, zy1 = por ? F - 6.6 * hd - 40 * u : F - 1.6 * hd, zw = zx1 - zx0, zc = (zx0 + zx1) / 2
      const size = E.pick(330, 360) * u
      ctx.font = E.font('title', 900, size * 0.3); const uw0 = sc.unit ? ctx.measureText(sc.unit).width + 24 * u : 0
      const fo = { role: 'num', weight: 900, size, maxW: zw * 0.92 - uw0, maxLines: 1, minSize: size * 0.3, lineGap: 1, maxH: (zy1 - zy0) * 0.6 }
      const f = E.fit(val, { ...fo, size: E.fit(val, { ...fo, silent: true }).size })
      const us = f.size * 0.3; ctx.font = E.font('title', 900, us); const uw = sc.unit ? ctx.measureText(sc.unit).width + 22 * u : 0
      const lab = sc.label ? E.fit(sc.label, { role: 'body', weight: 600, size: E.pick(54, 52) * u, maxW: zw * 0.84 - 60 * u, maxLines: 2 }) : null
      const note = sc.note ? E.fit(sc.note, { role: 'body', weight: 500, size: E.pick(38, 40) * u, maxW: zw * 0.6, maxLines: 2 }) : null
      const labH = lab ? lab.lines.length * lab.lineH + 40 * u : 0, noteH = note ? note.lines.length * note.lineH + 32 * u : 0
      const total = f.size + (lab ? 34 * u + labH : 0) + (note ? 22 * u + noteH : 0)
      let y = zy0 + Math.max(0, (zy1 - zy0 - total) * 0.45)
      const rollD = Math.min(1.4, s.dur * 0.35), tr = c0 + rollD, shown = rolling(sc.value, kf(t, c0, rollD))
      ctx.font = E.font('num', 900, f.size); const wNum = ctx.measureText(val).width, nx = zc - (wNum + uw) / 2 + wNum, ny = y + f.size / 2
      // 横屏两人站到内容两侧，不贴着画面边
      const hw = Math.max(wNum + uw, lab ? lab.width + 80 * u : 0, note ? note.width + 50 * u + zw * 0.16 : 0) / 2
      const ax = por ? b.x + 1.0 * hd : Math.max(b.x + 0.35 * hd, zc - hw - 1.5 * hd), bx = por ? X.r - 1.0 * hd : Math.min(X.r - 0.35 * hd, zc + hw + 1.5 * hd)
      popAt(ctx, kf(t, c0 - 0.05, 0.4), zc, ny, () => {
        ctx.font = E.font('num', 900, f.size); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillStyle = mix(k.acc, k.ink, 0.55); ctx.fillText(shown, nx + f.size * 0.025, ny + f.size * 0.025)
        ctx.fillStyle = k.acc; ctx.fillText(shown, nx, ny)
        if (sc.unit) { ctx.font = E.font('title', 900, us); ctx.textAlign = 'left'; ctx.fillStyle = k.ink; ctx.fillText(sc.unit, nx + 22 * u, ny + f.size * 0.2) }
      })
      y += f.size
      if (lab) {
        y += 34 * u
        const w = lab.width + 80 * u, x = zc - w / 2, yy = y
        popAt(ctx, kf(t, cl, 0.36), zc, yy + labH / 2, () => {
          paper(ctx, x, yy, w, labH, 10 * u, k.paper, u, { stroke: k.line, lw: 2 })
          pin(ctx, x + 22 * u, yy + 20 * u, 8 * u, k.muted); pin(ctx, x + w - 22 * u, yy + 20 * u, 8 * u, k.muted)
          txt(ctx, E, lab, 'body', 600, k.ink, zc, yy + 20 * u, 'center')
        })
        y += labH
      }
      if (note) {
        y += 22 * u
        const w = note.width + 50 * u, x = zc - w / 2 + (lab ? zw * 0.08 : 0), yy = y
        popAt(ctx, kf(t, cn, 0.36), x + w / 2, yy + noteH / 2, () => { rotAt(ctx, x + w / 2, yy + noteH / 2, 0.025); sticky(ctx, x, yy, w, noteH, k.note, u); txt(ctx, E, note, 'body', 500, k.ink, x + w / 2, yy + 16 * u, 'center') })
      }
      if (por) plant(ctx, (ax + bx) / 2, F, 1.7 * hd)
      const tb = cl ?? tr + 0.3, present = kf(t, tb - 0.1, 0.3) * (1 - kf(t, tb + 1.6, 0.4))
      actor(ctx, X, 'b', bx, { facing: -1, look: t > tb + 1.2 ? [0.6, 0.2] : [0.7, -0.5], mouth: talk(t, tb, tb + 1.2) || 'smile', headTilt: cn != null ? nod(t, cn + 0.1) : 0, near: L2([-0.2, 0.32], [1.05, -1.55], ease.inOut(present)), nearHand: present > 0.4 ? 'open' : 'fist' })
      const roll = kf(t, c0, rollD), lift = hop(t, tr, 0.34) * 0.4 * hd
      const A = actor(ctx, X, 'a', ax, {
        facing: 1, lean: -0.12 * roll * (1 - kf(t, tr + 0.4, 0.5) * 0.6), look: [0.8, -0.7], brow: t > c0 ? 'up' : 'neutral',
        mouth: t > c0 ? 'o' : 'neutral', sweat: kf(t, tr + 0.35, 0.4), headTilt: cn != null ? nod(t, cn + 0.25) : 0,
      }, lift)
      emote(ctx, E, '!', A.head[0] + 0.15 * hd, A.head[1] - 1.3 * hd, 1.05 * hd, kf(t, tr, 0.28), k.acc, k.wall)
    },

    // 柱状图。横屏：一张长桌，每根柱子是桌上的一摞文件夹，一层一层落上去；数值写在摞顶的小卡上，标签贴在桌子挡板上，
    // highlight（或最高）那摞是强调色。竖屏：墙上一只文件柜，每一格一排立着的活页夹，长短就是数值。
    // a 在一头看着，每摞好一摞点头，强调的那摞好了吓一跳冒汗；b 在另一头指着刚放上去的那摞
    bars(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X, n = sc.items.length
      cam(ctx, E, s, F)
      const vals = sc.items.map(it => Number(it.value)), max = Math.max(...vals, 1e-9)
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals))
      const dec = Math.max(...sc.items.map(it => decimalsOf(it.value))), unit = sc.unit || '', vs = vals.map(v => formatNumber(v, dec) + unit)
      const cues = sc.items.map((_, i) => s.cue(i + 1)), hipY = F - 3.25 * hd
      const ax = por ? b.x + 1.0 * hd : b.x + 0.3 * hd, bx = por ? X.r - 1.0 * hd : X.r - 0.3 * hd
      const top = wallTitle(ctx, s, E, X, sc.title, E.W / 2, b.w) + 18 * u
      const neutral = j => ['#D8B98F', '#C9AE8A', '#D3C2A6'][j % 3], accent = j => (j % 2 ? mix(k.acc, '#000000', 0.16) : k.acc)
      let spot = []
      if (!por) {
        const dx0 = b.x + 1.35 * hd, dx1 = X.r - 1.35 * hd, slot = (dx1 - dx0) / n, sw = Math.min(slot * 0.6, 190 * u)
        const LF = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 600, size: 38 * u, maxW: slot * 0.9 - 20 * u, maxLines: 2, lineGap: 1.12 })
        const apron = Math.max(...LF.map(f => f.lines.length * f.lineH)) + 30 * u, deskY = F - Math.max(2.5 * hd, apron + 56 * u)
        const VF = fitAll(E, vs, { role: 'num', weight: 800, size: 40 * u, maxW: Math.max(sw, slot * 0.86) - 24 * u, maxLines: 1 })
        const valH = VF[0].lineH + 14 * u, hMax = deskY - top - valH - 16 * u
        longDesk(ctx, dx0, dx1, deskY, F, apron, u)
        sc.items.forEach((it, i) => {
          const cx = dx0 + slot * (i + 0.5), h = hMax * vals[i] / max, cnt = h > 0 ? Math.max(1, Math.round(h / (20 * u))) : 0, th = cnt ? h / cnt : 0
          const kb = kf(t, cues[i] - 0.15, 0.6), m = Math.ceil(kb * cnt - 1e-6)
          for (let j = 0; j < m; j++) {
            const fr = kb * cnt - j, dy = j === m - 1 && kb < 1 ? -(1 - Math.min(1, fr)) * th * 3 : 0
            folder(ctx, cx, deskY - j * th + dy, sw, th - 1.5 * u, i === hi ? accent(j) : neutral(j + i), j, u)
          }
          const lw = LF[i].width + 24 * u, ly = deskY + 12 * u + (apron - LF[i].lines.length * LF[i].lineH - 12 * u) / 2
          ctx.save(); ctx.globalAlpha *= kf(t, cues[i], 0.3)
          paper(ctx, cx - lw / 2, ly - 6 * u, lw, LF[i].lines.length * LF[i].lineH + 12 * u, 4 * u, k.paper, u, { sh: 2 })
          txt(ctx, E, LF[i], 'body', 600, k.ink, cx, ly, 'center'); ctx.restore()
          const vw = VF[i].width + 24 * u, vy = deskY - h - valH - 6 * u
          popAt(ctx, kf(t, cues[i] + 0.45, 0.3), cx, vy + valH / 2, () => { paper(ctx, cx - vw / 2, vy, vw, valH, 6 * u, k.paper, u, { sh: 3, stroke: i === hi ? k.acc : k.line, lw: 2 }); txt(ctx, E, VF[i], 'num', 800, i === hi ? k.acc : k.ink, cx, vy + 7 * u, 'center') })
          spot.push([cx, deskY - h])
        })
      } else {
        const sy0 = top, sy1 = F - 6.6 * hd - 40 * u, fr = 16 * u, x0 = b.x - 10 * u, x1 = X.r + 10 * u
        paper(ctx, x0, sy0, x1 - x0, sy1 - sy0, 6 * u, WOOD.wood, u, { sh: 8 })
        ctx.fillStyle = mix(k.wall, '#9a7650', 0.3); ctx.fillRect(x0 + fr, sy0 + fr, x1 - x0 - fr * 2, sy1 - sy0 - fr * 2)
        const rowH = (sy1 - sy0 - fr * 2) / n, iw = x1 - x0 - fr * 2, labW = iw * 0.3, valW = 150 * u, bx0 = x0 + fr + labW + 14 * u, aw = iw - labW - valW - 30 * u
        const LF = fitAll(E, sc.items.map(it => it.label), { role: 'body', weight: 600, size: Math.min(44 * u, rowH * 0.34), maxW: labW - 30 * u, maxLines: 2, maxH: rowH - 40 * u, lineGap: 1.12 })
        const VF = fitAll(E, vs, { role: 'num', weight: 800, size: Math.min(46 * u, rowH * 0.38), maxW: valW, maxLines: 1 })
        sc.items.forEach((it, i) => {
          const ry = sy0 + fr + rowH * (i + 1), bh = rowH - 12 * u - 22 * u, kb = kf(t, cues[i] - 0.15, 0.6), wFull = aw * vals[i] / max
          ctx.fillStyle = WOOD.light; ctx.fillRect(x0 + fr, ry - 12 * u, iw, 12 * u)
          ctx.fillStyle = 'rgba(60,40,20,0.15)'; ctx.fillRect(x0 + fr, ry - 3 * u, iw, 3 * u)
          let x = bx0, j = 0
          while (x < bx0 + wFull * kb - 0.5) { const w = Math.min((22 + 12 * E.hash(i, j)) * u, bx0 + wFull * kb - x); binder(ctx, x, ry - 12 * u, w - 1.5 * u, bh * (0.9 + 0.1 * E.hash(j, i)), i === hi ? accent(j) : neutral(j + i), u); x += w; j++ }
          ctx.save(); ctx.globalAlpha *= kf(t, cues[i], 0.3)
          const lh = LF[i].lines.length * LF[i].lineH
          paper(ctx, x0 + fr + 10 * u, ry - 12 * u - bh / 2 - lh / 2 - 8 * u, labW - 10 * u, lh + 16 * u, 4 * u, k.paper, u, { sh: 2 })
          txt(ctx, E, LF[i], 'body', 600, k.ink, x0 + fr + 22 * u, ry - 12 * u - bh / 2 - lh / 2, 'left'); ctx.restore()
          popAt(ctx, kf(t, cues[i] + 0.45, 0.3), x + 50 * u, ry - 12 * u - bh / 2, () => txt(ctx, E, VF[i], 'num', 800, i === hi ? k.acc : k.ink, x + 12 * u, ry - 12 * u - bh / 2 - VF[i].lineH / 2, 'left'))
          spot.push([bx0 + wFull, ry - 12 * u - bh])
        })
      }
      let cur = -1
      cues.forEach((c, i) => { if (t >= c - 0.2) cur = i })
      const tHi = cues[Math.min(hi, n - 1)] + 0.5, point = cur >= 0 ? kf(t, cues[cur] - 0.2, 0.25) * (1 - kf(t, cues[cur] + 0.7, 0.3)) : 0
      const sp = cur >= 0 ? spot[cur] : [E.W / 2, F]
      actor(ctx, X, 'b', bx, { facing: -1, look: [0.9, -0.4], mouth: t > tHi ? 'smile' : 'neutral', near: L2([-0.2, 0.32], aim(bx, hipY, hd, -1, sp[0], sp[1]), ease.inOut(point)), nearHand: point > 0.5 ? 'point' : 'fist' })
      const A = actor(ctx, X, 'a', ax, {
        facing: 1, look: [0.9, -0.5], brow: t > tHi ? 'up' : 'neutral', mouth: t > tHi && t < tHi + 1 ? 'o' : t > tHi ? 'flat' : 'smile',
        headTilt: nods(t, cues.filter((_, i) => i !== hi).map(c => c + 0.45), 0.08), sweat: kf(t, tHi + 0.3, 0.4),
      }, hop(t, tHi, 0.34) * 0.35 * hd)
      emote(ctx, E, '!', A.head[0] + 0.15 * hd, A.head[1] - 1.3 * hd, 1.0 * hd, kf(t, tHi, 0.28) * (1 - kf(t, tHi + 1.4, 0.3)), k.acc, k.wall)
    },

    // 流程。横屏：墙上拉一根晾绳，a 把卡片一张张递过去，木夹子夹在绳上，卡片晃两下停住，卡片之间画手绘箭头；
    // 竖屏：卡片一张张钉在墙上排成一列，从 a 手里往上甩过去。b 每来一张点头，最后一张到了拍手
    steps(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X, n = sc.items.length
      cam(ctx, E, s, F)
      const top = wallTitle(ctx, s, E, X, sc.title, E.W / 2, b.w) + 14 * u, hipY = F - 3.25 * hd
      const ax = por ? b.x + 0.85 * hd : b.x + 0.3 * hd, bx = por ? X.r - 0.85 * hd : X.r - 0.3 * hd
      const cues = sc.items.map((_, i) => s.cue(i + 1)), last = cues[n - 1]
      const th = throwArm(t, cues, [0.35, 0.28], [-0.05, -2.7], [1.15, -2.1]), hand = [ax + th.p[0] * hd, hipY + th.p[1] * hd]
      const badge = (x, y, r, i) => { ctx.fillStyle = i === n - 1 ? k.acc : k.acc2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = k.on; ctx.font = E.font('num', 800, r * 1.1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + r * 0.05) }
      const B = actor(ctx, X, 'b', bx, { facing: -1, look: [0.9, -0.4], mouth: t > last + 0.2 ? 'grin' : 'smile', headTilt: nods(t, cues.slice(0, -1).map(c => c + 0.12), 0.09), ...(t > last + 0.25 && t < last + 1.4 ? clap(t) : {}) })
      emote(ctx, E, 'spark', B.head[0] - 0.1 * hd, B.head[1] - 1.0 * hd, 0.9 * hd, kf(t, last + 0.3, 0.3), k.acc, k.wall)
      actor(ctx, X, 'a', ax, { facing: 1, look: [0.9, -0.5], mouth: 'smile', near: th.p, nearHand: th.open ? 'open' : 'fist' })
      // 横屏一排放不下（每张卡不到 240 宽，比如 1:1）时也改成一列，人物仍站两边
      const col = por || (b.w - 2.6 * hd - 58 * u * (n - 1)) / n < 240 * u, cx0 = por ? b.x : b.x + 1.3 * hd, cwid = por ? b.w : b.w - 2.6 * hd
      if (!col) {
        const lx0 = b.x + 1.3 * hd, lx1 = X.r - 1.3 * hd, sag = 26 * u, gap = 58 * u, cw = (lx1 - lx0 - gap * (n - 1)) / n
        const r = Math.min(34 * u, cw * 0.16), ch = Math.min(F - 1.4 * hd - top - 74 * u, 440 * u)
        const FS = fitAll(E, sc.items, { role: 'body', weight: 500, size: 56 * u, maxW: cw - 40 * u, maxLines: 4, maxH: ch - r * 2 - 70 * u, lineGap: 1.2 })
        const th2 = Math.max(...FS.map(f => f.lines.length * f.lineH)), chh = Math.min(ch, Math.max(cw * 0.95, th2 + r * 2 + 100 * u)), ly = top + 24 * u + Math.max(0, (ch - chh) * 0.35)
        const sagY = x => ly + sag * (1 - Math.pow(((x - lx0) / (lx1 - lx0)) * 2 - 1, 2))
        ctx.strokeStyle = '#8F8578'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(lx0 - 14 * u, ly)
        for (let q = 1; q <= 20; q++) { const x = lx0 + (lx1 - lx0) * q / 20; ctx.lineTo(x, sagY(x)) }
        ctx.lineTo(lx1 + 14 * u, ly); ctx.stroke()
        for (const x of [lx0 - 14 * u, lx1 + 14 * u]) pin(ctx, x, ly, 9 * u, k.muted)
        sc.items.forEach((it, i) => {
          const x = lx0 + i * (cw + gap), cx = x + cw / 2, cy = sagY(cx) + 4 * u
          if (i > 0) handArrow(ctx, x - gap + 10 * u, cy + chh * 0.5, x - 8 * u, cy + chh * 0.5, kf(t, cues[i] + 0.06, 0.3), k.soft, 4 * u, -0.25)
          const sw = t > cues[i] + 0.06 ? 0.12 * Math.sin((t - cues[i] - 0.06) * 12) * Math.max(0, 1 - (t - cues[i] - 0.06) / 0.9) : 0
          flyIn(ctx, t, cues[i], hand, [cx, cy], () => {
            ctx.rotate(sw)
            paper(ctx, -cw / 2, 8 * u, cw, chh, 8 * u, k.paper, u, { stroke: k.line, lw: 2 })
            badge(0, 8 * u + 30 * u + r, r, i)
            const f = FS[i], ty = 8 * u + 30 * u + r * 2 + 20 * u
            txt(ctx, E, f, 'body', 500, k.ink, 0, ty + (chh - (ty - 8 * u) - 20 * u - f.lines.length * f.lineH) / 2, 'center')
            clip(ctx, 0, 0, 40 * u)
          })
        })
      } else {
        const zy0 = top + 10 * u, zy1 = por ? F - 6.6 * hd - 30 * u : F - 50 * u, gap = 44 * u, ch = Math.min((zy1 - zy0 - gap * (n - 1)) / n, 260 * u), cw = cwid, r = Math.min(42 * u, ch * 0.3)
        const y0 = zy0 + (zy1 - zy0 - n * ch - (n - 1) * gap) / 2, tx = r * 2 + 64 * u
        const FS = fitAll(E, sc.items, { role: 'body', weight: 500, size: 56 * u, maxW: cw - tx - 36 * u, maxLines: 3, maxH: ch * 0.86, lineGap: 1.2 })
        sc.items.forEach((it, i) => {
          const y = y0 + i * (ch + gap), x = cx0
          if (i > 0) handArrow(ctx, x + 30 * u + r, y - gap + 8 * u, x + 30 * u + r, y - 6 * u, kf(t, cues[i] + 0.06, 0.3), k.soft, 4 * u, 0.3)
          flyIn(ctx, t, cues[i], hand, [x + cw / 2, y + ch / 2], () => {
            ctx.rotate(i % 2 ? 0.006 : -0.008); ctx.translate(-cw / 2, -ch / 2)
            paper(ctx, 0, 0, cw, ch, 8 * u, k.paper, u, { stroke: k.line, lw: 2 })
            badge(30 * u + r, ch / 2, r, i); pin(ctx, cw - 22 * u, 16 * u, 9 * u, k.acc)
            const f = FS[i]; txt(ctx, E, f, 'body', 500, k.ink, tx, (ch - f.lines.length * f.lineH) / 2, 'left')
          })
        })
      }
    },

    // 对比：两人各举一块牌子。横屏两人站在两边，一手握着牌子的上沿、一手握着下沿；竖屏两人站在各自的牌子下面，举过头顶。
    // 右边那块是强调色的牌头，条目前一个个打勾；右边举起来时 a 蹦一下，b 扭头看过去、冒汗
    compare(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X
      cam(ctx, E, s, F)
      const top = wallTitle(ctx, s, E, X, sc.title, E.W / 2, b.w) + 22 * u, hipY = F - 3.25 * hd
      const cl = s.cue(1), cr = s.cue(2), gap = E.pick(44, 30) * u
      let boxes, who
      if (!por) {
        const bx = b.x + 0.3 * hd, ax = X.r - 0.3 * hd, e = 0.95 * hd, y1 = F - 1.5 * hd
        boxes = [[bx + e, top, E.W / 2 - gap / 2 - bx - e, y1 - top], [E.W / 2 + gap / 2, top, ax - e - E.W / 2 - gap / 2, y1 - top]]
        who = [bx, ax]
      } else {
        const bw = (b.w - gap) / 2, y1 = hipY - 3.58 * hd - 6 * u
        boxes = [[b.x, top, bw, y1 - top], [b.x + bw + gap, top, bw, y1 - top]]
        who = [b.x + bw / 2 - 0.1 * hd, b.x + bw * 1.5 + gap + 0.1 * hd]
      }
      const pad = E.pick(34, 30) * u, sides = [sc.left, sc.right]
      const G = sides.map((side, i) => {
        const [x, y, w, h] = boxes[i], tf = E.fit(side.title, { role: 'title', weight: 900, size: E.pick(52, 50) * u, maxW: w - pad * 2, maxLines: 2 })
        const hh = tf.lines.length * tf.lineH + pad * 1.2, items = side.items || []
        return { x, y, w, h, tf, hh, items, rowH: Math.min((h - hh - pad * 1.5) / Math.max(1, items.length), 140 * u) }
      })
      const rowH = Math.min(G[0].rowH, G[1].rowH), FS = fitAll(E, [...G[0].items, ...G[1].items], { role: 'body', weight: 500, size: Math.min(46 * u, rowH * 0.42), maxW: Math.min(G[0].w, G[1].w) - pad * 2 - 54 * u, maxLines: 2, maxH: rowH * 0.92, lineGap: 1.18 })
      const ups = [cl, cr].map(c => ob(kf(t, c - 0.15, 0.45))), lift = hop(t, cr + 0.3, 0.34) * 0.3 * hd
      const boards = () => G.forEach((g, i) => {
        if (ups[i] <= 0) return
        const strong = i === 1, dy = (1 - ups[i]) * g.h * 0.35 - (strong ? lift : 0)
        ctx.save(); ctx.globalAlpha *= clamp(ups[i] * 3); ctx.translate(0, dy)
        sign(ctx, g.x, g.y, g.w, g.h, u, k.paper, strong ? k.acc : k.ink)
        ctx.save(); E.roundRect(ctx, g.x, g.y, g.w, g.h, 16 * u); ctx.clip(); ctx.fillStyle = strong ? k.acc : mix(k.paper, k.ink, 0.1); ctx.fillRect(g.x, g.y, g.w, g.hh); ctx.restore()
        txt(ctx, E, g.tf, 'title', 900, strong ? k.on : k.ink, g.x + g.w / 2, g.y + pad * 0.6, 'center')
        const fs = strong ? FS.slice(G[0].items.length) : FS.slice(0, G[0].items.length), c = strong ? cr : cl
        fs.forEach((f, j) => {
          const cy = g.y + g.hh + pad * 0.6 + rowH * (j + 0.5), mx = g.x + pad + 18 * u
          if (strong) check(ctx, mx, cy, 34 * u, kf(t, c + 0.35 + j * 0.2, 0.25), k.acc, 0.2)
          else { ctx.fillStyle = k.muted; ctx.beginPath(); ctx.arc(mx, cy, 8 * u, 0, Math.PI * 2); ctx.fill() }
          txt(ctx, E, f, 'body', 500, k.ink, g.x + pad + 50 * u, cy - f.lines.length * f.lineH / 2, 'left')
        })
        ctx.restore()
      })
      // 手腕贴在牌子边上：横屏握牌子的内侧边（一上一下），竖屏举在牌子下沿
      const grip = (i, f) => {
        if (ups[i] <= 0) return {}
        const g = G[i], dy = (1 - ups[i]) * g.h * 0.35 - (i === 1 ? lift : 0), hy = hipY - (i === 1 ? lift : 0)
        if (por) return overhead(X, g.y + g.h + dy + 6 * u, hy)
        const ex = i ? g.x + g.w : g.x
        return { near: aim(who[i], hy, hd, f, ex, hy - 3.3 * hd + dy), far: aim(who[i], hy, hd, f, ex, hy - 1.3 * hd + dy), nearHand: 'fist', farHand: 'fist' }
      }
      const glance = t > cr + 0.5
      if (!por) boards()
      actor(ctx, X, 'b', who[0], { facing: 1, look: glance ? [1, -0.4] : [0.2, 0], brow: glance ? 'worry' : 'neutral', mouth: glance ? 'flat' : 'neutral', sweat: kf(t, cr + 0.6, 0.4), headTilt: nod(t, cl + 0.35), headTurn: turnAt(t, cr + 0.5, cr + 1.7), ...grip(0, 1) })
      const A = actor(ctx, X, 'a', who[1], { facing: -1, look: [0.2, -0.2], brow: t > cr ? 'up' : 'neutral', mouth: t > cr ? 'grin' : 'neutral', ...grip(1, -1) }, lift)
      if (por) boards()
      emote(ctx, E, 'spark', A.head[0] + E.pick(0, 1.35) * hd, A.head[1] - E.pick(1.0, 0.15) * hd, 0.9 * hd, kf(t, cr + 0.45, 0.3), k.acc, k.wall)
    },

    // 引语：a 头上一只大对话气泡，左上角一枚强调色的大引号，字边说边一个个出来，出处签在气泡右下角；
    // a 说话时嘴一张一合、手跟着比划，b 在旁边听，听到一半和说完各点一次头
    quote(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X
      cam(ctx, E, s, F)
      const c0 = s.cue(0), cb = sc.by ? s.cue(1) : null, hipY = F - 3.25 * hd
      // 横屏气泡在 a 的右上方，尾巴从左沿伸向 a 的嘴；竖屏气泡在 a 头顶，尾巴从下沿往下
      const ax = por ? b.x + 1.6 * hd : b.x + 0.6 * hd
      const zx0 = por ? b.x : b.x + 1.9 * hd, zx1 = por ? X.r : X.r - 1.6 * hd, zy0 = b.y, zy1 = por ? F - 6.5 * hd - 76 * u : F - 3.4 * hd, zw = zx1 - zx0
      const padX = E.pick(96, 84) * u, padY = E.pick(50, 50) * u
      const byf = sc.by ? E.fit('— ' + sc.by, { role: 'body', weight: 500, size: E.pick(40, 38) * u, maxW: zw * 0.6, maxLines: 1 }) : null, byRoom = byf ? byf.lineH + 14 * u : 0
      const f = E.fit(sc.text, { role: 'body', weight: 500, size: E.pick(82, 76) * u, maxW: zw - padX * 2, maxLines: E.pick(4, 6), maxH: zy1 - zy0 - padY * 2 - byRoom, lineGap: 1.38 })
      const bw = Math.max(f.width + padX * 2, byf ? byf.width + padX * 2 : 0, zw * 0.5), bh = f.lines.length * f.lineH + padY * 2 + byRoom
      const bx0 = por ? Math.min(zx1 - bw, Math.max(zx0, ax - bw * 0.4)) : zx0, by0 = por ? Math.max(zy0, zy1 - bh) : zy0 + Math.max(0, (zy1 - zy0 - bh) * 0.55)
      const bx = por ? X.r - 0.9 * hd : Math.min(X.r - 0.5 * hd, bx0 + bw + 1.4 * hd)
      if (!por) plant(ctx, X.r + 1.0 * hd, F, 1.7 * hd)
      const n = [...f.lines.join('')].length, typeD = Math.min(1.6, Math.max(0.5, n * 0.06)), done = c0 + typeD
      const gest = kf(t, c0, 0.3) * (1 - kf(t, done + 0.2, 0.4)), sway = Math.sin(t * 7) * 0.12
      const A = actor(ctx, X, 'a', ax, { facing: 1, look: cb != null && t > cb ? [1, 0] : [0.3, -0.6], brow: 'up', mouth: talk(t, c0, done) || 'smile', near: L2([-0.2, 0.32], [0.95, -1.75 + sway], gest), nearHand: gest > 0.4 ? 'open' : 'fist' })
      actor(ctx, X, 'b', bx, { facing: -1, look: [0.8, -0.3], mouth: t > done ? 'smile' : 'neutral', headTilt: nod(t, c0 + typeD * 0.5) + nod(t, done + 0.2) + (cb != null ? nod(t, cb + 0.1) : 0) })
      const kb = kf(t, c0 - 0.15, 0.4)
      if (kb <= 0) return
      let tip, tri
      if (por) {
        tip = [A.head[0] + 0.25 * hd, A.head[1] - 0.95 * hd]
        const tb = Math.min(bx0 + bw - 70 * u, Math.max(bx0 + 70 * u, tip[0] + 60 * u))
        tri = [[tb - 23 * u, by0 + bh - 3 * u], [tb + 23 * u, by0 + bh - 3 * u], tip]
      } else {
        tip = [A.head[0] + 0.7 * hd, A.head[1] + 0.1 * hd]
        const ty = Math.min(by0 + bh - 50 * u, Math.max(by0 + 50 * u, tip[1] - 60 * u))
        tri = [[bx0 + 3 * u, ty - 23 * u], [bx0 + 3 * u, ty + 23 * u], tip]
      }
      popAt(ctx, kb, tip[0], tip[1], () => {
        bubble(ctx, bx0, by0, bw, bh, tri, k.paper, k.ink, u)
        ctx.font = E.font('title', 900, 150 * u); ctx.fillStyle = k.acc; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('“', bx0 + 22 * u, by0 + 10 * u)
        let left = Math.round(n * kf(t, c0, typeD))
        ctx.font = E.font('body', 500, f.size); ctx.fillStyle = k.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        f.lines.forEach((ln, j) => { const cs = [...ln], m = Math.min(cs.length, left); left -= m; if (m <= 0) return; const full = ctx.measureText(ln).width; ctx.textAlign = 'left'; ctx.fillText(cs.slice(0, m).join(''), bx0 + bw / 2 - full / 2, by0 + padY + j * f.lineH + f.lineH / 2) })
        if (byf) { ctx.save(); ctx.globalAlpha *= kf(t, cb, 0.35); txt(ctx, E, byf, 'body', 500, k.soft, bx0 + bw - padX * 0.6, by0 + bh - padY * 0.7 - byf.lineH, 'right'); ctx.restore() }
      })
    },

    // 片尾：两人一左一右举着杆子，杆子中间一条横幅从中间往两边展开；cta 是两人中间胸口高的一个强调色按钮。
    // 横幅展开时两人一起咧嘴笑，副标题出来时点头，按钮出来后 a 蹦一下，两人挥手
    end(ctx, s, E) {
      const X = setup(this, s, E), { u, b, por, F, hd, t, k, sc } = X
      cam(ctx, E, s, F)
      let i = 0
      const ct = s.cue(i++), cs = sc.subtitle ? s.cue(i++) : null, cc = sc.cta ? s.cue(i++) : null
      const ax = b.x + E.pick(0.4, 0.35) * hd, bx = X.r - E.pick(0.4, 0.35) * hd, hipY = F - 3.25 * hd
      const raise = ob(kf(t, ct - 0.4, 0.4)), hand = [0.72, L2([0.4, -1.0], [0.72, -3.0], raise)[1]], hy = hipY + hand[1] * hd
      const x0 = ax + 0.72 * hd, x1 = bx - 0.72 * hd, cw = x1 - x0, pad = E.pick(40, 36) * u, bot = hipY - 3.0 * hd - 0.4 * hd
      const sub = sc.subtitle ? E.fit(sc.subtitle, { role: 'body', weight: 500, size: E.pick(48, 46) * u, maxW: cw - pad * 2, maxLines: 2 }) : null, subH = sub ? sub.lines.length * sub.lineH + 26 * u : 0
      const big = E.fit(sc.title, { role: 'title', weight: 900, size: E.pick(118, 100) * u, maxW: cw - pad * 2, maxLines: E.pick(2, 3), maxH: bot - b.y - pad * 2 - subH - 24 * u, lineGap: 1.18, oneLine: true })
      const bh = big.lines.length * big.lineH + subH + pad * 2 + 24 * u, by = bot - bh, drop = (1 - raise) * 2.0 * hd
      const wavy = cc != null ? cc + 0.3 : (cs ?? ct) + 0.9, waving = t > wavy, lift = cc != null ? hop(t, cc + 0.1, 0.34) * 0.3 * hd : 0
      const pose = (f, extra) => ({ facing: f, look: [0.3, -0.3], brow: t > ct ? 'up' : 'neutral', mouth: t > ct ? 'grin' : 'smile', near: hand, nearHand: 'fist', ...(waving ? { far: wave(t + (f > 0 ? 0 : 0.4)), farHand: 'open' } : {}), ...extra })
      // 杆子在人物后面，横幅挂在两根杆子之间
      if (raise > 0) {
        ctx.fillStyle = WOOD.shade
        for (const [x, lf] of [[x0, lift], [x1, 0]]) E.roundRect(ctx, x - 6 * u, by - 26 * u + drop - lf, 12 * u, hy + 0.5 * hd - by + 26 * u, 6 * u), ctx.fill()
        const un = ease.inOut(kf(t, ct - 0.2, 0.55)), cx = (x0 + x1) / 2, yb = by + drop
        ctx.save(); ctx.beginPath(); ctx.rect(cx - (cw / 2) * un - 2, yb - 40 * u, cw * un + 4, bh + 80 * u); ctx.clip()
        paper(ctx, x0, yb, cw, bh, 4 * u, k.paper, u, { sh: 6 })
        ctx.fillStyle = k.acc; ctx.fillRect(x0, yb, cw, 12 * u); ctx.fillRect(x0, yb + bh - 12 * u, cw, 12 * u)
        txt(ctx, E, big, 'title', 900, k.ink, cx, yb + pad + 12 * u, 'center')
        if (sub) { ctx.save(); ctx.globalAlpha *= kf(t, cs, 0.35); txt(ctx, E, sub, 'body', 500, k.soft, cx, yb + pad + 12 * u + big.lines.length * big.lineH + 26 * u, 'center'); ctx.restore() }
        ctx.restore()
      }
      actor(ctx, X, 'a', ax, pose(1, { headTilt: cs != null ? nod(t, cs + 0.1) : 0 }), lift)
      actor(ctx, X, 'b', bx, pose(-1, { headTilt: cs != null ? nod(t, cs + 0.2) : 0 }))
      if (cc != null) {
        const cf = E.fit(sc.cta, { role: 'title', weight: 800, size: E.pick(48, 46) * u, maxW: cw * 0.7, maxLines: 1 }), w = cf.width + 100 * u, h = cf.size * 2.1, cx = E.W / 2, cy = F - E.pick(3.6, 3.4) * hd
        const press = t > cc + 0.9 && t < cc + 1.05 ? 4 * u : 0
        popAt(ctx, kf(t, cc, 0.36), cx, cy, () => {
          ctx.fillStyle = mix(k.acc, '#000000', 0.3); E.roundRect(ctx, cx - w / 2, cy - h / 2 + 8 * u, w, h, h / 2); ctx.fill()
          ctx.fillStyle = k.acc; E.roundRect(ctx, cx - w / 2, cy - h / 2 + press, w, h, h / 2); ctx.fill()
          ctx.font = E.font('title', 800, cf.size); ctx.fillStyle = k.on; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(cf.lines[0], cx, cy + press + cf.size * 0.04)
        })
      }
    },
  },

  // 字幕：奶油色圆角底板、整圈细边、深墨字（黑体）；底板的投影是错开的一层半透明暖灰
  caption(ctx, s, E) {
    const say = s.scene.say
    if (!say) return
    const { W, H, u } = E, c = this.c
    const chunks = captionChunks(say, E.portrait ? 16 : 28), lens = chunks.map(x => textUnits(x)), total = lens.reduce((a, v) => a + v, 0), span = Math.max(0.5, s.dur - 0.3)
    let acc = 0, idx = chunks.length - 1, t0 = 0, t1 = span
    for (let i = 0; i < chunks.length; i++) { const d = span * lens[i] / total; if (s.t < acc + d) { idx = i; t0 = acc; t1 = acc + d; break } acc += d }
    const a = Math.min(clamp((s.t - t0) / 0.18), idx === chunks.length - 1 ? 1 : clamp((t1 - s.t) / 0.12))
    if (a <= 0) return
    const size = E.pick(42, 46) * u
    const f = E.fit(chunks[idx].replace(/[，、：:,]$/u, ''), { role: 'title', weight: 500, size, maxW: W - E.safe.l * 2 - size * 1.2, maxLines: 2, lineGap: 1.42, quiet: true })
    const padX = size * 0.6, padY = size * 0.34, bw = f.width + padX * 2, bh = f.lines.length * f.lineH + padY * 2 - (f.lineH - size) * 0.6
    const cy = H - E.captionH / 2 - (E.portrait ? 30 * u : 0) + (1 - ease.out(a)) * 8 * u, x = W / 2 - bw / 2, y = cy - bh / 2, r = size * 0.42
    ctx.globalAlpha = a
    ctx.fillStyle = 'rgba(70,50,30,0.12)'; E.roundRect(ctx, x + 2 * u, y + 5 * u, bw, bh, r); ctx.fill()
    ctx.fillStyle = rgba(c.card, 0.95); E.roundRect(ctx, x, y, bw, bh, r); ctx.fill()
    ctx.strokeStyle = rgba(c.fg, 0.14); ctx.lineWidth = 1.6 * u; E.roundRect(ctx, x, y, bw, bh, r); ctx.stroke()
    txt(ctx, E, f, 'title', 500, c.fg, W / 2, cy - f.lines.length * f.lineH / 2, 'center')
  },

  // 最上层：纸纹颗粒和暖色暗角，只算一次
  overlay(ctx, E) { ctx.drawImage(E.once('skit-grain', () => grain(E)), 0, 0) },

  // 转场：快速横推，上一场往左推走一截并压暗，这一场从右边推进来
  transitionDur: 0.42,
  transition(ctx, A, B, p, E) {
    const e = ease.inOutExpo(p)
    ctx.drawImage(A, -E.W * 0.35 * e, 0)
    ctx.fillStyle = `rgba(46,43,51,${0.12 * e})`; ctx.fillRect(0, 0, E.W, E.H)
    ctx.drawImage(B, E.W * (1 - e), 0)
  },

  // 默认摆法会用到的零件（九种版式都重画了，custom 场借用时才用到）：纸卡、文件夹色块、图钉、马克笔线
  card(ctx, E, x, y, w, h, o = {}) { paper(ctx, x, y, w, h, 14 * E.u, o.tone === 'accent' ? this.c.accent : this.c.card, E.u, { stroke: o.tone === 'accent' ? null : this.c.line, lw: 2 }) },
  bar(ctx, E, x, y, w, h, o = {}) { if (Math.abs(w) > 1 && Math.abs(h) > 1) paper(ctx, Math.min(x, x + w), Math.min(y, y + h), Math.abs(w), Math.abs(h), 4 * E.u, o.color ?? this.c.accent, E.u, { sh: 3 }) },
  mark(ctx, E, x, y, r, i, o = {}) { pin(ctx, x, y, r * 0.8, o.color ?? this.c.accent) },
  underline(ctx, E, x, y, w, p) { marker(ctx, x, y, w, p, rgba(this.c.accent, 0.85), 7 * E.u) },

  // 自己加的音效：数字滚完人物吓一跳、对比时 b 冒汗、流程最后一张卡夹上
  sounds(TL) {
    const out = []
    for (const S of TL.scenes) {
      const c = S.cues
      if (S.layout === 'number') out.push({ t: S.t0 + c[0] + Math.min(1.4, S.dur * 0.35), kind: 'pop', gain: 0.3 })
      if (S.layout === 'compare') out.push({ t: S.t0 + c[Math.min(2, c.length - 1)] + 0.6, kind: 'tick', gain: 0.3 })
      if (S.layout === 'steps') out.push({ t: S.t0 + c[c.length - 1] + 0.35, kind: 'chime', gain: 0.25 })
    }
    return out
  },
}

// 纸纹：确定性噪点 + 暖色暗角，整片只算一次
function grain(E) {
  const c = E.createCanvas(E.W, E.H), g = c.getContext('2d'), img = g.createImageData(E.W, E.H), d = img.data, r = E.rng(17)
  for (let i = 0; i < d.length; i += 4) { const v = r(), dark = v < 0.55; d[i] = dark ? 80 : 255; d[i + 1] = dark ? 60 : 250; d[i + 2] = dark ? 40 : 240; d[i + 3] = Math.floor(Math.abs(v - 0.55) * 20) }
  g.putImageData(img, 0, 0)
  const vg = g.createRadialGradient(E.W / 2, E.H / 2, Math.min(E.W, E.H) * 0.5, E.W / 2, E.H / 2, Math.hypot(E.W, E.H) * 0.62)
  vg.addColorStop(0, 'rgba(90,70,50,0)'); vg.addColorStop(1, 'rgba(90,70,50,0.10)')
  g.fillStyle = vg; g.fillRect(0, 0, E.W, E.H)
  return c
}
