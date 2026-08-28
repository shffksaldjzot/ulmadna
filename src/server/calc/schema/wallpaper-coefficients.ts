// ──────────────────────────────────────────────
// 도배 물량 계수 모음 (단가 아님 — 단가는 src/server/pricing/wallpaper.ts)
//
// 이 파일에 계수를 한 곳으로 모아 두는 이유:
//   계수마다 "어디서 온 값인지(출처)"와 "얼마나 믿을 만한지(등급)"를 같이 적어 두어야
//   나중에 시공팀 확인으로 값을 바꿀 때 어디를 고쳐야 하는지 바로 보이기 때문이다.
//
// 등급 뜻:
//   A = 표준품셈·제조사 스펙 등 근거 문서 확보
//   B = 계수는 없지만 엔진이 가진 치수(둘레 m 등)로 정확히 산출 가능
//   C = 추정치. 제조사 자료 또는 시공팀 확인 대기 → 화면에 "추정" 표기 필요
//
// 작성일: 2026년 08월 28일
// 근거 문서: docs/설계_계산기_물량견적_20260828.md 2-D절,
//            docs/도메인지식/00_표준품셈_공통.md 2-1절,
//            docs/도메인지식/01_도배.md 1절·4절
// ──────────────────────────────────────────────

import type { EvidenceGrade } from './types';

/** 계수 하나 = 값 + 근거 등급 + 출처 메모 (숫자만 덜렁 두지 않는다) */
export interface Coefficient {
  /** 계수 값 */
  value: number;
  /** 근거 등급 */
  grade: EvidenceGrade;
  /** 어디서 온 값인지 사람이 읽는 메모 */
  source: string;
}

/** 값 범위형 계수 (최소~최대) */
export interface CoefficientRange {
  min: number;
  max: number;
  grade: EvidenceGrade;
  source: string;
}

// ── 1. 단위 환산 ────────────────────────────────

/** 1평 = 3.3058㎡ */
export const SQM_PER_PYEONG = 3.3058;

/** ㎡ 를 평으로 바꾼다 */
export function sqmToPyeong(sqm: number): number {
  return sqm / SQM_PER_PYEONG;
}

/** 평을 ㎡ 로 바꾼다 */
export function pyeongToSqm(pyeong: number): number {
  return pyeong * SQM_PER_PYEONG;
}

/**
 * 공급 평형 → 전용면적(㎡) 환산표.
 * 코어 엔진(v3 calculateQuantity)은 전용면적을 받으므로 여기서 한 번 바꿔 준다.
 * 잘 알려진 평형은 이 표를 쓰고, 표에 없으면 아래 전용률로 계산한다.
 */
export const PYEONG_TO_EXCLUSIVE_SQM: Record<number, number> = {
  18: 39,   // 소형
  24: 59,   // 59타입
  25: 59,   // 59타입
  30: 74,   // 74타입
  32: 78,   // 74~84 사이
  34: 84,   // 84타입 (가장 흔한 국민평형)
  40: 101,  // 대형
  45: 114,  // 대형
};

/** 전용률 — 표에 없는 평형을 환산할 때 쓰는 비율 (공급면적 대비 전용면적) */
export const EXCLUSIVE_RATIO: Coefficient = {
  value: 0.75,
  grade: 'B',
  source: '아파트 전용률 관행 74~78% 중앙값. 34평 공급 112.4㎡ → 전용 84㎡(0.747)로 검산',
};

// ── 2. 벽지 규격 (설계 정본 3절 · 01_도배.md 1-1) ──

/** 벽지 종류 */
export type PaperType = '합지' | '실크';

/** 벽지 롤 규격 */
export interface RollSpec {
  /** 롤 폭 (cm) */
  widthCm: number;
  /** 롤 길이 (m) */
  lengthM: number;
  /** 패턴 리피트 (cm). 0 이면 무지 */
  repeatCm: number;
  /** 롤당 면적 (㎡) — 폭 × 길이 */
  sqmPerRoll: number;
  /** 규격 근거 메모 */
  source: string;
}

