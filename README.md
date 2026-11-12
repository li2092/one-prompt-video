# one-sentence-video

一个 Agent Skill：用户说一句话，模型填一份 `video.json`，一条命令出一支带配乐和字幕的 MP4 短片。

- 不用视频生成模型。每一帧由代码画出来，可以重算、可以改。
- Windows、macOS、Linux 通用。只要 Node.js 18+ 和 ffmpeg，不要显卡，不要浏览器。
- 为能力一般的模型设计：模型只做选择和填空（九种版式、六种主题），排时间、画画面、配乐、编码、自检都由脚本做；`video.json` 写错了，脚本逐条告诉它错在第几场、该怎么写。
- 能力强的模型可以越过版式自己写画面代码，另有三条参考生产线（2D 叙事短片、three.js 场景、全屏着色器自然景）。

![六种主题](one-sentence-video/assets/themes.jpg)

## 安装

技能本体是 `one-sentence-video/` 这个目录（遵循 [Agent Skills](https://agentskills.io) 规范）。把它整个复制到你的 agent 放技能的地方：

| agent | 位置 |
|---|---|
| Claude Code | `~/.claude/skills/one-sentence-video/`，或项目里的 `.claude/skills/one-sentence-video/` |
| Codex | `~/.codex/skills/one-sentence-video/` |
| 其他支持 Agent Skills 的工具 | 按它的文档放 |
| 不支持技能的模型 | 把 `SKILL.md` 的内容贴进对话或系统提示，把其中的 `SKILL` 换成这个目录的绝对路径 |

然后对 agent 说一句话，例如：

```text
做一个 30 秒的视频，讲番茄工作法
给我们的新品做个竖屏短视频：一款降噪耳机，卖点是续航 40 小时、通透模式、199 元
```

## 不经过 agent，直接用

```bash
mkdir my-videos && cd my-videos
node /path/to/one-sentence-video/scripts/setup.mjs        # 检查环境，缺的会装
mkdir demo && cp /path/to/one-sentence-video/assets/example.video.json demo/video.json
node /path/to/one-sentence-video/scripts/make.mjs demo/video.json
# 成片在 demo/out/
```

## 目录

```text
one-sentence-video/
  SKILL.md                 模型读的主说明（约 110 行）
  scripts/setup.mjs        环境检查和安装
  scripts/make.mjs         校验 → 时间线 → 总览图 → 配乐 → 编码 → 自检
  scripts/browser-render.mjs  参考生产线共用的出片脚本
  scripts/engine/          版式、主题、时间线、合成器、编码
  references/              按需读的说明：全部字段、人声、自写画面、参考生产线、排错、许可和出处
  assets/                  示例 video.json、主题预览图、三条参考生产线的最小工程
evals/                     测试题
```

## 现状

- 只在 macOS（Apple Silicon）上实测过。Windows 和 Linux 的代码路径是按文档写的，没有实测。
- 成片的声音（配乐、音效、人声和配乐的比例）只量过响度和峰值，好不好听要人听。
- 默认没有人声。要人声由用户提供录音或自己的配音命令，见 `one-sentence-video/references/voice.md`。

## 许可

MIT。依赖和出处见 `one-sentence-video/references/sources.md`。
