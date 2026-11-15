# 自己画一场

版式只会排字、数字和框。题材里看得见的东西（一样实物、一个过程、一个结构）要你写画面代码画出来，这一场才有内容可看。每支片子都要用到：全片最要紧的那一场必须自己画，一支片子至少两场。

其余的场照常用版式；背景、时间线、配乐、字幕、转场、编码都不用管。

## 先想清楚画什么

- **主体是一样东西。** 一场只画一样：机翼、咖啡豆袋、一张床和一个钟、一条街。它占内容区宽或高的六成以上，摆在中间偏上。
- **用几个形状拼出能认出来的样子。** 先画外轮廓（一条闭合的曲线），再加两三处让人认得出的特征（豆袋的封口和标签、钟的指针、公交车的车窗和轮子）。画完出静帧看，认不出是什么就改形状，不靠写字说明。
- **入场以后还要有东西在动。** 属于内容的东西一直在动：气流在流、蒸汽在升、指针在走、车在开。用 `s.t` 推着它走。不加和内容无关的飘尘、闪光。
- **字写在东西旁边，最多三个词。** 一个词标一样东西（「升力」「襟翼」）。解释交给旁白，画面上不写句子，不写标题。
- **颜色只用主题给的。** `E.theme.c` 里的 `fg`、`accent`、`accent2`、`card`、`muted`，这样换了风格包颜色还是协调的。要深浅用 `E.mix(颜色甲, 颜色乙, 比例)`，要透明用 `E.rgba(颜色, 透明度)`。
- **用当前风格的材质。** 色块用 `E.kit` 画（见下），不直接 `ctx.fill()`；画出来才和这个风格包的其他画面是一种东西。

## 接法

`video.json` 里：

```json
{ "layout": "custom", "module": "scenes/box.mjs", "seconds": 6, "cues": 3, "say": "盒子里是两包当季的豆子，一浅一深。" }
```

- `module`：画面代码的路径，相对 `video.json` 所在目录。
- `seconds`：必填，这一场多长。有配音的片子，这一场的长度会按录音来定。
- `cues`：这一场有几样东西要依次入场（决定入场时刻和音效的个数），不写是 1。
- `data`：随便放什么，代码里从 `s.scene.data` 取。

## 用当前风格的材质画：`E.kit`

直接用 `ctx.fill()` 画出来的是平涂色块，和风格包的画面不是一种东西。`E.kit` 里的函数画出来就是当前风格的材质：纸艺里是带投影、剪口不齐的卡纸，黏土里是有厚度和高光的捏塑，别的风格是带软投影的色块。同一段代码换了风格包不用改。

| 函数 | 画什么 |
|---|---|
| `E.kit.rect(ctx, x, y, w, h, 颜色, { r, lift, seed })` | 一块圆角矩形。`r` 圆角，`lift` 离底面多高（0 是贴着、没有投影），`seed` 让每块的边缘不一样 |
| `E.kit.circle(ctx, cx, cy, r, 颜色, { lift, seed })` | 一块圆 |
| `E.kit.poly(ctx, [[x, y], …], 颜色, { lift, seed })` | 一块任意多边形：盒盖、屋顶、箭头、山 |
| `E.kit.place(ctx, x, y, { s, rot, seed }, g => { … })` | 把一组东西当成一件：以 (x, y) 为原点画，可以整体缩放、旋转，带这个风格的轻微抖动 |
| `E.kit.figure(ctx, x, 脚底的 y, 身高, { mood, wave, look })` | 这个风格的角色（纸艺是纸片小人，黏土是小机器人）。`mood` 是 `'happy'`、`'neutral'`、`'o'`（吃惊），`wave` 挥手，`look` 是 -1 到 1 看向哪边。没有角色的风格什么也不画，返回 `false` |

- 一样东西用三到六块拼：先大块（盒身、杯身、车身），再小块（封口、把手、车窗），后画的盖住先画的。
- 颜色从 `E.theme.c` 取，要深浅用 `E.mix`。
- 一块的宽高不要逐帧变（黏土的块是预先做好的贴图）。要它变大变小，放进 `E.kit.place` 里改 `s`；要它移动，改坐标。
- 细线、虚线、箭头这类线条照常用 `ctx.stroke()` 画。

## 六种手法

每一场自己画的画面，从题材里有什么推出用哪一种。方案里给每一场写一句来由：「因为题材里有某样东西，所以这样画」。写不出来由，说明这一场是在套模板，换一种。

| 手法 | 表达什么 | 题材里有什么才用 | 怎么做 | 什么时候不用 |
|---|---|---|---|---|
| 实物拼装 | 这是个什么东西、里面有什么 | 一件拿得起来的东西：产品、包装、工具 | 用 `E.kit` 的几块拼出来，零件一件一件落到位。示范：`SKILL/assets/scenes/box.mjs` | 题材是抽象概念，没有实物 |
| 流动 | 一样东西怎么经过另一样东西 | 气流、水、数据、人流、钱 | 一排虚线或一串小块沿路径一直走，用 `s.t` 推。示范：`SKILL/assets/scenes/wing.mjs` | 没有先后和方向的并列内容 |
| 生长和堆叠 | 多了多少、涨到哪里 | 数量、金额、进度 | 一摞东西一层一层加高，或一根柱从地面长起来，旁边一个数字跟着走 | 只有一个数、没有比较，用 `number` 版式 |
| 时间走动 | 什么时候、过了多久 | 钟点、日程、期限 | 一个钟的指针走到那个时刻，或一条时间轴上的点依次亮起 | 时间不是这一场的重点 |
| 放大局部 | 关键在这一小处 | 一个大东西上的一个部位 | 先画整体，再把那个部位放大占满画面，其余变淡 | 整体本身就够简单 |
| 角色反应 | 这件事对人意味着什么 | 有使用的人、有前后的感受 | 东西在中间，`E.kit.figure` 的角色在旁边，事情发生后它的表情和动作变了 | 严肃的数据和结论 |

