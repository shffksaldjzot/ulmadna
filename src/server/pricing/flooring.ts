// ──────────────────────────────────────────────
// 바닥재 단가 — 서버 전용
//
// !! 중요 !!
//   이 파일은 절대 클라이언트에서 import 하면 안 된다.
//   맨 위 'server-only' 가 그 실수를 빌드 단계에서 잡아 준다.
//   (라이브 v1에서 단가와 공식이 클라이언트 번들에 통째로 노출된 사고가 있었다.
//    v1 정식 계산기는 단가를 서버에서만 곱해 소비자가 범위만 내보낸다.)
//
// 이 파일이 하는 일:
//   바닥재 견적에 들어가는 모든 단가 밴드(최저~최고)를 한 곳에 모아 둔다.
//   값마다 기준일·출처·등급을 반드시 같이 적는다.
//     A = 근거 문서 확보 / B = 여러 출처 교차 확인 / C = 추정, 확인 대기
//
// 작성일: 2026년 09월 10일
// 근거:
//   형아 엑셀 대한민국_바닥재_부자재_DB_2026-09-09.xlsx (바닥재_DB · 부자재_DB)
//   src/data/ulmadna_db.json (processes 바닥·몰딩·철거 · labor_rates)
//   _dev-docs/얼마드나_전공정_세부설계서.md (철거 단가표)
// ──────────────────────────────────────────────

import 'server-only';

import type { EvidenceGrade } from '../calc/schema/types';
import type { PriceBand } from './wallpaper';
import { getDailyWageBand, OVERHEAD_RATE } from './wallpaper';
import { SQM_PER_PYEONG } from '../calc/schema/wallpaper-coefficients';
import {
  FLOORING_KIND_PRICE_BAND,
  type FlooringKind,
} from '../calc/data/flooring-products';
import { findFlooringSubmaterial } from '../calc/data/flooring-submaterials';
import {
  DEFAULT_MARU_SPEC,
  DEFAULT_DECO_SPEC,
  DEFAULT_ROLL_WIDTH_M,
} from '../calc/schema/flooring-coefficients';

// 도배와 같은 밴드 모양·같은 경비율·같은 일당을 쓴다.
// (바닥 전용 일당 표본이 아직 없어서 도배 수도권 밴드 28만~32만을 그대로 쓴다)
export type { PriceBand };
export { OVERHEAD_RATE };

/** 원 단위 반올림 (밴드 숫자를 깔끔하게) */
function won(n: number): number {
  return Math.round(n);
}

// ── 1. 자재 단가 ─────────────────────────────────
//
// 제품을 고르면 그 제품 가격을 그대로 쓰고,
// 안 고르면 종류별 평균 밴드(엑셀 usable 제품의 ㎡당 가격 최저~최고)를 쓴다.
// 물량 단위가 박스(마루·데코타일) / m(장판)로 다르므로 ㎡ 밴드를 단위에 맞춰 바꿔 준다.

/** 사용자가 고르거나 직접 넣은 제품 정보 */
export interface FlooringDirectProduct {
  /** 박스형(마루·데코타일): 박스당 가격 (원) */
  pricePerBox?: number;
  /** 박스형: 박스당 면적 (㎡) */
  sqmPerBox?: number;
  /** 박스형: 박스당 장 수 */
  pcsPerBox?: number;
  /** 박스형: 장 폭 (mm) */
  widthMm?: number;
  /** 박스형: 장 길이 (mm) */
  lengthMm?: number;
  /** 롤형(장판): m당 가격 (원) */
  pricePerM?: number;
  /** 롤형: 롤 폭 (m) */
  rollWidthM?: number;
  /** 롤형: 두께 (mm) */
  thicknessMm?: number;
  /** 제품 초기 로스율 (0.05 · 0.07 · 0.12 …). 없으면 종류 기본값 */
  lossRate?: number;
  /** 화면 표기용 출처 문구 ("브랜드 제품명"). 없으면 직접 입력으로 본다 */
  sourceLabel?: string;
}

