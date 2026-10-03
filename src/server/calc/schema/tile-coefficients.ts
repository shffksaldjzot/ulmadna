// ──────────────────────────────────────────────
// 타일 계산기 — 계수(로스율·소요량·하루 시공량·기본 면적) — 서버 전용
//
// ┌─ 형아 확인 필요 ─────────────────────────────────────────────┐
// │ 아래 값은 설계서(docs/설계_20261003_타일계산기.md) §10의 미결 5~13번을  │
// │ 설계서 후보값·통상값으로 임시로 채운 것이다. 확정되면 이 파일만 고치면 된다. │
// │                                                                │
// │  5. 간단 모드 공법 기본값      → DEFAULT_METHOD (욕실·현관·베란다 '철거 후 새로', 거실 '기존 바닥 철거') │
// │  6. 기본 규격                 → src/lib/v1/tilePresets.ts defaultSizeCodeFor·bathFloorCodeFor │
// │  7. 욕실 기본 치수            → src/lib/v1/tilePresets.ts BATH_PRESETS (공용 1.6×2.1·안방 1.7×2.4·높이 2.3m) │
// │  8. 문·창 차감 크기, 욕조     → DOOR_SIZE_M(0.8×2.0) · WINDOW_SIZE_M(0.6×0.6) · TUB_* │
// │  9. 방수 범위                 → 철거 후 새로일 때 욕실 칸마다 항상 포함(WATERPROOF_ON_DEMOLISH) │
// │ 10. 600×1200·800×800 박스당   → tilePresets.ts TILE_SIZES (2장·3장) │
// │ 11. 붙임 공법                 → 떠붙임 선택지 둠, 압착 바름 7mm(ADHESIVE_KG_PER_SQM) │
// │ 12. 욕실 2칸 할인             → BATH2_DISCOUNT_RATE = 0 (할인 없음) │
// │ 13. 범위 밖 공간              → 현관·베란다는 넣음, 도기·천장 등 욕실 나머지 공정은 뺌("타일만") │
// │  +  현관·베란다 기본 면적      → ENTRANCE_SQM_AT_34 · BALCONY_SQM_AT_34 │
// │  +  하루 시공량·가산율        → PRODUCTIVITY_* · *_LABOR_MULT (견적DB 표본 부족, 추정) │
// └────────────────────────────────────────────────────────────────┘
//
// 형아가 이미 정한 것(2026-10-03):
//   · 로스율 기본값 — 정배열 벽 5%·바닥 10%, 엇배열 12%, 대각 15%, 헤링본 20%(패턴 4종 모두)
//   · 대형 타일(600×600 이상) 덧방 — 막지 않고 경고만
//   · 단가표 — 견적DB 추출(src/server/pricing/tile.ts)
//
// 등급: A=표준품셈·제조사·기하학 / B=복수 출처·실측 / C=추정
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import 'server-only';

import type { TileMethod, TilePattern, TileScope } from '@/lib/v1/tilePresets';

/** 근거 등급이 붙은 숫자 하나 */
export interface TileCoefficient {
  value: number;
  grade: 'A' | 'B' | 'C';
  source: string;
}

// ── 형아 확인 필요 값들 ───────────────────────

/** 5. 간단 모드 공법 기본값 — 거실은 마루 위 타일이 드물어 "기존 바닥 철거"를 기본으로 둔다 */
export function defaultMethodFor(scope: TileScope | undefined): TileMethod {
  // 지금은 공간과 상관없이 같은 값 — 형아가 공간별로 다르게 정하면 여기서 scope로 가른다
  void scope;
  return 'demolish';
}

/** 8. 문 1개 크기(m) — 욕실 문 관행 폭 0.8m × 높이 2.0m (C) */
export const DOOR_SIZE_M = { widthM: 0.8, heightM: 2.0 };
/** 8. 창 1개 크기(m) — 욕실 소형창 관행 0.6×0.6m (C) */
export const WINDOW_SIZE_M = { widthM: 0.6, heightM: 0.6 };
/** 8. 욕조 — 길이 1.5m·높이 0.55m 앞판(벽 타일 대신 욕조 앞판)과 욕조 바닥 1.5×0.7m를 뺀다 (C) */
export const TUB_FRONT_M = { lengthM: 1.5, heightM: 0.55 };
export const TUB_FLOOR_M = { lengthM: 1.5, depthM: 0.7 };
/** 8. 간단 모드 욕실은 문 1개를 뺀다, 욕조는 없다고 본다 */
export const SIMPLE_BATH_DOORS = 1;

/** 9. 철거 후 새로 시공이면 욕실 칸마다 방수를 넣는다 */
export const WATERPROOF_ON_DEMOLISH = true;

/** 12. 욕실 2칸 동시 시공 할인율 — 0(할인 없음) */
export const BATH2_DISCOUNT_RATE = 0;

/**
 * 현관 기본 면적(34평 기준, ㎡) — 견적DB 현관 바닥타일 ㎡ 수량(3~5㎡)의 가운데쯤(C).
 * 평형에 비례해 늘리고 2.5~6㎡로 자른다.
 */
