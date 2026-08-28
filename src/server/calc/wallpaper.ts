// ──────────────────────────────────────────────
// 도배 계산기 — 오케스트레이터
//
// 하는 일 (설계 정본 0-A · 1~2절 흐름 그대로):
//   1) 치수 공통 모듈로 실별 치수(RoomDims[])를 받는다
//      평형으로 → 62건 비율표로 추정 / 실측으로 → 방마다 가로·세로 / 면적으로 → 면적 직접 입력
//   2) 시공 범위(전체 / 거실·주방 / 방 고르기)로 치수를 추린다
//   3) 재단 모듈(rollWall)로 롤 수와 로스를 뽑는다
//   4) 공정 스키마를 돌려 부자재 물량을 자동 산출한다
//   5) 인건 모듈로 품수를 구한다
//   6) 서버 단가를 곱해 소비자가 범위를 만든다
//
// 내보내는 것: 물량 · 부자재 · 소비자가 범위 · 근거 문장.
// 내보내지 않는 것: 업자가, 산식 내부값(재단 중간값·품수 보정 계수 등).
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import 'server-only';

import { calcRollWall } from './cutting/rollWall';
import type { CuttingResult, LossMode } from './cutting/types';
import { resolveDimensions } from './dimensions';
import type { DimensionMode, RoomDims, RoomInput, AreaInput } from './dimensions';
import { calcLabor } from './labor';
import { buildWallpaperContext, runWallpaperSchema, WALLPAPER_PROCESS } from './schema/wallpaper';
import type { EvidenceGrade } from './schema/types';
import {
  DEFAULT_ROLL_SPEC,
  SQM_PER_PYEONG,
  type PaperType,
  type RollSpec,
} from './schema/wallpaper-coefficients';
import {
  getWallpaperRollPriceBand,
  getSubmaterialPriceBand,
  getDailyWageBand,
  REMOVAL_PRICE_PER_SQM,
  OVERHEAD_RATE,
  type DirectProduct,
  type PriceBand,
} from '../pricing/wallpaper';

// ── 입력 타입 ──────────────────────────────────

/** 시공 범위 — 전체 / 거실·주방만 / 방 키 목록 */
export type WallpaperScope = '전체' | '거실주방' | string[];

/** 도배 계산 입력 */
export interface WallpaperCalcInput {
  /** 입력 방식. 기본 평형 */
  mode?: DimensionMode;

  // ── 평형 모드 ──
  /** 공급 평형 (18·24·25·30·34·40·45 또는 직접 입력) */
  pyeong?: number;
  /** 베이 수 (2 / 3 / 4). 기본 3 */
  bay?: 2 | 3 | 4;

  // ── 실측 모드 ──
  /** 방마다 가로·세로(·높이·문·창) */
  rooms?: RoomInput[];
  /** 공통 천장 높이 (m). 기본 2.3 */
  heightM?: number;

  // ── 면적 모드 ──
  /** 이미 뽑아둔 면적 (벽 ㎡ · 천장 ㎡ · 둘레 m) */
  areas?: AreaInput;

  // ── 공통 ──
  /** 시공 범위. 기본 전체 */
  scope?: WallpaperScope;
  /** 천장 포함 여부. 기본 켬 */
  ceiling?: boolean;
  /** 벽지 종류. 기본 실크 */
  paperType?: PaperType;
  /** 제품 직접 입력 (롤당 가격·폭·길이·리피트). 없으면 종류 평균가 */
  product?: DirectProduct;
  /** 지역 (선택). 비용에만 영향 */
  region?: string;
  /** 구축(재도배) 여부. 기본 false = 신축·빈집 */
  isOld?: boolean;
  /** 기존 벽지 제거 포함 여부. 기본은 구축이면 포함 */
  removeOld?: boolean;
}

// ── 출력 타입 ──────────────────────────────────

/** 실별 물량 한 줄 */
export interface RoomQuantity {
  key: string;
  name: string;
  /** 벽 면적 (㎡) */
  wallSqm: number;
  /** 천장 면적 (㎡) */
  ceilingSqm: number;
  /** 이 방에 배분된 롤 수 */
  rolls: number;
}

/** 부자재 한 줄 */
export interface SubmaterialLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  /** 산출 근거 문장 */
  basis: string;
  /** 근거 등급 (C면 화면에 "추정" 표기) */
  grade: EvidenceGrade;
}

