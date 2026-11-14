#!/usr/bin/env node
// 环境检查和安装。在你要出片的工作目录里跑一次：
//   node setup.mjs           检查，缺什么装什么（画图库用 npm 装；ffmpeg 找不到时试着装 imageio-ffmpeg）
//   node setup.mjs --check   只检查，不装任何东西
// 三个系统通用。装的东西都在当前目录（node_modules）或用户目录里，不需要管理员权限。
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { findFfmpeg, FFMPEG_HELP, pickEncoder } from './engine/encode.mjs'
import { resolveFonts } from './engine/core.mjs'

const onlyCheck = process.argv.includes('--check')
const cwd = process.cwd()
const lines = []
let failed = false
const ok = m => lines.push('[通过] ' + m), bad = m => { failed = true; lines.push('[缺少] ' + m) }

// 1. Node
const major = Number(process.versions.node.split('.')[0])
if (major >= 18) ok(`Node.js ${process.versions.node}`)
else bad(`Node.js ${process.versions.node} 太旧，需要 18 或更新。到 https://nodejs.org 下载安装。`)

// 2. 画图库
const tryCanvas = () => { try { return createRequire(path.join(cwd, 'noop.js'))('@napi-rs/canvas') } catch { return null } }
let canvas = tryCanvas()
if (!canvas && !onlyCheck) {
  console.log('正在安装画图库 @napi-rs/canvas（MIT 许可，约 30 MB，装在当前目录的 node_modules 里）……')
  if (!fs.existsSync(path.join(cwd, 'package.json'))) fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ name: 'video-work', private: true, type: 'module' }, null, 2) + '\n')
  // Windows 上 npm 是 npm.cmd，要经过 shell 才能启动
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '@napi-rs/canvas'], { cwd, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true })
  if (r.error || r.status !== 0) console.log('npm 安装没有成功。网络不通时可以换镜像再试：npm config set registry https://registry.npmmirror.com')
  canvas = tryCanvas()
}
if (canvas) ok('画图库 @napi-rs/canvas')
else bad('画图库 @napi-rs/canvas。在当前目录运行：npm install @napi-rs/canvas')

// 3. ffmpeg
const ff = findFfmpeg(path.join(cwd, '.osv', 'ffmpeg-path.txt'), { install: !onlyCheck, log: m => console.log(m) })
if (ff.exe) {
  const enc = pickEncoder(ff.exe)
  ok(`ffmpeg（${ff.how}）：${ff.exe}；视频编码器 ${enc.name}${enc.weak ? '（没有 H.264，成片兼容性差，建议换一份带 libx264 的 ffmpeg）' : ''}`)
} else bad('ffmpeg。\n' + FFMPEG_HELP.split('\n').slice(1).join('\n'))

// 4. 中文字体
if (canvas) {
  const f = resolveFonts(canvas.GlobalFonts, path.join(cwd, 'fonts'))
  if (f.found.sans) ok(`中文字体：${f.found.sans}` + (f.found.hand ? `；手写体：${f.found.hand}` : '；没有手写体（白板主题会改用黑体，不影响出片）'))
  else bad(`中文字体。任选一种：\n  · 把任意中文字体文件（.ttf / .otf）放进 ${path.join(cwd, 'fonts')}\n  · Linux：sudo apt install fonts-noto-cjk\n  · 下载 Noto Sans SC 或思源黑体（开源，SIL OFL 许可），放进上面的 fonts 目录\n  只做英文片可以忽略这一条。`)
}

console.log('\n' + lines.join('\n'))
console.log(failed ? '\n还有缺的，按上面的提示补齐后再跑一次本命令。\n' : '\n环境就绪。下一步：写 video.json，然后运行 make.mjs。\n')
process.exit(failed ? 1 : 0)
