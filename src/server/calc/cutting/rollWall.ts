// ──────────────────────────────────────────────
// 재단 모듈 — rollWall (벽에 붙이는 롤 자재: 벽지·시트필름)
//
// 재단 규칙 (설계 정본 0절):
//   벽 높이 + 리피트 맞춤 손실 → 롤당 폭 수 → 벽 둘레 ÷ 롤 폭 → 롤 수
//   천장은 폭을 셀 치수가 없으므로 면적 ÷ 롤당 ㎡ 방식으로 잡는다.
//
// 두 가지 모드:
//   실제 — 벽 높이와 둘레를 실측으로 받았을 때. 진짜로 잘라 보고 로스를 구한다.
//   추정 — 평형만 넣었을 때. 표준품셈 정배지 1.2배(로스 20%)를 폴백으로 쓴다.
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import type { CuttingResult, LossMode } from './types';
import {
  CUT_MARGIN_M,
  CEILING_LOSS_RATIO,
  ESTIMATED_LOSS_RATIO,
  REPEAT_EXTRA_LOSS,
  LARGE_REPEAT_CM,
  type RollSpec,
} from '../schema/wallpaper-coefficients';

/** rollWall 재단 계산에 넣는 값들 */
export interface RollWallInput {
  /** 벽 도배 면적 (㎡) */
  wallSqm: number;
  /** 천장 도배 면적 (㎡). 천장을 안 하면 0 */
  ceilingSqm: number;
  /** 롤 규격 (폭·길이·리피트·롤당 ㎡) */
  spec: RollSpec;
  /** 실측값. 벽 높이와 둘레가 둘 다 있어야 "실제 재단" 모드로 간다 */
  measured?: {
    /** 도배하는 벽의 높이 (m) */
    wallHeightM?: number;
    /** 도배하는 벽의 둘레 합계 (m) */
    perimeterM?: number;
  };
  /**
   * 결과의 lossMode 꼬리표를 바꿔 붙이고 싶을 때 쓴다.
   * 면적 직접 입력 모드는 계산은 재단 규격으로 하되 화면에는 "면적"으로 표기한다.
   */
  lossModeLabel?: LossMode;
}

/** 소수점 1자리로 반올림 (표시용) */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * 벽용 롤 자재의 롤 수와 로스를 계산한다.
 * 실측(벽 높이 + 둘레)이 있으면 실제 재단, 없으면 표준품셈 할증 기반 추정.
 */
export function calcRollWall(input: RollWallInput): CuttingResult {
  const { wallSqm, ceilingSqm, spec, measured } = input;

  // 시공해야 하는 실제 면적 (로스를 재는 기준선)
  const workAmount = round1(wallSqm + ceilingSqm);

  // 실측이 둘 다 있어야 잘라 볼 수 있다
  const hasMeasure =
    !!measured &&
    typeof measured.wallHeightM === 'number' &&
    measured.wallHeightM > 0 &&
    typeof measured.perimeterM === 'number' &&
    measured.perimeterM > 0;

  const result = hasMeasure
    ? realCutMode(
        workAmount,
        wallSqm,
        ceilingSqm,
        spec,
        measured!.wallHeightM as number,
        measured!.perimeterM as number,
      )
    : estimateMode(workAmount, wallSqm, ceilingSqm, spec);

  // 면적 직접 입력처럼 꼬리표만 다르게 붙여야 하는 경우
  if (input.lossModeLabel) result.lossMode = input.lossModeLabel;
  return result;
}

// ── 추정 모드: 실측 없이 평형만 있을 때 ──────────────
function estimateMode(
  workAmount: number,
  wallSqm: number,
  ceilingSqm: number,
  spec: RollSpec,
): CuttingResult {
  // 표준품셈 정배지 할증 20%가 기본. 리피트가 큰 제품이면 조금 더 얹는다.
  const bigRepeat = spec.repeatCm >= LARGE_REPEAT_CM;
  const lossRatio = ESTIMATED_LOSS_RATIO.value + (bigRepeat ? REPEAT_EXTRA_LOSS.value : 0);

  // 필요 면적 = 시공 면적 × (1 + 로스)
  const needSqm = workAmount * (1 + lossRatio);
  // 롤 수 = 필요 면적 ÷ 롤당 면적 (올림)
  const units = Math.max(1, Math.ceil(needSqm / spec.sqmPerRoll));

  // 구매 기준 로스 = 산 롤의 총 면적이 시공 면적보다 얼마나 남는가
  const purchaseLossPct = workAmount > 0 ? ((units * spec.sqmPerRoll - workAmount) / workAmount) * 100 : 0;

  const repeatNote = bigRepeat ? ` · 리피트 ${spec.repeatCm}cm 가산` : '';
  return {
    kind: 'rollWall',
    units,
    unitName: '롤',
    lossMode: '추정',
    lossPct: round1(lossRatio * 100),
    purchaseLossPct: round1(purchaseLossPct),
    workAmount,
    basis:
      `벽 ${round1(wallSqm)}㎡ + 천장 ${round1(ceilingSqm)}㎡ = ${workAmount}㎡` +
      ` × 추정 로스 ${round1(lossRatio * 100)}%${repeatNote}` +
      ` ÷ 롤당 ${spec.sqmPerRoll}㎡ → ${units}롤`,
    detail: { needSqm: round1(needSqm), sqmPerRoll: spec.sqmPerRoll },
  };
}

