// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 공용 선택지·범위 (서버·화면 둘 다 쓴다)
//
// 여기엔 "공개해도 되는 값"만 둔다:
//   · 공간·공법·패턴·등급 같은 선택지 이름
//   · 타일 규격과 규격별 박스당 장 수 관례(제품 상자에 적힌 공개 정보)
//   · 입력 범위(설계서 §6-1)
//   · 욕실 기본 치수(추정값, 화면에도 "추정"으로 보여 준다)
// 단가·로스율·소요량·하루 시공량 같은 계수는 여기 두지 않는다 —
// 전부 src/server/calc/schema/tile-coefficients.ts · src/server/pricing/tile.ts(서버 전용)에 있다.
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

/** 간단 모드 공간 — 욕실 1칸 / 욕실 2칸 / 거실(+주방) / 현관 / 베란다 */
export type TileScope = 'bath1' | 'bath2' | 'living' | 'entrance' | 'balcony';
/** 공법 — 덧방(기존 타일 위에 붙임) / 철거 후 새로 / 철거 없음(거실 바닥에서 기존 바닥 그대로) */
export type TileMethod = 'overlay' | 'demolish' | 'none';
/** 시공 — 맡김(시공까지) / 셀프(자재만) */
export type TileService = 'pro' | 'self';
/** 붙이는 모양(패턴) — 정배열 / 엇배열(벽돌식) / 대각 / 헤링본 */
export type TilePattern = 'straight' | 'offset' | 'diagonal' | 'herringbone';
/** 자재 등급 — 보급 / 중급 / 고급 */
export type TileGrade = 'basic' | 'mid' | 'high';
/** 붙임 공법 — 압착(압착시멘트) / 떠붙임(몰탈) */
export type TileSetting = 'press' | 'mortar';
/** 정확 모드 실 종류 — 욕실(벽+바닥) / 바닥면 / 벽면 */
export type TileRoomKind = 'bath' | 'floor' | 'wall';

/** 공간 칩 순서와 이름 */
export const TILE_SCOPES: { value: TileScope; label: string }[] = [
  { value: 'bath1', label: '욕실 1칸' },
  { value: 'bath2', label: '욕실 2칸' },
  { value: 'living', label: '거실 바닥' },
  { value: 'entrance', label: '현관' },
  { value: 'balcony', label: '베란다' },
];

/** 공간이 욕실인지 */
export function isBathScope(scope: TileScope | undefined): boolean {
  return scope === 'bath1' || scope === 'bath2';
}

/** 공간마다 고를 수 있는 공법 칩 — 거실은 "기존 바닥 철거 / 철거 없음", 나머지는 "덧방 / 철거 후 새로" */
export function methodOptionsFor(scope: TileScope | undefined): { value: TileMethod; label: string }[] {
  if (scope === 'living') {
    return [
      { value: 'demolish', label: '기존 바닥 철거' },
      { value: 'none', label: '철거 없음' },
    ];
  }
  return [
    { value: 'overlay', label: '덧방' },
    { value: 'demolish', label: '철거 후 새로' },
  ];
}

/** 공법 이름(가정 문구·요약 줄에 쓴다) */
export function methodLabel(scope: TileScope | undefined, method: TileMethod): string {
  return methodOptionsFor(scope).find((o) => o.value === method)?.label ?? (method === 'overlay' ? '덧방' : method === 'none' ? '철거 없음' : '철거 후 새로');
}

/** 패턴 칩 */
export const TILE_PATTERNS: { value: TilePattern; label: string }[] = [
  { value: 'straight', label: '정배열' },
  { value: 'offset', label: '엇배열' },
  { value: 'diagonal', label: '대각' },
  { value: 'herringbone', label: '헤링본' },
];

/** 등급 칩 */
export const TILE_GRADES: { value: TileGrade; label: string }[] = [
  { value: 'basic', label: '보급' },
  { value: 'mid', label: '중급' },
  { value: 'high', label: '고급' },
];