/** 종류별 대표 판매 단위 크기 — ㎡ 밴드를 박스·m 단가로 바꿀 때 쓴다 */
const UNIT_SIZE_BY_KIND: Record<FlooringKind, number> = {
  마루: DEFAULT_MARU_SPEC.sqmPerBox, // 박스 하나에 몇 ㎡ 인지
  데코타일: DEFAULT_DECO_SPEC.sqmPerBox,
  장판: DEFAULT_ROLL_WIDTH_M.value, // 1m 를 깔면 몇 ㎡ 가 덮이는지 (= 롤 폭)
};

/**
 * 자재 단가 밴드를 고른다.
 *
 * 제품을 골랐으면(또는 직접 입력했으면) 그 가격을 최저=최고 고정값으로 쓴다.
 * 안 골랐으면 종류 평균 밴드를 물량 단위(박스 또는 m)에 맞춰 환산한다.
 * 직접 입력값은 우리 시세 통계에 넣지 않는다(오염 방지).
 */
export function getFlooringMaterialBand(
  kind: FlooringKind,
  product?: FlooringDirectProduct,
): PriceBand {
  const isRoll = kind === '장판';
  const unitLabel = isRoll ? '원/m' : '원/박스';

  // 1) 제품 가격이 있으면 그대로
  const fixed = isRoll ? product?.pricePerM : product?.pricePerBox;
  if (fixed && fixed > 0) {
    return {
      min: won(fixed),
      max: won(fixed),
      unitLabel,
      기준일: '2026년 09월 09일',
      출처: product?.sourceLabel ?? '사용자 직접 입력',
      등급: 'A',
      비고: '직접 입력값 — 시세 통계에는 반영하지 않는다',
    };
  }

  // 2) 없으면 종류 평균 밴드를 판매 단위로 환산
  const band = FLOORING_KIND_PRICE_BAND[kind];
  // 제품에 규격만 들어왔으면 그 규격을 쓰고, 아니면 종류 대표 규격을 쓴다
  const unitSize = isRoll
    ? (product?.rollWidthM ?? UNIT_SIZE_BY_KIND[kind])
    : (product?.sqmPerBox ?? UNIT_SIZE_BY_KIND[kind]);

  return {
    min: won(band.minPerSqm * unitSize),
    max: won(band.maxPerSqm * unitSize),
    unitLabel,
    기준일: '2026년 09월 09일',
    출처: `형아 엑셀 대한민국_바닥재_부자재_DB_2026-09-09 ${kind} 실거래 ${band.samples}건 ㎡당 ${band.minPerSqm.toLocaleString()}~${band.maxPerSqm.toLocaleString()}원`,
    등급: 'B',
    비고: `대표 판매 단위 ${unitSize}${isRoll ? 'm 폭' : '㎡/박스'} 기준 환산. 제품을 고르면 제품 가격으로 대체된다`,
  };
}

// ── 2. 부자재 단가 ───────────────────────────────
//
// 2026-09-10 검사관 지적 반영:
//   예전에는 여기에 28,200 · 20,500 같은 숫자를 손으로 다시 적어 놨었다.
//   그러면 엑셀을 고쳐도 이 파일이 안 따라와서 두 값이 어긋난다.
//   이제 숫자는 전부 자동 생성 데이터 파일(data/flooring-submaterials.ts)에서 읽어 오고,
//   이 파일에는 "어떤 항목이 엑셀의 어느 줄을 쓰는가"라는 연결표만 둔다.
//
// 키는 공정 스키마(schema/flooring.ts)의 항목 키와 그대로 맞춘다.

/** 스키마 항목 하나가 엑셀 부자재 어느 줄을 쓰는지 적어 두는 연결표 한 칸 */
interface SubmaterialLink {
  /** 엑셀 부자재 데이터의 행 키 (data/flooring-submaterials.ts) */
  dataKey: string;
  /** 화면 표기 단위 */
  unitLabel: string;
  /** 근거 등급 */
  등급: EvidenceGrade;
  /** 비고 (한글) */
  비고?: string;
}

