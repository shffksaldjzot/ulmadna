// ──────────────────────────────────────────────
// 바닥재 계산기 — 오케스트레이터
//
// 이 파일이 하는 일 (도배 계산기와 같은 흐름):
//   1) 치수 공통 모듈로 실별 치수(RoomDims[])를 받는다
//      평형으로 → 62건 비율표로 추정 / 실측으로 → 방마다 가로·세로
//   2) 욕실·현관을 빼고, 평형 모드면 바닥 합계를 코어 엔진 값(마루+타일 바닥)에 맞춰 정규화한다
//   3) 시공 범위(전체 / 방만 / 거실·주방)로 방을 추린다
//   4) 재단 모듈로 수량과 로스를 뽑는다 (마루·데코타일 = 깔아보기 / 장판 = 방향 비교)
//   5) 공정 스키마를 돌려 부자재 물량을 자동 산출한다
//   6) 인건 모듈로 품수를 구한다
//   7) 서버 단가를 곱해 소비자가 범위를 만든다
//
// 내보내는 것: 물량 · 부자재 · 소비자가 범위 · 물량 근거 문장.
// 내보내지 않는 것: 업자가, 단가 출처 문서명, 산식 내부값.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import 'server-only';

import { calculateQuantity } from '@/app/v3/data/quantity';
import type { BayKey } from '@/app/v3/data/types';

import { calcSheet } from './cutting/sheet';
import type { RoomRect, SheetSpec } from './cutting/sheet';
import { calcRollFloor } from './cutting/rollFloor';
import type { CuttingResult, LossMode } from './cutting/types';
import { resolveDimensions } from './dimensions';
import type { RoomDims } from './dimensions';
import { calcFlooringLabor } from './labor-flooring';
import { buildFlooringContext, runFlooringSchema, FLOORING_PROCESS } from './schema/flooring';
import type { EvidenceGrade } from './schema/types';
import {
  KIND_DEFAULT_LOSS,
  HERRINGBONE_LOSS,
  ROLL_CUT_MARGIN_M,
  REUSE_MIN_MM,
  DEFAULT_MARU_SPEC,
  DEFAULT_DECO_SPEC,
  DEFAULT_ROLL_WIDTH_M,
  DEFAULT_ROLL_THICKNESS_MM,
  SQM_PER_PYEONG,
  type FlooringKind,
} from './schema/flooring-coefficients';
import {
  PYEONG_TO_EXCLUSIVE_SQM,
  EXCLUSIVE_RATIO,
} from './schema/wallpaper-coefficients';
import {
  getFlooringMaterialBand,
  getFlooringSubmaterialBand,
  getFlooringRemovalBand,
  getFlooringDailyWageBand,
  FLOORING_WASTE_PRICE,
  OVERHEAD_RATE,
  type FlooringDirectProduct,
  type PriceBand,
} from '../pricing/flooring';

// ── 입력 타입 ──────────────────────────────────

/** 바닥재 계산기가 쓰는 입력 방식 (면적 직접 입력은 안 받는다) */
export type FlooringMode = '평형' | '실측';

/** 시공 범위 — 전체 / 방만 / 거실·주방 */
export type FlooringScope = '전체' | '방만' | '거실주방';

/** 실측 모드에서 방 하나를 적는 칸 (높이·문·창은 안 받는다 — 바닥은 필요 없다) */
export interface FlooringRoomInput {
  name: string;
  widthM: number;
  depthM: number;
}

/** 바닥재 계산 입력 */
export interface FlooringCalcInput {
  /** 입력 방식. 기본 평형 */
  mode?: FlooringMode;
  /** 평형 모드: 공급 평형 */
  pyeong?: number;
  /** 평형 모드: 베이 수 (2 / 3 / 4). 기본 3 */
  bay?: 2 | 3 | 4;
  /** 실측 모드: 방 목록 */
  rooms?: FlooringRoomInput[];
  /** 시공 범위. 기본 전체 (욕실·현관은 항상 제외) */
  scope?: FlooringScope;
  /** 바닥재 종류 */
  kind: FlooringKind;
  /** 제품 마스터에서 고른 값 또는 직접 입력. 없으면 종류 평균가 */
  product?: FlooringDirectProduct;
  /** 기존 바닥재 철거 포함. 기본 true (견적은 구축 기준) */
  removeOld?: boolean;
  /** 걸레받이 교체 포함. 기본 true */
  baseboard?: boolean;
}

// ── 출력 타입 ──────────────────────────────────

