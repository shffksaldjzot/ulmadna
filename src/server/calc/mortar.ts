// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) 계산기 — 오케스트레이터
//
// 이 파일이 하는 일 (도배·바닥재 계산기와 같은 흐름):
//   1) 면적·두께(화면이 평/㎡/가로×세로를 이미 ㎡로 환산해서 보낸다)를 받는다
//   2) 모드(레미탈/셀프레벨링)에 맞는 자재 계수·포장 단위를 고른다(제품을 골랐으면 그 값)
//   3) 공정 스키마를 돌려 자재·와이어메시·프라이머 물량을 자동 산출한다
//   4) 레미탈 모드만 인건 모듈(labor-mortar.ts)로 품수·인건비를 구한다(공법은 용도가 정한다)
//   5) 레미탈 모드면 "현장 배합(시멘트+모래)" 대안 물량도 참고용으로 같이 낸다
//   6) 서버 단가를 곱해 소비자가 범위를 만든다
//
// 내보내는 것: 물량 · 부자재 · 소비자가 범위 · 물량 근거 문장.
// 내보내지 않는 것: 업자가, 단가 출처 문서명, 산식 내부값(품수 계산 공식 등).
//
// 2026-09-14 검사관(opus) 지적으로 고친 것:
//   - 인건: "체적 10㎥ 이상 = 장비 타설" 문턱을 버리고 용도(usage)가 공법을 정하게 했다.
//     정밀 모드에서 사용자가 공법(method)을 직접 바꿀 수도 있다.
//   - 셀프레벨링은 인건을 계산하지 않는다(labor가 null) — 자재비만 내고 "시공비는 현장
//     견적 별도" 문구(laborAdvisoryNote)를 화면에 보여준다.
//   - 현장 배합(시멘트+모래) 대안은 로스 미포함 체적에 배합표를 곱한다 — 배합표 자체가
//     이미 할증을 포함하고 있어서, 로스 포함 체적에 또 곱하면 이중 할증이 된다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드)
// ──────────────────────────────────────────────

import 'server-only';

import { calcMortarLabor } from './labor-mortar';
import { buildMortarContext, runMortarSchema, MORTAR_PROCESS } from './schema/mortar';
import type { EvidenceGrade } from './schema/types';
import {
  USAGE_PRESET,
  MORTAR_LOSS_RATE_DEFAULT,
  DEFAULT_MIX_RATIO,
  REMICON_KG_PER_MM_SQM,
  REMICON_BAG_KG,
  SELF_LEVEL_KG_PER_MM_SQM,
  SELF_LEVEL_BAG_KG,
  SELF_LEVEL_PRIMER_L_PER_SQM,
  SELF_LEVEL_LABOR_ADVISORY_NOTE,
  // 2026-09-15 형아 피드백: 체적·현장배합은 화면 즉답(useMortarQuickCalc)과 같은 공유 함수를
  // 쓴다(src/lib/v1/mortarQuantity.ts, mortar-coefficients.ts가 다시 내보낸다).
  calcMortarVolume,
  calcAltMix,
  type MortarMode,
  type MortarUsage,
  type MortarMethod,
} from './schema/mortar-coefficients';
import {
  getMortarMaterialBand,
  getMortarSubmaterialBand,
  OVERHEAD_RATE,
  type PriceBand,
} from '../pricing/mortar';
import { isThicknessOutOfStandardRange, THICKNESS_OUT_OF_RANGE_NOTE } from '@/lib/v1/mortarPresets';

// ── 입력 타입 ──────────────────────────────────

/** 사용자가 고르거나 직접 넣은 자재 정보 */
export interface MortarProductInput {
  /** 자재 계수(kg/mm·㎡) — 제품을 고르면 그 제품 값, 없으면 모드 기본값 */
  kgPerMmSqm?: number;
  /** 포장 단위(kg) — 제품을 고르면 그 제품 값, 없으면 모드 기본값(레미탈 40 · 셀프레벨링 25) */
  bagKg?: number;
  /** 포당 판매가(원) — 있으면 그 값을 그대로, 없으면 종류 평균가 */
  pricePerBag?: number;
  /** 화면 표기용 출처 문구("브랜드 제품명"). 없으면 서버가 "사용자 직접 입력"으로 표시 */
  sourceLabel?: string;
}

