// ─────────────────────────────────────────────────────────────
// 배너 스타일 8종의 색·글꼴·장식 (2026년 11월 24일)
//
// [정본]
//   견본 그림을 만든 scripts/sponsor-banners/make-style-banners.mjs 의 STYLE_CSS 를 옮긴 것이다.
//   그 스크립트는 PC 크롬으로 HTML 을 찍는 방식이라 서버에서 못 돌아서, 서버 그리기 도구(satori)가
//   읽을 수 있는 모양(숫자·문자열 스타일)으로 다시 적었다. 숫자는 모두 1배 크기(px) 기준이고
//   그릴 때 2배로 키운다(bannerRender.tsx 의 S).
//   스타일 색을 바꾸려면 두 곳(이 파일과 견본 스크립트)을 같이 고쳐야 견본과 실제 배너가 같아진다.
//
// [견본과 다른 점]
//   - 꼬리표(tag)·뱃지(bdg)·체크 목록(ex)은 광고주가 넣지 않은 내용이라 지어내지 않는다.
//     꼬리표는 공정 전문 배너면 공정 이름, 올수리 배너면 "종합 인테리어"만 쓰고 그 밖엔 뺀다. 뱃지·체크 목록은 늘 뺀다.
//   - 견본의 비스듬한 장식·그림자 등은 가능한 만큼 같은 값으로 옮겼다.
// ─────────────────────────────────────────────────────────────

/** 배너 규격 구분 글자: h=320x100, r=300x250, p=320x50, w=728x90 (견본 스크립트와 같음) */
export type Z = 'h' | 'r' | 'p' | 'w';

/** 스타일 값 묶음(satori 스타일) */
export type St = Record<string, string | number | undefined>;

/** 글자 한 종류의 글꼴·색 */
export interface TextLook {
  family: string;
  weight: number;
  color: string;
  /** 글자 간격(em) */
  spacing?: number;
  /** 그 밖의 스타일(바탕·테두리 등) */
  extra?: St;
}

/** 스타일 한 개 */
export interface Theme {
  /** 바탕(뿌리 상자) 스타일 */
  root: St;
  /** 장식 상자들(절대 위치). 규격마다 다를 수 있다 */
  decos: (z: Z) => St[];
  /** 규격별 안쪽 여백 바꾸기(왼쪽·오른쪽, 300x250 은 사방) */
  pad?: Partial<Record<Z, { l: number; r: number; t?: number }>>;
  tag: TextLook & { pill?: { bg: string; padX: number; padY: number; radius: number; rotate?: number } };
  hl: TextLook & {
    /** 강조 글자 */
    em: { color: string; family?: string; scale?: number; underline?: string; shadow?: string };
    /** 글자 그림자 */
    shadow?: string;
    /** 규격별 글자 크기·줄 높이 바꾸기 */
    size?: Partial<Record<Z, { fs: number; lh: number; emScale?: number }>>;
  };
  nm: TextLook;
  sub: TextLook;
  btn: TextLook & { box: St; spanOpacity?: number };
  /** 300x250 을 가운데 맞춤으로(골드) */
  centerR?: boolean;
  /** 바탕 상자 테두리 굵기(1배 px) — 글자 칸 폭에서 빼야 테두리에 안 닿는다(팝 3px, 2026년 11월 24일 검사 지적) */
  frame?: number;
  /** 단추 테두리(양쪽 합)·그림자가 차지하는 폭(1배 px) — 글자 칸 계산에 더한다 */
  btnExtra?: number;
  /** 300x250 에서 바닥으로부터 이 높이(1배 px)에 가로선 장식이 있다 — 글자가 선을 넘지 않게(미니멀) */
  rLine?: number;
}

/** 테두리 문자열(1배 굵기 w 를 2배로) */
export const border = (w: number, color: string, S: number) => `${w * S}px solid ${color}`;

