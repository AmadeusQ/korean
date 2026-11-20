"""PNG-значки приложения (iOS не понимает SVG). Запуск: python tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PAPER, SEAL, GRID = (244, 239, 230), (63, 122, 107), (120, 90, 60, 36)  # бумага, нефритовая печать, клетка
FONT = 'C:/Windows/Fonts/malgunbd.ttf'


def icon(size: int, maskable: bool = False) -> Image.Image:
    S = 4  # рисуем в 4 раза крупнее и уменьшаем — так края гладкие
    big = size * S
    k = big / 512
    img = Image.new('RGBA', (big, big), PAPER + (255,))
    grid = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    g = ImageDraw.Draw(grid)
    for p in (128, 256, 384):
        g.line([(0, p * k), (big, p * k)], fill=GRID, width=max(1, int(3 * k)))
        g.line([(p * k, 0), (p * k, big)], fill=GRID, width=max(1, int(3 * k)))
    img = Image.alpha_composite(img, grid)

    # печать 도장: красный квадрат, светлая рамка, 한
    sc = 0.74 if maskable else 1.0  # maskable: держим рисунок в безопасной зоне
    seal = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(seal)
    c = big / 2
    h = 170 * k * sc
    d.rounded_rectangle([c - h, c - h, c + h, c + h], radius=34 * k * sc, fill=SEAL)
    i = 144 * k * sc
    d.rounded_rectangle([c - i, c - i, c + i, c + i], radius=20 * k * sc, outline=PAPER, width=max(2, int(10 * k * sc)))
    font = ImageFont.truetype(FONT, int(200 * k * sc))
    d.text((c, c + 4 * k * sc), '한', font=font, fill=PAPER, anchor='mm')
    seal = seal.rotate(8, resample=Image.BICUBIC, center=(c, c))
    img = Image.alpha_composite(img, seal)
    return img.convert('RGB').resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    for name, size, mask in [('icon-180.png', 180, False), ('icon-192.png', 192, False), ('icon-512.png', 512, False), ('icon-maskable-512.png', 512, True)]:
        icon(size, mask).save(ROOT / name, optimize=True)
        print(name)
