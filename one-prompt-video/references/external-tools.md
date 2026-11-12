# 借助外部工具的三种做法

主生产线只要 Node.js 和 ffmpeg，三条参考生产线再加一个浏览器。下面三种做法要用户的机器上另有软件或账号，换来的是代码画不出来的东西：写实的 3D 质感、真实乐器的音色、自然的人声。

先判断该不该走这里：

- 这是给能力强的模型用的。每一种都要自己写脚本、对着结果反复改；写不了、看不了图的，如实告诉用户做不了。
- 用户的机器上有这样东西才走。没有就先问，不替用户装大软件、不替用户注册账号。
- 每一种都有许可上的条件（各节末尾），片子要对外发布时把条件告诉用户，由用户决定。

| 做法 | 换来什么 | 要什么 | 系统 | 最小工程 |
|---|---|---|---|---|
| Blender 渲染 | 全局光照、真实材质、反射、景深 | 用户装好的 Blender | 三个系统 | `SKILL/assets/external/blender/scene.py` |
| 乐器采样配乐 | 铜管、合唱、竖琴、定音鼓这类真实乐器的音色 | 库乐队（GarageBand）或 Logic，加 Swift 编译器 | 只有 macOS | `SKILL/assets/external/sampler-music/` |
| 豆包语音旁白 | 自然的中文人声，也能念英文、日文 | 用户自己的火山引擎密钥，要联网 | 三个系统 | `SKILL/assets/external/voice/doubao_tts.py` |

三样可以单独用，也可以和主生产线、参考生产线搭着用。最后一节讲怎么拼成一支片。

## 一、Blender：写实的 3D 场景

three.js 那条参考线靠多次采样逼近画质，材质和光照的上限有限。要真实的反射、柔和的间接光、体积雾，用 Blender 的 Cycles 渲染器。

```bash
# 把 scene.py 复制到工作目录再改。blender 换成用户机器上的可执行文件：
#   macOS    /Applications/Blender.app/Contents/MacOS/Blender
#   Windows  "C:\Program Files\Blender Foundation\Blender 4.x\blender.exe"
#   Linux    blender
blender -b -P scene.py -- --out frames --stills 0,2.5,4.9      # 先出三张静帧看
blender -b -P scene.py -- --out frames --samples 64            # 出全片的帧，断了重跑会接着渲

# 帧序列编码成视频（色彩标记要写全）
ffmpeg -framerate 24 -i frames/f%05d.png -i 音轨.wav -c:v libx264 -crf 18 -pix_fmt yuv420p \
  -vf "scale=out_color_matrix=bt709:out_range=tv" -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -shortest out.mp4
```

要守的做法：

1. 场景用脚本搭，不靠手点界面。最小工程就是一份 Python 脚本：清空、建物体、给材质、打光、给镜头打关键帧、逐帧渲。改了什么都在脚本里，能重出。
2. 物体和镜头的位置写成帧号的函数。同一个帧号两次渲出来一样，才能分段渲、单独重渲某几帧。
3. 先出静帧，再量时间，最后才出全片。在 Apple Silicon 笔记本上量到的：最小工程 1280 宽、16 次采样约 2 秒一帧；1920 宽、64 次采样约 14 秒一帧。场景一复杂就差得很远：作者的一支 8 秒小样（1080p、96 次采样、体积云、镜头运动模糊）每帧约 105 秒，192 帧渲了 5 小时 37 分。出全片前把「每帧秒数 × 帧数」告诉用户。
4. 发光体的强度从 2 左右试起。最小工程里试过 6，整个球过曝成一片白。
5. 写实的场景缺细节会显得像模型：表面要有粗糙度的变化，地面要有反射或纹理，大体量旁边要有小东西作参照。
6. 模型和贴图用许可清楚的，逐样记下来源。Poly Haven 的素材是 CC0。

许可：Blender 是 GPL 软件，这里只把它当外部程序调用，不随本技能分发。`scene.py` 是 MIT 许可（和 GPL 兼容）。

## 二、乐器采样配乐（只有 macOS）

技能自带的配乐是程序合成的。要真实乐器的音色，可以用库乐队或 Logic 装在本机的乐器采样：不打开它们的界面，由脚本加载采样、离线渲成 WAV。

```bash
# 把 sampler-music/ 复制到工作目录
swiftc -O gbrender.swift -o gbrender          # 编译一次（要 Xcode 命令行工具）
python3 score_example.py                      # 写出 score.json：每一轨用哪个乐器、每个音在第几秒、多长、多高、多响
./gbrender score.json music.wav               # 渲出来，21.7 秒的示例约 11 秒渲完
```

要守的做法：

1. 配乐和画面用同一张时间表。先定速度（一拍多少秒），把画面每一段的起点换算成第几拍，重音和段落的变化写在这些拍子上。
2. 乐器在 `/Library/Application Support/Logic/Sampler Instruments/` 下面，后缀是 `.exs`。试过 60 个，57 个能加载。加载不了的会报 −10868：弦乐合奏、古筝、琵琶、二胡、Steinway Grand Piano 2、Toy Piano。要用哪个乐器，先单独渲一个音确认它出声。
3. 渲染器默认限速（每渲一秒声音停 0.5 秒，环境变量 `GB_THROTTLE` 可调）。不限速时音一密，后面的音会越来越轻直到没声。
4. 渲完逐轨核对：每一轨单独渲一遍，按小节量电平，确认该响的小节都有声音。机器听不出好不好听，这一步至少能查出丢音。
5. 管弦打击乐（Orchestral Kit）的键位是量出来的：36 大鼓、38 小军鼓、47 定音鼓、49 钹。没有官方的对照表。
6. 某一轨要比 0 dB 更响，渲染器会改用采样器自己的增益，上限 +12 dB。
7. 渲出来的 WAV 要归一响度再用。办法见最后一节。

