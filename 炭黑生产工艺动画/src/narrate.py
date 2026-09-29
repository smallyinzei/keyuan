"""中文配音：把字幕转成朗读文本，用 edge-tts（zh-CN-YunyangNeural）合成，并测量时长。
用法：python narrate.py synth   → 生成 voice/NN.mp3 与 voice/manifest.json
"""
import asyncio, json, re, ssl, subprocess, sys
from pathlib import Path
import edge_tts, edge_tts.communicate as ec

HERE = Path(__file__).resolve().parent
VOICE_DIR = HERE / 'voice'
VOICE = 'zh-CN-YunyangNeural'
CA = Path('/root/.ccr/ca-bundle.crt')
if CA.exists():  # 云端环境走代理，需信任代理 CA
    ec._SSL_CTX = ssl.create_default_context(cafile=str(CA))

RULES = [
    (r'<sub>(\d)</sub>', r'\1'), (r'<br>', ''), (r'<[^>]+>', ''),
    ('K2CO3', '碳酸钾'), ('CO、H2', '一氧化碳、氢气'),
    ('N220 ＞ N330 ＞ N550', 'N二二零大于N三三零大于N五五零'),
    ('N220、N330、N326', 'N二二零、N三三零、N三二六'),
    (r'(\d+)～(\d+(?:\.\d+)?)', r'\1到\2'), (r'(\d+\.\d+)～(\d+\.\d+)', r'\1到\2'),
    ('g/cm³', '克每立方厘米'), ('45 µm', '45微米'), ('ppm', 'PPM'),
    ('≤', '小于等于'), ('约 2/3', '约三分之二'), ('约 1/3', '约三分之一'),
    ('500 / 1000 kg', '500或1000公斤'), ('25 kg', '25公斤'),
    (' ℃ 以下', '摄氏度以下'), (' ℃ 以上', '摄氏度以上'), (' ℃', '摄氏度'),
    ('COA', 'C O A'), ('TDS', 'T D S'), ('pH', 'P H值'),
    ('造粒·干燥·包装', '造粒、干燥、包装'), ('→', '，'), ('“', ''), ('”', ''),
    ('0.8%', '百分之零点八'), ('2.5%', '百分之二点五'),
]
def spoken(t):
    for a, b in RULES:
        t = re.sub(a, b, t) if a.startswith('(') or '\\' in a or a.startswith('<') else t.replace(a, b)
    return re.sub(r'\s+', '', t).replace('，，', '，')

def dur(f):
    import imageio_ffmpeg
    out = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-i', str(f)], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out).groups()
    return int(h) * 3600 + int(m) * 60 + float(s)

async def synth(items, rate='+0%'):
    VOICE_DIR.mkdir(exist_ok=True)
    for it in items:
        f = VOICE_DIR / f"{it['i']:02d}.mp3"
        for k in range(4):
            try:
                await edge_tts.Communicate(it['say'], VOICE, rate=rate).save(str(f)); break
            except Exception as e:
                print('retry', it['i'], e); await asyncio.sleep(2)
        it['file'] = f.name; it['adur'] = round(dur(f), 3)

if __name__ == '__main__':
    caps = json.loads((HERE / 'caps_local.json').read_text(encoding='utf-8'))
    items = [dict(i=n, scene=c['scene'], t0=c['t0'], t1=c['t1'], text=c['text'], say=spoken(c['text'])) for n, c in enumerate(caps)]
    asyncio.run(synth(items, rate='+8%'))
    (VOICE_DIR / 'manifest.json').write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    durs = json.loads((HERE / 'scene_durs.json').read_text())
    warp, place = {}, []
    for si, D in enumerate(durs):
        caps_s = [it for it in items if it['scene'] == si]
        if not caps_s: continue
        knots, pl, po = [[0, 0]], 0.0, 0.0
        for it in caps_s:
            o0 = po + (it['t0'] - pl)
            L = max(it['t1'] - it['t0'], it['adur'] + 0.45)
            knots += [[it['t0'], round(o0, 3)], [it['t1'], round(o0 + L, 3)]]
            it['o0'] = o0; pl, po = it['t1'], o0 + L
        knots.append([D, round(po + D - pl, 3)])
        warp[si] = knots
    (VOICE_DIR / 'warp.json').write_text(json.dumps(warp), encoding='utf-8')
    (VOICE_DIR / 'manifest.json').write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    for it in items:
        w = it['t1'] - it['t0']
        print(f"{it['i']:2d} s{it['scene']:<2d} win {w:5.1f}  audio {it['adur']:5.2f}  {'OVER' if it['adur'] > w - 0.3 else ''}  {it['say']}")
