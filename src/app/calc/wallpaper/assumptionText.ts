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

/** 가정 줄에 실제로 글자로 나오는 값만 담은 문구표 — bay·scope는 여기 자체가 없다(위 설명 참고) */
const ASSUMPTION_LABEL: Partial<Record<WallpaperAssumption, string>> = {
  area: '34평 가정',
  product: '제품 미정',
};

/**
 * 가정 목록 → 결과 카드 "가정 줄"에 쓸 한 줄 문구. 가정이 하나도 없으면(또는 area·product·
 * measuring이 하나도 없으면) null(가정 줄 자체를 안 그린다).
 * 'measuring'(실측 입력 중)이 섞여 있으면 다른 가정은 다 무시하고 이 문구만 단독으로 보여준다.
 */
export function describeWallpaperAssumptions(assumed: WallpaperAssumption[]): string | null {
  if (assumed.includes('measuring')) return '실측 입력 중';
  const parts = assumed.map((a) => ASSUMPTION_LABEL[a]).filter((s): s is string => !!s);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * 하단 고정 바 전용 — 지시서 3-9절 검수 지적 1번: 하단 바는 자리가 좁으니 'area' 가정이
 * 있을 때 "34평 가정" 하나만 붙이고, 그 외(제품 미정·실측 입력 중 등)는 하단 바에 안 보여준다
 * (결과 카드에는 이미 다 나와 있다). 가정이 없으면 null(바에 아무것도 안 붙인다).
 */
export function describeWallpaperBottomBarAssumption(assumed: WallpaperAssumption[]): string | null {
  return assumed.includes('area') ? '34평 가정' : null;
}
