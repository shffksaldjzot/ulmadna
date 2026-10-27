// ──────────────────────────────────────────────
// 관리자 "GA 상세" 화면용 보고서 묶음 — 2026-10-28
//
// [무슨 기능인가]
//   src/lib/ga.ts 의 runGaReport 로 방문·유입·지역·기기·인기 페이지를 한 번에 읽는다.
//   GA 열쇠가 없거나 구글이 거절하면 { state:'error' } 로 돌려줘서 화면이 "GA 연결 필요"를 띄운다.
//   같은 기간은 10분 동안 서버 메모리에 담아 두고 다시 쓴다(구글 호출 수 절약).
// ──────────────────────────────────────────────
import 'server-only';
import { readGaCredentials, runGaReport, type GaRow } from '@/lib/ga';
import { gaChannelKo, gaDay, gaRegionKo, groupSum, type Counted } from './format';

export interface GaDash {
  state: 'ok';
  days: number;
  users: number;
  sessions: number;
  views: number;
  byDay: { day: string; n: number }[];
  channels: Counted[];
  regions: Counted[];
  devices: Counted[];
  pages: { path: string; views: number }[];
}
export type GaDashResult = GaDash | { state: 'error'; reason: 'no-env' | 'error'; detail?: string };

const cache = new Map<number, { at: number; data: GaDash }>();

/** 최근 N일(오늘 제외 어제까지가 아니라 오늘 포함) GA 보고서. 실패하면 error */
export async function getGaDash(days: number): Promise<GaDashResult> {
  if (!readGaCredentials()) return { state: 'error', reason: 'no-env' };
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;

  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: 'today' }];
  const [daily, channel, region, device, page] = await Promise.all([
    runGaReport({ dateRanges, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 100 }),
    runGaReport({ dateRanges, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], limit: 20 }),
    runGaReport({
      dateRanges, dimensions: [{ name: 'region' }], metrics: [{ name: 'sessions' }], limit: 30,
      dimensionFilter: { filter: { fieldName: 'country', stringFilter: { value: 'South Korea' } } },
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    runGaReport({ dateRanges, dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }], limit: 10 }),
    runGaReport({ dateRanges, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }], limit: 15, orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }] }),
  ]);
  const all = [daily, channel, region, device, page];
  const bad = all.find((r) => !r.ok);
  if (bad && !bad.ok) return { state: 'error', reason: bad.reason, detail: bad.detail };
  const rows = (r: typeof daily): GaRow[] => (r.ok ? r.rows : []);

  const dailyRows = rows(daily);
  const data: GaDash = {
    state: 'ok',
    days,
    // 기간 전체 방문자는 일별 합이 아니라 중복 제거가 필요하지만, 일별 합으로 근사(화면에 "일 합계"로 표기)
    users: dailyRows.reduce((s, r) => s + r.vals[0], 0),
    sessions: dailyRows.reduce((s, r) => s + r.vals[1], 0),
    views: dailyRows.reduce((s, r) => s + r.vals[2], 0),
    byDay: dailyRows.map((r) => ({ day: gaDay(r.dims[0]), n: r.vals[2] })),
    channels: groupSum(rows(channel), (r) => gaChannelKo(r.dims[0]), (r) => r.vals[0]),
    regions: groupSum(rows(region), (r) => gaRegionKo(r.dims[0]), (r) => r.vals[0]),
    devices: groupSum(rows(device), (r) => r.dims[0], (r) => r.vals[0]),
    pages: rows(page).map((r) => ({ path: r.dims[0], views: r.vals[0] })),
  };
  cache.set(days, { at: Date.now(), data });
  return data;
}
