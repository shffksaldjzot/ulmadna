// ──────────────────────────────────────────────
// 바닥 미장(레미탈·셀프레벨링) 물량 계수 모음 (단가 아님 — 단가는 src/server/pricing/mortar.ts)
//
// 이 파일이 하는 일:
//   레미탈(몰탈)·셀프레벨링 물량을 뽑을 때 쓰는 숫자를 한 곳에 모아 둔다.
//   숫자만 덜렁 두지 않고 값마다 "어디서 온 값인지(출처)"와 "얼마나 믿을 만한지(등급)"를
//   같이 적는다. 도배·바닥재 계수 파일과 같은 형식이다.
//
// 등급 뜻 (도배·바닥재와 같다):
//   A = 표준품셈 원문·제조사 공식 스펙 등 근거 문서 확보
//   B = 여러 출처를 교차 확인했거나, 공식 스펙을 계산으로 역산한 값
//   C = 추정치. 시공팀 확인 대기 → 화면에 "추정" 표기 필요
//
// 2026-09-14 검사관(opus) 지적 반영:
//   1) 용도·두께·공법 기본값 표는 단가가 아니라 화면에도 그대로 보여야 하는 "공개 가능한 값"이라
//      src/lib/v1/mortarPresets.ts 하나로 합쳤다(전엔 이 파일과 mortarEngineInput.ts에 같은 표가
//      두 번 있어서 한쪽만 고치면 서버·화면 기본값이 어긋나는 사고가 날 수 있었다). 이 파일은
//      그 프리셋 타입(MortarMode·MortarUsage·SelfLevelUsage·MortarMethod)을 다시 내보내기만 한다.
//   2) "체적 10㎥ 이상이면 장비 타설" 문턱을 폐기했다 — 공법은 용도가 정한다(방통 전체만 장비
//      타설). LARGE_AREA_VOLUME_THRESHOLD_M3는 그래서 삭제.
//   3) 셀프레벨링 인건 추정치(SELF_LEVEL_LABOR_WON_PER_SQM)를 삭제했다 — 06_미장.md §6-4가
//      권장한 대로 셀프레벨링은 인건을 계산하지 않고 "시공비는 현장 견적 별도"로 안내한다.
//   4) 장비 타설에 들어가는 일반기계운전사 품(§6-2)·노임 추정치를 새로 추가했다.
//
// 작성일: 2026년 09월 14일
// 근거 문서: docs/도메인지식/06_미장.md (전체 절 번호를 그대로 인용)
//   — 2022 건설공사 표준품셈 제9장 미장공사(건축부문) + 공통부문 1-4-1 재료의 할증 원문,
//     제조사 공식 스펙(삼표·한일시멘트·마페이) 웹 조사 종합
// ──────────────────────────────────────────────

import type { Coefficient, CoefficientRange } from './wallpaper-coefficients';
import { SQM_PER_PYEONG } from './wallpaper-coefficients';
import type { MortarMode, MortarUsage, SelfLevelUsage, MortarMethod } from '@/lib/v1/mortarPresets';
import { USAGE_PRESET, SELF_LEVEL_USAGE_PRESET } from '@/lib/v1/mortarPresets';

// 도배에서 이미 정해 둔 단위 환산 타입·값을 그대로 다시 내보낸다 (같은 숫자를 두 곳에 안 둔다)
export type { Coefficient, CoefficientRange };
export { SQM_PER_PYEONG };

// ── 0. 모드·용도·공법 타입 + 프리셋 (실제 정의는 src/lib/v1/mortarPresets.ts) ──
// 단가가 아니라 화면에도 그대로 나가는 값이라 클라이언트와 공유하는 파일에 옮겼다.
// 서버 쪽 코드(mortar.ts·labor-mortar.ts)는 그대로 이 이름들을 이 파일에서 가져다 쓸 수 있다.
export type { MortarMode, MortarUsage, SelfLevelUsage, MortarMethod };
export { USAGE_PRESET, SELF_LEVEL_USAGE_PRESET };

// ── 1. 로스율 ──────────────────────────────────────

/**
 * 몰탈 로스(여유) 비율.
 * 면적×두께의 기하학적 체적이 원칙적으로 그대로 소요량이지만(로스 없음이 표준품셈 원칙),
 * 실무에서는 흘림·되비빔 손실 등으로 여유를 더 둔다.
 */
