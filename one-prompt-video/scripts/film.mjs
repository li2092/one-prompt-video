#!/usr/bin/env node
// 自由画面的短片：画面由你写的 film.mjs 决定（draw(ctx, t, E) 画出第 t 秒），这个脚本负责排镜头、出静帧和总览图、配乐、编码、自检。
//   node film.mjs 片名/film.mjs --still 2,7.5    出几张静帧（先看图，再往下做）
//   node film.mjs 片名/film.mjs --sheet          出总览图：每个镜头的开头、中间、结尾各一格
//   node film.mjs 片名/film.mjs --strip          出每秒一格的连续总览图
//   node film.mjs 片名/film.mjs --shot 3         只出第 3 个镜头的小样（半尺寸、无声）
//   node film.mjs 片名/film.mjs                  出成片
//   node film.mjs 片名/film.mjs --frames         画得慢的片子：每帧存成 PNG，到时限就停，重跑同一条命令接着出，出完再编码
//   其他选项：--out <目录>  --no-audio  --budget <秒>（--frames 时每次最多跑多久，默认 480）
// film.mjs 的写法见技能目录的 references/film.md。
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { clamp, lerp, ease, prog, rng, hash, hexToRgb, rgba, mix, roundRect, resolveFonts, fitText, wrapText, drawLines } from './engine/core.mjs'
import { sizeOf } from './engine/timeline.mjs'
import { Music, SR, chord, sfxSignal } from './engine/synth.mjs'
import { wavBuffer } from './engine/music.mjs'
import { findFfmpeg, FFMPEG_HELP, mixAudio, prepMusic, openEncoder, probe, loudness } from './engine/encode.mjs'
import { KITS } from './kits/index.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = n => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d }
const withValue = new Set(['--out', '--still', '--shot', '--budget'])
const file = argv.find((a, i) => !a.startsWith('--') && !withValue.has(argv[i - 1]))
const die = msg => { console.error('\n[出错] ' + msg + '\n'); process.exit(1) }

if (!file || flag('--help')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
  process.exit(file ? 0 : 1)
}

// ---------- 1. 读 film.mjs ----------
let filmPath = path.resolve(file)
if (fs.existsSync(filmPath) && fs.statSync(filmPath).isDirectory()) filmPath = path.join(filmPath, 'film.mjs')
if (!fs.existsSync(filmPath)) die(`找不到文件：${filmPath}`)
const dir = path.dirname(filmPath), outDir = path.resolve(opt('--out', path.join(dir, 'out'))), tmp = path.join(outDir, 'tmp')
let mod
try { mod = await import(pathToFileURL(filmPath).href + '?v=' + fs.statSync(filmPath).mtimeMs) } catch (e) { die(`${path.basename(filmPath)} 加载失败：${e.stack || e.message}`) }
const meta = mod.meta
if (!meta || typeof meta !== 'object') die('film.mjs 要导出 meta：export const meta = { title, aspect, fps, bpm, shots: [{ id, beats }] }')
if (typeof mod.draw !== 'function') die('film.mjs 要导出 draw：export function draw(ctx, t, E) { … }，画出第 t 秒的画面')
if (typeof meta.title !== 'string' || !meta.title.trim()) die('meta.title 要写片名，也用作输出文件名')
if (!Array.isArray(meta.shots) || !meta.shots.length) die('meta.shots 要写镜头表，例：shots: [{ id: "开场", beats: 8 }, { id: "街道", beats: 12 }]')

