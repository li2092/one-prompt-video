# 自己写一场的画面

现成的九种版式不够用时，某一场可以换成自己写的画面代码。其余的场照常用版式；时间线、配乐、字幕、编码都不用管。

写之前先想清楚：现成版式真的放不下吗？自己写的画面要自己负责排版，出错的机会多。能力一般的模型不建议走这条路。

## 接法

`video.json` 里：

```json
{ "layout": "custom", "module": "scenes/orbit.mjs", "seconds": 6, "cues": 3, "say": "字幕照常写", "data": { "label": "任意数据" } }
```

- `module`：画面代码的路径，相对 `video.json` 所在目录。
- `seconds`：必填，这一场多长。
- `cues`：这一场有几个要依次入场的元素（决定入场时刻和音效的个数），不写是 1。
- `data`：随便放什么，代码里从 `s.scene.data` 取。

## 代码

文件默认导出一个函数，每一帧被调用一次：

```js
// scenes/orbit.mjs
export default function (ctx, s, E) {
  const { W, H, u, theme } = E
  const cx = W / 2, cy = (E.safe.t + H - E.safe.b) / 2
  // 三个圆依次入场
  for (let i = 0; i < 3; i++) {
    const p = s.p(i)                       // 第 i 个元素的入场进度，0 到 1
    E.enter(ctx, p, cx, cy, () => {        // 按主题的入场方式（上移、弹出、淡入……）画
      ctx.beginPath()
      ctx.arc(cx + (i - 1) * 320 * u, cy, 110 * u, 0, Math.PI * 2)
      ctx.fillStyle = i === 1 ? theme.c.accent : theme.c.muted
      ctx.fill()
    })
  }
  // 一行字：E.fit 负责折行和缩字号
  const f = E.fit(s.scene.data.label, { role: 'body', weight: 600, size: 56 * u, maxW: W * 0.7, maxLines: 2 })
  ctx.fillStyle = theme.c.fg
  ctx.font = E.font('body', 600, f.size)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  f.lines.forEach((line, k) => ctx.fillText(line, cx, cy + 220 * u + k * f.lineH))
}
```

`ctx` 是标准的 Canvas 2D 上下文，背景已经由主题画好，字幕由引擎在你之后画。

## 拿到的东西

| 名字 | 是什么 |
|---|---|
| `s.t` | 这一场已经过了多少秒 |
| `s.dur` | 这一场总共多少秒 |
| `s.p(i)` | 第 i 个元素的入场进度（0 到 1）；`s.cue(i)` 是它的入场时刻（秒） |
| `s.scene` | `video.json` 里这一场的整个对象 |
| `E.W`、`E.H` | 画布的宽和高（像素） |
| `E.u` | 缩放单位。所有尺寸写成「数字 × u」，横屏竖屏、不同分辨率才都对 |
| `E.portrait` | 是不是竖屏 |
| `E.safe` | 安全边距 `{ l, r, t, b }`。内容画在边距以内；下边距已经给字幕留了位置 |
| `E.theme.c` | 主题色：`bg`、`fg`、`muted`、`accent`、`accent2`、`card`、`line`、`onAccent` |
| `E.theme.card(ctx, E, x, y, w, h, { tone })` | 画一张主题样式的卡片；`tone: 'accent'` 是强调色 |
| `E.theme.line(ctx, E, x1, y1, x2, y2, { p, color, width })` | 画一条主题样式的线，`p` 是画出来的进度 |
| `E.theme.bar(ctx, E, x, y, w, h, { color })` | 画一根主题样式的柱子 |
| `E.font(role, weight, size)` | 得到 `ctx.font` 字符串。`role` 是 `'title'`、`'body'`、`'num'`、`'mono'` |
| `E.fit(text, { role, weight, size, maxW, maxLines })` | 把一段字排进给定的宽度，返回 `{ size, lines, lineH, width }` |
| `E.enter(ctx, p, cx, cy, fn)` | 按主题的入场方式执行 `fn` 里的绘制 |
| `E.T` | 全片的时刻（秒） |

## 三条规矩

1. 画面只由时刻决定。不用 `Math.random()`，不读系统时间，不在帧和帧之间存状态；同一个 `s.t` 要永远画出同一张图。要随机就用固定的数算（比如 `Math.sin(i * 12.9898) * 43758.5453` 取小数部分）。
2. 字体只用 `E.font(...)` 给的。自己写字体名，换一台机器中文会变成方框。
3. 改完先出静帧看：`node "SKILL/scripts/make.mjs" video.json --still 12.5`，再出总览图，最后才出全片。
