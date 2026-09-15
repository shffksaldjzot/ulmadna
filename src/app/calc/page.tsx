// ──────────────────────────────────────────────
// v1 허브 — 홈
// 검색창 → 살아있는 계산기 카드(ProcessTiles) → 인기 글 3 → 인기 질문 3(더미) → 광고 → 공용 푸터.
// PC(lg 이상)는 좌 2단 콘텐츠 + 우 사이드(광고 · 많이 찾는 시세).
//
// 작성일: 2026년 08월 28일
// 2026년 09월 14일: SEO 보강 — H1·canonical·BreadcrumbList 추가.
// 2026년 09월 15일: 디자인 통일 작업 A — 상단바는 calc/layout.tsx가 그리므로 여기서 제거.
//   하단 탭은 공용 푸터(SiteFooter)가 같이 그려서 별도 BottomTab 호출을 없앴다.
//   광고 자리는 점선 플레이스홀더(v1/AdSlot)를 버리고 정책 기반 공용 AdSlot(AD-R)으로 교체.
//   검색창(HomeSearch)은 실제로 검색하지 않고 항상 도배 계산기로만 보내는 가짜 동작이라 제거.
// ──────────────────────────────────────────────

import type { Metadata } from 'next';
import Link from 'next/link';
import ProcessTiles from './ProcessTiles';
import SectionHeader from '@/components/v1/SectionHeader';
import AdSlot from '@/components/ads/AdSlot';
import Disclaimer from '@/components/v1/Disclaimer';
import ListRow from '@/components/v1/ListRow';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';
import { getAllPostMeta } from '@/lib/blog';
import { JsonLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: '인테리어 공정별 계산기 — 얼마드나',
  description: '도배·바닥재 등 공정별 물량과 비용을 무료로 바로 계산해보세요. 로그인·개인정보 없음.',
  alternates: { canonical: `${SITE_URL}/calc` },
};

// 2026-09-11 검사관 지적: 질문 게시판(/calc/q)·시세 페이지(/calc/price)는 아직 실제 화면이 없다.
// 화면이 만들어질 때까지 "인기 질문"·"많이 찾는 시세" 섹션 자체를 숨겨둔다.
// → 나중에 해당 페이지가 생기면 이 값을 true로 바꾸기만 하면 두 섹션이 다시 보인다.
const SHOW_UNFINISHED_SECTIONS = false;

// 질문 게시판은 아직 없어서, 목업과 같은 예시 3건을 그대로 쓴다(로렘 금지 원칙 준수)
const SAMPLE_QUESTIONS = [
  { title: '34평 도배 견적 210만원 적정한가요', meta: '서울 노원구 34평 · 도배·욕실 · 답변 3' },
  { title: '욕실 2개 동시 시공하면 얼마나 싸지나요', meta: '경기 고양시 28평 · 욕실 · 답변 5' },
  { title: '주방 상판만 교체해도 되는 상태일까요', meta: '부산 해운대구 24평 · 주방 · 답변 1' },
];

const POPULAR_PRICES = ['실크 벽지 평당 단가', '도배공 1인 인건비', '욕실 철거 1칸'];

/** "2026-08-21" → "2026.08.21" (조회수가 없는 글은 날짜로 대신 보여준다) */
function formatDate(d: string): string {
  return d.replaceAll('-', '.');
}

