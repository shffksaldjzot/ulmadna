// ──────────────────────────────────────────────
// v1 허브 — 홈
// 디자인 가이드 v4 아트보드 03(모바일) · 04(PC 1200px) 기준.
// 검색창 → 계산기 타일 8개 → 인기 글 3 → 인기 질문 3(더미) → 광고 → 하단 고지.
// PC(lg 이상)는 좌 2단 콘텐츠 + 우 사이드(광고 · 많이 찾는 시세).
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

import Link from 'next/link';
import TopNav from '@/components/v1/TopNav';
import BottomTab from '@/components/v1/BottomTab';
import CalcTile from '@/components/v1/CalcTile';
import SectionHeader from '@/components/v1/SectionHeader';
import AdSlot from '@/components/v1/AdSlot';
import Disclaimer from '@/components/v1/Disclaimer';
import ListRow from '@/components/v1/ListRow';
import HomeSearch from './HomeSearch';
import { getAllPostMeta } from '@/lib/blog';

// 아직 만들지 않은 계산기는 href를 비워 둔다 → CalcTile이 "준비 중"으로 표시
const CALC_TILES = [
  { name: '도배 계산기', href: '/v1/calc/wallpaper' },
  { name: '바닥재 계산기' },
  { name: '커튼 계산기' },
  { name: '샷시 계산기' },
  { name: '욕실 계산기' },
  { name: '주방 계산기' },
  { name: '전기·조명 계산기' },
  { name: '올수리 계산기', gold: true },
];

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
        {/* ── 모바일: 세로 1단 ── */}
        <div className="lg:hidden px-4 py-4 flex flex-col gap-6">
          <HomeSearch />

          <section className="flex flex-col gap-3">
            <h2 className="text-[20px] font-bold text-foreground">계산기</h2>
            <div className="grid grid-cols-2 gap-[10px]">
              {CALC_TILES.map((t) => (
                <CalcTile key={t.name} {...t} />
              ))}
            </div>
          </section>

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

          <section className="flex flex-col gap-3">
            <SectionHeader title="인기 질문" moreHref="/v1/q" />
            <div className="border-t border-v1-line-2">
              {SAMPLE_QUESTIONS.map((q, i) => (
                <div key={q.title} className={`py-[10px] ${i === SAMPLE_QUESTIONS.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                  <p className="text-[16px] font-bold text-foreground leading-[1.5] truncate">{q.title}</p>
                  <p className="text-[14px] text-v1-text-secondary tabular-nums">{q.meta}</p>
                </div>
              ))}
            </div>
          </section>

          <AdSlot />
          <Disclaimer />
        </div>

        {/* ── PC: 2단(1fr / 300px) ── */}
        <div className="hidden lg:grid grid-cols-[1fr_300px] gap-8 px-8 py-8">
          <div className="flex flex-col gap-8">
            <section className="flex flex-col gap-3">
              <h2 className="text-[20px] font-bold text-foreground">계산기</h2>
              <div className="grid grid-cols-4 gap-3">
                {CALC_TILES.map((t) => (
                  <CalcTile key={t.name} {...t} />
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-6">
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

              <section className="flex flex-col gap-3">
                <SectionHeader title="인기 질문" moreHref="/v1/q" />
                <div className="border-t border-v1-line-2">
                  {SAMPLE_QUESTIONS.map((q, i) => (
                    <div key={q.title} className={`py-[10px] ${i === SAMPLE_QUESTIONS.length - 1 ? '' : 'border-b border-v1-line-2'}`}>
                      <p className="text-[16px] font-bold text-foreground leading-[1.5] truncate">{q.title}</p>
                      <p className="text-[14px] text-v1-text-secondary tabular-nums">{q.meta}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <Disclaimer className="max-w-[720px]" />
          </div>

          <div className="flex flex-col gap-6">
            <AdSlot size="300x250" />
            <section className="flex flex-col gap-3">
              <h2 className="text-[20px] font-bold text-foreground">많이 찾는 시세</h2>
              <div className="border-t border-v1-line-2">
                {POPULAR_PRICES.map((label, i) => (
                  <ListRow key={label} href="/v1/price" last={i === POPULAR_PRICES.length - 1}>
                    {label}
                  </ListRow>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      <BottomTab />
    </>
  );
}
