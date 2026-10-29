'use client';
// ──────────────────────────────────────────────
// 관리자 공통 틀 — PC 왼쪽 사이드바 + 모바일 상단 탭 (2026-10-30 개편)
//
// [무슨 기능인가]
//   - PC(가로 1024px 이상): 4월 판처럼 왼쪽에 진한 갈색 사이드바를 고정한다.
//     위에 로고, 가운데 메뉴(새 관리 화면 7개 + 옛 자료 5개), 맨 아래 "사이트로"·"로그아웃".
//     지금 보고 있는 화면은 금색 글자 + 왼쪽 금색 세로줄로 표시한다.
//   - 모바일·태블릿: 사이드바는 숨기고, 10-28 판처럼 맨 위에 가로로 밀리는 탭 줄을 둔다.
//   - 본문은 사이드바 폭(14rem)만큼 비켜서 넓게 쓴다.
//   - 마우스를 올리거나 키보드로 옮겨 가면 색이 바뀌어 반응한다(admin.css 에 공통 규칙).
// ──────────────────────────────────────────────
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
// 관리자 화면 전체 호버·포커스·전환 규칙(이 틀 안에서만 적용)
import './admin.css';

/** 새 관리 화면 메뉴 */
const MAIN_TABS = [
  { href: '/admin', label: '대시보드' },
  { href: '/admin/ga', label: 'GA' },
  { href: '/admin/calc', label: '계산기' },
  { href: '/admin/posts', label: '글 조회수' },
  { href: '/admin/ask', label: '물어보기' },
  { href: '/admin/members', label: '회원' },
  { href: '/admin/ads', label: '광고 자리' },
];

/** 옛 자료 메뉴(그대로 유지, 흐리게) */
const OLD_TABS = [
  { href: '/admin/users', label: '견적 사용자' },
  { href: '/admin/pricing', label: '단가' },
  { href: '/admin/banners', label: '배너' },
  { href: '/admin/partners', label: '파트너' },
  { href: '/admin/settings', label: '설정' },
];

/** 로그아웃 단추 — 쿠키를 지우고 로그인 화면으로 보낸다 */
function LogoutButton({ className }: { className: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin-auth', { method: 'DELETE' });
    } finally {
      // 실패해도 로그인 화면으로 보낸다(쿠키가 남았으면 다시 들어오면 그만)
      router.replace('/admin-login');
    }
  };
  return (
    <button type="button" onClick={run} disabled={busy} className={className}>
      {busy ? '나가는 중…' : '로그아웃'}
    </button>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // 현재 화면의 메뉴인지(대시보드는 정확히 /admin 일 때만)
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/'));

  /** PC 사이드바 메뉴 한 줄 */
  const sideItem = (t: { href: string; label: string }, old = false) => {
    const on = isActive(t.href);
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={on ? 'page' : undefined}
        className={`relative flex items-center px-5 py-2.5 text-sm transition-colors duration-150 ${
          on
            ? 'bg-cream/10 text-gold font-semibold'
            : `${old ? 'text-cream/35' : 'text-cream/70'} hover:bg-cream/5 hover:text-cream`
        }`}
      >
        {/* 현재 위치 표시: 왼쪽 금색 세로줄 */}
        {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-gold" aria-hidden />}
        {t.label}
      </Link>
    );
  };

  /** 모바일 상단 탭 한 칸 */
  const topTab = (t: { href: string; label: string }, old = false) => (
    <Link
      key={t.href}
      href={t.href}
      aria-current={isActive(t.href) ? 'page' : undefined}
      className={`shrink-0 px-3 py-2.5 text-sm border-b-2 transition-colors duration-150 ${
        isActive(t.href)
          ? 'border-[var(--accent)] text-[var(--accent)] font-semibold'
          : `border-transparent hover:text-gray-800 hover:border-gray-200 ${old ? 'text-gray-300' : 'text-gray-500'}`
      }`}
    >
      {t.label}
    </Link>
  );

  return (
    <div className="admin-scope min-h-screen bg-gray-50">
      {/* ── PC 사이드바(lg 이상에서만 보임) ── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-56 flex-col bg-brown text-cream">
        <Link href="/admin" className="flex items-center gap-3 px-5 py-5 transition-opacity duration-150 hover:opacity-85">
          {/* 로고 그림이 검은 글자라 진한 갈색 바탕에서 묻히지 않게 크림색 받침을 깐다 */}
          <span className="shrink-0 rounded-lg bg-cream p-1">
            <Image src="/ulmadna_icon.png" alt="얼마드나" width={28} height={28} className="rounded-md" />
          </span>
          <span>
            <span className="block text-base font-bold leading-tight">얼마드나</span>
            <span className="block text-[11px] text-cream/50">관리자</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-2" aria-label="관리자 메뉴">
          {MAIN_TABS.map((t) => sideItem(t))}
          <div className="mx-5 my-3 h-px bg-cream/10" aria-hidden />
          {OLD_TABS.map((t) => sideItem(t, true))}
        </nav>
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-cream/10 text-xs">
          <Link href="/" className="text-cream/50 transition-colors duration-150 hover:text-cream">
            ← 사이트로
          </Link>
          <LogoutButton className="rounded px-2 py-1 text-cream/50 transition-colors duration-150 hover:bg-cream/10 hover:text-cream disabled:opacity-50" />
        </div>
      </aside>

      {/* ── 모바일 상단 머리(lg 미만에서만 보임) ── */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 sm:px-6 pt-3">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <Image src="/ulmadna_icon.png" alt="얼마드나" width={28} height={28} className="rounded-md" />
            <span className="text-sm font-bold text-gray-800">얼마드나 관리자</span>
          </Link>
          <Link href="/" className="ml-auto text-xs text-gray-400 hover:text-gray-700 shrink-0">
            사이트로 →
          </Link>
          <LogoutButton className="text-xs text-gray-400 hover:text-gray-700 shrink-0 disabled:opacity-50" />
        </div>
        {/* 탭 줄: 좁은 화면에선 옆으로 밀어서 본다 */}
        <nav className="flex overflow-x-auto px-2 sm:px-4 mt-1" aria-label="관리자 메뉴">
          {MAIN_TABS.map((t) => topTab(t))}
          <span className="shrink-0 w-px bg-gray-200 my-2 mx-2" aria-hidden />
          {OLD_TABS.map((t) => topTab(t, true))}
        </nav>
      </header>

      {/* ── 본문: PC 에선 사이드바 폭만큼 비켜서 넓게 ── */}
      <main className="lg:pl-56 min-w-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto min-w-0">{children}</div>
      </main>
    </div>
  );
}
