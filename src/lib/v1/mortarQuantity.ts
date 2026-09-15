// ──────────────────────────────────────────────
// 미장(레미탈·셀프레벨링) — 공개 가능한 물량 계수 + 순수 계산 함수 (단가 아님)
//
// 왜 만들었나 (2026-09-15 운영자 현장 기준 피드백):
//   운영자 현장 기준 폰에서 "레미탈 포수가 안 나왔다"는 문제가 있었다. 원인은 즉답 화면이 포수까지도
//   서버 응답(POST /api/calc/mortar)을 기다렸다가 보여주는 구조였기 때문 — 네트워크가
//   느리거나 실패하면 숫자 자리가 그냥 비어 있었다.
//
//   포수·몰탈 체적·현장 배합(시멘트+모래)은 전부 "공개해도 되는 공식"(면적×두께×계수)이라
//   단가 유출 규칙과 무관하다. 그래서 이 계수·계산 함수를 클라이언트에서도 쓸 수 있게
//   src/lib/v1(공유 폴더)에 두고, 서버 엔진(schema/mortar.ts·mortar.ts)도 **같은 함수를
//   그대로 가져다 쓴다** — 값 하나를 두 곳에 따로 적으면 언젠가 어긋나기 때문이다.
//
//   화면은 이 파일의 함수로 포수를 즉시 계산해서 먼저 보여주고, 서버 응답이 오면
//   비용·인건만 나중에 덧붙인다(useMortarQuickCalc.ts가 그 조립을 담당).
//
// 작성일: 2026년 09월 15일
// 근거: docs/도메인지식/06_미장.md §2-1·§4-1·§4-3·§5-1(전체 출처·등급은
//       src/server/calc/schema/mortar-coefficients.ts 주석 참고 — 여기는 값만 옮겨 적는다)
// ──────────────────────────────────────────────

import type { MortarMode } from './mortarPresets';

// ── 1. 공개 계수(값만) — 등급·출처 메모는 서버 계수 파일에 그대로 남아 있다 ──

/** 몰탈 로스(여유) 비율 기본값. 0.05 = 5% */
export const MORTAR_LOSS_RATE_DEFAULT = 0.05;

/** 레미탈 두께별 kg/(mm·㎡) 계수 — 삼표 SP몰탈 공식 스펙 역산값 */
export const REMICON_KG_PER_MM_SQM = 1.65;
/** 레미탈 포대 단위(kg) */
export const REMICON_BAG_KG = 40;

/** 셀프레벨링 두께별 kg/(mm·㎡) 계수 — 한일시멘트·마페이 교차검증 수렴값 */
export const SELF_LEVEL_KG_PER_MM_SQM = 1.6;
/** 셀프레벨링 포대 단위(kg) */
export const SELF_LEVEL_BAG_KG = 25;

/** 셀프레벨링 프라이머 원액 도포량(L/㎡) */
export const SELF_LEVEL_PRIMER_L_PER_SQM = 0.2;
/** 셀프레벨링 프라이머 캔 용량(L) */
export const SELF_LEVEL_PRIMER_CAN_L = 18;

/** 현장 배합(시멘트+모래) 배합용적비 하나 — ㎥당 재료량, 표준품셈 9-1-1 [참고자료] 원문(할증 포함) */
export interface MixRatioSpec {
  /** 시멘트 (kg/㎥) */
  cementKgPerM3: number;
  /** 모래 (㎥/㎥) */
  sandM3PerM3: number;
}

/**
 * 배합용적비별 ㎥당 재료량 표 — 표준품셈 원문. 이미 할증(재료 자체 로스)이 포함돼 있으므로
 * 현장 배합 계산에는 반드시 "로스 미포함 순수 체적"을 곱한다(이중 할증 방지).
 */
export const MIX_RATIO_TABLE: Record<'1:1' | '1:2' | '1:3' | '1:4' | '1:5', MixRatioSpec> = {
  '1:1': { cementKgPerM3: 1093, sandM3PerM3: 0.78 },
  '1:2': { cementKgPerM3: 680, sandM3PerM3: 0.98 },
  '1:3': { cementKgPerM3: 510, sandM3PerM3: 1.1 },
  '1:4': { cementKgPerM3: 385, sandM3PerM3: 1.1 },
  '1:5': { cementKgPerM3: 320, sandM3PerM3: 1.15 },
};

/** 계산기 기본 배합비 */
export const DEFAULT_MIX_RATIO: '1:2' | '1:3' = '1:3';

/** 시멘트 포대 단위(kg) — 표준품셈에 포장단위 언급이 없어 업계 통상값(40kg)을 쓴다 */
export const CEMENT_BAG_KG = 40;

// ── 2. 계산에 쓰는 작은 도우미 ─────────────────────

