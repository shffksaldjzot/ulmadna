// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 범위(벽·천장) 칩
//
// 2026-09-27 지시서(계산기 단계 흐름 개선) 3-12절: 범위는 더 이상 단계 안에 있지 않고
// "조정 칩" 구역(결과 위)으로 옮겼다. 그래서 이 부품은 이제 라벨·테두리 없이 칩 두 개만
// 그린다 — "범위" 라벨은 조정 칩 구역(AdjustChips)이 공용으로 붙여 준다.
//
// 작성일: 2026년 09월 09일
// 조정 칩으로 이동(라벨·테두리 제거): 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';

export interface ConditionChipsProps {
  /** 도배 대상 — 벽+천장 / 벽만 / 천장만 */
  target: 'wall' | 'ceiling' | 'both';
  onTargetChange: (v: 'wall' | 'ceiling' | 'both') => void;
}

export default function ConditionChips({ target, onTargetChange }: ConditionChipsProps) {
  return (
    <>
      {/* 벽·천장을 각각 켜고 끈다. 둘 다 끄는 건 막는다(마지막 하나는 안 꺼짐) */}
      <Chip
        selected={target !== 'ceiling'}
        onClick={() => onTargetChange(target === 'both' ? 'ceiling' : target === 'ceiling' ? 'both' : 'wall')}
      >
        벽
      </Chip>
      <Chip
        selected={target !== 'wall'}
        onClick={() => onTargetChange(target === 'both' ? 'wall' : target === 'wall' ? 'both' : 'ceiling')}
      >
        천장
      </Chip>
    </>
  );
}
