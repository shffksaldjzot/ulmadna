// ─────────────────────────────────────────────────────────────
// 광고주 화면 공용 부품 — 틀(머리·아래 탭)·카드·단추 모양 (2026년 10월 31일)
//
// [디자인 규칙] globals.css 정본 토큰만 쓴다.
//   크림 바탕(bg-bg)·흰 카드(bg-surface)·갈색 제목(text-brown)·강조색 한 가지(accent, 화면당 주 단추 하나)
//   휴대폰 390px 기본, 누르는 곳은 높이 44px 이상. PC 에서는 가운데 560px 폭.
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import type { ReactNode } from 'react';
import LogoutButton from './LogoutButton';

/** 입력칸 모양(높이 48px) */
export const inputCls =
  'w-full h-12 rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink placeholder:text-ink-2/60 focus:outline-none focus:border-accent';
/** 주 단추(강조색, 화면당 하나) */
export const primaryBtn =
  'w-full h-12 rounded-xl bg-accent text-white text-[16px] font-semibold active:bg-accent-press disabled:opacity-40 disabled:active:bg-accent';
/** 보조 단추(테두리) */
export const ghostBtn =
  'h-11 px-4 rounded-xl border border-line bg-surface text-[15px] text-ink font-medium active:bg-bg disabled:opacity-40';

/** 흰 카드 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card bg-surface border border-line p-4 ${className}`}>{children}</div>;
}

/** DB 가 안 될 때 한 줄 */
export function NotReady() {
  return <p className="py-10 text-center text-[15px] text-ink-2">준비 중이에요</p>;
}

/** 로그인 전 화면 틀(가입·로그인) */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-bg px-4 pt-10 pb-16">
      <div className="mx-auto w-full max-w-[420px]">
        <Link href="/" className="inline-block text-[14px] font-semibold text-ink-2 h-11 leading-[44px]">얼마드나 광고주</Link>
        <h1 className="mt-2 mb-6 text-[24px] font-bold text-brown">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** 아래 탭 한 칸 */
const TABS = [
  { href: '/partner', label: '내 광고' },
  { href: '/partner/stats', label: '노출 추이' },
  { href: '/partner/billing', label: '결제 기록' },
  { href: '/partner/account', label: '내 정보' },
] as const;

/** 로그인 뒤 화면 틀: 머리(업체명·로그아웃) + 본문 + 아래 탭 */
export function PartnerShell({ name, active, children }: { name: string; active: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[560px] items-center justify-between px-4">
          <div className="min-w-0">
            <p className="text-[12px] text-ink-2">얼마드나 광고주</p>
            <p className="truncate text-[15px] font-semibold text-ink">{name || '업체'}</p>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-[560px] px-4 pt-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface">
        <div className="mx-auto grid max-w-[560px] grid-cols-4">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex h-14 items-center justify-center text-[14px] ${active === t.href ? 'font-bold text-brown' : 'text-ink-2'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
