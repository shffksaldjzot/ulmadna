// ──────────────────────────────────────────────
// 관리자 · GA 상세 — 2026-10-28
//
// [무슨 기능인가]
//   GA4 Data API 로 읽은 방문·유입 경로·지역(시도)·기기·인기 페이지를 보여준다. 기간 7/28일.
//   GA 환경변수(GA_SA_*, GA_PROPERTY_ID)가 없으면 "GA 연결 필요" 안내만 띄운다.
// ──────────────────────────────────────────────
import { getGaDash } from '@/server/admin/gaReports';
import { DEVICE_NAMES, nameOf, parseDays } from '@/server/admin/format';
import { BarList, Card, DayBars, PageHead, RangeChips, Stat, Unavailable } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function GaPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const days = parseDays((await searchParams).d, [7, 28]);
  const ga = await getGaDash(days);

  return (
    <div>
      <PageHead title="GA 상세" note="구글 애널리틱스 기준 · 10분마다 새로 읽음" right={<RangeChips base="/admin/ga" days={days} options={[7, 28]} />} />
      {ga.state === 'error' ? (
        <Unavailable>
          {ga.reason === 'no-env'
            ? 'GA 연결 필요 — 서버에 GA_SA_CLIENT_EMAIL · GA_SA_PRIVATE_KEY · GA_PROPERTY_ID 가 없어요.'
            : `GA 를 읽지 못했어요. ${ga.detail ?? ''}`}
        </Unavailable>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label="방문자(일 합계)" value={ga.users} />
              <Stat label="방문(세션)" value={ga.sessions} />
              <Stat label="페이지뷰" value={ga.views} />
            </div>
            <DayBars data={ga.byDay} />
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="유입 경로 (방문)"><BarList items={ga.channels} /></Card>
            <Card title="지역 (시도, 방문)"><BarList items={ga.regions} /></Card>
            <Card title="기기 (방문)"><BarList items={ga.devices} name={(k) => nameOf(DEVICE_NAMES, k === 'desktop' ? 'pc' : k)} /></Card>
            <Card title="인기 페이지 (조회)">
              {ga.pages.length === 0 ? (
                <p className="text-sm text-gray-400">아직 자료가 없어요</p>
              ) : (
                <ol className="divide-y divide-gray-50">
                  {ga.pages.map((p, i) => (
                    <li key={p.path} className="flex items-center gap-3 py-1.5 text-sm">
                      <span className="w-5 text-gray-300 tabular-nums">{i + 1}</span>
                      <span className="flex-1 min-w-0 truncate text-gray-700">{p.path}</span>
                      <span className="text-gray-500 tabular-nums">{p.views.toLocaleString('ko-KR')}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