// ---------- 2. 镜头时间线：一拍是整数帧，镜头的切点落在帧上 ----------
const fps = [24, 25, 30, 60].includes(meta.fps) ? meta.fps : 30
const bpm = Number(meta.bpm) > 0 ? Number(meta.bpm) : 90
const beat = 60 / bpm
const notes = []
if (Math.abs(beat * fps - Math.round(beat * fps)) > 1e-6) notes.push(`${bpm} 拍每分钟在 ${fps} 帧每秒下一拍不是整数帧（${(beat * fps).toFixed(2)} 帧），切点会和拍子差一点。30 帧每秒时可以用 72、90、100、120。`)
const [W, H] = Array.isArray(meta.size) && meta.size.length === 2 ? meta.size.map(n => Math.round(n / 2) * 2) : sizeOf(meta.aspect)
const shots = []
{
  let f0 = 0
  const seen = new Set()
  meta.shots.forEach((s, i) => {
    if (!s || typeof s !== 'object') die(`meta.shots 第 ${i + 1} 项要写成 { id, beats } 或 { id, seconds }`)
    const id = String(s.id ?? i + 1)
    if (seen.has(id)) die(`meta.shots 里有两个镜头的 id 都是 "${id}"，id 不能重复`)
    seen.add(id)
    const secs = Number(s.beats) > 0 ? Number(s.beats) * beat : Number(s.seconds)
    if (!(secs > 0)) die(`镜头 "${id}" 没有长度：写 beats（几拍）或 seconds（几秒）`)
    const frames = Math.max(1, Math.round(secs * fps))
    shots.push({ i, id, t0: f0 / fps, dur: frames / fps, f0, frames, beats: secs / beat })
    f0 += frames
  })
}
const frames = shots[shots.length - 1].f0 + shots[shots.length - 1].frames, total = frames / fps
for (const s of shots) if (s.dur < 0.5) notes.push(`镜头 "${s.id}" 只有 ${s.dur.toFixed(2)} 秒，观众来不及看。`)

// ---------- 3. 画图库、字体、交给 draw 的工具箱 E ----------
function loadCanvas() {
  for (const base of [process.cwd(), dir, HERE]) {
    try { return createRequire(path.join(base, 'noop.js'))('@napi-rs/canvas') } catch {}
  }
  die(`没有装画图库 @napi-rs/canvas。在你的工作目录里跑一次：\n  node "${path.join(HERE, 'setup.mjs')}"`)
}
const { createCanvas, GlobalFonts } = loadCanvas()
const fonts = resolveFonts(GlobalFonts, path.join(dir, 'fonts'), meta.font)
const roleStack = { sans: fonts.sans, serif: fonts.serif, hand: fonts.hand, mono: fonts.mono }

// 平滑的值噪声和它的多层叠加；同一组参数永远得到同一个值
const sm = x => x * x * (3 - 2 * x)
function noise(x, y = 0, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), k = seed * 7919
  const a = hash(xi + k, yi), b = hash(xi + 1 + k, yi), c = hash(xi + k, yi + 1), d = hash(xi + 1 + k, yi + 1)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}
function fbm(x, y = 0, oct = 4, seed = 0) { let v = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += a * noise(x * f, y * f, seed + i * 13); n += a; a *= 0.5; f *= 2 } return v / n }
// 关键帧表取值：track 是 [[时刻, 数值, 缓动名], …]，按时刻排好；数值可以是数或等长的数组
function key(track, t) {
  if (t <= track[0][0]) return track[0][1]
  for (let i = 1; i < track.length; i++) {
    const [t1, v1, e] = track[i]
    if (t <= t1) { const [t0, v0] = track[i - 1], p = (ease[e] || ease.inOut)(clamp((t - t0) / Math.max(1e-6, t1 - t0))); return Array.isArray(v0) ? v0.map((a, k) => lerp(a, v1[k], p)) : lerp(v0, v1, p) }
  }
  return track[track.length - 1][1]
}
const store = new Map()
const E = {
  W, H, u: Math.min(W, H) / 1080, fps, total, bpm, beat, bar: beat * 4, shots, title: meta.title, portrait: H > W,
  // 第 t 秒落在哪个镜头：lt 是镜头内的秒数，p 是镜头内的进度（0 到 1）
  shot(t) { let k = 0; while (k + 1 < shots.length && t >= shots[k + 1].t0 - 1e-9) k++; const s = shots[k]; return { ...s, lt: t - s.t0, p: clamp((t - s.t0) / s.dur), first: k === 0, last: k === shots.length - 1 } },
  // 某个镜头开始后第几拍的时刻（全片的秒数）
  at(id, beats = 0) { const s = shots.find(x => x.id === String(id)); if (!s) throw new Error(`E.at：没有 id 是 "${id}" 的镜头`); return s.t0 + beats * beat },
  clamp, lerp, ease, prog, rng, hash, noise, fbm, key, hexToRgb, rgba, mix, roundRect,
  font: (role, weight, size) => `${weight} ${Number(size).toFixed(1)}px ${roleStack[role] || roleStack.sans}`,
  fitText, wrapText, drawLines,
  // 一张离屏画布（默认和画面一样大）：画纹理、叠图层、做转场用
  layer(w = W, h = H) { return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))) },
  // 只算一次的东西（纸纹、星空、静止的背景）：第一次调用时算，以后直接取
  once(name, make) { if (!store.has(name)) store.set(name, make()); return store.get(name) },
  kit: {},
  state: null,
}
for (const [name, make] of Object.entries(KITS)) E.kit[name] = make(E)

