// ──────────────────────────────────────────────
// 바닥재 공정 스키마 — 항목·단위·물량 산출 규칙의 단일 진실 소스
//
// 이 파일이 하는 일:
//   "바닥재 공사는 어떤 항목들로 이루어지고, 각 항목의 물량은 어떻게 뽑는가"를 한 표에 적는다.
//   이 표 하나를 계산기 / 소비자 질문 폼 / 업체 견적 폼 / 시세 통계가 함께 쓴다 (도배와 같은 구조).
//
// 항목 (결과 화면 "구성 보기"에 나오는 순서):
//   material  자재 (마루·데코타일은 박스, 장판은 m)
//   bond      마루 본드      — 마루만
//   adhesive  LVT 접착제     — 데코타일만
//   seam      장판 용착제    — 장판만
//   sealant   씰란트         — 걸레받이를 켰을 때
//   baseboard 걸레받이       — 토글 (기본 켬)
//   removal   기존 바닥재 철거 — 토글 (기본 켬)
//   waste     폐기물         — 철거를 켰을 때
//   labor     바닥 시공      — 인건 모듈이 뽑은 품수
//   overhead  일반경비       — 위 합계에 비율로
//
// 계수는 전부 flooring-coefficients.ts 에 근거 등급·출처와 함께 모아 두었다.
//
// 작성일: 2026년 09월 10일
// 근거: docs/설계_계산기_물량견적_20260828.md 2-C절 · 형아 엑셀 바닥재 부자재_DB
// ──────────────────────────────────────────────

import type { Process, Item, SchemaCalcContext, SchemaQuantityOutput } from './types';
import {
  MARU_BOND_PYEONG_PER_CAN,
  MARU_BOND_CAN_KG,
  LVT_ADHESIVE_KG_PER_PYEONG,
  LVT_ADHESIVE_CAN_KG,
  SEAM_M_PER_BOTTLE,
  SEALANT_M_PER_CARTRIDGE,
  BASEBOARD_PERIMETER_MULT,
} from './flooring-coefficients';

/** 소수점 1자리 반올림 (근거 문장 표기용) */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 계산 재료를 담는 상자를 만든다.
 * 각 항목의 산출 함수는 여기 담긴 숫자·조건만 보고 물량을 뽑는다.
 */
export function buildFlooringContext(args: {
  /** 바닥 시공 면적 (㎡) — 시공 범위가 이미 반영된 값 */
  floorSqm: number;
  /** 시공 대상 방들의 둘레 합계 (m) — 걸레받이·씰란트 산출 근거 */
  perimeterM: number;
  /** 바닥 시공 면적을 평으로 바꾼 값 */
  workPyeong: number;
  /** 재단 모듈이 뽑은 구매 수량 (박스 수 또는 m) */
  units: number;
  /** 장판 이음선 길이 합계 (m) — 용착제 산출 근거 */
  seamM: number;
  /** 인건 모듈이 산출한 품수 */
  laborManDays: number;
  /** 바닥재 종류 */
  kind: '마루' | '장판' | '데코타일';
  /** 기존 바닥재 철거를 포함할지 */
  removeOld: boolean;
  /** 걸레받이를 교체할지 */
  baseboard: boolean;
  /** 둘레가 실측인지 추정인지 (근거 문장에 표기) */
  perimeterIsMeasured: boolean;
}): SchemaCalcContext {
  return {
    numbers: {
      floorSqm: args.floorSqm,
      perimeterM: args.perimeterM,
      workPyeong: args.workPyeong,
      units: args.units,
      seamM: args.seamM,
      laborManDays: args.laborManDays,
    },
    flags: {
      isMaru: args.kind === '마루',
      isJangpan: args.kind === '장판',
      isDeco: args.kind === '데코타일',
      removeOld: args.removeOld,
      baseboard: args.baseboard,
      perimeterIsMeasured: args.perimeterIsMeasured,
    },
    texts: {
      kind: args.kind,
    },
  };
}

// ── 항목별 물량 산출 함수 ──────────────────────────
// 각 함수는 "이번 조건에 해당 없음"이면 null 을 돌려준다 (예: 마루인데 LVT 접착제).

/** 자재 — 재단 모듈이 이미 뽑아 놓은 수량(박스 또는 m)을 그대로 쓴다 */
function calcMaterial(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const units = ctx.numbers.units;
  if (!units || units <= 0) return null;
  const unitName = ctx.flags.isJangpan ? 'm' : '박스';
  return { qty: units, basis: `재단 계산 결과 ${units}${unitName}` };
}