/** 정밀 모드에서 실별로 면적을 나눠 넣었을 때 방 하나 */
export interface MortarRoomInput {
  name: string;
  /** 이 방의 시공 면적 (㎡) */
  areaSqm: number;
}

/** 미장 계산 입력 — 면적·두께는 화면이 평/㎡/가로×세로를 이미 ㎡·mm로 환산해서 보낸다 */
export interface MortarCalcInput {
  /** 모드 — 레미탈(일반 몰탈 손미장) / 셀프레벨링(수평몰탈) */
  mode: MortarMode;
  /** 시공 면적 합계 (㎡) */
  areaSqm: number;
  /** 두께 (mm) */
  thicknessMm: number;
  /** 레미탈 모드 용도 — 공법(장비 타설/손미장) 기본값을 정하는 데 쓴다("방통 전체"만 장비 타설) */
  usage?: MortarUsage;
  /** 화면 표시용 용도 라벨(근거 문장 표기용). usage가 있으면 서버가 같은 라벨을 다시 만들 수도 있지만, 셀프레벨링 용도처럼 서버가 모르는 라벨은 화면이 넘긴 값을 그대로 쓴다 */
  usageLabel?: string;
  /** 공법 오버라이드 — 정밀 모드에서 사용자가 직접 고르면 usage 기본값보다 우선한다(레미탈 전용) */
  method?: MortarMethod;
  /** 배합비 — 레미탈 모드 "현장 배합" 대안 계산에만 쓴다. 기본 1:3 */
  mixRatio?: '1:2' | '1:3';
  /** 로스(여유) 비율(0~0.2). 기본 5% */
  lossRate?: number;
  /** 와이어메시 옵션 — 레미탈 모드 전용 */
  wireMesh?: boolean;
  /** 프라이머 옵션 — 기본값은 모드별로 다르다(셀프레벨링은 기본 true) */
  primer?: boolean;
  /** 제품 마스터에서 고른 값 또는 직접 입력. 없으면 모드 기본 계수 */
  product?: MortarProductInput;
  /** 정밀 모드 — 실별 면적. 있으면 byRoom 배분에 쓴다(없으면 "전체 시공" 한 줄) */
  rooms?: MortarRoomInput[];
}

// ── 출력 타입 ──────────────────────────────────

/** 실별 물량 한 줄 */
export interface MortarRoomQuantity {
  key: string;
  name: string;
  areaSqm: number;
  bags: number;
}

/** 부자재 한 줄 */
export interface MortarSubmaterialLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  basis: string;
  grade: EvidenceGrade;
}

/** 비용 구성 한 줄 */
export interface MortarCostLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  amountMin: number;
  amountMax: number;
  note: string;
}

/** 레미탈 모드 전용 — 현장 배합(시멘트+모래) 대안. 참고용 수치라 비용 합계엔 안 들어간다 */
export interface MortarAltMix {
  mixRatio: '1:2' | '1:3';
  cementKg: number;
  cementBags: number;
  sandM3: number;
}

/** 인건 요약 — 레미탈 모드에서만 채워진다(셀프레벨링은 labor 자체가 null) */
export interface MortarLaborSummary {
  manDaysPlasterer: number;
  manDaysHelper: number;
  /** 장비 타설일 때만 0보다 크다 */
  manDaysMechanic: number;
  manDaysTotal: number;
  teamDays: number;
  /** 이번에 쓴 공법 */
  method: MortarMethod;
  /** 일반기계운전사 노임이 추정치(등급 C)라 화면에 표시해야 하는지 */
  mechanicWageIsEstimate: boolean;
}

