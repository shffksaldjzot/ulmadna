// ──────────────────────────────────────────────
// 공용 상단바 — 얼마드나 전체(홈·계산기·블로그)가 이 하나만 쓴다.
//
// 2026-09-15 형아 지시(디자인 통일 작업 A): 홈·계산기·블로그 상단바가 제각각이라
// 로고 위치·문구·색이 다 달랐다. 블로그 쪽 디자인 언어(정본 토큰)로 통일하고,
// "완전 무료 · 개인정보 없음 · 전화번호 없음" 알약이 두 번 보이던 것도 로고 옆 한 번만 남긴다.
//
// 구성: 로고(→홈) · 무료 배지(로고 옆, 데스크톱만) — 가운데 계산기·블로그·본 글·저장 메뉴(데스크톱만,
// 모바일은 하단 탭이 대신함) — 오른쪽 로그인/로그아웃.
// 높이: 모바일 56px(h-14) · 데스크톱 64px(h-16). sticky.
//
// 옛 v1/TopNav.tsx가 하던 일(핀=현재 위치 강조, 로그인 상태 분기)을 그대로 가져왔고,
// 하위 페이지 제목 줄("← 도배 계산기")은 이 컴포넌트가 아니라 TopNav.tsx가 따로 붙인다
// (계산기 화면마다 제목이 달라서 레이아웃 한 곳에서 렌더할 수 없음).
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import Container from './Container';
import { openContactSheet } from '@/lib/contactSheet';

// 메뉴 3개 — 홈은 로고가 그 역할을 하므로 메뉴에 안 넣는다
const NAV_ITEMS: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: '/calc', label: '계산기', match: (p) => p.startsWith('/calc') },
  { href: '/blog', label: '블로그', match: (p) => p.startsWith('/blog') && !p.startsWith('/blog/my') },
  // 2026-09-15: "내 글"이라고 하면 내가 직접 쓴 글로 오해할 수 있어서(블로그팀 수정과 동일 이유)
  // 라벨을 "본 글·저장"으로 맞췄다 — /blog/my 페이지 제목·공유 문구와 일치시킴
  { href: '/blog/my', label: '본 글·저장', match: (p) => p.startsWith('/blog/my') },
];

export default function SiteHeader() {
  const pathname = usePathname() ?? '/';
  const { data: session } = useSession();

  return (
    // 2026-09-15 검수 수정: 반투명(bg-surface/95) + backdrop-blur 조합이 스크롤 중인
    // 글자(본문 텍스트)를 헤더 뒤로 흐릿하게 비춰서, 로고 뒤에 회색 얼룩(번짐)이 겹쳐
    // 보이는 문제가 있었다(모바일 블로그 글 스크롤 상태에서 재현·확인, 실제 스크롤에서도
    // 그대로 나타남 — 스크린샷 캡처 아티팩트 아님). 완전 불투명(bg-surface)으로 바꿔
    // 뒤 콘텐츠가 전혀 비치지 않게 한다 — 하단 탭(BottomTabs)도 원래 불투명이라 통일됨.
    <header className="sticky top-0 z-50 bg-surface border-b border-line">
      <Container as="div" className="h-14 lg:h-16 flex items-center justify-between gap-4">
        {/* 좌측: 로고 + 무료 배지(데스크톱 전용, 여기 한 번만) */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" aria-label="얼마드나 홈" className="flex-none flex items-center">
            {/* 2026-09-15 형아 지시(2차): 로고가 여전히 작다 → 원인은 원본 PNG(355×204)의 글자 영역이
                세로 34%뿐이라 44px 박스에 넣어도 글자는 15px밖에 안 됐던 것.
                글자 영역만 잘라낸 ulmadna_logo_tight.png(315×82)를 쓰고, 높이를 로그인 알약과
                똑같이 40px(h-10)로 맞춘다 — 로고 글자 높이 = 로그인 버튼 높이. */}
            <Image
              src="/ulmadna_logo_tight.png"
              alt="얼마드나"
              width={154}
              height={40}
              priority
              className="h-10 w-auto"
            />
          </Link>
          <span className="hidden lg:inline-block t-sub text-ink-2 border border-line rounded-chip px-3 py-1 whitespace-nowrap">
            완전 무료 · 개인정보 없음 · 전화번호 없음
          </span>
        </div>

        {/* 가운데: 계산기 · 블로그 · 본 글·저장 — 모바일은 하단 탭이 같은 역할을 하므로 숨김 */}
        <nav aria-label="주요 메뉴" className="hidden lg:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`t-body font-semibold transition-colors ${
                  active ? 'text-accent' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 우측: "문의" 알약(로그인 옆, 모바일도 항상 보임) + 로그인 상태에 따라 분기 */}
        <div className="flex-none flex items-center gap-3">
          {/* 2026-09-16 형아 지시: 전역 문의 진입점 — 눌리면 공용 문의 시트(전화·카톡·서비스 보기)가 뜬다 */}
          <button
            type="button"
            onClick={() => openContactSheet('header')}
            className="t-sub font-semibold text-ink-2 border border-line rounded-chip h-10 px-4 inline-flex items-center hover:border-accent hover:text-accent transition-colors"
          >
            문의
          </button>
          {session?.user ? (
            <>
              <Link href="/my-estimates" className="hidden lg:inline t-sub font-semibold text-ink-2 hover:text-ink">
                내 견적서
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="t-sub text-ink-2 hover:text-ink"
              >
                로그아웃
              </button>
              <span className="hidden sm:inline t-sub font-semibold text-accent">{session.user.name}님</span>
            </>
          ) : (
            <Link
              href="/login"
              className="t-sub font-semibold text-ink-2 border border-line rounded-chip h-10 px-4 inline-flex items-center hover:border-accent hover:text-accent transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </Container>
    </header>
  );
}
