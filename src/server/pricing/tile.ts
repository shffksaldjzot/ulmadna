// ──────────────────────────────────────────────
// 타일 계산기 단가표 — 서버 전용 (견적DB 추출 + 보완 추정)
//
// !! 중요 !!
//   이 파일은 절대 클라이언트에서 import 하면 안 된다(맨 위 'server-only'가 빌드에서 막는다).
//   API 응답에도 이 표의 값을 그대로 내보내지 않는다 — 결과 금액 범위·수량·견적DB 비교 범위만 나간다.
//
// 근거: docs/타일_단가표_추출_20261003.md (견적DB 최근 12개월 554부, 단위별 사분위)
//   코드 범위 = 하위25% ~ 상위25%. n<5 또는 견적DB에 없는 값은 "추정"(등급 C → 화면에 "추정" 표식).
//   식 금액은 욕실 1칸 20.1㎡(현관은 4㎡)로 나눠 ㎡ 단가로 바꿨다(문서 1절 가정).
//
// 2026-10-08 개편: 종류별(도기질·자기질·포세린·대형 포세린) 자재 단가 띠, 조공 노임, 본드·에폭시 줄눈,
//   코너비드·실리콘·양중·방수(㎡) 단가를 더했다. 형아 확인 필요한 추정값은 grade 'C'로 둔다.
//
// 작성일: 2026년 10월 03일
// 개편: 2026년 10월 08일
// ──────────────────────────────────────────────

import 'server-only';

import type { TileGrade, TileKind } from '@/lib/v1/tilePresets';
import { MORTAR_KIND_PRICE_BAND } from './mortar';
import { OVERHEAD_RATE as WALLPAPER_OVERHEAD_RATE } from './wallpaper';
import { HELPER_WAGE_RANGE } from '../calc/schema/mortar-coefficients';

/** 단가 범위 하나 */
export interface TilePriceBand {
  /** 최저(원) */
  min: number;
  /** 최고(원) */
  max: number;
  /** 단위(원/㎡ 등) */
  unitLabel: string;
  /** 근거 — 견적DB n 또는 보완 근거 */
  basis: string;
  /** A·B·C — C면 화면에 "추정" */
  grade: 'A' | 'B' | 'C';
}

/** 단가 기준일 */
export const TILE_PRICE_BASE_DATE = '2026년 10월 08일';

// ── 1. 타일 자재(㎡당) — 종류 × 등급 ─────────────

/**
 * 종류별 ㎡당 자재 단가(박스 단가 ÷ 1.44㎡).
 *   도기질 = 견적DB 벽타일 박스 n=28(25,000/31,000/37,000원) — 벽타일 표본 대부분이 300×600 도기질(B)
 *   자기질 = 견적DB 바닥타일 박스 n=41(26,000/30,000/32,000원) — 욕실 바닥·현관·베란다(B)
 *   포세린 = 견적DB 현관 바닥타일 박스 상위25% 40,500원(n=20) ÷ 1.44 ≈ 28,100원을 중급 아래 끝으로,
 *            600각 포세린 소매가(1.44㎡ 4만~6만원대) 시장 비교로 위 끝을 잡음(C, 형아 확인 필요)
 *   대형 포세린 = 600×1200 2장(1.44㎡) 소매가 4.5만~9만원대 시장 비교(C, 견적DB 대형 표본 없음)
 * 등급 띠: 보급 = 하위25%~중앙값 · 중급 = 중앙값~상위25% · 고급 = 상위25% 위(윗단 추정).
 */
export const TILE_KIND_PRICE: Record<TileKind, Record<TileGrade, TilePriceBand>> = {
  earthenware: {
    basic: { min: 17400, max: 21500, unitLabel: '원/㎡', basis: '견적DB 벽타일 박스 28건', grade: 'B' },
    mid: { min: 21500, max: 25700, unitLabel: '원/㎡', basis: '견적DB 벽타일 박스 28건', grade: 'B' },
    high: { min: 25700, max: 41100, unitLabel: '원/㎡', basis: '견적DB 벽타일 박스 28건 · 윗단', grade: 'C' },
  },
  stoneware: {
    basic: { min: 18100, max: 20800, unitLabel: '원/㎡', basis: '견적DB 바닥타일 박스 41건', grade: 'B' },
    mid: { min: 20800, max: 22200, unitLabel: '원/㎡', basis: '견적DB 바닥타일 박스 41건', grade: 'B' },
    high: { min: 22200, max: 35600, unitLabel: '원/㎡', basis: '견적DB 바닥타일 박스 41건 · 윗단', grade: 'C' },
  },
  porcelain: {
    basic: { min: 24000, max: 30000, unitLabel: '원/㎡', basis: '견적DB 현관 박스 상위 · 시장 비교', grade: 'C' },
    mid: { min: 30000, max: 38000, unitLabel: '원/㎡', basis: '견적DB 현관 박스 상위 · 시장 비교', grade: 'C' },
    high: { min: 38000, max: 55000, unitLabel: '원/㎡', basis: '시장 비교', grade: 'C' },
  },
  largePorcelain: {
    basic: { min: 32000, max: 40000, unitLabel: '원/㎡', basis: '600×1200 시장 비교', grade: 'C' },
    mid: { min: 40000, max: 52000, unitLabel: '원/㎡', basis: '600×1200 시장 비교', grade: 'C' },
    high: { min: 52000, max: 75000, unitLabel: '원/㎡', basis: '600×1200 시장 비교', grade: 'C' },
  },
};

