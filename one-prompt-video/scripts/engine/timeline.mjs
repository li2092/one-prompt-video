// 校验 video.json，并把它排成时间线：每场多长、每个元素什么时候入场。
// 校验一次报出全部问题，每条都写明第几场、哪个字段、该怎么写。
import { readSeconds } from './core.mjs'
import { THEME_IDS } from './themes.mjs'
import { COUNT, visibleText } from './layouts.mjs'

const ASPECTS = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] }
export const sizeOf = aspect => ASPECTS[aspect] || ASPECTS['16:9']

// 每种版式：必填字段、可选字段
const SPEC = {
  title: { need: ['title'], opt: ['subtitle', 'kicker'] },
  statement: { need: ['text'], opt: ['highlight'] },
  bullets: { need: ['items'], opt: ['title'] },
  number: { need: ['value'], opt: ['unit', 'label', 'note'] },
  bars: { need: ['items'], opt: ['title', 'unit', 'highlight'] },
  steps: { need: ['items'], opt: ['title'] },
  compare: { need: ['left', 'right'], opt: ['title'] },
  quote: { need: ['text'], opt: ['by'] },
  end: { need: ['title'], opt: ['subtitle', 'cta'] },
  custom: { need: ['module', 'seconds'], opt: ['cues', 'data'] },
}
const COMMON = ['layout', 'say', 'seconds']
const EXAMPLE = {
  title: '{ "layout": "title", "title": "大标题", "subtitle": "一行副标题" }',
  statement: '{ "layout": "statement", "text": "一句要让人记住的话", "highlight": "记住" }',
  bullets: '{ "layout": "bullets", "title": "场标题", "items": ["第一条", "第二条", "第三条"] }',
  number: '{ "layout": "number", "value": "25", "unit": "分钟", "label": "这个数字说明什么" }',
  bars: '{ "layout": "bars", "title": "场标题", "unit": "%", "items": [{ "label": "甲", "value": 40 }, { "label": "乙", "value": 75 }] }',
  steps: '{ "layout": "steps", "title": "场标题", "items": ["第一步", "第二步", "第三步"] }',
  compare: '{ "layout": "compare", "title": "场标题", "left": { "title": "以前", "items": ["……"] }, "right": { "title": "现在", "items": ["……"] } }',
  quote: '{ "layout": "quote", "text": "引用的一句话", "by": "谁说的" }',
  end: '{ "layout": "end", "title": "收束的一句话", "subtitle": "补充一行" }',
  custom: '{ "layout": "custom", "module": "scenes/my.mjs", "seconds": 6 }',
}

const isStr = x => typeof x === 'string' && x.trim() !== ''
const strList = (x, min, max) => Array.isArray(x) && x.length >= min && x.length <= max && x.every(isStr)

