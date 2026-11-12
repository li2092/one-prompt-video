// 生成宣传片里那面墙用的缩略图：九种版式 ×（六种内置主题 + 一套自己配的颜色），写到 stills/。
// 在一个装了 @napi-rs/canvas 的目录里跑：node <这个文件> [九种版式的 video.json] [输出目录]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url)), eng = path.join(here, '../../../one-prompt-video/scripts/engine/')
const { createCanvas, GlobalFonts } = createRequire(path.join(process.cwd(), 'x.js'))('@napi-rs/canvas')
const { resolveFonts } = await import(eng + 'core.mjs'), { getTheme } = await import(eng + 'themes.mjs')
const { buildTimeline } = await import(eng + 'timeline.mjs'), { makeRenderer } = await import(eng + 'render.mjs')
const v = JSON.parse(fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'wall.video.json'), 'utf8'))
const fonts = resolveFonts(GlobalFonts), W = 1920, H = 1080, out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(here, 'stills')
fs.mkdirSync(out, { recursive: true })
const big = createCanvas(W, H), bx = big.getContext('2d'), small = createCanvas(768, 432), sx = small.getContext('2d')
// 自己配色的那一套：grid 主题，八个颜色全换掉（video.json 里写在 "colors" 下面）
const OWN = { bg: '#0f2a22', fg: '#f3efe2', muted: '#8fb3a3', accent: '#f2b84b', accent2: '#ff7a59', card: '#17382e', line: '#2c5a4a', onAccent: '#0f2a22' }
for (const id of ['keynote', 'grid', 'minimal', 'pop', 'blueprint', 'whiteboard', 'custom']) {
  const theme = id === 'custom' ? getTheme('grid', OWN) : getTheme(id), TL = buildTimeline(v, theme), R = makeRenderer({ v, theme, TL, fonts, W, H, createCanvas })
  for (const S of TL.scenes) {
    R.drawFrame(bx, S.t0 + S.dur * 0.9)
    sx.drawImage(big, 0, 0, 768, 432)
    fs.writeFileSync(path.join(out, `${id}-${S.i + 1}.jpg`), await small.encode('jpeg', 88))
  }
}
console.log('写好 63 张缩略图：', out)
