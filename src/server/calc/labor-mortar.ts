// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 인건 계산 모듈
//
// 이 파일이 하는 일:
//   "이 미장 공사에 사람이 며칠 붙는가(품수)"를 계산한다.
//
// 2026-09-14 검사관(opus) 지적으로 크게 고쳤다:
//   1) "체적 10㎥ 이상이면 장비 타설" 문턱을 폐기했다. 공법은 **용도**가 정한다 —
//      방통 전체는 장비 타설(9-1-3+9-1-4+일반기계운전사 9-1-3), 나머지(확장부·욕실구배·
//      마루보수)는 손미장(9-1-2 벽 기준 준용)이다. 오케스트레이터(mortar.ts)가 용도로
//      기본 공법을 정하고, 정밀 모드에서 사용자가 공법 토글로 직접 바꿀 수도 있다 —
//      그래서 이 함수는 `method`를 그대로 받기만 하고 스스로 판정하지 않는다.
//   2) 장비 타설이면 장비 사용료는 계상하지 않고(단가를 지어내지 않는다) "장비비 별도"
//      안내 문구만 돌려준다.
//   3) 셀프레벨링은 인건 자체를 계산하지 않는다(06_미장.md §6-4 — 인건비만 분리한 근거가
//      없어서 원/㎡ 단가를 만들면 추정이 아니라 창작이 된다). null을 돌려주고, 화면은
//      "시공비는 현장 견적 별도" 안내만 보여준다.
//
// 계산 방식(레미탈 모드):
//   장비 타설: 미장공 = 체적×0.039 + 면적×0.003(표면마무리) · 보통인부 = 체적×0.047
//              · 일반기계운전사 = 체적×0.020(노임은 추정치, 등급 C)
//   손미장  : 미장공 = 면적×0.07 · 보통인부 = 면적×0.03
//   와이어메시 옵션을 켰으면 라스 붙임 품(미장공 면적/10×0.14)을 더한다(공법 무관).
//
// 품수는 반나절(0.5품) 단위로 올리고 **최소 0.5품**을 보장한다(도배·바닥재의 "최소 1품"과
// 다르게, 미장은 반나절 출동도 가능하다고 본다 — 2026-09-14 검사관 지적으로 주석을
// 코드와 맞췄다. 예전 주석은 "최소 1품"이라고 잘못 적혀 있었다).
//
// 작성일: 2026년 09월 14일
// 근거: docs/도메인지식/06_미장.md §6·§7
// ──────────────────────────────────────────────

import 'server-only';

import {
  SMALL_AREA_PLASTERER_PER_SQM,
  SMALL_AREA_HELPER_PER_SQM,
  LARGE_AREA_PLASTERER_PER_M3,
  LARGE_AREA_HELPER_PER_M3,
  LARGE_AREA_MECHANIC_PER_M3,
  LARGE_AREA_FINISH_PLASTERER_PER_100SQM,
  EQUIPMENT_RENTAL_NOTE,
  PLASTERER_DAILY_WAGE_2026H1,
  HELPER_DAILY_WAGE_2026H1,
  MECHANIC_DAILY_WAGE_ESTIMATE,
  WIRE_MESH_LABOR_MANDAY_PER_10SQM,
  MORTAR_MAN_DAY_STEP,
  MORTAR_TEAM_SIZE,
  SELF_LEVEL_LABOR_ADVISORY_NOTE,
  type MortarMode,
  type MortarMethod,
} from './schema/mortar-coefficients';

/** 인건 계산에 넣는 값들 */
export interface MortarLaborInput {
  /** 시공 면적 (㎡) */
  areaSqm: number;
  /** 두께 (mm) — 체적 계산에 쓴다 */
  thicknessMm: number;
  /** 계산기 모드 */
  mode: MortarMode;
  /** 레미탈 모드 전용 — 장비 타설 / 손미장. 오케스트레이터가 용도(usage)나 사용자 토글로 정해서 넘긴다 */
  method?: MortarMethod;
  /** 와이어메시 옵션을 켰는지 (레미탈 전용) */
  wireMesh?: boolean;
}

