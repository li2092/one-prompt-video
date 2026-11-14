// 用库乐队（GarageBand）或 Logic 装在本机的乐器采样离线渲配乐，不打开它们的界面、不出声。只能在 macOS 上用。
// 编译：swiftc -O gbrender.swift -o gbrender
// 用法：./gbrender score.json out.wav
// score.json：{"duration": 秒, "reverb": 0-100, "tracks": [{"name":..., "inst": ".exs 路径", "gain": dB, "pan": -1..1, "notes": [[起点秒, 时长秒, MIDI 音高, 力度]]}]}
import AVFoundation

struct Track: Decodable { let name: String; let inst: String; let gain: Float; let pan: Float; let notes: [[Double]] }
struct Score: Decodable { let duration: Double; let reverb: Float; let tracks: [Track] }

let args = CommandLine.arguments
let score = try JSONDecoder().decode(Score.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let sr = 48000.0
let block: AVAudioFrameCount = 128
// 限速：每渲一秒声音睡 GB_THROTTLE 秒，默认 0.5。不限速时采样器来不及读采样，音一密后面的音就变轻直到没声
// （量过：八分之一拍一个音的半音阶，不限速 12 个音后全无声，限速 0.3 起和实时渲的电平一致）
let throttle = Double(ProcessInfo.processInfo.environment["GB_THROTTLE"] ?? "0.5") ?? 0.5
let fmt = AVAudioFormat(standardFormatWithSampleRate: sr, channels: 2)!
let engine = AVAudioEngine()
let reverb = AVAudioUnitReverb()
reverb.loadFactoryPreset(.mediumHall)
reverb.wetDryMix = score.reverb
engine.attach(reverb)
engine.connect(reverb, to: engine.mainMixerNode, format: fmt)
let bus = AVAudioMixerNode()
engine.attach(bus)
engine.connect(bus, to: reverb, format: fmt)
var samplers: [AVAudioUnitSampler] = []
for _ in score.tracks {
  let s = AVAudioUnitSampler()
  engine.attach(s)
  engine.connect(s, to: bus, format: fmt)
  samplers.append(s)
}
try engine.enableManualRenderingMode(.offline, format: fmt, maximumFrameCount: block)
try engine.start()
struct Ev { let t: Double; let on: Bool; let tr: Int; let note: UInt8; let vel: UInt8 }
var events: [Ev] = []
for (i, tr) in score.tracks.enumerated() {
  do { try samplers[i].loadInstrument(at: URL(fileURLWithPath: tr.inst)) } catch {
    FileHandle.standardError.write("加载失败 \(tr.name): \(error)\n".data(using: .utf8)!); exit(2)
  }
  if tr.gain > 0 { samplers[i].overallGain = min(tr.gain, 12) } else { samplers[i].volume = pow(10, tr.gain / 20) }
  samplers[i].pan = tr.pan
  for n in tr.notes {
    events.append(Ev(t: n[0], on: true, tr: i, note: UInt8(n[2]), vel: UInt8(n[3])))
    events.append(Ev(t: n[0] + n[1], on: false, tr: i, note: UInt8(n[2]), vel: 0))
  }
}
events.sort { $0.t < $1.t || ($0.t == $1.t && !$0.on && $1.on) }
let total = AVAudioFramePosition(score.duration * sr)
var file: AVAudioFile? = try AVAudioFile(forWriting: URL(fileURLWithPath: args[2]), settings: [
  AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: sr, AVNumberOfChannelsKey: 2,
  AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true,
])
let buf = AVAudioPCMBuffer(pcmFormat: engine.manualRenderingFormat, frameCapacity: block)!
var idx = 0
var peak: Float = 0
while engine.manualRenderingSampleTime < total {
  let now = Double(engine.manualRenderingSampleTime) / sr
  while idx < events.count && events[idx].t <= now {
    let e = events[idx]
    if e.on { samplers[e.tr].startNote(e.note, withVelocity: e.vel, onChannel: 0) } else { samplers[e.tr].stopNote(e.note, onChannel: 0) }
    idx += 1
  }
  guard try engine.renderOffline(block, to: buf) == .success else { break }
  if throttle > 0 { usleep(UInt32(Double(block) / sr * throttle * 1e6)) }
  if let ch = buf.floatChannelData { for c in 0..<2 { for i in 0..<Int(buf.frameLength) { peak = max(peak, abs(ch[c][i])) } } }
  try file!.write(from: buf)
}
engine.stop()
file = nil   // 关文件，写完文件头
print(String(format: "渲完 %.1f 秒，%d 轨，%d 个音符事件，峰值 %.3f", score.duration, score.tracks.count, events.count / 2, peak))
