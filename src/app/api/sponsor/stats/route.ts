// ──────────────────────────────────────────────
// /api/sponsor/stats?sido= — "지역 바꿔 보기" 칩이 부르는 숫자 API (2026년 10월 30일)
// sido: 시·도 코드 | 'other'(칩에 없는 지역 합) | 'all'(전국). 응답 {label, n}.
// 숫자는 1시간 캐시된 같은 묶음(getWeekMap)에서 뽑는다 — 공정별 숫자는 주지 않는다.
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { getWeekMap, pickWeek } from '@/server/sponsor/calcStats';
import { SIDO_CODES } from '@/server/admin/format';

export async function GET(req: Request) {
  const sido = new URL(req.url).searchParams.get('sido') ?? 'all';
  // 모르는 값은 전국으로
  const key = sido === 'other' || SIDO_CODES.includes(sido) ? sido : 'all';
  const res = pickWeek(await getWeekMap(), key);
  return NextResponse.json(res, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } });
}
