// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 범위 칩 (전체 / 방만 / 거실·주방·복도)
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 3-12절 — 도배 ConditionChips.tsx와 같은 이유로
// 범위는 더 이상 단계 안에 있지 않고 "조정 칩" 구역(결과 위, 간단 모드에서만)으로 옮겼다.
// 그래서 이 부품은 라벨·테두리 없이 칩 세 개만 그린다 — "범위" 라벨은 조정 칩 구역
// (AdjustChips)이 공용으로 붙여 준다.
//
// 도배의 범위(벽/천장)는 "둘 다 켤 수 있는" 독립 토글이지만, 바닥재의 범위는 전체/방만/
// 거실·주방·복도 셋 중 하나만 고르는 배타적 선택이다(예전과 같다).
//
// 작성일: 2026년 09월 10일
// 조정 칩으로 이동(라벨·테두리 제거): 2026년 09월 27일 (지시서 9장)
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import type { FlooringScope } from '@/lib/v1/flooringQuery';

export interface ScopeChipsProps {
  /** 범위 — 전체 / 방만 / 거실·주방·복도 (욕실·현관은 항상 제외) */
  scope: FlooringScope;
  onScopeChange: (v: FlooringScope) => void;
}

export default function ScopeChips({ scope, onScopeChange }: ScopeChipsProps) {
  return (
    <>
      {/* 하나만 고르는 배타적 선택이라 asRadio — AdjustChips가 감싼 ChipGroup(role="radiogroup")과 짝 */}
      <Chip asRadio selected={scope === '전체'} onClick={() => onScopeChange('전체')}>
        전체
      </Chip>
      <Chip asRadio selected={scope === '방만'} onClick={() => onScopeChange('방만')}>
        방만
      </Chip>
      <Chip asRadio selected={scope === '거실주방'} onClick={() => onScopeChange('거실주방')}>
        거실·주방·복도
      </Chip>
    </>
  );
}