export const MORTAR_LOSS_RATE_DEFAULT: Coefficient = {
  value: 0.05,
  grade: 'C',
  source: '06_미장.md §2-2·§3 — 표준품셈은 모르타르 자체 할증률이 없음(면적×두께가 곧 소요 체적이 원칙). 실무에서 흘림·되비빔 손실로 5% 내외 여유를 추가로 잡는 관행',
};

// ── 2. 배합비 (표준품셈 9-1-1, 06_미장.md §2-1) ────────

/** 배합용적비 하나(㎥당 재료량, 할증 포함 — 표준품셈 원문 그대로) */
export interface MixRatioSpec {
  /** 시멘트 (kg/㎥) */
  cementKgPerM3: number;
  /** 모래 (㎥/㎥) */
  sandM3PerM3: number;
}

/**
 * 배합용적비별 ㎥당 재료량. 표준품셈 9-1-1 [참고자료] 원문 — 할증이 이미 포함된 값.
 * ⚠️ 이 표는 이미 할증(재료 자체 로스)을 포함하고 있다 — 여기에 다시 몰탈 로스율(5%)을
 *    곱하면 로스가 두 번 들어간다(2026-09-14 검사관 지적으로 mortar.ts에서 이중 할증을 뺐다).
 *    현장 배합 대안은 반드시 **로스 미포함(순수) 체적**에 이 표를 곱한다.
 */
export const MIX_RATIO_TABLE: Record<'1:1' | '1:2' | '1:3' | '1:4' | '1:5', MixRatioSpec> = {
  '1:1': { cementKgPerM3: 1093, sandM3PerM3: 0.78 },
  '1:2': { cementKgPerM3: 680, sandM3PerM3: 0.98 },
  '1:3': { cementKgPerM3: 510, sandM3PerM3: 1.1 },
  '1:4': { cementKgPerM3: 385, sandM3PerM3: 1.1 },
  '1:5': { cementKgPerM3: 320, sandM3PerM3: 1.15 },
};

/** 계산기 기본 배합비 — 바닥 미장·방통은 통상 1:3을 쓴다(현장 관행) */
export const DEFAULT_MIX_RATIO: '1:2' | '1:3' = '1:3';

/** 시멘트 포대 단위 (kg) — 표준품셈에 포장단위 언급이 없어 업계 통상값을 쓴다 */
export const CEMENT_BAG_KG: Coefficient = {
  value: 40,
  grade: 'C',
  source: '06_미장.md — 표준품셈 원문엔 포장단위 언급이 없다. 국내 포틀랜드시멘트 유통 표준(40kg 포대) 관행값',
};

// ── 3. 레미탈(일반 미장용 40kg) — 두께별 소요량 (06_미장.md §4) ──

/**
 * 레미탈 두께별 kg/(mm·㎡) 계수.
 * 삼표 SP몰탈 공식 스펙(40kg = 1.3~1.4㎡/포, 두께 18mm 기준)을 두께 무관 계수로 역산한 값.
 * 셀프레벨링 제품 계수(1.5~1.7)와 거의 일치해 신뢰도가 높다고 본다(등급 B, 역산값).
 */
export const REMICON_KG_PER_MM_SQM: Coefficient = {
  value: 1.65,
  grade: 'B',
  source: '06_미장.md §4-1 — 삼표 SP몰탈 일반미장용 공식 스펙(40kg÷1.35㎡÷18mm≈1.65kg/mm·㎡) 역산값',
};

/** 레미탈 포대 단위 (kg) — 제조사 공식(삼표·한일시멘트 공통) */
export const REMICON_BAG_KG: Coefficient = {
  value: 40,
  grade: 'A',
  source: '06_미장.md §4-1 — 삼표 SP몰탈·한일시멘트 레미탈 공식 포장단위 40kg',
};

// ── 4. 셀프레벨링(수평몰탈 25kg) — 두께별 소요량 (06_미장.md §5) ──

/**
 * 셀프레벨링 두께별 kg/(mm·㎡) 계수.
 * 한일시멘트(1.5~1.7)·마페이(1.6) 세 브랜드 공식 계수가 1.5~1.7 범위에 수렴해
 * 대표값 1.6을 기본으로 쓴다(등급 B, 다중 제조사 수렴값).
 */
export const SELF_LEVEL_KG_PER_MM_SQM: Coefficient = {
  value: 1.6,
  grade: 'B',
  source: '06_미장.md §5-1 — 한일시멘트 RFSL 시리즈(1.5~1.7)·마페이 울트라플랜(1.6) 교차검증 수렴값',
};