一支片子里自己画的几场用不同的手法。

## 两个完整的例子

拼实物、带角色的，用 `E.kit`（`SKILL/assets/scenes/box.mjs`）：一个打开的盒子，两包豆子依次落进去，旁边的角色在豆子放好以后挥手。

```js
// 实物拼装：一个打开的盒子，里面两包豆子依次放进去，旁边的角色有反应
export default function (ctx, s, E) {
  const { u, kit } = E, c = E.theme.c, box = E.L.box
  const cx = box.x + box.w * 0.44, ground = box.y + box.h * 0.92
  const W = Math.min(box.w * 0.46, box.h * 0.8), H = W * 0.5          // 盒子的宽和高
  const kraft = E.mix(c.line, c.card, 0.35), dark = E.mix(kraft, '#000000', 0.25)     // 颜色从主题的颜色里调，换了风格也协调

  // 1. 盒子的后壁和两片打开的盖子
  E.enter(ctx, s.p(0), cx, ground - H / 2, () => {
    kit.poly(ctx, [[cx - W / 2, ground - H], [cx - W * 0.68, ground - H * 1.42], [cx - W * 0.2, ground - H * 1.3], [cx, ground - H]], kraft, { seed: 11 })
    kit.poly(ctx, [[cx + W / 2, ground - H], [cx + W * 0.68, ground - H * 1.42], [cx + W * 0.2, ground - H * 1.3], [cx, ground - H]], kraft, { seed: 12 })
    kit.rect(ctx, cx - W / 2, ground - H * 1.08, W, H * 0.5, dark, { r: 6 * u, lift: 0, seed: 13 })
  })

  // 2. 两包豆子从上面落进盒子：一包浅、一包深，各有封口和一个圆标
  const bags = [{ x: -0.2, fill: c.accent }, { x: 0.2, fill: c.accent2 }]
  bags.forEach((b, i) => {
    const p = s.p(1 + i)
    if (p <= 0) return
    const bw = W * 0.27, bh = H * 1.05, bx = cx + b.x * W, by = ground - H * 1.02 - (1 - E.ease.out(p)) * H * 1.2
    kit.place(ctx, bx, by, { rot: (i ? 1 : -1) * 0.05, seed: 20 + i }, g => {
      kit.rect(g, -bw / 2, -bh / 2, bw, bh, b.fill, { r: 10 * u, seed: 21 + i })
      kit.rect(g, -bw / 2, -bh / 2, bw, bh * 0.16, E.mix(b.fill, '#000000', 0.22), { r: 6 * u, lift: 0, seed: 23 + i })
      kit.circle(g, 0, -bh * 0.02, bw * 0.24, c.card, { lift: 0.4, seed: 25 + i })
    })
  })

  // 3. 盒子的前壁挡住豆袋的下半截
  E.enter(ctx, s.p(0), cx, ground - H / 2, () => kit.rect(ctx, cx - W / 2, ground - H, W, H, kraft, { r: 8 * u, seed: 14 }))

  // 4. 角色：豆子都放好以后高兴地挥手
  const done = s.p(2) >= 1
  kit.figure(ctx, box.x + box.w * 0.86, ground, box.h * 0.5, { mood: done ? 'happy' : 'neutral', wave: done, look: -1 })
}
```

画线条的（`SKILL/assets/scenes/wing.mjs`）：机翼和气流，气流入场以后一直在流。这种以线为主的画面直接用 `ctx` 画，代码看那个文件。

照这个结构写自己的：先算主体的位置和大小（都从 `E.L.box` 和 `E.u` 算，横屏竖屏才都对），再按前后遮挡的顺序一样一样画。可以把示范文件复制到 `片名/scenes/` 里改。

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
| `E.kit` | 当前风格的材质画法，见上面「用当前风格的材质画」 |
| `E.T` | 全片的时刻（秒） |

## 五条规矩

1. 画面只由时刻决定。不用 `Math.random()`，不读系统时间，不在帧和帧之间存状态；同一个 `s.t` 要永远画出同一张图。
2. 字体只用 `E.font(...)` 给的。自己写字体名，换一台机器中文会变成方框。标注的字号不小于 `44 * u`。
3. 东西都画在 `E.L.box` 里面，不压字幕，不出画面。
4. 写完一场先出静帧看：`node "SKILL/scripts/make.mjs" 片名/video.json --still 12.5`（数字是全片的第几秒，从 `out/timeline.json` 或总览图上找这一场的时刻）。认得出画的是什么、主体够大、没有东西出框，再写下一场。
5. 一场对着图改了两轮还认不出来，就换更简单的画法：只留外轮廓和一两处特征，或者换一样更好画的东西来代表它。不在同一种画法上继续改。
