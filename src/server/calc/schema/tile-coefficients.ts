// ──────────────────────────────────────────────
// 타일 계산기 — 계수(로스율·소요량·하루 시공량·기본 면적) — 서버 전용
//
// ┌─ 형아 확인 필요 ─────────────────────────────────────────────────────┐
// │ 설계서(docs/설계_20261003_타일계산기.md) §10의 미결 5~13번을 2026-10-08 개편 때    │
// │ 현장 관행·견적DB(n≥10 항목)·시장 비교로 "임시 확정"했다. 값마다 근거를 1줄 달았고, │
// │ 확정되면 이 파일(과 src/server/pricing/tile.ts)만 고치면 된다.                       │
// │                                                                        │
// │  5. 간단 모드 공법 기본값   → defaultMethodFor: 주방 벽만 덧방, 나머지 철거 후 새로      │
// │  6. 기본 규격·종류         → tilePresets.ts defaultKindFor·defaultSizeForKind              │
// │  7. 욕실 기본 치수         → tilePresets.ts BATH_PRESETS·dimPresetsFor (높이 2.3m)        │
// │  8. 문·창 차감 크기, 욕조   → DOOR_SIZE_M 0.8×2.0 · WINDOW_SIZE_M 0.6×0.6 · 욕조 기본 없음  │
// │  9. 방수 범위              → 욕실 + 철거 후 새로면 기본 켬(칸 단가에 바닥+벽 하단 포함)     │
// │ 10. 600×1200·800×800 박스  → tilePresets.ts TILE_SIZES 2장(1.44㎡)·3장(1.92㎡)           │
// │ 11. 붙임 공법              → 압착·떠붙임·본드 3가지, 추천 규칙 tilePresets.recommendSetting │
// │ 12. 욕실 2칸 할인          → 0(인건이 이미 면적 비례 — 따로 안 깎음)                       │
// │ 13. 범위 밖 공간           → 주방 벽·현관·베란다 넣음, 도기·천장 등 욕실 나머지 공정은 뺌    │
// │  +  하루 시공량 표·조공 비율·난이도 → PRODUCTIVITY_* · HELPER_RATIO · SPACE_DIFFICULTY     │
// │  +  코너비드·실리콘 개수, 대형 로스 → CORNER_BEADS_PER · SILICONE_PER · LARGE_TILE_MIN_LOSS │
// └────────────────────────────────────────────────────────────────────────┘
//
// 형아가 이미 정한 것(2026-10-03) — 이번 개편에서도 그대로 둔다:
//   · 로스율 기본값 — 정배열 벽 5%·바닥 10%, 엇배열 12%, 대각 15%, 헤링본 20%
//     (토리 개편안의 "직선 8%·대각/헤링본 12%"와 다르다 — 형아 확정값이 우선. 대형 10%만 새로 더함)
//   · 대형 타일(600×600 이상) 덧방 — 막지 않고 경고만
//   · 단가표 — 견적DB 추출(src/server/pricing/tile.ts)
//
// 등급: A=표준품셈·제조사·기하학 / B=복수 출처·실측 / C=추정
// 작성일: 2026년 10월 03일
// 개편(미결 5~13 임시 확정·공법별 시공량 표·조공·부자재 개수): 2026년 10월 08일
// ──────────────────────────────────────────────

import 'server-only';

import type { TileMethod, TilePattern, TileScope, TileSetting, TileSpace } from '@/lib/v1/tilePresets';

/** 근거 등급이 붙은 숫자 하나 */
export interface TileCoefficient {
  value: number;
  grade: 'A' | 'B' | 'C';
  source: string;
}

// ── 5. 공법 기본값 ─────────────────────────────

/**
 * 5. 공법 기본값(형아 확인 필요) — 주방 벽만 "덧방", 나머지는 "철거 후 새로".
 * 근거: 견적DB 욕실 철거 식 n=36·타일 철거 식 n=34로 욕실·현관 견적 대부분이 철거를 포함한다.
 *       주방 벽은 상판·상부장을 그대로 두고 기존 타일 위에 본드로 덧방하는 경우가 많다(현장 관행, C).
 */