function resetCtx(ctx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0
  ctx.filter = 'none'; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
}
const fadeIn = meta.fadeIn ?? 0.35, fadeOut = meta.fadeOut ?? 0.8
function drawFrame(ctx, t) {
  resetCtx(ctx)
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  ctx.save()
  try { mod.draw(ctx, t, E) } catch (e) { const s = E.shot(t); die(`draw 在第 ${t.toFixed(2)} 秒（镜头 "${s.id}"）出错：${e.stack || e.message}`) }
  ctx.restore()
  resetCtx(ctx)
  const dark = Math.max(fadeIn > 0 ? 1 - clamp(t / fadeIn) : 0, fadeOut > 0 ? clamp((t - (total - fadeOut - 0.1)) / fadeOut) : 0)
  if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, W, H) }
}
if (typeof mod.setup === 'function') { try { E.state = await mod.setup(E) } catch (e) { die(`setup 出错：${e.stack || e.message}`) } }

const canvas = createCanvas(W, H), ctx = canvas.getContext('2d')
const pad2 = n => String(n).padStart(2, '0')
fs.mkdirSync(outDir, { recursive: true })
console.log(`\n《${meta.title}》 ${W}×${H} ${fps} 帧/秒  ${bpm} 拍/分  ${shots.length} 个镜头  全片 ${total.toFixed(1)} 秒`)
for (const s of shots) console.log(`  ${pad2(s.i + 1)}  ${s.id.padEnd(12)} ${s.t0.toFixed(2).padStart(6)}s 起  ${s.dur.toFixed(2).padStart(5)}s  ${Number.isInteger(+s.beats.toFixed(4)) ? s.beats.toFixed(0) + ' 拍' : ''}`)
fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify({ bpm, beat, fps, total, shots: shots.map(s => ({ i: s.i + 1, id: s.id, start: +s.t0.toFixed(3), seconds: +s.dur.toFixed(3) })) }, null, 1))

// 缩小后的亮度图，用来比较两帧差多少、一帧是不是一片纯色
const probeC = createCanvas(96, Math.round(96 * H / W)), probeX = probeC.getContext('2d')
function lumaOf(t) {
  drawFrame(ctx, t); probeX.drawImage(canvas, 0, 0, probeC.width, probeC.height)
  const d = probeX.getImageData(0, 0, probeC.width, probeC.height).data, out = new Float32Array(d.length / 4)
  for (let i = 0; i < out.length; i++) out[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]
  return out
}
const diffOf = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length }
const spreadOf = a => { let m = 0; for (const v of a) m += v; m /= a.length; let s = 0; for (const v of a) s += (v - m) ** 2; return Math.sqrt(s / a.length) }

// ---------- 4. 静帧、总览图、单个镜头的小样 ----------
if (opt('--still') != null) {
  for (const raw of String(opt('--still')).split(',')) {
    const T = clamp(Number(raw) || 0, 0, total - 1 / fps)
    drawFrame(ctx, T)
    const p = path.join(outDir, `still-${T.toFixed(2)}.png`); fs.writeFileSync(p, await canvas.encode('png')); console.log('静帧：' + p)
  }
  console.log(''); process.exit(0)
}
async function contact(times, cols, outName) {
  const tw = E.portrait ? 270 : 480, th = Math.round(tw * H / W), pad = 10, lab = 30, rows = Math.ceil(times.length / cols)
  const sh = createCanvas(cols * (tw + pad) + pad, rows * (th + pad + lab) + pad), x = sh.getContext('2d')
  x.fillStyle = '#e6e3dc'; x.fillRect(0, 0, sh.width, sh.height)
  times.forEach((st, i) => {
    drawFrame(ctx, st.T)
    const px = pad + (i % cols) * (tw + pad), py = pad + Math.floor(i / cols) * (th + pad + lab)
    x.drawImage(canvas, px, py, tw, th)
    x.fillStyle = '#333'; x.font = `500 18px ${fonts.sans}`; x.textBaseline = 'top'; x.textAlign = 'left'; x.fillText(st.label, px + 2, py + th + 6)
  })
  const p = path.join(outDir, outName); fs.writeFileSync(p, await sh.encode('jpeg', 88)); return p
}
const sheetTimes = shots.flatMap(s => [0.04, 0.5, 0.97].map(q => { const T = Math.min(s.t0 + s.dur * q, s.t0 + s.dur - 1 / fps); return { T, label: `${s.i + 1} ${s.id}  ${T.toFixed(1)}s` } }))
if (flag('--strip')) {
  const times = []; for (let T = 0.5; T < total; T += 1) times.push({ T, label: `${T.toFixed(1)}s  ${E.shot(T).id}` })
  console.log('\n连续总览图：' + await contact(times, E.portrait ? 8 : 5, 'strip.jpg') + '\n'); process.exit(0)
}
const sheetPath = await contact(sheetTimes, 3, 'sheet.jpg')

