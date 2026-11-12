"""按一支片子的时间线写配乐的事件表，四种风格各一套编曲。乐器是库乐队（或 Logic）装在本机的采样，只能在 macOS 上用。

    python3 score_gen.py <out/timeline.json> <风格> <score.json>
    风格：acoustic（轻快的原声流行）、electronic（冷静的电子）、funk（俏皮的放克）、cinematic（温暖的电影感）

timeline.json 是 make.mjs 出片时写在 out/ 里的：一拍多少秒、每一场从第几秒开始。
编曲的办法四种风格是同一个：一小节四拍、一小节换一个和弦；强弱跟着全片的位置走（开头轻，七成处最满，
最后一场落回主和弦）；每一场的开头给一个提示音。渲出来：gbrender score.json music.wav（见技能的 external-tools.md）。
"""
import json
import math
import sys

tl = json.load(open(sys.argv[1], encoding="utf-8"))
STYLE, OUT = sys.argv[2], sys.argv[3]
B = tl["beat"]
SC = tl["scenes"]
BODY = SC[-1]["start"] + SC[-1]["seconds"]                # 最后一场结束的时刻
END = round(SC[-1]["start"] / B)                          # 最后一场从第几拍开始
BEATS = round(BODY / B)
BARS = math.ceil(BEATS / 4)
STARTS = [round(s["start"] / B) for s in SC]              # 每一场从第几拍开始
L = "/Library/Application Support/Logic/Sampler Instruments/"
O = L + "09 Orchestral/"
T = {}


def n(tr, beat, dur, pitch, vel):
    if beat < BEATS + 2:
        T.setdefault(tr, []).append([round(beat * B, 4), round(dur * B, 4), int(pitch), int(max(1, min(127, vel)))])


def level(b):
    """第 b 小节有多满，0 到 1。"""
    p = b * 4 / max(1, END)
    if b * 4 >= END:
        return 0.4
    if p < 0.12:
        return 0.3
    if p < 0.7:
        return 0.45 + 0.55 * (p - 0.12) / 0.58
    return 1.0


def triad(root, minor=False):
    return [root, root + (3 if minor else 4), root + 7]


def bars(prog):
    """逐小节给出 (小节号, 起拍, 和弦, 强弱)。最后一场只用主和弦。"""
    for b in range(BARS):
        yield b, b * 4, (prog[0] if b * 4 >= END else prog[b % len(prog)]), level(b)


if STYLE == "acoustic":            # C G Am F：木吉他分解和弦、钢琴旋律、原声贝斯、轻的鼓、钟琴
    INST = {"guitar": L + "08 Guitars/Classical Acoustic Guitar.exs", "piano": L + "01 Acoustic Pianos/Grand Piano.exs",
            "bass": L + "02 Bass/01 Acoustic Bass/Upright Jazz Bass.exs", "glock": O + "04 Tuned Percussion/Glockenspiel.exs",
            "kit": L + "03 Drums & Percussion/02 Electronic Drum Kits/Compact Kit.exs"}
    MIX = {"guitar": (-2, -.3), "piano": (1, .25), "bass": (-24, 0.), "glock": (6, .45), "kit": (2, 0.)}
    REVERB = 22
    PROG = [(48, False), (43, False), (45, True), (41, False)]
    TUNE = [[76, 79, 81, 79], [74, 79, 83, 79], [72, 76, 81, 76], [72, 77, 81, 84]]
    for b, t, (root, minor), lv in bars(PROG):
        tri = triad(root + 12, minor)
        pat = [tri[0], tri[2], tri[1] + 12, tri[2], tri[0] + 12, tri[2], tri[1] + 12, tri[2]]
        for k in range(8 if lv > 0.35 else 4):
            step = .5 if lv > 0.35 else 1
            n("guitar", t + k * step, 1.4, pat[k % 8], (62 + 22 * lv) + (8 if k == 0 else 0))
        n("bass", t, 1.6, root - 12, 78 + 20 * lv)
        if lv > 0.5:
            n("bass", t + 2, 1.2, root - 12, 70 + 16 * lv); n("bass", t + 3.5, .4, root - 5, 64)
        if lv >= 0.6 and t < END:
            for k, p in enumerate(TUNE[b % 4]):
                n("piano", t + k, .95, p, 70 + 18 * lv)
        elif t < END:
            n("piano", t, 3.5, TUNE[b % 4][0], 62)
        if lv > 0.55 and t < END:
            for k in range(8):
                n("kit", t + k * .5, .1, 42, 38 + 14 * lv + (10 if k % 2 == 0 else 0))
            n("kit", t, .3, 36, 84); n("kit", t + 2, .3, 36, 74)
            if lv > 0.85:
                n("kit", t + 1, .3, 38, 66); n("kit", t + 3, .3, 38, 70)
    for s in STARTS[1:]:
        n("glock", s, 2, 84 if s < END else 96, 74)
    for i, p in enumerate([48, 55, 60, 64, 67, 72]):          # 最后一场：一下扫弦
        n("guitar", END + i * .04, 6, p, 96)
    n("piano", END, 6, 84, 80); n("piano", END, 6, 72, 76)

