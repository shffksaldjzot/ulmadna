// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 공정 스키마 — 항목·단위·물량 산출 규칙의 단일 진실 소스
//
// 이 파일이 하는 일:
//   "바닥 미장 공사는 어떤 항목들로 이루어지고, 각 항목의 물량은 어떻게 뽑는가"를 한 표에 적는다.
//   도배·바닥재 스키마(schema/wallpaper.ts · schema/flooring.ts)와 똑같은 생각으로 만들었다.
//
// 항목 (결과 화면 "구성 보기"에 나오는 순서):
//   material  자재 — 레미탈 모드면 레미탈 40kg 포, 셀프레벨링 모드면 셀프레벨링 25kg 포
//   wiremesh  와이어메시 — 레미탈 모드에서 옵션을 켰을 때만
//   primer    프라이머    — 옵션을 켰을 때만 (셀프레벨링은 기본 켬)
//   labor     시공        — 인건 모듈(labor-mortar.ts)이 뽑은 품수
//   overhead  일반경비    — 위 합계에 비율로
//
// 계수는 전부 mortar-coefficients.ts 에 근거 등급·출처와 함께 모아 두었다.
// 대안(현장 배합 시멘트+모래)은 판매 단가를 매길 자재가 아니라 "참고 수치"라서
// 이 스키마에는 없다 — src/server/calc/mortar.ts 오케스트레이터가 별도로 계산해서
// quantity.altMix 로 붙인다(비용 합계에는 안 들어간다).
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

import type { Process, Item, SchemaCalcContext, SchemaQuantityOutput } from './types';
import { ceilSafe } from '../cutting/round';
import {
  WIRE_MESH_OVERLAP_MULT,
  SELF_LEVEL_PRIMER_L_PER_SQM,
  SELF_LEVEL_PRIMER_CAN_L,
} from './mortar-coefficients';

/** 소수점 1자리 반올림 (근거 문장 표기용) */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 계산 재료를 담는 상자를 만든다.
 * 자재 계수(kgPerMmSqm·bagKg)는 제품 선택에 따라 달라지므로, 오케스트레이터가 이미 골라
 * 둔 "이번 계산에 쓸 값"을 그대로 받는다(스키마는 제품 마스터를 직접 모른다).
 */
export function buildMortarContext(args: {
  /** 시공 면적 (㎡) */
  areaSqm: number;
  /** 두께 (mm) */
  thicknessMm: number;
  /** 이번 계산에 쓸 자재 계수 (kg / (mm·㎡)) — 제품을 골랐으면 그 제품 값 */
  kgPerMmSqm: number;
  /** 이번 계산에 쓸 포장 단위 (kg) — 제품을 골랐으면 그 제품 값 */
  bagKg: number;
  /** 로스(여유) 비율. 0.05 = 5% */
  lossRate: number;
  /** 인건 모듈이 산출한 품수 */
  laborManDays: number;
  /** 레미탈 모드인지 (false면 셀프레벨링) */
  isRemicon: boolean;
  /** 와이어메시 옵션 (레미탈 모드 전용) */
  wireMesh: boolean;
  /** 프라이머 옵션 */
  primer: boolean;
}): SchemaCalcContext {
  return {
    numbers: {
      areaSqm: args.areaSqm,
      thicknessMm: args.thicknessMm,
      kgPerMmSqm: args.kgPerMmSqm,
      bagKg: args.bagKg,
      lossRate: args.lossRate,
      laborManDays: args.laborManDays,
    },
    flags: {
      isRemicon: args.isRemicon,
      isSelfLevel: !args.isRemicon,
      wireMesh: args.wireMesh,
      primer: args.primer,
    },
    texts: {
      mode: args.isRemicon ? '레미탈' : '셀프레벨링',
    },
  };
}

// ── 항목별 물량 산출 함수 ──────────────────────────

/** 자재 — 면적 × 두께 × kg/(mm·㎡) 계수 × (1+로스율) ÷ 포장 kg (올림, 최소 1포) */
function calcMaterial(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const area = ctx.numbers.areaSqm;
  const thickness = ctx.numbers.thicknessMm;
  if (area <= 0 || thickness <= 0) return null;
  const kgPerMmSqm = ctx.numbers.kgPerMmSqm;
  const bagKg = ctx.numbers.bagKg;
  const lossRate = ctx.numbers.lossRate ?? 0;
  const kg = area * thickness * kgPerMmSqm * (1 + lossRate);
  const qty = Math.max(1, ceilSafe(kg / bagKg));
  // 2026-09-14 검사관 지적: "로스 5%"만 적으면 이미 포함된 값인지 앞으로 더 넣어야 하는
  // 값인지 헷갈린다 — "포함"을 붙여 이미 반영된 값이라는 걸 분명히 한다.
  return { qty, basis: `${kgPerMmSqm}kg/(mm·㎡) · 로스 ${Math.round(lossRate * 100)}% 포함 · ${bagKg}kg 포` };
}