/** 미장 계산 결과 */
export interface MortarCalcResult {
  mode: MortarMode;
  quantity: {
    areaSqm: number;
    thicknessMm: number;
    /** 화면에서 고른 용도 칩 라벨(있으면 근거 문장에 그대로 쓴다) */
    usageLabel?: string;
    /** 레미탈 모드에서 실제로 쓴 공법 */
    method?: MortarMethod;
    /** 순수 체적 (로스 미포함, ㎥) */
    volumeM3: number;
    /** 로스 포함 체적 (㎥) — 자재량 산출에 실제로 쓴 값 */
    volumeWithLossM3: number;
    lossPct: number;
    /** 구매 단위 — 레미탈·셀프레벨링 둘 다 포대 */
    unit: '포';
    /** 사야 하는 포 수 */
    bags: number;
    /** 포장 단위(kg) — 화면 표기용 */
    bagKg: number;
    /** 제품명 — 제품을 골랐으면 그 이름, 아니면 "레미탈 40kg 포대"처럼 모드+포장kg 기본 표기 */
    productLabel: string;
    /** 06_미장.md 표준 두께 범위(레미탈 10~50mm)를 넘었을 때만: 계산은 그대로 하되 붙이는 안내 */
    standardRangeNote?: string;
    /** 레미탈 모드에서만: 현장 배합 대안(참고용, 비용 미포함) */
    altMix?: MortarAltMix;
    /** 프라이머 옵션을 켰을 때만: 원액 기준 소요량(L) */
    primerLiters?: number;
    /** 실별 보기 */
    byRoom: MortarRoomQuantity[];
  };
  submaterials: MortarSubmaterialLine[];
  /** 셀프레벨링 모드는 인건 자체를 계산하지 않아 null이다(06_미장.md §6-4) */
  labor: MortarLaborSummary | null;
  /** 셀프레벨링 모드에서만: "시공비는 현장 견적 별도" 안내 */
  laborAdvisoryNote?: string;
  /** 장비 타설일 때만: "장비비 별도" 안내(가격은 안 붙인다) */
  equipmentNote?: string;
  cost: {
    min: number;
    mid: number;
    max: number;
    mode: '산식';
    basisLine: string;
    breakdown: MortarCostLine[];
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

/** 오늘 기준 "2026.9" 같은 표기를 만든다 */
function baseMonthLabel(now: Date = new Date()): string {
  return `${now.getFullYear()}.${now.getMonth() + 1}`;
}

/**
 * 포(정수) 수량을 실별로 나눈다. 면적 비율로 나눈 뒤, 소수점 때문에 모자란 만큼을
 * 소수부가 큰 방부터 하나씩 더 준다 (바닥재 계산기 allocateWhole과 같은 방식).
 */
function allocateBags(rooms: { key: string; weight: number }[], total: number): Record<string, number> {
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

// ── 본체 ──────────────────────────────────────

/**
 * 미장 계산기 본체.
 * 입력 한 번으로 물량 → 부자재 → 인건 → 비용까지 한 번에 돌린다.
 */
export function calcMortar(input: MortarCalcInput): MortarCalcResult {
  const isRemicon = input.mode === '레미탈';
  const areaSqm = Math.max(0, input.areaSqm);
  const thicknessMm = Math.max(0, input.thicknessMm);
  const lossRate = input.lossRate ?? MORTAR_LOSS_RATE_DEFAULT.value;
  const wireMesh = isRemicon && !!input.wireMesh;
  // 프라이머 기본값 — 셀프레벨링은 제조사 공통 필수 항목이라 기본 켬, 레미탈은 기본 끔
  const primer = input.primer ?? !isRemicon;

  // ── 0) 공법 — 용도가 기본값을 정하고, 정밀 모드의 명시적 오버라이드가 있으면 그걸 쓴다 ──
  // (2026-09-14 검사관 지적: 체적 문턱 폐기, "방통 전체"만 기본이 장비 타설이다)
  const method: MortarMethod | undefined = isRemicon
    ? input.method ?? (input.usage ? USAGE_PRESET[input.usage].defaultMethod : '손미장')
    : undefined;

  // ── 1) 이번 계산에 쓸 자재 계수·포장 단위 (제품을 골랐으면 그 값) ──
  const defaultCoeff = isRemicon ? REMICON_KG_PER_MM_SQM.value : SELF_LEVEL_KG_PER_MM_SQM.value;
  const defaultBagKg = isRemicon ? REMICON_BAG_KG.value : SELF_LEVEL_BAG_KG.value;
  const kgPerMmSqm = input.product?.kgPerMmSqm ?? defaultCoeff;
  const bagKg = input.product?.bagKg ?? defaultBagKg;

  // ── 2) 체적 (로스 없는 순수값 · 로스 포함값) — 화면 즉답과 같은 공유 함수를 쓴다 ──
  const { volumeM3, volumeWithLossM3 } = calcMortarVolume({ areaSqm, thicknessMm, lossRate });

  // ── 3) 인건 — 셀프레벨링은 계산하지 않는다(labor-mortar.ts가 null을 돌려준다) ──
  const labor = isRemicon ? calcMortarLabor({ areaSqm, thicknessMm, mode: input.mode, method, wireMesh }) : null;

  // ── 4) 공정 스키마 실행 → 항목별 물량 ──
  const ctx = buildMortarContext({
    areaSqm,
    thicknessMm,
    kgPerMmSqm,
    bagKg,
    lossRate,
    laborManDays: labor?.manDaysTotal ?? 0,
    isRemicon,
    wireMesh,
    primer,
  });
  const schemaQty = runMortarSchema(ctx);

  const bags = schemaQty.material?.qty ?? 0;

  // ── 5) 부자재 목록 ──
  const submaterials: MortarSubmaterialLine[] = [];
  for (const item of MORTAR_PROCESS.items) {
    if (item.kind !== '부자재') continue;
    const got = schemaQty[item.key];
    if (!got) continue;
    submaterials.push({ key: item.key, name: item.name, qty: got.qty, unit: item.unit, basis: got.basis, grade: item.evidenceGrade });
  }

  // ── 6) 비용 계산 ──
  const breakdown: MortarCostLine[] = [];
  let sumMin = 0;
  let sumMax = 0;

  const pushLine = (key: string, name: string, qty: number, unit: string, band: PriceBand, note: string) => {
    const amountMin = Math.round(qty * band.min);
    const amountMax = Math.round(qty * band.max);
    sumMin += amountMin;
    sumMax += amountMax;
    breakdown.push({ key, name, qty, unit, unitPriceMin: band.min, unitPriceMax: band.max, amountMin, amountMax, note });
  };

  // 자재 — 제품을 골랐으면 그 가격, 아니면 종류 평균가
  const materialQty = schemaQty.material;
  if (materialQty) {
    const band = getMortarMaterialBand(input.mode, {
      pricePerBag: input.product?.pricePerBag,
      sourceLabel: input.product?.sourceLabel,
    });
    let note = input.product?.sourceLabel ?? (input.product ? '직접 입력' : '종류 평균가');
    // 2026-09-15 검사관 지적: 제품을 안 골라 종류 평균 밴드(등급 C)를 쓸 때는 화면에도
    // "추정"이 보여야 한다 — 이전엔 물량 근거(basis)에만 붙고 단가 밴드 쪽엔 안 붙어 있었다.
    if (band.등급 === 'C' && !note.includes('추정')) note += ' · 추정';
    pushLine('material', input.mode, materialQty.qty, '포', band, note);
  }

  // 와이어메시 · 프라이머
  for (const key of ['wiremesh', 'primer'] as const) {
    const got = schemaQty[key];
    if (!got) continue;
    const band = getMortarSubmaterialBand(key);
    if (!band) continue;
    const item = MORTAR_PROCESS.items.find((i) => i.key === key);
    const name = item?.name ?? key;
    // 근거 등급이 C(추정)면 "· 추정"이 이미 basis에 들어 있다(schema/mortar.ts에서 붙였다)
    pushLine(key, name, got.qty, item?.unit ?? '', band, got.basis);
  }

  // 시공 — 레미탈 모드만. labor-mortar.ts가 이미 정확히 계산해 둔 인건비 총액(labor.amount)을
  // manDaysTotal로 나눠 "1품당 얼마"라는 표기만 만든다(산식 자체는 화면에 안 보인다).
  // 셀프레벨링은 labor가 null이라 이 블록을 건너뛰고, 대신 laborAdvisoryNote만 채운다.
  let equipmentNote: string | undefined;
  if (labor && labor.manDaysTotal > 0) {
    const laborAmountWon = roundWon(labor.amount);
    const perManDay = Math.round(labor.amount / labor.manDaysTotal);
    const methodLabel = labor.method === '장비타설' ? '장비 타설' : '손미장';
    // 손미장 품(표준품셈 벽 기준 준용)은 C등급 추정이라 화면에 "추정"을 명시한다(검사관 지적)
    const estimateTag = labor.method === '손미장' ? '(추정)' : '';
    let note = `${methodLabel}${estimateTag} ${labor.manDaysTotal}품 · 2인 1조 약 ${labor.teamDays}일`;
    if (labor.mechanicWageIsEstimate) note += ' · 기계운전사 노임 추정';
    if (labor.equipmentNote) {
      equipmentNote = labor.equipmentNote;
      note += ` · ${equipmentNote}`;
    }
    breakdown.push({
      key: 'labor',
      name: '미장 시공',
      qty: labor.manDaysTotal,
      unit: '품',
      unitPriceMin: perManDay,
      unitPriceMax: perManDay,
      amountMin: laborAmountWon,
      amountMax: laborAmountWon,
      note,
    });
    sumMin += laborAmountWon;
    sumMax += laborAmountWon;
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

  // ── 7) 레미탈 모드 — 현장 배합(시멘트+모래) 대안 (참고용, 비용 미포함) ──
  // ⚠️ 2026-09-14 검사관 지적: 배합표는 이미 할증(재료 자체 로스)이 포함된 표다. 여기에
  //    "로스 포함 체적"을 또 곱하면 할증이 두 번 들어간다(이중 할증) — 그래서 반드시 로스
  //    미포함 순수 체적(volumeM3)에 곱한다. 2026-09-15부터는 화면 즉답과 같은 공유 함수
  //    calcAltMix(mortarQuantity.ts)를 쓴다(값이 어긋나지 않게).
  const altMix: MortarAltMix | undefined = isRemicon
    ? calcAltMix({ volumeM3, mixRatio: input.mixRatio ?? DEFAULT_MIX_RATIO })
    : undefined;

  // ── 8) 프라이머 원액 소요량(L, 옵션 켰을 때만 표시) ──
  const primerLiters = primer && areaSqm > 0 ? r1(areaSqm * SELF_LEVEL_PRIMER_L_PER_SQM.value) : undefined;

  // ── 8-B) 제품명 표기 — 골랐으면 그 제품명, 아니면 "모드 + 포장kg 포대" 기본 표기
  // (2026-09-15 형아 피드백: "레미탈이 몇 kg짜리 몇 포인지" 항상 보이게)
  const productLabel = input.product?.sourceLabel ?? `${input.mode} ${bagKg}kg 포대`;

  // ── 8-C) 06_미장.md 표준 두께 범위(레미탈 10~50mm)를 넘으면 안내만(계산은 그대로 한다) ──
  const standardRangeNote = isThicknessOutOfStandardRange(input.mode, thicknessMm)
    ? THICKNESS_OUT_OF_RANGE_NOTE
    : undefined;

  // ── 9) 실별 수량 배분 ──
  const rooms = input.rooms && input.rooms.length > 0 ? input.rooms : [{ name: '전체 시공', areaSqm }];
  const weights = rooms.map((r, i) => ({ key: `room${i + 1}`, weight: Math.max(0, r.areaSqm) }));
  const alloc = allocateBags(weights, bags);
  const byRoom: MortarRoomQuantity[] = rooms.map((r, i) => ({
    key: `room${i + 1}`,
    name: r.name,
    areaSqm: r1(r.areaSqm),
    bags: alloc[`room${i + 1}`] ?? 0,
  }));

  const basisLine = `${baseMonthLabel()} 기준 · 산식`;

  return {
    mode: input.mode,
    quantity: {
      areaSqm: r1(areaSqm),
      thicknessMm,
      usageLabel: input.usageLabel,
      method,
      volumeM3,
      volumeWithLossM3,
      lossPct: Math.round(lossRate * 100),
      unit: '포',
      bags,
      bagKg,
      productLabel,
      standardRangeNote,
      altMix,
      primerLiters,
      byRoom,
    },
    submaterials,
    labor: labor
      ? {
          manDaysPlasterer: labor.manDaysPlasterer,
          manDaysHelper: labor.manDaysHelper,
          manDaysMechanic: labor.manDaysMechanic,
          manDaysTotal: labor.manDaysTotal,
          teamDays: labor.teamDays,
          method: labor.method,
          mechanicWageIsEstimate: labor.mechanicWageIsEstimate,
        }
      : null,
    laborAdvisoryNote: isRemicon ? undefined : SELF_LEVEL_LABOR_ADVISORY_NOTE,
    equipmentNote,
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
