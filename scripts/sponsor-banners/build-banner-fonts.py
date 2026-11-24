# ──────────────────────────────────────────────
# 배너 자동 제작용 글꼴 만들기 — 2026년 11월 24일
#
# [무슨 기능인가]
#   서버(Vercel)에서 배너를 그릴 때 쓰는 한글 글꼴을 assets/banner-fonts/ 에 만든다.
#   PC 에 깔린 원본 글꼴(견본 스크립트 make-style-banners.mjs 와 같은 글꼴)에서
#   - 가변 글꼴(Noto Sans KR·Noto Serif KR)은 필요한 굵기 하나씩 고정 글꼴로 뽑고
#     (서버 그리기 도구 satori 는 가변 글꼴을 못 읽는다)
#   - 한글 11,172자 전부 + 영문·숫자·자주 쓰는 기호만 남겨 용량을 줄인다(한자·이모지는 뺌).
#   글자 폭 표(metrics.json)도 같이 만든다 — 긴 상호·문구를 줄 나눔·글자 크기 줄이기에 쓴다.
#
# [사용법] (fontTools 가 깔린 파이썬)
#   python scripts/sponsor-banners/build-banner-fonts.py
#   글꼴을 바꾸거나 더 넣을 때만 다시 돌린다. 결과 파일은 저장소에 함께 올린다.
# [허가] Noto·Black Han Sans·Pretendard = SIL OFL 1.1, G마켓 산스 = G마켓 무료 글꼴(상업 사용 가능, 글꼴 자체 판매 금지).
#   글꼴 파일은 public/ 에 두지 않는다(서버가 그림을 그릴 때만 읽음).
# ──────────────────────────────────────────────
import json, os, sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'banner-fonts'))
WIN = 'C:/Windows/Fonts/'
USER = os.path.expanduser('~/AppData/Local/Microsoft/Windows/Fonts/')

# 남길 글자 범위(유니코드). 한자·이모지는 넣지 않는다 — 들어오면 서버가 지운다(bannerText.ts 의 cleanBannerText)
RANGES = [
    (0x20, 0x7E), (0xA0, 0xFF),          # 영문·숫자·라틴 기호
    (0x2010, 0x2027), (0x2030, 0x203B),  # 줄표·가운뎃점·말줄임표
    (0x2116, 0x2116), (0x2122, 0x2122),  # № ™
    (0x2190, 0x2193),                    # 화살표
    (0x25A0, 0x25FF),                    # ◆ ● 같은 도형
    (0x3000, 0x303F),                    # 한중일 문장 부호
    (0x3131, 0x318E),                    # 한글 낱자(ㄱ ㅏ)
    (0x3200, 0x327F),                    # ㈜ 같은 괄호 한글
    (0xAC00, 0xD7A3),                    # 한글 11,172자
    (0xFF01, 0xFF5E),                    # 전각 기호
]
UNICODES = [c for a, b in RANGES for c in range(a, b + 1)]

def _ksx(c):
    # 완성형(KS X 1001) 2,350자에 드는 한글인가 — euc-kr 로 바꿀 수 있으면 든다
    # 파이썬 euc-kr 은 드문 글자도 8바이트 조합열로 바꿔 주므로, 2바이트로 바뀌는 글자만 완성형으로 친다
    try:
        return len(chr(c).encode('euc-kr')) == 2
    except UnicodeEncodeError:
        return False

# 명조(Noto Serif KR)는 획이 복잡해 11,172자 전부면 한 굵기에 8MB 가 넘는다.
# 그래서 자주 쓰는 2,350자만 남기고, 드문 글자는 그릴 때 고딕(Noto Sans KR)으로 대신 나오게 한다.
UNICODES_KSX = [c for c in UNICODES if not (0xAC00 <= c <= 0xD7A3) or _ksx(c)]

