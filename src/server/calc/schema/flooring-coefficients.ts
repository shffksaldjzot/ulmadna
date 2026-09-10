// ──────────────────────────────────────────────
// 바닥재 물량 계수 모음 (단가 아님 — 단가는 src/server/pricing/flooring.ts)
//
// 이 파일이 하는 일:
//   바닥재 물량을 뽑을 때 쓰는 숫자들을 한 곳에 모아 둔다.
//   숫자만 덜렁 두지 않고 값마다 "어디서 온 값인지(출처)"와 "얼마나 믿을 만한지(등급)"를
//   같이 적는다. 나중에 형아가 값을 바꿀 때 어디를 고쳐야 하는지 바로 보이게 하려는 것이다.
//
// 등급 뜻 (도배와 같다):
//   A = 표준품셈·제조사 스펙·형아 엑셀 실거래 등 근거 문서 확보
//   B = 계수는 없지만 엔진이 가진 치수(둘레 m 등)로 정확히 산출 가능
//   C = 추정치. 시공팀 확인 대기 → 화면에 "추정" 표기 필요
//
// 작성일: 2026년 09월 10일
// 근거 문서:
//   docs/도메인지식/대한민국_바닥재_부자재_DB_2026-09-09.xlsx (시트 계산식_로스율 · 부자재_DB)
//   docs/설계_계산기_물량견적_20260828.md 0절·2-C절
//   docs/도메인지식/02_바닥재.md · docs/도메인지식/00_표준품셈_공통.md 2-2절
// ──────────────────────────────────────────────

import type { Coefficient, CoefficientRange } from './wallpaper-coefficients';
import { SILICONE_M_PER_CARTRIDGE, SQM_PER_PYEONG } from './wallpaper-coefficients';
import type { FlooringKind } from '../data/flooring-products';

// 도배에서 이미 정해 둔 단위 환산·규격을 그대로 다시 내보낸다.
// (같은 숫자를 두 곳에 적어 두면 한쪽만 고쳐져 어긋나기 때문이다)
export type { Coefficient, CoefficientRange };
export { SQM_PER_PYEONG };
export type { FlooringKind };

// ── 1. 종류별 기본 로스율 ────────────────────────
//
// 로스율 = 잘라서 버리는 자투리 비율.
// 실측 치수가 있으면 실제로 깔아 보고 구하고, 평형만 넣었을 때 이 값으로 추정한다.

/** 종류별 기본 로스율 (0.05 = 5%). 장판은 퍼센트를 쓰지 않고 재단여유 m 로 계산한다 */
export const KIND_DEFAULT_LOSS: Record<FlooringKind, Coefficient> = {
  마루: {
    value: 0.05,
    grade: 'A',
    source: '형아 엑셀 계산식_로스율 시트 "마루(일자) 5% — 초기 기본값"',
  },
  데코타일: {
    value: 0.07,
    grade: 'A',
    source: '형아 엑셀 계산식_로스율 시트 "데코타일/LVT 7% — 사용자가 5~10% 범위 조정"',
  },
  // 장판은 면적 로스율을 안 쓴다. 롤 폭이 고정이라 방마다 재단 방향으로 필요 m 를 직접 센다.
  장판: {
    value: 0,
    grade: 'A',
    source: '형아 엑셀 계산식_로스율 시트 "장판(시트) 면적 로스율 미사용 — 고정폭 재단"',
  },
};

/** 헤링본(빗살무늬) 시공 로스율 — 대각선으로 깔아 자투리가 많이 난다 */
export const HERRINGBONE_LOSS: Coefficient = {
  value: 0.12,
  grade: 'A',
  source: '형아 엑셀 계산식_로스율 시트 "마루(헤링본) 12% — 현장 패턴에 따라 10~15%"',
};

/** 장판을 자를 때 방마다 앞뒤로 더 두는 여유 길이 (m) */
export const ROLL_CUT_MARGIN_M: Coefficient = {
  value: 0.1,
  grade: 'A',
  source: '형아 엑셀 계산식_로스율 시트 재단 예시 "재단여유 0.1m (0.05~0.10 옵션)"',
};

/** 끝 장 자투리가 이 길이 이상이면 다음 열 첫 장으로 다시 쓴다 (mm) */
export const REUSE_MIN_MM: Coefficient = {
  value: 300,
  grade: 'C',
  source: '설계 정본 0절·2-C절 "끝 장 자투리 30cm 이상이면 다음 열 첫 장으로 재사용". 현장 관행이라 추정',
};

