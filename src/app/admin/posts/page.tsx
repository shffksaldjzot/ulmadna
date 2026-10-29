// ──────────────────────────────────────────────
// 관리자 · 글 조회수 — 2026-10-28
//
// [무슨 기능인가]
//   Supabase page_views_daily 기준 글별 조회 순위(기간 7/28/90일)와 직전 같은 기간 대비 증감,
//   유입(검색·직접·공유·그 밖)별 합, 일별 막대를 보여준다. 계산기 결과 화면(calc/...)은 글이 아니라 뺀다.
// ──────────────────────────────────────────────
import { getPostViewStats } from '@/server/admin/stats';
import { SRC_NAMES, deltaText, nameOf, parseDays } from '@/server/admin/format';
import { getAllPostMeta } from '@/lib/blog';
import { BarList, Card, DayBars, PageHead, RangeChips, Stat, Th, Unavailable, fmt } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function PostViewsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const days = parseDays((await searchParams).d);
  const s = await getPostViewStats(days);
  let titles = new Map<string, string>();
  try {
    titles = new Map(getAllPostMeta().map((p) => [p.slug, p.title]));
  } catch {
    /* 글 목록을 못 읽어도 주소로 보여준다 */
  }
  const shown = s?.posts.slice(0, 50) ?? [];

  return (
    <div>
      <PageHead title="글 조회수" note="집계는 2026-10-27부터 쌓임 · 위 50개" right={<RangeChips base="/admin/posts" days={days} />} />
      {!s ? (
        <Unavailable />
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label={`${days}일 글 조회`} value={s.total} sub={`직전 ${days}일 ${fmt(s.prevTotal)} (${deltaText(s.total, s.prevTotal)})`} />
              <Stat label="조회된 글" value={s.posts.length} />
              <Stat label="계산기 결과 조회" value={s.calcViews} />
            </div>
            <DayBars data={s.byDay} unit="회" />
          </Card>
          <Card title="유입별 조회 (공유 포함)">
            <BarList items={s.bySrc} name={(k) => nameOf(SRC_NAMES, k)} />
          </Card>
          <Card title="글 순위">
            {shown.length === 0 ? (
              <p className="text-sm text-gray-400">아직 쌓인 조회수가 없어요</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <Th>#</Th><Th>글</Th><Th right>조회</Th><Th right>직전</Th><Th right>증감</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p, i) => (
                      <tr key={p.slug} className="border-b border-gray-50">
                        <td className="py-2 px-2 text-gray-300 tabular-nums">{i + 1}</td>
                        <td className="py-2 px-2 max-w-[18rem] sm:max-w-md truncate">
                          <a href={`/blog/${p.slug}`} className="text-gray-700 hover:text-brown">{titles.get(p.slug) ?? p.slug}</a>
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-700">{fmt(p.views)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-400">{fmt(p.prev)}</td>
                        <td className="py-2 px-2 text-right tabular-nums text-gray-500">{deltaText(p.views, p.prev)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
