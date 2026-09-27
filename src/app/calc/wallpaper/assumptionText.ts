// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 가정 목록(assumed) → 화면 문구
//
// 2026-09-27 지휘관 확정 표(계산 담당 useWallpaperCalc.assumed와 짝):
//   'area'      → "34평 가정"
//   'product'   → "제품 미정"
//   'bay'       → "3베이 가정" (간단 모드에서만 온다 — 계산 담당 쪽에서 이미 정확 모드엔 안 넣는다)
//   'scope'     → "벽·천장 가정"
//   'measuring' → "실측 입력 중" — 이 값이 있으면 다른 건 다 무시하고 이것만 단독으로 보여준다
// 여러 개면 가운뎃점(·)으로 이어 한 줄로 만든다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import type { WallpaperAssumption } from '@/lib/v1/wallpaperEngineInput';

/** 가정 값 하나 → 화면 문구 조각 */
const ASSUMPTION_LABEL: Record<Exclude<WallpaperAssumption, 'measuring'>, string> = {
  area: '34평 가정',
  product: '제품 미정',
  bay: '3베이 가정',
  scope: '벽·천장 가정',
};

/**
 * 가정 목록 → 결과 카드 "가정 줄"에 쓸 한 줄 문구. 가정이 하나도 없으면 null(가정 줄 자체를 안 그린다).
 * 'measuring'(실측 입력 중)이 섞여 있으면 다른 가정은 다 무시하고 이 문구만 단독으로 보여준다
 * — 지금은 "계산 중" 개념이라 다른 가정을 같이 나열하면 오히려 헷갈린다(지휘관 확정 규칙).
 */
export function describeWallpaperAssumptions(assumed: WallpaperAssumption[]): string | null {
  if (assumed.length === 0) return null;
  if (assumed.includes('measuring')) return '실측 입력 중';
  const parts = assumed
    .filter((a): a is Exclude<WallpaperAssumption, 'measuring'> => a !== 'measuring')
    .map((a) => ASSUMPTION_LABEL[a]);
  return parts.length > 0 ? parts.join(' · ') : null;
}