/** 실별 물량 한 줄 */
export interface FlooringRoomQuantity {
  key: string;
  name: string;
  /** 이 방의 바닥 면적 (㎡) */
  floorSqm: number;
  /** 이 방에 배분된 수량 (박스 또는 m) */
  units: number;
}

/** 부자재 한 줄 */
export interface FlooringSubmaterialLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  /** 물량 산출 근거 문장 */
  basis: string;
  /** 근거 등급 (C면 화면에 "추정" 표기) */
  grade: EvidenceGrade;
}

/** 비용 구성 한 줄 */
export interface FlooringCostLine {
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
  /** 물량 근거 한 토막 (단가 출처·문서명은 넣지 않는다) */
  note: string;
}

/** 바닥재 계산 결과 */
export interface FlooringCalcResult {
  quantity: {
    /** 수량 단위 — 마루·데코타일은 박스, 장판은 m */
    unit: '박스' | 'm';
    /** 사야 하는 수량 */
    units: number;
    /** 박스형이면 사게 되는 총 장 수 */
    pieces?: number;
    /** 바닥 시공 면적 (㎡) */
    floorSqm: number;
    /** 시공 대상 방들의 둘레 합계 (m) — 걸레받이 근거 */
    perimeterM: number;
    /** 로스율 (%) */
    lossPct: number;
    /** 로스를 어떻게 구했는지 */
    lossMode: LossMode;
    /** 어떤 입력 방식으로 치수를 잡았는지 */
    inputMode: FlooringMode;
    /** 실별 보기 */
    byRoom: FlooringRoomQuantity[];
  };
  submaterials: FlooringSubmaterialLine[];
  cost: {
    min: number;
    mid: number;
    max: number;
    /** 표본 통계로 냈는지, 산식으로 냈는지 */
    mode: '표본' | '산식';
    /** 결과 화면 근거 한 줄 */
    basisLine: string;
    breakdown: FlooringCostLine[];
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

/** 욕실·현관은 바닥재 공정 대상이 아니라 항상 뺀다 */
const ALWAYS_EXCLUDED_KEYS = ['bath1', 'bath2', 'entrance'];

/** "방만" 범위에 들어가는 방 키 */
const ROOM_ONLY_KEYS = ['master', 'bed2', 'bed3'];
/**
 * "거실·주방" 범위에 들어가는 방 키.
 * 평형 모드에서는 living 하나가 거실+주방이고, 복도·기타(etc)도 같이 깐다.
 * → 화면(U) 라벨은 "거실·주방·복도"로 맞춘다. 엔진 쪽 키는 바꾸지 않는다.
 */
const LIVING_SCOPE_KEYS = ['living', 'kitchen', 'etc'];

/**
 * 시공 범위를 방 키 목록으로 바꾼다.
 *
 * ⚠️ 평형 모드에서만 부른다 (2026-09-10 검사관 지적).
 *    실측 모드는 사용자가 방 이름을 "방1 · 방2"처럼 아무렇게나 적을 수 있어서
 *    키가 room1 / bed2 / bed3 로 섞인다. 그러면 "방만"이 방 하나를 통째로 빼먹거나
 *    "거실주방"이 아무것도 못 골라 전체로 되돌아가는, 사용자가 눈치채기 어려운 사고가 난다.
 *    그래서 실측 모드는 아예 범위를 적용하지 않고 적어 준 방을 전부 계산한다
 *    (사용자가 "이 방들만 재겠다"고 이미 방을 골라서 적은 셈이라 그게 맞다).
 */
function resolveScopeKeys(scope: FlooringScope, allKeys: string[]): string[] {
  if (scope === '전체') return allKeys;
  const want = scope === '방만' ? ROOM_ONLY_KEYS : LIVING_SCOPE_KEYS;
  const picked = allKeys.filter((k) => want.includes(k));
  return picked.length > 0 ? picked : allKeys;
}

/**
 * 코어 엔진(62건 비율표)이 말하는 "그 평형의 바닥 면적"을 가져온다.
 * 평형 모드에서 실별 면적 합계를 이 값에 맞춰 정규화한다 — 도배가 벽 면적에 한 방식과 같다.
 */
function engineFloorSqm(pyeong: number, bay: 2 | 3 | 4): number {
  const exclusiveSqm =
    PYEONG_TO_EXCLUSIVE_SQM[Math.round(pyeong)] ??
    r1(pyeong * SQM_PER_PYEONG * EXCLUSIVE_RATIO.value);
  const q = calculateQuantity(exclusiveSqm, { bay: String(bay) as BayKey });
  // 마루 바닥 + 타일 바닥 = 욕실을 뺀 집 전체 바닥
  return q.quantities.floor_wood + q.quantities.floor_tile;
}

/**
 * 박스처럼 쪼갤 수 없는 수량을 실별로 나눈다.
 * 면적 비율로 나눈 뒤, 소수점 때문에 모자란 만큼을 소수부가 큰 방부터 하나씩 더 준다.
 */
function allocateWhole(rooms: { key: string; weight: number }[], total: number): Record<string, number> {
  const sum = rooms.reduce((s, r) => s + r.weight, 0);
  const out: Record<string, number> = {};
  if (sum <= 0 || total <= 0) {
    for (const r of rooms) out[r.key] = 0;
    return out;
  }
  const exact = rooms.map((r) => ({ key: r.key, v: (r.weight / sum) * total }));
  let used = 0;
  for (const e of exact) {
    const floor = Math.floor(e.v);
    out[e.key] = floor;
    used += floor;
  }
  const remain = Math.round(total - used);
  const sorted = [...exact].sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)));
  for (let i = 0; i < remain; i += 1) {
    out[sorted[i % sorted.length].key] += 1;
  }
  return out;
}

