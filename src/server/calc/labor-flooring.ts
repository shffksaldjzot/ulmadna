// ──────────────────────────────────────────────
// 바닥재 인건 계산 모듈 — 바닥 시공 면적 × 종류별 평당 노무 단가
//
// 이 파일이 하는 일:
//   "이 공사에 사람이 며칠 붙는가(품수)"를 계산한다.
//   도배 인건 모듈(labor.ts)과 같은 생각으로 만들었지만, 도배 함수 시그니처를 건드리지 않으려고
//   바닥재는 아예 새 파일로 뗐다.
//
// 계산 방식:
//   인건비 = 바닥 시공 면적(평) × 종류별 평당 노무 단가 (헤링본이면 ×1.25)
//   품수   = 인건비 ÷ 기준 일당 30만 (반나절 단위 올림, 최소 1품)
//   화면 금액 = 품수 × 일당 밴드 28만~32만 (단가 파일에서 곱한다)
//
// ⚠️ 표준품셈과의 차이 (형아 확인 대상):
//   표준품셈 [건축] 5-1-3 마루 설치는 ㎡당 내장공 0.041인·일이라
//   34평(바닥 68㎡)이면 내장공만 2.8인·일이 나온다. 우리 산식(견적서 실데이터 기준)은
//   같은 조건에서 1.5품이다. 관급 기준과 민간 관행 차이라 그대로 두되,
//   laborSpecManDays() 로 언제든 대조할 수 있게 해 뒀다.
//
// 작성일: 2026년 09월 10일
// 근거: src/data/ulmadna_db.json labor_rates.flooring · processes 바닥(EST-035 자재/노무 분리),
//       docs/도메인지식/02_바닥재.md 5절, docs/도메인지식/00_표준품셈_공통.md 2-2절
// ──────────────────────────────────────────────

import 'server-only';

import {
  FLOORING_LABOR_WON_PER_PYEONG,
  HERRINGBONE_LABOR_MULT,
  FLOORING_BASE_DAILY_WAGE,
  FLOORING_MAN_DAY_STEP,
  FLOORING_TEAM_SIZE,
  SPEC_MAN_DAY_PER_SQM,
  SQM_PER_PYEONG,
  type FlooringKind,
} from './schema/flooring-coefficients';

/** 인건 계산에 넣는 값들 */
export interface FlooringLaborInput {
  /** 바닥 시공 면적 (㎡) — 시공 범위가 이미 반영된 값 */
  floorSqm: number;
  /** 바닥재 종류 */
  kind: FlooringKind;
  /** 헤링본(빗살무늬) 시공인지 — 대각선이라 손이 더 간다 */
  isHerringbone?: boolean;
}

/** 인건 계산 결과 */
export interface FlooringLaborResult {
  /** 품수 (반나절 단위 올림, 최소 1) */
  manDays: number;
  /** 참고용 조 일수 (2인 1조 기준) */
  teamDays: number;
  /** 올림 전 품수 (소수 1자리) */
  rawManDays: number;
  /** 기준 일당(30만)으로 계산한 인건비 (원) — 검증용. 화면 금액은 품수 × 일당 밴드 */
  baseAmount: number;
  /** 서버 안에서만 쓰는 근거 문장 (화면 note 에는 결과 품수만 나간다) */
  basis: string;
  /** 어떤 값이 얼마나 쓰였는지 (검증용) */
  applied: {
    /** 쓰인 평당 노무 단가 (원/시공평) */
    ratePerPyeong: number;
    /** 헤링본 배율 (1 또는 1.25) */
    patternMult: number;
    /** 바닥 시공 평수 */
    workPyeong: number;
  };
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 바닥재 시공 품수를 계산한다.
 * manDays 는 반나절(0.5품) 단위로 올림된 값이고 최소 1품이 보장된다.
 * (소물량이어도 팀이 한 번 나오면 출동비가 붙는 현장 관행)
 */
export function calcFlooringLabor(input: FlooringLaborInput): FlooringLaborResult {
  // 바닥 면적을 평으로 바꾼다 (견적서 단가가 평 기준이라서)
  const workPyeong = Math.max(0, input.floorSqm) / SQM_PER_PYEONG;

  // 1) 종류별 평당 노무 단가
  const ratePerPyeong = FLOORING_LABOR_WON_PER_PYEONG[input.kind].value;

  // 2) 헤링본이면 배율을 곱한다
  const patternMult = input.isHerringbone ? HERRINGBONE_LABOR_MULT.value : 1;

  // 3) 인건비 → 품수 (기준 일당 30만, 반나절 단위 올림, 최소 1품)
  const baseAmount = Math.round(workPyeong * ratePerPyeong * patternMult);
  const rawManDays = baseAmount / FLOORING_BASE_DAILY_WAGE.value;
  const manDays = Math.max(
    1,
    Math.ceil(rawManDays / FLOORING_MAN_DAY_STEP) * FLOORING_MAN_DAY_STEP,
  );
  const teamDays = r1(manDays / FLOORING_TEAM_SIZE.value);

  // 4) 근거 문장 — 서버 안에서만 쓴다 (단가가 들어 있어 화면으로 내보내지 않는다)
  const parts = [`${input.kind} ${r1(workPyeong)}평 × ${ratePerPyeong.toLocaleString()}원`];
  if (patternMult !== 1) parts.push(`헤링본 ×${patternMult}`);
  parts.push(
    `= ${baseAmount.toLocaleString()}원 ÷ 일당 ${FLOORING_BASE_DAILY_WAGE.value.toLocaleString()}원` +
      ` → ${manDays}품 (2인 1조 약 ${teamDays}일)`,
  );

  return {
    manDays,
    teamDays,
    rawManDays: r1(rawManDays),
    baseAmount,
    basis: parts.join(' · '),
    applied: { ratePerPyeong, patternMult, workPyeong: r1(workPyeong) },
  };
}

// ── 표준품셈 대조용 (화면에 쓰지 않음) ──────────────

/** 표준품셈으로 환산한 인·일 */
export interface FlooringSpecManDays {
  /** 내장공 인·일 */
  interior: number;
  /** 보통인부 인·일 */
  helper: number;
  /** 둘을 합한 인·일 */
  total: number;
  /** 근거 문장 */
  note: string;
}

/**
 * 표준품셈 품으로 인·일을 계산한다.
 * 관급 원가계산 기준이라 민간 견적과 그대로 비교하면 안 되고,
 * "우리 품수가 터무니없이 낮지 않은가"를 개발 단계에서 보는 용도다.
 * (노임단가를 곱하지 않고 인·일만 돌려준다 — 내장공 노임 표본이 아직 없어서다)
 */
export function laborSpecManDays(args: { floorSqm: number; kind: FlooringKind }): FlooringSpecManDays {
  const rate = SPEC_MAN_DAY_PER_SQM[args.kind];
  const sqm = Math.max(0, args.floorSqm);

  const interior = r1(sqm * rate.interior);
  const helper = r1(sqm * rate.helper);

  return {
    interior,
    helper,
    total: r1(interior + helper),
    note: `${rate.source} · 바닥 ${r1(sqm)}㎡ 기준 내장공 ${interior}인·일 + 보통인부 ${helper}인·일`,
  };
}
