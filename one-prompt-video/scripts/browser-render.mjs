#!/usr/bin/env node
// 参考生产线共用的出片脚本：把一个网页逐帧截图，编码成 MP4。
// 网页要暴露三样东西：window.renderAt(t) 画出第 t 秒的画面；window.DUR 全片秒数；准备好以后 window.ready = true（出错时 window.fatal = '原因'）。
//   node browser-render.mjs <网页目录> [--page index.html] [--out out/film.mp4] [--audio 音轨.wav] [--size 1920x1080] [--fps 30]
//   node browser-render.mjs <网页目录> --stills 0,2.5,6      只出几张静帧到 out/stills/
// 需要 Playwright（Apache-2.0）：在工作目录运行  npm install playwright  和  npx playwright install chromium
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { findFfmpeg, FFMPEG_HELP, openEncoder } from './engine/encode.mjs'

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d }
const dir = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : null
const die = m => { console.error('\n[出错] ' + m + '\n'); process.exit(1) }
if (!dir || !fs.existsSync(dir)) die('用法：node browser-render.mjs <网页目录> [--out out/film.mp4]')
let chromium
try { ({ chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright')) } catch { die('没有装 Playwright。在工作目录运行：\n  npm install playwright\n  npx playwright install chromium') }

const [W, H] = opt('--size', '1920x1080').split('x').map(Number), fps = Number(opt('--fps', 30))
const out = path.resolve(opt('--out', path.join(dir, 'out', 'film.mp4')))
fs.mkdirSync(path.dirname(out), { recursive: true })

// 本地小服务器：网页目录当根；/node_modules/ 指到工作目录的 node_modules（给 three 这类库用）
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glsl': 'text/plain', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf' }
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const root = url.startsWith('/node_modules/') ? process.cwd() : dir
  const file = path.join(root, path.normalize(url))
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' })
  fs.createReadStream(file).pipe(res)
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

let browser
try {
  const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--enable-gpu', '--ignore-gpu-blocklist']
  browser = await chromium.launch({ args })
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const errs = []
  page.on('pageerror', e => errs.push('页面报错：' + e.message))
  page.on('console', m => { if (m.type() === 'error') errs.push('控制台报错：' + m.text().slice(0, 600)) })
  // 画面要能离线重算：页面请求了本机以外的地址就报错
  page.on('request', r => { if (!r.url().startsWith(`http://127.0.0.1:${port}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errs.push('页面请求了外部地址：' + r.url()) })
  await page.goto(`http://127.0.0.1:${port}/${opt('--page', 'index.html')}`)
  await page.waitForFunction('window.ready === true || window.fatal', null, { timeout: 180000 })
  const fatal = await page.evaluate('window.fatal')
  if (fatal) throw new Error('页面启动失败：' + fatal)
  if (errs.length) throw new Error(errs.join('\n'))
  const DUR = Number(await page.evaluate('window.DUR'))
  if (!(DUR > 0)) throw new Error('页面没有给出 window.DUR（全片秒数）')

  if (opt('--stills')) {
    const sd = path.join(path.dirname(out), 'stills'); fs.mkdirSync(sd, { recursive: true })
    for (const t of opt('--stills').split(',').map(Number)) { await page.evaluate(x => window.renderAt(x), t); const f = path.join(sd, `t${t.toFixed(2)}.png`); await page.screenshot({ path: f }); console.log(f) }
  } else {
    const ff = findFfmpeg(path.join(process.cwd(), '.osv', 'ffmpeg-path.txt')); if (!ff.exe) throw new Error(FFMPEG_HELP)
    const audio = opt('--audio') ? path.resolve(opt('--audio')) : null, n = Math.round(DUR * fps), t0 = Date.now()
    const enc = openEncoder(ff.exe, { W, H, fps, audio, out, seconds: DUR, png: true })
    for (let f = 0; f < n; f++) {
      await page.evaluate(x => window.renderAt(x), f / fps)
      await enc.write(await page.screenshot({ type: 'png' }))
      if (errs.length) throw new Error(`第 ${f} 帧出错：\n` + errs.join('\n'))
      if (f % Math.ceil(n / 10) === 0) process.stdout.write(`\r出帧 ${Math.round(f / n * 100)}%  `)
    }
    await enc.done()
    console.log(`\r出帧 100%（${n} 帧，每帧 ${((Date.now() - t0) / n).toFixed(0)} 毫秒）\n成片：${out}`)
  }
} catch (e) { console.error('\n[出错] ' + e.message + '\n'); process.exitCode = 1 } finally { if (browser) await browser.close(); server.close() }
