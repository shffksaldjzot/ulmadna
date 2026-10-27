// ──────────────────────────────────────────────
// 관리자 첫 화면(숫자판) — 2026-10-28
//
// [무슨 기능인가]
//   회원·조회수·계산기 실행·문의 클릭·인기 글·물어보기 숫자를 카드로 보여준다.
//   서버 컴포넌트라 Supabase 를 서비스 롤로 여기서 읽고, 브라우저에는 숫자만 간다.
//   접근 보호는 src/middleware.ts 의 /admin 가드(admin-auth 쿠키)가 이미 한다.
//   조회수 집계는 2026-10-27 부터 쌓이므로 0 이어도 정상. 못 읽은 칸은 "-" 로 표시.
// ──────────────────────────────────────────────
import { getMemberStats } from '@/lib/members/server';
import { getAskDash, getTrafficDash } from '@/server/metrics/adminDash';
import { getAllPostMeta } from '@/lib/blog';
import LegacyStats from './LegacyStats';
import Link from 'next/link';
import { Card, PageHead, Stat, fmt } from './_ui';

// 매번 새 숫자를 읽는다(캐시 금지)
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const [members, traffic, ask] = await Promise.all([getMemberStats(), getTrafficDash(), getAskDash()]);
  // 글 제목 찾기(없는 slug 는 slug 그대로)
  let titles = new Map<string, string>();
  try {
    titles = new Map(getAllPostMeta().map((p) => [p.slug, p.title]));
  } catch {
    /* 글 목록을 못 읽어도 slug 로 보여준다 */
  }
  const calcNames: [keyof NonNullable<typeof traffic>['calc7'], string][] = [
    ['wallpaper', '도배'],
    ['flooring', '바닥재'],
    ['mortar', '미장'],
    ['tile', '타일'],
  ];

  return (
    <div>
      <PageHead title="대시보드" note="조회수·계산기 집계는 2026-10-27부터 쌓임" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card title="회원" right={<Link href="/admin/members" className="text-xs text-gray-400 hover:text-gray-700">자세히 →</Link>}>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="전체" value={members?.total} />
            <Stat label="새 회원 7일" value={members?.new7} />
            <Stat label="새 회원 30일" value={members?.new30} />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            카카오 {fmt(members?.byProvider.kakao)} · 아이디 {fmt(members?.byProvider.id)}
          </p>
        </Card>

        <Card title="물어보기" right={<Link href="/admin/ask" className="text-xs text-gray-400 hover:text-gray-700">자세히 →</Link>}>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="전체 글" value={ask?.posts} />
            <Stat label="답변 단 글" value={ask?.answered} />
            <Stat label="답변 읽음" value={ask?.read} />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            도움됐어요 {fmt(ask?.helpful)} · 아쉬워요 {fmt(ask?.sorry)}
          </p>
        </Card>

        <Card title="조회수" right={<Link href="/admin/posts" className="text-xs text-gray-400 hover:text-gray-700">자세히 →</Link>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="오늘" value={traffic?.viewsToday} />
            <Stat label="7일" value={traffic?.views7} />
          </div>
        </Card>

        <Card title="최근 7일 활동" right={<Link href="/admin/calc" className="text-xs text-gray-400 hover:text-gray-700">자세히 →</Link>}>
          <div className="grid grid-cols-4 gap-2">
            {calcNames.map(([k, name]) => (
              <Stat key={k} label={`${name} 계산`} value={traffic?.calc7[k]} />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            문의 단추 전화 {fmt(traffic?.contact7.phone)} · 카톡 {fmt(traffic?.contact7.kakao)}
          </p>
        </Card>
      </div>

      <Card title="인기 글 (7일 상위 10)">
        {!traffic ? (
          <p className="text-sm text-gray-400">-</p>
        ) : traffic.topPosts.length === 0 ? (
          <p className="text-sm text-gray-400">아직 쌓인 조회수가 없어요</p>
        ) : (
          <ol className="divide-y divide-gray-50">
            {traffic.topPosts.map((p, i) => (
              <li key={p.slug} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-5 text-gray-300 tabular-nums">{i + 1}</span>
                <a href={`/blog/${p.slug}`} className="flex-1 min-w-0 truncate text-gray-700 hover:text-brown">
                  {titles.get(p.slug) ?? p.slug}
                </a>
                <span className="text-gray-500 tabular-nums">{fmt(p.views)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <div className="mt-8">
        <LegacyStats />
      </div>
    </div>
  );
}
