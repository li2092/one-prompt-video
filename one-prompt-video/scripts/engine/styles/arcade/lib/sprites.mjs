// 像素贴图（移植自风格库的 G-街机关卡 lib/sprites.mjs）：全部用字符画定义（'.' 透明），1 格 = 1 像素，画时按格放大。
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

// 问号块 16×16（used：顶过之后的空块）
export function qblock(state = 'q', fr = 0) {
  const body = state === 'q' ? (fr % 3 === 2 ? PAL.coinDk : PAL.orange) : '#9c4a00'
  const rows = [
    'KKKKKKKKKKKKKKKK', 'KOOOOOOOOOOOOOOK', 'KOdOOOOOOOOOOdOK', 'KOOOOKKKKKOOOOOK', 'KOOOKWWWWWKOOOOK', 'KOOOKWKKKWWKOOOK', 'KOOOOKOOOKWWKOOK',
    'KOOOOOOOOKWWKOOK', 'KOOOOOOKKWWKOOOK', 'KOOOOOOKWWKOOOOK', 'KOOOOOOOKKOOOOOK', 'KOOOOOOKWWKOOOOK', 'KOOOOOOKWWKOOOOK', 'KOdOOOOOKKOOOOdK', 'KOOOOOOOOOOOOOOK', 'KKKKKKKKKKKKKKKK']
  const r2 = state === 'q' ? rows : rows.map((r, j) => (j === 0 || j === 15 ? r : 'K' + (j === 2 || j === 13 ? 'OdOOOOOOOOOOdO' : 'OOOOOOOOOOOOOO') + 'K'))
  return sprite(r2, { K, O: body, d: PAL.ink, W: PAL.white }, `qb:${state}`)
}
// 地面砖 16×16（pal 换色：城堡灰、地下蓝）
export const groundTile = (pal = {}) => sprite([
  'BBBBBBBBBKBBBBBB', 'HBBBBBBBBKHBBBBB', 'HBBBBBBBBKHBBBBB', 'HBBBBBBBBKHBBBBB', 'HBBBBBBBBKHBBBBB', 'HBBBBBBBBKHBBBBB',
  'HBBBBBBBBKHBBBBB', 'KKKKKKKKKKKKKKKK', 'BBBBKHBBBBBBBBBB', 'BBBBKHBBBBBBBBBB', 'BBBBKHBBBBBBBBBB', 'BBBBKHBBBBBBBBBB',
  'BBBBKHBBBBBBBBBB', 'BBBBKHBBBBBBBBBB', 'BBBBKHBBBBBBBBBB', 'KKKKKKKKKKKKKKKK'],
{ B: pal.B || PAL.brick, H: pal.H || PAL.brickHi, K: pal.K || PAL.brickDk }, 'gt')
// 墙砖 8×8（砖块柱、地下关天花板）
export const brick8 = (pal = {}) => sprite(['KKKKKKKK', 'BHHBKBHB', 'BBBBKBBB', 'KKKKKKKK', 'BKBHHBBK', 'BKBBBBBK', 'BKBBBBBK', 'KKKKKKKK'],
  { B: pal.B || PAL.brick, H: pal.H || PAL.brickHi, K: pal.K || PAL.ink }, 'b8')
// 旗子
export const flagImg = (col = PAL.green) => sprite([
  'KKKKKKKKKKKK', 'KFFFFFFFFFFK', 'KFFFFFFFFFK.', 'KFFFFFFFFK..', 'KFFFFFFFK...', 'KFFFFFFK....', 'KFFFFFFFK...', 'KFFFFFFFFK..', 'KKKKKKKKKKK.'],
{ K, F: col }, 'flag')
// 星光（四角闪）
export const sparkle = f => sprite(f % 2 ? ['..W..', '..W..', 'WWWWW', '..W..', '..W..'] : ['W...W', '.W.W.', '..W..', '.W.W.', 'W...W'], { W: PAL.white }, 'spk' + (f % 2))
