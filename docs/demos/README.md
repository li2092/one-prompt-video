# 演示片的源文件

仓库首页那些视频是从这里的文件出的。每个目录一份 `video.json`，`scenes/` 是几场自己写的画面代码，`music/score_gen.py` 是配乐的编曲脚本。

| 目录 | 是什么 |
|---|---|
| `trailer/`、`trailer-en/` | 宣传片的画面（无声出片）。配乐和旁白另做，再合在一起 |
| `overview/`、`how-it-works/`、`small-model/` 和带 `-en` 的 | 只用现成版式的演示片 |
| `intro-zh/`、`intro-en/` | 七场里有一场自己写的画面 |

这些 `video.json` 里有两行依赖外部工具，做法见技能的 `references/external-tools.md`：

- `"tts"`：用豆包语音合成配音，要自己的密钥（环境变量 `VOLC_API_KEY`），并把命令里的 `SKILL` 换成技能目录的绝对路径。
- `"music": "music.wav"`：用库乐队的乐器采样渲出来的配乐，只能在 macOS 上做。先 `make.mjs video.json --sheet` 拿到 `out/timeline.json`，再 `python3 music/score_gen.py out/timeline.json <风格> score.json`，用 `gbrender` 渲成 `music.wav` 放在 `video.json` 旁边。

没有这两样也能出片：把这两行删掉，出来的是技能的默认效果（程序合成的配乐，没有人声）。

宣传片的墙要先生成缩略图：在装了 `@napi-rs/canvas` 的目录里跑 `node trailer/make-stills.mjs`。
