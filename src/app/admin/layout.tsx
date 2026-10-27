'use client';
// ──────────────────────────────────────────────
// 관리자 공통 틀 — 상단 탭 방식 (2026-10-28 개편)
//
// [무슨 기능인가]
//   화면 맨 위에 탭이 가로로 놓이고, 눌러서 화면을 옮긴다. 모바일에선 탭 줄이 옆으로 밀린다.
//   앞쪽 7개가 새 관리 화면, 뒤쪽 5개는 옛 자료(옛 견적 DB·샘플 화면)라 흐리게 따로 둔다.
// ──────────────────────────────────────────────
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

/** 새 관리 화면 탭 */
const MAIN_TABS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/ga', label: 'GA' },
  { href: '/admin/calc', label: '계산기' },
  { href: '/admin/posts', label: '글 조회수' },
  { href: '/admin/ask', label: '물어보기' },
  { href: '/admin/members', label: '회원' },
  { href: '/admin/ads', label: '광고 자리' },
];

/** 옛 자료 탭(그대로 유지) */
const OLD_TABS = [
  { href: '/admin/users', label: '견적 사용자' },
  { href: '/admin/pricing', label: '단가' },
  { href: '/admin/banners', label: '배너' },
  { href: '/admin/partners', label: '파트너' },
  { href: '/admin/settings', label: '설정' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 현재 화면의 탭인지(대시보드는 정확히 /admin 일 때만)
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));

  const tab = (t: { href: string; label: string }, old = false) => (
    <Link
      key={t.href}
      href={t.href}
      className={`shrink-0 px-3 py-2.5 text-sm border-b-2 transition-colors ${
        isActive(t.href)
          ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
          : `border-transparent hover:text-gray-800 ${old ? 'text-gray-300' : 'text-gray-500'}`
      }`}
    >
      {t.label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 sm:px-6 pt-3">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <Image src="/ulmadna_icon.png" alt="얼마드나" width={28} height={28} className="rounded-md" />
            <span className="text-sm font-bold text-gray-800">얼마드나 관리자</span>
          </Link>
          <Link href="/" className="ml-auto text-xs text-gray-400 hover:text-gray-700 shrink-0">
            사이트로 →
          </Link>
        </div>
        {/* 탭 줄: 좁은 화면에선 옆으로 밀어서 본다 */}
        <nav className="flex overflow-x-auto px-2 sm:px-4 mt-1" aria-label="관리자 메뉴">
          {MAIN_TABS.map((t) => tab(t))}
          <span className="shrink-0 w-px bg-gray-200 my-2 mx-2" aria-hidden />
          {OLD_TABS.map((t) => tab(t, true))}
        </nav>
      </header>
      <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto min-w-0">{children}</main>
    </div>
  );
}
