// 找 ffmpeg、混音、编码、读回成片的规格。三个系统走同一套代码：只用 spawn，不经过 shell。
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync, spawn } from 'node:child_process'

const opts = { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
const works = exe => { try { const r = spawnSync(exe, ['-version'], opts); return !r.error && r.status === 0 && /ffmpeg version/.test(r.stdout) } catch { return false } }
const PY = `import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())`

// 依次试：环境变量 FFMPEG → 上次找到的 → PATH 里的 ffmpeg → Python 的 imageio-ffmpeg 包带的那个。
// install=true（只有 setup.mjs 会传）时，找不到就试着用 uv 或 pip 装 imageio-ffmpeg。
export function findFfmpeg(cacheFile, { install = false, log = () => {} } = {}) {
  const tried = []
  const ok = (exe, how) => { if (exe && works(exe)) { if (cacheFile) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, exe) } return { exe, how } } tried.push(how); return null }
  let r
  if (process.env.FFMPEG && (r = ok(process.env.FFMPEG, '环境变量 FFMPEG'))) return r
  if (cacheFile && fs.existsSync(cacheFile) && (r = ok(fs.readFileSync(cacheFile, 'utf8').trim(), '上次找到的路径'))) return r
  if ((r = ok('ffmpeg', 'PATH 里的 ffmpeg'))) return r
  const pyOut = (cmd, args) => { try { const p = spawnSync(cmd, args, { ...opts, timeout: 300000 }); return p.status === 0 ? p.stdout.trim().split(/\r?\n/).pop() : null } catch { return null } }
  for (const py of ['python3', 'python', 'py']) { const exe = pyOut(py, ['-c', PY]); if (exe && (r = ok(exe, `${py} 的 imageio-ffmpeg 包`))) return r }
  if (install) {
    log('没有找到 ffmpeg，试着装 imageio-ffmpeg（一个自带 ffmpeg 程序的 Python 包，约 30 到 80 MB）……')
    const viaUv = pyOut('uv', ['run', '-q', '--with', 'imageio-ffmpeg', 'python', '-c', PY]); if (viaUv && (r = ok(viaUv, 'uv 装的 imageio-ffmpeg'))) return r
    for (const py of ['python3', 'python', 'py']) { pyOut(py, ['-m', 'pip', 'install', '--user', '-q', 'imageio-ffmpeg']); const exe = pyOut(py, ['-c', PY]); if (exe && (r = ok(exe, `${py} -m pip 装的 imageio-ffmpeg`))) return r }
  }
  return { exe: null, tried }
}

export const FFMPEG_HELP = `没有找到 ffmpeg。任选一种装法，装完重跑：
  macOS:    brew install ffmpeg
  Windows:  winget install Gyan.FFmpeg      （装完重开终端）
  Linux:    sudo apt install ffmpeg          （或 dnf / pacman 对应的包）
  任意系统: pip install imageio-ffmpeg       （自带 ffmpeg 程序，不用管理员权限）
已经装了但不在 PATH 里：把环境变量 FFMPEG 设成 ffmpeg 可执行文件的完整路径。`

export function run(ff, args) {
  const r = spawnSync(ff, ['-hide_banner', '-nostdin', ...args], opts)
  if (r.error) throw r.error
  return { code: r.status, err: r.stderr || '' }
}
function must(ff, args, what) {
  const r = run(ff, args)
  if (r.code !== 0) throw new Error(`${what}失败（ffmpeg 退出码 ${r.code}）：\n` + r.err.split('\n').slice(-12).join('\n'))
  return r
}

