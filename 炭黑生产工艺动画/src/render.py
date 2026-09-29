"""把动画逐帧渲染成 MP4（1920×1080，30 fps，H.264），并导出 SRT 字幕。

用法：
  python render.py preview 3 25.5 60          # 截取指定时刻的画面到 preview/
  python render.py video  [--fps 30] [--workers 4]
  python render.py srt

依赖：playwright（Python）、imageio-ffmpeg；Chromium 路径可用环境变量 CHROME 指定。
页面默认读取 ../炭黑生产工艺流程动画.html（build.py 生成的单文件版）。
"""
import os, sys, json, subprocess, argparse, tempfile, shutil, time
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
PAGE = Path(os.environ.get('PAGE', ROOT / '炭黑生产工艺流程动画.html'))
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')
W, H = 1920, 1080


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def open_page(p):
    from playwright.sync_api import sync_playwright  # noqa
    browser = p.chromium.launch(executable_path=CHROME, args=['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'])
    page = browser.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    page.goto(PAGE.as_uri() + '?render', wait_until='load')
    page.wait_for_function('window.__ready === true', timeout=60000)
    return browser, page


def total_duration():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b, page = open_page(p)
        T = page.evaluate('window.__total()')
        caps = page.evaluate('window.__captions()')
        b.close()
    return T, caps


def preview(times, outdir):
    from playwright.sync_api import sync_playwright
    outdir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b, page = open_page(p)
        for t in times:
            page.evaluate(f'window.__seek({t})')
            f = outdir / f't{float(t):07.2f}.png'
            page.screenshot(path=str(f), type='png')
            print('saved', f)
        b.close()


def render_chunk(args):
    k, f0, f1, fps, out = args
    from playwright.sync_api import sync_playwright
    cmd = [ffmpeg_exe(), '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-',
           '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '22', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
           '-g', str(fps * 2), '-r', str(fps), out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    with sync_playwright() as p:
        b, page = open_page(p)
        for i in range(f0, f1):
            page.evaluate(f'window.__seek({i / fps})')
            proc.stdin.write(page.screenshot(type='jpeg', quality=94))
            if (i - f0) % 300 == 0:
                print(f'[worker {k}] frame {i - f0}/{f1 - f0}  {time.time() - t0:.0f}s', flush=True)
        b.close()
    proc.stdin.close()
    proc.wait()
    return out


def video(fps, workers, out):
    T, caps = total_duration()
    n = int(round(T * fps))
    print(f'duration {T:.2f}s -> {n} frames @ {fps} fps, {workers} workers')
    tmp = Path(tempfile.mkdtemp(prefix='cbvid_'))
    bounds = [round(n * i / workers) for i in range(workers + 1)]
    jobs = [(k, bounds[k], bounds[k + 1], fps, str(tmp / f'part{k}.mp4')) for k in range(workers)]
    with ProcessPoolExecutor(workers) as ex:
        parts = list(ex.map(render_chunk, jobs))
    lst = tmp / 'list.txt'
    lst.write_text(''.join(f"file '{p}'\n" for p in parts))
    joined = tmp / 'joined.mp4'
    subprocess.run([ffmpeg_exe(), '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(joined)], check=True)
    # 加一条静音音轨，兼容部分播放器 / 微信
    subprocess.run([ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', str(joined), '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
                    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', '-shortest',
                    '-movflags', '+faststart', str(out)], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print('wrote', out)


def srt_time(x):
    ms = int(round(x * 1000))
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def write_srt(out):
    import re
    T, caps = total_duration()
    sub = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
    lines = []
    for i, c in enumerate(caps, 1):
        text = re.sub(r'<sub>(\d+)</sub>', lambda m: m.group(1).translate(sub), c['text'])
        text = re.sub(r'<[^>]+>', '', text)
        lines += [str(i), f"{srt_time(c['start'])} --> {srt_time(c['end'])}", text, '']
    Path(out).write_text('\n'.join(lines), encoding='utf-8')
    print('wrote', out, len(caps), 'captions; total', f'{T:.1f}s')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['preview', 'video', 'srt'])
    ap.add_argument('times', nargs='*', type=float)
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--workers', type=int, default=4)
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    if a.mode == 'preview':
        preview(a.times, Path(a.out or HERE / 'preview'))
    elif a.mode == 'video':
        video(a.fps, a.workers, a.out or str(ROOT / '炭黑生产工艺流程动画.mp4'))
    else:
        write_srt(a.out or str(ROOT / '炭黑生产工艺流程动画_字幕.srt'))
