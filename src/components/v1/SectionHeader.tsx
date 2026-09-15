// ──────────────────────────────────────────────
// v1 허브 — 섹션 제목 + "더 보기" 부품
// ──────────────────────────────────────────────

import Link from 'next/link';

interface SectionHeaderProps {
  title: string;
  moreHref?: string;
}

export default function SectionHeader({ title, moreHref }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="t-section text-ink">{title}</h2>
      {moreHref && (
        <Link href={moreHref} className="t-sub font-semibold text-accent">
          더 보기
        </Link>
      )}
    </div>
  );
}