// ── 2. 인건 ───────────────────────────────────

/** 기공(타일공) 1일 — 견적DB 타일 시공 인건 "인" 단가 n=37: 310,000 / 370,000 / 400,000원 */
export const TILE_LABOR_PER_MANDAY: TilePriceBand = {
  min: 310000,
  max: 400000,
  unitLabel: '원/일',
  basis: '견적DB 타일 시공 인건 37건',
  grade: 'B',
};

/** 조공(보통인부) 1일 — 미장 계산기 조공 노임 범위 그대로(시장 하한~표준품셈 시중노임, C) */
export const TILE_HELPER_PER_MANDAY: TilePriceBand = {
  min: HELPER_WAGE_RANGE.min,
  max: HELPER_WAGE_RANGE.max,
  unitLabel: '원/일',
  basis: '미장 계산기 조공 노임',
  grade: 'C',
};

/** 양중(자재 올리기) — 박스당 1,500~3,000원, 포당 500~1,000원(엘리베이터·계단 운반 현장 관행, C) */
export const LIFTING_PER_BOX: TilePriceBand = { min: 1500, max: 3000, unitLabel: '원/박스', basis: '현장 관행', grade: 'C' };
export const LIFTING_PER_BAG: TilePriceBand = { min: 500, max: 1000, unitLabel: '원/포', basis: '현장 관행', grade: 'C' };

// ── 3. 철거 ───────────────────────────────────

/** 욕실 철거(㎡당) — 견적DB 욕실 철거 식 n=36(637,500~1,200,000) ÷ 욕실 1칸 20.1㎡ */
export const BATH_DEMOLISH_PER_SQM: TilePriceBand = {
  min: 31700,
  max: 59700,
  unitLabel: '원/㎡',
  basis: '견적DB 욕실 철거 36건 · ㎡ 환산',
  grade: 'C',
};

/** 현관·베란다·주방 벽 타일 철거(㎡당) — 견적DB 타일 철거 식 n=34(127,500~300,000) ÷ 현관 4㎡ */
export const TILE_DEMOLISH_PER_SQM: TilePriceBand = {
  min: 31900,
  max: 75000,
  unitLabel: '원/㎡',
  basis: '견적DB 타일 철거 34건 · ㎡ 환산',
  grade: 'C',
};

/** 거실 기존 바닥(마루·장판) 철거(㎡당) — 견적DB 바닥재 철거 평 단가 n=49(26,000~35,000원/평) ÷ 3.3058 */
export const FLOOR_DEMOLISH_PER_SQM: TilePriceBand = {
  min: 7900,
  max: 10600,
  unitLabel: '원/㎡',
  basis: '견적DB 바닥재 철거 49건',
  grade: 'B',
};

// ── 4. 방수 ───────────────────────────────────

/** 욕실 방수(칸당, 재료+시공) — 견적DB 방수 개소 단가 n=12: 257,500 / 367,500 / 412,500원 */
export const BATH_WATERPROOF_PER_ROOM: TilePriceBand = {
  min: 257500,
  max: 412500,
  unitLabel: '원/칸',
  basis: '견적DB 방수 12건',
  grade: 'B',
};

/** 욕실 밖(베란다·현관 등) 방수(㎡당, 도막 2회) — 욕실 칸 단가 ÷ 바닥+벽 하단 약 10㎡로 잡은 값(C) */
export const AREA_WATERPROOF_PER_SQM: TilePriceBand = {
  min: 25000,
  max: 40000,
  unitLabel: '원/㎡',
  basis: '욕실 방수 칸 단가 ㎡ 환산',
  grade: 'C',
};

// ── 5. 부자재 ─────────────────────────────────

/** 압착시멘트 20kg — 견적DB n=5(5,500~6,000) */
export const ADHESIVE_BAG_PRICE: TilePriceBand = { min: 5500, max: 6000, unitLabel: '원/포', basis: '견적DB 압착시멘트 5건', grade: 'B' };

/** 타일본드 20kg — 견적DB n=4(13,000·21,000·25,000·27,000)의 사분위(C) */
export const BOND_BAG_PRICE: TilePriceBand = { min: 19000, max: 25500, unitLabel: '원/통', basis: '견적DB 타일본드 4건', grade: 'C' };

