// 程序合成配乐：纯 JS，离线渲染到 Float32 立体声缓冲。
// 用法见 audio.mjs：风格目录的 music.mjs 导出 score(M, TL)，在 M 上排音符，M.render() 出缓冲。
export const SR = 48000

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// 'C4' 'F#3' 'Bb2' -> midi
export function midi(n) {
  if (typeof n === 'number') return n
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n)
  if (!m) throw new Error('bad note ' + n)
  return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}
export const hz = m => 440 * Math.pow(2, (midi(m) - 69) / 12)
const CHORD = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 14], m9: [0, 3, 7, 10, 14], maj9: [0, 4, 7, 11, 14], 6: [0, 4, 7, 9], dim: [0, 3, 6] }
// chord('Fmaj7', 3) -> midi 数组（根音在第 3 八度）
export function chord(name, oct = 3) {
  const m = /^([A-G][#b]?)(.*)$/.exec(name)
  const root = midi(m[1] + oct)
  const iv = CHORD[m[2]]
  if (!iv) throw new Error('bad chord ' + name)
  return iv.map(i => root + i)
}

// ---------- 滤波器 ----------
export class Biquad {
  constructor(type, f, q = 0.707, gainDb = 0) { this.set(type, f, q, gainDb); this.x1 = this.x2 = this.y1 = this.y2 = 0 }
  set(type, f, q = 0.707, gainDb = 0) {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40)
    let b0, b1, b2, a0, a1, a2
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al }
    else if (type === 'peak') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A }
    else if (type === 'lowshelf') { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * c + sq); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - sq); a0 = (A + 1) + (A - 1) * c + sq; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - sq }
    else if (type === 'highshelf') { const sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0
  }
  run(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y }
}

// ---------- 混响（Freeverb） ----------
function freeverb(inL, inR, { room = 0.82, damp = 0.35, wet = 1 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225]
  const scale = SR / 44100
  const n = inL.length
  const outL = new Float32Array(n), outR = new Float32Array(n)
  for (const [inp, out, spread] of [[inL, outL, 0], [inR, outR, 23]]) {
    const cb = combs.map(d => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0, f: 0 }))
    const ab = aps.map(d => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 }))
    for (let s = 0; s < n; s++) {
      const x = inp[s] * 0.015
      let y = 0
      for (const c of cb) {
        const o = c.buf[c.i]
        c.f = o * (1 - damp) + c.f * damp
        c.buf[c.i] = x + c.f * room
        c.i = (c.i + 1) % c.buf.length
        y += o
      }
      for (const a of ab) {
        const b = a.buf[a.i]
        const o = -y + b
        a.buf[a.i] = y + b * 0.5
        a.i = (a.i + 1) % a.buf.length
        y = o
      }
      out[s] = y * wet
    }
  }
  return [outL, outR]
}

// ---------- 乐器 ----------
// 每个乐器函数写进 (L, R) 两条缓冲，起点 t（秒），pan ∈ [-1, 1]
function panGains(pan) { const a = (pan + 1) * Math.PI / 4; return [Math.cos(a), Math.sin(a)] }
function noiseGen(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1 } }

export class Music {
  constructor(dur, { bpm = 90 } = {}) {
    this.n = Math.ceil((dur + 4) * SR)
    this.dur = dur
    this.bpm = bpm
    this.beat = 60 / bpm
    this.bus = { dry: [new Float32Array(this.n), new Float32Array(this.n)], verb: [new Float32Array(this.n), new Float32Array(this.n)] }
    this.seed = 7
  }
  _out(send) { return send > 0 ? this.bus.verb : null }
  // 把单声道信号 sig（Float32Array）写到 t 处，带声像和混响发送量
  place(sig, t, { gain = 1, pan = 0, verb = 0.25 } = {}) {
    const s0 = Math.round(t * SR)
    if (s0 >= this.n) return
    const [gl, gr] = panGains(pan)
    const [dl, dr] = this.bus.dry, [vl, vr] = this.bus.verb
    const m = Math.min(sig.length, this.n - s0)
    for (let i = Math.max(0, -s0); i < m; i++) {
      const x = sig[i] * gain
      dl[s0 + i] += x * gl; dr[s0 + i] += x * gr
      if (verb) { vl[s0 + i] += x * gl * verb; vr[s0 + i] += x * gr * verb }
    }
  }