/** 스타일 8종(열쇠는 src/lib/ads/bannerStyles.ts 와 같음) */
export function themeOf(key: string, S: number): Theme {
  switch (key) {
    case 'modern':
      return {
        root: { backgroundColor: '#0b0b0c' },
        decos: () => [
          { left: 0, top: 0, bottom: 0, width: 5 * S, backgroundColor: '#c6ff1a' },
          { right: -30 * S, top: -20 * S, width: 110 * S, height: 300 * S, backgroundColor: 'rgba(198,255,26,.07)', transform: 'rotate(20deg)' },
        ],
        pad: { h: { l: 20, r: 12 }, w: { l: 26, r: 16 }, p: { l: 16, r: 8 }, r: { l: 24, r: 16, t: 16 } },
        tag: { family: 'PretBlack', weight: 900, color: '#c6ff1a', spacing: 0.2 },
        hl: { family: 'PretBlack', weight: 900, color: '#ffffff', spacing: -0.03, em: { color: '#c6ff1a' } },
        nm: { family: 'NotoKR', weight: 600, color: '#9a9a9a' },
        sub: { family: 'NotoKR', weight: 400, color: '#bdbdbd' },
        btn: { family: 'PretBlack', weight: 900, color: '#0b0b0c', box: { backgroundColor: '#c6ff1a', borderRadius: 4 * S } },
      };
    case 'minimal':
      return {
        root: { backgroundColor: '#ffffff' },
        decos: (z) => [
          // 견본의 안쪽 1px 테두리(box-shadow inset)
          { left: 0, top: 0, right: 0, bottom: 0, border: border(1, '#e3e3e3', S) },
          ...(z === 'p' ? [] : [{ left: 16 * S, right: 16 * S, bottom: (z === 'r' ? 70 : 0) * S, height: 1 * S, backgroundColor: '#111111' }]),
        ],
        tag: { family: 'NotoKR', weight: 500, color: '#9a9a9a', spacing: 0.22 },
        hl: {
          family: 'PretLight', weight: 300, color: '#111111', spacing: -0.01,
          em: { color: '#111111', underline: '#111111' },
          size: { h: { fs: 19, lh: 23 }, p: { fs: 19, lh: 23 }, w: { fs: 19, lh: 23 }, r: { fs: 27, lh: 34 } },
        },
        // 상호·소개는 작은 규격에서 너무 흐려 보여 견본(#777·#8a8a8a)보다 한 단계 진하게(2026년 11월 24일 검사 지적)
        nm: { family: 'NotoKR', weight: 400, color: '#555555' },
        sub: { family: 'NotoKR', weight: 300, color: '#6e6e6e' },
        btn: { family: 'NotoKR', weight: 600, color: '#111111', spacing: 0.02, box: { backgroundColor: '#ffffff', border: border(1.5, '#111111', S), borderRadius: 0 } },
        btnExtra: 3,
        rLine: 70,
      };
    case 'neon':
      return {
        root: { backgroundImage: 'linear-gradient(120deg, #2a0a6b 0%, #5b21d6 55%, #1d4ed8 100%)' },
        decos: () => [
          { right: -20 * S, top: -40 * S, width: 140 * S, height: 140 * S, borderRadius: 70 * S, backgroundImage: 'radial-gradient(circle, rgba(255,45,149,.55), rgba(255,45,149,0) 70%)' },
          { left: '30%', bottom: -60 * S, width: 160 * S, height: 120 * S, borderRadius: 80 * S, backgroundImage: 'radial-gradient(circle, rgba(0,229,255,.35), rgba(0,229,255,0) 70%)' },
        ],
        tag: { family: 'NotoKR', weight: 800, color: '#7ff0ff', spacing: 0.04 },
        hl: {
          family: 'BlackHan', weight: 400, color: '#ffffff', spacing: -0.01,
          shadow: `0 0 ${12 * S}px rgba(255,255,255,.35)`,
          em: { color: '#ffe600', family: 'BlackHan', scale: 1.15, shadow: `0 0 ${14 * S}px rgba(255,230,0,.7)` },
          size: { r: { fs: 28, lh: 36, emScale: 1.45 } },
        },
        nm: { family: 'NotoKR', weight: 700, color: '#d9ccff' },
        sub: { family: 'NotoKR', weight: 400, color: '#d9ccff' },
        btn: { family: 'NotoKR', weight: 900, color: '#2a0a6b', box: { backgroundColor: '#ffe600', borderRadius: 8 * S, boxShadow: `0 0 ${14 * S}px rgba(255,230,0,.55)` } },
      };
    case 'wood':
      return {
        root: {
          backgroundColor: '#8a5a2e',
          backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 14%, rgba(255,255,255,.06) 14%, rgba(255,255,255,.06) 38%, rgba(0,0,0,0) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,.14) 62%, rgba(0,0,0,.14) 86%, rgba(0,0,0,0) 86%)',
          borderRadius: 16 * S,
        },
        decos: () => [
          {
            left: 6 * S, top: 6 * S, right: 6 * S, bottom: 6 * S, borderRadius: 11 * S, backgroundColor: '#f3e4c8',
            backgroundImage: `repeating-linear-gradient(0deg, rgba(120,80,40,.05) 0px, rgba(120,80,40,.05) ${1 * S}px, rgba(0,0,0,0) ${1 * S}px, rgba(0,0,0,0) ${5 * S}px)`,
          },
        ],
        pad: { h: { l: 20, r: 20 }, r: { l: 22, r: 22, t: 22 }, w: { l: 24, r: 24 }, p: { l: 14, r: 14 } },
        tag: { family: 'Gmarket', weight: 700, color: '#fff4de', pill: { bg: '#8a5a2e', padX: 10, padY: 3, radius: 99 } },
        hl: { family: 'Gmarket', weight: 700, color: '#4a2f18', spacing: -0.03, em: { color: '#c0602b', family: 'Gmarket' } },
        nm: { family: 'NotoKR', weight: 700, color: '#8a5a2e' },
        sub: { family: 'NotoKR', weight: 400, color: '#7a5a3a' },
        btn: { family: 'Gmarket', weight: 700, color: '#ffffff', box: { backgroundColor: '#c0602b', borderRadius: 99 * S } },
      };
    case 'trust':
      return {
        root: { backgroundImage: 'linear-gradient(135deg, #0a2456, #123a80)' },
        decos: () => [
          { right: 0, top: 0, bottom: 0, width: 6 * S, backgroundColor: '#7fb2ff' },
          { left: -30 * S, bottom: -50 * S, width: 120 * S, height: 120 * S, borderRadius: 60 * S, border: border(18, 'rgba(255,255,255,.05)', S) },
        ],
        tag: { family: 'NotoKR', weight: 700, color: '#9cc4ff' },
        hl: { family: 'NotoKR', weight: 800, color: '#ffffff', spacing: -0.02, em: { color: '#8fc0ff' } },
        nm: { family: 'NotoKR', weight: 700, color: '#b9d2f5' },
        sub: { family: 'NotoKR', weight: 400, color: '#c5d8f5' },
        btn: { family: 'NotoKR', weight: 800, color: '#0a2456', box: { backgroundColor: '#ffffff', borderRadius: 8 * S } },
      };
    case 'pop':
      return {
        root: {
          backgroundColor: '#ffd400',
          backgroundImage: `radial-gradient(circle, rgba(255,106,0,.28) ${1.5 * S}px, rgba(255,106,0,0) ${2 * S}px)`,
          backgroundSize: `${10 * S}px ${10 * S}px`,
          border: border(3, '#111111', S),
          borderRadius: 12 * S,
        },
        decos: () => [],
        tag: { family: 'NotoKR', weight: 900, color: '#ffd400', pill: { bg: '#111111', padX: 9, padY: 2, radius: 4, rotate: -2 } },
        hl: { family: 'BlackHan', weight: 400, color: '#111111', spacing: -0.01, em: { color: '#ff2d55', family: 'BlackHan', scale: 1.2 } },
        nm: { family: 'NotoKR', weight: 800, color: '#111111' },
        sub: { family: 'NotoKR', weight: 700, color: '#3a2f00' },
        btn: {
          family: 'NotoKR', weight: 900, color: '#ffffff', spanOpacity: 1,
          box: { backgroundColor: '#ff6a00', border: border(2.5, '#111111', S), borderRadius: 10 * S, boxShadow: `${3 * S}px ${3 * S}px 0 #111111` },
        },
        frame: 3,
        btnExtra: 8, // 테두리 2.5 x 2 + 그림자 3
      };
    case 'gold':
      return {
        root: { backgroundImage: 'radial-gradient(ellipse at 20% 0%, #2a2113 0%, #0d0b08 60%)' },
        decos: (z) => (z === 'p'
          ? [{ left: 2 * S, top: 2 * S, right: 2 * S, bottom: 2 * S, border: border(1, '#c8a24a', S) }]
          : [
              { left: 4 * S, top: 4 * S, right: 4 * S, bottom: 4 * S, border: border(1, '#c8a24a', S) },
              { left: 7 * S, top: 7 * S, right: 7 * S, bottom: 7 * S, border: border(1, 'rgba(200,162,74,.4)', S) },
            ]),
        pad: { h: { l: 18, r: 18 }, p: { l: 12, r: 12 }, w: { l: 24, r: 24 }, r: { l: 22, r: 22, t: 22 } },
        tag: { family: 'NotoSerif', weight: 600, color: '#c8a24a', spacing: 0.2 },
        hl: { family: 'NotoSerif', weight: 700, color: '#f3d98a', spacing: -0.01, em: { color: '#d9b45a', family: 'NotoSerif' } },
        nm: { family: 'NotoSerif', weight: 600, color: '#c8a24a' },
        sub: { family: 'NotoSerif', weight: 400, color: '#cdb98a' },
        btn: { family: 'NotoSerif', weight: 800, color: '#1a1306', box: { backgroundImage: 'linear-gradient(180deg, #f3d98a, #b88a2e)', borderRadius: 2 * S } },
        centerR: true,
      };
    case 'classic':
    default:
      return {
        root: {
          backgroundColor: '#f7efe3',
          backgroundImage: `repeating-linear-gradient(90deg, rgba(120,90,50,.05) 0px, rgba(120,90,50,.05) ${1 * S}px, rgba(0,0,0,0) ${1 * S}px, rgba(0,0,0,0) ${6 * S}px)`,
        },
        decos: () => [],
        tag: { family: 'NotoKR', weight: 700, color: '#ffffff', pill: { bg: '#2a1f17', padX: 10, padY: 3, radius: 99 } },
        hl: { family: 'NotoKR', weight: 800, color: '#2a1f17', spacing: -0.02, em: { color: '#b57514' } },
        nm: { family: 'NotoKR', weight: 800, color: '#8a5f12' },
        sub: { family: 'NotoKR', weight: 400, color: '#6b5a4a' },
        btn: { family: 'NotoKR', weight: 800, color: '#ffffff', box: { backgroundColor: '#c88a1f', borderRadius: 10 * S } },
      };
  }
}

/** 스타일이 쓰는 글꼴 이름 목록(글꼴 파일을 필요한 것만 읽으려고) */
export function themeFamilies(t: Theme): string[] {
  return [...new Set([t.tag.family, t.hl.family, t.hl.em.family ?? t.hl.family, t.nm.family, t.sub.family, t.btn.family])];
}