export const ENTRANCE_SQM_AT_34: TileCoefficient = { value: 4, grade: 'C', source: '견적DB 현관 바닥타일 ㎡ 수량 가운데값' };
export const ENTRANCE_SQM_MIN = 2.5;
export const ENTRANCE_SQM_MAX = 6;
/** 베란다 기본 면적(34평 기준, ㎡) — 견적DB 발코니 타일 수량(2~32㎡로 편차 큼)에서 앞·뒤 베란다 1곳 정도로 잡은 값(C) */
export const BALCONY_SQM_AT_34: TileCoefficient = { value: 8, grade: 'C', source: '견적DB 발코니 타일 ㎡ 수량(편차 큼) — 1곳 기준 추정' };
export const BALCONY_SQM_MIN = 3;
export const BALCONY_SQM_MAX = 20;
/** 간단 모드 평형 기본값(거실·현관·베란다) */
export const DEFAULT_PYEONG = 34;
/** 거실 면적 계산용 베이 기본값 */
export const DEFAULT_BAY: 2 | 3 | 4 = 3;

// ── 로스율(형아 확정) ─────────────────────────

/**
 * 패턴·면별 로스율 — 형아 확정(2026-10-03). 설계서 §4-1 근거:
 * 정배열 현장 관행 5~10%(B) · 엇배열 약 12%(C) · 대각 12~15%(B/C) · 헤링본 18~20%(C).
 * 정배열만 벽/바닥을 나누고 나머지는 벽·바닥 같은 값을 쓴다.
 */
export const LOSS_RATE: Record<TilePattern, { wall: number; floor: number }> = {
  straight: { wall: 0.05, floor: 0.1 },
  offset: { wall: 0.12, floor: 0.12 },
  diagonal: { wall: 0.15, floor: 0.15 },
  herringbone: { wall: 0.2, floor: 0.2 },
};

// ── 부자재 소요량 ─────────────────────────────

/** 압착시멘트 ㎡당 kg — 바름 7mm 5~5.5kg(B, 설계서 §4-4) → 5.5. 대형(600 이상)은 바름 10mm 7~8kg → 7.5 */
export const ADHESIVE_KG_PER_SQM: TileCoefficient = { value: 5.5, grade: 'B', source: '설계서 §4-4 — 압착시멘트 바름 7mm 5~5.5kg/㎡' };
export const ADHESIVE_KG_PER_SQM_LARGE: TileCoefficient = { value: 7.5, grade: 'B', source: '설계서 §4-4 — 압착시멘트 바름 10mm 7~8kg/㎡' };
/** 압착시멘트 포장(kg) — 견적서 표기 20kg(B) */
export const ADHESIVE_BAG_KG = 20;
/** 떠붙임 몰탈 ㎡당 kg — 15~20kg 추정(C, 설계서 §4-4) → 18 */
export const MORTAR_BED_KG_PER_SQM: TileCoefficient = { value: 18, grade: 'C', source: '설계서 §4-4 — 떠붙임 몰탈 15~20kg 추정' };
/** 떠붙임 몰탈 포장(kg) — 레미탈 40kg 포 */
export const MORTAR_BED_BAG_KG = 40;

/** 줄눈 깊이(mm) — 타일 두께 관행 8mm로 본다(C) */
export const GROUT_DEPTH_MM = 8;
/** 줄눈재 비중(kg/L) — 시멘트계 줄눈 1.6(C) */
export const GROUT_DENSITY_KG_PER_L = 1.6;
/** 줄눈재 로스 — 15~20%(B, 설계서 §4-3) → 20% */
export const GROUT_LOSS_RATE = 0.2;
/** 줄눈재 포장(kg) — 2kg 포가 견적서에 가장 흔함(B) */
export const GROUT_BAG_KG = 2;
/** 줄눈 폭 기본값(mm) — 국산 300×600·600×600 2~3mm 관행(B) */
export const DEFAULT_GROUT_MM = 2;

// ── 하루 시공량·가산율(인건) ──────────────────

/** 욕실 벽·바닥 하루 시공량(㎡/인) — 견적DB 인원 수량(욕실 1칸 2.5~3.5인)·㎡ 인건(n=5) 역산(C) */
export const PRODUCTIVITY_BATH_SQM_PER_MANDAY: TileCoefficient = { value: 7, grade: 'C', source: '견적DB 욕실 1칸 2.5~3.5인 · ㎡ 인건 4.5만~5.5만원' };
/** 거실·현관·베란다 바닥 하루 시공량(㎡/인) — 견적DB 평 단위 인건(n=3) 역산(C) */
export const PRODUCTIVITY_FLOOR_SQM_PER_MANDAY: TileCoefficient = { value: 14, grade: 'C', source: '견적DB 평 단위 인건 8만원/평 역산' };
/** 품 수 최소(작은 현관도 한 사람 하루) */
export const MIN_MANDAYS = 1;
/** 품 수 올림 단위(0.5품) */
export const MANDAY_STEP = 0.5;
/** 패턴별 인건 가산(C) */
export const PATTERN_LABOR_MULT: Record<TilePattern, number> = {
  straight: 1,
  offset: 1.05,
  diagonal: 1.2,
  herringbone: 1.3,
};
/** 대형 타일(600×1200·800×800 같은 한 변 800 이상) 인건 가산(C) */
export const LARGE_TILE_LABOR_MULT = 1.15;
/** 떠붙임 인건 가산(C) */
export const MORTAR_BED_LABOR_MULT = 1.2;
/** 대형 타일 판정 — 긴 변이 이 값(mm) 이상이면 대형 가산(자재·인건) */
export const LARGE_TILE_LONG_SIDE_MM = 800;
