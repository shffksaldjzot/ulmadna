// ──────────────────────────────────────────────
// 공용 하단 탭 — 모바일 전용. 홈 · 계산기 · 블로그 · 본 글·저장 · 문의 5칸.
//
// 2026-09-15 형아 지시(디자인 통일 작업 A): 계산기에만 있던 2칸(홈·계산기) 탭을
// 없애고, 블로그·본 글·저장까지 4칸으로 늘려서 모든 페이지 하단에 똑같이 붙인다.
// SiteFooter 안에서 항상 같이 렌더되므로, 페이지마다 따로 이 컴포넌트를 불러올 필요는 없다.
//
// 도배·미장·바닥재 계산기 화면(입력·결과)은 이미 자체 "다음/공유" 고정 버튼이 화면 하단에
// 있어서(z-40, h-14) 이 탭과 겹친다 — 그래서 그 화면들에는 SiteFooter를 붙이지 않는다
// (계산기 작업 중에는 탭 대신 그 화면의 액션 버튼이 하단을 쓰는 게 맞다).
//
// 2026-09-16 형아 지시(직접 서비스 CTA): 5번째 칸 "문의"를 추가. 다른 탭과 달리 페이지
// 이동이 아니라 공용 문의 시트(ContactSheet)를 여는 버튼이라 <Link> 대신 <button>으로 그린다.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconCalc, IconBlog, IconBookmark, IconQuestion } from '@/components/v1/icons';
import { openContactSheet } from '@/lib/contactSheet';

const TABS = [
  { href: '/', label: '홈', Icon: IconHome, match: (p: string) => p === '/' },
  { href: '/calc', label: '계산기', Icon: IconCalc, match: (p: string) => p.startsWith('/calc') },
  {
    href: '/blog',
    label: '블로그',
    Icon: IconBlog,
    match: (p: string) => p.startsWith('/blog') && !p.startsWith('/blog/my'),
  },
  // 2026-09-15: "내 글"이라고 하면 내가 직접 쓴 글로 오해할 수 있어서(블로그팀 수정과 동일 이유)
  // 라벨을 "본 글·저장"으로 맞췄다 — /blog/my 페이지 제목·공유 문구와 일치시킴
  { href: '/blog/my', label: '본 글·저장', Icon: IconBookmark, match: (p: string) => p.startsWith('/blog/my') },
];

export default function BottomTabs() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="하단 메뉴"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {TABS.map(({ href, label, Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-14 ${
              active ? 'text-accent' : 'text-ink-2'
            }`}
          >
            <Icon />
            <span className={`text-[11px] ${active ? 'font-semibold' : ''}`}>{label}</span>
          </Link>
        );
      })}
      {/* 문의 — 페이지 이동이 아니라 공용 문의 시트를 여는 버튼이라 다른 탭과 마크업만 다르고
          모양(크기·간격)은 똑같이 맞췄다. 이 탭은 활성/비활성 구분이 없다(시트 열림 여부는
          현재 경로와 무관해서). */}
      <button
        type="button"
        onClick={() => openContactSheet('tab')}
        className="flex-1 flex flex-col items-center justify-center gap-1 h-14 text-ink-2"
      >
        <IconQuestion />
        <span className="text-[11px]">문의</span>
      </button>
    </nav>
  );
}