// 机器能查的几件事：同一时刻画两次是否一样、镜头里有没有东西在动、有没有纯色的画面
const issues = []
for (const q of [0.21, 0.52, 0.83]) {
  const T = Math.floor(total * q * fps) / fps, a = lumaOf(T); lumaOf(Math.min(total - 1 / fps, T + 1)); const b = lumaOf(T)
  if (diffOf(a, b) > 0.02) { issues.push(`第 ${T.toFixed(2)} 秒画两次，结果不一样。画面必须只由时刻决定：检查有没有用 Math.random()、Date.now()，或者依赖上一帧留下的东西。`); break }
}
for (const s of shots) {
  const a = lumaOf(s.t0 + Math.min(0.1, s.dur * 0.1)), b = lumaOf(s.t0 + s.dur - 1 / fps), m = lumaOf(s.t0 + s.dur / 2)
  if (s.dur >= 1.5 && diffOf(a, b) < 0.6 && diffOf(a, m) < 0.6) notes.push(`镜头 "${s.id}" 从头到尾几乎没有变化。每个镜头里至少要有一样东西在动。`)
  if (spreadOf(m) < 2.5) notes.push(`镜头 "${s.id}" 中间的画面几乎是一片纯色，是不是没画出来，或者被什么盖住了？`)
}
const printNotes = () => { if (issues.length) console.log('\n[问题]\n' + issues.map(n => '  · ' + n).join('\n')); if (notes.length) console.log('\n[注意]\n' + notes.map(n => '  · ' + n).join('\n')) }
if (flag('--sheet')) { printNotes(); console.log('\n总览图：' + sheetPath + '\n'); process.exit(issues.length ? 2 : 0) }

const ffCache = path.join(process.cwd(), '.osv', 'ffmpeg-path.txt')
const ffr = findFfmpeg(ffCache); if (!ffr.exe) die(FFMPEG_HELP)
const ff = ffr.exe
fs.mkdirSync(tmp, { recursive: true })

if (opt('--shot') != null) {
  const want = String(opt('--shot')), s = shots.find(x => x.id === want) || shots[Number(want) - 1]
  if (!s) die(`没有这个镜头：${want}。可以写镜头的 id，或者第几个（从 1 起）。`)
  const w2 = Math.round(W / 4) * 2, h2 = Math.round(H / 4) * 2, small = createCanvas(w2, h2), sx = small.getContext('2d')
  const p = path.join(outDir, `shot-${pad2(s.i + 1)}.mp4`), enc = openEncoder(ff, { W: w2, H: h2, fps, audio: null, out: p, seconds: s.dur })
  for (let f = 0; f < s.frames; f++) { drawFrame(ctx, (s.f0 + f) / fps); sx.drawImage(canvas, 0, 0, w2, h2); await enc.write(small.data()) }
  await enc.done(); fs.rmSync(tmp, { recursive: true, force: true })
  console.log(`\n镜头小样：${p}\n`); process.exit(0)
}

