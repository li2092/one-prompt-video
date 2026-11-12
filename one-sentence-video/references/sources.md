# 依赖、许可和出处

## 运行时用到的

| 东西 | 许可 | 怎么用 |
|---|---|---|
| Node.js 18+ | MIT 等 | 运行所有脚本 |
| @napi-rs/canvas | MIT | 画每一帧。`setup.mjs` 用 npm 装在工作目录 |
| ffmpeg | LGPL 或 GPL，看是哪一份 | 只当独立程序调用（混音、编码），不链接、不随本技能分发 |
| imageio-ffmpeg（可选） | BSD-2-Clause，自带一份 ffmpeg 程序 | 找不到 ffmpeg 时的一种装法 |
| Playwright（可选） | Apache-2.0 | 只有参考生产线用，主生产线不需要 |
| three.js（可选） | MIT | 只有 three.js 参考线用 |

本技能不带字体、音频、图片素材和视频样片。画面全部由代码画出来，配乐和音效由 `scripts/engine/synth.mjs` 程序合成。成片用的是用户机器上的字体，字体的许可由用户负责；需要开源字体可以用 Noto Sans SC / 思源黑体（SIL OFL 1.1）。

## 做法的出处

本技能的代码是自己写的。下面这些公开项目的做法给了启发，只借做法，没有搬代码：

| 做法 | 出处 |
|---|---|
| 画面只由时刻决定、种子随机、播放页带 `?t=` 参数 | hand-drawn-canvas-animation（MIT）、awesome-opus5.5-frontend-showcases（MIT）里的全代码短片 |
| 拍子网格和帧的换算、切点落在拍子上、配乐和画面用同一张时间表 | animate（MIT） |
| 画面事件登记成表、音效从表里取时刻；页面不请求外部地址 | javascript-animation-skills（MIT） |
| 手绘抖动每秒换 7 到 8 次 | hand-drawn-canvas-animation（MIT） |
| three.js 里用程序生成的表面和多次采样累加出画质 | 一个公开的单文件 three.js 作品的源码 |

## 没有收进来的

- 用乐器采样库出配乐的办法只在 macOS 上可行（依赖系统里装的采样），而且采样的使用条款各不相同，没有放进这个三系统通用的技能。
- 任何配音服务。要人声见 `voice.md`，由用户自己提供。
- 视频生成模型。本技能的每一帧都是代码算出来的，可以重算、可以改。