  // 柔和钢琴：带非谐性的加法合成，高次泛音衰减更快，力度越大越亮；附一点击弦噪声
  piano(t, note, dur = 1, vel = 0.7, o = {}) {
    const f = hz(note), rel = 0.35, len = Math.ceil((dur + rel + 0.1) * SR)
    const sig = new Float32Array(len)
    const B = 0.00035, nP = f > 1200 ? 4 : f > 600 ? 6 : 9
    const bright = 0.6 + vel * 0.8
    for (let p = 1; p <= nP; p++) {
      const fp = f * p * Math.sqrt(1 + B * p * p)
      if (fp > SR * 0.45) break
      const amp = Math.pow(p, -1.15 - (1 - bright) * 0.9) * (p === 1 ? 1 : 0.55)
      const dec = 0.9 + p * 0.55 + f / 900
      const det = (p % 2 ? 1 : -1) * 0.0007
      const w = 2 * Math.PI * fp / SR, w2 = w * (1 + det)
      for (let i = 0; i < len; i++) {
        const tt = i / SR
        let env = Math.exp(-dec * tt) * Math.min(1, tt / 0.004)
        if (tt > dur) env *= Math.exp(-(tt - dur) / (rel * 0.35))
        sig[i] += amp * env * (Math.sin(w * i) + 0.35 * Math.sin(w2 * i))
      }
    }
    const nz = noiseGen(this.seed++), lp = new Biquad('lp', 2500 + vel * 2500)
    for (let i = 0; i < Math.min(len, SR * 0.03); i++) sig[i] += lp.run(nz()) * 0.05 * vel * Math.exp(-i / (SR * 0.006))
    this.place(sig, t, { gain: vel * 0.32 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.35 })
  }

  // 电钢琴（FM）：温暖、圆
  epiano(t, note, dur = 1, vel = 0.7, o = {}) {
    const f = hz(note), rel = 0.3, len = Math.ceil((dur + rel + 0.05) * SR)
    const sig = new Float32Array(len)
    for (let i = 0; i < len; i++) {
      const tt = i / SR
      let env = Math.exp(-1.6 * tt) * Math.min(1, tt / 0.003)
      if (tt > dur) env *= Math.exp(-(tt - dur) / (rel * 0.3))
      const idx = (1.4 + vel * 1.6) * Math.exp(-4 * tt)
      const tine = 0.12 * Math.exp(-14 * tt) * Math.sin(2 * Math.PI * f * 14 * tt)
      sig[i] = env * (Math.sin(2 * Math.PI * f * tt + idx * Math.sin(2 * Math.PI * f * tt)) + tine)
    }
    this.place(sig, t, { gain: vel * 0.22 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.3 })
  }

  // 拨弦（Karplus-Strong）：木吉他 / 竖琴感
  pluck(t, note, dur = 1.5, vel = 0.7, o = {}) {
    const f = hz(note), len = Math.ceil((dur + 0.2) * SR)
    const N = Math.max(2, Math.round(SR / f))
    const buf = new Float32Array(N), nz = noiseGen(this.seed++)
    const lp0 = new Biquad('lp', 1500 + vel * 4000)
    for (let i = 0; i < N; i++) buf[i] = lp0.run(nz())
    const sig = new Float32Array(len)
    const damp = o.damp ?? 0.996
    let idx = 0, prev = 0
    for (let i = 0; i < len; i++) {
      const cur = buf[idx]
      const nv = damp * 0.5 * (cur + prev)
      prev = cur
      buf[idx] = nv
      idx = (idx + 1) % N
      let env = 1
      const tt = i / SR
      if (tt > dur) env = Math.exp(-(tt - dur) / 0.05)
      sig[i] = cur * env
    }
    this.place(sig, t, { gain: vel * 0.5 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.3 })
  }

