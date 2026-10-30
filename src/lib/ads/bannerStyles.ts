// ──────────────────────────────────────────────
// 광고 견본 스타일 표 — 2026-10-30
//
// [무슨 기능인가]
//   배너 견본 스타일 8종의 열쇠·이름·한 줄 설명을 한곳에 둔다.
//   /sponsor 견본 스타일 구획, 제작 대행 신청 마법사, 광고주 카드, 관리자 주문 화면이 이 표를 같이 쓴다.
//   견본 그림은 public/sponsor/styles/<열쇠>/<규격>.png (scripts/sponsor-banners/make-style-banners.mjs 가 만든다).
// ──────────────────────────────────────────────

/** 스타일 한 개 */
export interface BannerStyle {
  /** 저장·그림 폴더에 쓰는 열쇠(영문 소문자) */
  key: string;
  /** 광고주에게 보이는 이름 */
  name: string;
  /** 한 줄 설명 */
  desc: string;
  /** 견본에 쓴 가상 업체 상호 */
  fakeBiz: string;
}

/** 스타일 8종 (보여 주는 순서) */
export const BANNER_STYLES: readonly BannerStyle[] = [
  { key: 'classic', name: '클래식', desc: '크림 바탕에 갈색·황금, 믿음직하고 포근한 느낌', fakeBiz: '한결도배' },
  { key: 'modern', name: '모던 블랙', desc: '검정 바탕에 굵은 흰 글자, 형광 포인트 하나', fakeBiz: '올데이타일' },
  { key: 'minimal', name: '화이트 미니멀', desc: '흰 바탕에 얇은 선, 한 줄로 조용하게', fakeBiz: '담담욕실' },
  { key: 'neon', name: '네온 임팩트', desc: '진한 보라 그라데이션에 큰 숫자, 눈에 확 띄게', fakeBiz: '번개창호' },
  { key: 'wood', name: '따뜻한 우드', desc: '나무 질감과 베이지, 둥근 모서리로 아늑하게', fakeBiz: '온기주방' },
  { key: 'trust', name: '신뢰 블루', desc: '남색과 흰색, 체크 표시와 경력으로 믿음을 주는 느낌', fakeBiz: '믿음올수리' },
  { key: 'pop', name: '팝 컬러', desc: '노랑·주황에 굵은 테두리와 말풍선, 발랄하게', fakeBiz: '쏙쏙바닥' },
  { key: 'gold', name: '프리미엄 골드', desc: '검정 바탕에 금박 선과 세리프 글꼴, 고급스럽게', fakeBiz: '더클래스전기' },
] as const;

/** 스타일 열쇠 목록 */
export const BANNER_STYLE_KEYS: readonly string[] = BANNER_STYLES.map((s) => s.key);

/** 견본 그림 규격 4종: 파일 이름과 1배 크기 */
export const STYLE_SIZES = [
  { file: '320x100', w: 320, h: 100 },
  { file: '300x250', w: 300, h: 250 },
  { file: '320x50', w: 320, h: 50 },
  { file: '728x90', w: 728, h: 90 },
] as const;

/** 열쇠로 스타일 찾기(없으면 null) */
export function bannerStyleOf(key: unknown): BannerStyle | null {
  return BANNER_STYLES.find((s) => s.key === key) ?? null;
}

/** 입력 값이 스타일 열쇠면 그대로, 아니면 빈 문자열(= 맡김) */
export function cleanStyleKey(v: unknown): string {
  return typeof v === 'string' && BANNER_STYLE_KEYS.includes(v) ? v : '';
}

/** 견본 그림 주소 */
export function styleImg(key: string, size: (typeof STYLE_SIZES)[number]['file']): string {
  return `/sponsor/styles/${key}/${size}.png`;
}

/** 화면에 보일 스타일 이름("" 이면 "맡김") */
export function styleLabel(key: unknown): string {
  return bannerStyleOf(key)?.name ?? '맡김';
}
