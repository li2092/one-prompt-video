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