  // 马林巴 / 木琴
  marimba(t, note, vel = 0.7, o = {}) {
    const f = hz(note), len = Math.ceil(1.2 * SR), sig = new Float32Array(len)
    for (let i = 0; i < len; i++) {
      const tt = i / SR
      sig[i] = Math.min(1, tt / 0.002) * (Math.exp(-5 * tt) * Math.sin(2 * Math.PI * f * tt) + 0.25 * Math.exp(-22 * tt) * Math.sin(2 * Math.PI * f * 3.93 * tt) + 0.1 * Math.exp(-40 * tt) * Math.sin(2 * Math.PI * f * 9.2 * tt))
    }
    this.place(sig, t, { gain: vel * 0.3 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.25 })
  }

  // 钟 / 钢片琴（FM，非整数比）
  bell(t, note, vel = 0.6, o = {}) {
    const f = hz(note), d = o.decay ?? 2.5, len = Math.ceil(d * 1.6 * SR), sig = new Float32Array(len)
    const ratio = o.ratio ?? 3.5
    for (let i = 0; i < len; i++) {
      const tt = i / SR
      const env = Math.exp(-tt * 3 / d) * Math.min(1, tt / 0.002)
      const idx = 2.2 * Math.exp(-tt * 6 / d)
      sig[i] = env * Math.sin(2 * Math.PI * f * tt + idx * Math.sin(2 * Math.PI * f * ratio * tt))
    }
    this.place(sig, t, { gain: vel * 0.16 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.5 })
  }

  // 铺底：多个失谐锯齿波过低通，慢起慢收
  pad(t, notes, dur, vel = 0.5, o = {}) {
    const att = o.attack ?? 1.2, rel = o.release ?? 1.5, len = Math.ceil((dur + rel) * SR)
    const sig = new Float32Array(len)
    const lp = new Biquad('lp', o.cutoff ?? 1400, 0.6)
    const voices = []
    for (const nt of notes) for (const d of [-0.11, 0.0, 0.12]) voices.push({ f: hz(nt) * Math.pow(2, d / 12), ph: (voices.length * 0.37) % 1 })
    const wave = o.wave ?? 'saw'
    for (let i = 0; i < len; i++) {
      const tt = i / SR
      let x = 0
      for (const v of voices) {
        v.ph += v.f / SR; if (v.ph >= 1) v.ph -= 1
        x += wave === 'saw' ? 2 * v.ph - 1 : wave === 'tri' ? 1 - 4 * Math.abs(v.ph - 0.5) : Math.sin(2 * Math.PI * v.ph)
      }
      let env = Math.min(1, tt / att)
      if (tt > dur) env *= Math.max(0, 1 - (tt - dur) / rel)
      env = env * env * (3 - 2 * env)
      sig[i] = lp.run(x / voices.length) * env
    }
    this.place(sig, t, { gain: vel * 0.35 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.5 })
  }

  // 贝斯：正弦 + 少量二次谐波，短促
  bass(t, note, dur = 0.5, vel = 0.7, o = {}) {
    const f = hz(note), len = Math.ceil((dur + 0.15) * SR), sig = new Float32Array(len)
    for (let i = 0; i < len; i++) {
      const tt = i / SR
      let env = Math.min(1, tt / 0.006) * Math.exp(-tt * (o.decay ?? 1.5))
      if (tt > dur) env *= Math.exp(-(tt - dur) / 0.03)
      const x = Math.sin(2 * Math.PI * f * tt)
      sig[i] = env * Math.tanh(1.6 * (x + 0.25 * Math.sin(4 * Math.PI * f * tt)))
    }
    this.place(sig, t, { gain: vel * 0.42 * (o.gain ?? 1), pan: 0, verb: o.verb ?? 0.05 })
  }

