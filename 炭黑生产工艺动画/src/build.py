"""生成单文件版动画：内联脚本 + 内嵌字体子集（思源黑体 / Noto Sans SC 可变字体）。

用法：python build.py [字体路径]
字体默认 ~/.fonts/NotoSansSC-VF.ttf（Google Fonts: ofl/notosanssc/NotoSansSC[wght].ttf，SIL OFL 1.1）。
输出：../炭黑生产工艺流程动画.html —— 离线可用，任何现代浏览器双击即可播放。
"""
import base64, io, re, sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / '炭黑生产工艺流程动画.html'
FONT = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / '.fonts' / 'NotoSansSC-VF.ttf')

html = (HERE / 'animation.html').read_text(encoding='utf-8')
engine = (HERE / 'engine.js').read_text(encoding='utf-8')
scenes = (HERE / 'scenes.js').read_text(encoding='utf-8')

# 1) 内联脚本
inline = f'<script>\n{engine}\n</script>\n<script>\n{scenes}\n</script>'
html = re.sub(r'<!--@SCRIPTS@-->.*?<!--@/SCRIPTS@-->', lambda m: inline, html, flags=re.S)

# 2) 字体子集：页面里出现的所有字符 + 常用 ASCII
chars = set(html) | set(chr(c) for c in range(0x20, 0x7F)) | set('，。、：；！？（）《》“”‘’—…·～℃µ≈≤≥±→×①②③④⑤')
chars = {c for c in chars if ord(c) >= 0x20}
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['*']
opts.hinting = False
opts.name_IDs = ['*']
opts.notdef_outline = True
font = TTFont(str(FONT))
sub = subset.Subsetter(options=opts)
sub.populate(text=''.join(sorted(chars)))
sub.subset(font)
buf = io.BytesIO()
font.flavor = 'woff2'
font.save(buf)
b64 = base64.b64encode(buf.getvalue()).decode('ascii')
face = ('@font-face{font-family:"CBSans";font-weight:100 900;font-style:normal;font-display:block;'
        f'src:url(data:font/woff2;base64,{b64}) format("woff2");}}')
html = html.replace('/*@FONT_FACE@*/', face)

OUT.write_text(html, encoding='utf-8')
print(f'{OUT.name}: {OUT.stat().st_size / 1024:.0f} KB (font subset {len(buf.getvalue()) / 1024:.0f} KB, {len(chars)} chars)')