/** 종류별 기본 규격 (제품을 안 고르면 이 값으로 계산) */
export const DEFAULT_ROLL_SPEC: Record<PaperType, RollSpec> = {
  // 합지 광폭 93cm × 17.75m ≈ 16.5㎡
  합지: {
    widthCm: 93,
    lengthM: 17.75,
    repeatCm: 0,
    sqmPerRoll: 16.5,
    source: '설계 정본 3절 · 01_도배.md 1-1 (합지 광폭 국산 표준)',
  },
  // 실크 광폭 106cm × 15.6m ≈ 16.5㎡
  실크: {
    widthCm: 106,
    lengthM: 15.6,
    repeatCm: 0,
    sqmPerRoll: 16.5,
    source: '설계 정본 3절 · 01_도배.md 1-1 (실크 광폭 국산 표준)',
  },
};

/** 아파트 표준 벽 높이 (m) — 몰딩·걸레받이를 뺀 순수 도배 높이 */
export const STANDARD_WALL_HEIGHT_M: Coefficient = {
  value: 2.3,
  grade: 'A',
  source: '01_도배.md 1-2 (아파트 층고 기준 도배 높이 2.3~2.4m 관행 중 보수적 하한)',
};

/** 재단할 때 폭마다 위아래로 더 잘라 두는 여유 (m) */
export const CUT_MARGIN_M: Coefficient = {
  value: 0.1,
  grade: 'C',
  source: '현장 관행 상하 5cm씩 여유 — 명시 출처 없음(추정)',
};

// ── 3. 로스율 ──────────────────────────────────

/**
 * 실측 없이 평형만 넣었을 때 쓰는 "추정 로스".
 * 표준품셈 5-3-7 도배바름의 정배지 재료량 1.2㎡/㎡ = 로스 20% 가 근거.
 */
export const ESTIMATED_LOSS_RATIO: Coefficient = {
  value: 0.2,
  grade: 'A',
  source: '표준품셈 [건축] 5-3-7 정배지 1.2㎡/㎡(할증 포함) → 로스 20%',
};

/** 패턴 리피트가 큰 제품일 때 추정 로스에 더하는 값 */
export const REPEAT_EXTRA_LOSS: Coefficient = {
  value: 0.05,
  grade: 'C',
  source: '설계 정본 3절 "리피트 큰 제품 15%" · 01_도배.md 1-8 — 리피트 cm당 산식은 미확보(추정)',
};

/** 리피트를 "큰 패턴"으로 볼 기준 (cm) */
export const LARGE_REPEAT_CM = 30;

/** 천장 재단 로스 — 천장은 폭을 세지 않고 면적 ÷ 롤당 ㎡ 로 잡는다 */
export const CEILING_LOSS_RATIO: Coefficient = {
  value: 0.12,
  grade: 'C',
  source: '벽(재단 기준 약 10%)보다 조명 타공·점검구가 많아 소폭 상향 — 명시 출처 없음(추정)',
};

// ── 4. 부자재 소요량 계수 (설계 정본 2-D절) ──────

/** 도배풀 14kg 포 하나가 감당하는 도배 면적 (평) */
export const PASTE_PYEONG_PER_BAG: Record<PaperType, CoefficientRange> = {
  // 합지는 풀을 묽게 타서(물 1.5 대 풀 1) 더 넓게 쓴다
  합지: { min: 20, max: 30, grade: 'A', source: '설계 정본 2-D절 (14kg 포 = 합지 20~30평)' },
  // 실크는 되게 타서(1 대 1) 소요가 많다
  실크: { min: 20, max: 20, grade: 'A', source: '설계 정본 2-D절 (14kg 포 = 실크 약 20평)' },
};

/** 도배풀 포 규격 (kg) */
export const PASTE_BAG_KG = 14;

