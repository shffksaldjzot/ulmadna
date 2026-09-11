// ──────────────────────────────────────────────
// v1 허브 — 하단 탭 (모바일 전용, 5개 고정)
// 홈 · 계산기 · 시세 · 질문 · 내 정보. PC(lg 이상)에서는 숨긴다.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCalc, IconHome, IconPrice, IconQuestion, IconUser } from './icons';

// 2026-09-11 형아 지시: 계산기 경로를 /v1/calc/* → /calc/* 로 승격(본서비스 이전).
// 예전에는 도배·바닥재 계산기가 모두 /v1/calc/ 밑에 있어 startsWith('/v1/calc') 하나로 다 잡혔지만,
// 지금은 홈(/calc)과 계산기들(/calc/wallpaper, /calc/flooring)이 같은 깊이라 각각 따로 짚어야 한다.
const TABS = [
  { href: '/calc', label: '홈', Icon: IconHome, match: (p: string) => p === '/calc' },
  {
    href: '/calc/wallpaper',
    label: '계산기',
    Icon: IconCalc,
    match: (p: string) => p.startsWith('/calc/wallpaper') || p.startsWith('/calc/flooring'),
  },
  { href: '/calc/price', label: '시세', Icon: IconPrice, match: (p: string) => p.startsWith('/calc/price') },
  { href: '/calc/q', label: '질문', Icon: IconQuestion, match: (p: string) => p.startsWith('/calc/q') },
  { href: '/calc/me', label: '내 정보', Icon: IconUser, match: (p: string) => p.startsWith('/calc/me') },
];

export default function BottomTab() {
  const pathname = usePathname() ?? '/calc';

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