export function defaultMethodFor(place: TileScope | TileSpace | undefined): TileMethod {
  if (place === 'kitchen' || place === 'kitchenWall') return 'overlay';
  return 'demolish';
}

// ── 8. 문·창·욕조 ─────────────────────────────

/** 8. 문 1개 크기(m) — 욕실 문 관행 폭 0.8m × 높이 2.0m. 근거: 아파트 욕실문 틀 750~800×2,000~2,100mm 관행(C) */
export const DOOR_SIZE_M = { widthM: 0.8, heightM: 2.0 };
/** 8. 창 1개 크기(m) — 욕실 소형창 0.6×0.6m. 근거: 84타입 욕실 환기창 관행(C) */
export const WINDOW_SIZE_M = { widthM: 0.6, heightM: 0.6 };
/** 8. 욕조 — 길이 1.5m·높이 0.55m 앞판과 바닥 1.5×0.7m를 뺀다. 욕조는 기본 "없음"(최근 리모델링은 욕조 철거·샤워부스가 다수, C) */
export const TUB_FRONT_M = { lengthM: 1.5, heightM: 0.55 };
export const TUB_FLOOR_M = { lengthM: 1.5, depthM: 0.7 };
/** 8. 욕실 벽은 문 1개를 기본으로 뺀다 */
export const SIMPLE_BATH_DOORS = 1;

// ── 9. 방수 ───────────────────────────────────

/**
 * 9. 방수 기본값 — 욕실이고 "철거 후 새로"면 켬(형아 확인 필요).
 * 근거: 철거하면 기존 방수층이 깨지므로 다시 해야 한다(05_욕실_타일 4-3). 칸 단가(견적DB 방수 개소 n=12)에
 *       바닥 전체 + 벽 하단(샤워 구역 1.2m 안팎)이 들어 있다고 본다. 덧방이면 기본 끔.
 */
export function defaultWaterproof(isBath: boolean, method: TileMethod): boolean {
  return isBath && method === 'demolish';
}

/** 12. 욕실 2칸 동시 시공 할인율 — 0. 근거: 인건을 이미 면적 비례 품 수로 내서 2칸이면 최소 품(1일)만 한 번 빠진다 */
export const BATH2_DISCOUNT_RATE = 0;

// ── 공간 기본 면적(간단 모드) ─────────────────

/**
 * 현관 기본 면적(34평 기준, ㎡) — 견적DB 현관 바닥타일 ㎡ 수량(3~5㎡, n=11)의 가운데쯤(C).
 * 평형에 비례해 늘리고 2.5~6㎡로 자른다.
 */
export const ENTRANCE_SQM_AT_34: TileCoefficient = { value: 4, grade: 'C', source: '견적DB 현관 바닥타일 ㎡ 수량 가운데값' };
export const ENTRANCE_SQM_MIN = 2.5;
export const ENTRANCE_SQM_MAX = 6;
/** 베란다 기본 면적(34평 기준, ㎡) — 견적DB 발코니 타일 수량(2~32㎡로 편차 큼)에서 앞·뒤 베란다 1곳 정도로 잡은 값(C) */
export const BALCONY_SQM_AT_34: TileCoefficient = { value: 8, grade: 'C', source: '견적DB 발코니 타일 ㎡ 수량(편차 큼) — 1곳 기준 추정' };
export const BALCONY_SQM_MIN = 3;
export const BALCONY_SQM_MAX = 20;
/**
 * 13. 주방 벽 기본 면적(34평 기준, ㎡) — 상부장~하부장 사이 높이 0.6m × 주방 벽 길이 약 4m(ㄱ자) = 2.4㎡(C).
 * 근거: 84타입 주방 싱크 3.0~3.6m + 꺾인 면 관행. 평형 비례, 1.5~5㎡로 자른다.
 */
