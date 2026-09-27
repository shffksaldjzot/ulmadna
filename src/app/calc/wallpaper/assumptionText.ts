// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 가정 목록(assumed) → 화면 문구
//
// 2026-09-27 지휘관 검수 지적 2번으로 규칙을 좁혔다 — 가정 줄에는 이 셋만 나온다:
//   'area'      → "34평 가정"
//   'product'   → "제품 미정"
//   'measuring' → "실측 입력 중" — 이 값이 있으면 다른 건 다 무시하고 이것만 단독으로 보여준다
// 'bay'·'scope'는 가정 줄에 안 쓴다 — 그 값은 조정 칩이 바로 위에서 선택된 모습으로 이미
// 보여주고 있어서, 글로 또 쓰면 같은 말이 두 번(칩 + 글) 나오게 된다.
// 여러 개면 가운뎃점(·)으로 이어 한 줄로 만든다.
//
// 작성일: 2026년 09월 27일
// 지휘관 검수 반영(bay·scope 제외): 2026년 09월 27일
// ──────────────────────────────────────────────

import type { WallpaperAssumption } from '@/lib/v1/wallpaperEngineInput';

/**
 * 하단 고정 바 전용 — 지시서 3-9절 검수 지적 1번: 하단 바는 자리가 좁으니 'area' 가정이
 * 있을 때 "34평 가정" 하나만 붙이고, 그 외(제품 미정·실측 입력 중 등)는 하단 바에 안 보여준다
 * (결과 카드에는 이미 다 나와 있다). 가정이 없으면 null(바에 아무것도 안 붙인다).
 */
export function describeWallpaperBottomBarAssumption(assumed: WallpaperAssumption[]): string | null {
  return assumed.includes('area') ? '34평 가정' : null;
}

/**
 * 결과 카드 "면적·가정" 한 줄 — 2026-09-27 지휘관 3차 검수 지적 4번: 예전엔 "34평 · 84㎡"
 * (실제 면적 병기)와 "가정 줄"(34평 가정 등)을 따로 두 줄로 그렸는데, area가 가정일 때
 * 둘 다 "34평" 얘기를 하는 게 겹쳐 보였다. 이제 한 줄로 합친다:
 *   - area가 가정이면 → "34평 가정"으로 시작(areaPairText는 안 쓴다 — 실제 값이 아니라
 *     가정값이므로 "34평 · 84㎡"처럼 실측인 척하는 표기를 쓰면 안 된다)
 *   - area를 직접 골랐으면(안 가정) → areaPairText 그대로("34평 · 84㎡")
 *   - 'product'가 가정이면 뒤에 "제품 미정"을 가운뎃점으로 이어 붙인다
 *   - 'measuring'(실측 입력 중)이 섞여 있으면 다른 건 다 무시하고 이것 하나만 단독으로
 * 아무 조각도 없으면(가정도 없고 areaPairText도 없으면, 예: 정확 모드 실측 입력 완료 상태) null.
 *
 * @param areaPairText 간단 모드일 때만 의미 있는 "34평 · 84㎡" 문구(describeAreaPair(form)
 *   결과). 정확 모드 등 뜻이 없으면 null로 넘긴다.
 */
export function describeWallpaperAreaAssumptionLine(
  areaPairText: string | null,
  assumed: WallpaperAssumption[],
): string | null {
  if (assumed.includes('measuring')) return '실측 입력 중';
  const parts: string[] = [];
  if (assumed.includes('area')) {
    parts.push('34평 가정');
  } else if (areaPairText) {
    parts.push(areaPairText);
  }
  if (assumed.includes('product')) parts.push('제품 미정');
  return parts.length > 0 ? parts.join(' · ') : null;
}