/** 부자재 항목 → 엑셀 행 연결표. 숫자는 여기 없다 — 값은 전부 엑셀에서 읽는다. */
const SUBMATERIAL_LINK: Record<string, SubmaterialLink> = {
  // 마루 본드 10kg 1통 — 엑셀 실거래 단일가
  bond: {
    dataKey: 'maru_bond',
    unitLabel: '원/통',
    등급: 'A',
    비고: '한 통이 2평을 감당한다(엑셀 커버리지)',
  },
  // 데코타일(LVT) 접착제 — 엑셀의 NOX LVT 접착제 줄에는 가격이 비어 있어서,
  // 같은 4kg 규격으로 가격이 확인된 "데코타일 본드" 줄을 대신 쓴다.
  // 2026-09-10 검사관 지적: 예전 14,000~43,000 밴드는 엑셀 비고의 시장 전체 폭이라 과대했다.
  //   실거래로 확인된 단일가 하나만 쓰고, 제품 편차가 크다는 사실은 등급 C 로 표시한다.
  adhesive: {
    dataKey: 'decotile_bond',
    unitLabel: '원/통',
    등급: 'C',
    비고: 'NOX LVT 접착제 줄은 엑셀에 가격이 없어 같은 4kg 규격 실거래로 대체. 제품별 편차가 크다 — 확인 대기',
  },
  // 장판 이음매 용착제 25ml 1병
  seam: { dataKey: 'jangpan_seam', unitLabel: '원/개', 등급: 'B' },
  // 걸레받이 틈새 마감 씰란트 1개
  sealant: { dataKey: 'sealant', unitLabel: '원/개', 등급: 'B' },
};

/** 조사일 '2026-09-09' 를 '2026년 09월 09일' 모양으로 바꾼다 */
function formatSurveyDate(raw: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  return m ? `${m[1]}년 ${m[2]}월 ${m[3]}일` : raw;
}

// ── 걸레받이만 예외: 엑셀에 m 당 단가가 없다 ────────
//
// 엑셀 부자재_DB 의 "접착식 굽도리/걸레받이"는 제품 1개 가격이라 m 당 단가로 못 쓴다.
// 그래서 걸레받이만 견적서(ulmadna_db 몰딩·걸레받이 평당 단가)를 m 로 환산해 쓴다.
//
// ⚠️ 2026-09-10 검사관 지적으로 분모를 고쳤다.
//    출처 단가(EST-027 33평 66.3만 = 2만/평 등)의 "평"은 공급 평형이다.
//    예전에는 전용 평(25.4평)으로 나눠서 m 당 단가가 낮게 나왔다.
//    이제 공급 평형 34평 기준으로 나눈다: 84타입 걸레받이 78.3m ÷ 34평 = 2.30m/평.
// ⚠️ 그래도 이 평당 단가에는 천장 몰딩 몫이 같이 들어 있어 걸레받이 단독으로는
//    높게 잡혔을 수 있다 → 등급 C, 형아 확인 대상(그대로 유지).

/** 걸레받이 환산 분모 — 공급 평형 1평당 걸레받이 길이 (m/평) */
const BASEBOARD_M_PER_SUPPLY_PYEONG = 78.3 / 34;

/** 나눈 결과를 100원 단위로 다듬는다 (환산값이라 1원 단위까지 적으면 정밀해 보이는 착시가 생긴다) */
function round100(n: number): number {
  return Math.round(n / 100) * 100;
}

/** 걸레받이 m 당 소비자가 (자재 + 시공). 8,700 ~ 14,300원/m */
const BASEBOARD_PRICE: PriceBand = {
  min: round100(20000 / BASEBOARD_M_PER_SUPPLY_PYEONG),
  max: round100(33000 / BASEBOARD_M_PER_SUPPLY_PYEONG),
  unitLabel: '원/m',
  기준일: '2026년 09월 09일',
  출처: 'ulmadna_db.json processes 몰딩·걸레받이 공급 평당 20,000~33,000원(EST-027·033·035)을 84타입 걸레받이 78.3m ÷ 공급 34평으로 m 환산',
  등급: 'C',
  비고: '평당 단가에 천장 몰딩 몫이 섞여 있어 걸레받이 단독으로는 높게 잡혔을 수 있다 — 확인 대기',
};

/**
 * 부자재 항목 키로 단가 밴드를 찾는다. 없으면 undefined.
 * 값은 자동 생성 데이터 파일에서 읽어 온다 — 엑셀을 고치면 여기도 자동으로 따라온다.
 */
