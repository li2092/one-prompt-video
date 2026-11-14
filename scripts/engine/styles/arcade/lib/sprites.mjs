// 像素贴图（移植自风格库的 G-街机关卡 lib/sprites.mjs）：全部用字符画定义（'.' 透明），1 格 = 1 像素，画时按格放大。
import { mix } from '../../../core.mjs'
import { PAL, sprite, tint } from './px.mjs'

const K = PAL.ink
// ---------- 主角：小机器人 16×18，朝右 ----------
const BOT_PAL = { K, W: PAL.white, L: '#a8b4cc', V: '#1c2440', C: PAL.cyan, Y: PAL.coin, y: PAL.coinDk, R: PAL.red, O: PAL.orange }
const HEAD = [
  '.........RR.....', '.........K......', '...KKKKKKKKKK...', '..KWWWWWWWWWWK..', '..KWVVVVVVVVWK..',
  '..KWVVVCCVVCCK..', '..KWVVVCCVVCCK..', '..KWVVVVVVVVWK..', '..KLWWWWWWWWLK..', '...KKKKKKKKKK...',
]
const BODY = ['..KKKKKKKKKKKK..', '.KWKLWYYYYWLKWK.', '.KWKLWYyyYWLKWK.', '.KOKLWYYYYWLKOK.', '.KKKLWWWWWWLKKK.', '...KKKKKKKKKK...']
const LEGS = {
  stand: ['...KLLK..KLLK...', '..KKKKK..KKKKK..'],
  walkA: ['..KLLK....KLLK..', '.KKKKK....KKKKK.'],
  walkB: ['....KLLKKLLK....', '...KKKKKKKKKK...'],
  jump: ['..KLLK....KLLK..', '..KKK......KKK..'],
}
const EYES = { hit: ['..KWVVKCCKKCCK..', '..KWVVVVVVVVWK..'] }
// pal 可以换机身色（2P、NPC）
export function bot(pose = 'stand', eyes = 'ok', pal = null) {
  const head = HEAD.slice()
  if (EYES[eyes]) { head[5] = EYES[eyes][0]; head[6] = EYES[eyes][1] }
  return sprite([...head, ...BODY, ...LEGS[pose]], pal ? { ...BOT_PAL, ...pal } : BOT_PAL, `bot:${pose}:${eyes}`)
}
export const BOT_W = 16, BOT_H = 18
export const botShadow = (pose, col) => tint(bot(pose), col, `bots:${pose}`)
export const botFlash = pose => tint(bot(pose, 'hit'), PAL.white, `botw:${pose}`)

// ---------- 装备：贴在机器人身上的小件，位置是相对机器人贴图左上角的格 ----------
export const GEAR = {
  look: { at: [3, -3], rows: ['.KKKK.', 'KYYYYK', 'KKKKKK'], pal: { K, Y: PAL.coin } },
  tool: { at: [14, 7], rows: ['K.K', 'KLK', '.L.', '.L.', '.L.', '.K.'], pal: { K, L: PAL.gray } },
  stop: { at: [10, -4], rows: ['.KKK.', 'KRRRK', 'KWWWK', 'KRRRK', '.KKK.'], pal: { K, R: PAL.red, W: PAL.white } },
  check: { at: [0, 7], rows: ['KKKKK', 'KGGGK', 'KGWGK', 'KWGGK', 'KKKKK'], pal: { K, G: PAL.green, W: PAL.white } },
  shield: { at: [-5, 10], rows: ['KKKKKK', 'KBBBBK', 'KBRRBK', 'KBBBBK', '.KBBK.', '..KK..'], pal: { K, B: PAL.blue, R: PAL.red } },
  log: { at: [11, 13], rows: ['KKKKK', 'KWWWK', 'KKKKK', 'KWWWK', 'KKKKK'], pal: { K, W: PAL.white } },
}
export const GEAR_ORDER = ['look', 'tool', 'stop', 'check', 'shield', 'log']
export const gearImg = id => sprite(GEAR[id].rows, GEAR[id].pal, 'gear:' + id)