/** m 처럼 쪼갤 수 있는 수량을 실별로 나눈다 (소수 1자리) */
function allocateDecimal(rooms: { key: string; weight: number }[], total: number): Record<string, number> {
  const sum = rooms.reduce((s, r) => s + r.weight, 0);
  const out: Record<string, number> = {};
  for (const r of rooms) out[r.key] = sum > 0 ? r1((r.weight / sum) * total) : 0;
  return out;
}

/** 오늘 기준 "2026.9" 같은 표기를 만든다 */
function baseMonthLabel(now: Date = new Date()): string {
  return `${now.getFullYear()}.${now.getMonth() + 1}`;
}

/**
 * 물량 근거(basis)에 등급 꼬리표를 붙여 "구성 보기" note 로 만든다.
 * 등급이 C(추정)면 " · 추정"을 붙이되, 이미 "추정"이 들어 있으면 두 번 붙이지 않는다.
 * ⚠️ 여기 note 에는 단가 출처·문서명·산식을 절대 넣지 않는다(단가·산식 보호 규칙).
 */
function noteFor(basis: string, grade: EvidenceGrade): string {
  if (grade !== 'C') return basis;
  return basis.includes('추정') ? basis : `${basis} · 추정`;
}

// ── 본체 ──────────────────────────────────────

/**
 * 바닥재 계산기 본체.
 * 입력 한 번으로 치수 → 물량 → 부자재 → 인건 → 비용까지 한 번에 돌린다.
 */