// ── 2. 종류별 기본 규격 (제품을 안 골랐을 때) ──────
//
// 제품을 고르지 않아도 물량이 나와야 하므로 종류마다 "가장 흔한 규격"을 하나씩 정해 둔다.
// 값은 전부 형아 엑셀 바닥재_DB 에서 가장 많이 나온 규격이다.

/** 박스로 파는 자재(마루·데코타일)의 기본 규격 */
export interface SheetDefaultSpec {
  /** 장 폭 (mm) */
  widthMm: number;
  /** 장 길이 (mm) */
  lengthMm: number;
  /** 박스당 장 수 */
  pcsPerBox: number;
  /** 박스당 면적 (㎡) */
  sqmPerBox: number;
  /** 이 규격이 어디서 온 값인지 */
  source: string;
}

/** 마루 기본 규격 — 강마루 95 × 800mm, 42장 3.19㎡/박스 (엑셀에서 가장 흔한 규격) */
export const DEFAULT_MARU_SPEC: SheetDefaultSpec = {
  widthMm: 95,
  lengthMm: 800,
  pcsPerBox: 42,
  sqmPerBox: 3.19,
  source: '형아 엑셀 바닥재_DB 강마루 최빈 규격 (LX 강그린 프로·KCC 숲 강마루·한솔 SB강 95 등 동일)',
};

/** 데코타일 기본 규격 — LVT 600 × 600mm, 9장 3.24㎡/박스 (엑셀에서 가장 흔한 규격) */
export const DEFAULT_DECO_SPEC: SheetDefaultSpec = {
  widthMm: 600,
  lengthMm: 600,
  pcsPerBox: 9,
  sqmPerBox: 3.24,
  source: '형아 엑셀 바닥재_DB 데코타일 최빈 규격 (LX LVT 스탠다드·KCC 센스타일·현대 골드타일 등 동일)',
};

/** 장판 롤 폭 (m) — 엑셀 장판 20건이 전부 1,830mm 다 */
export const DEFAULT_ROLL_WIDTH_M: Coefficient = {
  value: 1.83,
  grade: 'A',
  source: '형아 엑셀 바닥재_DB 장판 20건 전부 폭 1,830mm (LX·KCC·현대L&C 공통)',
};

/** 장판 기본 두께 (mm) — 주거용에서 가장 무난한 2.2T */
export const DEFAULT_ROLL_THICKNESS_MM: Coefficient = {
  value: 2.2,
  grade: 'C',
  source: '엑셀 장판 1.8~5.0T 중 주거 표준으로 통하는 2.2T. 두께 선택이 없을 때만 쓰는 값(추정)',
};

// ── 3. 부자재 소요량 계수 ────────────────────────

/** 마루 본드 한 통(10kg)이 감당하는 시공 면적 (평) */
export const MARU_BOND_PYEONG_PER_CAN: Coefficient = {
  value: 2,
  grade: 'A',
  source: '형아 엑셀 부자재_DB "마루용 본드 10kg 1통 = 2평/통, 산식 CEILING(시공평수/2,1)"',
};

/** 마루 본드 한 통의 무게 (kg) */
export const MARU_BOND_CAN_KG: Coefficient = {
  value: 10,
  grade: 'A',
  source: '형아 엑셀 부자재_DB "마루용 본드 10kg 1통 28,200원"',
};

/** 데코타일(LVT) 접착제 소요량 — 시공 면적 1평당 kg */
export const LVT_ADHESIVE_KG_PER_PYEONG: Coefficient = {
  value: 1.4,
  grade: 'A',
  source: '형아 엑셀 부자재_DB · NOX 공식 표준도포량 1.3~1.5kg/평 의 중앙값',
};

/** 데코타일 접착제 한 통의 무게 (kg) — 엑셀에서 가격이 확인된 4kg 통 기준 */
export const LVT_ADHESIVE_CAN_KG: Coefficient = {
  value: 4,
  grade: 'A',
  source: '형아 엑셀 부자재_DB "데코타일 본드 4kg 1통 20,500원" (LVT 접착제 4kg 통과 같은 규격)',
};

/** 장판 용착제 한 병(25ml)이 감당하는 이음선 길이 (m) */
export const SEAM_M_PER_BOTTLE: Coefficient = {
  value: 15,
  grade: 'C',
  source: '형아 엑셀 부자재_DB "용착제 25ml 1병 · 이음길이 기준 또는 현장당 1~2병". m당 소요는 미확보(추정)',
};

