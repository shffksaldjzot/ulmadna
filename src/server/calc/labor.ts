// ──────────────────────────────────────────────
// 인건 계산 모듈 — 도배 면적 × 평당 노무 단가
//
// 기본 생각 (2026년 09월 09일 형아 확정, 견적서 35건 실데이터 기반):
//   인건비 = 벽 도배평 × 벽 단가 + 천장 도배평 × 천장 단가 (+ 구축이면 밑작업 추가)
//   품수   = 인건비 ÷ 기준 일당 30만 (반나절 단위 올림, 최소 1품)
//   실제 금액은 품수 × 지역별 일당 밴드(단가 파일)로 화면에 나간다.
//
// 예전 방식("(공급평 × 3 ÷ 15) + 1품" 실무자 공식)은 34평 실크가 9품(구축)까지 나와
// 견적서 실데이터(신축 7품·구축 8~9품)보다 조금 높았다. 이제 면적에 비례하므로
// 부분 도배·천장 제외도 면적이 줄어드는 만큼 자연스럽게 품이 준다.
//
// 표준품셈(인·일/㎡ × 노임단가)은 화면에 쓰지 않고 laborSanityFloor()로 하한 검산만 한다.
// 관급 기준이라 민간 관행 단가와 배율이 다르기 때문이다.
//
// 작성일: 2026년 08월 28일 · 개정: 2026년 09월 09일
// 근거: _dev-docs/얼마드나_전공정_세부설계서.md 공정8, src/data/ulmadna_db.json labor_rates,
//       docs/도메인지식/00_표준품셈_공통.md 2-1·3절
// ──────────────────────────────────────────────

import 'server-only';

import {
  LABOR_WON_PER_PYEONG,
  PREMIUM_SILK_ROLL_PRICE_THRESHOLD,
  CEILING_SHARE_FOR_BLEND,
  OLD_BUILDING_PREP_WON_PER_PYEONG,
  BASE_DAILY_WAGE,
  MAN_DAY_STEP,
  TEAM_SIZE,
  SQM_PER_PYEONG,
  SPEC_PAPERHANGER_PER_SQM,
  SPEC_HELPER_PER_SQM,
  SPEC_CEILING_SURCHARGE,
  type PaperType,
  type Coefficient,
} from './schema/wallpaper-coefficients';

/**
 * 지역별 품수 보정.
 * 일당 차이는 단가 파일에서 다루고, 여기서는 "일이 더 걸리는가"만 본다.
 * (도심은 주차·엘리베이터 대기 등으로 하루 진도가 조금 덜 나간다는 현장 이야기)
 */
export const REGION_LABOR_MULT: Record<string, Coefficient> = {
  서울: { value: 1.05, grade: 'C', source: '도심 주차·엘리베이터 대기 반영 — 명시 출처 없음(추정)' },
  경기: { value: 1.0, grade: 'C', source: '기준값(추정)' },
  인천: { value: 1.0, grade: 'C', source: '기준값(추정)' },
  기타: { value: 1.0, grade: 'C', source: '기준값(추정)' },
};

/** 지역 이름으로 품수 보정 계수를 찾는다. 모르는 지역은 기타(1.0) */
export function regionLaborMult(region?: string): Coefficient {
  if (!region) return REGION_LABOR_MULT['기타'];
  // "서울특별시 강남구" 처럼 들어와도 앞 두 글자로 잡히도록 부분 일치를 쓴다
  for (const key of Object.keys(REGION_LABOR_MULT)) {
    if (key !== '기타' && region.includes(key)) return REGION_LABOR_MULT[key];
  }
  return REGION_LABOR_MULT['기타'];
}

/** 인건 계산에 넣는 값들 */
export interface LaborInput {
  /** 벽 도배 면적 (㎡) — 시공 범위가 이미 반영된 값 */
  wallSqm: number;
  /** 천장 도배 면적 (㎡) — 천장을 뺐으면 0 */
  ceilingSqm: number;
  /** 벽지 종류 */
  paperType: PaperType;
  /** 구축(재도배) 여부 — 퍼티·초배 밑작업이 붙는다 */
  isOld: boolean;
  /** 고른 제품의 롤 단가 (원, 선택) — 디아망급 고급 실크 판정에 쓴다 */
  rollPrice?: number;
  /** 지역 (선택) */
  region?: string;
}

