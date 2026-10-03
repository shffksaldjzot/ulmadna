// ──────────────────────────────────────────────
// 타일 계산기 단가표 — 서버 전용 (견적DB 추출)
//
// !! 중요 !!
//   이 파일은 절대 클라이언트에서 import 하면 안 된다(맨 위 'server-only'가 빌드에서 막는다).
//   API 응답에도 이 표의 값을 그대로 내보내지 않는다 — 결과 금액 범위·수량·견적DB 비교 범위만 나간다.
//
// 근거: docs/타일_단가표_추출_20261003.md (견적DB 최근 12개월 554부, 단위별 사분위)
//   코드 범위 = 하위25% ~ 상위25%. n<5 또는 견적DB에 없는 값은 "추정"(등급 C).
//   식 금액은 욕실 1칸 20.1㎡(현관은 4㎡)로 나눠 ㎡ 단가로 바꿨다(문서 1절 가정).
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import 'server-only';

import type { TileGrade } from '@/lib/v1/tilePresets';
import { MORTAR_KIND_PRICE_BAND } from './mortar';
import { OVERHEAD_RATE as WALLPAPER_OVERHEAD_RATE } from './wallpaper';

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
export const TILE_PRICE_BASE_DATE = '2026년 10월 03일';

// ── 1. 타일 자재(㎡당) — 박스 단가 ÷ 1.44㎡ ─────────────

/**
 * 벽타일 ㎡당 — 견적DB 벽타일(욕실 벽+주방 벽) 박스 단가 n=28: 25,000 / 31,000 / 37,000원.
 * 보급 = 하위25%~중앙값 · 중급 = 중앙값~상위25% · 고급 = 상위25%~상위25%×1.6(윗단 추정).
 */
export const WALL_TILE_PRICE: Record<TileGrade, TilePriceBand> = {
  basic: { min: 17400, max: 21500, unitLabel: '원/㎡', basis: '견적DB 벽타일 박스 28건', grade: 'B' },
  mid: { min: 21500, max: 25700, unitLabel: '원/㎡', basis: '견적DB 벽타일 박스 28건', grade: 'B' },
  high: { min: 25700, max: 41100, unitLabel: '원/㎡', basis: '견적DB 벽타일 박스 28건 · 윗단 추정', grade: 'C' },
};

/** 바닥타일 ㎡당 — 견적DB 바닥타일(욕실 바닥+현관+베란다) 박스 단가 n=41: 26,000 / 30,000 / 32,000원 */
export const FLOOR_TILE_PRICE: Record<TileGrade, TilePriceBand> = {
  basic: { min: 18100, max: 20800, unitLabel: '원/㎡', basis: '견적DB 바닥타일 박스 41건', grade: 'B' },
  mid: { min: 20800, max: 22200, unitLabel: '원/㎡', basis: '견적DB 바닥타일 박스 41건', grade: 'B' },
  high: { min: 22200, max: 35600, unitLabel: '원/㎡', basis: '견적DB 바닥타일 박스 41건 · 윗단 추정', grade: 'C' },
};

/** 대형 타일(긴 변 800mm 이상) 자재 가산 — 견적DB에 대형 표본이 거의 없어 추정 */
export const LARGE_TILE_PRICE_MULT = 1.3;

// ── 2. 인건 ───────────────────────────────────

/** 타일공 1인(품) — 견적DB 타일 시공 인건 "인" 단가 n=37: 310,000 / 370,000 / 400,000원 */
export const TILE_LABOR_PER_MANDAY: TilePriceBand = {
  min: 310000,
  max: 400000,
  unitLabel: '원/인',
  basis: '견적DB 타일 시공 인건 37건',
  grade: 'B',
};

// ── 3. 철거 ───────────────────────────────────

/** 욕실 철거(㎡당) — 견적DB 욕실 철거 식 n=36(637,500~1,200,000) ÷ 욕실 1칸 20.1㎡ */
export const BATH_DEMOLISH_PER_SQM: TilePriceBand = {
  min: 31700,
  max: 59700,
  unitLabel: '원/㎡',
  basis: '견적DB 욕실 철거 36건 · 1칸 ㎡ 환산',
  grade: 'C',
};

