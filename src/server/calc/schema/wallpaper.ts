// ──────────────────────────────────────────────
// 도배 공정 스키마 — 항목·단위·물량 산출 규칙의 단일 진실 소스
//
// 이 표 하나를 계산기 / 소비자 질문 폼 / 업체 견적 폼 / 시세 통계가 전부 함께 쓴다.
//   계산기   → 항목·단위·산출 규칙을 가져가고 물량과 소비자가 범위를 채운다
//   질문     → 계산기 결과의 항목·물량이 그대로 붙는다
//   업체 폼  → 같은 항목·같은 물량이 채워진 표에서 업체는 단가 칸만 입력한다
//   시세     → 항목별 단가가 표준 단위(롤당·포당·품당)로 쌓인다
//
// 계수는 전부 wallpaper-coefficients.ts 에 근거 등급·출처와 함께 모아 두었다.
//
// 작성일: 2026년 08월 28일
// 근거: docs/설계_계산기_물량견적_20260828.md 0-B절·2-D절
// ──────────────────────────────────────────────

import type { Process, Item, SchemaCalcContext, SchemaQuantityOutput } from './types';
import {
  PASTE_PYEONG_PER_BAG,
  PASTE_BAG_KG,
  NONWOVEN_AREA_MULT,
  NONWOVEN_SQM_PER_ROLL,
  LINING_PAPER_RATIO,
  LINING_PAPER_SQM_PER_ROLL,
  NEBARI_PERIMETER_MULT,
  NEBARI_M_PER_ROLL,
  BOND_KG_PER_SQM,
  BOND_KG_PER_CAN,
  PUTTY_KG_PER_SQM,
  PUTTY_KG_PER_BAG,
  BINDER_KG_PER_SQM,
  BINDER_KG_PER_CAN,
  SILICONE_PERIMETER_MULT,
  SILICONE_M_PER_CARTRIDGE,
  type PaperType,
} from './wallpaper-coefficients';

/** 소수점 1자리 반올림 (근거 문장 표기용) */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 계산 재료를 담는 상자를 만든다.
 * 각 항목의 산출 함수는 여기 담긴 숫자·조건만 보고 물량을 뽑는다.
 */
export function buildWallpaperContext(args: {
  /** 벽 도배 면적 (㎡) */
  wallSqm: number;
  /** 천장 도배 면적 (㎡). 천장 안 하면 0 */
  ceilingSqm: number;
  /** 도배하는 벽의 둘레 (m) — 실측이 없으면 벽 면적 ÷ 표준 벽 높이로 추정한 값 */
  perimeterM: number;
  /** 재단으로 산출된 벽지 롤 수 */
  rolls: number;
  /** 도배 시공 면적을 평으로 환산한 값 */
  workPyeong: number;
  /** 사용자가 고른 공급 평형 */
  supplyPyeong: number;
  /** 인건 모듈이 산출한 품수 */
  laborManDays: number;
  /** 벽지 종류 */
  paperType: PaperType;
  /** 구축(재도배) 여부 */
  isOld: boolean;
  /** 천장 포함 여부 */
  ceiling: boolean;
  /** 기존 벽지 제거를 포함할지 */
  removeOld: boolean;
  /** 둘레가 실측인지 추정인지 (근거 문장에 표기) */
  perimeterIsMeasured: boolean;
}): SchemaCalcContext {
  return {
    numbers: {
      wallSqm: args.wallSqm,
      ceilingSqm: args.ceilingSqm,
      totalSqm: args.wallSqm + args.ceilingSqm,
      perimeterM: args.perimeterM,
      rolls: args.rolls,
      workPyeong: args.workPyeong,
      supplyPyeong: args.supplyPyeong,
      laborManDays: args.laborManDays,
    },
    flags: {
      isOld: args.isOld,
      ceiling: args.ceiling,
      isSilk: args.paperType === '실크',
      removeOld: args.removeOld,
      perimeterIsMeasured: args.perimeterIsMeasured,
    },
    texts: {
      paperType: args.paperType,
    },
  };
}

// ── 항목별 물량 산출 함수 ──────────────────────────
// 각 함수는 "해당 없음"이면 null 을 돌려준다 (예: 신축인데 퍼티 항목).

