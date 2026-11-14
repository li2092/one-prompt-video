// 把一条时间线写成剪辑软件能读的工程文件：Final Cut Pro 的 FCPXML、剪映的草稿、通用的 SRT 字幕。
// 时间线的写法（时刻和长度都是帧数，按工程的帧率算）：
//   P = { name, W, H, fps, frames,
//         video: [{ file, name, at, len, src, srcLen, w, h, audio }],   依次排在主轨上；src 是从素材的第几帧取起，srcLen 是素材总帧数
//         audio: [{ file, name, role, at, len, src, srcLen }],          role: music | effects | dialogue
//         texts: [{ text, at, len }] }                                  字幕
// 工程文件里素材写的是绝对路径：素材挪了位置、换了机器，要在剪辑软件里重新链接。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ROLE_NAME = { music: '配乐', effects: '音效', dialogue: '人声' }

// 工程引用的文件都在不在
export function missingMedia(P) {
  return [...new Set([...P.video, ...P.audio].map(x => x.file))].filter(f => !fs.existsSync(f))
}

// ---------- SRT ----------
export function writeSrt(P, outFile) {
  const tc = f => { const ms = Math.round(f * 1000 / P.fps), p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}` }
  fs.writeFileSync(outFile, P.texts.map((x, i) => `${i + 1}\n${tc(x.at)} --> ${tc(x.at + x.len)}\n${x.text}\n`).join('\n'))
  return outFile
}

// ---------- Final Cut Pro（FCPXML 1.8） ----------
// 主轨是 spine：视频片段依次排，中间空着的地方补 gap。配乐、音效、人声、字幕都「连接」在它开始时所在的那个片段上，
// 这样在 Final Cut 里挪动一个片段，它的人声和字幕跟着走。字幕用系统自带的「基本字幕」。
export function writeFcpxml(P, outFile) {
  const t = n => (n === 0 ? '0s' : `${n}/${P.fps}s`)
  const fmtName = (w, h, fps) => (h === 1080 && w === 1920 ? `FFVideoFormat1080p${fps}` : h === 720 && w === 1280 ? `FFVideoFormat720p${fps}` : h === 2160 && w === 3840 ? `FFVideoFormat3840x2160p${fps}` : null)
  const res = [], formats = new Map(), assets = new Map()
  let nid = 0
  const id = () => `r${++nid}`
  const format = (w, h) => {
    const key = `${w}x${h}`
    if (!formats.has(key)) { const fid = id(), nm = fmtName(w, h, P.fps); formats.set(key, fid); res.push(`<format id="${fid}"${nm ? ` name="${nm}"` : ''} frameDuration="${t(1)}" width="${w}" height="${h}" colorSpace="1-1-1 (Rec. 709)"/>`) }
    return formats.get(key)
  }
  const seqFormat = format(P.W, P.H)
  const asset = (x, video) => {
    if (!assets.has(x.file)) {
      const aid = id(), hasA = video ? !!x.audio : true
      res.push(`<asset id="${aid}" name="${esc(path.basename(x.file))}" src="${esc(pathToFileURL(x.file).href)}" start="0s" duration="${t(x.srcLen)}" hasVideo="${video ? 1 : 0}"${video ? ` format="${format(x.w || P.W, x.h || P.H)}"` : ''} hasAudio="${hasA ? 1 : 0}"${hasA ? ' audioSources="1" audioChannels="2" audioRate="48000"' : ''}/>`)
      assets.set(x.file, aid)
    }
    return assets.get(x.file)
  }
  let titleFx = null
  // 主轨上的每一段（片段或空隙）
  const spine = []
  let cur = 0
  for (const c of [...P.video].sort((a, b) => a.at - b.at)) {
    if (c.at > cur) spine.push({ gap: true, at: cur, len: c.at - cur, local: 0, kids: [] })
    spine.push({ clip: c, at: c.at, len: c.len, local: c.src || 0, kids: [] })
    cur = c.at + c.len
  }
  if (cur < P.frames) spine.push({ gap: true, at: cur, len: P.frames - cur, local: 0, kids: [] })
  if (!spine.length) spine.push({ gap: true, at: 0, len: P.frames, local: 0, kids: [] })
  const hostOf = at => spine.find(s => at >= s.at && at < s.at + s.len) || spine[spine.length - 1]
  const lanes = { music: -1, effects: -2, dialogue: -3 }
  for (const a of P.audio) {
    const h = hostOf(a.at), ref = asset(a, false)
    h.kids.push(`<asset-clip ref="${ref}" lane="${lanes[a.role] ?? -4}" offset="${t(h.local + a.at - h.at)}" name="${esc(a.name || ROLE_NAME[a.role] || path.basename(a.file))}" start="${t(a.src || 0)}" duration="${t(a.len)}" audioRole="${a.role === 'effects' ? 'effects' : a.role === 'dialogue' ? 'dialogue' : 'music'}"/>`)
  }
  P.texts.forEach((x, i) => {
    if (!titleFx) { titleFx = id(); res.push(`<effect id="${titleFx}" name="Basic Title" uid=".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti"/>`) }
    const h = hostOf(x.at), y = -Math.round(P.H * 0.41), size = Math.round(Math.min(P.W, P.H) * (P.H > P.W ? 0.05 : 0.046))
    h.kids.push(`<title ref="${titleFx}" lane="1" offset="${t(h.local + x.at - h.at)}" name="${esc(x.text.slice(0, 24))}" start="${t(3600 * P.fps)}" duration="${t(x.len)}">` +
      `<param name="Position" key="9999/999166631/999166633/1/100/101" value="0 ${y}"/>` +
      `<param name="Alignment" key="9999/999166631/999166633/2/354/999169573/401" value="1 (Center)"/>` +
      `<text><text-style ref="ts${i + 1}">${esc(x.text)}</text-style></text>` +
      `<text-style-def id="ts${i + 1}"><text-style font="PingFang SC" fontSize="${size}" fontFace="Semibold" fontColor="1 1 1 1" shadowColor="0 0 0 0.8" shadowOffset="3 315" alignment="center"/></text-style-def></title>`)
  })
  const body = spine.map(s => {
    const kids = s.kids.length ? '\n              ' + s.kids.join('\n              ') + '\n            ' : ''
    if (s.gap) return `<gap name="Gap" offset="${t(s.at)}" start="0s" duration="${t(s.len)}">${kids}</gap>`
    const c = s.clip
    return `<asset-clip ref="${asset(c, true)}" offset="${t(s.at)}" name="${esc(c.name || path.basename(c.file))}" start="${t(c.src || 0)}" duration="${t(s.len)}" tcFormat="NDF">${kids}</asset-clip>`
  })
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>

<fcpxml version="1.8">
  <resources>
    ${res.join('\n    ')}
  </resources>
  <library>
    <event name="${esc(P.name)}">
      <project name="${esc(P.name)}">
        <sequence format="${seqFormat}" duration="${t(P.frames)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
            ${body.join('\n            ')}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`
  fs.writeFileSync(outFile, xml)
  return outFile
}

