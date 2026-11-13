# 风格包：一整套自己的画面

内置主题换的是颜色、背景和线条，九种版式的摆法不变。风格包更进一步：它可以把九种版式各按自己的样子重画（聊天界面里每一条要点是一个气泡，街机关卡里柱状图是一摞砖块），还可以换字幕的样子、在最上层加扫描线或角标。用的人不用知道这些，`video.json` 里照样只写 `"theme": "名字"`。

这份说明给要写风格包的人看。写风格包要自己写几百行画面代码，并且对着出来的图反复改；看不了图的不要写。

## 放在哪，怎么用

- 内置的：`SKILL/scripts/engine/styles/<名字>/index.mjs`，`video.json` 里写 `"theme": "<名字>"`。
- 自己为一支片子写的：放在 `video.json` 旁边，`"theme": "./我的风格/index.mjs"`（相对 `video.json` 的路径，以 `.mjs` 结尾）。
- 画法多的时候拆到同目录的 `lib/` 里，由 `index.mjs` 引入。

## 一个风格包长什么样

`index.mjs` 默认导出一个对象。只有 `c` 和 `bg` 必填，其余不写就用默认的。

```js
import { rgba, mix, clamp, lerp, ease, drawLines, roundRect } from '../../core.mjs'      // 自己的风格包从技能目录的绝对路径引
import { content, heading, rolling } from '../../layouts.mjs'

export default {
  name: '街机关卡', mood: '像素游戏，轻松向', bpm: 120,
  c: { bg: '#5c94fc', fg: '#fcfcfc', muted: '#bcbcbc', accent: '#fcd800', accent2: '#e83828', card: '#000000', line: '#fcfcfc', onAccent: '#101018' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'mono',      // sans | serif | hand | mono
  wTitle: 900, wBody: 600, radius: 0,
  motion: 'pop',            // rise | pop | fade | slam | draw：E.enter() 用哪种入场
  transition: 'cut',        // cut | fade | slide；也可以写成函数，自己做转场（见下）
  solidAccent: true,        // 强调色卡片是实心的，上面用 onAccent 色写字
  bg(ctx, E, s) { … },                       // 每一帧先画背景；s.layout 是这一场的版式，s.index 是第几场，背景可以按场换
  layouts: {                                 // 想重画哪种版式就写哪种，没写的用默认摆法
    title(ctx, s, E) { … }, statement, bullets, number, bars, steps, compare, quote, end,
  },
  caption(ctx, s, E) { … },                  // 自己的字幕样式（可选）
  overlay(ctx, E, s) { … },                  // 画在最上层的东西（可选）：扫描线、外框、角标
  card(ctx, E, x, y, w, h, o) { … },         // 默认版式会调用的零件（可选）：卡片、线、柱、标记、标题下划线
  line, bar, mark, underline,
  music: { style: 'drive', prog: ['C', 'G', 'Am', 'F'], lead: 'marimba', drums: true },   // style: calm | ambient | drive | bright；lead: piano | epiano | marimba | pluck
  sfx: { enter: 'pop', cut: 'thud', accent: 'chime' },       // tick click type pop thud chime whoosh swell glitch
  sounds(TL) { return [{ t: 3.2, kind: 'chime', gain: 0.3 }] },   // 自己加的音效（可选）：t 是全片的秒数，TL.scenes[i] 有每场的 t0、dur、cues、layout
}
```

自己做转场：把 `transition` 写成函数，再写 `transitionDur`（秒，默认 0.5）。每一场开头的这段时间里，引擎把上一场和这一场各画成一张整图交给你，`p` 从 0 走到 1：

```js
transitionDur: 0.6,
transition(ctx, A, B, p, E, info) {        // A 上一场，B 这一场，都是和画面一样大的画布；info = { from, to, fromLayout, toLayout }
  const x = E.W * E.ease.inOut(p)
  ctx.drawImage(B, 0, 0)
  ctx.save(); ctx.beginPath(); ctx.rect(x, 0, E.W - x, E.H); ctx.clip(); ctx.drawImage(A, 0, 0); ctx.restore()
}
```

转场期间上一场会以 `s.t` 大于 `s.dur` 继续被画，这一场从 `s.t = 0` 开始画，所以版式的入场动画照常进行。字幕和最上层画在转场之上。

`layouts`、`bg`、`caption`、`overlay` 里的 `this` 都是这个对象本身，颜色用 `this.c` 取（用户可能用 `colors` 换过，所以不要把颜色写死在函数里）。

## 版式函数拿到什么

`layouts.<版式>(ctx, s, E)`：

- `s.scene`：这一场在 `video.json` 里的内容。九种版式各有哪些字段见 `video-json.md`。必填的字段一定有；选填的要判断有没有。
- `s.t`、`s.dur`：这一场已经过了几秒、一共几秒。`s.index`、`s.count`：第几场、共几场。
- `s.cue(i)`：第 i 个元素的入场时刻（这一场内的秒数）。`s.t - s.cue(i)` 就是它入场以后过了多久，落地后的抖动、数字滚动、延迟出现的装饰用它算。
- `s.p(i)`：第 i 个元素的入场进度，0 到 1。脚本给每个元素排了一个入场时刻并配了音效，画面上的元素要按这个进度出现，声音和画面才对得上。各版式的元素个数和顺序：

