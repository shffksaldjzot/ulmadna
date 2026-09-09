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
    // 2026-09-09 형아 확정: 18,000~35,000 → 장폭합지 실거래 표본 구간으로 좁힘
    min: 21800,
    max: 26100,
    unitLabel: '원/롤',
    기준일: '2026년 09월 09일',
    출처: '형아 엑셀 대한민국_벽지_부자재_DB_2026-09-09 장폭합지 9건(21,800~26,100, 제일 해피데이 49,500 이상치 제외) · 제품 DB 장폭 8건 일치',
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
  // 2026-09-09 형아 엑셀 대조표(01-3_벽지엑셀_대조표_20260909.md) "바로 반영 추천" 반영.
  // 규격이 우리 스키마와 정확히 같고 실거래로 확인된 값이라 C(추정)에서 올렸다.
  paste: {
    min: 9000,
    max: 9000,
    unitLabel: '원/포',
    기준일: '2026년 09월 09일',
    출처: '형아 엑셀 대한민국_벽지_부자재_DB_2026-09-09(온라인 유통가)',
    등급: 'A',
    비고: '현장용 도배풀 14kg 단일가(규격 우리 스키마와 동일)',
  },
  nonwoven: {
    min: 33000,
    max: 42000,
    unitLabel: '원/롤',
    기준일: '2026년 09월 09일',
    출처: '형아 엑셀 대한민국_벽지_부자재_DB_2026-09-09(온라인 유통가)',
    등급: 'B',
    비고: '110~120cm × 80~84m 실거래 3건 표본',
  },
  lining_paper: {
    // 2026-09-09 형아 확정: 각초배지 30cm 롤(시장에 없음) → 실크 1롤용 초배지 세트(5장)
    min: 3000,
    max: 3000,
    unitLabel: '원/세트',
    기준일: '2026년 09월 09일',
    출처: '형아 엑셀 대한민국_벽지_부자재_DB_2026-09-09(온라인 유통가)',
    등급: 'B',
    비고: '실크벽지 1롤용 초배지 세트 5장 단일가',
  },
  nebari: {
    min: 7000,
    max: 8000,
    unitLabel: '원/롤',
    기준일: '2026년 09월 09일',
    출처: '형아 엑셀 대한민국_벽지_부자재_DB_2026-09-09(온라인 유통가)',
    등급: 'B',
    비고: '네바리 습식 9cm × 90m (규격 우리 스키마와 동일)',
  },
  bond: {
    // 2026-09-09 형아 확정: 5kg 캔(도배용 없음) → 목공본드 800g 단위
    min: 3700,
    max: 3700,
    unitLabel: '원/개',
    기준일: '2026년 09월 09일',
    출처: '형아 엑셀 대한민국_벽지_부자재_DB_2026-09-09(온라인 유통가)',
    등급: 'B',
    비고: '오공 목공본드 705 800g 단일가',
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
    // 2026-09-09 형아 확정: 15kg 통 실거래 확인(오공 아크릴 바인더 15kg 28,340원 · 쌍곰 15kg 28,900원)
    min: 28000,
    max: 35000,
    unitLabel: '원/통',
    기준일: '2026년 09월 09일',
    출처: '웹 조사 2026-09-09 (다나와 오공 아크릴 바인더 15kg 최저 28,340원 · 시트라인 쌍곰 바인더 15kg 28,900원) + 오프라인 여유',
    등급: 'B',
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
  // 2026-09-09 형아 확정: 견적서 35건 도배 일당 30만원을 중앙값으로 밴드를 좁혔다(예전 25만~35만)
  수도권: {
    min: 280000,
    max: 320000,
    unitLabel: '원/품',
    기준일: '2026년 09월 09일',
    출처: '셀인카페 견적서 35건 도배 일당 300,000원(EST-025·035 자재/노무 분리) ±2만. 개나리벽지 자재상 1품 308,000원(VAT 포함) 교차 확인',
    등급: 'A',
  },
  광역시: {
    min: 260000,
    max: 300000,
    unitLabel: '원/품',
    기준일: '2026년 09월 09일',
    출처: '수도권 밴드에서 지역 격차를 반영한 추정 — 지역별 실거래 조사 전',
    등급: 'C',
  },
  기타: {
    min: 250000,
    max: 290000,
    unitLabel: '원/품',
    기준일: '2026년 09월 09일',
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
  /** 화면 표기용 출처 문구(제품 마스터에서 골랐으면 "브랜드 이름 · 웹 조사 기준 · 2026.9" 형태). 없으면 "사용자 직접 입력" */
  sourceLabel?: string;
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
      // 제품 마스터에서 고른 제품이면 그 출처 문구를, 그냥 직접 입력이면 기본 문구를 쓴다
      출처: product.sourceLabel ?? '사용자 직접 입력',
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
