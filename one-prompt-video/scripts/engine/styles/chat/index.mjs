// 风格包 chat：聊天界面。深靛色底上一部原创聊天界面的手机，九种版式各用一种消息来承载内容；
// 横屏手机居中、两侧放大关键词，竖屏手机几乎占满、底部是关键词区。字幕做成「语音转文字」卡。
// 移植自风格库的 W-聊天界面（lib/ui、chat、style 的画法），题材和写死的文案都已去掉，画面上的字只来自 s.scene。
import { formatNumber, decimalsOf } from '../../core.mjs'
import { rolling } from '../../layouts.mjs'
import { pal, kk } from './lib/ui.mjs'
import { drawBg, drawStatus, drawCap, phoneRing } from './lib/phone.mjs'
import { chat, since } from './lib/chat.mjs'
import { echo } from './lib/echo.mjs'

const seq = (s, list, from) => list.map((text, i) => ({ text, q: s.p(from + i) }))

export default {
  name: '聊天界面', mood: '手机里的一段聊天记录：口语化讲解、案例、对话式问答', bpm: 112,
  c: { bg: '#20233a', fg: '#f7f1e6', muted: '#aaa6c6', accent: '#7c5cff', accent2: '#ffd9b5', card: '#ffffff', line: '#e2ded6', onAccent: '#ffffff' },
  fontTitle: 'sans', fontBody: 'sans', fontNum: 'sans', wTitle: 800, wBody: 400, radius: 20,
  motion: 'pop', transition: 'fade', solidAccent: true,
  bg(ctx, E) { drawBg(ctx, E, this.c) },
  caption(ctx, s, E) { drawCap(ctx, s, E, this.c) },
  overlay(ctx, E) { drawStatus(ctx, E, this.c) },

  layouts: {
    // 片头：群聊名片。kicker 是一条系统提示，标题和副标题在名片上
    title(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      let i = 0
      const kEl = sc.kicker ? i++ : -1, tEl = i++, sEl = sc.subtitle ? i++ : -1
      const msgs = []
      if (sc.kicker) msgs.push({ kind: 'sys', who: 'sys', text: sc.kicker, el: kEl })
      msgs.push({ kind: 'profile', who: 'center', title: sc.title, sub: sc.subtitle, el: tEl, subEl: sEl, last: i - 1 })
      chat(ctx, s, E, C, { name: sc.title, nameEl: tEl, group: true, msgs, bias: 0.45 })
      echo(ctx, s, E, C, {
        L: [sc.kicker && { text: sc.kicker, q: s.p(kEl), size: 48, color: C.accL, w: 700 }, { text: sc.title, q: s.p(tEl), size: 108, lines: 3 }],
        R: [sc.subtitle && { text: sc.subtitle, q: s.p(sEl), size: 66, color: C.sideSub, w: 800, lines: 3 }],
        K: { text: sc.title, q: s.p(tEl) },
      })
    },

    // 一句话：一条置顶的大字消息，高亮词垫强调色
    statement(ctx, s, E) {
      const C = pal(this.c), sc = s.scene, hl = sc.highlight && String(sc.text).includes(sc.highlight) ? String(sc.highlight) : ''
      chat(ctx, s, E, C, { msgs: [{ kind: 'big', who: 'a', text: sc.text, hl, el: 0 }], pin: { text: sc.text, q: kk(since(s, 0), 1.1, 0.4) }, bias: 0.4 })
      echo(ctx, s, E, C, {
        L: [hl && { text: hl, q: s.p(0), size: 120, color: C.accL, lines: 3 }],
        K: hl ? { text: hl, q: s.p(0), kc: C.accent } : null,
      })
    },

    // 要点：一条一条发出来的气泡
    bullets(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      chat(ctx, s, E, C, { name: sc.title, nameEl: 0, group: true, msgs: sc.items.map((text, i) => ({ kind: 'text', who: 'a', text, el: i + 1 })) })
      const cur = { seq: seq(s, sc.items, 1), size: 84, lines: 3, dots: true }
      echo(ctx, s, E, C, { L: [sc.title && { text: sc.title, q: s.p(0), size: 92, lines: 3 }], R: [cur], K: cur })
    },

    // 大数字：一张数字卡片消息，note 是跟在后面的一条小字
    number(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      let i = 1
      const lEl = sc.label ? i++ : -1, nEl = sc.note ? i++ : -1
      const msgs = [{ kind: 'num', who: 'a', value: sc.value, unit: sc.unit, label: sc.label, el: 0, labelEl: lEl, last: Math.max(0, lEl) }]
      if (sc.note) msgs.push({ kind: 'text', who: 'a', text: sc.note, muted: true, size: 28, el: nEl })
      chat(ctx, s, E, C, { msgs })
      const big = rolling(sc.value, Math.min(1, Math.max(0, since(s, 0)) / Math.min(1.4, s.dur * 0.35))) + (sc.unit || '')
      echo(ctx, s, E, C, {
        L: [sc.label && { text: sc.label, q: s.p(lEl), size: 70, lines: 3 }],
        R: [{ text: big, q: s.p(0), size: 190, lines: 1, color: C.accL }],
        K: { text: String(sc.value) + (sc.unit || ''), q: s.p(0), kc: C.accent },
      })
    },

    // 柱状图：一张投票式的图表卡片，每项一条横槽
    bars(ctx, s, E) {
      const C = pal(this.c), sc = s.scene, vals = sc.items.map(it => Number(it.value))
      const hi = sc.highlight != null ? Number(sc.highlight) - 1 : vals.indexOf(Math.max(...vals)), dec = Math.max(...sc.items.map(it => decimalsOf(it.value)))
      chat(ctx, s, E, C, { name: sc.title, nameEl: 0, group: true, msgs: [{ kind: 'poll', who: 'a', title: sc.title, items: sc.items, unit: sc.unit, highlight: sc.highlight, el: 0, last: sc.items.length }] })
      const n = sc.items.length, fmt = i => formatNumber(vals[i], dec) + (sc.unit || ''), val = formatNumber(vals[hi] * Math.min(1, s.p(hi + 1)), dec) + (sc.unit || '')
      // 竖屏关键词区：柱子一根根长出来时放大当前这一根，全部到齐后停在强调的那一根上
      const cur = sc.items.map((it, i) => ({ text: `${it.label}  ${fmt(i)}`, q: s.p(i + 1), kc: i === hi ? C.accent : C.ink }))
      if (hi !== n - 1) cur.push({ text: `${sc.items[hi].label}  ${fmt(hi)}`, q: kk(since(s, n), 0.5, 0.36), kc: C.accent })
      echo(ctx, s, E, C, {
        L: [sc.title && { text: sc.title, q: s.p(0), size: 88, lines: 3 }],
        R: [{ text: sc.items[hi].label, q: s.p(hi + 1), size: 60, color: C.sideSub, w: 700 }, { text: val, q: s.p(hi + 1), size: 170, lines: 1, color: C.accL }],
        K: { seq: cur },
      })
    },

    // 步骤：一张带序号的清单卡，一步一步点亮
    steps(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      chat(ctx, s, E, C, { name: sc.title, nameEl: 0, group: true, msgs: [{ kind: 'check', who: 'a', title: sc.title, items: sc.items, el: 0, last: sc.items.length }] })
      const cur = { seq: seq(s, sc.items.map((it, i) => `${i + 1}. ${it}`), 1), size: 84, lines: 3, dots: true }
      echo(ctx, s, E, C, { L: [sc.title && { text: sc.title, q: s.p(0), size: 92, lines: 3 }], R: [cur], K: cur })
    },

    // 对比：两个人各说各的，左边是对方，右边是自己（推荐的一方）
    compare(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      chat(ctx, s, E, C, {
        name: sc.title, nameEl: 0, group: true,
        msgs: [{ kind: 'side', who: 'a', title: sc.left.title, items: sc.left.items, el: 1 }, { kind: 'side', who: 'me', title: sc.right.title, items: sc.right.items, el: 2 }],
      })
      echo(ctx, s, E, C, {
        L: [{ text: sc.left.title, q: s.p(1), size: 84, lines: 3, color: C.sideSub }],
        R: [{ text: sc.right.title, q: s.p(2), size: 84, lines: 3, color: C.accL }],
        K: { seq: [{ text: sc.left.title, q: s.p(1) }, { text: sc.right.title, q: s.p(2) }].map((x, i) => ({ ...x, kc: i ? C.accent : C.ink })) },
      })
    },

    // 引语：一条语音消息加转文字，出处是发送者
    quote(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      chat(ctx, s, E, C, { name: sc.by, nameEl: 1, msgs: [{ kind: 'voice', who: 'a', text: sc.text, el: 0, from: sc.by, fromEl: 1, last: sc.by ? 1 : 0 }], bias: 0.42 })
      echo(ctx, s, E, C, {
        L: [{ text: '“', q: s.p(0), size: 300, lines: 1, color: C.accL }],
        R: [sc.by && { text: sc.by, q: s.p(1), size: 64, lines: 3, color: C.sideSub, w: 700 }],
        K: sc.by ? { text: sc.by, q: s.p(1) } : null,
      })
    },

    // 片尾：一张带按钮的链接卡片，最后手机外面画一圈虚线框
    end(ctx, s, E) {
      const C = pal(this.c), sc = s.scene
      let i = 0
      const tEl = i++, sEl = sc.subtitle ? i++ : -1, cEl = sc.cta ? i++ : -1
      chat(ctx, s, E, C, { msgs: [{ kind: 'link', who: 'a', title: sc.title, sub: sc.subtitle, cta: sc.cta, el: tEl, subEl: sEl, ctaEl: cEl, last: i - 1 }], bias: 0.42 })
      phoneRing(ctx, E, C, kk(s.t, s.dur * 0.55, 0.9))
      echo(ctx, s, E, C, {
        L: [{ text: sc.title, q: s.p(tEl), size: 96, lines: 3 }],
        R: [sc.cta && { text: sc.cta, q: s.p(cEl), size: 64, lines: 1, pill: true }],
        K: sc.cta ? { text: sc.cta, q: s.p(cEl), pill: true } : { text: sc.title, q: s.p(tEl) },
      })
    },
  },

  music: { style: 'calm', prog: ['Em9', 'A7', 'Dmaj9', 'Bm9'], lead: 'epiano', drums: true },
  sfx: { enter: 'pop', cut: 'click', accent: 'chime' },
}
