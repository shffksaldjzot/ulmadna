// ──────────────────────────────────────────────
// v1 허브 — 홈
// 디자인 가이드 v4 아트보드 03(모바일) · 04(PC 1200px) 기준.
// 검색창 → 공정별 물량 계산기 타일 10개(ProcessTiles) → 인기 글 3 → 인기 질문 3(더미) → 광고 → 하단 고지.
// PC(lg 이상)는 좌 2단 콘텐츠 + 우 사이드(광고 · 많이 찾는 시세).
//
// 작성일: 2026년 08월 28일
// 2026년 09월 14일: SEO 보강 — H1·canonical·BreadcrumbList 추가(형아 지시, 계산기 페이지
// SEO 정비 작업의 일부). 이 페이지는 서버 컴포넌트라 원래도 내용이 잘 그려지지만,
// 제목(H1)과 canonical이 아예 없었어서 채워 넣는다.
// ──────────────────────────────────────────────

import type { Metadata } from 'next';
import Link from 'next/link';
import TopNav from '@/components/v1/TopNav';
import BottomTab from '@/components/v1/BottomTab';
import ProcessTiles from './ProcessTiles';
import SectionHeader from '@/components/v1/SectionHeader';
import AdSlot from '@/components/v1/AdSlot';
import Disclaimer from '@/components/v1/Disclaimer';
import ListRow from '@/components/v1/ListRow';
import HomeSearch from './HomeSearch';
import { getAllPostMeta } from '@/lib/blog';
import { JsonLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

export const metadata: Metadata = {
  title: '인테리어 공정별 계산기 — 얼마드나',
  description: '도배·바닥재 등 공정별 물량과 비용을 무료로 바로 계산해보세요. 로그인·개인정보 없음.',
  alternates: { canonical: `${SITE_URL}/calc` },
};

// 계산기 타일은 ProcessTiles.tsx (2026-09-09 형아 지시: 롤백 전 홈 히어로의 공정 타일 10개를 여기서 보여준다)

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
      <TopNav />

      <main className="pb-24 lg:pb-16">
        {/* 길잡이(작게) + 제목 — 모바일·PC 공통, 폭이 다른 두 레이아웃 밖에 한 번만 */}
        <div className="px-4 lg:px-8 pt-3">
          <nav aria-label="현재 위치" className="text-[12px] text-v1-text-disabled flex items-center gap-1">
            <Link href="/" className="hover:text-v1-text-secondary">얼마드나</Link>
            <span aria-hidden="true">›</span>
            <span>계산기</span>
          </nav>
          <h1 className="text-[20px] font-bold text-foreground mt-1">인테리어 공정별 계산기</h1>
        </div>

        {/* ── 모바일: 세로 1단 ── */}
        <div className="lg:hidden px-4 py-4 flex flex-col gap-6">
          <HomeSearch />

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

          <AdSlot />
          <Disclaimer />
        </div>

        {/* ── PC: 2단(1fr / 300px) ── */}
        <div className="hidden lg:grid grid-cols-[1fr_300px] gap-8 px-8 py-8">
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
            <AdSlot size="300x250" />
            {/* /calc/price 페이지가 아직 없어서 숨김 (2026-09-11 검사관 지적) */}
            {SHOW_UNFINISHED_SECTIONS && (
              <section className="flex flex-col gap-3">
                <h2 className="text-[20px] font-bold text-foreground">많이 찾는 시세</h2>
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
        </div>
      </main>

      <BottomTab />

      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기' },
        ])}
      />
    </>
  );
}
