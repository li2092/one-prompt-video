#!/usr/bin/env node
// 看一条素材里有什么，好决定取哪一段：打印规格和静音的位置，出一张带时间的胶片图。
//   node footage.mjs 素材/采访.mp4                整条，约 40 格
//   node footage.mjs 素材/采访.mp4 --from 30 --to 60   只看 30 到 60 秒，格子更密
//   其他选项：--out <目录>（默认素材旁边的 footage/）
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { findFfmpeg, FFMPEG_HELP, probe, run } from './engine/encode.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d }
const file = argv.find((a, i) => !a.startsWith('--') && !['--from', '--to', '--out'].includes(argv[i - 1]))
const die = m => { console.error('\n[出错] ' + m + '\n'); process.exit(1) }
if (!file || !fs.existsSync(file)) die(file ? `找不到文件：${file}` : '用法：node footage.mjs <素材文件> [--from 秒] [--to 秒]')
const ff = findFfmpeg(path.join(process.cwd(), '.osv', 'ffmpeg-path.txt')).exe || die(FFMPEG_HELP)
const src = path.resolve(file), pr = probe(ff, src)
if (!pr.video || !pr.seconds) die(`读不出画面：${src}`)
const from = Math.max(0, +opt('--from', 0)), to = Math.min(pr.seconds, +opt('--to', pr.seconds)), span = to - from
if (!(span > 0.5)) die(`素材全长 ${pr.seconds.toFixed(1)} 秒，--from 和 --to 之间取不出半秒以上的一段。`)
const outDir = path.resolve(opt('--out', path.join(path.dirname(src), 'footage'))), name = path.basename(src).replace(/\.[^.]+$/, '')
const tmp = path.join(outDir, `tmp-${name}`); fs.mkdirSync(tmp, { recursive: true })

console.log(`\n${src}\n规格：${pr.video.w}×${pr.video.h}，${pr.video.fps} 帧/秒，${pr.seconds.toFixed(2)} 秒，${pr.audio ? '有声音' : '没有声音'}`)
// 静音的位置：说话的素材，剪口放在静音里才不会切掉半个词
if (pr.audio) {
  const e = run(ff, ['-ss', String(from), '-t', String(span), '-i', src, '-vn', '-af', 'silencedetect=noise=-35dB:d=0.35', '-f', 'null', '-']).err
  const st = [...e.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1] + from), en = [...e.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1] + from)
  console.log(st.length ? '静音（秒）：' + st.map((s, i) => `${s.toFixed(2)}–${(en[i] ?? to).toFixed(2)}`).join('  ') : '这一段里没有超过 0.35 秒的静音。')
}
// 胶片图：等间隔取帧，每格左上角写它在素材里的秒数
const n = Math.min(40, Math.max(8, Math.round(span / 0.5))), step = span / n, tw = 320, th = Math.round(tw * pr.video.h / pr.video.w / 2) * 2
const r = run(ff, ['-y', '-ss', String(from), '-t', String(span), '-i', src, '-an', '-vf', `fps=${(1 / step).toFixed(6)},scale=${tw}:${th}`, '-q:v', '3', '-start_number', '0', path.join(tmp, 'c%03d.jpg')])
if (r.code !== 0) die('抽帧失败：\n' + r.err.split('\n').slice(-6).join('\n'))
let canvasLib
for (const base of [process.cwd(), path.dirname(src), HERE]) { try { canvasLib = createRequire(path.join(base, 'noop.js'))('@napi-rs/canvas'); break } catch {} }
if (!canvasLib) die(`没有装画图库。先在工作目录跑一次：node "${path.join(HERE, 'setup.mjs')}"`)
const files = fs.readdirSync(tmp).filter(f => f.endsWith('.jpg')).sort(), cols = th > tw ? 8 : 5, rows = Math.ceil(files.length / cols), pad = 6
const S = canvasLib.createCanvas(pad + cols * (tw + pad), pad + rows * (th + pad)), x = S.getContext('2d')
x.fillStyle = '#1c1c20'; x.fillRect(0, 0, S.width, S.height)
for (const [i, f] of files.entries()) {
  const px = pad + (i % cols) * (tw + pad), py = pad + Math.floor(i / cols) * (th + pad), label = (from + (i + 0.5) * step).toFixed(1) + 's'
  x.drawImage(await canvasLib.loadImage(path.join(tmp, f)), px, py, tw, th)
  x.font = '600 22px sans-serif'; x.textBaseline = 'top'; const w = x.measureText(label).width
  x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(px, py, w + 12, 30); x.fillStyle = '#fff'; x.fillText(label, px + 6, py + 4)
}
const out = path.join(outDir, `${name}-${from.toFixed(0)}-${to.toFixed(0)}.jpg`)
fs.writeFileSync(out, await S.encode('jpeg', 85)); fs.rmSync(tmp, { recursive: true, force: true })
console.log(`胶片图（每格约隔 ${step.toFixed(1)} 秒）：${out}\n`)
