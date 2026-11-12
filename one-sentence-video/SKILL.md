---
name: one-sentence-video
description: 把一句话需求做成带配乐和字幕的 MP4 短视频：讲解、科普、产品介绍、数据播报、知识卡片，20 到 90 秒，横屏或竖屏。只需要填一份 video.json，一条命令出片；不用视频生成模型，Windows、macOS、Linux 通用。Use this whenever the user wants a video made from a sentence, topic, text or data — "做个视频"、"生成一个短视频"、"讲解视频"、"宣传片"、"动画视频"、"make a video / explainer / short clip" — even if they give only a topic. Not for editing existing footage, and not for AI-generated footage.
license: MIT
compatibility: Requires Node.js 18+ and ffmpeg (scripts/setup.mjs checks and helps install). No GPU, no browser.
---

# 一句话视频

用户给一句话，你写一份 `video.json`（每个画面选一种现成版式、填上文字和数字），脚本负责排时间、画画面、配乐、编码、自检。你不用写画图代码，也不用算时间。

下文的 `SKILL` 指本文件所在目录的绝对路径。所有命令在用户的工作目录里跑。

## 五步

### 1. 准备环境（每个工作目录跑一次）

```bash
node "SKILL/scripts/setup.mjs"
```

它检查 Node、画图库、ffmpeg、中文字体，缺的会装或告诉你怎么装。全部 `[通过]` 再往下走。有 `[缺少]` 时把那几行原样告诉用户。

### 2. 把这句话补成一个方案（不反问用户，自己定，最后告诉用户你定了什么）

| 用户没说的 | 默认 |
|---|---|
| 多长 | 30 秒左右，5 到 8 场 |
| 横屏竖屏 | 横屏 `16:9`；提到手机、竖屏、抖音、小红书、视频号用 `9:16` |
| 风格 | 按下面的主题表挑一个最贴内容的 |
| 语言 | 和用户说话的语言一致 |
| 人声 | 不要。默认是字幕加配乐（要人声见 `references/voice.md`） |

### 3. 写 video.json

在工作目录新建一个文件夹（用片名），里面写 `video.json`。照这个样子写（完整例子在 `SKILL/assets/example.video.json`）：

```json
{
  "title": "番茄工作法",
  "theme": "grid",
  "aspect": "16:9",
  "seconds": 30,
  "scenes": [
    { "layout": "title", "title": "番茄工作法", "subtitle": "一次只做一件事", "say": "总是分心？试试番茄工作法。" },
    { "layout": "number", "value": "25", "unit": "分钟", "label": "一个番茄钟的长度", "say": "把时间切成二十五分钟一段。" },
    { "layout": "steps", "title": "怎么做", "items": ["选一件事", "定时 25 分钟", "专心做到铃响", "休息 5 分钟"], "say": "选一件事，定时，做到铃响，然后休息。" },
    { "layout": "end", "title": "现在就定一个 25 分钟", "say": "现在就试一次吧。" }
  ]
}
```

- `seconds` 是全片的目标时长，脚本会按它分配每一场的时间。不写就按字数自动估。
- `say` 是这一场的字幕（有配音时也是配音稿）。每场一句，30 个字以内。

### 4. 校验，出片

```bash
node "SKILL/scripts/make.mjs" 片名/video.json --check    # 先校验，几秒钟
node "SKILL/scripts/make.mjs" 片名/video.json            # 出片
```

- `--check` 报 `[出错]` 时，每一条都写了第几场、哪个字段、正确的写法。照着改，再跑，直到通过。
- 出片后读它打印的报告（也存在 `片名/out/report.txt`）。有 `[问题]` 或 `[注意]` 就改 `video.json` 重跑；最常见的是「字太多」，把那段字缩短。
- 你能看图的话，打开 `片名/out/sheet.jpg`（每场两格的总览图）看一遍：有没有字挤在一起、哪一场太空。

### 5. 告诉用户

说清四件事：成片在哪（`片名/out/片名.mp4`）；你替用户定了什么（时长、画幅、主题）；片子里哪些内容是你补的；画面好不好看、配乐好不好听你没法判断，请用户看一遍。

## 九种版式

每一场选一种。一场只讲一件事。

| layout | 什么时候用 | 字段（* 必填） | 限制 |
|---|---|---|---|
| `title` | 开头 | `title`*、`subtitle`、`kicker`（标题上方的小字） | 标题 12 字以内 |
| `statement` | 一句要让人记住的话 | `text`*、`highlight`（text 里要上色的词） | 24 字以内 |
| `bullets` | 并列的几个要点 | `items`*（2 到 5 条文字）、`title` | 每条 18 字以内 |
| `number` | 一个关键数字 | `value`*、`unit`、`label`、`note` | value 写成 "25"、"80%"、"1,280" |
| `bars` | 比大小 | `items`*（2 到 6 项，每项 `label` 和数字 `value`）、`title`、`unit`、`highlight`（第几根用强调色） | label 8 字以内 |
| `steps` | 先后步骤、流程 | `items`*（2 到 5 步）、`title` | 每步 12 字以内 |
| `compare` | 两样东西对比 | `left`*、`right`*（各有 `title` 和 1 到 4 条 `items`）、`title` | 每条 12 字以内 |
| `quote` | 引用别人的话 | `text`*、`by` | 40 字以内 |
| `end` | 结尾 | `title`*、`subtitle`、`cta`（按钮上的字） | 标题 14 字以内 |

每种版式都可以加 `say`（字幕）和 `seconds`（这一场固定多少秒）。

## 六种主题

| theme | 样子 | 适合 |
|---|---|---|
| `grid` | 米色网格纸、紫色、白卡片 | 讲概念、讲原理（拿不准就用它） |
| `minimal` | 大面积留白、细线、一个蓝点 | 安静克制的品牌片、片头 |
| `pop` | 撞色、放射线、粗黑描边 | 热闹、快节奏、短视频平台 |
| `keynote` | 深色渐变、玻璃卡片、发光 | 新品、重大结论、科技话题 |
| `blueprint` | 蓝图纸、白线、黄色标注 | 讲结构、架构、怎么组装 |
| `whiteboard` | 白板、马克笔、手画的框 | 老师边画边讲，讲流程和因果 |

主题的预览图在 `SKILL/assets/themes.jpg`。同一份 `video.json` 换主题只改 `theme` 一个词。

## 写内容的规矩

1. 第一场用 `title`，最后一场用 `end`。中间至少换三种版式；`bullets` 不连着用两场。
2. 画面上的字是给人扫一眼的，要短。写不下就拆成两场，不要把一场塞满。
3. 不编事实。用户没给的数字、引语、人名、公司名不要写成真的；要举例的数字，在标题里写「示意」。
4. 开头两场内说清这支片子讲什么；结尾落在一句结论或一个行动上。
5. `say` 和画面说同一件事，不要念画面上没有的新内容。

## 要更多的时候

| 需要 | 读 |
|---|---|
| 全部字段、换颜色、换字体、固定某一场的秒数 | `references/video-json.md` |
| 加人声（用户自己的录音或自己的配音命令） | `references/voice.md` |
| 现成版式不够，想自己写某一场的画面代码 | `references/custom-scenes.md` |
| 安装失败、字体方框、ffmpeg 报错 | `references/troubleshooting.md` |
| 用户明确要叙事短片、3D 写实场景、自然风景这类这条生产线做不了的片子 | `references/pipelines.md`（三条参考生产线，要自己写代码，先确认自己做得了） |

这条生产线做不了的：剪辑已有的视频、真人或实拍画面、角色表演的故事片。遇到这类需求如实告诉用户。