/** 벽지 — 재단 모듈이 이미 뽑아 놓은 롤 수를 그대로 쓴다 */
function calcWallpaperRolls(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const rolls = ctx.numbers.rolls;
  if (!rolls || rolls <= 0) return null;
  return { qty: rolls, basis: `재단 계산 결과 ${rolls}롤` };
}

/** 도배풀 — 도배 평수 ÷ 포당 감당 평수 (올림) */
function calcPaste(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const pyeong = ctx.numbers.workPyeong;
  if (pyeong <= 0) return null;
  const paperType = ctx.texts.paperType as PaperType;
  const band = PASTE_PYEONG_PER_BAG[paperType] ?? PASTE_PYEONG_PER_BAG['실크'];
  // 모자라면 공사가 멈추므로 "가장 많이 드는 쪽(min 평수/포)"으로 보수 산출
  const qty = Math.max(1, Math.ceil(pyeong / band.min));
  const bandText = band.min === band.max ? `${band.min}평` : `${band.min}~${band.max}평`;
  // 근거줄은 계산식이 아니라 한 토막 계수만 (설명글 최소화 원칙)
  return {
    qty,
    basis: `${PASTE_BAG_KG}kg 포당 ${bandText}`,
  };
}

/** 부직포(공간초배) — 실크에만. 벽 면적 × 여유계수 ÷ 롤당 면적 */
function calcNonwoven(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isSilk) return null; // 합지는 부직포 대신 각초배지
  const wall = ctx.numbers.wallSqm;
  if (wall <= 0) return null;
  const need = wall * NONWOVEN_AREA_MULT.max;
  const qty = Math.max(1, Math.ceil(need / NONWOVEN_SQM_PER_ROLL.value));
  return {
    qty,
    basis: `벽면적 × ${NONWOVEN_AREA_MULT.max}`,
  };
}

/** 각초배지(운용지) — 합지에만. 벽 면적 × 소요 계수 ÷ 롤당 면적 */
function calcLiningPaper(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (ctx.flags.isSilk) return null; // 실크는 부직포가 그 역할
  const wall = ctx.numbers.wallSqm;
  if (wall <= 0) return null;
  const need = wall * LINING_PAPER_RATIO.value;
  const qty = Math.max(1, Math.ceil(need / LINING_PAPER_SQM_PER_ROLL.value));
  return {
    qty,
    basis: `벽면적 × ${LINING_PAPER_RATIO.value} · 추정`,
  };
}

/** 네바리 — 구축만. 둘레 × 2줄(천장선·바닥선) ÷ 롤당 길이 */
function calcNebari(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isOld) return null;
  const perimeter = ctx.numbers.perimeterM;
  if (perimeter <= 0) return null;
  const need = perimeter * NEBARI_PERIMETER_MULT.value;
  const qty = Math.max(1, Math.ceil(need / NEBARI_M_PER_ROLL.value));
  const src = ctx.flags.perimeterIsMeasured ? '실측' : '추정';
  return {
    qty,
    basis: `둘레 ${r1(perimeter)}m · ${src}`,
  };
}

/** 본드 — 실크(부직포 접착)에만. 벽 면적 × kg/㎡ ÷ 통 용량 */
function calcBond(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isSilk) return null;
  const wall = ctx.numbers.wallSqm;
  if (wall <= 0) return null;
  const kg = wall * BOND_KG_PER_SQM.value;
  const qty = Math.max(1, Math.ceil(kg / BOND_KG_PER_CAN.value));
  return {
    qty,
    basis: `${BOND_KG_PER_SQM.value}kg/㎡ · 추정`,
  };
}

/** 퍼티(핸디코트) — 구축만. 벽 면적 × kg/㎡ ÷ 포 용량 */
function calcPutty(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isOld) return null;
  const wall = ctx.numbers.wallSqm;
  if (wall <= 0) return null;
  const kg = wall * PUTTY_KG_PER_SQM.value;
  const qty = Math.max(1, Math.ceil(kg / PUTTY_KG_PER_BAG.value));
  return {
    qty,
    basis: `${PUTTY_KG_PER_SQM.value}kg/㎡ · 추정`,
  };
}

