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
// 2026년 09월 27일: 좁혀가기 — 제품 없이 종류만 오면 그 종류의 노출 제품 전체로 금액 범위를 만든다
//   (calcWallpaperTypeRange). 제품이 있는 계산은 예전 본체(calcWallpaperOne) 그대로다.
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
// 제품 미정일 때 "그 종류의 노출 제품 전체"로 범위를 만들기 위한 제품 마스터와 변환 함수.
// 변환 함수는 화면(브라우저)도 쓰는 순수 함수라 src/lib/v1 에 있다 — 서버가 lib을 불러오는 건
// 괜찮다(반대 방향, 즉 브라우저 쪽이 src/server를 불러오는 것만 금지).
import { WALLPAPER_PRODUCTS } from './data/wallpaper-products';
import { toWallpaperProductOptions, isShowableWallpaperProduct } from '@/lib/v1/wallpaperProductOptions';
import { productOptionToRequest } from '@/lib/v1/wallpaperEngineInput';

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
  /**
   * 전용면적(㎡) 직접 입력. 2026-09-15 형아 지시(㎡ 모드) — 있으면 pyeong 환산표를
   * 거치지 않고 이 값을 그대로 전용면적으로 쓴다(pyeong과 동시에 오면 이 값이 우선).
   */
  exclusiveSqm?: number;
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
  /** 벽 포함 여부. 기본 켬. 끄면 "천장만" 계산 (2026-09-09 형아 지시: 벽·천장 각각 토글) */
  wall?: boolean;
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
    /**
     * (2026-09-27 추가) 제품을 안 골라 "종류 전체 범위"로 계산했을 때만 붙는다.
     * 노출 제품마다 롤 폭·길이가 달라(예: 합지 소폭 53cm vs 장폭 93cm) 롤 수가 제품에 따라 달라지므로,
     * 가장 적게 드는 제품 ~ 가장 많이 드는 제품의 롤 수를 알려 준다.
     * 위 rolls 칸은 그 종류의 대표 규격(광폭) 기준 롤 수다.
     */
    rollsRange?: { min: number; max: number };
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

/**
 * 근거 문장(basis)에 등급 꼬리표를 붙여 "구성 보기" note로 만든다.
 * 등급이 C(추정)면 " · 추정"을 붙이되, basis에 이미 "추정"이 들어 있으면(예: 부자재
 * 계수 자체가 "· 추정"을 포함) 중복으로 붙이지 않는다(검사관 지적 — "추정 · 추정" 방지).
 * ⚠️ 여기 basis는 물량 산출 계수(예: "0.02kg/㎡")만 담고, 내부 문서명·단가 출처·업자가
 *    밴드 문장은 절대 넣지 않는다(단가·산식 보호 규칙).
 */
function noteFor(basis: string, grade: EvidenceGrade): string {
  if (grade !== 'C') return basis;
  return basis.includes('추정') ? basis : `${basis} · 추정`;
}

// ── 본체 ──────────────────────────────────────

/**
 * 도배 계산기 입구.
 *
 * 2026-09-27 좁혀가기(형아 결정)로 두 갈래가 됐다.
 *   1) 제품이 있으면(목록에서 골랐거나 직접 입력) → 예전과 똑같이 한 번 계산(calcWallpaperOne).
 *      완전한 입력의 계산 결과 숫자는 이 작업 전과 한 푼도 다르지 않다.
 *   2) 제품이 없으면(벽지 종류만 골랐거나 "아직 안 정했어요") → 그 종류의 **노출 제품 전체**로
 *      한 번씩 계산해서, 가장 싼 결과의 아래쪽 ~ 가장 비싼 결과의 위쪽을 금액 범위로 돌려준다
 *      (calcWallpaperTypeRange). 그래서 나중에 어떤 노출 제품을 골라도 범위는 좁아지거나 같다.
 *      노출 제품이 하나도 없는 종류면(지금은 없음) 예전처럼 종류 평균 단가 밴드로 한 번 계산한다.
 */
export function calcWallpaper(input: WallpaperCalcInput): WallpaperCalcResult {
  // 제품이 정해졌으면 그 제품 하나로 계산 — 예전 동작 그대로
  if (input.product) return calcWallpaperOne(input);
  // 제품 미정 — 종류 전체 범위
  return calcWallpaperTypeRange(input);
}

/**
 * 벽지 종류 하나의 "노출 제품"(화면 제품 목록에 뜨는 제품) 전부를 서버 계산 입력 모양으로 돌려준다.
 * 화면이 제품을 골랐을 때 보내는 값과 **완전히 같은 변환 함수**(toWallpaperProductOptions →
 * isShowableWallpaperProduct → productOptionToRequest)를 거친다. 그래야 "제품을 골랐더니 범위가
 * 종류 전체 범위 밖으로 나갔다"가 구조적으로 생기지 않는다.
 */
