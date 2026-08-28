// ──────────────────────────────────────────────
// v1 허브 — 광고 슬롯 부품 (점선 박스 + "광고" 라벨)
// 실제 애드센스 연결은 이후 단계. 지금은 자리만 잡아 둔다.
// ──────────────────────────────────────────────

interface AdSlotProps {
  /** 모바일 기본 320×100, PC 사이드는 300×250 */
  size?: '320x100' | '300x250';
  className?: string;
}

export default function AdSlot({ size = '320x100', className = '' }: AdSlotProps) {
  const height = size === '300x250' ? 'h-[250px]' : 'h-[100px]';
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <span className="text-[14px] text-v1-text-disabled">광고</span>
      <div
        className={`${height} border border-dashed border-v1-line-3 rounded-[4px] flex items-center justify-center text-[16px] text-v1-text-disabled font-mono`}
      >
        {size === '300x250' ? '애드센스 300×250' : '애드센스 320×100'}
      </div>
    </div>
  );
}