  // 打击乐
  kick(t, vel = 0.8, o = {}) {
    const len = Math.ceil(0.45 * SR), sig = new Float32Array(len)
    let ph = 0
    for (let i = 0; i < len; i++) {
      const tt = i / SR, f = 48 + 110 * Math.exp(-tt * 30)
      ph += 2 * Math.PI * f / SR
      sig[i] = Math.sin(ph) * Math.exp(-tt * 7) * Math.min(1, tt / 0.001)
    }
    this.place(sig, t, { gain: vel * 0.55 * (o.gain ?? 1), verb: 0.03 })
  }
  hat(t, vel = 0.4, o = {}) {
    const len = Math.ceil((o.open ? 0.3 : 0.06) * SR), sig = new Float32Array(len), nz = noiseGen(this.seed++), hp = new Biquad('hp', 7000, 0.8)
    for (let i = 0; i < len; i++) sig[i] = hp.run(nz()) * Math.exp(-i / SR * (o.open ? 12 : 60))
    this.place(sig, t, { gain: vel * 0.25 * (o.gain ?? 1), pan: o.pan ?? 0.25, verb: 0.1 })
  }
  shaker(t, vel = 0.3, o = {}) {
    const len = Math.ceil(0.09 * SR), sig = new Float32Array(len), nz = noiseGen(this.seed++), bp = new Biquad('bp', 6000, 1.2)
    for (let i = 0; i < len; i++) { const tt = i / SR; sig[i] = bp.run(nz()) * Math.min(1, tt / 0.02) * Math.exp(-tt * 40) }
    this.place(sig, t, { gain: vel * 0.6 * (o.gain ?? 1), pan: o.pan ?? -0.3, verb: 0.1 })
  }
  rim(t, vel = 0.4, o = {}) {
    const len = Math.ceil(0.08 * SR), sig = new Float32Array(len), nz = noiseGen(this.seed++), bp = new Biquad('bp', 1800, 4)
    for (let i = 0; i < len; i++) { const tt = i / SR; sig[i] = (bp.run(nz()) * 0.6 + Math.sin(2 * Math.PI * 820 * tt) * 0.5) * Math.exp(-tt * 70) }
    this.place(sig, t, { gain: vel * 0.4 * (o.gain ?? 1), pan: o.pan ?? 0.15, verb: 0.15 })
  }
  clap(t, vel = 0.5, o = {}) {
    const len = Math.ceil(0.25 * SR), sig = new Float32Array(len), nz = noiseGen(this.seed++), bp = new Biquad('bp', 1500, 0.9)
    for (let i = 0; i < len; i++) {
      const tt = i / SR
      const burst = [0, 0.011, 0.022].reduce((a, d) => a + (tt >= d ? Math.exp(-(tt - d) * 140) : 0), 0) + 0.4 * Math.exp(-tt * 18)
      sig[i] = bp.run(nz()) * burst
    }
    this.place(sig, t, { gain: vel * 0.5 * (o.gain ?? 1), pan: o.pan ?? 0, verb: 0.3 })
  }
  // 环境底噪：粉噪过带通，营造空间感（暗色、科技感风格用）
  air(t, dur, vel = 0.2, o = {}) {
    const len = Math.ceil(dur * SR), sig = new Float32Array(len), nz = noiseGen(this.seed++), bp = new Biquad('bp', o.freq ?? 900, o.q ?? 0.8)
    const att = o.attack ?? 2
    for (let i = 0; i < len; i++) { const tt = i / SR; const env = Math.min(1, tt / att, (dur - tt) / att); sig[i] = bp.run(nz()) * Math.max(0, env) }
    this.place(sig, t, { gain: vel * 0.3 * (o.gain ?? 1), pan: o.pan ?? 0, verb: o.verb ?? 0.6 })
  }