/** 마루 본드 — 마루만. 시공 평수 ÷ 통당 감당 평수 (올림) */
function calcMaruBond(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isMaru) return null;
  const pyeong = ctx.numbers.workPyeong;
  if (pyeong <= 0) return null;
  const qty = Math.max(1, Math.ceil(pyeong / MARU_BOND_PYEONG_PER_CAN.value));
  return {
    qty,
    // 근거줄은 계산식이 아니라 계수 한 토막만 (설명글 최소화 원칙)
    basis: `${MARU_BOND_CAN_KG.value}kg 통당 ${MARU_BOND_PYEONG_PER_CAN.value}평`,
  };
}

/** LVT 접착제 — 데코타일만. 시공 평수 × kg/평 ÷ 통 용량 (올림) */
function calcLvtAdhesive(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isDeco) return null;
  const pyeong = ctx.numbers.workPyeong;
  if (pyeong <= 0) return null;
  const kg = pyeong * LVT_ADHESIVE_KG_PER_PYEONG.value;
  const qty = Math.max(1, Math.ceil(kg / LVT_ADHESIVE_CAN_KG.value));
  return {
    qty,
    basis: `${LVT_ADHESIVE_KG_PER_PYEONG.value}kg/평 · ${LVT_ADHESIVE_CAN_KG.value}kg 통`,
  };
}

/** 장판 용착제 — 장판만. 이음선 길이 ÷ 병당 감당 길이 (올림, 최소 1병) */
function calcSeam(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isJangpan) return null;
  if (ctx.numbers.floorSqm <= 0) return null;
  // 이음선이 하나도 없어도 문턱·벽 접합부 마감에 한 병은 쓴다
  const seamM = Math.max(0, ctx.numbers.seamM);
  const qty = Math.max(1, Math.ceil(seamM / SEAM_M_PER_BOTTLE.value));
  return { qty, basis: `이음선 ${r1(seamM)}m · 추정` };
}

/** 씰란트 — 걸레받이를 켰을 때만. 둘레 ÷ 개당 시공 길이 (올림) */
function calcSealant(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.baseboard) return null;
  const perimeter = ctx.numbers.perimeterM;
  if (perimeter <= 0) return null;
  const qty = Math.max(1, Math.ceil(perimeter / SEALANT_M_PER_CARTRIDGE.value));
  const src = ctx.flags.perimeterIsMeasured ? '실측' : '추정';
  return { qty, basis: `둘레 ${r1(perimeter)}m · ${src}` };
}

/** 걸레받이 — 토글. 둘레 × 여유 계수 (m 단위, 소수 1자리) */
function calcBaseboard(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.baseboard) return null;
  const perimeter = ctx.numbers.perimeterM;
  if (perimeter <= 0) return null;
  const qty = r1(perimeter * BASEBOARD_PERIMETER_MULT.value);
  const src = ctx.flags.perimeterIsMeasured ? '실측' : '추정';
  return { qty, basis: `둘레 ${r1(perimeter)}m × ${BASEBOARD_PERIMETER_MULT.value} · ${src}` };
}

/** 기존 바닥재 철거 — 토글. 바닥 면적 전체 */
function calcRemoval(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.removeOld) return null;
  const floor = ctx.numbers.floorSqm;
  if (floor <= 0) return null;
  return { qty: r1(floor), basis: `바닥 ${r1(floor)}㎡ 전체` };
}

/** 폐기물 — 철거를 켰을 때만. 현장 한 곳에 1식 */
function calcWaste(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.removeOld) return null;
  if (ctx.numbers.floorSqm <= 0) return null;
  return { qty: 1, basis: '현장 1식' };
}

/** 바닥 시공 — 인건 모듈이 산출한 품수를 그대로 쓴다 */
function calcLaborItem(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const md = ctx.numbers.laborManDays;
  if (!md || md <= 0) return null;
  return { qty: md, basis: `인건 산출 ${md}품 (1품 = 1인 1일)` };
}

/** 일반경비 — 다른 줄 합계에 비율로 붙으므로 물량은 1식 */
function calcOverhead(): SchemaQuantityOutput | null {
  return { qty: 1, basis: '자재 + 부자재 + 시공 합계에 경비율 적용' };
}

// ── 바닥재 공정 스키마 본체 ────────────────────────

