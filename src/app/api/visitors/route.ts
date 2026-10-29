// ──────────────────────────────────────────────
// GET /api/visitors — 상단 방문자 띠(VisitorBand)가 부르는 작은 API
//
// 응답: { total, today } 또는 { total: null } (GA 실패·0명 → 띠 숨김)
// [캐시 두 겹] 1) 이 주소 자체를 1시간 정적 캐시(revalidate 3600) → 버셀 CDN 이 들고 있어 함수 호출도 적다
//             2) 안쪽 getVisitorCounts 도 unstable_cache 1시간 → GA 호출은 하루 약 24번
// SiteHeader 가 페이지마다 쓰이지만, 숫자는 전부 이 한 주소의 같은 캐시를 나눠 본다.
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { getVisitorCounts } from '@/lib/stats/visitors';

/** 1시간마다 한 번만 새로 만든다(그 사이 요청은 캐시된 응답) */
export const revalidate = 3600;

export async function GET() {
  const v = await getVisitorCounts();
  // 실패면 total:null — 화면은 이걸 보고 띠를 숨긴다
  return NextResponse.json(v ?? { total: null, today: null });
}