export function getFlooringSubmaterialBand(itemKey: string): PriceBand | undefined {
  // 걸레받이는 엑셀에 m 당 단가가 없어 견적서 환산값을 쓴다
  if (itemKey === 'baseboard') return BASEBOARD_PRICE;

  const link = SUBMATERIAL_LINK[itemKey];
  if (!link) return undefined;

  const row = findFlooringSubmaterial(link.dataKey);
  // 엑셀에 가격이 없는 줄이면 밴드를 만들지 않는다(값을 지어내지 않는다)
  if (!row || row.price === null) return undefined;

  return {
    min: row.price,
    max: row.price,
    unitLabel: link.unitLabel,
    기준일: formatSurveyDate(row.surveyDate),
    출처: `형아 엑셀 바닥재 부자재_DB (${row.name} ${row.spec} ${row.saleUnit} ${row.price.toLocaleString()}원)`,
    등급: link.등급,
    비고: link.비고,
  };
}

// ── 3. 기존 바닥재 철거 (㎡당) ────────────────────
//
// 견적서 단가는 전부 "평당"이라 ㎡ 로 바꿔 둔다 (1평 = 3.3058㎡).
// 어떤 바닥재를 걷어 내는지는 묻지 않고, 새로 까는 종류와 같다고 본다.

export const FLOORING_REMOVAL_PRICE: Record<FlooringKind, PriceBand> = {
  장판: {
    min: won(20000 / SQM_PER_PYEONG),
    max: won(20000 / SQM_PER_PYEONG),
    unitLabel: '원/㎡',
    기준일: '2026년 09월 09일',
    출처: '_dev-docs/얼마드나_전공정_세부설계서.md 철거 단가표 (장판 철거+샌딩 20,000원/평, EST-017)',
    등급: 'A',
  },
  마루: {
    min: won(23000 / SQM_PER_PYEONG),
    max: won(35000 / SQM_PER_PYEONG),
    unitLabel: '원/㎡',
    기준일: '2026년 09월 09일',
    출처: '_dev-docs/얼마드나_전공정_세부설계서.md (마루 철거+샌딩 23,000~35,000원/평, EST-007·017) · ulmadna_db 기존 마루 철거비 35,000원/평(EST-032A·033)',
    등급: 'A',
  },
  데코타일: {
    min: won(20000 / SQM_PER_PYEONG),
    max: won(28000 / SQM_PER_PYEONG),
    unitLabel: '원/㎡',
    기준일: '2026년 09월 09일',
    출처: '데코타일 철거 실측 견적서 없음. 장판(2만/평)과 마루(2.3~3.5만/평) 사이로 잡은 추정 밴드',
    등급: 'C',
    비고: '접착제 잔재 제거가 장판보다 손이 가서 하한을 장판과 같게 두고 상한만 올렸다 — 확인 대기',
  },
};

/** 종류로 철거 단가 밴드를 찾는다 */
export function getFlooringRemovalBand(kind: FlooringKind): PriceBand {
  return FLOORING_REMOVAL_PRICE[kind];
}

// ── 4. 폐기물 (1식) ──────────────────────────────

/**
 * 바닥만 뜯어냈을 때의 폐기물 처리비.
 * ulmadna_db 의 50만원(1~2차)·40만원(1톤 1회)은 전체 리모델링 철거 기준이라
 * 바닥 단독 공사(1톤 미만)에 맞춰 낮춰 잡은 추정 밴드다.
 */
export const FLOORING_WASTE_PRICE: PriceBand = {
  min: 150000,
  max: 300000,
  unitLabel: '원/식',
  기준일: '2026년 09월 09일',
  출처: 'ulmadna_db.json 폐기물 1~2차 500,000원(EST-027) · 1톤 1회 400,000원(EST-025)을 바닥 단독 공사 규모로 낮춘 값',
  등급: 'C',
  비고: '바닥 단독 철거는 보통 1톤 미만 — 실측 견적서 없음, 확인 대기',
};

// ── 5. 일당 ─────────────────────────────────────

/**
 * 바닥 시공 일당 밴드.
 * 바닥 전용 일당 표본이 아직 없어 도배 수도권 밴드(28만~32만)를 그대로 쓴다.
 * (화면에서 지역을 안 받으므로 인자 없이 부르면 수도권 밴드가 나온다)
 */
export function getFlooringDailyWageBand(region?: string): PriceBand {
  return getDailyWageBand(region);
}

/** 등급 글자 타입을 다시 내보낸다 (스키마 쪽에서 같이 쓴다) */
export type { EvidenceGrade };
