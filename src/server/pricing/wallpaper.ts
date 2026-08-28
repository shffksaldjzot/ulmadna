// ──────────────────────────────────────────────
// 도배 단가 — 서버 전용
//
// !! 중요 !!
//   이 파일은 절대 클라이언트에서 import 하면 안 된다.
//   맨 위 'server-only' 가 그 실수를 빌드 단계에서 잡아 준다.
//   (라이브 v1에서 단가와 공식이 클라이언트 번들에 통째로 노출된 사고가 있었다.
//    v1 정식 계산기는 단가를 서버에서만 곱해 소비자가 범위만 내보낸다.)
//
// 값마다 기준일·출처·등급을 반드시 같이 적는다.
//   A = 근거 문서 확보 / B = 여러 출처 교차 확인 / C = 추정, 확인 대기
//
// 작성일: 2026년 08월 28일
// 근거: docs/도메인지식/01_도배.md 2-1·4-1·5절, docs/설계_계산기_물량견적_20260828.md 2-D절
// ──────────────────────────────────────────────

import 'server-only';

import type { EvidenceGrade } from '../calc/schema/types';
import type { PaperType } from '../calc/schema/wallpaper-coefficients';
import { SQM_PER_PYEONG } from '../calc/schema/wallpaper-coefficients';

/** 소비자가 단가 밴드 하나 */
export interface PriceBand {
  /** 최저 단가 (원) */
  min: number;
  /** 최고 단가 (원) */
  max: number;
  /** 단위 표기 (롤당·포당·품당 …) */
  unitLabel: string;
  /** 이 값을 확인한 기준일 */
  기준일: string;
  /** 어디서 온 값인지 */
  출처: string;
  /** 근거 등급 */
  등급: EvidenceGrade;
  /** 비고 */
  비고?: string;
}

// ── 1. 벽지 롤당 소비자가 ─────────────────────────
// 제품을 안 고르면 종류 평균 밴드로 계산한다.

export const WALLPAPER_ROLL_PRICE: Record<PaperType, PriceBand> = {
  합지: {
    min: 18000,
    max: 35000,
    unitLabel: '원/롤',
    기준일: '2026년 08월 28일',
    출처: '01_도배.md 2-1 브랜드별 소비자가 밴드 (LX 2만~3만중반 / 신한·서울·제일 1만후반~3만초반)',
    등급: 'B',
    비고: '광폭 93cm × 17.75m 기준. 제품을 고르면 제품 판매가로 대체된다',
  },
  실크: {
    min: 33000,
    max: 70000,
    unitLabel: '원/롤',
    기준일: '2026년 08월 28일',
    출처: '01_도배.md 2-1 브랜드별 소비자가 밴드 (LX 3만중반~7만+ / 개나리 로하스 4.29만 / 신한 3만~6만대)',
    등급: 'B',
    비고: '광폭 106cm × 15.6m 기준. 제품을 고르면 제품 판매가로 대체된다',
  },
};

// ── 2. 부자재 단가 ────────────────────────────────
// 키는 공정 스키마의 항목 키와 그대로 맞춘다 (schema/wallpaper.ts).
// 대부분 C등급 추정치다 — 집사 시공팀 확인 후 교체 예정.

export const SUBMATERIAL_PRICE: Record<string, PriceBand> = {
  paste: {
    min: 12000,
    max: 20000,
    unitLabel: '원/포',
    기준일: '2026년 08월 28일',
    출처: '도배풀 14kg 대용량 포 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  nonwoven: {
    min: 25000,
    max: 45000,
    unitLabel: '원/롤',
    기준일: '2026년 08월 28일',
    출처: '부직포 1.1m × 90m 롤 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  lining_paper: {
    min: 8000,
    max: 15000,
    unitLabel: '원/롤',
    기준일: '2026년 08월 28일',
    출처: '각초배지 30cm × 90m 롤 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  nebari: {
    min: 6000,
    max: 12000,
    unitLabel: '원/롤',
    기준일: '2026년 08월 28일',
    출처: '네바리 9cm × 90m 롤 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  bond: {
    min: 15000,
    max: 28000,
    unitLabel: '원/통',
    기준일: '2026년 08월 28일',
    출처: '합성수지 본드 5kg 캔 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  putty: {
    min: 18000,
    max: 30000,
    unitLabel: '원/포',
    기준일: '2026년 08월 28일',
    출처: '핸디코트 20kg 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  binder: {
    min: 30000,
    max: 50000,
    unitLabel: '원/통',
    기준일: '2026년 08월 28일',
    출처: '바인더·프라이머 15kg 캔 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  silicone: {
    min: 3000,
    max: 5000,
    unitLabel: '원/개',
    기준일: '2026년 08월 28일',
    출처: '수성실리콘 300ml 카트리지 유통가 — 실거래 조사 전 추정',
    등급: 'C',
  },
  protection: {
    min: 30000,
    max: 80000,
    unitLabel: '원/식',
    기준일: '2026년 08월 28일',
    출처: '보양 비닐·마스킹 자재 + 작업 — 실거래 조사 전 추정',
    등급: 'C',
  },
};

