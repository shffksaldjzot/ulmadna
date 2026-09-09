// ──────────────────────────────────────────────
// v1 허브 — 도배 계산기: 범위·지역·상태 칩 3줄 (공용 부품)
//
// 이 파일이 하는 일:
//   "간단하게 계산하기"(QuickAnswer)와 "정확하게 계산하기"(PreciseSection) 두 카드가
//   똑같이 쓰는 칸이라 여기 하나로 뺐다. 벽지 종류는 이제 벽지 카드(PaperPicker)에서
//   고르므로 이 부품에는 없다(2026-09-09 화면 재배치 — 벽지 최우선 A안).
//
//   상태는 이 컴포넌트가 갖지 않는다. 부르는 쪽(QuickAnswer·PreciseSection)이
//   폼 상태를 그대로 들고 있고, 여기서는 "값 + 바꾸는 함수"만 받아 쓴다.
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

'use client';

import Chip from '@/components/v1/Chip';
import RegionPicker from '@/components/v1/RegionPicker';

export interface ConditionChipsProps {
  /** 도배 대상 — 벽+천장 / 벽만 (이 화면은 두 개만 노출) */
  target: 'wall' | 'ceiling' | 'both';
  onTargetChange: (v: 'wall' | 'ceiling' | 'both') => void;
  /** 지역(선택). 비용에만 영향 */
  region: string | undefined;
  onRegionChange: (v: string | undefined) => void;
  /** 구축(재도배) 여부. 기본 false(신축·빈집) */
  isOld: boolean;
  onIsOldChange: (v: boolean) => void;
}

export default function ConditionChips({
  target,
  onTargetChange,
  region,
  onRegionChange,
  isOld,
  onIsOldChange,
}: ConditionChipsProps) {
  return (
    <div className="flex flex-col gap-3 pt-2 border-t border-v1-line-2">
      {/* 범위 — 벽·천장을 각각 켜고 끈다 (2026-09-09 형아 지시). 둘 다 끄는 건 막는다(마지막 하나는 안 꺼짐) */}
      <div className="flex flex-col gap-1">
        <span className="text-[14px] text-v1-text-label">범위</span>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* 지역 — 비용에만 영향, 안 골라도 계산은 된다 */}
      <div className="flex flex-col gap-1">
        <span className="text-[14px] text-v1-text-label">지역</span>
        <RegionPicker value={region} onChange={onRegionChange} />
      </div>

      {/* 상태 — 신축·빈집 / 구축·재도배 */}
      <div className="flex flex-col gap-1">
        <span className="text-[14px] text-v1-text-label">상태</span>
        <div className="flex gap-2">
          <Chip selected={!isOld} onClick={() => onIsOldChange(false)}>
            신축·빈집
          </Chip>
          <Chip selected={isOld} onClick={() => onIsOldChange(true)}>
            구축·재도배
          </Chip>
        </div>
      </div>
    </div>
  );
}
