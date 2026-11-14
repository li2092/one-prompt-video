"""采样配乐的事件表示例：八小节，100 拍每分钟，D 小调，最后落在 D 大调。输出 score.json 给 gbrender。

    python3 score_example.py && ./gbrender score.json music.wav

写自己的配乐时照这个结构改：先定速度和每一段落在第几拍（和画面的时间线用同一组数），再往各轨里加音符。
n(轨, 第几拍, 几拍长, MIDI 音高, 力度)。中央 C 是 60，每升一个半音加 1。
"""
import json

BPM = 100
B = 60 / BPM                                   # 一拍多少秒
L = "/Library/Application Support/Logic/Sampler Instruments/"      # 库乐队和 Logic 的乐器采样都装在这里
O = L + "09 Orchestral/"
INST = {
    "brass": O + "02 Brass/Full Brass Legato.exs",
    "horns": O + "02 Brass/French Horns Legato.exs",
    "choir": O + "08 Choir/Classical Ensemble+.exs",
    "harp": O + "06 Harp/Harp.exs",
    "piano": L + "01 Acoustic Pianos/Grand Piano.exs",
    "kit": O + "03 Percussion/Orchestral Kit.exs",
}
T = {k: [] for k in INST}
KICK, SNARE, TIMP, CYM = 36, 38, 47, 49        # 管弦打击乐这套音色的键位（量出来的，没有官方表）


def n(tr, beat, dur, pitch, vel):
    T[tr].append([round(beat * B, 4), round(dur * B, 4), pitch, int(max(1, min(127, vel)))])


# 每小节：(起拍, 低音, 和弦音)。前四小节弱，第 5 小节全体进来，第 8 小节落在大调上
BARS = [(0, 38, [62, 65, 69]), (4, 34, [58, 62, 65]), (8, 41, [60, 65, 69]), (12, 36, [60, 64, 67]),
        (16, 38, [62, 65, 69]), (20, 34, [58, 62, 65]), (24, 33, [57, 61, 64]), (28, 38, [62, 66, 69])]
for i, (b0, root, tri) in enumerate(BARS):
    loud = i >= 4
    for p in tri:
        n("choir", b0, 3.9, p, 100 if loud else 56)
        if loud:
            n("brass", b0, 3.9, p - 12, 112)
    n("piano", b0, 4, root, 100 if loud else 70)
    arp = [tri[0], tri[1], tri[2], tri[0] + 12, tri[2], tri[1], tri[2], tri[0] + 12]
    for k in range(8):                           # 竖琴走八分音符
        n("harp", b0 + k * .5, .9, arp[k] + 12, 84 if loud else 64)
    if loud:
        n("kit", b0, .8, KICK, 118); n("kit", b0 + 2, .8, KICK, 100)
for b, d, p in [(16, 1.5, 74), (17.5, .5, 69), (18, 1, 74), (19, 1, 77), (20, 2, 77), (22, 2, 74), (24, 3.9, 76), (28, 3.9, 78)]:
    n("horns", b, d * .96, p - 12, 108)          # 旋律
for k in range(16):                              # 第 4 小节末两拍：定音鼓滚奏渐强，接第 5 小节的重音
    n("kit", 14 + k / 8, .1, TIMP, 40 + k * 5)
n("kit", 16, 4, CYM, 108); n("kit", 28, 4, CYM, 112)

MIX = {"brass": (-2, .1), "horns": (0, -.3), "choir": (-5, 0.), "harp": (-2, .4), "piano": (-1, -.1), "kit": (-3, 0.)}   # (音量 dB, 左右)
score = {"duration": 32 * B + 2.5, "reverb": 36,
         "tracks": [{"name": k, "inst": INST[k], "gain": MIX[k][0], "pan": MIX[k][1], "notes": sorted(v)} for k, v in T.items()]}
json.dump(score, open("score.json", "w"), ensure_ascii=False, indent=1)
print("写好 score.json：", round(score["duration"], 1), "秒，", sum(len(v) for v in T.values()), "个音")
