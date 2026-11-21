# Картинки к словам: python tools/make_pictures.py
# Берёт линейные иконки Lucide (лицензия ISC, https://lucide.dev) по списку ниже и пишет data/pictures.js.
# Картинка нужна только предметным словам, где она однозначна; для абстрактных слов и стран её нет.
# Новое слово: дописать в PICTURES (имя иконки — со страницы lucide.dev/icons) и запустить скрипт.
import json
import re
import urllib.request
from pathlib import Path

VERSION = '0.460.0'
PICTURES = {
    # еда
    '우유': 'milk', '사과': 'apple', '고기': 'beef', '포도': 'grape', '피자': 'pizza', '빵': 'croissant',
    '과자': 'cookie', '찌개': 'soup', '커피': 'coffee', '케이크': 'cake', '물': 'droplet', '요리': 'cooking-pot',
    # вещи
    '시계': 'watch', '의자': 'armchair', '공': 'volleyball', '돈': 'banknote', '책': 'book', '공책': 'notebook',
    '책상': 'lamp-desk', '가방': 'shopping-bag', '옷': 'shirt', '티셔츠': 'shirt', '차': 'car', '기차': 'train-front',
    '약': 'pill', '문': 'door-closed', '수저': 'utensils', '메모': 'sticky-note', '가위': 'scissors', '도끼': 'axe',
    '유리': 'glass-water', '라디오': 'radio', '드라마': 'tv', '탈': 'drama', '노래': 'music', '수학': 'calculator',
    # места
    '집': 'house', '가게': 'store', '회사': 'building-2', '부엌': 'refrigerator', '주소': 'mailbox', '위치': 'map-pin',
    '나라': 'globe', '서울': 'landmark', '제주도': 'tree-palm', '메뉴': 'scroll-text',
    # природа и время
    '산': 'mountain', '나무': 'tree-deciduous', '숲': 'trees', '꽃': 'flower', '잎': 'leaf', '불': 'flame',
    '봄': 'sprout', '달': 'moon', '별': 'star', '낮': 'sun', '바다': 'waves', '휴가': 'plane',
    # тело, люди, животные
    '눈': 'eye', '손': 'hand', '아이': 'baby', '친구': 'handshake', '토끼': 'rabbit',
    # профессии
    '가수': 'mic', '배우': 'clapperboard', '화가': 'palette', '기자': 'newspaper', '회사원': 'briefcase',
    '대학생': 'graduation-cap', '학생': 'backpack', '의사': 'stethoscope', '경찰': 'siren', '요리사': 'chef-hat',
    '개발자': 'laptop', '선생님': 'school',
    # действия и прочее
    '회의': 'presentation', '대화': 'messages-square', '파티': 'party-popper', '한국어': 'languages',
}

root = Path(__file__).resolve().parent.parent
icons = {}
for name in sorted(set(PICTURES.values())):
    url = f'https://unpkg.com/lucide-static@{VERSION}/icons/{name}.svg'
    svg = urllib.request.urlopen(url, timeout=20).read().decode('utf-8')
    inner = re.search(r'<svg[^>]*>(.*)</svg>', svg, re.S).group(1)
    # только фигуры: path, circle, rect, line, polyline, polygon, ellipse — без скриптов и ссылок
    parts = re.findall(r'<(?:path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*/>', inner)
    if not parts:
        raise SystemExit(f'пустая иконка {name}')
    icons[name] = ''.join(re.sub(r'\s+', ' ', p) for p in parts)

out = ('// Картинки к словам: линейные иконки Lucide (ISC License, https://lucide.dev).\n'
       '// Файл создаёт tools/make_pictures.py — править список там.\n'
       f'window.PICTURE_ICONS = {json.dumps(icons, ensure_ascii=False, indent=0)};\n'
       f'window.PICTURES = {json.dumps(PICTURES, ensure_ascii=False, indent=0)};\n')
(root / 'data' / 'pictures.js').write_text(out, encoding='utf-8', newline='\n')
print(f'Иконок: {len(icons)}, слов с картинкой: {len(PICTURES)}')