| 版式 | 元素依次是 |
|---|---|
| `title` | kicker（有的话）、标题、副标题（有的话） |
| `statement` | 整句 |
| `bullets`、`bars`、`steps` | 标题，然后每一项 |
| `number` | 数字、label（有的话）、note（有的话） |
| `compare` | 标题、左边、右边 |
| `quote` | 引语、出处（有的话） |
| `end` | 标题、副标题（有的话）、按钮（有的话） |

工具箱 `E`：

| 名字 | 是什么 |
|---|---|
| `E.W` `E.H` `E.u` `E.portrait` | 画面的宽高；`u` 是缩放单位，所有尺寸写成 `n * E.u`；是不是竖屏 |
| `E.L.box` | 能放内容的区域 `{x, y, w, h}`，四周的边和字幕带已经让开。`content(E)` 返回同一个区域 |
| `E.pick(横屏的值, 竖屏的值)` | 按画幅取值。竖屏要另外摆，不是把横屏缩小 |
| `E.T` `E.total` `E.sceneIndex` `E.sceneCount` | 全片的时刻和总长，当前第几场 |
| `E.fit(文字, { role, weight, size, maxW, maxLines, maxH })` | 排字：放不下就缩字号，再放不下会记进报告。返回 `{ lines, size, lineH, width }`，再用 `drawLines(ctx, f.lines, x, y, f.lineH, 对齐)` 画。画面上所有来自 `video.json` 的字都用它排。只是试排（比较几种字号、几种宽度）时加 `silent: true`，放不下也不记进报告 |
| `E.font(role, 字重, 字号)` | 返回能放进 `ctx.font` 的字符串。`role` 是 `title`、`body`、`num`、`mono`。不要写死字体名：别的机器上没有那个字体 |
| `E.fonts.sans` `.serif` `.hand` `.mono` | 各类字体的名字列表，要绕开 `role` 直接指定时用 |
| `E.enter(ctx, p, cx, cy, fn)` | 按 `motion` 的入场方式画一个元素 |
| `E.createCanvas(w, h)` | 离屏画布：贴图、纹理、要整体变形的图层 |
| `E.once(名字, () => …)` | 只算一次的东西（纸纹、星空、像素贴图）：第一次调用时算，之后直接取 |
| `E.k(t, t0, 时长, 缓动)` `E.inOut(t, t0, t1)` | 0 到 1 的进度；进入再退出 |
| `E.ease.*` | `linear in out inOut back expo sine outExpo inOutExpo outBack outElastic` |
| `E.rng(种子)` `E.hash(a, b)` `E.noise1(x, 种子)` | 种子随机、哈希、平滑噪声 |
| `E.rgba` `E.mix` `E.roundRect` `E.wrapText` `E.spacedText` `E.typeOn` `E.clamp` `E.lerp` | 颜色、圆角矩形、断行、带字距的字、逐字显现 |

`layouts.mjs` 里可以借的：`content(E)`、`heading(ctx, s, E, 标题)`（画一行场标题，返回它下面可用区域的 y）、`rolling(值, 进度)`（数字滚动上去）。

## 要守的

1. 画面只由时刻决定。不用 `Math.random()`、`Date`，不依赖上一帧；随机数从固定种子算。闪烁、抖动按 `E.T` 取整后的值换（每秒换 8 次是 `Math.floor(E.T * 8)`）。
2. 画面上的内容只来自 `s.scene`。风格包不带任何题材的字：装饰性的英文短词可以有（`SCORE`、`LIVE`、`REC`），不能写出像事实的东西（日期、出处、人名、数字）。
3. 九种版式都要能看：没重画的版式用默认摆法，所以 `card`、`bar`、`mark`、`underline` 和颜色要让默认摆法在这个风格里也成立。重画得越多越像这个风格。
4. 横屏和竖屏都要出图看。竖屏另行构图。
5. 字要读得清：正文和背景的明度差要够；花哨的底上给字加描边、硬阴影或垫一块底。
6. 一场里元素多（六条要点、六根柱子、四步）时也要放得下，字多时让 `E.fit` 缩字号，不要出画。
7. 静止的纹理和贴图用 `E.once` 只算一次，否则出片很慢。

## 怎么查

```bash
# 九种版式各出两格的总览图（把 theme 换成要查的风格）
node "SKILL/scripts/make.mjs" 片名/video.json --theme 街机 --sheet
node "SKILL/scripts/make.mjs" 片名/video.json --theme ./我的风格/index.mjs --sheet
node "SKILL/scripts/make.mjs" 片名/video.json --still 12.5        # 原尺寸看一帧
```

准备一份九种版式都有的 `video.json`、一份带 `say`（有字幕）的、一份竖屏的，三份都出总览图逐格看：有没有字出画、压在一起、被装饰挡住；哪一场看不出是这个风格；入场到一半的那一格有没有穿帮。最后出一支完整的片子，自检要全过。
