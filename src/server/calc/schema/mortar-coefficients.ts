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
// 2026-09-15 운영자 현장 기준 피드백(포수 즉답): 계수 값 자체는 클라이언트도 똑같이 써야 해서
// src/lib/v1/mortarQuantity.ts(공유 폴더)에 원본 숫자를 옮겨 뒀다. 여기서는 그 숫자를
// 그대로 가져와 등급·출처를 붙인 Coefficient로 감싸기만 한다 — 숫자 자체를 두 번 적지 않는다.
import {
  MORTAR_LOSS_RATE_DEFAULT as MORTAR_LOSS_RATE_DEFAULT_RAW,
  REMICON_KG_PER_MM_SQM as REMICON_KG_PER_MM_SQM_RAW,
  REMICON_BAG_KG as REMICON_BAG_KG_RAW,
  SELF_LEVEL_KG_PER_MM_SQM as SELF_LEVEL_KG_PER_MM_SQM_RAW,
  SELF_LEVEL_BAG_KG as SELF_LEVEL_BAG_KG_RAW,
  SELF_LEVEL_PRIMER_L_PER_SQM as SELF_LEVEL_PRIMER_L_PER_SQM_RAW,
  SELF_LEVEL_PRIMER_CAN_L as SELF_LEVEL_PRIMER_CAN_L_RAW,
  MIX_RATIO_TABLE,
  DEFAULT_MIX_RATIO,
  CEMENT_BAG_KG as CEMENT_BAG_KG_RAW,
  calcMortarBags,
  calcMortarVolume,
  calcAltMix,
} from '@/lib/v1/mortarQuantity';

// 물량 계산 함수도 공유 모듈 것을 그대로 다시 내보낸다 — schema/mortar.ts·mortar.ts
// 오케스트레이터가 여기서 가져다 쓴다(서버가 직접 lib을 import해도 되는 방향이라 문제 없다.
// 금지 규칙은 "클라이언트가 src/server/**를 import"하는 반대 방향이다).
export { MIX_RATIO_TABLE, DEFAULT_MIX_RATIO, calcMortarBags, calcMortarVolume, calcAltMix };

// 도배에서 이미 정해 둔 단위 환산 타입·값을 그대로 다시 내보낸다 (같은 숫자를 두 곳에 안 둔다)
export type { Coefficient, CoefficientRange };
export { SQM_PER_PYEONG };

// ── 0. 모드·용도·공법 타입 + 프리셋 (실제 정의는 src/lib/v1/mortarPresets.ts) ──
// 단가가 아니라 화면에도 그대로 나가는 값이라 클라이언트와 공유하는 파일에 옮겼다.
// 서버 쪽 코드(mortar.ts·labor-mortar.ts)는 그대로 이 이름들을 이 파일에서 가져다 쓸 수 있다.
export type { MortarMode, MortarUsage, SelfLevelUsage, MortarMethod };
export { USAGE_PRESET, SELF_LEVEL_USAGE_PRESET };

// ── 1. 로스율 ──────────────────────────────────────
// 값(0.05)은 src/lib/v1/mortarQuantity.ts에서 가져온다 — 여기서는 등급·출처만 붙인다.

/**
 * 몰탈 로스(여유) 비율.
 * 면적×두께의 기하학적 체적이 원칙적으로 그대로 소요량이지만(로스 없음이 표준품셈 원칙),
 * 실무에서는 흘림·되비빔 손실 등으로 여유를 더 둔다.
 */
export const MORTAR_LOSS_RATE_DEFAULT: Coefficient = {
  value: MORTAR_LOSS_RATE_DEFAULT_RAW,
  grade: 'C',
  source: '06_미장.md §2-2·§3 — 표준품셈은 모르타르 자체 할증률이 없음(면적×두께가 곧 소요 체적이 원칙). 실무에서 흘림·되비빔 손실로 5% 내외 여유를 추가로 잡는 관행',
};

