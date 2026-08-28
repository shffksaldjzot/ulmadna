// ──────────────────────────────────────────────
// v1 허브 — 플로팅 풍선 부품 (저장 · 공유)
// 우측 하단 고정, 하단 고정 버튼/하단 탭보다 16px 위에 떠 있어야 한다.
// 배치(고정 위치)는 이 컴포넌트를 쓰는 화면에서 wrapper로 감싸서 맞춘다.
// ──────────────────────────────────────────────

'use client';

import { IconBookmark, IconShare } from './icons';

interface FabButtonProps {
  icon: 'save' | 'share';
  label: string;
  active?: boolean;
  onClick?: () => void;
}

/** 풍선 하나(저장 또는 공유) */
function FabButton({ icon, label, active, onClick }: FabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'h-12 px-[18px] rounded-full border flex items-center gap-2 text-[16px] font-semibold transition-colors duration-150 shadow-md ' +
        (active
          ? 'bg-brown border-brown text-white'
          : 'bg-white border-gold text-brown active:bg-cream')
      }
    >
      {icon === 'save' ? <IconBookmark filled={active} /> : <IconShare />}
      {label}
    </button>
  );
}

interface FabProps {
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  className?: string;
}

/** 저장·공유 풍선 2개를 세로로 쌓아 보여준다 */
export default function Fab({ saved, onSave, onShare, className = '' }: FabProps) {
  return (
    <div className={`flex flex-col gap-2 items-end ${className}`}>
      <FabButton icon="save" label={saved ? '저장됨' : '저장'} active={saved} onClick={onSave} />
      <FabButton icon="share" label="공유" onClick={onShare} />
    </div>
  );
}