/** 비용 구성 한 줄 */
export interface CostLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  /** 소비자가 최저 단가 (원) */
  unitPriceMin: number;
  /** 소비자가 최고 단가 (원) */
  unitPriceMax: number;
  /** 금액 최저 (원) */
  amountMin: number;
  /** 금액 최고 (원) */
  amountMax: number;
  /** 근거 문장 (물량 근거 + 단가 출처) */
  note: string;
}

/** 도배 계산 결과 */
export interface WallpaperCalcResult {
  quantity: {
    /** 총 롤 수 */
    rolls: number;
    /** 벽 도배 면적 (㎡) */
    wallSqm: number;
    /** 천장 도배 면적 (㎡) */
    ceilingSqm: number;
    /** 둘레 (m) — 네바리·실리콘 산출 근거 */
    perimeterM: number;
    /** 로스율 (%) */
    lossPct: number;
    /** 로스를 어떻게 구했는지 (실제 / 추정 / 면적) */
    lossMode: LossMode;
    /** 어떤 입력 방식으로 치수를 잡았는지 */
    inputMode: DimensionMode;
    /** 실별 보기 (면적 모드는 1행) */
    byRoom: RoomQuantity[];
  };
  submaterials: SubmaterialLine[];
  cost: {
    /** 최저 (원) */
    min: number;
    /** 중간 (원) */
    mid: number;
    /** 최고 (원) */
    max: number;
    /** 표본 통계로 냈는지, 산식으로 냈는지 */
    mode: '표본' | '산식';
    /** 결과 화면 근거 한 줄 */
    basisLine: string;
    /** 구성 보기 */
    breakdown: CostLine[];
  };
}

// ── 작은 도우미들 ──────────────────────────────

/** 소수점 1자리 반올림 */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 원 단위 금액을 1,000원 단위로 반올림 */
function roundWon(n: number): number {
  return Math.round(n / 1000) * 1000;
}

/** "거실·주방만" 범위에 들어가는 방 키 */
const LIVING_SCOPE_KEYS = ['living', 'kitchen', 'total'];

/**
 * 시공 범위를 방 키 목록으로 바꾼다.
 * 알 수 없는 키만 들어와서 하나도 안 걸리면 전체로 되돌린다.
 */
function resolveScopeKeys(scope: WallpaperScope, allKeys: string[]): string[] {
  if (scope === '전체') return allKeys;
  if (scope === '거실주방') {
    const picked = allKeys.filter((k) => LIVING_SCOPE_KEYS.includes(k));
    return picked.length > 0 ? picked : allKeys;
  }
  const picked = allKeys.filter((k) => scope.includes(k));
  return picked.length > 0 ? picked : allKeys;
}

/**
 * 롤 수를 실별로 나눠 준다.
 * 면적 비율로 나눈 뒤, 소수점 때문에 합이 안 맞는 만큼을 소수부가 큰 방부터 하나씩 더 준다.
 */
function allocateRolls(rooms: { key: string; weight: number }[], totalRolls: number): Record<string, number> {
  const sum = rooms.reduce((s, r) => s + r.weight, 0);
  const out: Record<string, number> = {};
  if (sum <= 0 || totalRolls <= 0) {
    for (const r of rooms) out[r.key] = 0;
    return out;
  }
  const exact = rooms.map((r) => ({ key: r.key, v: (r.weight / sum) * totalRolls }));
  let used = 0;
  for (const e of exact) {
    const floor = Math.floor(e.v);
    out[e.key] = floor;
    used += floor;
  }
  // 남은 롤을 소수부가 큰 방부터 하나씩 배분
  const remain = totalRolls - used;
  const sorted = [...exact].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
  for (let i = 0; i < remain; i++) {
    out[sorted[i % sorted.length].key] += 1;
  }
  return out;
}

/** 오늘 기준 "2026.8" 같은 표기를 만든다 */
function baseMonthLabel(now: Date = new Date()): string {
  return `${now.getFullYear()}.${now.getMonth() + 1}`;
}

/** 근거 등급이 C면 "추정" 꼬리표를 붙인다 */
function gradeTag(grade: EvidenceGrade): string {
  return grade === 'C' ? ' (추정)' : '';
}

// ── 본체 ──────────────────────────────────────

/**
 * 도배 계산기 본체.
 * 입력 한 번으로 치수 → 물량 → 부자재 → 인건 → 비용까지 한 번에 돌린다.
 */