/** 바인더·프라이머 — 구축만. 벽 면적 × kg/㎡ ÷ 통 용량 */
function calcBinder(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.isOld) return null;
  const wall = ctx.numbers.wallSqm;
  if (wall <= 0) return null;
  const kg = wall * BINDER_KG_PER_SQM.value;
  const qty = Math.max(1, Math.ceil(kg / BINDER_KG_PER_CAN.value));
  return {
    qty,
    basis: `${BINDER_KG_PER_SQM.value}kg/㎡ · 추정`,
  };
}

/** 수성실리콘(코킹) — 둘레 × 2줄 ÷ 카트리지당 시공 길이 */
function calcSilicone(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const perimeter = ctx.numbers.perimeterM;
  if (perimeter <= 0) return null;
  const need = perimeter * SILICONE_PERIMETER_MULT.value;
  const qty = Math.max(1, Math.ceil(need / SILICONE_M_PER_CARTRIDGE.value));
  const src = ctx.flags.perimeterIsMeasured ? '실측' : '추정';
  return {
    qty,
    basis: `둘레 ${r1(perimeter)}m · ${src}`,
  };
}

/** 보양(마스킹·비닐) — 현장 한 곳에 한 번, 1식으로 잡는다 */
function calcProtection(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const total = ctx.numbers.totalSqm;
  if (total <= 0) return null;
  return { qty: 1, basis: '현장 1식' };
}

/** 기존 벽지 제거 — 구축에서 선택했을 때만. 벽 + 천장 면적 */
function calcRemoval(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  if (!ctx.flags.removeOld) return null;
  const total = ctx.numbers.totalSqm;
  if (total <= 0) return null;
  return { qty: r1(total), basis: `벽 ${r1(ctx.numbers.wallSqm)}㎡ + 천장 ${r1(ctx.numbers.ceilingSqm)}㎡ = ${r1(total)}㎡` };
}

/** 시공(도배 인건) — 인건 모듈이 산출한 품수를 그대로 쓴다 */
function calcLaborItem(ctx: SchemaCalcContext): SchemaQuantityOutput | null {
  const md = ctx.numbers.laborManDays;
  if (!md || md <= 0) return null;
  return { qty: md, basis: `인건 산출 ${md}품 (1품 = 1인 1일)` };
}

/** 일반경비 — 자재+시공 합계에 비율로 붙으므로 물량은 1식 */
function calcOverhead(): SchemaQuantityOutput | null {
  return { qty: 1, basis: '자재 + 부자재 + 시공 합계에 경비율 적용' };
}

// ── 도배 공정 스키마 본체 ──────────────────────────