  // 节拍工具
  b(n) { return n * this.beat }
  // 输出：干声 + 混响，过高通和一点母带均衡
  render({ verb = {}, master = {} } = {}) {
    const [vl, vr] = freeverb(this.bus.verb[0], this.bus.verb[1], verb)
    const [dl, dr] = this.bus.dry
    const L = new Float32Array(this.n), R = new Float32Array(this.n)
    const hpL = new Biquad('hp', master.hp ?? 35), hpR = new Biquad('hp', master.hp ?? 35)
    const shL = new Biquad('highshelf', 7000, 0.7, master.air ?? 1.5), shR = new Biquad('highshelf', 7000, 0.7, master.air ?? 1.5)
    for (let i = 0; i < this.n; i++) {
      L[i] = shL.run(hpL.run(dl[i] + vl[i]))
      R[i] = shR.run(hpR.run(dr[i] + vr[i]))
    }
    return [L, R]
  }
}

// ---------- 音效库（界面感、克制） ----------
// kind: tick pop whoosh chime thud click type swell glitch
export function sfxSignal(kind, seed = 1) {
  const nz = noiseGen(seed * 977 + 13)
  const mk = d => new Float32Array(Math.ceil(d * SR))
  let s
  switch (kind) {
    case 'tick': { s = mk(0.05); for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] = Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 160) * 0.5 } break }
    case 'click': { s = mk(0.03); const bp = new Biquad('bp', 3200, 2); for (let i = 0; i < s.length; i++) s[i] = bp.run(nz()) * Math.exp(-i / SR * 220) * 1.4; break }
    case 'type': { s = mk(0.04); const bp = new Biquad('bp', 2600 + seed % 5 * 300, 3); for (let i = 0; i < s.length; i++) s[i] = bp.run(nz()) * Math.exp(-i / SR * 180) * 0.9; break }
    case 'pop': { s = mk(0.12); let ph = 0; for (let i = 0; i < s.length; i++) { const t = i / SR; ph += 2 * Math.PI * (420 + 900 * Math.exp(-t * 40)) / SR; s[i] = Math.sin(ph) * Math.exp(-t * 32) * 0.6 } break }
    case 'thud': { s = mk(0.3); let ph = 0; for (let i = 0; i < s.length; i++) { const t = i / SR; ph += 2 * Math.PI * (70 + 80 * Math.exp(-t * 25)) / SR; s[i] = Math.sin(ph) * Math.exp(-t * 14) * 0.9 } break }
    case 'chime': { s = mk(1.6); for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] = Math.exp(-t * 2.4) * (Math.sin(2 * Math.PI * 1318.5 * t) * 0.5 + Math.sin(2 * Math.PI * 1975.5 * t + 1.6 * Math.exp(-t * 5) * Math.sin(2 * Math.PI * 1318.5 * 3.5 * t)) * 0.3) * Math.min(1, t / 0.003) } break }
    case 'whoosh': { s = mk(0.6); const bp = new Biquad('bp', 800, 0.9); for (let i = 0; i < s.length; i++) { const t = i / SR, p = t / 0.6; bp.set('bp', 400 + 2600 * Math.sin(Math.PI * p), 0.9); s[i] = bp.run(nz()) * Math.sin(Math.PI * p) ** 2 * 0.8 } break }
    case 'swell': { s = mk(1.4); const lp = new Biquad('lp', 300); for (let i = 0; i < s.length; i++) { const t = i / SR, p = t / 1.4; lp.set('lp', 200 + 3000 * p * p, 0.9); s[i] = lp.run(nz()) * p * p * (p < 0.92 ? 1 : (1 - p) / 0.08) * 0.7 } break }
    case 'glitch': { s = mk(0.18); for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] = (Math.floor(t * 90) % 2 ? 1 : -1) * Math.sin(2 * Math.PI * (300 + (Math.floor(t * 45) % 5) * 220) * t) * 0.25 * Math.exp(-t * 12) } break }
    default: s = mk(0.01)
  }
  return s
}
