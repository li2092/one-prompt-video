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