/** 줄눈 폭 칩(mm) — 설계서 §5-4 */
export const GROUT_MM_CHIPS: readonly number[] = [1.5, 2, 3, 5];

/** 평형 조정 칩(거실·현관·베란다) */
export const TILE_PYEONG_CHIPS: readonly number[] = [24, 34, 44];

// ── 타일 규격 ────────────────────────────────

/** 타일 규격 하나 — 가로·세로(mm)와 박스당 장 수 관례 */
export interface TileSizePreset {
  /** 고유 이름(예: '300x600') */
  code: string;
  /** 화면 이름(예: '300×600') */
  label: string;
  widthMm: number;
  lengthMm: number;
  /** 박스당 장 수 관례 — 제품 상자 표기와 다르면 정확 모드에서 고칠 수 있다 */
  piecesPerBox: number;
  /** 박스당 장 수가 출처 없는 관례값인지(화면에 "확인" 표시) */
  piecesEstimated: boolean;
}

/**
 * 규격별 박스당 장 수 — 설계서 §4-2.
 *   300×600 8장·600×600 4장(1.44㎡, B) / 300×300 11장·250×400 10장(약 1㎡, 제품별 상이) /
 *   600×1200 2장·800×800 3장(출처 없음, 형아 확인 필요 — 회사가 쓰는 제품 기준으로 바꿀 것)
 */
export const TILE_SIZES: TileSizePreset[] = [
  { code: '300x300', label: '300×300', widthMm: 300, lengthMm: 300, piecesPerBox: 11, piecesEstimated: true },
  { code: '250x400', label: '250×400', widthMm: 250, lengthMm: 400, piecesPerBox: 10, piecesEstimated: true },
  { code: '300x600', label: '300×600', widthMm: 300, lengthMm: 600, piecesPerBox: 8, piecesEstimated: false },
  { code: '600x600', label: '600×600', widthMm: 600, lengthMm: 600, piecesPerBox: 4, piecesEstimated: false },
  { code: '600x1200', label: '600×1200', widthMm: 600, lengthMm: 1200, piecesPerBox: 2, piecesEstimated: true },
  { code: '800x800', label: '800×800', widthMm: 800, lengthMm: 800, piecesPerBox: 3, piecesEstimated: true },
];

/** 규격 이름으로 찾기 */
export function findTileSize(code: string | undefined): TileSizePreset | undefined {
  return code ? TILE_SIZES.find((s) => s.code === code) : undefined;
}

/** 공간마다 간단 모드에 보여 줄 규격 칩 3개 */
export function sizeChipsFor(scope: TileScope | undefined): string[] {
  switch (scope) {
    case 'living':
      return ['600x600', '600x1200', '800x800'];
    case 'entrance':
      return ['300x300', '600x600', '600x1200'];
    case 'balcony':
      return ['300x300', '300x600', '600x600'];
    default:
      return ['300x600', '600x600', '600x1200'];
  }
}

/** 규격 칩 아래 1줄 캡션(용도) — 설계서 §3 (c) */
export function sizeCaption(code: string): string {
  switch (code) {
    case '300x300':
      return '바닥 미끄럼에 무난';
    case '300x600':
      return '욕실 벽 기본';
    case '600x600':
      return '포세린 · 욕실·현관';
    case '600x1200':
      return '대형 · 거실 바닥';
    case '800x800':
      return '대형 · 줄눈 적음';
    default:
      return '';
  }
}

/**
 * 간단 모드 기본 규격(안 골랐을 때 가정) — 형아 확인 필요(설계서 §10-6).
 * 욕실: 벽 300×600 · 바닥 300×300 / 거실 600×1200 / 현관 600×600 / 베란다 300×300
 */
export function defaultSizeCodeFor(scope: TileScope | undefined): string {
  switch (scope) {
    case 'living':
      return '600x1200';
    case 'entrance':
      return '600x600';
    case 'balcony':
      return '300x300';
    default:
      return '300x600';
  }
}

