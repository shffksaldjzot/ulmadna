// ──────────────────────────────────────────────
// v1 허브 — 상단 내비 (모바일 56px / PC 64px)
// 모바일: 로고 + 로그인(또는 뒤로가기 + 제목 + 조건 바꾸기 — 화면별로 props로 바꿔 끼움)
// PC(lg 이상): 로고 + 메뉴 + 검색 + 로그인. 하단 탭 대신 여기서 내비게이션.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { IconBack, IconSearch } from './icons';

interface TopNavProps {
  /** 뒤로가기 화살표 + 제목을 보여주는 하위 페이지용 헤더 */
  title?: string;
  backHref?: string;
  /** 제목 오른쪽에 텍스트 버튼(예: "조건 바꾸기")을 붙이고 싶을 때 */
  rightSlot?: React.ReactNode;
}

const PC_MENU = [
  { href: '/v1/calc/wallpaper', label: '계산기' },
  { href: '/v1/price', label: '시세' },
  { href: '/v1/q', label: '질문' },
  { href: '/blog', label: '블로그' },
];

export default function TopNav({ title, backHref, rightSlot }: TopNavProps) {
  const pathname = usePathname() ?? '/v1';
  const { data: session } = useSession();
  const loggedIn = !!session?.user;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-v1-line">
      {/* ── 모바일 56px ── */}
      <div className="lg:hidden h-14 flex items-center justify-between px-4">
        {title ? (
          <div className="flex items-center gap-3 min-w-0">
            <Link href={backHref ?? '/v1'} aria-label="뒤로가기" className="text-brown flex-none">
              <IconBack />
            </Link>
            <h1 className="text-[20px] font-bold text-foreground truncate">{title}</h1>
          </div>
        ) : (
          <Link href="/v1" className="flex-none">
            {/* 라이브 사이트(src/app/page.tsx)와 같은 비율(약 2.95:1)로 맞춤 — 왜곡 방지 */}
            <Image src="/ulmadna_logo.png" alt="얼마드나" height={22} width={65} className="h-[22px] w-auto" priority />
          </Link>
        )}
        {rightSlot ?? (
          <Link href={loggedIn ? '/v1/me' : '/v1/login'} className="text-[16px] font-semibold text-brown flex-none">
            {loggedIn ? '내 정보' : '로그인'}
          </Link>
        )}
      </div>

      {/* ── PC 64px ── */}
      <div className="hidden lg:flex h-16 items-center gap-6 px-8">
        <Link href="/v1" className="flex-none">
          <Image src="/ulmadna_logo.png" alt="얼마드나" height={26} width={77} className="h-[26px] w-auto" priority />
        </Link>
        <nav className="flex gap-5 text-[16px]">
          {PC_MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={pathname.startsWith(m.href) ? 'font-semibold text-brown' : 'text-foreground'}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1 max-w-[420px] mx-auto h-10 border border-v1-line-3 rounded-[4px] flex items-center gap-2 px-3">
          <IconSearch className="text-v1-text-label" />
          <span className="text-[16px] text-v1-text-disabled">도배 34평 얼마</span>
        </div>
        <Link href={loggedIn ? '/v1/me' : '/v1/login'} className="text-[16px] font-semibold text-brown">
          {loggedIn ? '내 정보' : '로그인'}
        </Link>
      </div>
    </header>
  );
}
