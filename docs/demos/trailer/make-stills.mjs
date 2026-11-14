// 生成宣传片里那面墙用的缩略图：九种版式 × 十二套风格（六种内置主题 + 六套自己配色的），写到 stills/。
// 在一个装了 @napi-rs/canvas 的目录里跑：node <这个文件> [九种版式的 video.json] [输出目录]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const here = path.dirname(fileURLToPath(import.meta.url)), eng = path.join(here, '../../../scripts/engine/')
const { createCanvas, GlobalFonts } = createRequire(path.join(process.cwd(), 'x.js'))('@napi-rs/canvas')
const { resolveFonts } = await import(eng + 'core.mjs'), { getTheme } = await import(eng + 'themes.mjs')
const { buildTimeline } = await import(eng + 'timeline.mjs'), { makeRenderer } = await import(eng + 'render.mjs')
const v = JSON.parse(fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'wall.video.json'), 'utf8'))
const fonts = resolveFonts(GlobalFonts), W = 1920, H = 1080, out = process.argv[3] ? path.resolve(process.argv[3]) : path.join(here, 'stills')
fs.mkdirSync(out, { recursive: true })
const big = createCanvas(W, H), bx = big.getContext('2d'), small = createCanvas(768, 432), sx = small.getContext('2d')
// 内置六种主题之外，再用 "colors" 配出六套：每套是「一个内置主题 + 换掉的颜色」，写法和 video.json 里的一样
export const LOOKS = [
  { id: 'keynote', theme: 'keynote' }, { id: 'grid', theme: 'grid' }, { id: 'minimal', theme: 'minimal' },
  { id: 'pop', theme: 'pop' }, { id: 'blueprint', theme: 'blueprint' }, { id: 'whiteboard', theme: 'whiteboard' },
  { id: 'c1', theme: 'grid', colors: { bg: '#0f2a22', fg: '#f3efe2', muted: '#8fb3a3', accent: '#f2b84b', accent2: '#ff7a59', card: '#17382e', line: '#2c5a4a', onAccent: '#0f2a22' } },
  { id: 'c2', theme: 'keynote', colors: { bg: '#1c0a10', accent: '#ff5d73', accent2: '#ffb86b' } },
  { id: 'c3', theme: 'pop', colors: { accent: '#7a3cff', accent2: '#00a892' } },
  { id: 'c4', theme: 'minimal', colors: { bg: '#f6efe4', fg: '#2b2118', muted: '#9a8a78', accent: '#d7263d', accent2: '#f49d37' } },
  { id: 'c5', theme: 'blueprint', colors: { accent: '#7cf5ff', accent2: '#ff8bd1' } },
  { id: 'c6', theme: 'whiteboard', colors: { accent: '#1f9d55', accent2: '#f59e0b' } },
]
for (const look of LOOKS) {
  const id = look.id, theme = getTheme(look.theme, look.colors), TL = buildTimeline(v, theme), R = makeRenderer({ v, theme, TL, fonts, W, H, createCanvas })
  for (const S of TL.scenes) {
    R.drawFrame(bx, S.t0 + S.dur * 0.9)
    sx.drawImage(big, 0, 0, 768, 432)
    fs.writeFileSync(path.join(out, `${id}-${S.i + 1}.jpg`), await small.encode('jpeg', 88))
  }
}
console.log('写好 108 张缩略图：', out)