/**
 * 욕실은 규격 칩 하나로 벽·바닥을 같이 정한다 — 바닥은 배수 구배(물매) 때문에 너무 큰 타일을
 * 피하는 관행을 따른다: 300×600 → 바닥 300×300, 600×600 → 바닥도 600×600, 600×1200 → 바닥 600×600.
 */
export function bathFloorCodeFor(wallCode: string): string {
  if (wallCode === '600x600' || wallCode === '600x1200' || wallCode === '800x800') return '600x600';
  return '300x300';
}

/** 대형 타일(600×600 이상)인지 — 덧방 경고 판정에 쓴다(형아 결정: 막지 않고 경고만) */
export function isLargeTile(widthMm: number, lengthMm: number): boolean {
  return Math.min(widthMm, lengthMm) >= 600 && Math.max(widthMm, lengthMm) >= 600;
}

// ── 욕실 기본 치수(추정) ─────────────────────

/** 욕실 치수(mm) */
export interface BathDims {
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

/**
 * 84타입 욕실 추정 치수 — 설계서 §4-7(C, 추정) 범위의 가운데 값 + 높이 2.3m 가정.
 * 형아 확인 필요(회사 실측 기준으로 바꿀 것). 간단 모드 욕실 계산과 정확 모드 "84타입 불러오기"가 같은 값을 쓴다.
 */
export const BATH_PRESETS: { key: 'master' | 'common'; label: string; dims: BathDims }[] = [
  { key: 'common', label: '공용욕실', dims: { widthMm: 1600, depthMm: 2100, heightMm: 2300 } },
  { key: 'master', label: '안방욕실', dims: { widthMm: 1700, depthMm: 2400, heightMm: 2300 } },
];

// ── 입력 범위(설계서 §6-1·§5-4) — 화면 안내와 서버 검증이 같은 값을 쓴다 ──

export const TILE_PYEONG_MIN = 10;
export const TILE_PYEONG_MAX = 80;
export const TILE_ROOMS_MAX = 6;
/** 실 가로·세로(mm) — 서버는 넓게(800~10000), 욕실 화면 안내는 800~4000 */
export const TILE_ROOM_MM_MIN = 800;
export const TILE_ROOM_MM_MAX = 10000;
export const TILE_BATH_MM_MAX = 4000;
/** 높이(mm) — 욕실은 1800~2800 */
export const TILE_HEIGHT_MM_MIN = 1800;
export const TILE_HEIGHT_MM_MAX = 2800;
/** 벽면 실 높이 하한(mm) — 주방 상판 위 벽(약 600mm)처럼 낮은 벽도 넣을 수 있게 300(2026-10-03 검사관 지적) */
export const TILE_WALL_HEIGHT_MM_MIN = 300;

/** 실 종류별 높이 하한 — 벽면만 낮게 허용한다(화면 안내·서버 검증이 같이 쓴다) */
export function heightMinFor(kind: TileRoomKind): number {
  return kind === 'wall' ? TILE_WALL_HEIGHT_MM_MIN : TILE_HEIGHT_MM_MIN;
}
/** 면적으로 직접 넣을 때(㎡) */
export const TILE_AREA_SQM_MIN = 0.1;
export const TILE_AREA_SQM_MAX = 300;
/** 타일 한 장 규격(mm) */
export const TILE_DIM_MM_MIN = 100;
export const TILE_DIM_MM_MAX = 1600;
/** 박스당 장 수 */
export const TILE_PIECES_MIN = 1;
export const TILE_PIECES_MAX = 40;
/** 줄눈 폭(mm) */
export const TILE_GROUT_MM_MIN = 1;
export const TILE_GROUT_MM_MAX = 10;
/** 로스율(비율) */
export const TILE_LOSS_MAX = 0.3;
/** 빼는 면적 개수(문·창) 상한 */
export const TILE_OPENING_COUNT_MAX = 10;
