// ──────────────────────────────────────────────
// v1 허브 — 계산기 3종 공용: "구성 보기" 비용 한 줄 표기 + 수량 범위 표기
//
// 원래 도배 계산기 전용 파일(wallpaper/costLineFormat.ts)이었다. 2026-09-27 지시서
// 9장(바닥재·미장을 새 틀로) 작업 중, 바닥재·미장도 "구성 보기의 만 원 미만 금액은
// 원 단위로(× 0만이 남지 않게)" 규칙을 도배와 똑같이 적용해야 해서 세 계산기가 같이
// 쓰는 이 자리(_components/)로 옮겼다. 도배가 쓰던 함수(formatCostLineAmount·
// formatRollsText)는 이름·동작을 그대로 유지한다 — 도배 화면은 import 경로만 바뀌었을
// 뿐 모습이 하나도 안 바뀐다.
//
// 바닥재는 formatCostLineAmount를 그대로 쓰고(단위가 "개·통·병·세트·롤" 등 정수든
// "㎡·m" 연속량이든 이 함수가 1만 원 미만이면 원 단위로 알아서 보여준다 — 예전에 바닥재
// 화면이 따로 갖고 있던 "정수 단위만 원 표기" 구분은 이제 필요 없다, 이 함수가 모든
// 단위에 같은 규칙을 적용해도 결과가 더 정확해진다), formatRollsText 대신 자재 종류에
// 안 매인 이름의 formatUnitsRangeText를 새로 만들어 쓴다.
//
// 미장은 breakdown 줄의 완결 판정 기준이 amountMin===amountMax(단가가 아니라 금액
// 범위로 판단 — 인건비는 단가 자체가 인원 조합이라 단일값이 아니다)라 이 파일의
// formatCostLineAmount(기준: unitPriceMin===unitPriceMax)를 그대로 쓸 수 없다. 미장은
// 자기 파일(mortar/ResultPanel.tsx·mortar/result/page.tsx)에 이미 있던 자기 전용 판정
// 함수를 그대로 두되, "1만 원 미만 원 단위" 세부 규칙만 이 파일의 formatWonPiece를
// 가져다 써서 통일한다(9-1절: 도배가 한 방식을 그대로 따른다).
//
// 작성일: 2026년 09월 27일 (도배 계산기 담당)
// 공용 자리로 이동 + formatUnitsRangeText 추가: 2026년 09월 27일 (바닥재·미장 2차 작업)
// ──────────────────────────────────────────────

import { formatNum, toMan, formatManRange } from '@/lib/v1/money';

/** ResultPanel의 WallpaperCostLine·FlooringCostLine과 값 모양이 겹치는 부분만 뽑은 타입 */
export interface CostLineLike {
  key: string;
  qty: number;
  unit: string;
  unitPriceMin: number;
  unitPriceMax: number;
  amountMin: number;
  amountMax: number;
}

/**
 * 원 숫자 하나 → 완결된 표기 조각(접미사 포함).
 * 1만 원 이상이면 "21만"(예전과 같음). 1만 원 미만이면 toMan()으로 나누면 0이 돼 버리므로,
 * 원 단위 그대로 천 단위 쉼표를 붙여 보여준다 — "4,500원".
 * (바닥재·미장도 이 규칙 하나로 통일 — 9-1절 "만 원 미만 금액은 원 단위로")
 */
export function formatWonPiece(won: number): string {
  if (won >= 10000) return `${toMan(won)}만`;
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}

/**
 * 범위 표기(합계가 단가 범위 때문에 폭이 있을 때). 최소=최대면 하나만.
 * 둘 다 1만 원 이상이면 예전 그대로 formatManRange("182만~236만원")를 쓰고,
 * 둘 다 1만 원 미만이면 원 단위로 한 번만 접미사를 붙인다("4,500~5,200원").
 * 두 값이 1만 원을 사이에 두고 갈리면(드묾) 각자 완결된 조각을 그대로 이어 붙인다.
 */
export function formatWonRange(min: number, max: number): string {
  if (min === max) return formatWonPiece(min);
  if (min >= 10000 && max >= 10000) return formatManRange(min, max);
  if (min < 10000 && max < 10000) {
    return `${Math.round(min).toLocaleString('ko-KR')}~${Math.round(max).toLocaleString('ko-KR')}원`;
  }
  return `${formatWonPiece(min)}~${formatWonPiece(max)}`;
}

/**
 * 비용 구성 한 줄을 "46롤 × 4,500원 = 21만" 또는 범위 문자열로 만든다.
 * 일반경비(key === 'overhead')는 unitPrice 칸에 원이 아니라 %가 들어 있어 따로 표기한다.
 * 도배·바닥재가 함께 쓴다(완결 판정 기준: unitPriceMin === unitPriceMax).
 */
export function formatCostLineAmount(line: CostLineLike): string {
  if (line.key === 'overhead') {
    return line.unitPriceMin === line.unitPriceMax
      ? `${line.unitPriceMin}%`
      : `${line.unitPriceMin}~${line.unitPriceMax}%`;
  }
  if (line.unitPriceMin === line.unitPriceMax) {
    const qtyText = `${formatNum(line.qty)}${line.unit}`;
    // 값이 0이거나 없으면(진짜 0원인 경우만) 그 조각을 아예 안 쓴다 — 아주 작지만 0은 아닌
    // 값(4,500원 등)은 formatWonPiece가 정상적으로 원 단위로 보여준다(0만 문제는 이미 해결)
    const priceText = line.unitPriceMin > 0 ? formatWonPiece(line.unitPriceMin) : null;
    const amountText = line.amountMin > 0 ? formatWonPiece(line.amountMin) : null;
    if (priceText && amountText) return `${qtyText} × ${priceText} = ${amountText}`;
    if (amountText) return `${qtyText} = ${amountText}`;
    return qtyText;
  }
  return formatWonRange(line.amountMin, line.amountMax);
}

/**
 * 수량 줄의 대표 수량 표기 — "19~46롤"(제품 미정이라 범위일 때, 최소=최대면 하나만) 또는
 * "46롤"(제품을 골라서 값이 하나일 때). 단위 이름(롤·박스·m 등)을 인자로 받아 도배·바닥재
 * 둘 다 이 함수 하나로 쓴다.
 *
 * 원래 도배 전용 formatRollsText였다("롤" 고정) — 바닥재는 단위가 박스/m로 달라서
 * unitLabel을 받는 이름으로 일반화했다. 도배도 이 함수를 unitLabel='롤'로 호출한다
 * (formatRollsText라는 이름은 그대로 남겨 두고 내부에서 이 함수를 부르게 해서, 도배 쪽
 * 호출 코드는 한 글자도 안 바뀐다).
 */
export function formatUnitsRangeText(
  value: number,
  range: { min: number; max: number } | undefined,
  unitLabel: string,
): string {
  if (range && range.min !== range.max) {
    return `${formatNum(range.min)}~${formatNum(range.max)}${unitLabel}`;
  }
  return `${formatNum(range ? range.min : value)}${unitLabel}`;
}

/**
 * 도배 전용 호출 이름 — 예전 시그니처(quantity: {rolls, rollsRange})를 그대로 유지해서
 * 도배 화면(ResultPanel.tsx·result/page.tsx)의 호출 코드를 한 글자도 안 바꾼다.
 * 실제 계산은 위 formatUnitsRangeText(범용)에 unitLabel='롤'로 위임한다.
 */
export function formatRollsText(quantity: { rolls: number; rollsRange?: { min: number; max: number } }): string {
  return formatUnitsRangeText(quantity.rolls, quantity.rollsRange, '롤');
}