export default function V1HomePage() {
  const posts = getAllPostMeta().slice(0, 3);

  return (
    <>
      <main className="pb-8">
        {/* 길잡이(작게) + 제목 — 모바일·PC 공통, 폭이 다른 두 레이아웃 밖에 한 번만
            공용 Container로 감싸 상단바 로고와 왼쪽 시작선을 맞춘다(1120px 폭 밖에선 mx-auto로 가운데 정렬). */}
        <Container as="div" className="pt-3">
          <nav aria-label="현재 위치" className="text-[12px] text-v1-text-disabled flex items-center gap-1">
            <Link href="/" className="hover:text-v1-text-secondary">얼마드나</Link>
            <span aria-hidden="true">›</span>
            <span>계산기</span>
          </nav>
          <h1 className="t-page text-ink mt-1">인테리어 공정별 계산기</h1>
        </Container>

        {/* ── 모바일: 세로 1단 ── */}
        <Container as="div" className="lg:hidden py-4 flex flex-col gap-6">
          <ProcessTiles />

          <section className="flex flex-col gap-3">
            <SectionHeader title="인기 글" moreHref="/blog" />
            <div className="border-t border-v1-line-2">
              {posts.map((p, i) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className={`block py-[10px] ${i === posts.length - 1 ? '' : 'border-b border-v1-line-2'}`}
                >
                  <p className="text-[16px] font-bold text-foreground leading-[1.5] truncate">{p.title}</p>
                  <p className="text-[14px] text-v1-text-disabled tabular-nums">{formatDate(p.date)}</p>
                </Link>
              ))}
            </div>
          </section>

          {/* /calc/q 페이지가 아직 없어서 숨김 (2026-09-11 검사관 지적) */}
          {SHOW_UNFINISHED_SECTIONS && (
            <section className="flex flex-col gap-3">
              <SectionHeader title="인기 질문" moreHref="/calc/q" />
              <div className="border-t border-v1-line-2">
                {SAMPLE_QUESTIONS.map((q, i) => (
                  <div key={q.title} className={`py-[10px] ${i === SAMPLE_QUESTIONS.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                    <p className="text-[16px] font-bold text-foreground leading-[1.5] truncate">{q.title}</p>
                    <p className="text-[14px] text-v1-text-secondary tabular-nums">{q.meta}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* House Ad 폴백(계산기 홍보 카드) — 광고 전역 스위치가 꺼져 있는 동안은 collapse */}
          <AdSlot id="AD-R" />
          <Disclaimer />
        </Container>

        {/* ── PC: 2단(1fr / 300px) ── */}
        <Container as="div" className="hidden lg:grid grid-cols-[1fr_300px] gap-8 py-8">
          <div className="flex flex-col gap-8">
            <ProcessTiles />

            {/* /calc/q 페이지가 아직 없어서 "인기 질문"을 숨기는 동안은 1단으로,
                다시 켜지면 "인기 글"과 나란히 2단으로 보이게 grid-cols를 조건부로 바꾼다 */}
            <div className={SHOW_UNFINISHED_SECTIONS ? 'grid grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'}>
              <section className="flex flex-col gap-3">
                <SectionHeader title="인기 글" moreHref="/blog" />
                <div className="border-t border-v1-line-2">
                  {posts.map((p, i) => (
                    <Link
                      key={p.slug}
                      href={`/blog/${p.slug}`}
                      className={`block py-[10px] ${i === posts.length - 1 ? '' : 'border-b border-v1-line-2'}`}
                    >
                      <p className="text-[16px] font-bold text-foreground leading-[1.5] truncate">{p.title}</p>
                      <p className="text-[14px] text-v1-text-disabled tabular-nums">{formatDate(p.date)}</p>
                    </Link>
                  ))}
                </div>
              </section>

              {/* /calc/q 페이지가 아직 없어서 숨김 (2026-09-11 검사관 지적) */}
              {SHOW_UNFINISHED_SECTIONS && (
                <section className="flex flex-col gap-3">
                  <SectionHeader title="인기 질문" moreHref="/calc/q" />
                  <div className="border-t border-v1-line-2">
                    {SAMPLE_QUESTIONS.map((q, i) => (
                      <div key={q.title} className={`py-[10px] ${i === SAMPLE_QUESTIONS.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                        <p className="text-[16px] font-bold text-foreground leading-[1.5] truncate">{q.title}</p>
                        <p className="text-[14px] text-v1-text-secondary tabular-nums">{q.meta}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <Disclaimer className="max-w-[720px]" />
          </div>

          <div className="flex flex-col gap-6">
            {/* House Ad 폴백(계산기 홍보 카드) — 광고 전역 스위치가 꺼져 있는 동안은 collapse */}
            <AdSlot id="AD-R" />
            {/* /calc/price 페이지가 아직 없어서 숨김 (2026-09-11 검사관 지적) */}
            {SHOW_UNFINISHED_SECTIONS && (
              <section className="flex flex-col gap-3">
                <h2 className="t-section text-ink">많이 찾는 시세</h2>
                <div className="border-t border-v1-line-2">
                  {POPULAR_PRICES.map((label, i) => (
                    <ListRow key={label} href="/calc/price" last={i === POPULAR_PRICES.length - 1}>
                      {label}
                    </ListRow>
                  ))}
                </div>
              </section>
            )}
          </div>
        </Container>
      </main>

      <SiteFooter />

      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기' },
        ])}
      />
    </>
  );
}