export function calcWallpaper(input: WallpaperCalcInput): WallpaperCalcResult {
  // ── 0) 입력 기본값 정리 ──
  const mode: DimensionMode = input.mode ?? '평형';
  const scope: WallpaperScope = input.scope ?? '전체';
  const ceiling = input.ceiling ?? true;
  const paperType: PaperType = input.paperType ?? '실크';
  const isOld = input.isOld ?? false;
  const removeOld = input.removeOld ?? isOld; // 구축이면 기본으로 제거 포함

  // ── 1) 치수 공통 모듈 (평형 / 실측 / 면적을 같은 모양으로 받아 온다) ──
  const dims = resolveDimensions({
    mode,
    pyeong: input.pyeong,
    bay: input.bay,
    rooms: input.rooms,
    heightM: input.heightM,
    areas: input.areas,
  });

  // ── 2) 시공 범위 적용 ──
  const allKeys = dims.rooms.map((r) => r.key);
  const scopeKeys = resolveScopeKeys(scope, allKeys);
  const selected: RoomDims[] = dims.rooms.filter((r) => scopeKeys.includes(r.key));

  const wallSqm = r1(selected.reduce((s, r) => s + r.wallSqm, 0));
  const ceilingSqm = ceiling ? r1(selected.reduce((s, r) => s + r.ceilingSqm, 0)) : 0;
  const totalSqm = r1(wallSqm + ceilingSqm);
  const perimeterM = r1(selected.reduce((s, r) => s + r.perimeterM, 0));

  // 전체 대비 시공 비율 (인건 품수를 줄일 때 쓴다)
  const fullTotal = dims.totals.wallSqm + dims.totals.ceilingSqm;
  const scopeRatio = fullTotal > 0 ? Math.min(1, totalSqm / fullTotal) : 1;

  // ── 3) 벽지 규격 정하기 (제품 직접 입력이 있으면 그 규격) ──
  const spec: RollSpec = input.product
    ? {
        widthCm: input.product.widthCm,
        lengthM: input.product.lengthM,
        repeatCm: input.product.repeatCm ?? 0,
        sqmPerRoll: r1((input.product.widthCm / 100) * input.product.lengthM),
        source: '사용자 직접 입력 규격',
      }
    : DEFAULT_ROLL_SPEC[paperType];

  // ── 4) 재단 ──
  // 실측 치수가 있으면 실제로 잘라 보고, 없으면 표준품셈 할증으로 추정한다.
  // 면적 직접 입력은 계산 방식과 무관하게 꼬리표를 "면적"으로 붙인다.
  const cutting: CuttingResult = calcRollWall({
    wallSqm,
    ceilingSqm,
    spec,
    measured: dims.canRealCut ? { wallHeightM: dims.heightM, perimeterM } : undefined,
    lossModeLabel: mode === '면적' ? '면적' : undefined,
  });
  const rolls = cutting.units;

  // 둘레가 실측인지 추정인지 (부자재 근거 문장에 표기)
  const perimeterIsMeasured = selected.length > 0 && selected.every((r) => !r.estimated);

  // ── 5) 인건 ──
  const labor = calcLabor({
    supplyPyeong: dims.supplyPyeong,
    paperType,
    ceiling,
    isOld,
    scopeRatio,
    region: input.region,
  });

  // ── 6) 공정 스키마 실행 → 항목별 물량 ──
  const ctx = buildWallpaperContext({
    wallSqm,
    ceilingSqm,
    perimeterM,
    rolls,
    workPyeong: totalSqm / SQM_PER_PYEONG,
    supplyPyeong: dims.supplyPyeong,
    laborManDays: labor.manDays,
    paperType,
    isOld,
    ceiling,
    removeOld,
    perimeterIsMeasured,
  });
  const schemaQty = runWallpaperSchema(ctx);

  // ── 7) 부자재 목록 만들기 ──
  const submaterials: SubmaterialLine[] = [];
  for (const item of WALLPAPER_PROCESS.items) {
    if (item.kind !== '부자재') continue;
    const got = schemaQty[item.key];
    if (!got) continue;
    submaterials.push({
      key: item.key,
      name: item.name,
      qty: got.qty,
      unit: item.unit,
      basis: got.basis,
      grade: item.evidenceGrade,
    });
  }

  // ── 8) 비용 계산 ──
  const breakdown: CostLine[] = [];
  let sumMin = 0;
  let sumMax = 0;

  /** 구성 보기에 한 줄 추가하는 도우미 */
  const pushLine = (
    key: string,
    name: string,
    qty: number,
    unit: string,
    band: PriceBand,
    basis: string,
    grade: EvidenceGrade,
  ) => {
    const amountMin = Math.round(qty * band.min);
    const amountMax = Math.round(qty * band.max);
    sumMin += amountMin;
    sumMax += amountMax;
    breakdown.push({
      key,
      name,
      qty,
      unit,
      unitPriceMin: band.min,
      unitPriceMax: band.max,
      amountMin,
      amountMax,
      note: `${basis} · 단가 ${band.출처}${gradeTag(grade)}`,
    });
  };

  for (const item of WALLPAPER_PROCESS.items) {
    const got = schemaQty[item.key];
    if (!got) continue;

    if (item.key === 'wallpaper') {
      // 벽지 — 제품 직접 입력이 있으면 그 가격
      const band = getWallpaperRollPriceBand(paperType, input.product);
      pushLine(item.key, `${paperType} 벽지`, got.qty, item.unit, band, got.basis, band.등급);
      continue;
    }

    if (item.key === 'labor') {
      // 시공 — 지역별 일당
      const band = getDailyWageBand(input.region);
      pushLine(item.key, item.name, got.qty, item.unit, band, labor.basis, band.등급);
      continue;
    }

    if (item.key === 'removal') {
      // 기존 벽지 제거
      pushLine(item.key, item.name, got.qty, item.unit, REMOVAL_PRICE_PER_SQM, got.basis, REMOVAL_PRICE_PER_SQM.등급);
      continue;
    }

    if (item.key === 'overhead') {
      // 경비는 마지막에 따로 계산한다 (다른 줄 합계가 필요하므로)
      continue;
    }

    // 나머지 부자재
    const band = getSubmaterialPriceBand(item.key);
    if (!band) continue;
    pushLine(item.key, item.name, got.qty, item.unit, band, got.basis, band.등급);
  }

  // 일반경비 — 위 합계에 비율로 붙인다
  const overheadMin = Math.round(sumMin * OVERHEAD_RATE.min);
  const overheadMax = Math.round(sumMax * OVERHEAD_RATE.max);
  breakdown.push({
    key: 'overhead',
    name: '일반경비',
    qty: 1,
    unit: '식',
    unitPriceMin: Math.round(OVERHEAD_RATE.min * 100),
    unitPriceMax: Math.round(OVERHEAD_RATE.max * 100),
    amountMin: overheadMin,
    amountMax: overheadMax,
    note: `자재 + 부자재 + 시공 합계의 ${Math.round(OVERHEAD_RATE.min * 100)}~${Math.round(OVERHEAD_RATE.max * 100)}% · ${OVERHEAD_RATE.출처} (추정)`,
  });
  sumMin += overheadMin;
  sumMax += overheadMax;

  // ── 9) 실별 롤 배분 ──
  const rollAlloc = allocateRolls(
    selected.map((r) => ({ key: r.key, weight: r.wallSqm + (ceiling ? r.ceilingSqm : 0) })),
    rolls,
  );
  const byRoom: RoomQuantity[] = selected.map((r) => ({
    key: r.key,
    name: r.name,
    wallSqm: r1(r.wallSqm),
    ceilingSqm: ceiling ? r1(r.ceilingSqm) : 0,
    rolls: rollAlloc[r.key] ?? 0,
  }));

  // ── 10) 근거 한 줄 ──
  // TODO: 표본 통계(완공 확인 견적 N건)가 붙으면 mode를 '표본'으로 바꾸고 표본 수를 넣는다.
  const costMode: '표본' | '산식' = '산식';
  const regionLabel = input.region ?? '전국';
  const basisLine = `${baseMonthLabel()} 기준 · 산식 · ${regionLabel}`;

  return {
    quantity: {
      rolls,
      wallSqm,
      ceilingSqm,
      perimeterM,
      lossPct: cutting.lossPct,
      lossMode: cutting.lossMode,
      inputMode: dims.mode,
      byRoom,
    },
    submaterials,
    cost: {
      min: roundWon(sumMin),
      mid: roundWon((sumMin + sumMax) / 2),
      max: roundWon(sumMax),
      mode: costMode,
      basisLine,
      breakdown,
    },
  };
}
