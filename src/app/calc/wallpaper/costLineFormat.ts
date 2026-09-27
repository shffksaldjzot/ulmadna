// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: "구성 보기" 비용 한 줄 표기 (공용 순수 함수)
//
// 왜 따로 팠나:
//   즉답 화면(ResultPanel.tsx)과 공유 링크 결과 화면(result/page.tsx)이 완전히 똑같은
//   포맷 함수(formatCostLineAmount)를 각자 베껴 갖고 있었다. 2026-09-27 4차 검수 지적
//   2번(만 원 미만 단가가 "0만"으로 보이는 문제)을 고치면서 한 곳으로 합쳤다 — 안 그러면
//   한쪽만 고치는 실수가 또 날 수 있다.
//
// 지휘관 확정 규칙(2026-09-27, 4차 검수 지적 2번):
//   - 1만 원 이상은 그대로 "21만"(만 단위, 소수 없음)
//   - 1만 원 미만은 원 단위 그대로 천 단위 쉼표 — "4,500원"(toMan으로 나누면 0이 되던 문제 수리)
//   - "수량 × 단가 = 합계" 줄에서 단가·합계는 각자 자기 크기에 맞는 표기를 따로 쓴다
//     (예: "46롤 × 4,500원 = 21만"처럼 단가는 원, 합계는 만이 섞여도 된다)
//   - 값이 0이거나 없으면 그 조각 자체를 안 쓴다("× 0만" 같은 글이 안 남게)
//   이 계산기(도배)에만 적용한다. 바닥재·미장은 각자 자기 ResultPanel.tsx에 자기 함수를
//   따로 갖고 있어서(공용 파일이 아니다) 이 파일을 안 쓴다 — 모습이 그대로다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import { formatNum, toMan, formatManRange } from '@/lib/v1/money';

/** ResultPanel의 WallpaperCostLine과 result/page.tsx의 값 모양이 겹치는 부분만 뽑은 타입 */
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
 */
function formatWonPiece(won: number): string {
  if (won >= 10000) return `${toMan(won)}만`;
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}

/**
 * 범위 표기(합계가 단가 범위 때문에 폭이 있을 때). 최소=최대면 하나만.
 * 둘 다 1만 원 이상이면 예전 그대로 formatManRange("182만~236만원")를 쓰고,
 * 둘 다 1만 원 미만이면 원 단위로 한 번만 접미사를 붙인다("4,500~5,200원").
 * 두 값이 1만 원을 사이에 두고 갈리면(드묾) 각자 완결된 조각을 그대로 이어 붙인다.
 */
function formatWonRange(min: number, max: number): string {
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
 * 수량 줄의 롤 수 표기 — "19~46롤"(제품 미정이라 범위일 때, 최소=최대면 하나만) 또는
 * "46롤"(제품을 골라서 값이 하나일 때).
 *
 * 2026-09-27 배포 전 검사관 지적 7번 — 즉답 화면(ResultPanel.tsx)에 있던 이 판정을
 * 공유 결과 화면(result/page.tsx)도 그대로 쓰게 여기로 뺐다. 예전엔 공유 결과 화면이
 * rollsRange 자체를 안 보고 무조건 quantity.rolls(대표 규격 기준 하나) 한 값만 보여줘서,
 * "19~46롤"을 본 사람이 공유한 링크를 받은 사람은 대표값 하나만 보게 되는 불일치가 있었다.
 */
export function formatRollsText(quantity: { rolls: number; rollsRange?: { min: number; max: number } }): string {
  if (quantity.rollsRange && quantity.rollsRange.min !== quantity.rollsRange.max) {
    return `${formatNum(quantity.rollsRange.min)}~${formatNum(quantity.rollsRange.max)}롤`;
  }
  return `${formatNum(quantity.rollsRange ? quantity.rollsRange.min : quantity.rolls)}롤`;
}