/**
 * 소수점 오차에 안 걸리는 올림. 컴퓨터는 2.145÷0.143 같은 나눗셈을 15.000000000000002처럼
 * 아주 조금 크게 계산할 때가 있어서, 그대로 Math.ceil 하면 딱 떨어져야 할 값이 한 단위
 * 더 올라간다. 올리기 전에 아주 작은 값(1e-9)을 먼저 빼서 이 오차를 걷어낸다.
 * (src/server/calc/cutting/round.ts의 ceilSafe와 같은 기법 — 이 파일은 클라이언트에서도
 * 써야 해서 server 전용 경로를 안 타고 여기 하나 더 둔다)
 */
function ceilSafe(n: number): number {
  return Math.ceil(n - 1e-9);
}

/** 소수점 자리수 반올림 */
function round(n: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

// ── 3. 순수 계산 함수 — 서버·클라이언트가 똑같이 가져다 쓴다 ──

/** calcMortarBags() 입력 */
export interface MortarBagsInput {
  /** 시공 면적(㎡) */
  areaSqm: number;
  /** 두께(mm) */
  thicknessMm: number;
  /** 자재 계수(kg/mm·㎡) — 제품을 골랐으면 그 제품 값, 아니면 모드 기본값 */
  kgPerMmSqm: number;
  /** 포장 단위(kg) — 제품을 골랐으면 그 제품 값, 아니면 모드 기본값 */
  bagKg: number;
  /** 로스(여유) 비율. 0.05 = 5% */
  lossRate: number;
}

/**
 * 포 수를 계산한다 — 면적 × 두께 × kg/(mm·㎡) 계수 × (1+로스율) ÷ 포장 kg, 올림(최소 1포).
 * 서버(schema/mortar.ts calcMaterial)와 화면 즉답(useMortarQuickCalc)이 똑같이 이 함수를 쓴다.
 */
export function calcMortarBags(input: MortarBagsInput): number {
  const { areaSqm, thicknessMm, kgPerMmSqm, bagKg, lossRate } = input;
  if (areaSqm <= 0 || thicknessMm <= 0) return 0;
  const kg = areaSqm * thicknessMm * kgPerMmSqm * (1 + lossRate);
  return Math.max(1, ceilSafe(kg / bagKg));
}

/** calcMortarVolume() 입력 */
export interface MortarVolumeInput {
  areaSqm: number;
  thicknessMm: number;
  /** 로스(여유) 비율 */
  lossRate: number;
}

/** calcMortarVolume() 결과 */
export interface MortarVolumeResult {
  /** 순수 체적(로스 미포함, ㎥) */
  volumeM3: number;
  /** 로스 포함 체적(㎥) — 자재량 산출에 실제로 쓰는 값 */
  volumeWithLossM3: number;
}

/** 몰탈 체적을 계산한다 — 면적 × 두께 ÷ 1000. 소수 3자리로 다듬는다 */
export function calcMortarVolume(input: MortarVolumeInput): MortarVolumeResult {
  const volumeM3 = round((Math.max(0, input.areaSqm) * Math.max(0, input.thicknessMm)) / 1000, 3);
  const volumeWithLossM3 = round(volumeM3 * (1 + input.lossRate), 3);
  return { volumeM3, volumeWithLossM3 };
}

/** calcAltMix() 입력 */
export interface AltMixInput {
  /** 순수 체적(로스 미포함, ㎥) — 배합표가 이미 할증을 포함하고 있어 반드시 순수 체적을 쓴다 */
  volumeM3: number;
  mixRatio: '1:2' | '1:3';
}

/** calcAltMix() 결과 — 레미탈 모드 전용 현장 배합(시멘트+모래) 대안. 참고용, 비용 미포함 */
export interface AltMixResult {
  mixRatio: '1:2' | '1:3';
  cementKg: number;
  cementBags: number;
  sandM3: number;
}

/** 현장 배합(시멘트+모래) 대안 물량을 계산한다. 체적이 0 이하면 undefined */
export function calcAltMix(input: AltMixInput): AltMixResult | undefined {
  if (input.volumeM3 <= 0) return undefined;
  const spec = MIX_RATIO_TABLE[input.mixRatio];
  const cementKg = input.volumeM3 * spec.cementKgPerM3;
  const cementBags = ceilSafe(cementKg / CEMENT_BAG_KG);
  const sandM3 = round(input.volumeM3 * spec.sandM3PerM3, 2);
  return { mixRatio: input.mixRatio, cementKg: Math.round(cementKg), cementBags, sandM3 };
}

// ── 4. 모드별 기본 계수 고르기 ─────────────────────

/** 모드에 맞는 기본 자재 계수(kg/mm·㎡)를 고른다. 제품을 골랐으면 그 값을 우선 쓴다 */
export function defaultKgPerMmSqm(mode: MortarMode): number {
  return mode === '레미탈' ? REMICON_KG_PER_MM_SQM : SELF_LEVEL_KG_PER_MM_SQM;
}

/** 모드에 맞는 기본 포장 단위(kg)를 고른다. 제품을 골랐으면 그 값을 우선 쓴다 */
export function defaultBagKg(mode: MortarMode): number {
  return mode === '레미탈' ? REMICON_BAG_KG : SELF_LEVEL_BAG_KG;
}
