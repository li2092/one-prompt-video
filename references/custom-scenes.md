# 自己画一场

版式只会排字、数字和框。题材里看得见的东西（一样实物、一个过程、一个结构）要你写画面代码画出来，这一场才有内容可看。每支片子都要用到：全片最要紧的那一场必须自己画，一支片子至少两场。

其余的场照常用版式；背景、时间线、配乐、字幕、转场、编码都不用管。

## 先想清楚画什么

- **主体是一样东西。** 一场只画一样：机翼、咖啡豆袋、一张床和一个钟、一条街。它占内容区宽或高的六成以上，摆在中间偏上。
- **用几个形状拼出能认出来的样子。** 先画外轮廓（一条闭合的曲线），再加两三处让人认得出的特征（豆袋的封口和标签、钟的指针、公交车的车窗和轮子）。画完出静帧看，认不出是什么就改形状，不靠写字说明。
- **入场以后还要有东西在动。** 属于内容的东西一直在动：气流在流、蒸汽在升、指针在走、车在开。用 `s.t` 推着它走。不加和内容无关的飘尘、闪光。
- **字写在东西旁边，最多三个词。** 一个词标一样东西（「升力」「襟翼」）。解释交给旁白，画面上不写句子，不写标题。
- **颜色只用主题给的。** `E.theme.c` 里的 `fg`、`accent`、`accent2`、`card`、`muted`，这样换了风格包颜色还是协调的。要深浅用 `E.mix(颜色甲, 颜色乙, 比例)`，要透明用 `E.rgba(颜色, 透明度)`。
- **有一点立体感。** 主体下面加一层投影（`ctx.shadowColor`、`shadowBlur`、`shadowOffsetY`），轮廓用 `fg` 描一圈粗线。

## 接法

`video.json` 里：

```json
{ "layout": "custom", "module": "scenes/wing.mjs", "seconds": 7, "cues": 3, "say": "机翼把空气往下推，空气就把机翼往上托。", "data": { "label": "升力" } }
```

- `module`：画面代码的路径，相对 `video.json` 所在目录。
- `seconds`：必填，这一场多长。有配音的片子，这一场的长度会按录音来定。
- `cues`：这一场有几样东西要依次入场（决定入场时刻和音效的个数），不写是 1。
- `data`：随便放什么，代码里从 `s.scene.data` 取。

## 一个完整的例子

机翼和气流。三样东西依次入场：气流、机翼、升力箭头；入场以后气流一直在流，箭头轻轻起伏。

```js
// 机翼和气流：气流从左往右流，过了机翼向下偏；机翼受到向上的力
export default function (ctx, s, E) {
  const { W, H, u, theme } = E, c = theme.c
  const box = E.L.box, cx = box.x + box.w / 2, cy = box.y + box.h * 0.6
  const span = Math.min(box.w * 0.62, box.h * 1.2)          // 主体：机翼占内容区宽度的六成

  // 1. 气流：一排流线，虚线一直往右流（用 s.t 推着走，入场以后也不停）
  const pFlow = s.p(0)
  ctx.lineWidth = 5 * u; ctx.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const y0 = cy + (i - 4) * span * 0.085
    ctx.beginPath()
    for (let k = 0; k <= 60; k++) {
      const x = box.x + box.w * k / 60 * pFlow
      const d = (x - cx) / span                             // 离机翼中心多远
      const near = Math.exp(-Math.pow((y0 - cy) / (span * 0.28), 2))
      const lift = -Math.exp(-d * d * 9) * span * 0.07 * near * (y0 < cy ? 1.25 : 0.35)   // 绕过机翼时抬起
      const down = E.clamp((d - 0.1) / 0.8) * span * 0.17 * near                        // 过了机翼向下偏
      const y = y0 + lift + down
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.strokeStyle = E.rgba(c.accent2 || c.muted, 0.75)
    ctx.setLineDash([34 * u, 26 * u]); ctx.lineDashOffset = -s.t * 260 * u
    ctx.stroke()
  }
  ctx.setLineDash([])

  // 2. 机翼剖面：前缘圆、后缘尖，上表面鼓、下表面平；微微抬头
  E.enter(ctx, s.p(1), cx, cy, () => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.1)
    const a = span / 2
    ctx.beginPath()
    ctx.moveTo(-a, 0)
    ctx.bezierCurveTo(-a, -a * 0.34, -a * 0.2, -a * 0.36, a, 0)      // 上表面
    ctx.bezierCurveTo(a * 0.2, a * 0.05, -a * 0.9, a * 0.12, -a, 0)  // 下表面
    ctx.closePath()
    ctx.shadowColor = E.rgba('#000000', 0.28); ctx.shadowBlur = 30 * u; ctx.shadowOffsetY = 16 * u
    ctx.fillStyle = c.card; ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.lineWidth = 7 * u; ctx.strokeStyle = c.fg; ctx.stroke()
    ctx.restore()
  })

  // 3. 升力：一支向上的箭头，带一个词。字写在东西旁边，只留一个词
  const pUp = s.p(2)
  if (pUp > 0) {
    const x = cx - span * 0.08, y1 = cy - span * 0.16
    const len = Math.min(span * 0.3, y1 - box.y - 70 * u) * E.ease.out(pUp), bob = Math.sin(s.t * 3) * 6 * u
    ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 16 * u
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y1 - len + bob); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x - 34 * u, y1 - len + bob); ctx.lineTo(x + 34 * u, y1 - len + bob); ctx.lineTo(x, y1 - len - 48 * u + bob); ctx.closePath(); ctx.fill()
    ctx.globalAlpha = pUp
    ctx.font = E.font('title', 800, 64 * u); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(s.scene.data?.label ?? '升力', x + 56 * u, y1 - len * 0.6)
    ctx.globalAlpha = 1
  }
}
```