// ---------- 5. 声音：film.mjs 里的 score() 用合成器写配乐，sounds 是音效表；也可以用自己的音频文件 ----------
let audio = null, soundNote = '无'
if (!flag('--no-audio')) {
  const t0 = Date.now()
  const own = typeof meta.music === 'string' ? path.resolve(dir, meta.music) : null
  if (own && !fs.existsSync(own)) die(`meta.music 写的配乐文件找不到：${own}`)
  const sounds = typeof mod.sounds === 'function' ? mod.sounds(E) : mod.sounds
  if (typeof mod.score === 'function' || own || (Array.isArray(sounds) && sounds.length)) {
    const M = new Music(total, { bpm })
    if (typeof mod.score === 'function' && !own) { try { mod.score(M, { ...E, chord, sfxSignal, SR }) } catch (e) { die(`score 出错：${e.stack || e.message}`) } }
    for (const s of Array.isArray(sounds) ? sounds : []) {
      const sig = sfxSignal(s.kind, s.seed ?? 1); if (!sig) die(`sounds 里的 kind "${s.kind}" 不认识。可用的：tick、click、type、pop、thud、chime、whoosh、swell、glitch`)
      const n = Math.min(sig.length, Math.round(0.002 * SR)); for (let i = 0; i < n; i++) sig[i] *= i / n
      M.place(sig, Math.max(0, Number(s.at) || 0), { gain: s.gain ?? 0.3, pan: s.pan ?? 0, verb: s.verb ?? 0.2 })
    }
    let [L, Rr] = M.render({ verb: { room: 0.8, damp: 0.4, wet: 1 } })
    const n = Math.round(total * SR); L = L.subarray(0, n); Rr = Rr.subarray(0, n)
    const f0 = Math.round((total - 1.1) * SR); let peak = 1e-9
    for (let i = 0; i < n; i++) { if (i > f0) { const g = Math.max(0, 1 - (i - f0) / (n - f0)); L[i] *= g * g; Rr[i] *= g * g } peak = Math.max(peak, Math.abs(L[i]), Math.abs(Rr[i])) }
    const g = own ? Math.min(1, 0.7 / peak) : 0.7 / peak
    for (let i = 0; i < n; i++) { L[i] *= g; Rr[i] *= g }
    const musicPath = path.join(tmp, 'music.wav'); fs.writeFileSync(own ? path.join(tmp, 'sfx.wav') : musicPath, wavBuffer(L, Rr))
    if (own) { try { prepMusic(ff, { file: own, sfx: path.join(tmp, 'sfx.wav'), out: musicPath, total }) } catch (e) { die(e.message) } }
    const voices = (Array.isArray(meta.voice) ? meta.voice : []).map(v => ({ file: path.resolve(dir, v.file), at: Number(v.at) || 0 }))
    for (const v of voices) if (!fs.existsSync(v.file)) die(`meta.voice 里的人声文件找不到：${v.file}`)
    audio = path.join(tmp, 'master.wav')
    mixAudio(ff, { music: musicPath, voices, out: audio, tmp })
    soundNote = (own ? `自己的配乐文件（${path.basename(own)}）` : '用合成器写的配乐') + (Array.isArray(sounds) && sounds.length ? `，${sounds.length} 个音效` : '') + (voices.length ? `，${voices.length} 段人声` : '，没有人声')
    console.log(`\n配乐和混音完成（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`)
  } else notes.push('这支片子没有声音：film.mjs 里没有 score()、sounds，也没有 meta.music。要告诉用户。')
}