/** 셀프레벨링 포대 단위 (kg) — 제조사 공통(한일·마페이 전부 25kg) */
export const SELF_LEVEL_BAG_KG: Coefficient = {
  value: 25,
  grade: 'A',
  source: '06_미장.md §5-1 — 한일시멘트 RFSL 시리즈·마페이 울트라플랜 공식 포장단위 25kg',
};

// ── 5. 프라이머 (셀프레벨링 필수, 06_미장.md §5-3) ────────

/** 프라이머 원액 도포량 (L/㎡) — 희석 1:2~1:3, 2~3회 도포 기준 */
export const SELF_LEVEL_PRIMER_L_PER_SQM: Coefficient = {
  value: 0.2,
  grade: 'C',
  source: '06_미장.md §5-3 — 18L 캔 1통으로 희석 최대 1:3 시 약 90㎡ 시공(유통 블로그 종합치, 제조사 데이터시트 원문 미확인)',
};

/** 프라이머 캔 용량 (L) */
export const SELF_LEVEL_PRIMER_CAN_L: Coefficient = {
  value: 18,
  grade: 'C',
  source: '06_미장.md §5-3 — 18L 캔 유통 규격 기준(유통 블로그 종합치)',
};

// ── 6. 부자재 — 와이어메시 (06_미장.md §8) ──────────────

/** 와이어메시 겹침 여유 계수 — 표준품셈에 재료 소요량 항목이 없어 겹침 10%로 추정 */
export const WIRE_MESH_OVERLAP_MULT: Coefficient = {
  value: 1.1,
  grade: 'C',
  source: '06_미장.md §8 — 표준품셈 9-1-5는 시공 품만 규정하고 재료 자체 소요량(㎡당 매수·겹침률)은 없음. 통상 겹침 10% 반영해 추정',
};

/** 와이어메시 라스 붙임 품(미장공, 10㎡당) — 재료가 아니라 붙이는 손품 */
export const WIRE_MESH_LABOR_MANDAY_PER_10SQM: Coefficient = {
  value: 0.14,
  grade: 'A',
  source: '06_미장.md §8 — 표준품셈 [건축] 9-1-5 라스 붙임 원문',
};

// ── 7. 인건 — 노임단가 (06_미장.md §7, 2026년 상반기) ──────

/** 미장공 1일 노임 (원) — 2026년 상반기 대한건설협회 시중노임단가 */
export const PLASTERER_DAILY_WAGE_2026H1: Coefficient = {
  value: 277276,
  grade: 'A',
  source: '06_미장.md §7 — 2026년 상반기 시중노임단가(대한건설협회), 반기 갱신 필요',
};

/** 보통인부 1일 노임 (원) — 2026년 상반기 */
export const HELPER_DAILY_WAGE_2026H1: Coefficient = {
  value: 172068,
  grade: 'A',
  source: '06_미장.md §7 — 2026년 상반기 시중노임단가(대한건설협회), 반기 갱신 필요',
};

/**
 * 일반기계운전사 1일 노임 추정치 (원) — 06_미장.md §7에 "미수록, 별도 확인 필요"로 남은 값.
 * 노임 자료가 없어서 특별인부(226,122원)~미장공(277,276원) 사이 근사치로 추정한다.
 * 등급 C, 형아 확인 대기(2026-09-14 검사관 지적 — 노임 없으면 만들지 말고 추정 표기).
 */
export const MECHANIC_DAILY_WAGE_ESTIMATE: Coefficient = {
  value: 250000,
  grade: 'C',
  source: '06_미장.md §7 — 일반기계운전사 노임단가 미수록. 특별인부~미장공 노임 사이 근사 추정치, 확인 대기',
};

// ── 8. 인건 — 손미장 (06_미장.md §6-1, 벽 기준 준용) ────

/**
 * 손미장(확장부·욕실구배·마루보수 등 소면적) 인건 품 — ㎡당.
 * 표준품셈 9-1-2는 벽체 기준(바름두께 24mm 이하)이라 바닥에 그대로 쓸 수 없지만,
 * 손 미장 인건비를 추정할 때 가장 가까운 참고치라 등급 C로 준용한다.
 * 2회 바름(초벌+정벌) 기준.
 */
export const SMALL_AREA_PLASTERER_PER_SQM: Coefficient = {
  value: 0.07,
  grade: 'C',
  source: '06_미장.md §6-1 — 표준품셈 9-1-2 벽 모르타르 바름 2회(3.6m 이하) 미장공 0.07인/㎡를 바닥 손미장에 준용(원래는 벽 기준)',
};