export function exposedWallpaperProducts(paperType: PaperType): DirectProduct[] {
  const out: DirectProduct[] = [];
  for (const option of toWallpaperProductOptions(WALLPAPER_PRODUCTS)) {
    // 다른 종류이거나 목록에 안 뜨는 제품(검수 대기·규격 미확인)은 뺀다
    if (option.kind !== paperType || !isShowableWallpaperProduct(option)) continue;
    const request = productOptionToRequest(option);
    if (request) out.push(request);
  }
  return out;
}

/**
 * 제품 미정일 때 — 그 종류의 노출 제품 전체로 금액 범위를 만든다.
 *
 * 하는 일:
 *   1) 노출 제품마다 한 번씩 계산한다(제품 수만큼. 지금 합지 8개·실크 20개 안팎, 한 번에 수 밀리초)
 *   2) 금액: 가장 낮은 최저값을 낸 제품(lo)의 최저 ~ 가장 높은 최고값을 낸 제품(hi)의 최고
 *   3) 물량(면적·롤·부자재): 그 종류의 대표 규격(광폭)으로 한 번 더 계산한 값을 보여준다.
 *      롤 수는 제품 폭에 따라 달라지므로 quantity.rollsRange에 제품별 최소~최대 롤 수를 따로 싣는다.
 *   4) 구성 보기: 줄마다 최저 금액은 lo 제품의 그 줄, 최고 금액은 hi 제품의 그 줄을 쓴다.
 *      → 줄 금액을 더하면 결과 최저·최고와 정확히 맞는다(모든 줄이 같은 두 제품에서 오므로).
 *
 * ⚠️ 응답에 나가는 건 합쳐진 금액·물량뿐이다. 제품 이름·개별 제품 단가·산식은 싣지 않는다.
 *    (줄별 단가 범위 unitPriceMin~Max는 제품을 골랐을 때도 원래 나가던 값이라 새로 드러나는 것이 없다)
 */
function calcWallpaperTypeRange(input: WallpaperCalcInput): WallpaperCalcResult {
  const paperType: PaperType = input.paperType ?? '실크';
  const candidates = exposedWallpaperProducts(paperType);

  // 대표 규격(종류 기본 광폭 규격)으로 한 번 — 물량 표시용. 노출 제품이 없으면 이 결과를 그대로 쓴다(옛 평균가 방식)
  const representative = calcWallpaperOne(input);
  if (candidates.length === 0) return representative;

  // 노출 제품마다 한 번씩 계산
  const each = candidates.map((product) => calcWallpaperOne({ ...input, product }));

  // 최저를 낸 제품(lo)과 최고를 낸 제품(hi)을 고른다. 같은 값이면 먼저 나온 제품
  let lo = each[0];
  let hi = each[0];
  for (const r of each) {
    if (r.cost.min < lo.cost.min) lo = r;
    if (r.cost.max > hi.cost.max) hi = r;
  }

  /** 어떤 결과에서 키가 같은 구성 줄을 찾는다 */
  const lineOf = (r: WallpaperCalcResult, key: string) => r.cost.breakdown.find((b) => b.key === key);

  // 시공 품수가 제품에 따라 달라지는지(디아망급 고급 실크는 품이 조금 더 든다) 확인해 문구에 반영
  const laborQtys = each.map((r) => lineOf(r, 'labor')?.qty).filter((q): q is number => q != null);
  const laborMin = laborQtys.length ? Math.min(...laborQtys) : 0;
  const laborMax = laborQtys.length ? Math.max(...laborQtys) : 0;

  // 구성 보기 — 줄 순서와 수량은 대표 계산을 따르고, 금액은 lo·hi 제품에서 가져온다
  const breakdown: CostLine[] = representative.cost.breakdown.map((line) => {
    const loLine = lineOf(lo, line.key) ?? line;
    const hiLine = lineOf(hi, line.key) ?? line;
    // 단가 범위: 모든 노출 제품의 그 줄 단가 중 가장 낮은 값 ~ 가장 높은 값
    const lines = each.map((r) => lineOf(r, line.key)).filter((l): l is CostLine => l != null);
    const unitPriceMin = lines.length ? Math.min(...lines.map((l) => l.unitPriceMin)) : line.unitPriceMin;
    const unitPriceMax = lines.length ? Math.max(...lines.map((l) => l.unitPriceMax)) : line.unitPriceMax;

    // 근거 문구: 벽지 줄은 "제품 미정"을 밝히고, 시공 줄은 품수가 갈리면 범위로 적는다
    let note = line.note;
    if (line.key === 'wallpaper') note = '제품 미정 · 목록 제품 전체 범위';
    if (line.key === 'labor' && laborMin !== laborMax) note = `도배공 ${laborMin}~${laborMax}품 · 제품에 따라 다름`;

    return {
      ...line,
      unitPriceMin,
      unitPriceMax,
      amountMin: loLine.amountMin,
      amountMax: hiLine.amountMax,
      note,
    };
  });

  // 롤 수 범위 — 제품 폭·길이에 따라 달라진다
  const rollsList = each.map((r) => r.quantity.rolls);
  const min = lo.cost.min;
  const max = hi.cost.max;

  return {
    quantity: {
      ...representative.quantity,
      rollsRange: { min: Math.min(...rollsList), max: Math.max(...rollsList) },
    },
    submaterials: representative.submaterials,
    cost: {
      min,
      // 중간값은 두 끝의 가운데(1,000원 단위 반올림)
      mid: roundWon((min + max) / 2),
      max,
      mode: representative.cost.mode,
      basisLine: representative.cost.basisLine,
      breakdown,
    },
  };
}