elif STYLE == "electronic":        # Am F C G：合成器铺底、拨弦音色走十六分音符、低频贝斯、电子鼓
    P = L + "04 Keyboards/Producer Packs/"
    INST = {"pad": P + "Velvetine Synth Pad.exs", "pluck": P + "Lime Drops Synth Pluck.exs", "sub": P + "Sub Tone Bass.exs",
            "bell": P + "Azure Crystal Synth Bells.exs", "kit": L + "03 Drums & Percussion/02 Electronic Drum Kits/Modern 808.exs"}
    MIX = {"pad": (-8, 0.), "pluck": (-3, .3), "sub": (-5, 0.), "bell": (6, -.4), "kit": (-12, 0.)}
    REVERB = 30
    PROG = [(57, True), (53, False), (48, False), (55, False)]
    for b, t, (root, minor), lv in bars(PROG):
        tri = triad(root, minor)
        for p in tri + [tri[0] + 12]:
            n("pad", t, 3.95, p, 58 + 26 * lv)
        n("sub", t, 3.8, root - 24, 88 + 14 * lv)
        seq = [tri[0], tri[1], tri[2], tri[1] + 12, tri[2], tri[0] + 12, tri[1], tri[2]]
        steps = 16 if lv >= 0.45 else 8
        for k in range(steps):
            if t >= END and k > 3:
                break
            n("pluck", t + k * 4 / steps, .3, seq[k % 8] + 12, (54 + 26 * lv) + (12 if k % 4 == 0 else 0))
        if t < END:
            if lv > 0.5:
                n("kit", t, .3, 36, 96); n("kit", t + 2, .3, 36, 88)
            if lv > 0.6:
                for k in range(4):
                    n("kit", t + k + .5, .1, 42, 56)
            if lv > 0.85:
                n("kit", t + 1, .3, 39, 78); n("kit", t + 3, .3, 39, 82)
    for s in STARTS[1:]:
        n("bell", s, 3, 81 if s < END else 93, 84)
    n("bell", END, 6, 69, 80)

elif STYLE == "funk":              # F Dm Bb C：马林巴的切分、电贝斯、颤音琴的和弦、四拍踩满的鼓
    INST = {"marimba": L + "04 Keyboards/Mallets/Mini Marimba.exs", "vibes": L + "04 Keyboards/Mallets/Vibraphone.exs",
            "bass": L + "02 Bass/02 Electric Bass/Fingerstyle Electric Bass.exs", "glock": O + "04 Tuned Percussion/Glockenspiel.exs",
            "kit": L + "03 Drums & Percussion/02 Electronic Drum Kits/Electronic Pop Kit.exs"}
    MIX = {"marimba": (8, -.3), "vibes": (-4, .35), "bass": (-22, 0.), "glock": (6, .45), "kit": (-7, 0.)}
    REVERB = 16
    PROG = [(53, False), (50, True), (46, False), (48, False)]
    for b, t, (root, minor), lv in bars(PROG):
        tri = triad(root + 12, minor)
        if t >= END:
            for i, p in enumerate(tri + [tri[0] + 12]):
                n("marimba", t + i * .25, 2, p, 92)
            n("bass", t, 3, root - 12, 100); n("vibes", t, 6, tri[0] + 12, 80); n("vibes", t, 6, tri[2], 76)
            break
        riff = [(0, tri[0] + 12), (.5, tri[2]), (1.5, tri[1] + 12), (2, tri[2]), (2.5, tri[0] + 12), (3.5, tri[1] + 12)]
        for k, (off, p) in enumerate(riff):
            if lv > 0.4 or k % 2 == 0:
                n("marimba", t + off, .4, p, 78 + 20 * lv)
        line = [(0, root - 12, .4), (.5, root, .2), (1.5, root - 12, .4), (2, root - 5, .4), (3, root - 12, .4), (3.5, root - 10 if minor else root - 9, .3)]
        for off, p, d in line[: 6 if lv > 0.5 else 3]:
            n("bass", t + off, d, p, 88 + 14 * lv)
        if lv > 0.6:
            for off in (1.5, 3):
                for p in tri:
                    n("vibes", t + off, .5, p, 66 + 12 * lv)
        for k in range(4):
            if lv > 0.4:
                n("kit", t + k, .3, 36, 92)
            if lv > 0.55:
                n("kit", t + k + .5, .1, 42, 58)
            if lv > 0.7 and k % 2 == 1:
                n("kit", t + k, .3, 39, 80)
    for s in STARTS[1:]:
        n("glock", s, 1.5, 89 if s < END else 101, 78)