const ITEMS: Item[] = [
  {
    key: 'wallpaper',
    name: '벽지',
    unit: '롤',
    kind: '자재',
    quantityRule: {
      desc: '벽·천장 면적을 재단 모듈(rollWall)에 넣어 롤 수를 뽑는다. 실측이 있으면 실제 재단, 없으면 표준품셈 정배지 1.2배 추정.',
      calc: calcWallpaperRolls,
    },
    priceSource: '제품',
    evidenceGrade: 'A',
    note: '제품을 고르면 폭·길이·리피트가 바뀌어 롤 수도 같이 바뀐다',
  },
  {
    key: 'paste',
    name: '도배풀',
    unit: '포',
    kind: '부자재',
    quantityRule: {
      desc: '도배 평수 ÷ 14kg 포당 감당 평수(합지 20~30평 / 실크 약 20평), 올림',
      calc: calcPaste,
    },
    priceSource: '제품',
    evidenceGrade: 'A',
  },
  {
    key: 'nonwoven',
    name: '부직포',
    unit: '롤',
    kind: '부자재',
    quantityRule: {
      desc: '벽 면적 × 1.05~1.1 ÷ 롤당 99㎡(1.1m × 90m), 올림',
      calc: calcNonwoven,
    },
    priceSource: '제품',
    evidenceGrade: 'A',
    appliesWhen: '실크 (합지는 각초배지로 대체)',
  },
  {
    key: 'lining_paper',
    name: '초배지',
    unit: '롤',
    kind: '부자재',
    quantityRule: {
      desc: '벽 면적 × 0.3(추정) ÷ 롤당 27㎡(30cm × 90m), 올림',
      calc: calcLiningPaper,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    appliesWhen: '합지',
    note: '벽면 요철에 좌우돼 표준 계수가 없다 — 시공팀 확인 대기',
  },
  {
    key: 'nebari',
    name: '네바리(이음 보강)',
    unit: '롤',
    kind: '부자재',
    quantityRule: {
      desc: '둘레 m × 2줄(천장선·걸레받이선) ÷ 롤당 90m(9cm 폭), 올림',
      calc: calcNebari,
    },
    priceSource: '제품',
    evidenceGrade: 'B',
    appliesWhen: '구축 재도배',
  },
  {
    key: 'bond',
    name: '본드',
    unit: '통',
    kind: '부자재',
    quantityRule: {
      desc: '벽 면적 × 0.02kg/㎡(추정) ÷ 5kg 통, 올림',
      calc: calcBond,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    appliesWhen: '실크 (부직포 가장자리 접착)',
    note: '㎡당 도포량 미확보 — 시공팀 확인 대기',
  },
  {
    key: 'putty',
    name: '퍼티(핸디코트)',
    unit: '포',
    kind: '부자재',
    quantityRule: {
      desc: '벽 면적 × 0.13kg/㎡(추정·국소 보수) ÷ 20kg 포, 올림',
      calc: calcPutty,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    appliesWhen: '구축 재도배',
    note: '전면 시공은 1.3kg/㎡(1mm)이 상한. 도배는 국소 보수라 10%만 적용한 추정치',
  },
  {
    key: 'binder',
    name: '바인더·프라이머',
    unit: '통',
    kind: '부자재',
    quantityRule: {
      desc: '벽 면적 × 0.15kg/㎡(추정) ÷ 15kg 통, 올림',
      calc: calcBinder,
    },
    priceSource: '제품',
    evidenceGrade: 'C',
    appliesWhen: '구축·오염면·석고보드',
    note: '㎡당 도포량 미확보 — 시공팀 확인 대기',
  },
  {
    key: 'silicone',
    name: '실리콘',
    unit: '개',
    kind: '부자재',
    quantityRule: {
      desc: '둘레 m × 2줄 ÷ 개당 11m(300ml 카트리지, 추정), 올림',
      calc: calcSilicone,
    },
    priceSource: '제품',
    evidenceGrade: 'B',
  },
  {
    key: 'protection',
    name: '보양',
    unit: '식',
    kind: '부자재',
    quantityRule: {
      desc: '현장 1식 (둘레 m + 바닥 면적에 따라 업체가 조정)',
      calc: calcProtection,
    },
    priceSource: '업체',
    evidenceGrade: 'C',
  },
  {
    key: 'removal',
    name: '기존 벽지 제거',
    unit: '㎡',
    kind: '철거',
    quantityRule: {
      desc: '벽 + 천장 면적 전체',
      calc: calcRemoval,
    },
    priceSource: '업체',
    evidenceGrade: 'A',
    optional: true,
    appliesWhen: '구축 재도배 (선택)',
  },
  {
    key: 'labor',
    name: '도배 시공',
    unit: '품',
    kind: '시공',
    quantityRule: {
      desc: '실크는 (공급 평수 × 3 ÷ 15) + 1품, 합지는 2인 1조 하루 30평 기준. 천장 제외·구축 여부로 가감',
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

/** 도배 공정 스키마 (계산기·질문·업체 폼·시세가 공유하는 표) */
export const WALLPAPER_PROCESS: Process = {
  key: 'wallpaper',
  name: '도배',
  items: ITEMS,
};

/**
 * 스키마 전체를 한 번에 돌려서 항목별 물량을 뽑는다.
 * 해당 없는 항목(신축의 퍼티 등)은 결과에서 빠진다.
 */
export function runWallpaperSchema(ctx: SchemaCalcContext): Record<string, SchemaQuantityOutput> {
  const out: Record<string, SchemaQuantityOutput> = {};
  for (const item of WALLPAPER_PROCESS.items) {
    const fn = item.quantityRule.calc;
    if (!fn) continue;
    const result = fn(ctx);
    if (result) out[item.key] = result;
  }
  return out;
}
