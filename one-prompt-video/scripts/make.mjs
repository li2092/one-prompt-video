#!/usr/bin/env node
// 一条命令出片：校验 video.json → 排时间线 → 总览图 → 配乐和混音 → 逐帧编码 → 自检报告。
//   node make.mjs video.json              出成片（默认输出到 video.json 旁边的 out/）
//   node make.mjs video.json --check      只校验，不出片（最快，改完先跑这个）
//   node make.mjs video.json --sheet      只出总览图 out/sheet.jpg
//   node make.mjs video.json --still 3.5  只出第 3.5 秒的一张静帧
//   其他选项：--out <目录>  --no-audio  --theme <主题>（临时换主题，不改文件）
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveFonts, hasCJK } from './engine/core.mjs'
import { getTheme, THEMES, THEME_IDS } from './engine/themes.mjs'
import { validate, buildTimeline, sizeOf } from './engine/timeline.mjs'
import { makeRenderer } from './engine/render.mjs'
import { renderMusic, wavBuffer } from './engine/music.mjs'
import { findFfmpeg, FFMPEG_HELP, mixAudio, prepMusic, openEncoder, probe, loudness, durationOf, run } from './engine/encode.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const flag = n => argv.includes(n)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d }
const withValue = new Set(['--out', '--still', '--theme'])
const file = argv.find((a, i) => !a.startsWith('--') && !withValue.has(argv[i - 1]))
const die = (msg) => { console.error('\n[出错] ' + msg + '\n'); process.exit(1) }

if (!file || flag('--help')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).map(l => l.replace(/^\/\/ ?/, '')).join('\n'))
  console.log(`\n主题：${THEME_IDS.map(id => `${id}（${THEMES[id].name}）`).join('、')}`)
  process.exit(file ? 0 : 1)
}