/**
 * 도배 계산 한 번(제품 하나 또는 종류 평균 밴드).
 * 입력 한 번으로 치수 → 물량 → 부자재 → 인건 → 비용까지 한 번에 돌린다.
 * (2026-09-27 전까지 calcWallpaper라는 이름이던 본체 그대로 — 계산 내용은 한 줄도 안 바꿨다)
 */
function calcWallpaperOne(input: WallpaperCalcInput): WallpaperCalcResult {
  // ── 0) 입력 기본값 정리 ──
  const mode: DimensionMode = input.mode ?? '평형';
  const scope: WallpaperScope = input.scope ?? '전체';
  const wall = input.wall ?? true;
  const ceiling = input.ceiling ?? true;
  const paperType: PaperType = input.paperType ?? '실크';
  const isOld = input.isOld ?? false;
  const removeOld = input.removeOld ?? isOld; // 구축이면 기본으로 제거 포함

  // ── 1) 치수 공통 모듈 (평형 / 실측 / 면적을 같은 모양으로 받아 온다) ──
  const dims = resolveDimensions({
    mode,
    pyeong: input.pyeong,
    exclusiveSqm: input.exclusiveSqm,
    bay: input.bay,
    rooms: input.rooms,
    heightM: input.heightM,
    areas: input.areas,
  });

  // ── 2) 시공 범위 적용 ──
  const allKeys = dims.rooms.map((r) => r.key);
  const scopeKeys = resolveScopeKeys(scope, allKeys);
  const selected: RoomDims[] = dims.rooms.filter((r) => scopeKeys.includes(r.key));

  // 벽을 끄면(천장만) 벽 면적을 0으로 — 부직포·본드처럼 벽 면적에 붙는 부자재도 자연히 빠진다
  const wallSqm = wall ? r1(selected.reduce((s, r) => s + r.wallSqm, 0)) : 0;
  const ceilingSqm = ceiling ? r1(selected.reduce((s, r) => s + r.ceilingSqm, 0)) : 0;
  const totalSqm = r1(wallSqm + ceilingSqm);
  const perimeterM = r1(selected.reduce((s, r) => s + r.perimeterM, 0));


  // ── 3) 벽지 규격 정하기 (제품 직접 입력이 있으면 그 규격) ──
  const spec: RollSpec = input.product
    ? {
        widthCm: input.product.widthCm,
        lengthM: input.product.lengthM,
        repeatCm: input.product.repeatCm ?? 0,
        sqmPerRoll: r1((input.product.widthCm / 100) * input.product.lengthM),
        // 제품 마스터에서 고른 제품이면 그 출처 문구를, 순수 직접 입력이면 기본 문구를 쓴다
        source: input.product.sourceLabel ?? '사용자 직접 입력 규격',
      }
    : DEFAULT_ROLL_SPEC[paperType];

  // ── 4) 재단 ──
  // 실측 치수가 있으면 실제로 잘라 보고, 없으면 표준품셈 할증으로 추정한다.
  // 면적 직접 입력은 계산 방식과 무관하게 꼬리표를 "면적"으로 붙인다.
  const cutting: CuttingResult = calcRollWall({
    wallSqm,
    ceilingSqm,
    spec,
    // 벽을 끈 천장만 계산은 벽 폭 재단이 의미 없으니 면적 추정 방식으로 돌린다
    measured: dims.canRealCut && wall ? { wallHeightM: dims.heightM, perimeterM } : undefined,
    lossModeLabel: mode === '면적' ? '면적' : undefined,
  });
  const rolls = cutting.units;

  // 둘레가 실측인지 추정인지 (부자재 근거 문장에 표기)
  const perimeterIsMeasured = selected.length > 0 && selected.every((r) => !r.estimated);

  // ── 5) 인건 ──
  // 벽·천장 면적은 이미 시공 범위와 천장 포함 여부가 반영된 값이다
  const labor = calcLabor({
    wallSqm,
    ceilingSqm,
    paperType,
    isOld,
    rollPrice: input.product?.rollPrice,
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

  /**
   * 구성 보기에 한 줄 추가하는 도우미.
   * note는 호출한 쪽에서 이미 완성해서 넘긴다 — 단가 밴드의 내부 출처 문장(band.출처, 도메인
   * 문서명 등)은 여기서도, 어디서도 응답에 넣지 않는다(단가·산식 보호 규칙, 검사관 지적).
   */
  const pushLine = (key: string, name: string, qty: number, unit: string, band: PriceBand, note: string) => {
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
      note,
    });
  };

  for (const item of WALLPAPER_PROCESS.items) {
    const got = schemaQty[item.key];
    if (!got) continue;

    if (item.key === 'wallpaper') {
      // 벽지 — 제품 직접 입력이 있으면 그 가격.
      // note: 제품 출처(sourceLabel)가 있으면 그것 / 제품은 있는데 출처가 없으면(사용자가 롤당
      // 가격을 직접 타이핑한 경우) "직접 입력"("평균가"라고 하면 틀린 말이라 구분) / 제품 자체가
      // 없으면(종류만 고름) "종류 평균가"
      const band = getWallpaperRollPriceBand(paperType, input.product);
      const note = input.product?.sourceLabel ?? (input.product ? '직접 입력' : '종류 평균가');
      pushLine(item.key, `${paperType} 벽지`, got.qty, item.unit, band, note);
      continue;
    }

    if (item.key === 'labor') {
      // 시공 — 지역별 일당. note는 품수 산식 문장(labor.basis) 대신 결과 품수·조 일수만 보여준다
      const band = getDailyWageBand(input.region);
      const note = `도배공 ${labor.manDays}품 · 2인 1조 약 ${labor.teamDays}일`;
      pushLine(item.key, item.name, got.qty, item.unit, band, note);
      continue;
    }

    if (item.key === 'removal') {
      // 기존 벽지 제거 — "추정" 여부는 물량 근거 등급(item.evidenceGrade) 기준(검사관 지적 N7,
      // 아래 부자재와 같은 이유: 단가 밴드 등급과 물량 계수 등급은 서로 다른 걸 재는 값이다)
      pushLine(item.key, item.name, got.qty, item.unit, REMOVAL_PRICE_PER_SQM, noteFor(got.basis, item.evidenceGrade));
      continue;
    }

    if (item.key === 'overhead') {
      // 경비는 마지막에 따로 계산한다 (다른 줄 합계가 필요하므로)
      continue;
    }

    // 나머지 부자재 — note는 물량 계수 근거(basis)만, 단가 출처는 안 붙인다.
    // "추정" 여부는 단가 밴드 등급(band.등급, 전부 C)이 아니라 물량 근거 등급(item.evidenceGrade)으로
    // 판단한다 — 부자재 카드(SubmaterialLine.grade)도 item.evidenceGrade를 쓰므로 두 카드의
    // "추정" 표기 기준이 이제 하나로 맞는다(검사관 지적 N7).
    const band = getSubmaterialPriceBand(item.key);
    if (!band) continue;
    pushLine(item.key, item.name, got.qty, item.unit, band, noteFor(got.basis, item.evidenceGrade));
  }

  // 일반경비 — 위 합계에 비율로 붙인다. note는 경비율 문구까지만(출처 문서·추정 꼬리표는 안 붙인다)
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

  // ── 9) 실별 롤 배분 ──
  const rollAlloc = allocateRolls(
    selected.map((r) => ({ key: r.key, weight: (wall ? r.wallSqm : 0) + (ceiling ? r.ceilingSqm : 0) })),
    rolls,
  );
  const byRoom: RoomQuantity[] = selected.map((r) => ({
    key: r.key,
    name: r.name,
    wallSqm: wall ? r1(r.wallSqm) : 0,
    ceilingSqm: ceiling ? r1(r.ceilingSqm) : 0,
    rolls: rollAlloc[r.key] ?? 0,
  }));

  // ── 10) 근거 한 줄 ──
  // TODO: 표본 통계(완공 확인 견적 N건)가 붙으면 mode를 '표본'으로 바꾸고 표본 수를 넣는다.
  const costMode: '표본' | '산식' = '산식';
  // 지역 입력이 없으면(2026-09-09부터 화면에서 지역을 안 받는다) 일당이 수도권 밴드라 그렇게 적는다
  const regionLabel = input.region ?? '수도권 기준';
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