照这个结构写自己的：先算主体的位置和大小（都从 `E.L.box` 和 `E.u` 算，横屏竖屏才都对），再按入场顺序一样一样画。

## 拿到的东西

文件默认导出一个函数 `(ctx, s, E)`，每一帧被调用一次。`ctx` 是标准的 Canvas 2D 上下文；背景已经由风格包或主题画好，字幕由引擎在你之后画。

| 名字 | 是什么 |
|---|---|
| `s.t` | 这一场已经过了多少秒 |
| `s.dur` | 这一场总共多少秒 |
| `s.p(i)` | 第 i 样东西的入场进度（0 到 1）；`s.cue(i)` 是它的入场时刻（秒） |
| `s.scene` | `video.json` 里这一场的整个对象 |
| `E.W`、`E.H` | 画布的宽和高（像素） |
| `E.u` | 缩放单位。所有尺寸写成「数字 × u」，横屏竖屏、不同分辨率才都对 |
| `E.portrait` | 是不是竖屏 |
| `E.L.box` | 内容区 `{ x, y, w, h }`：已经让开了四周的边和下面的字幕。主体画在它里面 |
| `E.theme.c` | 颜色：`bg`、`fg`、`muted`、`accent`、`accent2`、`card`、`line`、`onAccent` |
| `E.theme.card(ctx, E, x, y, w, h, { tone })` | 画一张当前风格的卡片；`tone: 'accent'` 是强调色 |
| `E.theme.line(ctx, E, x1, y1, x2, y2, { p, color, width })` | 画一条当前风格的线，`p` 是画出来的进度 |
| `E.theme.bar(ctx, E, x, y, w, h, { color })` | 画一根当前风格的柱子 |
| `E.font(role, weight, size)` | 得到 `ctx.font` 字符串。`role` 是 `'title'`、`'body'`、`'num'`、`'mono'` |
| `E.fit(text, { role, weight, size, maxW, maxLines })` | 把一段字排进给定的宽度，返回 `{ size, lines, lineH, width }` |
| `E.enter(ctx, p, cx, cy, fn)` | 按当前风格的入场方式执行 `fn` 里的绘制 |
| `E.ease.out(p)`、`E.ease.inOut(p)`、`E.clamp(x)`、`E.lerp(a, b, p)` | 缓动、夹到 0 到 1、插值 |
| `E.mix(c1, c2, p)`、`E.rgba(c, a)`、`E.roundRect(ctx, x, y, w, h, r)` | 混色、带透明度的颜色、圆角矩形的路径 |
| `E.hash(a, b)`、`E.noise1(x)` | 固定的伪随机数和平滑噪声（不用 `Math.random()`） |
| `E.T` | 全片的时刻（秒） |

## 四条规矩

1. 画面只由时刻决定。不用 `Math.random()`，不读系统时间，不在帧和帧之间存状态；同一个 `s.t` 要永远画出同一张图。
2. 字体只用 `E.font(...)` 给的。自己写字体名，换一台机器中文会变成方框。标注的字号不小于 `44 * u`。
3. 东西都画在 `E.L.box` 里面，不压字幕，不出画面。
4. 写完一场先出静帧看：`node "SKILL/scripts/make.mjs" 片名/video.json --still 12.5`（数字是全片的第几秒，从 `out/timeline.json` 或总览图上找这一场的时刻）。认得出画的是什么、主体够大、没有东西出框，再写下一场。
