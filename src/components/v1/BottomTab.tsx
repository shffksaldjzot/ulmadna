// ──────────────────────────────────────────────
// v1 허브 — 하단 탭 (모바일 전용, 5개 고정)
// 홈 · 계산기 · 시세 · 질문 · 내 정보. PC(lg 이상)에서는 숨긴다.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCalc, IconHome, IconPrice, IconQuestion, IconUser } from './icons';

const TABS = [
  { href: '/v1', label: '홈', Icon: IconHome, match: (p: string) => p === '/v1' },
  { href: '/v1/calc/wallpaper', label: '계산기', Icon: IconCalc, match: (p: string) => p.startsWith('/v1/calc') },
  { href: '/v1/price', label: '시세', Icon: IconPrice, match: (p: string) => p.startsWith('/v1/price') },
  { href: '/v1/q', label: '질문', Icon: IconQuestion, match: (p: string) => p.startsWith('/v1/q') },
  { href: '/v1/me', label: '내 정보', Icon: IconUser, match: (p: string) => p.startsWith('/v1/me') },
];

export default function BottomTab() {
  const pathname = usePathname() ?? '/v1';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white border-t border-v1-line flex">
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 ${
              active ? 'text-brown' : 'text-v1-text-disabled'
            }`}
          >
            <Icon />
            <span className={`text-[16px] ${active ? 'font-semibold' : ''}`}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
