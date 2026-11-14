"""用豆包语音（火山引擎 seed-tts-2.0，要联网、要自己的密钥）把一句话合成一个音频文件。只用 Python 标准库。

    VOLC_API_KEY=你的密钥 python3 doubao_tts.py --text "要念的话" --out voice/01.mp3

可选：--voice 音色编号（默认 zh_female_vv_uranus_bigtts）；--tone "语气提示，比如：沉稳、不赶"；
--lang en 或 ja（念外语时指定语种）；--rate 语速，-50 到 100，0 是原速。
密钥只从环境变量 VOLC_API_KEY 读，不写进任何文件。
接进 video.json：
    "tts": { "command": ["python3", "SKILL/assets/external/voice/doubao_tts.py", "--text", "{text}", "--out", "{out}"], "ext": "mp3" }
"""
import base64
import json
import os
import sys
import urllib.request
import uuid


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


text, out = arg("--text"), arg("--out")
key = os.environ.get("VOLC_API_KEY")
if not text or not out:
    sys.exit("用法：python3 doubao_tts.py --text \"要念的话\" --out 输出.mp3")
if not key:
    sys.exit("缺环境变量 VOLC_API_KEY（火山引擎语音合成的密钥）。先设好再跑：VOLC_API_KEY=… python3 doubao_tts.py …")

add = {}
if arg("--tone"):
    add["context_texts"] = [arg("--tone")]
if arg("--lang"):
    add["explicit_language"] = arg("--lang")
params = {"text": text, "speaker": arg("--voice", "zh_female_vv_uranus_bigtts"),
          "audio_params": {"format": "mp3", "sample_rate": 24000, "speech_rate": int(arg("--rate", "0"))}}
if add:
    params["additions"] = json.dumps(add, ensure_ascii=False)
req = urllib.request.Request(
    "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    data=json.dumps({"user": {"uid": "one-prompt-video"}, "req_params": params}).encode(),
    headers={"X-Api-Key": key, "X-Api-Resource-Id": "seed-tts-2.0", "X-Api-Request-Id": str(uuid.uuid4()), "Content-Type": "application/json"})
audio, last = b"", None
try:
    with urllib.request.urlopen(req, timeout=90) as r:
        for line in r:
            line = line.strip()
            if not line:
                continue
            j = json.loads(line)
            last = (j.get("code"), j.get("message"))
            if j.get("data"):
                audio += base64.b64decode(j["data"])
except Exception as e:                           # 网络不通、密钥不对
    sys.exit(f"豆包语音请求失败：{e}")
if not audio:
    sys.exit(f"豆包语音没有返回声音：{last}")
os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
open(out, "wb").write(audio)