const ITEMS: Item[] = [
  {
    key: 'material',
    name: '바닥재',
    // 대표 단위는 박스로 적어 둔다. 장판은 m 라서 결과를 만들 때 단위 글자만 바꿔 붙인다
    // (한 공정 안에서 종류에 따라 단위가 달라지는 유일한 항목이다).
    unit: '박스',
    kind: '자재',
    quantityRule: {
      desc: '실측이 있으면 방마다 깔아 보고(마루·데코타일) 또는 방향을 비교해(장판) 수량을 뽑는다. 실측이 없으면 종류 로스율로 추정.',
      calc: calcMaterial,
    },
    priceSource: '제품',
    evidenceGrade: 'A',
    note: '제품을 고르면 장 규격·박스당 ㎡가 바뀌어 수량도 같이 바뀐다',
  },
  {
    key: 'bond',
    name: '마루 본드',
    unit: '통',
    kind: '부자재',
    quantityRule: {
      desc: '바닥 시공 평수 ÷ 통당 2평(10kg 통), 올림',
      calc: calcMaruBond,
    },
    priceSource: '제품',
    evidenceGrade: 'A',
    appliesWhen: '마루 (접착 시공)',
  },
  {
    key: 'adhesive',
    name: 'LVT 접착제',
    unit: '통',
    kind: '부자재',
    quantityRule: {
      desc: '바닥 시공 평수 × 1.4kg/평 ÷ 4kg 통, 올림',
      calc: calcLvtAdhesive,
    },
    priceSource: '제품',
    evidenceGrade: 'A',
    appliesWhen: '데코타일 (접착 시공)',
  },
  {
    key: 'seam',
    name: '장판 용착제',
    unit: '개',
    kind: '부자재',
    quantityRule: {
      desc: '이음선 길이 ÷ 병당 15m(25ml 병, 추정), 올림. 최소 1병',
      calc: calcSeam,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    appliesWhen: '장판 (이음부 마감)',
    note: '병당 시공 길이 미확보 — 시공팀 확인 대기',
  },
  {
    key: 'sealant',
    name: '씰란트',
    unit: '개',
    kind: '부자재',
    quantityRule: {
      desc: '둘레 m ÷ 개당 11m(카트리지, 추정), 올림',
      calc: calcSealant,
    },
    priceSource: '제품',
    // 2026-09-10 검사관 지적: 개당 시공 길이(11m)가 C 추정 계수라 항목 등급도 C 로 맞춘다
    evidenceGrade: 'C',
    appliesWhen: '걸레받이 교체 (틈새 마감)',
  },
  {
    key: 'baseboard',
    name: '걸레받이',
    unit: 'm',
    kind: '부자재',
    quantityRule: {
      desc: '둘레 m × 1.05(모서리·이음 여유)',
      calc: calcBaseboard,
    },
    priceSource: '업체',
    // 2026-09-10 검사관 지적: 여유 계수 1.05 가 C 추정 계수라 항목 등급도 C 로 맞춘다
    evidenceGrade: 'C',
    optional: true,
    appliesWhen: '걸레받이 교체 (선택)',
  },
  {
    key: 'removal',
    name: '기존 바닥재 철거',
    unit: '㎡',
    kind: '철거',
    quantityRule: {
      desc: '바닥 시공 면적 전체',
      calc: calcRemoval,
    },
    priceSource: '업체',
    evidenceGrade: 'A',
    optional: true,
    appliesWhen: '구축 기준 (선택)',
  },
  {
    key: 'waste',
    name: '폐기물',
    unit: '식',
    kind: '철거',
    quantityRule: {
      desc: '현장 1식 (바닥 단독 공사 기준)',
      calc: calcWaste,
    },
    priceSource: '업체',
    evidenceGrade: 'C',
    appliesWhen: '기존 바닥재 철거를 켰을 때',
  },
  {
    key: 'labor',
    name: '바닥 시공',
    unit: '품',
    kind: '시공',
    quantityRule: {
      // 2026-09-10 검사관 지적: 설명글에 평당 단가·일당 숫자가 있으면 단가가 새 나간다 → 숫자를 뺐다
      desc: '바닥 시공 평수 × 종류별 평당 노무 단가(헤링본 가산). 기준 일당으로 품수 환산(반나절 단위 올림, 최소 1품)',
      calc: calcLaborItem,
    },
    priceSource: '업체',
    evidenceGrade: 'B',
  },
  {
    key: 'overhead',
    name: '일반경비',
    unit: '%',
    kind: '경비',
    quantityRule: {
      desc: '자재 + 부자재 + 시공 합계에 경비율(6~9%) 적용',
      calc: calcOverhead,
    },
    priceSource: '업체',
    evidenceGrade: 'C',
  },
];

/** 바닥재 공정 스키마 (계산기·질문·업체 폼·시세가 공유하는 표) */
export const FLOORING_PROCESS: Process = {
  key: 'flooring',
  name: '바닥재',
  items: ITEMS,
};

/**
 * 스키마 전체를 한 번에 돌려서 항목별 물량을 뽑는다.
 * 해당 없는 항목(마루인데 LVT 접착제 등)은 결과에서 빠진다.
 */
export function runFlooringSchema(ctx: SchemaCalcContext): Record<string, SchemaQuantityOutput> {
  const out: Record<string, SchemaQuantityOutput> = {};
  for (const item of FLOORING_PROCESS.items) {
    const fn = item.quantityRule.calc;
    if (!fn) continue;
    const result = fn(ctx);
    if (result) out[item.key] = result;
  }
  return out;
}