export function calcFlooring(input: FlooringCalcInput): FlooringCalcResult {
  // ── 0) 입력 기본값 정리 ──
  const mode: FlooringMode = input.mode ?? '평형';
  const scope: FlooringScope = input.scope ?? '전체';
  const kind: FlooringKind = input.kind;
  const removeOld = input.removeOld ?? true; // 견적은 구축 기준이라 기본 켬
  const baseboardOn = input.baseboard ?? true;
  const bay = input.bay ?? 3;

  // ── 1) 치수 공통 모듈 ──
  const dims = resolveDimensions({
    mode,
    pyeong: input.pyeong,
    bay,
    // 실측 방은 이름·가로·세로만 넘긴다 (바닥은 높이·개구부가 필요 없다)
    rooms: input.rooms?.map((r) => ({ name: r.name, widthM: r.widthM, depthM: r.depthM })),
  });

  // ── 2) 욕실·현관 제외 + 평형 모드 바닥 합계 정규화 ──
  const targetRooms = dims.rooms.filter((r) => !ALWAYS_EXCLUDED_KEYS.includes(r.key));

  let normalized: RoomDims[] = targetRooms;
  if (mode === '평형') {
    // 코어 엔진의 바닥 총량이 최종 권위. 비율표 실별 면적을 그 합계에 맞춰 늘리거나 줄인다.
    const engineTotal = engineFloorSqm(input.pyeong ?? 34, bay);
    const ratioSum = targetRooms.reduce((s, r) => s + r.floorSqm, 0);
    const scale = ratioSum > 0 ? engineTotal / ratioSum : 1;

    // 길이(가로·세로·둘레)에 쓰는 배율은 면적 배율의 제곱근이다.
    // 방을 1.1배 넓히면 가로·세로는 각각 약 1.05배가 되기 때문이다.
    // (2026-09-10 검사관 지적: 예전엔 둘레만 정규화를 안 따라가서 면적과 어긋났다)
    const shape = Math.sqrt(scale);

    normalized = targetRooms.map((r) => {
      const floorSqm = r1(r.floorSqm * scale);
      return {
        ...r,
        floorSqm,
        ceilingSqm: floorSqm,
        widthM: r1(r.widthM * shape),
        depthM: r1(r.depthM * shape),
        // 둘레도 같은 길이 배율을 쓴다 (걸레받이·씰란트 물량 근거)
        perimeterM: r1(r.perimeterM * shape),
      };
    });
  }

  // ── 3) 시공 범위 적용 (평형 모드만) ──
  // 실측 모드는 사용자가 적어 준 방이 곧 시공 범위라 scope 를 적용하지 않는다.
  // (방 이름을 "방1 · 방2"로 적으면 키를 못 알아봐서 엉뚱한 방이 빠지기 때문 — 검사관 지적)
  const allKeys = normalized.map((r) => r.key);
  const scopeKeys = mode === '실측' ? allKeys : resolveScopeKeys(scope, allKeys);
  const selected = normalized.filter((r) => scopeKeys.includes(r.key));

  const floorSqm = r1(selected.reduce((s, r) => s + r.floorSqm, 0));
  const perimeterM = r1(selected.reduce((s, r) => s + r.perimeterM, 0));
  const workPyeong = floorSqm / SQM_PER_PYEONG;

  // 둘레가 실측인지 추정인지 (근거 문장에 표기)
  const perimeterIsMeasured = selected.length > 0 && selected.every((r) => !r.estimated);

  // 재단 모듈에 넘길 방 모양 목록 (가로 × 세로)
  const rects: RoomRect[] = selected.map((r) => ({
    name: r.name,
    widthM: r.widthM,
    lengthM: r.depthM,
  }));

  // ── 4) 재단 ──
  const isRoll = kind === '장판';
  // 제품 초기 로스율이 헤링본 수준(12%)이면 헤링본 시공으로 본다 — 인건 배율에 쓴다
  const lossRate = input.product?.lossRate ?? KIND_DEFAULT_LOSS[kind].value;
  const isHerringbone = kind === '마루' && lossRate >= HERRINGBONE_LOSS.value;

  let cutting: CuttingResult;
  if (isRoll) {
    // 장판 — 평형 모드에서도 추정 방 치수로 방향을 비교한다. 다만 꼬리표는 "추정".
    cutting = calcRollFloor({
      floorSqm,
      rooms: rects,
      spec: {
        widthM: input.product?.rollWidthM ?? DEFAULT_ROLL_WIDTH_M.value,
        thicknessMm: input.product?.thicknessMm ?? DEFAULT_ROLL_THICKNESS_MM.value,
      },
      cutMarginM: ROLL_CUT_MARGIN_M.value,
      lossModeLabel: mode === '평형' ? '추정' : undefined,
    });
  } else {
    // 마루·데코타일 — 실측일 때만 실제로 깔아 본다
    const base = kind === '마루' ? DEFAULT_MARU_SPEC : DEFAULT_DECO_SPEC;
    const p = input.product;
    const spec: SheetSpec = p?.sqmPerBox
      ? {
          widthMm: p.widthMm ?? base.widthMm,
          lengthMm: p.lengthMm ?? base.lengthMm,
          // 박스당 장 수를 모르면 0 을 넣어 면적 방식으로 폴백시킨다
          piecesPerBox: p.pcsPerBox ?? 0,
          sqmPerBox: p.sqmPerBox,
        }
      : {
          widthMm: p?.widthMm ?? base.widthMm,
          lengthMm: p?.lengthMm ?? base.lengthMm,
          piecesPerBox: p?.pcsPerBox ?? base.pcsPerBox,
          sqmPerBox: base.sqmPerBox,
        };

    cutting = calcSheet({
      floorSqm,
      rooms: mode === '실측' ? rects : undefined,
      spec,
      reuseMinMm: REUSE_MIN_MM.value,
      lossRate,
    });
  }

  const units = cutting.units;
  const unitName: '박스' | 'm' = isRoll ? 'm' : '박스';
  const pieces = !isRoll && cutting.detail?.pieces ? cutting.detail.pieces : undefined;
  const seamM = isRoll ? (cutting.detail?.seamM ?? 0) : 0;

  // ── 5) 인건 ──
  const labor = calcFlooringLabor({ floorSqm, kind, isHerringbone });

  // ── 6) 공정 스키마 실행 → 항목별 물량 ──
  const ctx = buildFlooringContext({
    floorSqm,
    perimeterM,
    workPyeong,
    units,
    seamM,
    laborManDays: labor.manDays,
    kind,
    removeOld,
    baseboard: baseboardOn,
    perimeterIsMeasured,
  });
  const schemaQty = runFlooringSchema(ctx);

  // ── 7) 부자재 목록 만들기 ──
  const submaterials: FlooringSubmaterialLine[] = [];
  for (const item of FLOORING_PROCESS.items) {
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
  const breakdown: FlooringCostLine[] = [];
  let sumMin = 0;
  let sumMax = 0;

  /** 구성 보기에 한 줄 추가한다. note 는 부르는 쪽에서 이미 완성해서 넘긴다 */
  const pushLine = (
    key: string, name: string, qty: number, unit: string, band: PriceBand, note: string,
  ) => {
    const amountMin = Math.round(qty * band.min);
    const amountMax = Math.round(qty * band.max);
    sumMin += amountMin;
    sumMax += amountMax;
    breakdown.push({
      key, name, qty, unit,
      unitPriceMin: band.min,
      unitPriceMax: band.max,
      amountMin, amountMax, note,
    });
  };

  for (const item of FLOORING_PROCESS.items) {
    const got = schemaQty[item.key];
    if (!got) continue;

    if (item.key === 'material') {
      // 자재 — 제품을 골랐으면 그 가격, 아니면 종류 평균가.
      // note 는 제품 이름 / "직접 입력" / "종류 평균가" 중 하나만 (단가는 안 나간다).
      const band = getFlooringMaterialBand(kind, input.product);
      const note = input.product?.sourceLabel ?? (input.product ? '직접 입력' : '종류 평균가');
      pushLine(item.key, kind, got.qty, unitName, band, note);
      continue;
    }

    if (item.key === 'removal') {
      // 기존 바닥재 철거 — 새로 까는 종류와 같은 바닥재를 걷어 낸다고 본다
      pushLine(item.key, item.name, got.qty, item.unit, getFlooringRemovalBand(kind),
        noteFor(got.basis, item.evidenceGrade));
      continue;
    }

    if (item.key === 'waste') {
      pushLine(item.key, item.name, got.qty, item.unit, FLOORING_WASTE_PRICE,
        noteFor(got.basis, item.evidenceGrade));
      continue;
    }

    if (item.key === 'labor') {
      // 시공 — note 는 품수·조 일수만 (평당 단가·산식은 서버 안에만 둔다)
      const note = `바닥 시공 ${labor.manDays}품 · 2인 1조 약 ${labor.teamDays}일`;
      pushLine(item.key, item.name, got.qty, item.unit, getFlooringDailyWageBand(), note);
      continue;
    }

    if (item.key === 'overhead') {
      // 경비는 다른 줄 합계가 필요하므로 마지막에 따로 계산한다
      continue;
    }

    // 나머지 부자재·걸레받이 — note 는 물량 계수 근거만
    const band = getFlooringSubmaterialBand(item.key);
    if (!band) continue;
    pushLine(item.key, item.name, got.qty, item.unit, band, noteFor(got.basis, item.evidenceGrade));
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
    note: `자재·부자재·시공 합계의 ${Math.round(OVERHEAD_RATE.min * 100)}~${Math.round(OVERHEAD_RATE.max * 100)}%`,
  });
  sumMin += overheadMin;
  sumMax += overheadMax;

  // ── 9) 실별 수량 배분 ──
  const weights = selected.map((r) => ({ key: r.key, weight: r.floorSqm }));
  const alloc = isRoll ? allocateDecimal(weights, units) : allocateWhole(weights, units);
  const byRoom: FlooringRoomQuantity[] = selected.map((r) => ({
    key: r.key,
    name: r.name,
    floorSqm: r1(r.floorSqm),
    units: alloc[r.key] ?? 0,
  }));

  // ── 10) 근거 한 줄 ──
  // TODO: 완공 확인 견적 표본이 쌓이면 mode 를 '표본'으로 바꾸고 표본 수를 넣는다.
  const basisLine = `${baseMonthLabel()} 기준 · 산식 · 수도권 기준`;

  return {
    quantity: {
      unit: unitName,
      units,
      pieces,
      floorSqm,
      perimeterM,
      lossPct: cutting.lossPct,
      lossMode: cutting.lossMode,
      inputMode: mode,
      byRoom,
    },
    submaterials,
    cost: {
      min: roundWon(sumMin),
      mid: roundWon((sumMin + sumMax) / 2),
      max: roundWon(sumMax),
      mode: '산식',
      basisLine,
      breakdown,
    },
  };
}