// 量响度：综合响度（LUFS）、真峰值（dBTP）
export function loudness(ff, file) {
  const r = run(ff, ['-nostats', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'])
  const a = r.err.lastIndexOf('{'), b = r.err.lastIndexOf('}')
  if (a < 0 || b < a) return null
  try { const j = JSON.parse(r.err.slice(a, b + 1)); return { I: Number(j.input_i), TP: Number(j.input_tp), LRA: Number(j.input_lra) } } catch { return null }
}

// 读一个音频或视频文件的时长（秒）
export function durationOf(ff, file) {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(run(ff, ['-i', file]).err)
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null
}

// 混音：配乐（加上有的话的人声）→ 轻压缩 → 量响度 → 限幅器压峰 → 固定增益到 -14 LUFS。
// 不用 loudnorm 直接归一：线性增益够不到目标时它会悄悄改用动态模式，把强弱起伏压平。
export function mixAudio(ff, { music, voices = [], out, tmp, target = -14, tpMax = -1.8 }) {
  const pre = path.join(tmp, 'pre.wav'), args = ['-y', '-i', music]
  voices.forEach(v => args.push('-i', v.file))
  const comp = 'acompressor=threshold=-14dB:ratio=2:attack=15:release=250:makeup=1dB'
  let graph
  if (voices.length === 0) graph = `[0:a]${comp}[o]`
  else {
    const parts = voices.map((v, k) => `[${k + 1}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${Math.round(v.at * 1000)}:all=1[v${k}]`)
    const bus = voices.length > 1 ? `${voices.map((_, k) => `[v${k}]`).join('')}amix=inputs=${voices.length}:normalize=0,asplit=2[va][vb]` : `[v0]asplit=2[va][vb]`
    graph = [...parts, bus, `[0:a]volume=-5dB[m0]`, `[m0][va]sidechaincompress=threshold=0.02:ratio=5:attack=25:release=450[md]`, `[md][vb]amix=inputs=2:normalize=0,${comp}[o]`].join(';')
  }
  must(ff, [...args, '-filter_complex', graph, '-map', '[o]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_f32le', pre], '混音')
  const m = loudness(ff, pre)
  if (!m || !isFinite(m.I)) { must(ff, ['-y', '-i', pre, '-c:a', 'pcm_s16le', out], '写音轨'); return null }
  const need = +(target - m.I).toFixed(2), limit = Math.min(1, Math.pow(10, (tpMax - need) / 20)).toFixed(4)
  must(ff, ['-y', '-i', pre, '-af', `alimiter=limit=${limit}:level=false:attack=5:release=120,volume=${need}dB`, '-ar', '48000', '-c:a', 'pcm_s16le', out], '母带')
  return loudness(ff, out)
}

// 选一个这份 ffmpeg 里有的 H.264 编码器
export function pickEncoder(ff) {
  const list = run(ff, ['-encoders']).err + spawnSync(ff, ['-hide_banner', '-encoders'], opts).stdout
  if (/libx264/.test(list)) return { name: 'libx264', args: ['-preset', 'medium', '-crf', '18', '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709:range=tv'] }
  if (/libopenh264/.test(list)) return { name: 'libopenh264', args: ['-b:v', '8M'] }
  if (/h264_videotoolbox/.test(list)) return { name: 'h264_videotoolbox', args: ['-b:v', '10M'] }
  return { name: 'mpeg4', args: ['-q:v', '3'], weak: true }
}

// 开一个编码进程：往它的标准输入逐帧写 RGBA 原始像素。返回 { write(buf), done() }
// png=true 时改成逐帧写 PNG 文件的内容（浏览器截图用）
export function openEncoder(ff, { W, H, fps, audio, out, seconds, png = false }) {
  const enc = pickEncoder(ff)
  const args = ['-hide_banner', '-loglevel', 'error', '-y', ...(png ? ['-f', 'image2pipe', '-c:v', 'png', '-r', String(fps)] : ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps)]), '-i', 'pipe:0']
  if (audio) args.push('-i', audio)
  args.push('-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv',
    '-c:v', enc.name, ...enc.args, '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv')
  if (audio) args.push('-c:a', 'aac', '-b:a', '256k', '-aac_pns', '0', '-ar', '48000', '-ac', '2')
  args.push('-t', seconds.toFixed(3), '-movflags', '+faststart', out)
  const child = spawn(ff, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
  let errText = ''
  child.stderr.on('data', d => { errText += d })
  child.stdin.on('error', () => {})
  const closed = new Promise(resolve => child.on('close', code => resolve(code)))
  return {
    encoder: enc,
    write: buf => new Promise((resolve, reject) => {
      if (child.exitCode != null) return reject(new Error('ffmpeg 提前退出：\n' + errText))
      if (child.stdin.write(buf)) resolve(); else child.stdin.once('drain', resolve)
    }),
    async done() { child.stdin.end(); const code = await closed; if (code !== 0) throw new Error(`编码失败（ffmpeg 退出码 ${code}）：\n` + errText.split('\n').slice(-12).join('\n')) },
  }
}

// 读回成片的规格
export function probe(ff, file) {
  const e = run(ff, ['-i', file]).err
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(e), v = /Video:\s*(\w+).*?(\d{3,5})x(\d{3,5}).*?([\d.]+)\s*fps/.exec(e), a = /Audio:\s*(\w+).*?(\d+)\s*Hz,\s*(\w+)/.exec(e)
  return {
    seconds: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : null,
    video: v ? { codec: v[1], w: +v[2], h: +v[3], fps: +v[4] } : null,
    audio: a ? { codec: a[1], hz: +a[2], layout: a[3] } : null,
  }
}