/** 씰란트 한 개가 감당하는 마감선 길이 (m) — 도배 수성실리콘 계수를 그대로 쓴다 */
export const SEALANT_M_PER_CARTRIDGE: Coefficient = {
  value: SILICONE_M_PER_CARTRIDGE.value,
  grade: 'C',
  source: `도배 실리콘 계수 재사용 (${SILICONE_M_PER_CARTRIDGE.source})`,
};

/** 걸레받이 — 방 둘레에 곱하는 여유 계수. 이음·모서리 손실 5% */
export const BASEBOARD_PERIMETER_MULT: Coefficient = {
  value: 1.05,
  grade: 'C',
  source: '둘레 그대로 잘라 붙일 수 없어 모서리·이음 손실 5%를 얹은 값. 명시 출처 없음(추정)',
};

// ── 4. 인건 계수 ────────────────────────────────
//
// 인건비 = 바닥 시공 면적(평) × 종류별 평당 노무 단가
// 품수   = 인건비 ÷ 기준 일당 30만 (반나절 단위 올림, 최소 1품)
// 화면 금액 = 품수 × 일당 밴드 (단가 파일)

/** 종류별 바닥 시공 평당 노무 단가 (원/시공평) */
export const FLOORING_LABOR_WON_PER_PYEONG: Record<FlooringKind, Coefficient> = {
  마루: {
    value: 16000,
    grade: 'B',
    source: 'ulmadna_db.json labor_rates.flooring daily_rate_per_pyeong 16,000 (EST-035 강마루 자재/노무 분리 견적서)',
  },
  장판: {
    value: 10000,
    grade: 'C',
    source: '02_바닥재.md 5-2 장판 평당 3~4만(자재+시공) − 자재 약 3만/평 = 인건 약 1만/평 역산. 실측 견적서 없음(추정)',
  },
  데코타일: {
    value: 13000,
    grade: 'C',
    source: '02_바닥재.md 5-3 문고리 ㎡당 1만~1.5만 시공비 및 우드타일 평당 4.5~6만 총액에서 역산. 실측 견적서 없음(추정)',
  },
};

/** 헤링본 시공이면 인건비에 곱하는 값 — 대각선 시공이라 손이 더 간다 */
export const HERRINGBONE_LABOR_MULT: Coefficient = {
  value: 1.25,
  grade: 'C',
  source: '02_바닥재.md 3-3 "헤링본은 인건비 평당 1.5만~3만원 추가"를 마루 16,000원/평 기준 배율로 바꾼 값(추정)',
};

/** 품수를 셀 때 쓰는 기준 일당 (원/품). 1품 = 1인 1일 */
export const FLOORING_BASE_DAILY_WAGE: Coefficient = {
  value: 300000,
  grade: 'B',
  source: 'ulmadna_db.json labor_rates 기준 일당 30만원 (도배·설비와 같은 기준선). 바닥 전용 일당 표본은 없음',
};

/** 품수 올림 단위 (0.5 = 반나절) */
export const FLOORING_MAN_DAY_STEP = 0.5;

/** 바닥 시공 1조 인원 (2인 1조가 관행) */
export const FLOORING_TEAM_SIZE: Coefficient = {
  value: 2,
  grade: 'A',
  source: 'ulmadna_db.json labor_rates.flooring default_workers 2',
};

// ── 5. 표준품셈 검산용 품 (화면에 쓰지 않음) ────────
//
// 우리 품수가 관급 기준보다 터무니없이 낮지 않은지 개발 단계에서 확인하는 용도다.
// 관급 원가계산 기준이라 민간 견적과 그대로 비교하면 안 된다.

/** 표준품셈 품 한 줄 (㎡당 인·일) */
export interface SpecManDayRate {
  /** 내장공 (인·일/㎡) */
  interior: number;
  /** 보통인부 (인·일/㎡) */
  helper: number;
  /** 근거 */
  source: string;
}

/** 종류별 표준품셈 품 (2022 건설공사 표준품셈 [건축] 제5장 수장공사) */
export const SPEC_MAN_DAY_PER_SQM: Record<FlooringKind, SpecManDayRate> = {
  마루: {
    interior: 0.041,
    helper: 0.015,
    source: '표준품셈 [건축] 5-1-3 플로어링 마루 설치 (내장공 0.041 · 보통인부 0.015)',
  },
  장판: {
    interior: 0.02,
    helper: 0.01,
    source: '표준품셈 [건축] 5-1-1 PVC계 바닥재 설치 시트 전면접합 (내장공 0.020 · 보통인부 0.010)',
  },
  데코타일: {
    interior: 0.053,
    helper: 0.02,
    source: '표준품셈 [건축] 5-1-1 PVC계 바닥재 설치 타일형 (내장공 0.053 · 보통인부 0.020)',
  },
};
