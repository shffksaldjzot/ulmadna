// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 조정 칩 구역
//
// 지시서 3-12절: 범위·베이·공법 같은 보조 값은 단계에서 빼서 결과 위 조정 칩으로 옮긴다.
//   - 자리: 단계들 아래, 결과 카드 바로 위. 결과가 있을 때만 보인다.
//   - 카드 아님(테두리·배경 없음). 작은 라벨 + 칩.
//   - 여기 있는 값은 단계 완료와 상관없다. 기본값으로 계산하고, 바꾸면 결과가 바로 바뀐다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import type { AdjustChipGroup } from './types';

export interface AdjustChipsProps {
  /** 결과가 아직 없으면 이 구역 전체를 그리지 않는다(3-12절) */
  visible: boolean;
  groups: AdjustChipGroup[];
}

export default function AdjustChips({ visible, groups }: AdjustChipsProps) {
  if (!visible || groups.length === 0) return null;
  return (
    // flowFocusScope: 조정 칩도 새 틀 부품이라 같은 초점 테두리 규칙을 쓴다(2026-09-27 지적 5번)
    <div className="flex flex-col gap-3 flowFocusScope">
      {groups.map((g) => (
        <div key={g.key} className="flex items-center gap-2 flex-wrap">
          <span className="t-sub text-ink-2 flex-none">{g.label}</span>
          {g.children}
        </div>
      ))}
    </div>
  );
}
