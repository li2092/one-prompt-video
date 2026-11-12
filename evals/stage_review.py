#!/usr/bin/env python3
"""把一轮测试的产出摊平成查看器认的目录：python3 evals/stage_review.py <workspace>/iteration-N
查看器只读 outputs/ 顶层的文件，而模型把片子放在 outputs/<片名>/ 里，所以另拷一份到 review/。"""
import json, shutil, sys, pathlib
it = pathlib.Path(sys.argv[1]); rv = it.parent / 'review' / it.name
evals = {e['prompt']: e for e in json.loads((it.parent.parent / 'evals' / 'evals.json').read_text())['evals']}
names = {'compound-interest': 1, 'earbuds-portrait': 2, 'satisfaction-data': 3}
for run in sorted(it.glob('eval-*/with_skill')):
    name = run.parent.name.replace('eval-', ''); eid = names[name]
    prompt = next(p for p, e in evals.items() if e['id'] == eid)
    dst = rv / run.parent.name / 'with_skill' / 'outputs'; shutil.rmtree(dst.parent, ignore_errors=True); dst.mkdir(parents=True)
    (dst.parent / 'eval_metadata.json').write_text(json.dumps({'eval_id': eid, 'eval_name': name, 'prompt': prompt, 'assertions': []}, ensure_ascii=False, indent=2))
    out = run / 'outputs'
    for pat, to in [('*/out/sheet.jpg', '1-总览图.jpg'), ('*/video.json', '2-video.json'), ('*/out/report.txt', '3-自检报告.txt'), ('notes.md', '4-模型的测试记录.md'), ('*/out/*.mp4', None)]:
        for f in out.glob(pat):
            if 'node_modules' in f.parts: continue
            shutil.copy(f, dst / (to or ('5-成片-' + f.name)))
    for extra in ['grading.json', 'timing.json']:
        if (run / extra).exists(): shutil.copy(run / extra, dst.parent / extra)
    print(dst.parent, sorted(p.name for p in dst.iterdir()))
