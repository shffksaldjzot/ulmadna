// ──────────────────────────────────────────────
// v1 허브 — 홈 "계산기" 섹션 타일 부품
// 도배만 실제로 연결되어 있고 나머지는 "준비 중" 상태(비활성 색, 클릭 불가).
// 올수리만 골드 배경(활성 여부와 무관하게 강조).
// ──────────────────────────────────────────────

import Link from 'next/link';

interface CalcTileProps {
  name: string;
  href?: string;
  /** true면 올수리처럼 골드 배경으로 강조 */
  gold?: boolean;
}

export default function CalcTile({ name, href, gold }: CalcTileProps) {
  const shell =
    'min-h-[72px] lg:min-h-[76px] rounded-[4px] border p-[14px] lg:p-4 flex flex-col justify-center gap-1 box-border';

  if (href) {
    return (
      <Link
        href={href}
        className={`${shell} ${
          gold ? 'border-gold bg-v1-gold-tile' : 'border-v1-line bg-white'
        }`}
      >
        <span className={`text-[16px] font-bold ${gold ? 'text-brown' : 'text-foreground'}`}>{name}</span>
      </Link>
    );
  }

  // 아직 안 만든 계산기 — 클릭 불가, "준비 중" 색으로 표시
  return (
    <div
      className={`${shell} ${gold ? 'border-gold bg-v1-gold-tile' : 'border-v1-line bg-white'} cursor-not-allowed`}
      aria-disabled
    >
      <span className={`text-[16px] font-bold ${gold ? 'text-brown' : 'text-v1-text-disabled'}`}>{name}</span>
      <span className="text-[14px] text-v1-text-disabled">준비 중</span>
    </div>
  );
}
