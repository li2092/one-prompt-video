# 出了问题怎么办

先跑一遍检查，它会说缺什么：

```bash
node "SKILL/scripts/setup.mjs" --check
```

## 安装

| 现象 | 原因和做法 |
|---|---|
| `npm install` 卡住或失败 | 网络问题。换镜像再试：`npm config set registry https://registry.npmmirror.com` |
| 提示没有装画图库，但明明装过 | 画图库装在跑 `setup.mjs` 的那个目录里。回到那个目录跑命令，或者在当前目录再跑一次 `setup.mjs` |
| Windows 上 `npm` 不是内部或外部命令 | 没装 Node.js，或者装完没重开终端。到 nodejs.org 装 LTS 版，重开终端 |
| Linux 上画图库装上了但加载时报错 | 多半是系统的基础库太旧，换新一些的发行版或用容器（这一条没有实测过） |
| 找不到 ffmpeg | 按提示装。最省事的是 `pip install imageio-ffmpeg`（自带 ffmpeg 程序，不用管理员权限）。已经装了但不在 PATH 里：把环境变量 `FFMPEG` 设成 ffmpeg 可执行文件的完整路径 |
| 报告里说没有 H.264 编码器 | 这份 ffmpeg 是精简版。换一份带 libx264 的：`imageio-ffmpeg` 带的那份有 |

## 画面

| 现象 | 原因和做法 |
|---|---|
| 中文是一个个方框 | 没有中文字体。把任意中文字体文件（.ttf / .otf）放进 `video.json` 旁边的 `fonts/` 目录；Linux 可以 `sudo apt install fonts-noto-cjk` |
| 报告里有「字太多，放不下」 | 把那段字缩短，或者拆成两场 |
| 报告里有「字号被缩到 xx%」 | 能看，但字偏小。缩短一些更好 |
| 白板主题的字不像手写 | 系统里没有楷体或手写体，脚本改用了黑体。不影响出片；想要手写感就往 `fonts/` 里放一个楷体或手写体 |
| 某一场一闪而过 | 这一场字太少，时长按字数估得短。给这一场加 `"seconds": 4` |
| 全片比想要的长或短 | 在最外层写 `"seconds": 30` 定目标时长 |
| 想换颜色 | 最外层加 `"colors": { "accent": "#e2577a" }`，见 `video-json.md` |

## 声音

| 现象 | 原因和做法 |
|---|---|
| 成片没声音 | 看报告的「声音」一行。写了 `"music": false` 或用了 `--no-audio` 就是无声的 |
| 想要人声 | 见 `voice.md` |
| 配音命令失败 | 把报错里那条命令复制到终端单独跑，看它自己报什么错 |

## 各系统要注意的

- Windows：路径有空格时加英文双引号。PowerShell 和 cmd 都能跑这些命令。控制台里中文乱码不影响出片，报告文件 `out/report.txt` 是 UTF-8 的，用编辑器打开看。
- macOS：系统自带中文字体，一般不用另装。
- Linux 服务器：通常没有中文字体，也没有 ffmpeg，两样都要装。不需要显示器和显卡。

## 还是不行

把 `setup.mjs --check` 的输出、出错的那条命令和它打印的全部内容原样给用户看，不要猜。
