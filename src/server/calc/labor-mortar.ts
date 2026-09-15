// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 인건 계산 모듈
//
// 이 파일이 하는 일:
//   "이 미장 공사에 사람이 몇 명 붙는가(인원수)"를 계산한다. 도배·바닥재처럼 "품(인-일)을
//   누적해서 며칠"로 계산하지 않는다 — 06_미장.md §11-8 "연속 타설 규칙"에 따라 미장은
//   구획이 안 나뉘면 하루 안에 반드시 끝내야 한다(물량이 많으면 날짜를 늘리지 않고 사람을
//   늘린다). 그래서 이 모듈의 결과는 항상 "며칠"이 아니라 "오늘 몇 명"이다.
//
// 2026-09-15 운영자 현장 기준 지시로 전면 개정한 것:
//   1) 손미장 인건 공식을 §6-1(벽 모르타르 바름 준용, ㎡당 0.07·0.03) 방식에서
//      §11-5·§11-8(운영자 현장 기준 "20평×100mm=기공2·조공2, 1일") 방식으로 바꿨다.
//      새 공식: 필요 인원 = ceil(체적㎥ ÷ 6.6116㎥ × 2), 기공·조공 각각 최소 1명.
//   2) 장비 타설도 같은 "하루 완료" 철학으로 바꿨다 — 9-1-3 품(인-일)을 그대로 인원수로
//      쓴다(품이 곧 "그날 필요한 사람 수"라고 본다). 예전처럼 반나절 단위로 올려 "2인 1조
//      며칠"로 보여주지 않는다.
//   3) 노임을 단일값이 아니라 범위(PLASTERER_WAGE_RANGE·HELPER_WAGE_RANGE)로 바꿨다 —
//      하한 시장가·상한 표준품셈. 인건비도 amountMin~amountMax 범위로 나온다.
//   4) 장비대(장비 임대료)·피니싱(정벌 마무리)은 이 모듈이 계산하지 않는다 — 둘 다 인원
//      계산과 무관한 "고정 비용/추가 인원" 항목이라 오케스트레이터(mortar.ts)가 직접
//      pricing/mortar.ts 단가로 별도 줄을 만든다(5층 비용 구성 중 "인건" 층에 같이 묶인다).
//   5) 셀프레벨링은 여전히 인건을 계산하지 않는다(06_미장.md §6-4 — 인건비만 분리한
//      근거가 없어서 원/㎡ 단가를 만들면 추정이 아니라 창작이 된다). null을 돌려주고,
//      화면은 "시공비는 현장 견적 별도" 안내만 보여준다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 15일(운영자 현장 기준 지시 — 5층 비용 구조 전면 개편)
// 근거: docs/도메인지식/06_미장.md §11-5·§11-6·§11-7·§11-8
// ──────────────────────────────────────────────

import 'server-only';

import { ceilSafe } from './cutting/round';
import {
  HAND_CREW_BASE_VOLUME_M3,
  HAND_CREW_BASE_HEADCOUNT,
  LARGE_AREA_PLASTERER_PER_M3,
  LARGE_AREA_HELPER_PER_M3,
  LARGE_AREA_MECHANIC_PER_M3,
  PLASTERER_WAGE_RANGE,
  HELPER_WAGE_RANGE,
  MECHANIC_DAILY_WAGE_ESTIMATE,
  WIRE_MESH_LABOR_MANDAY_PER_10SQM,
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
  /** 기공(미장공) 인원 — 오늘 하루 투입해야 하는 인원수 */
  crewPlasterer: number;
  /** 조공(보통인부) 인원 */
  crewHelper: number;
  /** 일반기계운전사 인원 — 장비 타설일 때만 0보다 크다 */
  crewMechanic: number;
  /** 완료 일수 — 연속 타설 하루 완료 제약이라 항상 1 */
  days: 1;
  /** 인건비 총액 하한(원) — 시장 일당 기준 */
  amountMin: number;
  /** 인건비 총액 상한(원) — 표준품셈 일당 기준 */
  amountMax: number;
  /** 이번에 쓴 공법 */
  method: MortarMethod;
  /** 일반기계운전사 노임이 추정치(등급 C)라는 표시 — 화면 배지용 */
  mechanicWageIsEstimate: boolean;
  /** 서버 안에서만 쓰는 근거 문장 (화면 note 에는 인원·일수만 나간다) */
  basis: string;
}

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 미장 시공 인원·인건비를 계산한다.
 * 셀프레벨링은 인건을 계산하지 않으므로 null을 돌려준다 — 호출하는 쪽(mortar.ts)이
 * null이면 결과의 labor 칸을 아예 비우고 SELF_LEVEL_LABOR_ADVISORY_NOTE를 대신 보여준다.
 */