export function validate(v) {
  const errors = [], warnings = []
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m)
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { errors: ['video.json 的最外层要是一个对象：{ "title": …, "theme": …, "scenes": […] }'], warnings }
  if (!isStr(v.title)) err('缺 "title"：全片的标题，也用作输出文件名。例：  "title": "番茄工作法"')
  if (v.theme != null && !THEME_IDS.includes(v.theme)) err(`"theme" 写成了 "${v.theme}"，只能是这几个之一：${THEME_IDS.join('、')}`)
  if (v.aspect != null && !ASPECTS[v.aspect]) err(`"aspect" 写成了 "${v.aspect}"，只能是 "16:9"（横屏）、"9:16"（竖屏）或 "1:1"（方形）`)
  if (v.colors != null && (typeof v.colors !== 'object' || Object.values(v.colors).some(c => !/^#[0-9a-fA-F]{6}$/.test(c)))) err('"colors" 里的颜色要写成 "#rrggbb" 六位十六进制，例：  "colors": { "accent": "#e2577a" }')
  if (v.seconds != null && !(typeof v.seconds === 'number' && v.seconds >= 8 && v.seconds <= 180)) err('最外层的 "seconds" 是全片的目标时长，要是 8 到 180 之间的数字（不带引号）。')
  for (const k of Object.keys(v)) if (!['title', 'theme', 'aspect', 'scenes', 'colors', 'font', 'tts', 'music', 'fps', 'seconds'].includes(k)) warn(`最外层有不认识的字段 "${k}"，已忽略（是不是拼错了？）`)
  if (!Array.isArray(v.scenes) || v.scenes.length === 0) { err('缺 "scenes"：一个数组，每个元素是一场。例：  "scenes": [ ' + EXAMPLE.title + ' ]'); return { errors, warnings } }
  if (v.scenes.length > 20) err(`"scenes" 有 ${v.scenes.length} 场，最多 20 场。`)
  if (v.scenes.length < 3) warn(`只有 ${v.scenes.length} 场，成片会很短；一般 5 到 9 场。`)

  v.scenes.forEach((s, i) => {
    const at = `第 ${i + 1} 场`
    if (!s || typeof s !== 'object') { err(`${at}要是一个对象，例：${EXAMPLE.title}`); return }
    const spec = SPEC[s.layout]
    if (!spec) { err(`${at}的 "layout" 写成了 ${JSON.stringify(s.layout)}，只能是：${Object.keys(SPEC).join('、')}`); return }
    const A = `${at}（${s.layout}）`, ex = `正确的写法：${EXAMPLE[s.layout]}`
    for (const k of spec.need) if (s[k] == null) err(`${A}缺 "${k}"。${ex}`)
    for (const k of Object.keys(s)) if (![...COMMON, ...spec.need, ...spec.opt].includes(k)) warn(`${A}有不认识的字段 "${k}"，已忽略。这个版式能用的字段：${[...spec.need, ...spec.opt, 'say', 'seconds'].join('、')}`)
    for (const k of ['title', 'subtitle', 'kicker', 'text', 'by', 'label', 'note', 'cta', 'unit', 'say', 'highlight']) {
      if (s[k] != null && k !== 'highlight' && typeof s[k] !== 'string') err(`${A}的 "${k}" 要是一段文字（带引号的字符串）。`)
    }
    if (s.seconds != null && !(typeof s.seconds === 'number' && s.seconds >= 2 && s.seconds <= 30)) err(`${A}的 "seconds" 要是 2 到 30 之间的数字（不带引号）。`)
    if (typeof s.say === 'string' && [...s.say].length > 36) warn(`${A}的 "say" 有 ${[...s.say].length} 个字，偏长；一场一句，30 个字以内。`)
    if (s.layout === 'bars' && isStr(s.unit) && isStr(s.title) && s.title.includes(s.unit) && /[（(]/.test(s.title)) warn(`${A}的标题里已经写了单位「${s.unit}」，"unit" 还会接在每个数后面，两处留一处就够。`)
    if ((s.layout === 'bullets' || s.layout === 'steps') && s.items != null) {
      const [mn, mx] = s.layout === 'bullets' ? [2, 5] : [2, 5]
      if (!strList(s.items, mn, mx)) err(`${A}的 "items" 要是 ${mn} 到 ${mx} 条文字组成的数组。${ex}`)
    }
    if (s.layout === 'bars' && s.items != null) {
      const ok = Array.isArray(s.items) && s.items.length >= 2 && s.items.length <= 6 && s.items.every(it => it && isStr(it.label) && typeof it.value === 'number' && isFinite(it.value) && it.value >= 0)
      if (!ok) err(`${A}的 "items" 要是 2 到 6 项，每项有 "label"（文字）和 "value"（不带引号、不小于 0 的数字）。${ex}`)
      if (s.highlight != null && !(Number.isInteger(s.highlight) && s.highlight >= 1 && s.highlight <= (s.items?.length || 0))) err(`${A}的 "highlight" 要是第几根柱子的序号（从 1 开始的整数）。`)
    }
    if (s.layout === 'number' && s.value != null && !['string', 'number'].includes(typeof s.value)) err(`${A}的 "value" 要是数字或文字，例："25"、"80%"、"1,280"。`)
    if (s.layout === 'compare') for (const side of ['left', 'right']) {
      const d = s[side]; if (d == null) continue
      if (typeof d !== 'object' || !isStr(d.title) || (d.items != null && !strList(d.items, 1, 4))) err(`${A}的 "${side}" 要有 "title"，"items" 是 1 到 4 条文字。${ex}`)
    }
    if (s.layout === 'statement' && isStr(s.text) && s.highlight != null && !(isStr(s.highlight) && s.text.includes(s.highlight))) warn(`${A}的 "highlight" 要是 "text" 里原样出现的一个词，否则不会上色。`)
    if (s.layout === 'custom' && s.module != null && !isStr(s.module)) err(`${A}的 "module" 要是画面代码文件的路径。${ex}`)
  })
  if (!errors.length) {
    if (v.scenes[0].layout !== 'title') warn('第 1 场一般用 "title" 版式开头。')
    if (v.scenes[v.scenes.length - 1].layout !== 'end') warn('最后一场一般用 "end" 版式收尾。')
    const kinds = new Set(v.scenes.map(s => s.layout))
    if (v.scenes.length >= 5 && kinds.size < 3) warn(`全片只用了 ${kinds.size} 种版式，画面会单调；换几种版式（number、bars、steps、compare、quote、statement）。`)
    for (let i = 1; i < v.scenes.length; i++) if (v.scenes[i].layout === v.scenes[i - 1].layout && v.scenes[i].layout === 'bullets') warn(`第 ${i} 场和第 ${i + 1} 场连着用 bullets，把其中一场换成别的版式。`)
  }
  return { errors, warnings }
}

// 排时间线。beat 是一拍的秒数；每场的长度凑成整数拍，切点才落在拍子上。
// voice[i]：第 i 场配音的秒数（没有就是 undefined）。
export function buildTimeline(v, theme, { fps = 30, voice = [] } = {}) {
  const bpm = theme.bpm, beat = 60 / bpm
  const scenes = []
  let t0 = 0
  const tailLen = 1.2
  const count = sc => Math.max(1, (COUNT[sc.layout] || (() => 1))(sc))
  // 没有配音时观众是看字，比听人念快：按每秒 7 个汉字估
  const guess = sc => Math.min(10, Math.max(3, 1.2 + Math.max(readSeconds(sc.say), 0.6 * readSeconds(visibleText(sc))) / 1.4 + 0.25 * count(sc)))
  const fixed = (sc, i) => sc.seconds != null || voice[i]
  // 给了全片目标时长的：把没写死时长的那些场按比例拉长或压短去凑
  let scale = 1
  if (v.seconds != null) {
    const locked = v.scenes.reduce((a, sc, i) => a + (fixed(sc, i) ? (sc.seconds ?? voice[i] + 0.7) : 0), 0)
    const free = v.scenes.reduce((a, sc, i) => a + (fixed(sc, i) ? 0 : guess(sc)), 0)
    if (free > 0) scale = Math.max(0.5, Math.min(2.5, (v.seconds - tailLen - locked) / free))
  }
  v.scenes.forEach((sc, i) => {
    const n = count(sc)
    let want
    if (sc.seconds != null) want = sc.seconds
    else if (voice[i]) want = voice[i] + 0.7
    else want = Math.max(2.5, guess(sc) * scale)
    if (voice[i]) want = Math.max(want, voice[i] + 0.4)
    const beats = Math.max(4, Math.ceil(want / beat - 1e-6))
    const dur = beats * beat
    const step = n > 1 ? Math.min(beat, Math.max(0.25, (dur * 0.55 - 0.35) / (n - 1))) : 0
    const cues = Array.from({ length: n }, (_, k) => +(0.35 + k * step).toFixed(3))
    scenes.push({ i, layout: sc.layout, t0, dur, cues, scene: sc })
    t0 += dur
  })
  const tail = tailLen
  return { fps, bpm, beat, scenes, body: t0, tail, total: t0 + tail, frames: Math.round((t0 + tail) * fps) }
}