/** 인건 계산 결과 */
export interface MortarLaborResult {
  /** 미장공 품수 (소수 1자리) */
  manDaysPlasterer: number;
  /** 보통인부 품수 (소수 1자리) */
  manDaysHelper: number;
  /** 일반기계운전사 품수 (소수 1자리) — 장비 타설일 때만 0보다 크다 */
  manDaysMechanic: number;
  /** 합산 품수 (반나절 단위 올림, 최소 0.5) — 결과 화면 "시공" 줄의 qty */
  manDaysTotal: number;
  /** 참고용 조 일수 (2인 1조 기준) */
  teamDays: number;
  /** 실제 노임을 곱한 인건비 총액 (원) */
  amount: number;
  /** 이번에 쓴 공법 */
  method: MortarMethod;
  /** 장비 타설일 때만: "장비비 별도" 안내 문구(가격은 안 붙인다) */
  equipmentNote?: string;
  /** 일반기계운전사 노임이 추정치(등급 C)라는 표시 — 화면 배지용 */
  mechanicWageIsEstimate: boolean;
  /** 서버 안에서만 쓰는 근거 문장 (화면 note 에는 품수만 나간다) */
  basis: string;
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 반나절(0.5) 단위로 올리고 최소 0.5를 보장한다 */
function roundManDays(raw: number): number {
  return Math.max(MORTAR_MAN_DAY_STEP, Math.ceil(raw / MORTAR_MAN_DAY_STEP) * MORTAR_MAN_DAY_STEP);
}

/**
 * 미장 시공 품수·인건비를 계산한다.
 * 셀프레벨링은 인건을 계산하지 않으므로 null을 돌려준다 — 호출하는 쪽(mortar.ts)이
 * null이면 결과의 labor 칸을 아예 비우고 SELF_LEVEL_LABOR_ADVISORY_NOTE를 대신 보여준다.
 */
export function calcMortarLabor(input: MortarLaborInput): MortarLaborResult | null {
  if (input.mode === '셀프레벨링') return null;

  const area = Math.max(0, input.areaSqm);
  const thickness = Math.max(0, input.thicknessMm);
  const volumeM3 = (area * thickness) / 1000;
  const method: MortarMethod = input.method ?? '손미장';

  let plasterer: number;
  let helper: number;
  let mechanic = 0;
  let equipmentNote: string | undefined;

  if (method === '장비타설') {
    // 표준품셈 9-1-3(타설) + 9-1-4(표면 마무리·인력마감) + 일반기계운전사
    plasterer = volumeM3 * LARGE_AREA_PLASTERER_PER_M3.value + area * (LARGE_AREA_FINISH_PLASTERER_PER_100SQM.value / 100);
    helper = volumeM3 * LARGE_AREA_HELPER_PER_M3.value;
    mechanic = volumeM3 * LARGE_AREA_MECHANIC_PER_M3.value;
    equipmentNote = EQUIPMENT_RENTAL_NOTE;
  } else {
    // 손미장 — 표준품셈 9-1-2 벽 기준 준용(등급 C)
    plasterer = area * SMALL_AREA_PLASTERER_PER_SQM.value;
    helper = area * SMALL_AREA_HELPER_PER_SQM.value;
  }

  // 와이어메시 옵션 — 라스 붙임 품(미장공)을 더한다. 공법과 무관하게 적용
  if (input.wireMesh) {
    plasterer += (area / 10) * WIRE_MESH_LABOR_MANDAY_PER_10SQM.value;
  }

  const amount = Math.round(
    plasterer * PLASTERER_DAILY_WAGE_2026H1.value +
      helper * HELPER_DAILY_WAGE_2026H1.value +
      mechanic * MECHANIC_DAILY_WAGE_ESTIMATE.value,
  );
  const manDaysPlasterer = r1(plasterer);
  const manDaysHelper = r1(helper);
  const manDaysMechanic = r1(mechanic);
  const manDaysTotal = roundManDays(manDaysPlasterer + manDaysHelper + manDaysMechanic);
  const teamDays = r1(manDaysTotal / MORTAR_TEAM_SIZE.value);

  const parts = [
    method === '장비타설' ? `체적 ${r1(volumeM3)}㎥ 장비 타설 기준` : `면적 ${r1(area)}㎡ 손미장 기준`,
    `미장공 ${manDaysPlasterer}인 × ${PLASTERER_DAILY_WAGE_2026H1.value.toLocaleString()}원`,
    `보통인부 ${manDaysHelper}인 × ${HELPER_DAILY_WAGE_2026H1.value.toLocaleString()}원`,
  ];
  if (mechanic > 0) parts.push(`일반기계운전사 ${manDaysMechanic}인 × ${MECHANIC_DAILY_WAGE_ESTIMATE.value.toLocaleString()}원(추정)`);
  if (input.wireMesh) parts.push('와이어메시 라스 붙임 품 포함');
  parts.push(`= ${amount.toLocaleString()}원 → ${manDaysTotal}품 (2인 1조 약 ${teamDays}일)`);

  return {
    manDaysPlasterer,
    manDaysHelper,
    manDaysMechanic,
    manDaysTotal,
    teamDays,
    amount,
    method,
    equipmentNote,
    mechanicWageIsEstimate: mechanic > 0,
    basis: parts.join(' · '),
  };
}

/** 셀프레벨링 화면에 보여줄 안내 문구를 그대로 다시 내보낸다(호출부에서 import 한 곳만 신경 쓰면 되게) */
export { SELF_LEVEL_LABOR_ADVISORY_NOTE };