export const KITCHEN_WALL_SQM_AT_34: TileCoefficient = { value: 2.4, grade: 'C', source: '84타입 주방 벽 길이 약 4m × 상부장 아래 0.6m 관행' };
export const KITCHEN_WALL_SQM_MIN = 1.5;
export const KITCHEN_WALL_SQM_MAX = 5;
/** 간단 모드 평형 기본값(거실·현관·베란다·주방) */
export const DEFAULT_PYEONG = 34;
/** 거실 면적 계산용 베이 기본값 */
export const DEFAULT_BAY: 2 | 3 | 4 = 3;

// ── 로스율(형아 확정 + 대형 하한) ─────────────

/**
 * 패턴·면별 로스율 — 형아 확정(2026-10-03). 설계서 §4-1 근거:
 * 정배열 현장 관행 5~10%(B) · 엇배열 약 12%(C) · 대각 12~15%(B/C) · 헤링본 18~20%(C).
 */
export const LOSS_RATE: Record<TilePattern, { wall: number; floor: number }> = {
  straight: { wall: 0.05, floor: 0.1 },
  offset: { wall: 0.12, floor: 0.12 },
  diagonal: { wall: 0.15, floor: 0.15 },
  herringbone: { wall: 0.2, floor: 0.2 },
};

/**
 * 대형 타일(긴 변 800mm 이상) 로스 하한 10% — 한 장이 커서 자투리가 다시 쓰이지 않는다(형아 확인 필요, C).
 * 근거: 토리 개편안 "대형 10%" + 600×1200 한 장 0.72㎡라 끝 재단 1장만 버려도 1㎡ 안팎이 남는 현장 관행.
 */
export const LARGE_TILE_MIN_LOSS = 0.1;

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
/**
 * 11. 타일본드 ㎡당 kg — 빗살 흙손 6mm 기준 3~4kg → 3.5(C). 대형은 뒷면까지 발라 5kg(C).
 * 근거: 국내 타일 접착제 제품 표기 소요량(㎡당 3~5kg) 관행.
 */
export const BOND_KG_PER_SQM: TileCoefficient = { value: 3.5, grade: 'C', source: '타일 접착제 표기 소요량 3~4kg/㎡' };
export const BOND_KG_PER_SQM_LARGE: TileCoefficient = { value: 5, grade: 'C', source: '대형 타일 뒷면 바름 포함 4~5kg/㎡' };
/** 타일본드 포장(kg) — 20kg 통(C) */
export const BOND_BAG_KG = 20;

/** 줄눈 깊이(mm) — 타일 두께 관행 8mm로 본다(C) */
export const GROUT_DEPTH_MM = 8;
/** 줄눈재 비중(kg/L) — 시멘트계 줄눈 1.6(C) */
export const GROUT_DENSITY_KG_PER_L = 1.6;
/** 줄눈재 로스 — 15~20%(B, 설계서 §4-3) → 20% */
export const GROUT_LOSS_RATE = 0.2;
/** 줄눈재 포장(kg) — 2kg 포가 견적서에 가장 흔함(B) */
export const GROUT_BAG_KG = 2;
/** 에폭시 줄눈 포장(kg) — 2.5kg 세트(주제+경화제) 관행(C) */
export const EPOXY_GROUT_BAG_KG = 2.5;
/** 줄눈 폭 기본값(mm) — 국산 300×600·600×600 2~3mm 관행(B) */
export const DEFAULT_GROUT_MM = 2;

/**
 * 코너비드(2.4m 1개) 개수 — 욕실 1칸 4개(창틀·벽 모서리), 주방 벽 2개(양 끝), 바닥 0개(C).
 * 근거: 84타입 욕실 바깥 모서리(창 4면·문틀 옆) 관행.
 */
export const CORNER_BEADS_PER: Record<'bath' | 'kitchen' | 'wallGeneric', number> = { bath: 4, kitchen: 2, wallGeneric: 2 };
/** 실리콘(270ml 1개) 개수 — 욕실 1칸 2개(바닥-벽 이음·도기 둘레), 주방·현관·베란다 1개, 거실 2개(C, 1개로 6~8m 관행) */
export const SILICONE_PER: Record<'bath' | 'kitchen' | 'entrance' | 'balcony' | 'living' | 'generic', number> = {
  bath: 2,
  kitchen: 1,
  entrance: 1,
  balcony: 1,
  living: 2,
  generic: 1,
};