// ── 실제 재단 모드: 벽 높이·둘레를 알 때 ──────────────
function realCutMode(
  workAmount: number,
  wallSqm: number,
  ceilingSqm: number,
  spec: RollSpec,
  wallHeightM: number,
  perimeterM: number,
): CuttingResult {
  const rollWidthM = spec.widthCm / 100;   // 롤 폭 (m)
  const rollLengthM = spec.lengthM;        // 롤 길이 (m)

  // 1) 한 폭을 몇 m 로 자를 것인가 = 벽 높이 + 재단 여유
  let cutLenM = wallHeightM + CUT_MARGIN_M.value;
  // 패턴 리피트가 있으면 무늬를 맞추느라 리피트 배수로 올려 잘라야 한다
  if (spec.repeatCm > 0) {
    const repeatM = spec.repeatCm / 100;
    cutLenM = Math.ceil(cutLenM / repeatM) * repeatM;
  }
  cutLenM = round1(cutLenM * 100) / 100; // 소수점 2자리 정리

  // 2) 롤 하나에서 몇 폭이 나오는가 = 롤 길이 ÷ 재단 길이 (내림)
  //    롤이 재단 길이보다 짧으면(이상 규격) 최소 1폭으로 막아 둔다
  const stripsPerRoll = Math.max(1, Math.floor(rollLengthM / cutLenM));

  // 3) 벽에 필요한 폭 수 = 벽 둘레 ÷ 롤 폭 (올림)
  const stripsNeeded = Math.ceil(perimeterM / rollWidthM);

  // 4) 벽에 드는 롤 수 = 필요 폭 수 ÷ 롤당 폭 수 (올림)
  const wallRolls = Math.ceil(stripsNeeded / stripsPerRoll);

  // 5) 벽 재단으로 실제 쓴 면적 (자투리 포함)
  const wallCutSqm = stripsNeeded * rollWidthM * cutLenM;

  // 6) 마지막 롤에 남은 길이 → 천장에 이어서 쓸 수 있다
  const leftoverM = Math.max(0, wallRolls * rollLengthM - stripsNeeded * cutLenM);
  const leftoverSqm = leftoverM * rollWidthM;

  // 7) 천장은 폭을 셀 치수가 없으므로 면적 방식. 천장 로스를 얹는다.
  const ceilingNeedSqm = ceilingSqm * (1 + CEILING_LOSS_RATIO.value);
  const ceilingRemainSqm = Math.max(0, ceilingNeedSqm - leftoverSqm);
  const ceilingRolls = ceilingRemainSqm > 0 ? Math.ceil(ceilingRemainSqm / spec.sqmPerRoll) : 0;

  const units = Math.max(1, wallRolls + ceilingRolls);

  // 8) 로스 두 가지
  //    재단 기준 = 잘라서 버린 자투리만
  //    구매 기준 = 롤 올림으로 남는 잉여까지
  const cutTotalSqm = wallCutSqm + ceilingNeedSqm;
  const lossPct = workAmount > 0 ? ((cutTotalSqm - workAmount) / workAmount) * 100 : 0;
  const purchaseLossPct = workAmount > 0 ? ((units * spec.sqmPerRoll - workAmount) / workAmount) * 100 : 0;

  const ceilingLine =
    ceilingSqm > 0 ? ` · 천장 ${round1(ceilingSqm)}㎡ → ${ceilingRolls}롤` : '';

  return {
    kind: 'rollWall',
    units,
    unitName: '롤',
    lossMode: '실제',
    lossPct: round1(lossPct),
    purchaseLossPct: round1(purchaseLossPct),
    workAmount,
    basis:
      `벽 높이 ${wallHeightM}m + 여유 → ${cutLenM}m 재단 · 롤당 ${stripsPerRoll}폭` +
      ` · 둘레 ${round1(perimeterM)}m ÷ 폭 ${spec.widthCm}cm = ${stripsNeeded}폭 → 벽 ${wallRolls}롤` +
      ceilingLine +
      ` · 실제 로스 ${round1(lossPct)}%`,
    detail: {
      cutLenM,
      stripsPerRoll,
      stripsNeeded,
      wallRolls,
      ceilingRolls,
      wallCutSqm: round1(wallCutSqm),
      leftoverM: round1(leftoverM),
    },
  };
}
