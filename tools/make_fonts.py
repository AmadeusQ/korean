"""Шрифты внутри сайта вместо Google Fonts: без запросов к Google и с офлайн-работой.

Запуск: python tools/make_fonts.py   (нужны: pip install fonttools brotli)

Исходники (переменные шрифты из github.com/google/fonts, лицензия OFL) скачиваются в tools/.font-src/
(в git не попадает). Корейские шрифты режутся на две части:
  *-core.woff2 — слоги из уроков и интерфейса, грузится всегда;
  *-rest.woff2 — остальные из 2350 частых слогов (KS X 1001), браузер берёт его,
                 только если на странице встретился такой слог (свои слова, имя).
Более редкие слоги показываются системным шрифтом. После нового урока скрипт стоит перезапустить,
чтобы его слоги попали в core (иначе они придут из rest — тоже работает, просто тяжелее).
"""
import glob
import os
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', '.font-src')
OUT = os.path.join(ROOT, 'fonts')
BASE = 'https://github.com/google/fonts/raw/main/ofl/'
FILES = {
    'NotoSansKR.ttf': 'notosanskr/NotoSansKR%5Bwght%5D.ttf',
    'NotoSerifKR.ttf': 'notoserifkr/NotoSerifKR%5Bwght%5D.ttf',
    'IBMPlexSans.ttf': 'ibmplexsans/IBMPlexSans%5Bwdth,wght%5D.ttf',
    'OFL-Noto.txt': 'notosanskr/OFL.txt',
    'OFL-Plex.txt': 'ibmplexsans/OFL.txt',
}


def fetch():
    os.makedirs(SRC, exist_ok=True)
    for name, path in FILES.items():
        dst = os.path.join(SRC, name)
        if not os.path.exists(dst):
            print('скачиваю', name)
            urllib.request.urlretrieve(BASE + path, dst)


def ranges(cps):
    """Список кодов → unicode-range для CSS."""
    cps = sorted(cps)
    out, start, prev = [], None, None
    for c in cps:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            out.append((start, prev))
            start = prev = c
    if start is not None:
        out.append((start, prev))
    return ', '.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)


BASIC = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2000, 0x2070)) | {0x2190, 0x2192, 0x00B7}
CYRILLIC = set(range(0x400, 0x460)) | {0x2116}
JAMO = set(range(0x3131, 0x318F))  # совместимые чамо: ㄱ, ㅏ…


def used_syllables():
    text = ''
    for pat in ('data/lessons/*.js', 'app/*.js', 'index.html'):
        for f in glob.glob(os.path.join(ROOT, pat)):
            text += open(f, encoding='utf-8').read()
    return {ord(c) for c in text if 0xAC00 <= ord(c) <= 0xD7A3}


def ksx_syllables():
    out = set()
    for cp in range(0xAC00, 0xD7A4):
        try:
            if len(chr(cp).encode('euc_kr')) == 2:
                out.add(cp)
        except UnicodeEncodeError:
            pass
    return out


def build(src, out, cps, axes):
    font = TTFont(os.path.join(SRC, src), lazy=False)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    opts.notdef_outline = True
    opts.hinting = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=cps)
    s.subset(font)
    font = instancer.instantiateVariableFont(font, axes)  # только нужные начертания: меньше файл
    path = os.path.join(OUT, out)
    font.flavor = 'woff2'
    font.save(path)
    print(f'{out}: {os.path.getsize(path) // 1024} КБ')


def main():
    fetch()
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, '*.woff2')):
        os.remove(old)
    core = used_syllables() | JAMO | BASIC
    rest = ksx_syllables() - core
    kr = {'wght': (400, 700)}
    build('NotoSansKR.ttf', 'noto-sans-kr-core.woff2', core, kr)
    build('NotoSansKR.ttf', 'noto-sans-kr-rest.woff2', rest, kr)
    build('NotoSerifKR.ttf', 'noto-serif-kr-core.woff2', core, {'wght': (400, 700)})
    build('NotoSerifKR.ttf', 'noto-serif-kr-rest.woff2', rest, {'wght': (400, 700)})
    build('IBMPlexSans.ttf', 'ibm-plex-sans.woff2', BASIC | CYRILLIC, {'wdth': 100, 'wght': (400, 600)})
    for lic in ('OFL-Noto.txt', 'OFL-Plex.txt'):
        with open(os.path.join(SRC, lic), encoding='utf-8') as f, open(os.path.join(OUT, lic), 'w', encoding='utf-8', newline='\n') as g:
            g.write(f.read())

    def face(family, file, weights, cps):
        return (f"@font-face {{ font-family: '{family}'; src: url({file}) format('woff2'); font-weight: {weights}; "
                f"font-style: normal; font-display: swap; unicode-range: {ranges(cps)}; }}\n")
    css = ('/* Создаётся tools/make_fonts.py. Шрифты: Noto Sans KR, Noto Serif KR, IBM Plex Sans — SIL Open Font License (OFL-*.txt). */\n'
           + face('IBM Plex Sans', 'ibm-plex-sans.woff2', '400 600', BASIC | CYRILLIC)
           + face('Noto Sans KR', 'noto-sans-kr-core.woff2', '400 700', core)
           + face('Noto Sans KR', 'noto-sans-kr-rest.woff2', '400 700', rest)
           + face('Noto Serif KR', 'noto-serif-kr-core.woff2', '400 700', core)
           + face('Noto Serif KR', 'noto-serif-kr-rest.woff2', '400 700', rest))
    with open(os.path.join(OUT, 'fonts.css'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(css)
    print('слогов в core:', len(used_syllables()), '· в rest:', len(rest))


if __name__ == '__main__':
    main()