/** 현관·베란다 타일 철거(㎡당) — 견적DB 타일 철거 식 n=34(127,500~300,000) ÷ 현관 4㎡ */
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

/** 욕실 방수(칸당) — 견적DB 방수 개소 단가 n=12: 257,500 / 367,500 / 412,500원 */
export const BATH_WATERPROOF_PER_ROOM: TilePriceBand = {
  min: 257500,
  max: 412500,
  unitLabel: '원/칸',
  basis: '견적DB 방수 12건',
  grade: 'B',
};

// ── 5. 부자재 ─────────────────────────────────

/** 압착시멘트 20kg — 일반(보급·중급): 견적DB n=5(5,500~6,000) / 고급은 타일본드: 견적DB n=4(추정) */
export const ADHESIVE_BAG_PRICE: Record<TileGrade, TilePriceBand> = {
  basic: { min: 5500, max: 6000, unitLabel: '원/포', basis: '견적DB 압착시멘트 5건', grade: 'B' },
  mid: { min: 5500, max: 6000, unitLabel: '원/포', basis: '견적DB 압착시멘트 5건', grade: 'B' },
  high: { min: 19000, max: 25500, unitLabel: '원/포', basis: '견적DB 타일본드 4건 · 추정', grade: 'C' },
};

/** 떠붙임 몰탈 40kg — 미장 계산기 레미탈 단가 그대로(추정) */
export const MORTAR_BED_BAG_PRICE: TilePriceBand = {
  min: MORTAR_KIND_PRICE_BAND['레미탈'].min,
  max: MORTAR_KIND_PRICE_BAND['레미탈'].max,
  unitLabel: '원/포',
  basis: '미장 계산기 레미탈 단가 · 추정',
  grade: 'C',
};

/** 줄눈재 2kg — 견적DB n=6: 5,125 / 5,750 / 7,125원 */
export const GROUT_BAG_PRICE: TilePriceBand = {
  min: 5125,
  max: 7125,
  unitLabel: '원/포',
  basis: '견적DB 줄눈재 6건',
  grade: 'B',
};

/** 기타 부자재(코너비드·실리콘·모래 등, ㎡당) — 견적DB 타일 부자재 ㎡ 단가(n=8)에서 압착·줄눈 몫을 뺀 나머지(추정) */
export const MISC_SUBMATERIAL_PER_SQM: TilePriceBand = {
  min: 5000,
  max: 8000,
  unitLabel: '원/㎡',
  basis: '견적DB 타일 부자재 ㎡ 8건에서 역산 · 추정',
  grade: 'C',
};

// ── 6. 경비 ───────────────────────────────────

/** 일반경비율 — 도배 계산기 경비율(6~9%) 준용(추정) */
export const TILE_OVERHEAD_RATE = { min: WALLPAPER_OVERHEAD_RATE.min, max: WALLPAPER_OVERHEAD_RATE.max };

// ── 7. 견적DB 비교 범위(결과 화면 "근거") ─────────────
// 단가로 쓰지 않는다 — "비슷한 견적서 n건은 이 범위"라는 비교용(설계서 §4-8 주의).

/** 비교 범위 하나 */
export interface TileMarketRef {
  /** 무엇의 범위인지(화면 문구) */
  label: string;
  n: number;
  p25: number;
  p75: number;
}

/** 욕실 — 타일 공사 묶음(식) n=80 */
export const MARKET_REF_BATH: TileMarketRef = { label: '욕실 타일 공사', n: 80, p25: 937500, p75: 3202500 };
/** 현관 — 현관 바닥타일 묶음(식) n=46 */
export const MARKET_REF_ENTRANCE: TileMarketRef = { label: '현관 타일', n: 46, p25: 200000, p75: 575000 };
/** 베란다 — 발코니·베란다 타일(식) n=37 */
export const MARKET_REF_BALCONY: TileMarketRef = { label: '베란다 타일', n: 37, p25: 500000, p75: 1300000 };
/** 셀프(자재만) — 타일 박스 단가 n=74(26,000~35,750원) */
export const MARKET_REF_BOX: TileMarketRef = { label: '타일 1박스', n: 74, p25: 26000, p75: 35750 };