// ---------- 6. 逐帧编码 ----------
const safeName = meta.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'film'
const outFile = path.join(outDir, `${safeName}.mp4`)
const t1 = Date.now()
let lastSig = null, run = 0, longest = 0, longestAt = 0
// 连续多少帧完全一样（隔着取一些字节比较）
function watch(data, f) {
  let sig = 0; for (let i = 0; i < data.length; i += 9973) sig = (Math.imul(sig, 31) + data[i]) | 0
  if (sig === lastSig) { run++; if (run > longest) { longest = run; longestAt = f } } else run = 0
  lastSig = sig
}
let enc
if (flag('--frames')) {
  // 分段续跑：帧存在 out/frames-<代码的指纹>/，代码一改指纹就变，旧的帧不会被误用
  const srcs = fs.readdirSync(dir).filter(n => /\.(mjs|js|json)$/.test(n)).sort().map(n => { const st = fs.statSync(path.join(dir, n)); return `${n}:${st.size}:${Math.round(st.mtimeMs)}` }).join('|')
  let h = 0; for (const ch of srcs) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  const fdir = path.join(outDir, 'frames-' + (h >>> 0).toString(16)), budget = Number(opt('--budget', 480)) * 1000
  fs.mkdirSync(fdir, { recursive: true })
  const fpath = f => path.join(fdir, `f${String(f).padStart(5, '0')}.png`)
  let done = 0
  for (let f = 0; f < frames; f++) {
    if (fs.existsSync(fpath(f))) { done++; continue }
    if (Date.now() - t1 > budget) break
    drawFrame(ctx, f / fps)
    fs.writeFileSync(fpath(f) + '.part', await canvas.encode('png')); fs.renameSync(fpath(f) + '.part', fpath(f)); done++
    if (done % 30 === 0) process.stdout.write(`\r出帧 ${done}/${frames}  `)
  }
  if (done < frames) {
    fs.rmSync(tmp, { recursive: true, force: true })
    console.log(`\n已出 ${done}/${frames} 帧（${((Date.now() - t1) / 1000).toFixed(0)} 秒）。重跑同一条命令接着出；全部出完会自动编码。\n`)
    process.exit(3)
  }
  enc = openEncoder(ff, { W, H, fps, audio, out: outFile, seconds: total, png: true })
  for (let f = 0; f < frames; f++) { const buf = fs.readFileSync(fpath(f)); watch(buf, f); await enc.write(buf) }
  await enc.done()
  process.stdout.write(`\r出帧 100%（${frames} 帧，帧存在 ${fdir}）\n`)
} else {
  enc = openEncoder(ff, { W, H, fps, audio, out: outFile, seconds: total })
  for (let f = 0; f < frames; f++) {
    drawFrame(ctx, f / fps)
    const data = canvas.data()
    watch(data, f)
    await enc.write(data)
    if (f % Math.ceil(frames / 20) === 0) process.stdout.write(`\r出帧 ${Math.round(f / frames * 100)}%  `)
  }
  await enc.done()
  process.stdout.write(`\r出帧 100%（${frames} 帧，${((Date.now() - t1) / 1000).toFixed(1)} 秒）\n`)
}
if (enc.encoder.weak) notes.push('这份 ffmpeg 里没有 H.264 编码器，成片用 MPEG-4 编的，个别播放器可能打不开。')
if (longest / fps >= 1.5) notes.push(`第 ${((longestAt - longest) / fps).toFixed(1)} 到 ${(longestAt / fps).toFixed(1)} 秒画面完全静止了 ${(longest / fps).toFixed(1)} 秒。`)

// ---------- 7. 自检 ----------
const pr = probe(ff, outFile), checks = []
const ok = (cond, good, bad) => checks.push((cond ? '[通过] ' : '[问题] ') + (cond ? good : bad))
ok(pr.video && pr.video.w === W && pr.video.h === H, `分辨率 ${W}×${H}`, `分辨率不对：${pr.video ? pr.video.w + '×' + pr.video.h : '读不到视频流'}`)
ok(pr.seconds != null && Math.abs(pr.seconds - total) < 0.15, `时长 ${pr.seconds?.toFixed(2)} 秒`, `时长 ${pr.seconds} 秒，和镜头表的 ${total.toFixed(2)} 秒对不上`)
if (audio) {
  ok(pr.audio && /stereo/.test(pr.audio.layout), '有双声道音轨', '成片里没有双声道音轨')
  const fin = loudness(ff, outFile)
  if (fin) { ok(fin.I > -16 && fin.I < -12.5, `响度 ${fin.I.toFixed(1)} LUFS`, `响度 ${fin.I.toFixed(1)} LUFS，偏离 -14`); ok(fin.TP <= -0.9, `真峰值 ${fin.TP.toFixed(1)} dBTP`, `真峰值 ${fin.TP.toFixed(1)} dBTP，超过 -1`) }
}
ok(issues.length === 0, '同一时刻画两次，结果一样', issues[0])
const bad = checks.filter(c => c.startsWith('[问题]')).length
const report = [
  `成片：${outFile}`,
  `总览图：${sheetPath}`,
  `规格：${W}×${H}，${fps} 帧/秒，${total.toFixed(1)} 秒，${pr.video?.codec || '?'}${audio ? ' + AAC 双声道' : '，无声'}`,
  `声音：${soundNote}`,
  '', '镜头：', ...shots.map(s => `  ${pad2(s.i + 1)} ${s.id.padEnd(12)} ${s.t0.toFixed(2)}s 起，${s.dur.toFixed(2)}s`),
  '', '自检：', ...checks.map(c => '  ' + c),
  ...(notes.length ? ['', '注意：', ...notes.map(n => '  · ' + n)] : []),
  '', '机器查不了的：画面好不好看、动作顺不顺、故事看不看得懂、配乐好不好听。总览图逐格看一遍，成片要人看、要人听。',
].join('\n')
fs.writeFileSync(path.join(outDir, 'report.txt'), report + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
console.log('\n' + report + '\n')
process.exit(bad ? 2 : 0)
