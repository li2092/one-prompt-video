// 出帧：drawFrame(ctx, T) 把全片第 T 秒的画面画到 ctx 上。同一个 T 永远画出同一张图。
import { clamp, lerp, ease, fitText, invLerp, k, inOut, rng, hash, noise1, rgba, mix, hexToRgb, wrapText, spacedText, roundRect, typeOn } from './core.mjs'
import { LAYOUTS, drawCaption } from './layouts.mjs'

export function makeRenderer({ v, theme, TL, fonts, W, H, createCanvas, custom = {} }) {
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
        const key = [text, o.role, o.weight, o.size, o.maxW, o.maxLines, o.maxH, o.lineGap, o.oneLine].join('|')
        let f = fitCache.get(key)
        if (!f) {
          f = fitText(lctx, String(text), { font: sz => E.font(o.role, o.weight, sz), maxW: o.maxW, maxLines: o.maxLines, size: o.size, minSize: o.minSize, lineGap: o.lineGap, maxH: o.maxH, oneLine: o.oneLine })
          fitCache.set(key, f)
          const short = [...String(text)].slice(0, 14).join('') + ([...String(text)].length > 14 ? '…' : '')
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

  function drawFrame(ctx, T) {
    const S = sceneAt(T), t = Math.min(T - S.t0, S.dur + TL.tail), E = makeE(T, S.i)
    const s = { scene: S.scene, t, dur: S.dur, index: S.i, count: TL.scenes.length, cue: i => S.cues[Math.min(i, S.cues.length - 1)], p: i => clamp((t - S.cues[Math.min(i, S.cues.length - 1)]) / enterDur) }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'
    ctx.save(); theme.bg(ctx, E); ctx.restore()
    // 内容先画到一张透明的层上，再整层贴上去：转场时整层一起淡入、推移
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalAlpha = 1; lctx.globalCompositeOperation = 'source-over'; lctx.shadowBlur = 0; lctx.shadowColor = 'transparent'
    lctx.clearRect(0, 0, W, H)
    lctx.save()
    const draw = S.layout === 'custom' ? custom[S.i] : (theme.layouts && theme.layouts[S.layout]) || LAYOUTS[S.layout]
    draw.call(theme, lctx, s, E)
    lctx.restore()
    const last = S.i === TL.scenes.length - 1
    const tin = theme.transition === 'cut' ? 1 : clamp(t / 0.3), tout = theme.transition === 'cut' || last ? 1 : clamp((S.dur - t) / 0.2)
    ctx.save()
    ctx.globalAlpha = Math.min(ease.out(tin), tout)
    const dx = theme.transition === 'slide' ? ((1 - ease.out(tin)) * 70 - (1 - tout) * 50) * u : 0
    ctx.drawImage(layer, dx, 0)
    ctx.restore()
    ctx.save(); if (theme.caption) theme.caption(ctx, s, E); else drawCaption(ctx, s, E); ctx.restore()
    // 风格包的最上层：扫描线、角标、外框这一类
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
    shots.forEach((st, i) => {
      drawFrame(ctx, st.T)
      const px = pad + (i % cols) * (tw + pad), py = pad + Math.floor(i / cols) * (th + pad + lab)
      x.drawImage(c, px, py, tw, th)
      x.fillStyle = '#333'; x.font = `500 18px ${fonts.sans}`; x.textBaseline = 'top'; x.textAlign = 'left'; x.fillText(st.label, px + 2, py + th + 6)
    })
    return sh
  }

  return { drawFrame, sheet, warnings, W, H }
}