// ---------- 大图标（12×12）和小图标 ----------
const ICON = {
  look: ['............', '............', '....KKKK....', '..KKWWWWKK..', '.KWWWKKWWWK.', 'KWWWKCCKWWWK', 'KWWWKCCKWWWK', '.KWWWKKWWWK.', '..KKWWWWKK..', '....KKKK....', '............', '............'],
  tool: ['........KK..', '.......KLLK.', '......KLLK..', '......KLLK.K', '.....KLLLKLK', '....KLLLLLLK', '...KLLLKKKK.', '..KLLLK.....', '.KLLLK......', 'KLLLK.......', 'KLLK........', '.KK.........'],
  stop: ['...KKKKKK...', '..KRRRRRRK..', '.KRRRRRRRRK.', 'KRRRRRRRRRRK', 'KRRRRRRRRRRK', 'KRWWWWWWWWRK', 'KRWWWWWWWWRK', 'KRRRRRRRRRRK', 'KRRRRRRRRRRK', '.KRRRRRRRRK.', '..KRRRRRRK..', '...KKKKKK...'],
  check: ['..KKKKKKKK..', '.KGGGGGGGGK.', 'KGGGGGGGGWGK', 'KGGGGGGGWWGK', 'KGGGGGGWWGGK', 'KGWGGGWWGGGK', 'KGWWGWWGGGGK', 'KGGWWWGGGGGK', 'KGGGWGGGGGGK', '.KGGGGGGGGK.', '..KKKKKKKK..', '............'],
  shield: ['KKKKKKKKKKKK', 'KBBBBBBBBBBK', 'KBBKKKKKKBBK', 'KBKRRRRRRKBK', 'KBKRRWRRRKBK', 'KBKRRRWRRKBK', 'KBKRRRRWRKBK', 'KBBKRRRRKBBK', '.KBBKKKKBBK.', '..KBBBBBBK..', '...KBBBBK...', '....KKKK....'],
  log: ['.KKKKKKKKK..', '.KWWWWWWWKK.', '.KWKKKKKWKWK', '.KWWWWWWWKWK', '.KWKKKKWWKWK', '.KWWWWWWWKWK', '.KWKKKKKWKWK', '.KWWWWWWWKWK', '.KWKKKWWWKWK', '.KWWWWWWWKK.', '.KKKKKKKKK..', '............'],
  heart: ['.KK..KK.', 'KRRKKRRK', 'KRWRRRRK', 'KRRRRRRK', '.KRRRRK.', '..KRRK..', '...KK...'],
  heartE: ['.KK..KK.', 'K..KK..K', 'K......K', 'K......K', '.K....K.', '..K..K..', '...KK...'],
  lock: ['..KKKK..', '.K....K.', '.K....K.', 'KKKKKKKK', 'KYYYYYYK', 'KYYKKYYK', 'KYYYYYYK', 'KKKKKKKK'],
  star: ['...K...', '..KYK..', 'KKKYKKK', 'KYYYYYK', '.KYYYK.', 'KYK.KYK', 'KK...KK'],
}
const ICON_PAL = { K, W: PAL.white, C: PAL.cyan, L: PAL.gray, R: PAL.red, G: PAL.green, B: PAL.blue, O: PAL.orange, Y: PAL.coin, y: PAL.coinDk }
export const icon = (id, pal) => sprite(ICON[id], pal ? { ...ICON_PAL, ...pal } : ICON_PAL, 'icon:' + id)

// ---------- 场景物件 ----------
const COIN_F = [
  ['..KKKK..', '.KYYYYK.', 'KYYWYYyK', 'KYYWYYyK', 'KYYWYYyK', 'KYYWYYyK', 'KYYWYYyK', 'KYYWYYyK', '.KYYYYK.', '..KKKK..'],
  ['..KKK...', '.KYYYK..', '.KYWyK..', '.KYWyK..', '.KYWyK..', '.KYWyK..', '.KYWyK..', '.KYWyK..', '.KYYYK..', '..KKK...'],
  ['...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...', '...KK...'],
  ['...KKK..', '..KYYYK.', '..KyWYK.', '..KyWYK.', '..KyWYK.', '..KyWYK.', '..KyWYK.', '..KyWYK.', '..KYYYK.', '...KKK..'],
]
export const coin = f => sprite(COIN_F[((f % 4) + 4) % 4], { K, Y: PAL.coin, y: PAL.coinDk, W: PAL.coinHi }, 'coin' + (((f % 4) + 4) % 4))

// 地面砖 16×16：菱格，两色菱形相间，菱形左上一道亮边（pal 换色：城市灰、地下石色）
const ARGYLE = Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
  const px = x + 0.5, py = y + 0.5, inner = Math.abs(px - 8) + Math.abs(py - 8) < 8
  const dx = inner ? px - 8 : px - (px < 8 ? 0 : 16), dy = inner ? py - 8 : py - (py < 8 ? 0 : 16), d = Math.abs(dx) + Math.abs(dy)
  return inner && d >= 7 ? 'K' : d >= (inner ? 6 : 7) && dx < 0 && dy < 0 ? 'H' : inner ? 'B' : 'D'
}).join(''))
export const groundTile = (pal = {}) => {
  const B = pal.B || PAL.soil
  return sprite(ARGYLE, { B, D: pal.D || mix(B, PAL.ink, 0.28), H: pal.H || PAL.soilHi, K: pal.K || PAL.soilDk }, 'gt')
}
// 圆角块 8×8（柱子、地下关墙壁）：四角缺一格，左上亮、右下暗、一点高光
export const block8 = (pal = {}) => {
  const B = pal.B || PAL.gray, H = pal.H || mix(B, PAL.white, 0.45)
  return sprite(['.KKKKKK.', 'KHHHHHBK', 'KHWHBBBK', 'KHHBBBDK', 'KHBBBBDK', 'KBBBBBDK', 'KBDDDDDK', '.KKKKKK.'],
    { B, H, D: pal.D || mix(B, PAL.ink, 0.35), W: mix(H, PAL.white, 0.6), K: pal.K || PAL.ink }, 'b8')
}
// 奖杯 16×16：两个把手、杯身左边一道亮、底座
export const trophy = (col = PAL.coin) => sprite([
  '..KKKKKKKKKKKK..', 'yyKWWYYYYYYYyKyy', 'y.KWYYYYYYYYyK.y', 'y.KWYYYYYYYYyK.y', '.yKWYYYYYYYYyKy.', '..KWYYYYYYYYyK..',
  '..KYYYYYYYYyyK..', '...KYYYYYYyyK...', '....KKYYYyKK....', '......KYyK......', '......KYyK......', '.....KYYYyK.....',
  '....KYYYYYyK....', '...KKKKKKKKKK...', '...KBBBBBBBBK...', '...KKKKKKKKKK...'],
{ K, Y: col, y: mix(col, PAL.ink, 0.35), W: mix(col, PAL.white, 0.65), B: '#4c3c6c' }, 'trophy')
// 星光（四角闪）
export const sparkle = f => sprite(f % 2 ? ['..W..', '..W..', 'WWWWW', '..W..', '..W..'] : ['W...W', '.W.W.', '..W..', '.W.W.', 'W...W'], { W: PAL.white }, 'spk' + (f % 2))
