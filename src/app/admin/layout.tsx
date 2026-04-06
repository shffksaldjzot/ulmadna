'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', icon: '📊' },
  { href: '/admin/pricing', label: '단가 관리', icon: '💰' },
  { href: '/admin/banners', label: '배너 광고', icon: '🖼' },
  { href: '/admin/partners', label: '파트너 관리', icon: '🤝' },
  { href: '/admin/settings', label: '사이트 설정', icon: '⚙' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-56 bg-brown text-cream min-h-screen flex-shrink-0
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-5 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-3" onClick={closeSidebar}>
            <Image
              src="/ulmadna_icon.png"
              alt="얼마드나"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <div>
              <h1 className="text-lg font-bold">얼마드나</h1>
              <p className="text-[10px] text-cream/50">관리자</p>
            </div>
          </Link>
          {/* 모바일 닫기 버튼 */}
          <button
            onClick={closeSidebar}
            className="lg:hidden text-cream/60 hover:text-cream text-xl p-1"
            aria-label="사이드바 닫기"
          >
            ✕
          </button>
        </div>
        <nav className="mt-4">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-cream/10 text-gold font-medium'
                  : 'text-cream/60 hover:bg-cream/5 hover:text-cream'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 w-56 p-4 border-t border-cream/10">
          <Link href="/" className="text-xs text-cream/40 hover:text-cream transition-colors">
            ← 사이트로 돌아가기
          </Link>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 min-w-0">
        {/* 모바일 헤더 */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="메뉴 열기"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600">
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700">
            {NAV_ITEMS.find(item => item.href === pathname)?.label || '관리자'}
          </span>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