elif STYLE == "cinematic":         # D Bm G A：钢琴分解和弦、圆号和合唱铺底、竖琴滑音、定音鼓
    INST = {"piano": L + "01 Acoustic Pianos/Grand Piano.exs", "horns": O + "02 Brass/French Horns Legato.exs",
            "horn": O + "02 Brass/French Horn Solo Legato.exs", "choir": O + "08 Choir/Chamber Ensemble+.exs",
            "harp": O + "06 Harp/Harp.exs", "bass": L + "02 Bass/01 Acoustic Bass/Upright Jazz Bass.exs", "kit": O + "03 Percussion/Orchestral Kit.exs"}
    MIX = {"piano": (3, -.15), "horns": (-4, -.35), "horn": (-1, .2), "choir": (-7, 0.), "harp": (2, .4), "bass": (-15, 0.), "kit": (-6, 0.)}
    REVERB = 38
    PROG = [(50, False), (47, True), (43, False), (45, False)]
    TUNE = [[(0, 2, 66), (2, 2, 69)], [(0, 2, 71), (2, 2, 66)], [(0, 2, 67), (2, 1, 71), (3, 1, 74)], [(0, 3, 73), (3, 1, 69)]]
    for b, t, (root, minor), lv in bars(PROG):
        tri = triad(root, minor)
        arp = [tri[0], tri[2], tri[0] + 12, tri[1] + 12, tri[2] + 12, tri[1] + 12, tri[0] + 12, tri[2]]
        for k in range(8 if lv > 0.35 else 4):
            step = .5 if lv > 0.35 else 1
            n("piano", t + k * step, 1.6, arp[k % 8], 56 + 24 * lv + (8 if k == 0 else 0))
        n("bass", t, 3.8, root - 12, 70 + 20 * lv)
        if lv > 0.45:
            n("horns", t, 3.9, tri[0], 56 + 28 * lv); n("horns", t, 3.9, tri[2], 52 + 28 * lv)
        if lv > 0.6:
            for p in tri:
                n("choir", t, 3.9, p + 12, 46 + 30 * lv)
        if lv >= 0.7 and t < END:
            for off, d, p in TUNE[b % 4]:
                n("horn", t + off, d * .96, p, 78 + 16 * lv)
    for s in STARTS[1:]:
        for i, p in enumerate([62, 66, 69, 74, 78, 81]):          # 每一场开头前半拍：竖琴一串上行
            n("harp", s - .5 + i / 12, 1.5, p, 64 + i * 3)
    peak = min((s for s in STARTS if s >= END * 0.68), default=END)
    for i in range(8):
        n("kit", peak - 1 + i / 8, .1, 47, 44 + i * 8)
    n("kit", peak, 3, 49, 84); n("kit", peak, .6, 36, 100)
    n("kit", END, 3, 49, 70); n("piano", END, 6, 38, 90); n("piano", END, 6, 86, 70)
else:
    sys.exit("风格只有：acoustic、electronic、funk、cinematic")

score = {"duration": round(tl["total"], 3), "reverb": REVERB,
         "tracks": [{"name": k, "inst": INST[k], "gain": MIX[k][0], "pan": MIX[k][1], "notes": sorted(v)} for k, v in T.items()]}
json.dump(score, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(STYLE, round(score["duration"], 1), "秒，", BARS, "小节，", {k: len(v) for k, v in T.items()})
