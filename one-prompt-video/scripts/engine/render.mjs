// 出帧：drawFrame(ctx, T) 把全片第 T 秒的画面画到 ctx 上。同一个 T 永远画出同一张图。
import { clamp, lerp, ease, fitText, invLerp, k, inOut, rng, hash, noise1, rgba, mix, hexToRgb, wrapText, spacedText, roundRect, typeOn } from './core.mjs'
import { LAYOUTS, drawCaption } from './layouts.mjs'

// clips[i]：第 i 场是素材片段时，{ load(k) 读进第 k 帧（异步）, frame(k) 取已读进来的第 k 帧, n 帧数, w, h 图的尺寸 }
// 有素材片段的片子，每次 drawFrame(ctx, T) 之前先 await prepare(T)
export function makeRenderer({ v, theme, TL, fonts, W, H, createCanvas, custom = {}, clips = {} }) {
  // 竖屏多半在手机上看：整体放大两成，字才够大
  const portrait = H > W, u = Math.min(W, H) / 1080 * (portrait ? 1.2 : 1)
  const hasCaption = v.scenes.some(s => s.say)
  const captionH = hasCaption ? (portrait ? 260 : 170) * u : 0
  const safe = { l: (portrait ? 64 : 130) * u, r: (portrait ? 64 : 130) * u, t: (portrait ? 170 : 110) * u, b: hasCaption ? captionH + 20 * u : (portrait ? 170 : 110) * u }
  const roleStack = { title: fonts[theme.fontTitle] || fonts.sans, body: fonts[theme.fontBody] || fonts.sans, num: fonts[theme.fontNum] || fonts.sans, mono: fonts.mono }
  const warnings = new Set()
  const fitCache = new Map()
  const layer = createCanvas(W, H), lctx = layer.getContext('2d')
  const store = new Map()
  // 给风格包用的版式信息：safe 是四周留的边，box 是中间能放内容的区域（已经让开了字幕）
  const L = { W, H, u, cx: W / 2, cy: H / 2, portrait, safe: { top: safe.t, bottom: safe.b, left: safe.l, right: safe.r }, box: { x: safe.l, y: safe.t, w: W - safe.l - safe.r, h: H - safe.t - safe.b } }
  const enterDur = { pop: 0.36, slam: 0.3, fade: 0.6, rise: 0.5, draw: 0.6 }[theme.motion] || 0.5

  function makeE(T, sceneIndex) {
    const E = {
      W, H, u, portrait, safe, captionH, theme, T, total: TL.total, sceneIndex, sceneCount: TL.scenes.length, L, fonts,
      clamp, lerp, invLerp, ease, k, inOut, rng, hash, noise1, rgba, mix, mixColor: mix, hexToRgb, wrapText, spacedText, roundRect, typeOn,
      createCanvas: (w, h) => createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))),
      pick: (land, port) => (portrait ? port : land),
      // 只算一次的东西（纹理、贴图）：第一次调用时算，以后直接取
      once(name, make) { if (!store.has(name)) store.set(name, make()); return store.get(name) },
      font: (role, weight, size) => `${weight} ${size.toFixed(1)}px ${roleStack[role] || roleStack.body}`,
      fit(text, o) {
        const key = [text, o.role, o.weight, o.size, o.maxW, o.maxLines, o.maxH, o.lineGap, o.oneLine, o.quiet, o.silent].join('|')
        let f = fitCache.get(key)
        if (!f) {
          f = fitText(lctx, String(text), { font: sz => E.font(o.role, o.weight, sz), maxW: o.maxW, maxLines: o.maxLines, size: o.size, minSize: o.minSize, lineGap: o.lineGap, maxH: o.maxH, oneLine: o.oneLine })
          fitCache.set(key, f)
          const short = [...String(text)].slice(0, 14).join('') + ([...String(text)].length > 14 ? '…' : '')
          // silent：只是试排一下，放不下也不记进报告
          if (o.silent) return f
          if (f.overflow) warnings.add(`第 ${sceneIndex + 1} 场：「${short}」字太多，放不下，已被截在框外。把这段字缩短。`)
          else if (!o.quiet && f.size < o.size * 0.72) warnings.add(`第 ${sceneIndex + 1} 场：「${short}」字偏多，字号被缩到原来的 ${Math.round(f.size / o.size * 100)}%。缩短一些更好看。`)
        }
        return f
      },
      // 按主题的入场方式画一个元素：p 是入场进度，(cx, cy) 是缩放中心
      enter(ctx, p, cx, cy, fn) {
        if (p <= 0) return
        ctx.save()
        const m = theme.motion
        if (m === 'pop') { const k = lerp(0.5, 1, ease.back(p)); ctx.globalAlpha *= clamp(p * 3); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy) }
        else if (m === 'slam') { const k = lerp(1.5, 1, ease.out(p)); ctx.globalAlpha *= clamp(p * 2.5); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy) }
        else if (m === 'fade') ctx.globalAlpha *= ease.inOut(p)
        else if (m === 'draw') { ctx.globalAlpha *= clamp(p * 1.8); ctx.translate(-(1 - ease.out(p)) * 14 * u, 0) }
        else { ctx.globalAlpha *= clamp(p * 1.6); ctx.translate(0, (1 - ease.out(p)) * 36 * u) }
        fn()
        ctx.restore()
      },
    }
    return E
  }

  function sceneAt(T) {
    let k = 0
    while (k + 1 < TL.scenes.length && T >= TL.scenes[k + 1].t0 - 1e-9) k++
    return TL.scenes[k]
  }

  const resetCtx = c => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.shadowColor = 'transparent' }
  // 把一场画到 ctx 上（背景加内容，不含字幕）。t 是这一场已过的秒数，转场时上一场会以 t 大于 dur 被画。
  // plain：不加引擎自带的淡入、推移（风格包自己做转场时用）
  function drawScene(ctx, S, t, T, plain) {
    const E = makeE(T, S.i)
    const s = { scene: S.scene, layout: S.layout, t, dur: S.dur, index: S.i, count: TL.scenes.length, cue: i => S.cues[Math.min(i, S.cues.length - 1)], p: i => clamp((t - S.cues[Math.min(i, S.cues.length - 1)]) / enterDur) }
    resetCtx(ctx)
    ctx.save(); theme.bg(ctx, E, s); ctx.restore()
    // 内容先画到一张透明的层上，再整层贴上去：转场时整层一起淡入、推移
    resetCtx(lctx)
    lctx.clearRect(0, 0, W, H)
    lctx.save()
    const draw = S.layout === 'clip' ? drawClip : S.layout === 'custom' ? custom[S.i] : (theme.layouts && theme.layouts[S.layout]) || LAYOUTS[S.layout]
    draw.call(theme, lctx, s, E)
    lctx.restore()
    // 铺满画面的素材片段硬切进来，不做淡入：两段素材之间不该闪一下底色
    const last = S.i === TL.scenes.length - 1, cut = plain || theme.transition === 'cut' || (S.layout === 'clip' && S.scene.fit !== 'contain')
    const tin = cut ? 1 : clamp(t / 0.3), tout = cut || last ? 1 : clamp((S.dur - t) / 0.2)
    ctx.save()
    ctx.globalAlpha = Math.min(ease.out(tin), tout)
    const dx = !plain && theme.transition === 'slide' ? ((1 - ease.out(tin)) * 70 - (1 - tout) * 50) * u : 0
    ctx.drawImage(layer, dx, 0)
    ctx.restore()
    return { E, s }
  }

  // 素材片段：把这一场此刻的那一帧画上去。cover 铺满画面；contain 完整放在内容区中间，带一圈细边
  function drawClip(ctx, s, E) {
    const C = clips[s.index], sc = s.scene
    const img = C && C.n ? C.frame(clipIndex(C, s.t)) : null
    if (sc.fit === 'contain') {
      const b = L.box, iw = C ? C.w : b.w, ih = C ? C.h : b.h, k = Math.min(b.w / iw, b.h / ih), w = iw * k, h = ih * k, x = b.x + (b.w - w) / 2, y = b.y + (b.h - h) / 2
      E.enter(ctx, s.p(0), W / 2, y + h / 2, () => {
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h)
        if (img) ctx.drawImage(img, x, y, w, h)
        ctx.strokeStyle = theme.c.line; ctx.lineWidth = 3 * u; ctx.strokeRect(x, y, w, h)
      })
    } else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); if (img) ctx.drawImage(img, 0, 0, W, H) }
    if (sc.title) {
      const f = E.fit(sc.title, { role: 'body', weight: 700, size: 40 * u, maxW: W * 0.6, maxLines: 1 }), padX = 26 * u, h = f.lineH + 20 * u, x = safe.l, y = safe.t
      E.enter(ctx, s.p(1), x, y + h / 2, () => {
        ctx.fillStyle = rgba(theme.c.fg, 0.88); roundRect(ctx, x, y, f.width + padX * 2, h, 10 * u); ctx.fill()
        ctx.fillStyle = theme.c.bg; ctx.font = E.font('body', 700, f.size); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(f.lines[0], x + padX, y + h / 2)
      })
    }
  }

  const clipIndex = (C, t) => Math.max(0, Math.min(C.n - 1, Math.floor(t * TL.fps + 1e-6)))
  // 把第 T 秒要用到的素材帧读进来（这一场的，和转场时还露着的上一场的）
  async function prepare(T) {
    const S = sceneAt(T)
    for (const X of S.i > 0 ? [S, TL.scenes[S.i - 1]] : [S]) { const C = clips[X.i]; if (C && C.n) await C.load(clipIndex(C, T - X.t0)) }
  }

  let canvA = null, canvB = null
  // opt.caption === false：不画字幕（导出工程时字幕另成一轨）
  function drawFrame(ctx, T, opt = {}) {
    const S = sceneAt(T), t = Math.min(T - S.t0, S.dur + TL.tail)
    // 风格包自己的转场：transition 写成函数时，每一场开头的 transitionDur 秒里，把上一场和这一场各画成一张整图交给它
    const own = typeof theme.transition === 'function', td = Math.min(theme.transitionDur ?? 0.5, S.dur * 0.5)
    let r
    if (own && S.i > 0 && t < td) {
      if (!canvA) { canvA = createCanvas(W, H); canvB = createCanvas(W, H) }
      const P = TL.scenes[S.i - 1]
      drawScene(canvA.getContext('2d'), P, P.dur + t, T, true)
      r = drawScene(canvB.getContext('2d'), S, t, T, true)
      resetCtx(ctx)
      ctx.save(); theme.transition(ctx, canvA, canvB, clamp(t / td), r.E, { from: P.i, to: S.i, fromLayout: P.layout, toLayout: S.layout }); ctx.restore()
      resetCtx(ctx)
    } else r = drawScene(ctx, S, t, T, own)
    const { E, s } = r
    if (opt.caption !== false) { ctx.save(); if (theme.caption) theme.caption(ctx, s, E); else drawCaption(ctx, s, E); ctx.restore() }
    // 风格包的最上层：扫描线、角标、外框这一类
    E.noCaption = opt.caption === false      // 在 overlay 里自己画字幕的风格包要看这个：导出工程时字幕另成一轨，画面上不画
    if (theme.overlay) { ctx.save(); theme.overlay(ctx, E, s); ctx.restore() }
    // 开头从黑场淡入，片尾淡到黑
    const dark = Math.max(1 - clamp(T / 0.35), clamp((T - (TL.total - 0.8)) / 0.7))
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, W, H) }
    return S.i
  }

  // 总览图：每场两格（入场到一半、全部到齐），拼成一张，给人和模型自查用
  async function sheet() {
    const c = createCanvas(W, H), ctx = c.getContext('2d')
    const shots = []
    for (const S of TL.scenes) for (const q of [0.45, 0.94]) shots.push({ T: S.t0 + S.dur * q, label: `${S.i + 1} ${S.layout}  ${(S.t0 + S.dur * q).toFixed(1)}s` })
    const cols = portrait ? 6 : 4, tw = portrait ? 270 : 480, th = Math.round(tw * H / W), pad = 10, lab = 30
    const rows = Math.ceil(shots.length / cols)
    const sh = createCanvas(cols * (tw + pad) + pad, rows * (th + pad + lab) + pad), x = sh.getContext('2d')
    x.fillStyle = '#e6e3dc'; x.fillRect(0, 0, sh.width, sh.height)
    for (const [i, st] of shots.entries()) {
      await prepare(st.T); drawFrame(ctx, st.T)
      const px = pad + (i % cols) * (tw + pad), py = pad + Math.floor(i / cols) * (th + pad + lab)
      x.drawImage(c, px, py, tw, th)
      x.fillStyle = '#333'; x.font = `500 18px ${fonts.sans}`; x.textBaseline = 'top'; x.textAlign = 'left'; x.fillText(st.label, px + 2, py + th + 6)
    }
    return sh
  }

  return { drawFrame, prepare, sheet, warnings, W, H }
}
