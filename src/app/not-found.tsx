// ──────────────────────────────────────────────
// 404 화면 — 없는 주소로 들어왔을 때 보이는 화면
//
// 2026-10-29 폴리싱 묶음 A: 전에는 Next 기본 영어 화면("This page could not be found.")이
// 사이트 틀(상단바·하단 탭) 없이 흰 바탕으로 떠서, 길을 잃으면 돌아갈 단추가 없었다.
// 공용 틀(SiteHeader·Container·SiteFooter=하단 탭 포함) 안에 한 줄 안내 + 단추 2개만 둔다.
// 강조색은 "홈으로" 단추 하나만(디자인 통일 규칙: 강조색 한 화면에 하나).
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';

// 브라우저 탭 제목 — 404 화면은 검색에 안 잡히게(Next가 자동으로 noindex를 붙인다)
export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요 — 얼마드나',
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      {/* flex-1: 내용이 짧아도 푸터가 화면 아래쪽에 붙게 본문이 남는 높이를 채운다 */}
      <Container as="main" className="flex-1">
        <div className="py-20 lg:py-28 flex flex-col items-center text-center gap-6">
          {/* 안내는 한 줄만 */}
          <h1 className="t-page text-ink">페이지를 찾을 수 없어요</h1>
          {/* 단추 2개: 홈(주 단추·강조색) · 계산기(테두리 단추) — 둘 다 높이 52px(터치 44px 이상) */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-[360px] sm:max-w-none sm:w-auto">
            <Link
              prefetch={false}
              href="/"
              className="h-[52px] px-8 rounded-chip bg-accent hover:bg-accent-press text-white t-body font-bold inline-flex items-center justify-center transition-colors"
            >
              홈으로
            </Link>
            <Link
              prefetch={false}
              href="/calc"
              className="h-[52px] px-8 rounded-chip border border-line bg-surface text-ink t-body font-bold inline-flex items-center justify-center hover:border-ink-2 transition-colors"
            >
              계산기 보기
            </Link>
          </div>
        </div>
      </Container>
      <SiteFooter />
    </>
  );
}