// ---------- 1. 读文件、校验 ----------
const jsonPath = path.resolve(file)
if (!fs.existsSync(jsonPath)) die(`找不到文件：${jsonPath}`)
// 宽容两种常见的小毛病：外面包了 ```json 代码围栏；数组或对象最后多了一个逗号
function tidy(src) {
  const t = src.replace(/^﻿/, '').trim().replace(/^```[a-zA-Z]*\s*\n/, '').replace(/\n```\s*$/, '')
  let out = '', inStr = false, esc = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (inStr) { out += ch; if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue }
    if (ch === '"') { inStr = true; out += ch; continue }
    if (ch === ',' && /^\s*[\]}]/.test(t.slice(i + 1, i + 200))) continue
    out += ch
  }
  return out
}
let v
try { v = JSON.parse(tidy(fs.readFileSync(jsonPath, 'utf8'))) } catch (e) {
  const m = /position (\d+)/.exec(e.message), src = tidy(fs.readFileSync(jsonPath, 'utf8'))
  let where = ''
  if (m) { const before = src.slice(0, +m[1]), line = before.split('\n').length; where = `（第 ${line} 行附近：${src.split('\n')[line - 1].trim().slice(0, 60)}）` }
  die(`${path.basename(jsonPath)} 不是合法的 JSON${where}：${e.message}\n常见原因：两项之间少了逗号、用了中文引号 “ ” 而不是英文引号 "、文字里的英文引号没有写成 \\"、括号没有配对。`)
}
if (opt('--theme')) v.theme = opt('--theme')
const { errors, warnings } = validate(v)
if (errors.length) {
  console.error(`\n[出错] video.json 有 ${errors.length} 处要改：\n` + errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n') + '\n\n改完重跑同一条命令。字段说明见技能目录的 references/video-json.md。\n')
  process.exit(1)
}
const theme = getTheme(v.theme || 'grid', v.colors)
const dir = path.dirname(jsonPath), outDir = path.resolve(opt('--out', path.join(dir, 'out'))), tmp = path.join(outDir, 'tmp')
const fps = v.fps === 24 || v.fps === 25 || v.fps === 60 ? v.fps : 30
const [W, H] = sizeOf(v.aspect)

// ---------- 2. 画图库和字体 ----------
function loadCanvas() {
  for (const base of [process.cwd(), dir, HERE]) {
    try { return createRequire(path.join(base, 'noop.js'))('@napi-rs/canvas') } catch {}
  }
  die(`没有装画图库 @napi-rs/canvas。在你的工作目录里跑一次：\n  node "${path.join(HERE, 'setup.mjs')}"`)
}
const { createCanvas, GlobalFonts } = loadCanvas()
const fonts = resolveFonts(GlobalFonts, path.join(dir, 'fonts'), v.font)
const allText = JSON.stringify(v.scenes)
if (fonts.missing && hasCJK(allText)) die(`${fonts.missing}\n装一个中文字体再重跑，任选其一：\n  · 把任意中文字体文件（.ttf / .otf）放进 ${path.join(dir, 'fonts')} 目录\n  · Linux：sudo apt install fonts-noto-cjk\n  · 下载思源黑体 / Noto Sans SC（开源，SIL OFL 许可）后放进上面的 fonts 目录`)

// ---------- 3. 配音（可选）和时间线 ----------
const ffCache = path.join(process.cwd(), '.osv', 'ffmpeg-path.txt')
let ff = null
const needFf = () => { if (!ff) { const r = findFfmpeg(ffCache); if (!r.exe) die(FFMPEG_HELP); ff = r.exe } return ff }
const VOICE_EXT = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'aiff']
const pad2 = n => String(n).padStart(2, '0')
const voiceFile = i => VOICE_EXT.map(e => path.join(dir, 'voice', `${pad2(i + 1)}.${e}`)).find(f => fs.existsSync(f))
if (v.tts && Array.isArray(v.tts.command) && !flag('--check')) {
  // 用户自己配的配音命令：{text} 换成这一场的 say，{out} 换成输出文件。逐场跑，已有且文字没变的跳过。
  const { spawnSync } = await import('node:child_process')
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true })
  v.scenes.forEach((s, i) => {
    if (!s.say) return
    const out = path.join(dir, 'voice', `${pad2(i + 1)}.${v.tts.ext || 'wav'}`), memo = out + '.txt'
    if (fs.existsSync(out) && fs.existsSync(memo) && fs.readFileSync(memo, 'utf8') === s.say) return
    const [cmd, ...args] = v.tts.command.map(a => String(a).replaceAll('{text}', s.say).replaceAll('{out}', out))
    const r = spawnSync(cmd, args, { stdio: 'inherit', windowsHide: true })
    if (r.error || r.status !== 0 || !fs.existsSync(out)) die(`配音命令在第 ${i + 1} 场失败了：${cmd} ${args.join(' ')}\n检查 "tts" 里的命令，或者删掉 "tts" 先出不带人声的版本。`)
    fs.writeFileSync(memo, s.say)
  })
}
const voices = v.scenes.map((_, i) => voiceFile(i))
const voiceDur = voices.map(f => (f ? durationOf(needFf(), f) : undefined))
const TL = buildTimeline(v, theme, { fps, voice: voiceDur })

// 自己写画面代码的场（layout: custom）
const custom = {}
for (const S of TL.scenes) if (S.layout === 'custom') {
  const p = path.resolve(dir, S.scene.module)
  if (!fs.existsSync(p)) die(`第 ${S.i + 1} 场的画面代码找不到：${p}`)
  const mod = await import(pathToFileURL(p).href)
  if (typeof mod.default !== 'function') die(`${p} 要默认导出一个函数：export default function (ctx, s, E) { … }。写法见 references/custom-scenes.md`)
  custom[S.i] = mod.default
}
const R = makeRenderer({ v, theme, TL, fonts, W, H, createCanvas, custom })