许可：苹果的库乐队许可协议（读的是 10.4.14 版自带的那份）允许把自带的采样免版税用在自己的视频和音频项目的原创配乐里，并且可以播出和分发；不许把采样单独分发或重新打包成素材库，不许拿去训练 AI 模型。协议里还有一句「不得在 Apple 软件的预期用途之外使用」。这里绕开了库乐队的界面，是否在这句话的范围内，协议没有明说。对外发布之前把这一条告诉用户。

## 三、豆包语音旁白（联网，要密钥）

`voice.md` 讲了怎么接任意一条配音命令。这里给一个接豆包语音（火山引擎的语音合成服务）的现成脚本，只用 Python 标准库。

接进主生产线，在 `video.json` 最外层写：

```json
"tts": { "command": ["python3", "SKILL/assets/external/voice/doubao_tts.py", "--text", "{text}", "--out", "{out}"], "ext": "mp3" }
```

每个有 `say` 的场会合成一段人声，时长按人声定，人声响起时配乐自动压低。跑之前用户要设好环境变量 `VOLC_API_KEY`。密钥不写进 `video.json`，也不写进任何文件。

单独用（给参考生产线、Blender 的片子配旁白）：

```bash
python3 doubao_tts.py --text "做视频，只需要一句话。" --out vo/01.mp3 \
  --voice zh_male_ruyayichen_uranus_bigtts --tone "电影预告片的旁白。低沉、有力、从容。"
python3 doubao_tts.py --text "One prompt in, one video out." --out vo/02.mp3 --lang en
```

- `--voice` 是音色编号。常用的：`zh_female_vv_uranus_bigtts`（女声，默认）、`zh_female_xiaohe_uranus_bigtts`（女声）、`zh_male_ruyayichen_uranus_bigtts`（男声，沉稳）、`zh_male_liufei_uranus_bigtts`（男声）。
- `--tone` 是语气提示，写成一句话。
- `--lang en`、`--lang ja` 指定念外语。实测日语不指定语种会合成失败。
- `--rate` 是语速，−50 到 100。

要守的做法：

1. 一句一个文件。每句的起点跟着画面定，合成完量时长，确认这一句在下一句开始之前念完；念不完就把句子改短，不要靠加快语速硬塞。
2. 句号之间的停顿很长。一句话里要连着念的，用逗号连。实测「Any theme. Any color. Any font.」念了 6.3 秒，改成逗号以后 3.7 秒。
3. 产品名、英文词放在配乐不满的地方念。实测一个英文产品名正好落在全片最响的两小节上，混音以后识别不出来；把这两秒的配乐再压低 6 dB 才过。
4. 混完用语音识别把成片逐句转写一遍，和原稿对。对不上的地方分两种：人声轨单独听就不对（配音念错了，换个说法重新合成），人声轨是对的而成片里不对（被配乐盖住了，压低配乐）。
5. 机器听不出音色和语气合不合适，成片要人听。

许可：用火山引擎的服务要守它的条款，体验额度不许商用，付费调用的授权范围看用户自己的订单。对外发布前让用户自己确认。配音是 AI 合成的，发布时按平台要求声明。

## 拼成一支片

三样东西各出各的，最后用 ffmpeg 合：

1. 画面出成无声的视频。主生产线加 `--no-audio`；参考生产线不给 `--audio`；Blender 出帧序列。
2. 配乐一条 WAV，旁白每句一个文件加一张起点表。
3. 混音：旁白出现时把配乐压低，再把整条音轨归一到目标响度。

```bash
# 每句旁白延迟到它的起点（毫秒），合成一条旁白轨
ffmpeg -i vo/01.mp3 -i vo/02.mp3 -filter_complex \
  "[0:a]aresample=48000,adelay=1000|1000[a];[1:a]aresample=48000,adelay=5900|5900[b];[a][b]amix=inputs=2:normalize=0,highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=4dB,apad=whole_dur=43.2,atrim=0:43.2,aformat=channel_layouts=stereo" vo.wav

# 旁白响起时配乐被压低（侧链压缩），两条合在一起
ffmpeg -i music.wav -i vo.wav -filter_complex \
  "[1:a]asplit[k][v];[0:a][k]sidechaincompress=threshold=0.02:ratio=4:attack=30:release=450[m];[v]volume=8dB[vv];[m][vv]amix=inputs=2:normalize=0" pre.wav

# 量响度，再用「限幅器加固定增益」归一到 -14 LUFS、真峰值 -1.8 dBTP 以内
ffmpeg -i pre.wav -af loudnorm=print_format=json -f null -          # 读出 input_i
# 要加的增益 G = -14 - input_i；限幅器门限 L = min(1, 10^((-1.8 - G) / 20))
ffmpeg -i pre.wav -af "alimiter=limit=L:level=false:attack=5:release=120,volume=GdB" -ar 48000 -c:a pcm_s24le master.wav

# 和画面合在一起
ffmpeg -i 无声画面.mp4 -i master.wav -c:v copy -c:a aac -b:a 256k -aac_pns 0 -shortest 成片.mp4
```

归一不直接用 `loudnorm` 一步做完：线性增益够不到目标时它会改用动态模式，把强弱起伏压平。

没有旁白时去掉前两步，配乐直接量响度、归一。

本技能仓库首页的宣传片是这样拼的：画面用主生产线（三场自己写的画面加现成版式），配乐用第二节的办法，旁白用第三节的办法。