// ── 2. 배합비 (표준품셈 9-1-1, 06_미장.md §2-1) ────────
// MIX_RATIO_TABLE·DEFAULT_MIX_RATIO는 이미 파일 상단에서 mortarQuantity.ts 것을 그대로
// 다시 내보냈다(중복 정의 금지 — 2026-09-15 운영자 현장 기준 피드백으로 공유 모듈을 만들며 정리).
//
// ⚠️ 배합표는 이미 할증(재료 자체 로스)을 포함하고 있다 — 여기에 다시 몰탈 로스율(5%)을
//    곱하면 로스가 두 번 들어간다(2026-09-14 검사관 지적으로 mortar.ts에서 이중 할증을 뺐다).
//    현장 배합 대안은 반드시 **로스 미포함(순수) 체적**에 이 표를 곱한다.

/** 시멘트 포대 단위 (kg) — 표준품셈에 포장단위 언급이 없어 업계 통상값을 쓴다 */
export const CEMENT_BAG_KG: Coefficient = {
  value: CEMENT_BAG_KG_RAW,
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
  value: REMICON_KG_PER_MM_SQM_RAW,
  grade: 'B',
  source: '06_미장.md §4-1 — 삼표 SP몰탈 일반미장용 공식 스펙(40kg÷1.35㎡÷18mm≈1.65kg/mm·㎡) 역산값',
};

/** 레미탈 포대 단위 (kg) — 제조사 공식(삼표·한일시멘트 공통) */
export const REMICON_BAG_KG: Coefficient = {
  value: REMICON_BAG_KG_RAW,
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
  value: SELF_LEVEL_KG_PER_MM_SQM_RAW,
  grade: 'B',
  source: '06_미장.md §5-1 — 한일시멘트 RFSL 시리즈(1.5~1.7)·마페이 울트라플랜(1.6) 교차검증 수렴값',
};

/** 셀프레벨링 포대 단위 (kg) — 제조사 공통(한일·마페이 전부 25kg) */
export const SELF_LEVEL_BAG_KG: Coefficient = {
  value: SELF_LEVEL_BAG_KG_RAW,
  grade: 'A',
  source: '06_미장.md §5-1 — 한일시멘트 RFSL 시리즈·마페이 울트라플랜 공식 포장단위 25kg',
};

// ── 5. 프라이머 (셀프레벨링 필수, 06_미장.md §5-3) ────────

/** 프라이머 원액 도포량 (L/㎡) — 희석 1:2~1:3, 2~3회 도포 기준 */
export const SELF_LEVEL_PRIMER_L_PER_SQM: Coefficient = {
  value: SELF_LEVEL_PRIMER_L_PER_SQM_RAW,
  grade: 'C',
  source: '06_미장.md §5-3 — 18L 캔 1통으로 희석 최대 1:3 시 약 90㎡ 시공(유통 블로그 종합치, 제조사 데이터시트 원문 미확인)',
};

