// ──────────────────────────────────────────────
// 방문자 수 집계 — 상단 띠 "전체 N · 오늘 N" 용 (서버 전용)
//
// [형아 결정 2026-10-30] 네이버 블로그 위젯처럼 사이트 상단에 방문자 카운터를 보여 준다.
// [숫자 출처] GA4 실제 방문자(activeUsers) — 꾸민 숫자 없이 GA가 센 그대로(제1원칙: 사실만).
//   - 날짜(date)별 activeUsers 를 GA4가 허용하는 가장 이른 날(2015-08-14)부터 오늘까지 한 번에 읽는다.
//     → 속성이 만들어지기 전 날짜는 행이 없으니, 사실상 "GA 속성 생성일부터 누적"이 된다.
//   - 전체 = 날짜별 방문자를 모두 더한 값(네이버 블로그 "전체" 와 같은 셈법: 하루 방문자의 합)
//   - 오늘 = 한국 시간 오늘 날짜 행의 방문자 수(GA 속성 시간대 = 한국)
// [비용] 보고서 1번 호출로 두 숫자를 다 얻는다. unstable_cache 1시간 → 하루 약 24번.
// [실패] 열쇠 없음·GA 거절·0명이면 null → 화면은 띠를 아예 숨긴다.
// ──────────────────────────────────────────────
import 'server-only';
import { unstable_cache } from 'next/cache';
import { runGaReport } from '@/lib/ga';

/** GA4 Data API 가 받아 주는 가장 이른 시작일(이보다 앞이면 거절됨) */
export const VISITORS_START_DATE = '2015-08-14';

/** 띠에 넘겨줄 숫자 묶음 */
export interface VisitorCounts {
  total: number; // 전체(누적) 방문자
  today: number; // 오늘(한국 시간) 방문자
  yesterday: number; // 어제 방문자 — 새벽엔 GA 에 오늘 줄이 아직 없어 0 이라, 그때 띠가 "어제 N" 으로 보여 줌
}

/** 한국 시간 기준 오늘 날짜를 GA 날짜 모양(20261030)으로 만든다 */
function kstTodayYmd(offsetDays = 0): string {
  // UTC + 9시간 = 한국 시간. offsetDays = -1 이면 어제
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * 실제 GA 조회(캐시 안쪽).
 * 실패하면 예외를 던진다 — unstable_cache 는 예외 결과를 저장하지 않으므로
 * 실패가 1시간 동안 굳어 버리지 않고 다음 요청 때 다시 시도된다.
 */
async function fetchVisitorsOrThrow(): Promise<VisitorCounts> {
  const r = await runGaReport({
    dateRanges: [{ startDate: VISITORS_START_DATE, endDate: 'today' }],
    dimensions: [{ name: 'date' }], // 날짜별로 한 줄씩
    metrics: [{ name: 'activeUsers' }], // 그날 실제 방문자 수
    limit: 10000, // 하루 1줄이라 27년치도 넉넉
  });
  // 열쇠 값은 절대 안 찍음 — 이유 문자와 GA 응답 앞부분(오류 설명)만 서버 로그에 남긴다
  if (!r.ok) throw new Error(`visitors: ${r.reason} ${r.detail ?? ''}`.trim());
  const todayKey = kstTodayYmd();
  const yKey = kstTodayYmd(-1); // 어제 열쇠(한국 날짜)
  let total = 0;
  let today = 0;
  let yesterday = 0;
  for (const row of r.rows) {
    const n = row.vals[0] ?? 0;
    total += n; // 날짜별 방문자를 전부 더해 누적
    if (row.dims[0] === todayKey) today = n; // 오늘 날짜 줄만 따로
    if (row.dims[0] === yKey) yesterday = n; // 어제 줄
  }
  return { total: Math.round(total), today: Math.round(today), yesterday: Math.round(yesterday) };
}

/** 1시간 캐시(서버 전체 공유) — 키 이름을 바꾸면 캐시가 새로 시작된다 */
const cachedVisitors = unstable_cache(fetchVisitorsOrThrow, ['site-visitors-v1'], { revalidate: 3600 });

/**
 * 띠에 쓸 방문자 수. 실패하거나 전체가 0이면 null(=띠 숨김).
 * 오늘 0명은 자정 직후 등 실제로 있을 수 있는 값이라 그대로 보여 준다.
 */
export async function getVisitorCounts(): Promise<VisitorCounts | null> {
  try {
    const v = await cachedVisitors();
    return v.total > 0 ? v : null;
  } catch (e) {
    console.warn('[visitors] GA 조회 실패 — 띠 숨김:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
