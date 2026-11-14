// 配乐和音效：按时间线自动排，不用模型写。
// 做法：先定速度（主题的 bpm），每场的长度是整数拍；和弦一小节换一个；强弱按全片的位置走——
// 开头轻，中段逐步加层，约七成处最满，最后一场落回主和弦。每个元素入场配一个轻的音效。
import { Music, SR, chord, sfxSignal } from './synth.mjs'

const lerp = (a, b, p) => a + (b - a) * p
// 音效起音至少 2 毫秒：起音为 0 的高频噪声经 AAC 编码会冒尖，编码后的峰值超标
function softAttack(sig) { const n = Math.min(sig.length, Math.round(0.002 * SR)); for (let i = 0; i < n; i++) sig[i] *= i / n; return sig }

function level(P) {
  if (P < 0.12) return 0.3
  if (P < 0.7) return lerp(0.45, 1, (P - 0.12) / 0.58)
  if (P < 0.88) return 1
  return 0.5
}

// bed=false 时只出音效，不出配乐（用户用自己的配乐文件时）
export function renderMusic(TL, theme, { sfx = true, bed = true } = {}) {
  const M = new Music(TL.total, { bpm: TL.bpm }), B = TL.beat, BAR = 4 * B
  const mu = theme.music, prog = mu.prog, endT = TL.scenes[TL.scenes.length - 1].t0
  const bars = Math.ceil(TL.body / BAR)
  for (let b = 0; bed && b < bars; b++) {
    const t = b * BAR, name = t >= endT ? prog[0] : prog[b % prog.length], lv = t >= endT ? 0.35 : level(t / TL.body)
    const low = chord(name, 2), mid = chord(name, 3), hi = chord(name, 4).map(n => n + 12)
    const len = Math.min(BAR, TL.body - t)
    // 铺底
    M.pad(t, mid.slice(0, 4), len, 0.28 + 0.14 * lv, { wave: mu.style === 'drive' ? 'saw' : 'tri', cutoff: mu.style === 'ambient' ? 900 : 1300, attack: 0.5, release: 0.9 })
    // 低音
    if (mu.style === 'drive') { const n = lv > 0.5 ? 8 : 4; for (let k = 0; k < n; k++) { const tt = t + k * BAR / n; if (tt < TL.body - 0.05 && lv > 0.4) M.bass(tt, low[0], BAR / n * 0.8, 0.6) } }
    else if (lv > 0.35 || mu.style !== 'ambient') { M.bass(t, low[0], B * 1.6, 0.55); if (lv > 0.6 && t + 2 * B < TL.body) M.bass(t + 2 * B, low[0], B * 1.2, 0.45) }
    // 主奏：按强弱决定音有多密
    const dens = mu.style === 'ambient' ? (lv > 0.8 ? 4 : 2) : lv >= 0.7 ? 8 : lv >= 0.45 ? 4 : 2
    for (let k = 0; k < dens; k++) {
      const tt = t + k * BAR / dens
      if (tt >= TL.body - 0.1) break
      const pat = [0, 2, 1, 3, 2, 1, 3, 2], note = hi[pat[(k + b) % pat.length] % hi.length] + (mu.style === 'ambient' && k % 2 ? 12 : 0)
      const vel = (k === 0 ? 0.62 : 0.42) * (0.6 + 0.4 * lv)
      if (mu.lead === 'piano') M.piano(tt, note, BAR / dens * 1.6, vel)
      else if (mu.lead === 'epiano') M.epiano(tt, note, BAR / dens * 1.4, vel)
      else if (mu.lead === 'marimba') M.marimba(tt, note, vel)
      else M.pluck(tt, note, 1.2, vel)
    }
    // 鼓
    if (mu.drums && t < endT) {
      for (let k = 0; k < 4; k++) {
        const tt = t + k * B
        if (lv > 0.45 && (mu.style === 'drive' || k % 2 === 0)) M.kick(tt, 0.7)
        if (lv > 0.8 && k % 2 === 1) M.clap(tt, 0.35)
        if (lv > 0.6) { M.hat(tt + B / 2, 0.22); if (lv > 0.85) M.hat(tt, 0.14) }
      }
    }
  }
  // 最后一场：落在主和弦上，留一个长音
  if (bed) { M.piano(endT, chord(prog[0], 4)[0] + 12, 3, 0.6); M.bell(endT, chord(prog[0], 5)[0], 0.3) }
  // 场和场之间、元素入场的音效
  if (sfx) {
    const lead = { whoosh: 0.3, swell: 1.3 }
    TL.scenes.forEach((S, i) => {
      if (i > 0) { const k = theme.sfx.cut; M.place(softAttack(sfxSignal(k, i + 1)), Math.max(0, S.t0 - (lead[k] || 0)), { gain: 0.32, verb: 0.2 }) }
      if (S.layout === 'number' || S.layout === 'statement') M.place(softAttack(sfxSignal(theme.sfx.accent, i + 3)), S.t0 + S.cues[0], { gain: 0.3, verb: 0.4 })
      S.cues.forEach((c, k) => M.place(softAttack(sfxSignal(theme.sfx.enter, i * 7 + k + 1)), S.t0 + c, { gain: 0.26, pan: ((k % 3) - 1) * 0.25, verb: 0.15 }))
    })
  }
  // 风格包自己加的音效（金币、盖章这一类）：sounds(TL) 返回 [{ t 全片的秒数, kind, gain, pan }]
  if (sfx && typeof theme.sounds === 'function') for (const x of theme.sounds(TL) || []) { const sig = sfxSignal(x.kind, x.seed ?? 1); if (sig) M.place(softAttack(sig), Math.max(0, x.t), { gain: x.gain ?? 0.3, pan: x.pan ?? 0, verb: x.verb ?? 0.2 }) }
  let [L, R] = M.render({ verb: { room: 0.8, damp: 0.4, wet: 1 } })
  const n = Math.round(TL.total * SR)
  L = L.subarray(0, n); R = R.subarray(0, n)
  // 片尾淡出，再把峰值归到 0.7
  const f0 = Math.round((TL.total - 1.1) * SR)
  let peak = 1e-9
  for (let i = 0; i < n; i++) { if (i > f0) { const g = Math.max(0, 1 - (i - f0) / (n - f0)); L[i] *= g * g; R[i] *= g * g } peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])) }
  const g = bed ? 0.7 / peak : Math.min(1, 0.7 / peak)
  for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g }
  return [L, R]
}

export function wavBuffer(L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24)
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4)
  }
  return buf
}
