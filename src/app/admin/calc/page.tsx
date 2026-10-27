// ──────────────────────────────────────────────
// 관리자 · 계산기 통계 — 2026-10-28
//
// [무슨 기능인가]
//   Supabase calc_runs_daily 기준으로 계산기(공정)별·모드별·평형대별·지역별·유입별 실행 수와
//   일별 막대를 보여준다. 기간 7/28/90일. 집계는 2026-10-27 부터 쌓였다.
// ──────────────────────────────────────────────
import { getCalcStats } from '@/server/admin/stats';
import { MODE_NAMES, PROCESS_NAMES, REGION_NAMES, SRC_NAMES, bucketLabel, nameOf, parseDays } from '@/server/admin/format';
import { BarList, Card, DayBars, PageHead, RangeChips, Stat, Unavailable } from '../_ui';

export const dynamic = 'force-dynamic';

export default async function CalcStatsPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const days = parseDays((await searchParams).d);
  const s = await getCalcStats(days);

  return (
    <div>
      <PageHead title="계산기 통계" note="집계는 2026-10-27부터 쌓임" right={<RangeChips base="/admin/calc" days={days} />} />
      {!s ? (
        <Unavailable />
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat label={`${days}일 실행`} value={s.total} />
              <Stat label="문의 단추 클릭" value={s.contacts} />
              <Stat label="하루 평균" value={Math.round(s.total / days)} />
            </div>
            <DayBars data={s.byDay} />
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="계산기별"><BarList items={s.byProcess} name={(k) => nameOf(PROCESS_NAMES, k)} /></Card>
            <Card title="모드별"><BarList items={s.byMode} name={(k) => nameOf(MODE_NAMES, k)} /></Card>
            <Card title="평형대별"><BarList items={s.byBucket} name={bucketLabel} /></Card>
            <Card title="지역별"><BarList items={s.byRegion} name={(k) => nameOf(REGION_NAMES, k)} /></Card>
            <Card title="유입별"><BarList items={s.bySrc} name={(k) => nameOf(SRC_NAMES, k)} /></Card>
          </div>
        </div>
      )}
    </div>
  );
}