# (출력 이름, 원본 파일, 가변 글꼴이면 굵기[, 'ksx' 면 한글 2,350자만])
JOBS = [
    ('NotoSansKR-400.ttf', WIN + 'NotoSansKR-VF.ttf', 400),
    ('NotoSansKR-700.ttf', WIN + 'NotoSansKR-VF.ttf', 700),
    ('NotoSansKR-800.ttf', WIN + 'NotoSansKR-VF.ttf', 800),
    ('NotoSansKR-900.ttf', WIN + 'NotoSansKR-VF.ttf', 900),
    ('NotoSerifKR-400.ttf', WIN + 'NotoSerifKR-VF.ttf', 400, 'ksx'),
    ('NotoSerifKR-700.ttf', WIN + 'NotoSerifKR-VF.ttf', 700, 'ksx'),
    ('BlackHanSans-400.ttf', USER + 'BlackHanSans-Regular.ttf', None),
    ('GmarketSans-700.ttf', USER + 'GmarketSansTTFBold.ttf', None),
    ('Pretendard-300.otf', USER + 'Pretendard-Light.otf', None),
    ('Pretendard-900.otf', USER + 'Pretendard-Black.otf', None),
]

def build(name, src, wght, only_ksx=False):
    font = TTFont(src)
    if wght is not None:
        # 가변 글꼴 → 그 굵기 하나만 남긴 고정 글꼴
        font = instancer.instantiateVariableFont(font, {'wght': wght}, updateFontNames=False)
    opts = subset.Options()
    # 글자 사이 간격(kern)만 남긴다. ccmp 같은 조합 규칙을 남기면 그 규칙이 한글 전부를 다시 끌고 들어와 줄이기가 안 된다
    # (완성형 한글만 쓰고, 그리기 도구 satori 는 조합 규칙을 쓰지 않음)
    opts.layout_features = ['kern']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    opts.hinting = False      # 그림으로만 쓰니 힌팅은 필요 없음(용량 절약)
    opts.desubroutinize = False
    s = subset.Subsetter(opts)
    s.populate(unicodes=UNICODES_KSX if only_ksx else UNICODES)
    s.subset(font)
    path = os.path.join(OUT, name)
    font.save(path)
    return path

def metrics(path):
    # 글자 폭 표: 1em 기준 비율. 한글 음절은 대부분 같은 폭이라 한 값(hangul), 나머지는 글자별
    f = TTFont(path)
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    adv = lambda cp: hmtx[cmap[cp]][0] / upm if cp in cmap else None
    hs = sorted({round(adv(c), 4) for c in range(0xAC00, 0xD7A4) if adv(c) is not None})
    chars = {}
    # 한글 폭이 글자마다 다른 글꼴(검은고딕)은 한글도 글자별로 적는다
    uniform = len(hs) <= 1
    for a, b in RANGES:
        if a >= 0xAC00 and b <= 0xD7A3 and uniform:
            continue
        for c in range(a, b + 1):
            v = adv(c)
            if v is not None:
                chars[chr(c)] = round(v, 4)
    # uniform=True 면 한글은 hangul 한 값, False 면 chars 에 글자별로 있고 없는 한글은 이 글꼴에 없는 글자
    return {'hangul': hs[-1] if hs else 1, 'uniform': uniform, 'chars': chars}

os.makedirs(OUT, exist_ok=True)
table = {}
for job in JOBS:
    name, src, w = job[:3]
    # 이미 있는 글꼴은 건너뛴다(다시 만들려면 파일을 지우고 돌린다) — 명조 가변 글꼴 처리가 오래 걸려서
    p = os.path.join(OUT, name)
    if not os.path.exists(p):
        p = build(name, src, w, len(job) > 3 and job[3] == 'ksx')
    table[name] = metrics(p)
    print(name, os.path.getsize(p) // 1024, 'KB')
with open(os.path.join(OUT, 'metrics.json'), 'w', encoding='utf-8') as fp:
    json.dump(table, fp, ensure_ascii=False, separators=(',', ':'))
print('metrics.json', os.path.getsize(os.path.join(OUT, 'metrics.json')) // 1024, 'KB')
