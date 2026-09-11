// ──────────────────────────────────────────────
// v1 허브 — 하단 탭 (모바일 전용, 최대 5개)
// 홈 · 계산기 · 시세 · 질문 · 내 정보 중 실제 화면이 있는 것만 보여준다(2026-09-11 기준 2개).
// PC(lg 이상)에서는 숨긴다.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconCalc, IconHome, IconPrice, IconQuestion, IconUser } from './icons';

// 2026-09-11 형아 지시: 계산기 경로를 /v1/calc/* → /calc/* 로 승격(본서비스 이전).
// 예전에는 도배·바닥재 계산기가 모두 /v1/calc/ 밑에 있어 startsWith('/v1/calc') 하나로 다 잡혔지만,
// 지금은 홈(/calc)과 계산기들(/calc/wallpaper, /calc/flooring)이 같은 깊이라 각각 따로 짚어야 한다.

// 2026-09-11 검사관 지적: 시세(/calc/price)·질문(/calc/q)·내 정보(/calc/me)는 아직 실제 화면이
// 없어서 누르면 404가 난다. 페이지가 만들어질 때까지 하단 탭에서 숨겨둔다.
// → 나중에 페이지가 생기면 이 값을 true로 바꾸기만 하면 다시 보인다.
const SHOW_UNFINISHED_TABS = false;

// unfinished: true 인 항목은 SHOW_UNFINISHED_TABS가 false일 때 화면에서 걸러진다(아래 filter)
const ALL_TABS = [
  { href: '/calc', label: '홈', Icon: IconHome, match: (p: string) => p === '/calc', unfinished: false },
  {
    href: '/calc/wallpaper',
    label: '계산기',
    Icon: IconCalc,
    match: (p: string) => p.startsWith('/calc/wallpaper') || p.startsWith('/calc/flooring'),
    unfinished: false,
  },
  { href: '/calc/price', label: '시세', Icon: IconPrice, match: (p: string) => p.startsWith('/calc/price'), unfinished: true },
  { href: '/calc/q', label: '질문', Icon: IconQuestion, match: (p: string) => p.startsWith('/calc/q'), unfinished: true },
  { href: '/calc/me', label: '내 정보', Icon: IconUser, match: (p: string) => p.startsWith('/calc/me'), unfinished: true },
];

// 실제로 보여줄 탭만 골라낸다 — 남은 탭들이 flex-1 이라 개수가 줄어도 폭이 자동으로 균등 배치된다
const TABS = ALL_TABS.filter((t) => SHOW_UNFINISHED_TABS || !t.unfinished);

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
