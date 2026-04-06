'use client';

import Link from 'next/link';
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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 사이드바 */}
      <aside className="w-56 bg-brown text-cream min-h-screen flex-shrink-0">
        <div className="p-5">
          <Link href="/admin" className="block">
            <h1 className="text-lg font-bold">얼마드나</h1>
            <p className="text-[10px] text-cream/50 mt-0.5">관리자</p>
          </Link>
        </div>
        <nav className="mt-4">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
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
      <main className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