export function calcMortarLabor(input: MortarLaborInput): MortarLaborResult | null {
  if (input.mode === '셀프레벨링') return null;

  const area = Math.max(0, input.areaSqm);
  const thickness = Math.max(0, input.thicknessMm);
  // 체적은 순수값(로스 미포함)을 쓴다 — 운영자 현장 기준 6.6116㎥도 로스 없는 기하학적 체적이다.
  const volumeM3 = (area * thickness) / 1000;
  const method: MortarMethod = input.method ?? '손미장';

  let crewPlasterer: number;
  let crewHelper: number;
  let crewMechanic = 0;

  if (method === '장비타설') {
    // 표준품셈 9-1-3(타설) + 일반기계운전사 — 품(인-일)을 그대로 "오늘 필요한 인원"으로
    // 쓴다(연속 타설 하루 완료 제약, §11-8을 장비 타설에도 준용).
    // ⚠️ 2026-09-15 검사관 지적: 예전엔 여기에 9-1-4(표면마무리, LARGE_AREA_FINISH_
    // PLASTERER_PER_100SQM)까지 더했는데, 오케스트레이터(mortar.ts)가 "피니싱"이라는
    // 별도 줄(형아 기준 — 기공 1인 × 0.5일, §11-6)을 이미 breakdown에 추가하고 있어서
    // 표면마무리 인건이 두 번 잡히는 이중 계상이었다(품(0.30/100㎡)과 형아 기준(0.5일)은
    // 서로 다른 출처의 "마무리" 개념이라 둘 다 더하면 안 된다). 형아 기준(피니싱)을
    // 채택하고 여기서는 9-1-3(순수 타설)만 남긴다.
    const plastererManDay = volumeM3 * LARGE_AREA_PLASTERER_PER_M3.value;
    const helperManDay = volumeM3 * LARGE_AREA_HELPER_PER_M3.value;
    const mechanicManDay = volumeM3 * LARGE_AREA_MECHANIC_PER_M3.value;
    crewPlasterer = Math.max(1, ceilSafe(plastererManDay));
    crewHelper = Math.max(1, ceilSafe(helperManDay));
    crewMechanic = mechanicManDay > 0 ? Math.max(1, ceilSafe(mechanicManDay)) : 0;
  } else {
    // 손미장 — 운영자 현장 기준 20평(6.6116㎥)×100mm = 기공2·조공2, 1일(§11-5).
    // 필요 인원 = ceil(체적 ÷ 기준체적 × 기준인원), 최소 1명씩.
    const raw = (volumeM3 / HAND_CREW_BASE_VOLUME_M3.value) * HAND_CREW_BASE_HEADCOUNT.value;
    crewPlasterer = Math.max(1, ceilSafe(raw));
    crewHelper = Math.max(1, ceilSafe(raw));
  }

  // 와이어메시 옵션 — 라스 붙임 품(미장공)을 인건비에 더한다. 인원수 자체는 안 늘린다
  // (같은 기공 조가 하루 안에 같이 처리할 수 있는 소량 추가 작업으로 본다).
  const wireMeshManDay = input.wireMesh ? (area / 10) * WIRE_MESH_LABOR_MANDAY_PER_10SQM.value : 0;

  const amountMin = Math.round(
    crewPlasterer * PLASTERER_WAGE_RANGE.min +
      crewHelper * HELPER_WAGE_RANGE.min +
      crewMechanic * MECHANIC_DAILY_WAGE_ESTIMATE.value +
      wireMeshManDay * PLASTERER_WAGE_RANGE.min,
  );
  const amountMax = Math.round(
    crewPlasterer * PLASTERER_WAGE_RANGE.max +
      crewHelper * HELPER_WAGE_RANGE.max +
      crewMechanic * MECHANIC_DAILY_WAGE_ESTIMATE.value +
      wireMeshManDay * PLASTERER_WAGE_RANGE.max,
  );

  const parts = [
    method === '장비타설' ? `체적 ${r1(volumeM3)}㎥ 장비 타설 기준` : `체적 ${r1(volumeM3)}㎥ 손미장 기준(20평×100mm=기공2·조공2 환산)`,
    `기공 ${crewPlasterer}인 × ${PLASTERER_WAGE_RANGE.min.toLocaleString()}~${PLASTERER_WAGE_RANGE.max.toLocaleString()}원`,
    `조공 ${crewHelper}인 × ${HELPER_WAGE_RANGE.min.toLocaleString()}~${HELPER_WAGE_RANGE.max.toLocaleString()}원`,
  ];
  if (crewMechanic > 0) parts.push(`일반기계운전사 ${crewMechanic}인 × ${MECHANIC_DAILY_WAGE_ESTIMATE.value.toLocaleString()}원(추정)`);
  if (wireMeshManDay > 0) parts.push('와이어메시 라스 붙임 품 포함');
  parts.push(`= ${amountMin.toLocaleString()}~${amountMax.toLocaleString()}원 → 1일 완료`);

  return {
    crewPlasterer,
    crewHelper,
    crewMechanic,
    days: 1,
    amountMin,
    amountMax,
    method,
    mechanicWageIsEstimate: crewMechanic > 0,
    basis: parts.join(' · '),
  };
}

/** 셀프레벨링 화면에 보여줄 안내 문구를 그대로 다시 내보낸다(호출부에서 import 한 곳만 신경 쓰면 되게) */
export { SELF_LEVEL_LABOR_ADVISORY_NOTE };