/** 손미장 보통인부 품 — ㎡당 */
export const SMALL_AREA_HELPER_PER_SQM: Coefficient = {
  value: 0.03,
  grade: 'C',
  source: '06_미장.md §6-1 — 표준품셈 9-1-2 벽 모르타르 바름 2회(3.6m 이하) 보통인부 0.03인/㎡를 바닥 손미장에 준용',
};

// ── 9. 인건 — 장비 타설 (06_미장.md §6-2·§6-3) ────
//
// 2026-09-14 검사관 지적: "체적이 크면 장비 타설"이 아니라 "방통처럼 바닥 전체를 붓는
// 공사라서 장비 타설"이다 — 공법은 용도(USAGE_PRESET[].defaultMethod)가 정하고,
// 정밀 모드에서 사용자가 직접 공법을 바꿀 수도 있다. 체적 문턱(LARGE_AREA_VOLUME_THRESHOLD_M3)은
// 그래서 폐기했다.

/** 장비 타설 미장공 품 (인/㎥) — 표준품셈 0.39/10㎥ */
export const LARGE_AREA_PLASTERER_PER_M3: Coefficient = {
  value: 0.039,
  grade: 'A',
  source: '06_미장.md §6-2 — 표준품셈 [건축] 9-1-3 바닥 모르타르 타설(장비 이용) 미장공 0.39인/10㎥',
};

/** 장비 타설 보통인부 품 (인/㎥) — 표준품셈 0.47/10㎥ */
export const LARGE_AREA_HELPER_PER_M3: Coefficient = {
  value: 0.047,
  grade: 'A',
  source: '06_미장.md §6-2 — 표준품셈 [건축] 9-1-3 바닥 모르타르 타설(장비 이용) 보통인부 0.47인/10㎥',
};

/** 장비 타설 일반기계운전사 품 (인/㎥) — 표준품셈 0.20/10㎥ */
export const LARGE_AREA_MECHANIC_PER_M3: Coefficient = {
  value: 0.02,
  grade: 'A',
  source: '06_미장.md §6-2 — 표준품셈 [건축] 9-1-3 바닥 모르타르 타설(장비 이용) 일반기계운전사 0.20인/10㎥',
};

/** 장비 타설 표면 마무리(인력마감) 미장공 품 (인/100㎡) — 표준품셈 0.30/100㎡ */
export const LARGE_AREA_FINISH_PLASTERER_PER_100SQM: Coefficient = {
  value: 0.3,
  grade: 'A',
  source: '06_미장.md §6-3 — 표준품셈 [건축] 9-1-4 표면 마무리(인력마감) 미장공 0.30인/100㎡',
};

/** 장비 타설일 때 화면에 보여줄 안내 — 장비 사용료는 계상하지 않으니(단가 창작 금지) 문구로만 알린다 */
export const EQUIPMENT_RENTAL_NOTE = '모르타르 타설 장비비 별도(현장 견적)';

// ── 10. 셀프레벨링 인건 — 계산하지 않음 (06_미장.md §6-4) ──
//
// 2026-09-14 검사관 지적으로 셀프레벨링 인건 추정 단가(8,000원/㎡)를 삭제했다.
// 표준품셈에 항목이 없고 "재료비+인건비 합산 평당 5만~9만원"만 확인되는데, 인건비만
// 분리한 근거가 없는 상태에서 원/㎡ 단가를 만들면 "노임 없으면 추정 표기"가 아니라
// "근거 없는 숫자 창작"이 된다. 그래서 셀프레벨링은 자재비만 계산하고, 화면에는
// 아래 문구로 "시공비는 현장 견적 별도"를 안내한다(labor-mortar.ts가 이 값을 그대로 돌려준다).
export const SELF_LEVEL_LABOR_ADVISORY_NOTE = '시공비는 현장 견적 별도';

// ── 11. 품수 환산 규칙 (도배·바닥재와 같은 방식) ────────

/**
 * 품수 올림 단위 (0.5 = 반나절).
 * ⚠️ 최소 품수는 "1품"이 아니라 이 값(0.5품)이다 — 반나절 출동도 가능하다고 본다
 * (2026-09-14 검사관 지적: 예전 주석이 "최소 1품"이라고 코드와 다르게 적혀 있었다).
 */
export const MORTAR_MAN_DAY_STEP = 0.5;

/** 미장 1조 인원 (2인 1조 관행) */
export const MORTAR_TEAM_SIZE: Coefficient = {
  value: 2,
  grade: 'C',
  source: '도배·바닥재와 같은 2인 1조 관행을 준용 — 미장 전용 표본 없음(추정)',
};