// ── 3. 기존 벽지 제거 (철거) ───────────────────────

/** 평당 3,000~5,000원을 ㎡ 단가로 환산 */
export const REMOVAL_PRICE_PER_SQM: PriceBand = {
  min: Math.round(3000 / SQM_PER_PYEONG),
  max: Math.round(5000 / SQM_PER_PYEONG),
  unitLabel: '원/㎡',
  기준일: '2026년 08월 28일',
  출처: '01_도배.md 5-3 (기존 벽지 제거비 평당 3,000~5,000원)',
  등급: 'A',
};

// ── 4. 일당 (지역별) ──────────────────────────────
// 1품 = 1인 1일. 지역에 따라 일당이 다르다.

export const DAILY_WAGE_BY_REGION: Record<string, PriceBand> = {
  수도권: {
    min: 250000,
    max: 350000,
    unitLabel: '원/품',
    기준일: '2026년 08월 28일',
    출처: '01_도배.md 4-1 (2026년 서울·수도권 도배 1인 1일 25만~35만원). 개나리벽지 자재상 1품 308,000원(VAT 포함) 사례로 교차 확인',
    등급: 'B',
  },
  광역시: {
    min: 230000,
    max: 320000,
    unitLabel: '원/품',
    기준일: '2026년 08월 28일',
    출처: '수도권 밴드에서 지역 격차를 반영한 추정 — 지역별 실거래 조사 전',
    등급: 'C',
  },
  기타: {
    min: 220000,
    max: 300000,
    unitLabel: '원/품',
    기준일: '2026년 08월 28일',
    출처: '수도권 밴드에서 지역 격차를 반영한 추정 — 지역별 실거래 조사 전',
    등급: 'C',
  },
};

/** 지역 이름 → 일당 밴드 구분 */
const METRO_KEYS = ['서울', '경기', '인천'];
const WIDE_CITY_KEYS = ['부산', '대구', '광주', '대전', '울산', '세종'];

/** 지역 이름으로 일당 밴드를 찾는다. 모르면 기타 */
export function getDailyWageBand(region?: string): PriceBand {
  if (!region) return DAILY_WAGE_BY_REGION['수도권']; // 미입력 시 표본이 가장 많은 수도권 기준
  if (METRO_KEYS.some((k) => region.includes(k))) return DAILY_WAGE_BY_REGION['수도권'];
  if (WIDE_CITY_KEYS.some((k) => region.includes(k))) return DAILY_WAGE_BY_REGION['광역시'];
  return DAILY_WAGE_BY_REGION['기타'];
}

// ── 5. 일반경비율 ─────────────────────────────────

/** 자재 + 부자재 + 시공 합계에 붙는 경비 비율 */
export const OVERHEAD_RATE = {
  min: 0.06,
  max: 0.09,
  기준일: '2026년 08월 28일',
  출처: '01_도배.md 3-3 견적표 역산 (합계 164만 중 10만 = 6.1% / 274만 중 19만 = 6.9%)에 여유를 둔 밴드',
  등급: 'C' as EvidenceGrade,
};

// ── 6. 조회 도우미 ────────────────────────────────

/** 사용자가 직접 넣은 제품 정보 */
export interface DirectProduct {
  /** 롤당 가격 (원) */
  rollPrice: number;
  /** 롤 폭 (cm) */
  widthCm: number;
  /** 롤 길이 (m) */
  lengthM: number;
  /** 패턴 리피트 (cm, 선택) */
  repeatCm?: number;
}

/**
 * 벽지 롤 단가 밴드를 고른다.
 * 사용자가 제품을 직접 입력했으면 그 가격을 고정값으로 쓴다.
 * 직접 입력값은 우리 시세 통계에 넣지 않는다(오염 방지) — 호출한 쪽에서 표시만 한다.
 */
export function getWallpaperRollPriceBand(paperType: PaperType, product?: DirectProduct): PriceBand {
  if (product && product.rollPrice > 0) {
    return {
      min: product.rollPrice,
      max: product.rollPrice,
      unitLabel: '원/롤',
      기준일: '2026년 08월 28일',
      출처: '사용자 직접 입력',
      등급: 'A',
      비고: '직접 입력값 — 시세 통계에는 반영하지 않는다',
    };
  }
  return WALLPAPER_ROLL_PRICE[paperType];
}

/** 부자재 항목 키로 단가 밴드를 찾는다. 없으면 undefined */
export function getSubmaterialPriceBand(itemKey: string): PriceBand | undefined {
  return SUBMATERIAL_PRICE[itemKey];
}