/** 떠붙임 몰탈 40kg — 미장 계산기 레미탈 단가 그대로(C) */
export const MORTAR_BED_BAG_PRICE: TilePriceBand = {
  min: MORTAR_KIND_PRICE_BAND['레미탈'].min,
  max: MORTAR_KIND_PRICE_BAND['레미탈'].max,
  unitLabel: '원/포',
  basis: '미장 계산기 레미탈 단가',
  grade: 'C',
};

/** 줄눈재 2kg(시멘트계 기본) — 견적DB n=6: 5,125 / 5,750 / 7,125원 */
export const GROUT_BAG_PRICE: TilePriceBand = { min: 5125, max: 7125, unitLabel: '원/포', basis: '견적DB 줄눈재 6건', grade: 'B' };
/** 컬러 줄눈 2kg — 기본 줄눈 × 1.3(안료 추가분, C) */
export const COLOR_GROUT_BAG_PRICE: TilePriceBand = { min: 6700, max: 9300, unitLabel: '원/포', basis: '기본 줄눈 × 1.3', grade: 'C' };
/** 에폭시 줄눈 2.5kg 세트 — 소매가 4.5만~6.5만원(시장 비교, C) */
export const EPOXY_GROUT_BAG_PRICE: TilePriceBand = { min: 45000, max: 65000, unitLabel: '원/세트', basis: '시장 비교', grade: 'C' };
/**
 * 에폭시 줄눈 추가 시공(㎡당) — 견적DB 줄눈 작업 식 n=49(225,000~650,000) ÷ 욕실 1칸 20.1㎡ ≈ 11,000~32,000원 중
 * 아래~가운데를 썼다(타일공이 붙이면서 같이 하면 별도 줄눈 시공보다 싸다, C)
 */
export const EPOXY_GROUT_LABOR_PER_SQM: TilePriceBand = { min: 11000, max: 20000, unitLabel: '원/㎡', basis: '견적DB 줄눈 작업 49건 · ㎡ 환산', grade: 'C' };

/** 코너비드 2.4m 1개 — PVC·알루미늄 소매가 3,000~6,000원(C) */
export const CORNER_BEAD_PRICE: TilePriceBand = { min: 3000, max: 6000, unitLabel: '원/개', basis: '시장 비교', grade: 'C' };
/** 실리콘 270ml 1개 — 바이오(곰팡이 방지) 실리콘 4,000~7,000원(C) */
export const SILICONE_PRICE: TilePriceBand = { min: 4000, max: 7000, unitLabel: '원/개', basis: '시장 비교', grade: 'C' };

/**
 * 기타 소모품(모래·스페이서·청소 등, ㎡당) — 옛 기타 부자재 5,000~8,000원/㎡(견적DB 타일 부자재 ㎡ n=8 역산)에서
 * 코너비드·실리콘 몫을 따로 뺀 나머지(C)
 */
export const MISC_SUBMATERIAL_PER_SQM: TilePriceBand = { min: 3000, max: 5000, unitLabel: '원/㎡', basis: '견적DB 타일 부자재 ㎡ 8건 역산', grade: 'C' };

// ── 6. 경비 ───────────────────────────────────

/** 일반경비율 — 도배 계산기 경비율(6~9%) 준용(C) */
export const TILE_OVERHEAD_RATE = { min: WALLPAPER_OVERHEAD_RATE.min, max: WALLPAPER_OVERHEAD_RATE.max };

// ── 7. 견적DB 비교 범위(결과 화면 "시장 견적 비교") ─────────────
// 단가로 쓰지 않는다 — "비슷한 견적서 n건은 이 범위"라는 비교용(설계서 §4-8 주의).

/** 비교 범위 하나 */
export interface TileMarketRef {
  /** 무엇의 범위인지(화면 문구) */
  key: 'bath' | 'entrance' | 'balcony' | 'box';
  label: string;
  n: number;
  p25: number;
  p75: number;
}

/** 욕실 — 타일 공사 묶음(식) n=80 */
export const MARKET_REF_BATH: TileMarketRef = { key: 'bath', label: '욕실 타일 공사', n: 80, p25: 937500, p75: 3202500 };
/** 현관 — 현관 바닥타일 묶음(식) n=46 */
export const MARKET_REF_ENTRANCE: TileMarketRef = { key: 'entrance', label: '현관 타일', n: 46, p25: 200000, p75: 575000 };
/** 베란다 — 발코니·베란다 타일(식) n=37 */
export const MARKET_REF_BALCONY: TileMarketRef = { key: 'balcony', label: '베란다 타일', n: 37, p25: 500000, p75: 1300000 };
/** 타일 1박스 — 타일 박스 단가 n=74(26,000~35,750원) */
export const MARKET_REF_BOX: TileMarketRef = { key: 'box', label: '타일 1박스', n: 74, p25: 26000, p75: 35750 };
/** 결과 화면 "시장 견적 비교 4종" 순서 */
export const MARKET_REFS: TileMarketRef[] = [MARKET_REF_BATH, MARKET_REF_ENTRANCE, MARKET_REF_BALCONY, MARKET_REF_BOX];