/** 부직포(공간초배) — 벽 면적에 곱하는 여유 계수 */
export const NONWOVEN_AREA_MULT: CoefficientRange = {
  min: 1.05,
  max: 1.1,
  grade: 'A',
  source: '설계 정본 2-D절 (부직포 = 벽면적 × 1.05~1.1)',
};

/** 부직포 1롤 면적 (㎡) — 110cm × 90m 기준 */
export const NONWOVEN_SQM_PER_ROLL: Coefficient = {
  value: 99,
  grade: 'A',
  source: '설계 정본 2-D절 (롤 110~120cm × 80~90m 이면 90~108㎡) 중 보수적 값 1.1m × 90m',
};

/** 각초배지(운용지) — 벽 면적에 곱하는 소요 계수 */
export const LINING_PAPER_RATIO: Coefficient = {
  value: 0.3,
  grade: 'C',
  source: '설계 정본 2-D절 "벽면 요철에 좌우, 표준 계수 없음". 표준품셈 초배지 0.8~1.2㎡/㎡는 전면 초배 기준이라 이음 보강용으로는 과다 → 0.3 추정',
};

/** 각초배지 1롤 면적 (㎡) — 30cm × 90m */
export const LINING_PAPER_SQM_PER_ROLL: Coefficient = {
  value: 27,
  grade: 'A',
  source: '설계 정본 2-D절 (규격별 롤 30/70/90cm) 중 30cm × 90m',
};

/** 네바리 — 둘레 m 에 곱하는 배수. 천장 라인 + 걸레받이 라인 두 줄이라 2배 */
export const NEBARI_PERIMETER_MULT: Coefficient = {
  value: 2,
  grade: 'B',
  source: '설계 정본 2-D절 (몰딩·걸레받이·천장 라인 둘레 m 비례). 천장선·바닥선 2줄로 계산',
};

/** 네바리 1롤 길이 (m) — 9cm × 90m */
export const NEBARI_M_PER_ROLL: Coefficient = {
  value: 90,
  grade: 'A',
  source: '설계 정본 2-D절 (9cm × 90m 롤)',
};

/** 본드 — 벽 면적당 소요 (kg/㎡). 부직포 가장자리·장애물 주변만 도포 */
export const BOND_KG_PER_SQM: Coefficient = {
  value: 0.02,
  grade: 'C',
  source: '설계 정본 2-D절 "㎡당 값 미확보". 가장자리 10cm·장애물 주변 5cm 도포라는 서술에서 역산한 추정치',
};

/** 본드 1통 용량 (kg) — 5kg 캔 기준 */
export const BOND_KG_PER_CAN: Coefficient = {
  value: 5,
  grade: 'A',
  source: '설계 정본 2-D절 (2/5/18kg 캔) 중 현장 표준 5kg',
};

/** 퍼티(핸디코트) — 벽 면적당 소요 (kg/㎡). 도배는 전면이 아니라 국소 보수 */
export const PUTTY_KG_PER_SQM: Coefficient = {
  value: 0.13,
  grade: 'C',
  source: '설계 정본 2-D절 (전면 1.3kg/㎡(1mm)이 상한, 도배는 국소 보수). 벽 면적의 10%만 보수한다고 보고 0.13 추정',
};

/** 퍼티 1포 용량 (kg) */
export const PUTTY_KG_PER_BAG: Coefficient = {
  value: 20,
  grade: 'A',
  source: '설계 정본 2-D절 (5/15/20kg) 중 현장 표준 20kg',
};

/** 바인더·프라이머 — 벽 면적당 소요 (kg/㎡) */
export const BINDER_KG_PER_SQM: Coefficient = {
  value: 0.15,
  grade: 'C',
  source: '설계 정본 2-D절 "㎡당 값 미확보". 일반 수성 프라이머 0.1~0.2kg/㎡ 관행 중앙값으로 추정',
};

