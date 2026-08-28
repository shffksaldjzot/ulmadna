// ──────────────────────────────────────────────
// 인건 계산 모듈 — 일당 × 일수
//
// 기본 생각:
//   인건비 = 품수 × 일당.  1품 = 1인 1일.
//   품수는 "물량 ÷ 하루 생산성"으로 구한다.
//     실크 → (공급 평수 × 3 ÷ 15) + 1  (실무자 공유 공식, 천장·초배·퍼티 포함 전제)
//     합지 → 2인 1조가 하루 30평 → 조 일수 × 2인
//   여기에 천장 제외·구축·지역 조건을 곱하고, 마지막에 올림(최소 1품)한다.
//
// 표준품셈(인·일/㎡ × 노임단가)은 화면에 쓰지 않고 laborSanityFloor()로 하한 검산만 한다.
// 관급 기준이라 민간 관행 단가와 배율이 다르기 때문이다.
//
// 작성일: 2026년 08월 28일
// 근거: docs/도메인지식/01_도배.md 4절, docs/도메인지식/00_표준품셈_공통.md 2-1·3절
// ──────────────────────────────────────────────

import 'server-only';

import {
  SILK_LABOR_FORMULA,
  HAPJI_PYEONG_PER_TEAM_DAY,
  TEAM_SIZE,
  NO_CEILING_LABOR_MULT,
  OLD_BUILDING_LABOR_MULT,
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
  /** 공급 평형 (품수 공식이 공급 평수를 쓴다) */
  supplyPyeong: number;
  /** 벽지 종류 */
  paperType: PaperType;
  /** 천장 포함 여부 */
  ceiling: boolean;
  /** 구축(재도배) 여부 */
  isOld: boolean;
  /** 시공 범위 비율 (전체=1, 거실·주방만=0.4 등). 부분 도배면 품수도 줄어든다 */
  scopeRatio?: number;
  /** 지역 (선택) */
  region?: string;
}

/** 인건 계산 결과 */
export interface LaborResult {
  /** 품수 (올림, 최소 1) */
  manDays: number;
  /** 참고용 조 일수 (2인 1조 기준) */
  teamDays: number;
  /** 보정 전 기본 품수 (반올림 전) */
  rawManDays: number;
  /** 화면 "구성 보기"에 붙일 근거 문장 */
  basis: string;
  /** 어떤 보정이 얼마나 곱해졌는지 (검증용) */
  applied: {
    scopeRatio: number;
    ceilingMult: number;
    oldMult: number;
    regionMult: number;
  };
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 도배 품수를 계산한다.
 * 결과 manDays 는 이미 올림된 정수이고 최소 1품이 보장된다.
 */
export function calcLabor(input: LaborInput): LaborResult {
  const scopeRatio = input.scopeRatio ?? 1;
  // 부분 도배면 그만큼 줄어든 "실질 평수"로 공식을 돌린다
  const effectivePyeong = Math.max(0, input.supplyPyeong * scopeRatio);

  // ── 1) 종류별 기본 품수 ──
  let raw: number;
  let formulaText: string;
  if (input.paperType === '실크') {
    // 실크: (평수 × 3 ÷ 15) + 1
    raw =
      (effectivePyeong * SILK_LABOR_FORMULA.multiplier) / SILK_LABOR_FORMULA.divisor +
      SILK_LABOR_FORMULA.addOn;
    formulaText = `실크 품수 공식 (${r1(effectivePyeong)}평 × 3 ÷ 15) + 1 = ${r1(raw)}품`;
  } else {
    // 합지: 2인 1조가 하루 30평 → 조 일수 × 2인
    const teamDaysRaw = effectivePyeong / HAPJI_PYEONG_PER_TEAM_DAY.value;
    raw = teamDaysRaw * TEAM_SIZE.value;
    formulaText = `합지 2인 1조 하루 ${HAPJI_PYEONG_PER_TEAM_DAY.value}평 → ${r1(effectivePyeong)}평 ÷ ${HAPJI_PYEONG_PER_TEAM_DAY.value} × ${TEAM_SIZE.value}인 = ${r1(raw)}품`;
  }

  // ── 2) 조건 보정 ──
  // 천장을 빼면 품이 준다 (공식이 천장 포함 전제라 덜어 준다)
  const ceilingMult = input.ceiling ? 1 : NO_CEILING_LABOR_MULT.value;
  // 구축은 기존 벽지 제거·퍼티·네바리로 품이 는다
  const oldMult = input.isOld ? OLD_BUILDING_LABOR_MULT.value : 1;
  // 지역 보정
  const regionCoef = regionLaborMult(input.region);
  const regionMult = regionCoef.value;

  const adjusted = raw * ceilingMult * oldMult * regionMult;

  // ── 3) 올림 + 최소 1품 ──
  const manDays = Math.max(1, Math.ceil(adjusted));
  const teamDays = r1(manDays / TEAM_SIZE.value);

  // ── 4) 근거 문장 ──
  const parts: string[] = [formulaText];
  if (!input.ceiling) parts.push(`천장 제외 ×${ceilingMult}`);
  if (input.isOld) parts.push(`구축 가산 ×${oldMult}`);
  if (regionMult !== 1) parts.push(`${input.region ?? ''} 보정 ×${regionMult}`);
  parts.push(`올림 → ${manDays}품 (2인 1조 약 ${teamDays}일)`);

  return {
    manDays,
    teamDays,
    rawManDays: r1(raw),
    basis: parts.join(' · '),
    applied: { scopeRatio, ceilingMult, oldMult, regionMult },
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
