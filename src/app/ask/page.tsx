// ──────────────────────────────────────────────
// /ask — 물어보기 목록 화면 (시안 index.html)
//
// 서버에서 그린다(검색에 잡히게). 60초마다 새로 그린다(ISR) — 집컴이 답을 쓴 뒤
// /api/ask/revalidate 를 부르면 그 즉시 새로 그린다.
// 표가 아직 없거나 연결이 안 되면 빈 목록으로 그린다(500 아님).
//
// 구성: 머리(라벨·제목·부제·선) → 빅데이터 상자(숫자 있을 때만) → 검색·칩·카드·더 보기
//       → 모바일 떠 있는 "+ 질문하기", PC는 제목 오른쪽 + 목록 위 단추
//       → PC 오른쪽: "왜 얼마드나 AI인가" · 많이 본 질문 5
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import Link from 'next/link';
import AskShell from '@/components/ask/AskShell';
import AskListClient from '@/components/ask/AskListClient';
import AskListActions from '@/components/ask/AskListActions';
import { countPosts, getStats, listPosts, popularPosts } from '@/lib/ask/server';
import { askHref, shortDate } from '@/lib/ask/format';

export const revalidate = 60;

const SITE = 'https://ulmadna.com';

export const metadata: Metadata = {
  title: '견적, 물어보세요 — 얼마드나 물어보기',
  description: '인테리어 견적서를 올리면 얼마드나 AI가 실제 견적서 자료로 통상 단가와 적정 여부를 답해요. 질문과 답은 모두 공개돼요.',
  alternates: { canonical: `${SITE}/ask` },
  openGraph: {
    title: '견적, 물어보세요 — 얼마드나 물어보기',
    description: '실제 견적서 자료로 답하는 인테리어 견적 질문 게시판',
    url: `${SITE}/ask`,
    type: 'website',
  },
};

export default async function AskListPage() {
  // 네 가지를 동시에 읽는다(하나가 실패해도 나머지는 그대로 — 각 함수가 빈 값으로 떨어짐)
  const [{ items, next }, total, stats, popular] = await Promise.all([listPosts(), countPosts(), getStats(), popularPosts(5)]);

  return (
    <AskShell>
      <main className="app">
        {/* 머리: 이 게시판이 무엇인지 한 줄. AI 표기와 데이터 근거를 숨기지 않는다 */}
        <div className="bhead">
          <div className="eyebrow">얼마드나 물어보기</div>
          <div className="h1row">
            <h1 className="t-page">견적, 물어보세요</h1>
            {/* PC 제목 오른쪽 질문하기(오늘 남은 질문이 0개면 눌리지 않음) */}
            <AskListActions variant="title" />
          </div>
          <p className="lead">AI가 얼마드나 빅데이터로 통상 단가와 적정 여부를 답해요</p>
          <hr />
        </div>

        {/* 오늘 기준 빅데이터 — 숫자가 있을 때만(집컴이 밤마다 넣는다) */}
        {stats && (
          <section className="why" aria-label="오늘 기준 빅데이터">
            <div className="big">
              <small>오늘 기준 빅데이터 견적서</small>
              <b>{stats.shown.toLocaleString()}건</b>
              {stats.delta != null && stats.delta !== 0 && (
                <span className="tick">
                  {stats.delta > 0 ? `▲ +${stats.delta.toLocaleString()}` : `▼ ${stats.delta.toLocaleString()}`} <small>어제 대비</small>
                </span>
              )}
            </div>
            <p className="line">
              지어낸 평균이 아니라 <b>비슷한 조건의 실제 견적서 범위</b>로 답해요
            </p>
            <div className="foot">
              <span>매일 새벽 갱신{stats.updated ? ` · ${shortDate(stats.updated)}` : ''}</span>
              <span>
                실시간 답변이 아니에요 · 자료를 찾아 보느라 <b>5~10분</b>
              </span>
            </div>
          </section>
        )}

        {/* 목록 위 줄: 오늘 남은 질문 한 줄(모든 화면) + PC 질문하기 단추 하나 더 */}
        <AskListActions variant="row" />

        <AskListClient initialItems={items} initialNext={next} total={total} />

        {/* PC 오른쪽: 이 게시판이 왜 다른지 + 많이 본 질문 */}
        <aside className="aside">
          <div className="card pc-only">
            <div className="ttl">왜 얼마드나 AI인가</div>
            <div className="t-sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
              실제 인테리어 견적서를 매일 모아요. 질문하면 <b>비슷한 조건의 견적서 범위</b>로 답해요. 지어낸 평균이 아니에요.
            </div>
            <div className="t-sub" style={{ marginTop: 8, color: 'var(--ink-3)' }}>
              참고용 · 현장 실측 뒤 확정
            </div>
          </div>
          {popular.length > 0 && (
            <div className="card pc-only">
              <div className="ttl">많이 본 질문</div>
              <div className="rows" style={{ marginTop: 6 }}>
                {popular.map((p) => (
                  <Link key={p.id} href={askHref(p.slug)}>
                    {p.title}
                    <small>조회 {p.view_count.toLocaleString()}</small>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* 모바일: 떠 있는 질문하기 단추 */}
      <AskListActions variant="fab" />
    </AskShell>
  );
}