/** 프라이머 캔 용량 (L) */
export const SELF_LEVEL_PRIMER_CAN_L: Coefficient = {
  value: SELF_LEVEL_PRIMER_CAN_L_RAW,
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

/**
 * 미장공(기공) 1일 노임 — 범위(원).
 * 2026-09-15 운영자 현장 기준 지시(06_미장.md §11-7): 노임을 단일값이 아니라 **범위**로 잡는다.
 *   하한 = 시장 실거래가(20만~26만원, 마이코리아워크 2026 수도권 표본)의 하한값(등급 C)
 *   상한 = 표준품셈 시중노임단가 277,276원(등급 A, §7) — 표준품셈이 간접비 포함이라
 *          시장 실거래 상단(26만원)보다도 높아서 그대로 상한으로 쓴다.
 * 결과 비용 범위(min~max)가 이 노임 범위를 그대로 반영한다(2026-09-14 검사관이 만든
 * 단일 노임 × min=max 방식을 폐기).
 */
export const PLASTERER_WAGE_RANGE: CoefficientRange = {
  min: 200000,
  max: 277276,
  grade: 'C',
  source: '06_미장.md §11-7 — 하한 시장 실거래가(20만~26만원의 하한, 마이코리아워크 2026) · 상한 표준품셈 시중노임단가(277,276원, §7)',
};

/** 보통인부(조공) 1일 노임 — 범위(원). 위와 같은 원칙 */
export const HELPER_WAGE_RANGE: CoefficientRange = {
  min: 140000,
  max: 172068,
  grade: 'C',
  source: '06_미장.md §11-7 — 하한 시장 실거래가(14만~16만원의 하한, 마이코리아워크 2026) · 상한 표준품셈 시중노임단가(172,068원, §7)',
};

/**
 * 일반기계운전사 1일 노임 추정치 (원) — 06_미장.md §7에 "미수록, 별도 확인 필요"로 남은 값.
 * 노임 자료가 없어서 특별인부(226,122원)~미장공(277,276원) 사이 근사치로 추정한다.
 * 등급 C, 운영자 현장 기준 확인 대기(2026-09-14 검사관 지적 — 노임 없으면 만들지 말고 추정 표기).
 */
export const MECHANIC_DAILY_WAGE_ESTIMATE: Coefficient = {
  value: 250000,
  grade: 'C',
  source: '06_미장.md §7 — 일반기계운전사 노임단가 미수록. 특별인부~미장공 노임 사이 근사 추정치, 확인 대기',
};

// ── 8. 인건 — 손미장 (06_미장.md §11-5·§11-8, 운영자 현장 기준 현장 기준) ────
//
// 2026-09-15 운영자 현장 기준 지시로 옛 §6-1(벽 모르타르 바름 준용, ㎡당 0.07·0.03) 방식을 버리고
// 운영자 현장 기준가 준 실측 기준으로 바꿨다: "20평×100mm 바닥 미장 = 기공 2인 + 조공 2인, 1일 완료".
// 인건을 "품(인-일) 누적"이 아니라 "이 물량을 하루 안에 끝내려면 몇 명이 필요한가"로 계산한다
// (연속 타설 하루 완료 제약, §11-8) — 물량이 늘면 하루를 넘기는 게 아니라 인원을 늘린다.

/**
 * 손미장 기준 체적(㎥) — 운영자 현장 기준 20평(66.116㎡) × 두께 100mm의 순수 체적(로스 미포함).
 * 20평 = 20 × 3.3058㎡ = 66.116㎡, × 0.1m(100mm) = 6.6116㎥.
 */
export const HAND_CREW_BASE_VOLUME_M3: Coefficient = {
  value: 6.6116,
  grade: 'B',
  source: '06_미장.md §11-5 — 현장 기준 20평(66.116㎡)×100mm=6.6116㎥를 기공2·조공2가 1일 처리한다는 현장 진술의 역산 기준값',
};

/** 위 기준 체적에서 필요한 기공·조공 인원(각각) — 운영자 현장 기준 그대로 */
export const HAND_CREW_BASE_HEADCOUNT: Coefficient = {
  value: 2,
  grade: 'B',
  source: '06_미장.md §11-5 — 현장 기준 20평×100mm 손미장 1일 완료 조건의 기공·조공 인원(각 2인)',
};

// ── 8-B. 인건 — 장비 타설 피니싱(정벌 마무리, §11-6) ────
//
// 표준품셈 9-1-4 표면마무리(§6-3, 물량 계수 LARGE_AREA_FINISH_PLASTERER_PER_100SQM)와는
// 별개 항목이다 — 운영자 현장 기준 "타설 후 4~5시간 물 빼는 대기시간 뒤 기공 1명이 마무리"를
// 반나절(0.5일) 정액으로 반영한다. 5층 비용 구성표에서 "피니싱"이라는 별도 줄로 보여준다.

/** 피니싱 인원 — 기공 1인 고정 */
export const FINISH_HAND_HEADCOUNT: Coefficient = {
  value: 1,
  grade: 'C',
  source: '06_미장.md §11-6 — 현장 기준 "타설 4~5시간 뒤 기공 1명이 마무리"',
};

/** 피니싱 일수 — 0.5일(반나절) 정액 */
export const FINISH_HAND_DAYS: Coefficient = {
  value: 0.5,
  grade: 'C',
  source: '06_미장.md §11-6 — "4~5시간"을 8시간 근무 기준 약 0.5~0.6일로 환산(현장 표현을 일수 품으로 바꾸는 과정 자체가 추정)',
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

/**
 * 장비 타설 표면 마무리(인력마감) 미장공 품 (인/100㎡) — 표준품셈 0.30/100㎡.
 * ⚠️ 2026-09-15 검사관 지적: labor-mortar.ts 크루 계산에서 뺐다 — 마무리 인건은 운영자
 * 현장 기준(피니싱, 기공1인×0.5일, FINISH_HAND_DAYS)으로 이미 별도 breakdown 줄에 계상하고
 * 있어서, 이 표준품셈 값까지 크루 계산에 같이 더하면 마무리 인건이 두 번(이중) 잡힌다.
 * 값 자체는 표준품셈 A등급 근거라 문서화 목적으로 정의만 남겨 둔다(현재 미사용).
 */
export const LARGE_AREA_FINISH_PLASTERER_PER_100SQM: Coefficient = {
  value: 0.3,
  grade: 'A',
  source: '06_미장.md §6-3 — 표준품셈 [건축] 9-1-4 표면 마무리(인력마감) 미장공 0.30인/100㎡. 운영자 현장 기준 피니싱과 이중 계상 방지를 위해 크루 계산에서는 미사용',
};

// 장비 타설 안내 문구는 즉답(useMortarQuickCalc)과 같은 것을 써야 해서
// src/lib/v1/mortarPresets.ts로 옮겼다(2026-09-15 운영자 현장 기준 피드백) — 여기서는 다시 내보내기만 한다.
export { EQUIPMENT_RENTAL_NOTE } from '@/lib/v1/mortarPresets';

// ── 10. 셀프레벨링 인건 — 계산하지 않음 (06_미장.md §6-4) ──
//
// 2026-09-14 검사관 지적으로 셀프레벨링 인건 추정 단가(8,000원/㎡)를 삭제했다.
// 표준품셈에 항목이 없고 "재료비+인건비 합산 평당 5만~9만원"만 확인되는데, 인건비만
// 분리한 근거가 없는 상태에서 원/㎡ 단가를 만들면 "노임 없으면 추정 표기"가 아니라
// "근거 없는 숫자 창작"이 된다. 그래서 셀프레벨링은 자재비만 계산하고, 화면에는
// 아래 문구로 "시공비는 현장 견적 별도"를 안내한다(labor-mortar.ts가 이 값을 그대로 돌려준다).
// 이 문구도 즉답과 같은 것을 써야 해서 mortarPresets.ts로 옮겼다 — 다시 내보내기만 한다.
export { SELF_LEVEL_LABOR_ADVISORY_NOTE } from '@/lib/v1/mortarPresets';

// ── 11. (삭제됨) 옛 품수 반나절 올림 규칙 ────────────
//
// 2026-09-15 운영자 현장 기준 지시로 인건 계산 방식 자체가 바뀌면서(§8 "손미장" 주석 참고) 더 이상
// 안 쓴다 — 예전엔 "품(인-일) 합계를 반나절 단위로 올려 2인 1조 며칠"로 계산했지만,
// 이제는 "이 물량을 하루 안에 끝내는 데 필요한 인원 수"를 바로 계산한다(days는 항상 1).
// MORTAR_MAN_DAY_STEP·MORTAR_TEAM_SIZE는 삭제 — labor-mortar.ts가 더 이상 이 이름을
// import하지 않는다(빌드 시 미사용 import 에러로 바로 드러난다).