console.log(`\n《${v.title}》 ${W}×${H} ${fps} 帧/秒  主题 ${theme.id}（${theme.name}）  ${TL.bpm} 拍/分  全片 ${TL.total.toFixed(1)} 秒`)
console.log('  场  版式        起始    时长   ' + (voices.some(Boolean) ? '配音' : ''))
for (const S of TL.scenes) console.log(`  ${pad2(S.i + 1)}  ${S.layout.padEnd(10)} ${S.t0.toFixed(2).padStart(6)}s ${S.dur.toFixed(2).padStart(5)}s  ${voices[S.i] ? path.basename(voices[S.i]) : ''}`)

// ---------- 4. 总览图（顺带收集「字放不下」这类问题） ----------
fs.mkdirSync(tmp, { recursive: true })
const sheetPath = path.join(outDir, 'sheet.jpg')
const sheet = await R.sheet()
const notes = [...warnings, ...R.warnings]
for (const S of TL.scenes) if (S.dur < 2.5) notes.push(`第 ${S.i + 1} 场只有 ${S.dur.toFixed(1)} 秒，观众可能来不及看。`)
if (TL.total > 120) notes.push(`全片 ${TL.total.toFixed(0)} 秒，偏长；这条生产线适合 20 到 90 秒的片子。`)
const printNotes = () => { if (notes.length) console.log('\n[注意]\n' + notes.map(n => '  · ' + n).join('\n')) }

if (flag('--check')) { printNotes(); console.log(`\n校验通过${notes.length ? `，有 ${notes.length} 条注意` : ''}。出片：去掉 --check 重跑。\n`); process.exit(0) }
fs.writeFileSync(sheetPath, await sheet.encode('jpeg', 88))
// 时间线另存一份，给自己写配乐的人用：每一场从第几秒开始、多长，一拍多少秒
fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify({ bpm: TL.bpm, beat: TL.beat, total: TL.total, scenes: TL.scenes.map(S => ({ i: S.i + 1, layout: S.layout, start: +S.t0.toFixed(3), seconds: +S.dur.toFixed(3), cues: S.cues })) }, null, 1))
if (opt('--still') != null) {
  const T = Math.min(Math.max(0, Number(opt('--still')) || 0), TL.total - 1e-3), c = createCanvas(W, H)
  R.drawFrame(c.getContext('2d'), T)
  const p = path.join(outDir, `still-${T.toFixed(2)}.png`); fs.writeFileSync(p, await c.encode('png')); console.log('\n静帧：' + p + '\n'); process.exit(0)
}
if (flag('--sheet')) { printNotes(); console.log('\n总览图：' + sheetPath + '\n'); process.exit(0) }

// ---------- 5. 声音 ----------
needFf()
let audio = null, loud = null
if (!flag('--no-audio') && v.music !== false) {
  const t0 = Date.now()
  const own = typeof v.music === 'string' ? path.resolve(dir, v.music) : null
  if (own && !fs.existsSync(own)) die(`"music" 写的配乐文件找不到：${own}\n把文件放到 video.json 旁边，或者删掉 "music" 用自带的配乐。`)
  const [L, Rr] = renderMusic(TL, theme, { bed: !own })
  const musicPath = path.join(tmp, 'music.wav'); fs.writeFileSync(own ? path.join(tmp, 'sfx.wav') : musicPath, wavBuffer(L, Rr))
  if (own) { try { prepMusic(ff, { file: own, sfx: path.join(tmp, 'sfx.wav'), out: musicPath, total: TL.total }) } catch (e) { die(e.message) } }
  audio = path.join(tmp, 'master.wav')
  loud = mixAudio(ff, { music: musicPath, voices: voices.map((f, i) => f && { file: f, at: TL.scenes[i].t0 + 0.3 }).filter(Boolean), out: audio, tmp })
  console.log(`\n配乐和混音完成（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`)
}

