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
| Blender（可选） | GPL | 只有 `external-tools.md` 的 Blender 做法用。当外部程序调用，不随本技能分发；用户自己装 |
| 库乐队或 Logic 的乐器采样（可选，只有 macOS） | 苹果的软件许可协议 | 只有 `external-tools.md` 的采样配乐做法用。采样不随本技能分发，用的是用户机器上装的那份 |
| 豆包语音（可选） | 火山引擎服务条款 | 只有 `external-tools.md` 的旁白做法用。联网调用，密钥由用户提供 |

本技能不带字体、音频、图片素材和视频样片。主生产线的画面全部由代码画出来，配乐和音效由 `scripts/engine/synth.mjs` 程序合成。成片用的是用户机器上的字体，字体的许可由用户负责；需要开源字体可以用 Noto Sans SC / 思源黑体（SIL OFL 1.1）。

## 做法的出处

本技能的代码由作者（JiMiL、vivhuang）编写，其中合成器和全屏着色器的管道来自作者自己更早的工程。`scripts/engine/styles/` 下的风格包移植自一套由JiMiL 指挥 Claude Opus 5.5 设计的风格库。下面这些公开项目的做法给了启发，只借做法，没有搬代码：

| 做法 | 出处 |
|---|---|
| 画面只由时刻决定、种子随机、播放页带 `?t=` 参数 | hand-drawn-canvas-animation（MIT）、awesome-opus5.5-frontend-showcases（MIT）里的全代码短片 |
| 拍子网格和帧的换算、切点落在拍子上、配乐和画面用同一张时间表 | animate（MIT） |
| 画面事件登记成表、音效从表里取时刻；页面不请求外部地址 | javascript-animation-skills（MIT） |
| 手绘抖动每秒换 7 到 8 次 | hand-drawn-canvas-animation（MIT） |
| three.js 里用程序生成的表面和多次采样累加出画质 | 一个公开的单文件 three.js 作品的源码 |

## 参考的网站和项目

| 名字 | 地址 | 参考了什么 |
|---|---|---|
| 纯代码作品合集（awesome-opus5.5-frontend-showcases，MIT） | 网站 <https://openvglab.github.io/awesome-opus5.5-frontend-showcases/>，仓库 <https://github.com/OpenVGLab/awesome-opus5.5-frontend-showcases> | 自由画面短片这条路线的对标。中秋专题的两支全代码短片《月圆》《月宫小剧场》给出了画面的水准（层次、主光源、媒材的质感、画面里的字很少）、分镜脚本的写法和「转场在画面里要有来由」；它展示的类型（矢量插画场景、角色小动画、体素世界、像素画面、模拟和可视化、图解）是本技能风格范围的参照 |
| hand-drawn-canvas-animation（MIT） | <https://github.com/alesha-pro/tools/tree/main/skills/hand-drawn-canvas-animation> | 手绘短片的流程：先完成一个代表镜头再铺开，快动作出连续帧条，抖动每秒换几次 |
| animate（MIT） | <https://github.com/cth9191/animate> | 拍子网格和帧的换算、切点落在拍子上、每秒一格的总览图 |
| javascript-animation-skills（MIT） | <https://github.com/iart-ai/javascript-animation-skills> | 画面事件登记成表、模板的值只是起点、检查没有加载外部资源 |

对这些网站和项目只参考做法和水准，不搬它们的画面、题材、文案和代码。

## 借助外部工具的部分

主生产线不依赖下面这些。它们放在 `external-tools.md`，给能力强的模型在用户机器上有相应软件或账号时用，各自的许可条件写在那一页每一节的末尾：

- Blender 渲染写实的 3D 场景（三个系统）。
- 用库乐队或 Logic 装在本机的乐器采样出配乐（只有 macOS）。
- 用豆包语音合成旁白（联网，密钥由用户提供）。

## 没有收进来的

- 视频生成模型。本技能的画面都是代码算出来的，可以重算、可以改。