// ── 하루 시공량·가산율(인건) ──────────────────

/** 타일 크기 묶음 — 소형(300각·300×600) / 중형(600각) / 대형(긴 변 800 이상) */
export type TileSizeClass = 'S' | 'M' | 'L';

/**
 * 기공(타일공) 1명이 하루에 붙이는 ㎡ — 넓은 바닥 기준, 공법·크기별 표(형아 확인 필요, C).
 * 근거: 표준품셈 떠붙임/압착 일 시공량 비(7㎡ vs 8㎡)를 넓은 면 현장 속도(10~14㎡)로 늘리고,
 *       욕실 1칸(벽 압착 15.4㎡ + 바닥 떠붙임 3.4㎡) = 기공 2일(욕실 난이도 0.85, 2026-10-09 보정).
 */
export const PRODUCTIVITY_SQM_PER_DAY: Record<TileSetting, Record<TileSizeClass, number>> = {
  press: { S: 12, M: 13, L: 10 },
  mortar: { S: 10, M: 12, L: 9 },
  bond: { S: 13, M: 14, L: 10 },
};
/**
 * 공간 난이도(시공량에 곱함) — 욕실은 모서리·배수구·재단이 많아 0.85, 주방·현관 0.7, 베란다 0.85, 거실 1(C).
 * 2026-10-09 보정: 욕실 0.6 → 0.85 — 욕실 1칸(벽+바닥 18.8㎡) 기공 3일은 견적DB 욕실 타일 공사 중앙값(180만)을
 * 크게 넘겼다. 0.85면 기공 2일·조공 1.5일(토리 보정안 2.0~2.5일)
 */
export const SPACE_DIFFICULTY: Record<'bath' | 'kitchen' | 'entrance' | 'balcony' | 'living' | 'generic', number> = {
  bath: 0.85,
  kitchen: 0.7,
  entrance: 0.7,
  balcony: 0.85,
  living: 1,
  generic: 0.85,
};
/**
 * 조공(보조) 일수 = 기공 일수 × 비율 — 압착 0.5 · 본드 0.3 · 떠붙임 1.0(몰탈 비빔·운반), 대형은 2인 운반이라 최소 1.0(C).
 * 근거: 미장 계산기 운영자 기준(기공2·조공2)과 타일 현장 1:0.5 관행.
 */
export const HELPER_RATIO: Record<TileSetting, number> = { press: 0.5, bond: 0.3, mortar: 1 };
export const HELPER_RATIO_LARGE_MIN = 1;
/** 조공을 부르는 최소 일수 — 0.5일 미만(현관 4㎡·주방 벽 같은 작은 일)은 기공 혼자 한다(현장 관행, C) */
export const HELPER_MIN_DAYS = 0.5;
/** 기공 최소 일수 — 반나절(0.5일). 반나절 일에는 소규모 출장 가산(pricing SMALL_JOB_SURCHARGE)이 붙는다(2026-10-09 보정, 예전 1일) */
export const MIN_MANDAYS = 0.5;
/** 품 수 올림 단위(0.5일) */
export const MANDAY_STEP = 0.5;
/** 패턴별 인건 가산(C) */
export const PATTERN_LABOR_MULT: Record<TilePattern, number> = {
  straight: 1,
  offset: 1.05,
  diagonal: 1.2,
  herringbone: 1.3,
};
/** 바닥 난방 위 시공 인건 가산 — 배관 보호·신축 줄눈 처리로 10% 더(C) */
export const HEATED_FLOOR_LABOR_MULT = 1.1;
/** 대형 타일 판정 — 긴 변이 이 값(mm) 이상이면 대형(크기 묶음 L·로스 하한) */
export const LARGE_TILE_LONG_SIDE_MM = 800;