// ---------- 剪映（草稿文件夹） ----------
// 剪映的草稿是一个文件夹，里面的 draft_content.json 描述时间线。这个格式没有公开的说明，这里只写最基本的几样：
// 一条视频轨、几条音频轨、一条字幕轨，不带转场和动画（那些要联网取剪映的资源）。时间的单位是微秒。
// 剪映打开草稿以后会把它改成自己的加密格式，之后脚本改不了同一份：要改就重新生成一份。
export function writeJianying(P, outDir) {
  const us = f => Math.round(f * 1e6 / P.fps), uid = () => crypto.randomUUID().replace(/-/g, '')
  const UP = () => crypto.randomUUID().toUpperCase()
  const M = { videos: [], audios: [], texts: [], speeds: [] }
  const speed = () => { const s = { curve_speed: null, id: uid(), mode: 0, speed: 1.0, type: 'speed' }; M.speeds.push(s); return s.id }
  const segBase = (mid, at, len, render) => ({
    enable_adjust: true, enable_color_correct_adjust: false, enable_color_curves: true, enable_color_match_adjust: false, enable_color_wheels: true, enable_lut: true, enable_smart_color_adjust: false,
    last_nonzero_volume: 1.0, reverse: false, track_attribute: 0, track_render_index: 0, visible: true, id: uid(), material_id: mid,
    target_timerange: { start: us(at), duration: us(at + len) - us(at) }, common_keyframes: [], keyframe_refs: [], speed: 1.0, volume: 1.0, is_tone_modify: false, render_index: render,
  })
  const pose = (x = 0, y = 0) => ({ alpha: 1.0, flip: { horizontal: false, vertical: false }, rotation: 0.0, scale: { x: 1.0, y: 1.0 }, transform: { x, y } })
  const track = (type, segments, name) => ({ attribute: 0, flag: 0, id: uid(), is_default_name: !name, name: name || '', type, segments })
  const tracks = []
  // 视频轨
  const vmat = new Map()
  const vsegs = [...P.video].sort((a, b) => a.at - b.at).map(c => {
    if (!vmat.has(c.file)) {
      const m = { audio_fade: null, category_id: '', category_name: 'local', check_flag: 63487, crop: { upper_left_x: 0.0, upper_left_y: 0.0, upper_right_x: 1.0, upper_right_y: 0.0, lower_left_x: 0.0, lower_left_y: 1.0, lower_right_x: 1.0, lower_right_y: 1.0 }, crop_ratio: 'free', crop_scale: 1.0, duration: us(c.srcLen), height: c.h || P.H, id: uid(), local_material_id: '', material_name: path.basename(c.file), media_path: '', path: c.file, type: 'video', width: c.w || P.W }
      m.material_id = m.id; M.videos.push(m); vmat.set(c.file, m.id)
    }
    return { ...segBase(vmat.get(c.file), c.at, c.len, 0), source_timerange: { start: us(c.src || 0), duration: us((c.src || 0) + c.len) - us(c.src || 0) }, extra_material_refs: [speed()], clip: pose(), uniform_scale: { on: true, value: 1.0 }, hdr_settings: { intensity: 1.0, mode: 1, nits: 1000 } }
  })
  if (vsegs.length) tracks.push(track('video', vsegs))
  // 音频轨：同一种声音一条轨
  const amat = new Map()
  let render = 1
  for (const role of ['dialogue', 'music', 'effects']) {
    const items = P.audio.filter(a => a.role === role).sort((a, b) => a.at - b.at)
    if (!items.length) continue
    const segs = items.map(a => {
      if (!amat.has(a.file)) {
        const mid = uid()
        M.audios.push({ app_id: 0, category_id: '', category_name: 'local', check_flag: 3, copyright_limit_type: 'none', duration: us(a.srcLen), effect_id: '', formula_id: '', id: mid, local_material_id: mid, music_id: mid, name: path.basename(a.file), path: a.file, source_platform: 0, type: 'extract_music', wave_points: [] })
        amat.set(a.file, mid)
      }
      return { ...segBase(amat.get(a.file), a.at, a.len, render), source_timerange: { start: us(a.src || 0), duration: us((a.src || 0) + a.len) - us(a.src || 0) }, extra_material_refs: [speed()], clip: null, hdr_settings: null }
    })
    tracks.push(track('audio', segs, ROLE_NAME[role])); render++
  }
  // 字幕轨
  if (P.texts.length) {
    const portrait = P.H > P.W
    const segs = P.texts.map(x => {
      const mid = uid()
      M.texts.push({
        id: mid, content: JSON.stringify({ styles: [{ fill: { alpha: 1.0, content: { render_type: 'solid', solid: { alpha: 1.0, color: [1.0, 1.0, 1.0] } } }, range: [0, x.text.length], size: portrait ? 9.0 : 7.0, bold: false, italic: false, underline: false, strokes: [] }], text: x.text }),
        typesetting: 0, alignment: 1, letter_spacing: 0.0, line_spacing: 0.02, line_feed: 1, line_max_width: 0.82, force_apply_line_max_width: false, check_flag: 23, type: 'text', global_alpha: 1.0,
        background_style: 1, background_color: '#000000', background_alpha: 0.6, background_round_radius: 0.1, background_height: 0.22, background_width: 0.5, background_horizontal_offset: 0.0, background_vertical_offset: 0.0,
      })
      return { ...segBase(mid, x.at, x.len, render + 1), source_timerange: null, extra_material_refs: [], clip: pose(0, portrait ? -0.62 : -0.8), uniform_scale: { on: true, value: 1.0 } }
    })
    tracks.push(track('text', segs))
  }
  const EMPTY = ['ai_translates', 'audio_balances', 'audio_effects', 'audio_fades', 'audio_track_indexes', 'beats', 'canvases', 'chromas', 'common_mask', 'color_curves', 'digital_humans', 'drafts', 'effects', 'flowers', 'green_screens', 'handwrites', 'hsl', 'images', 'log_color_wheels', 'loudnesses', 'manual_deformations', 'masks', 'material_animations', 'material_colors', 'multi_language_refs', 'placeholders', 'plugin_effects', 'primary_color_wheels', 'realtime_denoises', 'shapes', 'smart_crops', 'smart_relights', 'sound_channel_mappings', 'stickers', 'tail_leaders', 'text_templates', 'time_marks', 'transitions', 'video_effects', 'video_trackings', 'vocal_beautifys', 'vocal_separations']
  const platform = { app_id: 3704, app_source: 'lv', app_version: '5.9.0', os: 'windows' }
  const draft = {
    canvas_config: { width: P.W, height: P.H, ratio: 'original' }, color_space: 0,
    config: { adjust_max_index: 1, attachment_info: [], combination_max_index: 1, export_range: null, extract_audio_last_index: 1, lyrics_recognition_id: '', lyrics_sync: true, lyrics_taskinfo: [], maintrack_adsorb: true, material_save_mode: 0, multi_language_current: 'none', multi_language_list: [], multi_language_main: 'none', multi_language_mode: 'none', original_sound_last_index: 1, record_audio_last_index: 1, sticker_max_index: 1, subtitle_keywords_config: null, subtitle_recognition_id: '', subtitle_sync: true, subtitle_taskinfo: [], system_font_list: [], video_mute: false, zoom_info_params: null },
    cover: null, create_time: 0, duration: us(P.frames), extra_info: null, fps: P.fps, free_render_index_mode_on: false, group_container: null, id: UP(), keyframe_graph_list: [],
    keyframes: { adjusts: [], audios: [], effects: [], filters: [], handwrites: [], stickers: [], texts: [], videos: [] },
    last_modified_platform: platform, platform, materials: { ...Object.fromEntries(EMPTY.map(k => [k, []])), ...M },
    mutable_config: null, name: '', new_version: '110.0.0', relationships: [], render_index_track_mode_on: false, retouch_cover: null, source: 'default', static_cover_image_path: '', time_marks: null,
    tracks, update_time: 0, version: 360000,
  }
  const meta = {
    cloud_package_completed_time: '', draft_cloud_capcut_purchase_info: '', draft_cloud_last_action_download: false, draft_cloud_materials: [], draft_cloud_purchase_info: '', draft_cloud_template_id: '', draft_cloud_tutorial_info: '', draft_cloud_videocut_purchase_info: '', draft_cover: '', draft_deeplink_url: '',
    draft_enterprise_info: { draft_enterprise_extra: '', draft_enterprise_id: '', draft_enterprise_name: '', enterprise_material: [] }, draft_fold_path: '', draft_id: UP(), draft_is_ai_packaging_used: false, draft_is_ai_shorts: false, draft_is_ai_translate: false, draft_is_article_video_draft: false, draft_is_from_deeplink: 'false', draft_is_invisible: false,
    draft_materials: [0, 1, 2, 3, 6, 7, 8].map(type => ({ type, value: [] })), draft_materials_copied_info: [], draft_name: P.name, draft_new_version: '', draft_removable_storage_device: '', draft_root_path: '', draft_segment_extra_info: [], draft_type: '', tm_draft_cloud_completed: '', tm_draft_cloud_modified: 0, tm_draft_removed: 0, tm_duration: us(P.frames),
  }
  fs.mkdirSync(outDir, { recursive: true })
  const json = JSON.stringify(draft, null, 1)
  // 两个名字各写一份：旧版剪映读 draft_content.json，新版读 draft_info.json
  fs.writeFileSync(path.join(outDir, 'draft_content.json'), json)
  fs.writeFileSync(path.join(outDir, 'draft_info.json'), json)
  fs.writeFileSync(path.join(outDir, 'draft_meta_info.json'), JSON.stringify(meta, null, 1))
  return outDir
}

// 剪映放草稿的目录（装了剪映才有）。找不到返回 null
export function jianyingDraftRoot() {
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const cands = process.platform === 'darwin' ? [path.join(home, 'Movies', 'JianyingPro', 'User Data', 'Projects', 'com.lveditor.draft')]
    : process.platform === 'win32' ? [path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'JianyingPro', 'User Data', 'Projects', 'com.lveditor.draft')] : []
  return cands.find(d => fs.existsSync(d)) || null
}