/** 바인더 1통 용량 (kg) */
export const BINDER_KG_PER_CAN: Coefficient = {
  value: 15,
  grade: 'A',
  source: '설계 정본 2-D절 (15kg 캔)',
};

/** 수성실리콘 — 둘레 m 에 곱하는 배수 (천장선 + 걸레받이선) */
export const SILICONE_PERIMETER_MULT: Coefficient = {
  value: 2,
  grade: 'B',
  source: '설계 정본 2-D절 (몰딩·걸레받이 마감선 둘레 m 비례). 천장선·바닥선 2줄',
};

/** 실리콘 카트리지 1개가 커버하는 길이 (m) — 300ml 기준 */
export const SILICONE_M_PER_CARTRIDGE: Coefficient = {
  value: 11,
  grade: 'C',
  source: '설계 정본 2-D절 (카트리지 300ml). 도포 폭·두께에 따라 8~14m — 중앙값 11m 추정',
};

// ── 5. 인건 계수 (01_도배.md 4절) ────────────────

/**
 * 실크 도배 품수 공식의 계수.
 * 품수 = (공급 평수 × 3 ÷ 15) + 1
 * 전제: 천장 포함 전체 초배 + 퍼티 포함.
 */
export const SILK_LABOR_FORMULA = {
  multiplier: 3,
  divisor: 15,
  addOn: 1,
  grade: 'B' as EvidenceGrade,
  source: '01_도배.md 4-2 (실무자 공유 공식). 32평이면 약 7~8품',
};

/** 합지 도배 — 2인 1조가 하루에 처리하는 공급 평수 */
export const HAPJI_PYEONG_PER_TEAM_DAY: Coefficient = {
  value: 30,
  grade: 'B',
  source: '설계 정본 2-D절 · 01_도배.md 4-3 (합지 하루 약 30평, 2인 1조 관행)',
};

/** 도배 1조 인원 (2인 1조가 관행) */
export const TEAM_SIZE: Coefficient = {
  value: 2,
  grade: 'A',
  source: '01_도배.md 4-3 (도배는 통상 2인 1조)',
};

/** 천장을 뺐을 때 품수에 곱하는 계수 (품수 공식이 천장 포함 전제라 덜어 준다) */
export const NO_CEILING_LABOR_MULT: Coefficient = {
  value: 0.8,
  grade: 'C',
  source: '표준품셈 5-3-7 "천장은 품에 30% 가산"을 뒤집어 추정. 정량 비율은 01_도배.md 4-4에서 미확인',
};

/** 구축(재도배)일 때 품수에 곱하는 가산 계수 */
export const OLD_BUILDING_LABOR_MULT: Coefficient = {
  value: 1.15,
  grade: 'C',
  source: '설계 정본 2-D절 "구축은 퍼티·바인더·네바리 증가(증가율 수치 없음, 시공팀 확인)". 15% 가산은 추정',
};

// ── 6. 표준품셈 인건 하한 검산용 (화면에 쓰지 않음) ──

/** 도배바름 도배공 품 (인·일/㎡) — 콘크리트·모르타르면 기준 */
export const SPEC_PAPERHANGER_PER_SQM: Coefficient = {
  value: 0.024,
  grade: 'A',
  source: '표준품셈 [건축] 5-3-7 도배바름 (콘크리트·모르타르면 도배공 0.024)',
};

/** 도배바름 보통인부 품 (인·일/㎡) */
export const SPEC_HELPER_PER_SQM: Coefficient = {
  value: 0.006,
  grade: 'A',
  source: '표준품셈 [건축] 5-3-7 도배바름 (보통인부 0.006 공통)',
};

/** 천장 품 가산율 */
export const SPEC_CEILING_SURCHARGE: Coefficient = {
  value: 0.3,
  grade: 'A',
  source: '표준품셈 [건축] 5-3-7 비고 (천장은 품에 30% 가산)',
};
