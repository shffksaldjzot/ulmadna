// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기: 범위 칩 (전체 / 방만 / 거실·주방·복도)
//
// 이 파일이 하는 일:
//   "간단하게 계산하기"(QuickAnswer)와 "정확하게 계산하기"(PreciseSection) 두 카드가
//   똑같이 쓰는 칸이라 여기 하나로 뺐다 — 도배 계산기의 ConditionChips와 같은 자리다.
//   다만 도배의 범위(벽/천장)는 "둘 다 켤 수 있는" 독립 토글이지만, 바닥재의 범위는
//   전체/방만/거실·주방·복도 셋 중 하나만 고르는 배타적 선택이다.
//
//   2026-09-10 검사관 1라운드 지적 13번: 엔진의 "거실주방" 범위는 복도·기타 공용공간도
//   같이 포함하는데 칩 라벨이 "거실·주방"만 적혀 있어 실제 계산 범위와 어긋나 보였다.
//   라벨만 "거실·주방·복도"로 고쳤다(값 자체 '거실주방'은 그대로 — 공유 링크 호환).
//
//   상태는 이 컴포넌트가 갖지 않는다. 부르는 쪽(QuickAnswer·PreciseSection)이 폼
//   상태를 그대로 들고 있고, 여기서는 "값 + 바꾸는 함수"만 받아 쓴다.
//
// 작성일: 2026년 09월 10일
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
    <div className="flex flex-col gap-3 pt-2 border-t border-v1-line-2">
      <div className="flex flex-col gap-1">
        <span className="text-[14px] text-v1-text-label">범위</span>
        <div className="flex gap-2">
          <Chip selected={scope === '전체'} onClick={() => onScopeChange('전체')}>
            전체
          </Chip>
          <Chip selected={scope === '방만'} onClick={() => onScopeChange('방만')}>
            방만
          </Chip>
          <Chip selected={scope === '거실주방'} onClick={() => onScopeChange('거실주방')}>
            거실·주방·복도
          </Chip>
        </div>
      </div>
    </div>
  );
}