/** 와이어메시 — 레미탈 모드에서 옵션을 켰을 때만. 면적 × 겹침 여유 */
function calcWireMesh(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isRemicon || !ctx.flags.wireMesh) return null;
  const area = ctx.numbers.areaSqm;
  if (area <= 0) return null;
  const qty = r1(area * WIRE_MESH_OVERLAP_MULT.value);
  return { qty, basis: `면적 × ${WIRE_MESH_OVERLAP_MULT.value}(겹침 여유) · 추정` };
}

/** 프라이머 — 옵션을 켰을 때만. 면적 × L/㎡ ÷ 캔 용량 (올림, 최소 1통) */
function calcPrimer(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.primer) return null;
  const area = ctx.numbers.areaSqm;
  if (area <= 0) return null;
  const liters = area * SELF_LEVEL_PRIMER_L_PER_SQM.value;
  const qty = Math.max(1, ceilSafe(liters / SELF_LEVEL_PRIMER_CAN_L.value));
  return { qty, basis: `${SELF_LEVEL_PRIMER_L_PER_SQM.value}L/㎡ · ${SELF_LEVEL_PRIMER_CAN_L.value}L 통 · 추정` };
}

/**
 * 시공(미장 인건) — 인건 모듈이 산출한 품수를 그대로 쓴다.
 * 셀프레벨링 모드는 오케스트레이터가 laborManDays를 아예 안 채우므로(0) 여기서 null이
 * 되고, 화면은 대신 "시공비는 현장 견적 별도" 안내를 보여준다.
 */
function calcLaborItem(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const md = ctx.numbers.laborManDays;
  if (!md || md <= 0) return null;
  return { qty: md, basis: `인건 산출 ${md}품 (1품 = 1인 1일)` };
}

/** 일반경비 — 자재+부자재+시공 합계에 비율로 붙으므로 물량은 1식 */
function calcOverhead(): SchemaQuantityOutput | null {
  return { qty: 1, basis: '자재 + 부자재 + 시공 합계에 경비율 적용' };
}

// ── 미장 공정 스키마 본체 ──────────────────────────

const ITEMS: Item[] = [
  {
    key: 'material',
    name: '자재',
    // 레미탈·셀프레벨링 둘 다 포대(포) 단위라 대표 단위 하나로 충분하다(장판처럼 단위가
    // 갈리는 경우가 아니다).
    unit: '포',
    kind: '자재',
    quantityRule: {
      desc: '면적 × 두께 × 자재 계수(kg/mm·㎡) ÷ 포장 kg, 올림. 제품을 고르면 제품 계수·포장 kg로 바뀐다',
      calc: calcMaterial,
    },
    priceSource: '제품',
    evidenceGrade: 'B',
    note: '레미탈은 계수 1.65, 셀프레벨링은 1.6이 기본값(제조사 스펙 역산·교차검증)',
  },
  {
    key: 'wiremesh',
    name: '와이어메시',
    unit: '㎡',
    kind: '부자재',
    quantityRule: {
      desc: '면적 × 1.1(겹침 여유), 옵션을 켰을 때만',
      calc: calcWireMesh,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    optional: true,
    appliesWhen: '레미탈 모드 · 와이어메시 옵션 (선택)',
    note: '재료 소요량(겹침률) 표준품셈 미확보 — 추정치',
  },
  {
    key: 'primer',
    name: '프라이머',
    unit: '통',
    kind: '부자재',
    quantityRule: {
      desc: '면적 × 0.2L/㎡ ÷ 18L 통, 올림',
      calc: calcPrimer,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    optional: true,
    appliesWhen: '프라이머 옵션 (셀프레벨링은 기본 켬)',
    note: '도포량 제조사 데이터시트 원문 미확인 — 유통 블로그 종합치',
  },
  {
    key: 'labor',
    name: '미장 시공',
    unit: '품',
    kind: '시공',
    quantityRule: {
      desc: '공법(손미장/장비 타설, 용도가 기본값을 정하고 정밀 모드에서 바꿀 수 있다) 기준 품수. 실제 노임을 곱해 인건비로 환산(반나절 단위 올림, 최소 0.5품). 셀프레벨링은 계산하지 않음',
      calc: calcLaborItem,
    },
    priceSource: '업체',
    evidenceGrade: 'C',
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

/** 미장 공정 스키마 (계산기·질문·업체 폼·시세가 공유하는 표) */
export const MORTAR_PROCESS: Process = {
  key: 'mortar',
  name: '미장',
  items: ITEMS,
};

/**
 * 스키마 전체를 한 번에 돌려서 항목별 물량을 뽑는다.
 * 해당 없는 항목(옵션을 안 켰을 때 등)은 결과에서 빠진다.
 */
export function runMortarSchema(ctx: SchemaCalcContext): Record<string, SchemaQuantityOutput> {
  const out: Record<string, SchemaQuantityOutput> = {};
  for (const item of MORTAR_PROCESS.items) {
    const fn = item.quantityRule.calc;
    if (!fn) continue;
    const result = fn(ctx);
    if (result) out[item.key] = result;
  }
  return out;
}
