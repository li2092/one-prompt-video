# video.json 全部字段

## 最外层

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | 是 | 片名，也是输出文件名 |
| `scenes` | 是 | 数组，1 到 20 场，一般 5 到 9 场 |
| `theme` | 否 | `grid`（默认）、`minimal`、`pop`、`keynote`、`blueprint`、`whiteboard`、`chalk`、`neon`、`terminal`、`paper`、`ink`、`bold` |
| `aspect` | 否 | `"16:9"`（默认，1920×1080）、`"9:16"`（1080×1920）、`"1:1"`（1080×1080） |
| `seconds` | 否 | 全片目标时长（8 到 180）。脚本把没写死时长的场按比例拉长或压短去凑；每场的长度会凑成整数拍，所以成片和目标差一两秒是正常的 |
| `colors` | 否 | 覆盖主题色，见下 |
| `font` | 否 | 指定正文字体的名字（要已经装在系统里，或者字体文件放在 `video.json` 旁边的 `fonts/` 目录） |
| `music` | 否 | 不写：用自带的程序合成配乐。写 `false`：不要配乐，出无声片。写一个音频文件的路径（相对 `video.json`，如 `"music.wav"`）：用自己的配乐，脚本把它裁到全片长、片尾淡出，人声响起时压低，元素入场的音效照常加 |
| `fps` | 否 | 24、25、30（默认）、60 |
| `tts` | 否 | 配音命令，见 `voice.md` |

## 每一场共有的

| 字段 | 说明 |
|---|---|
| `layout` | 版式，必填 |
| `say` | 这一场的字幕；有配音时也是配音稿。长句会按标点切成几段轮流显示 |
| `seconds` | 这一场固定多少秒（2 到 30）。不写就自动估 |

## 各版式的字段

```json
{ "layout": "title", "title": "大标题", "subtitle": "副标题", "kicker": "标题上方的小字" }
{ "layout": "statement", "text": "一句要让人记住的话", "highlight": "记住" }
{ "layout": "bullets", "title": "场标题", "items": ["第一条", "第二条", "第三条"] }
{ "layout": "number", "value": "25", "unit": "分钟", "label": "这个数说明什么", "note": "再补一行小字" }
{ "layout": "bars", "title": "场标题", "unit": "%", "highlight": 2, "items": [{ "label": "甲", "value": 40 }, { "label": "乙", "value": 75 }] }
{ "layout": "steps", "title": "场标题", "items": ["第一步", "第二步", "第三步"] }
{ "layout": "compare", "title": "场标题", "left": { "title": "以前", "items": ["……", "……"] }, "right": { "title": "现在", "items": ["……", "……"] } }
{ "layout": "quote", "text": "引用的话", "by": "谁说的" }
{ "layout": "end", "title": "收束的一句话", "subtitle": "补充一行", "cta": "按钮上的字" }
{ "layout": "custom", "module": "scenes/my.mjs", "seconds": 6, "cues": 3, "data": {} }
```

细节：

- `number` 的 `value`：数字会从 0 滚到目标值。可以带前后缀和千分位：`"80%"`、`"¥3.5"`、`"1,280"`。不是数字的（如 `"A+"`）原样显示。
- `bars` 的 `value` 是不带引号的数字，不能是负数。`highlight` 是第几根（从 1 数）用强调色；不写就是最高的那根。
- `statement` 的 `highlight` 要是 `text` 里原样出现的一段。
- `compare` 右边那张卡片是强调色，把想推荐的一方放右边。
- 字太多时脚本会自动缩小字号，缩到下限还放不下会在报告里报「字太多」。

## 换颜色

`colors` 里写哪个就覆盖哪个，值是六位十六进制：

```json
"colors": { "accent": "#e2577a", "bg": "#fffaf0" }
```

| 键 | 用在 |
|---|---|
| `bg` | 背景 |
| `fg` | 主要文字 |
| `muted` | 次要文字、非强调的柱子 |
| `accent` | 强调色：大数字、高亮词、下划线 |
| `accent2` | 第二强调色 |
| `card` | 卡片底色 |
| `line` | 卡片描边 |
| `onAccent` | 实心强调色上面的字 |

## 时间是怎么排的

- 每个主题有自己的速度（72 到 120 拍每分钟）。每场的长度是整数拍，切点落在拍子上，配乐和画面对得齐。
- 没写 `seconds` 的场按字数估：字幕和画面上的字越多，停得越久，3 到 10 秒之间。
- 一场里的元素（标题、每条要点、每根柱子）一个接一个入场，每个入场配一个轻的音效。
- 片尾多留 1.2 秒淡出。
- 出片或出总览图时，时间线会另存一份 `out/timeline.json`（一拍多少秒、每一场从第几秒开始）。自己做配乐时按它来排，配乐才对得上画面。

## 命令

```bash
node "SKILL/scripts/make.mjs" video.json              # 出片
node "SKILL/scripts/make.mjs" video.json --check      # 只校验
node "SKILL/scripts/make.mjs" video.json --sheet      # 只出总览图
node "SKILL/scripts/make.mjs" video.json --still 3.5  # 只出第 3.5 秒的静帧
node "SKILL/scripts/make.mjs" video.json --theme pop  # 临时换主题试一下，不改文件
node "SKILL/scripts/make.mjs" video.json --no-audio   # 无声
node "SKILL/scripts/make.mjs" video.json --out 别的目录
```

退出码：0 成功；1 `video.json` 有错或环境缺东西；2 成片出来了但自检有 `[问题]`。
