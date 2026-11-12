#!/usr/bin/env python3
"""给一次测试跑的产出打分：python3 evals/grade.py <outputs 目录> <题目名>，在 outputs 的上一级写 grading.json。"""
import json, re, sys, pathlib

out = pathlib.Path(sys.argv[1]); name = sys.argv[2]
skip = lambda p: 'node_modules' in p.parts
jsons = [p for p in out.rglob('video.json') if not skip(p)]
mp4s = [p for p in out.rglob('*.mp4') if not skip(p)]
reports = [p for p in out.rglob('report.txt') if not skip(p)]
v = json.loads(jsons[0].read_text()) if jsons else {}
rep = reports[0].read_text() if reports else ''
scenes = v.get('scenes', [])
text = json.dumps(v, ensure_ascii=False)
spec = re.search(r'规格：(\d+)×(\d+)，(\d+) 帧/秒，([\d.]+) 秒', rep)
W, H, secs = (int(spec.group(1)), int(spec.group(2)), float(spec.group(4))) if spec else (0, 0, 0)
res = []
def a(t, ok, ev): res.append({'text': t, 'passed': bool(ok), 'evidence': ev})

a('出了成片（MP4 文件存在）', len(mp4s) >= 1, ', '.join(p.name for p in mp4s) or '没有找到 mp4')
a('自检报告里没有 [问题]', rep and '[问题]' not in rep, '有 report.txt，无 [问题]' if rep and '[问题]' not in rep else (re.findall(r'\[问题\].*', rep) or ['没有 report.txt'])[0])
a('画面上的字都放得下（报告里没有「字太多」）', rep and '字太多' not in rep, (re.findall(r'.*字太多.*', rep) or ['无'])[0])
a('第一场是 title，最后一场是 end', scenes and scenes[0].get('layout') == 'title' and scenes[-1].get('layout') == 'end', ' → '.join(s.get('layout', '?') for s in scenes))
kinds = {s.get('layout') for s in scenes}
a('至少用了三种版式', len(kinds) >= 3, '、'.join(sorted(k for k in kinds if k)))
a('有 notes.md', (out / 'notes.md').exists(), 'notes.md' if (out / 'notes.md').exists() else '没有')
if name == 'compound-interest':
    a('时长在 22 到 42 秒之间', 22 <= secs <= 42, f'{secs} 秒')
    a('横屏 1920×1080', (W, H) == (1920, 1080), f'{W}×{H}')
if name == 'earbuds-portrait':
    a('竖屏 1080×1920', (W, H) == (1080, 1920), f'{W}×{H}')
    for k in ['40', '199', '通透']: a(f'片子里出现了用户给的「{k}」', k in text, '有' if k in text else '没有')
if name == 'satisfaction-data':
    bars = [s for s in scenes if s.get('layout') == 'bars']
    vals = [[it.get('value') for it in s.get('items', [])] for s in bars]
    a('有一场柱状图，四个季度的数是 72、78、85、91', [72, 78, 85, 91] in vals, str(vals))
    a('突出了「19」这个数', any(s.get('layout') in ('number', 'statement') and '19' in json.dumps(s, ensure_ascii=False) for s in scenes), '；'.join(json.dumps(s, ensure_ascii=False)[:60] for s in scenes if '19' in json.dumps(s, ensure_ascii=False)) or '没有')
(out.parent / 'grading.json').write_text(json.dumps({'expectations': res, 'summary': {'passed': sum(r['passed'] for r in res), 'failed': sum(not r['passed'] for r in res), 'total': len(res), 'pass_rate': round(sum(r['passed'] for r in res) / len(res), 2)}}, ensure_ascii=False, indent=2))
for r in res: print(('通过 ' if r['passed'] else '没过 ') + r['text'] + '  —— ' + str(r['evidence'])[:100])