// ---------- 6. 逐帧编码 ----------
const safeName = v.title.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 60) || 'video'
const outFile = path.join(outDir, `${safeName}.mp4`)
const enc = openEncoder(ff, { W, H, fps, audio, out: outFile, seconds: TL.total })
if (enc.encoder.weak) notes.push('这份 ffmpeg 里没有 H.264 编码器，成片用 MPEG-4 编的，个别播放器可能打不开。换一份带 libx264 的 ffmpeg 更好。')
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d')
const t1 = Date.now()
for (let f = 0; f < TL.frames; f++) {
  R.drawFrame(ctx, f / fps)
  await enc.write(canvas.data())
  if (f % Math.ceil(TL.frames / 10) === 0) process.stdout.write(`\r出帧 ${Math.round(f / TL.frames * 100)}%  `)
}
await enc.done()
process.stdout.write(`\r出帧 100%（${TL.frames} 帧，${((Date.now() - t1) / 1000).toFixed(1)} 秒）\n`)

// ---------- 7. 自检 ----------
const pr = probe(ff, outFile), checks = []
const ok = (cond, good, bad) => checks.push((cond ? '[通过] ' : '[问题] ') + (cond ? good : bad))
ok(pr.video && pr.video.w === W && pr.video.h === H, `分辨率 ${W}×${H}`, `分辨率不对：${pr.video ? pr.video.w + '×' + pr.video.h : '读不到视频流'}`)
ok(pr.seconds != null && Math.abs(pr.seconds - TL.total) < 0.15, `时长 ${pr.seconds?.toFixed(2)} 秒`, `时长 ${pr.seconds} 秒，和时间线的 ${TL.total.toFixed(2)} 秒对不上`)
if (audio) {
  ok(pr.audio && /stereo/.test(pr.audio.layout), '有双声道音轨', '成片里没有双声道音轨')
  const fin = loudness(ff, outFile)
  if (fin) { ok(fin.I > -16 && fin.I < -12.5, `响度 ${fin.I.toFixed(1)} LUFS`, `响度 ${fin.I.toFixed(1)} LUFS，偏离 -14`); ok(fin.TP <= -0.9, `真峰值 ${fin.TP.toFixed(1)} dBTP`, `真峰值 ${fin.TP.toFixed(1)} dBTP，超过 -1`) }
}
ok(R.warnings.size === 0, '画面上的字都放得下', `有 ${R.warnings.size} 处字太多（见下面的注意）`)
const bad = checks.filter(c => c.startsWith('[问题]')).length
const report = [
  `成片：${outFile}`,
  `总览图：${sheetPath}`,
  `规格：${W}×${H}，${fps} 帧/秒，${TL.total.toFixed(1)} 秒，${pr.video?.codec || '?'}${audio ? ' + AAC 双声道' : '，无声'}`,
  `主题：${theme.id}（${theme.name}）；字体：${Object.entries(fonts.found).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join('，')}`,
  `声音：${audio ? (typeof v.music === 'string' ? '自己的配乐文件（' + path.basename(v.music) + '）加程序合成的音效' : '程序合成的配乐和音效') + (voices.some(Boolean) ? `，加 ${voices.filter(Boolean).length} 段人声` : '，没有人声') : '无'}`,
  '', '时间线：', ...TL.scenes.map(S => `  ${pad2(S.i + 1)} ${S.layout.padEnd(10)} ${S.t0.toFixed(2)}s 起，${S.dur.toFixed(2)}s`),
  '', '自检：', ...checks.map(c => '  ' + c),
  ...(notes.length ? ['', '注意：', ...notes.map(n => '  · ' + n)] : []),
  '', '机器查不了的：画面好不好看、节奏合不合适、配乐好不好听。打开总览图逐格看一遍，成片要人看、要人听。',
].join('\n')
fs.writeFileSync(path.join(outDir, 'report.txt'), report + '\n')
fs.rmSync(tmp, { recursive: true, force: true })
console.log('\n' + report + '\n')
process.exit(bad ? 2 : 0)