/** 인건 계산 결과 */
export interface LaborResult {
  /** 품수 (반나절 단위 올림, 최소 1) */
  manDays: number;
  /** 참고용 조 일수 (2인 1조 기준) */
  teamDays: number;
  /** 올림 전 품수 (소수 1자리) */
  rawManDays: number;
  /** 기준 일당(30만)으로 계산한 인건비 (원) — 검증용. 화면 금액은 품수 × 지역 일당 밴드 */
  baseAmount: number;
  /** 화면 "구성 보기"에 붙일 근거 문장 (서버 안에서만 쓴다) */
  basis: string;
  /** 어떤 값이 얼마나 쓰였는지 (검증용) */
  applied: {
    /** 쓰인 노무 단가 종류 */
    rateKey: PaperType | '실크고급';
    /** 벽 단가 (원/도배평) */
    wallRate: number;
    /** 천장 단가 (원/도배평) */
    ceilingRate: number;
    /** 구축 밑작업 단가 (원/도배평, 신축이면 0) */
    prepRate: number;
    regionMult: number;
  };
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 벽지 종류·제품 가격으로 노무 단가 키를 고른다 */
export function pickLaborRateKey(paperType: PaperType, rollPrice?: number): PaperType | '실크고급' {
  if (paperType === '실크' && rollPrice != null && rollPrice >= PREMIUM_SILK_ROLL_PRICE_THRESHOLD.value) {
    return '실크고급';
  }
  return paperType;
}

/**
 * 혼합 단가(천장 포함 평균)를 벽 단가·천장 단가로 나눈다.
 * 천장은 표준품셈대로 30% 가산이고, 혼합 단가 안에는 천장이 약 30% 섞여 있다.
 */
function splitRate(blended: number): { wallRate: number; ceilingRate: number } {
  const wallRate = blended / (1 + SPEC_CEILING_SURCHARGE.value * CEILING_SHARE_FOR_BLEND.value);
  return {
    wallRate: Math.round(wallRate),
    ceilingRate: Math.round(wallRate * (1 + SPEC_CEILING_SURCHARGE.value)),
  };
}

/**
 * 도배 품수를 계산한다.
 * 결과 manDays 는 반나절(0.5품) 단위로 올림된 값이고 최소 1품이 보장된다.
 */
export function calcLabor(input: LaborInput): LaborResult {
  const wallPyeong = Math.max(0, input.wallSqm) / SQM_PER_PYEONG;
  const ceilingPyeong = Math.max(0, input.ceilingSqm) / SQM_PER_PYEONG;
  const workPyeong = wallPyeong + ceilingPyeong;

  // ── 1) 종류별 평당 노무 단가 (벽·천장 분리) ──
  const rateKey = pickLaborRateKey(input.paperType, input.rollPrice);
  const { wallRate, ceilingRate } = splitRate(LABOR_WON_PER_PYEONG[rateKey].value);
  const baseWon = wallPyeong * wallRate + ceilingPyeong * ceilingRate;

  // ── 2) 구축 밑작업(퍼티·초배) 추가 ──
  const prepRate = input.isOld ? OLD_BUILDING_PREP_WON_PER_PYEONG.value : 0;
  const prepWon = workPyeong * prepRate;

  // ── 3) 지역 보정 ──
  const regionMult = regionLaborMult(input.region).value;
  const baseAmount = Math.round((baseWon + prepWon) * regionMult);

  // ── 4) 품수 환산: 기준 일당 30만 → 반나절 단위 올림, 최소 1품 ──
  const rawManDays = baseAmount / BASE_DAILY_WAGE.value;
  const manDays = Math.max(1, Math.ceil(rawManDays / MAN_DAY_STEP) * MAN_DAY_STEP);
  const teamDays = r1(manDays / TEAM_SIZE.value);

  // ── 5) 근거 문장 (서버 안에서만 쓴다 — 화면 note에는 결과 품수만 나간다) ──
  const parts: string[] = [
    `${rateKey} 벽 ${r1(wallPyeong)}평 × ${wallRate.toLocaleString()}원 + 천장 ${r1(ceilingPyeong)}평 × ${ceilingRate.toLocaleString()}원`,
  ];
  if (input.isOld) parts.push(`구축 밑작업 ${r1(workPyeong)}평 × ${prepRate.toLocaleString()}원`);
  if (regionMult !== 1) parts.push(`${input.region ?? ''} 보정 ×${regionMult}`);
  parts.push(`= ${baseAmount.toLocaleString()}원 ÷ 일당 ${BASE_DAILY_WAGE.value.toLocaleString()}원 → ${manDays}품 (2인 1조 약 ${teamDays}일)`);

  return {
    manDays,
    teamDays,
    rawManDays: r1(rawManDays),
    baseAmount,
    basis: parts.join(' · '),
    applied: { rateKey, wallRate, ceilingRate, prepRate, regionMult },
  };
}

// ── 표준품셈 하한 검산 ────────────────────────────
// 화면에 보여주는 값이 아니라 "우리 품수가 관급 기준보다 터무니없이 낮지 않은가"를
// 개발·검증 단계에서 확인하는 용도다.

/**
 * 노임단가 (2026년 상반기, 2026년 01월 01일 시행 · 대한건설협회 시중노임단가).
 * 반기마다 갱신되므로 기준일을 반드시 같이 본다.
 */
export const WAGE_2026H1 = {
  기준일: '2026년 01월 01일',
  출처: '대한건설협회 건설업 임금실태조사 보고서 (2026년 상반기 적용)',
  등급: 'A' as const,
  도배공: 227614,
  보통인부: 172068,
};

/** 하한 검산 결과 */
export interface LaborFloorResult {
  /** 표준품셈 기준 최소 인건비 (원) */
  amount: number;
  /** 환산된 도배공 인·일 */
  paperhangerManDays: number;
  /** 환산된 보통인부 인·일 */
  helperManDays: number;
  /** 근거 문장 */
  note: string;
}

/**
 * 표준품셈 5-3-7 도배바름 품으로 인건비 하한을 계산한다.
 * 관급 원가계산 기준이라 민간 견적과 그대로 비교하면 안 되고,
 * "이보다 낮으면 계산이 이상하다"는 바닥선으로만 쓴다.
 */
export function laborSanityFloor(args: {
  /** 벽 도배 면적 (㎡) */
  wallSqm: number;
  /** 천장 도배 면적 (㎡) */
  ceilingSqm: number;
}): LaborFloorResult {
  const { wallSqm, ceilingSqm } = args;

  // 천장은 품에 30% 가산 → 면적을 1.3배로 환산해서 한 번에 계산한다
  const equivalentSqm = wallSqm + ceilingSqm * (1 + SPEC_CEILING_SURCHARGE.value);

  const paperhangerManDays = equivalentSqm * SPEC_PAPERHANGER_PER_SQM.value;
  const helperManDays = equivalentSqm * SPEC_HELPER_PER_SQM.value;

  const amount = Math.round(
    paperhangerManDays * WAGE_2026H1.도배공 + helperManDays * WAGE_2026H1.보통인부,
  );

  return {
    amount,
    paperhangerManDays: r1(paperhangerManDays),
    helperManDays: r1(helperManDays),
    note:
      `표준품셈 5-3-7 · 환산면적 ${r1(equivalentSqm)}㎡(천장 30% 가산 포함)` +
      ` × 도배공 ${SPEC_PAPERHANGER_PER_SQM.value}인/㎡ + 보통인부 ${SPEC_HELPER_PER_SQM.value}인/㎡` +
      ` × ${WAGE_2026H1.기준일} 노임단가`,
  };
}
