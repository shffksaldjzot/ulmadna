// 동시 접속자 수 — GA4(구글 애널리틱스4) 실시간 활성 사용자 수를 서버에서 60초 캐시해 돌려준다.
//
// 2026-10-10: 전에는 Upstash Redis에 핑(ZADD)을 쌓아 직접 집계했는데, 사용자마다
// 15~60초 간격으로 요청을 보내다 보니 Upstash 무료 월 요청 한도(50만 건)를 금방 태웠다.
// GA4가 이미 "최근 30분 활동한 활성 사용자 수"를 정확히 세고 있으므로, 그 숫자를 그대로
// 가져다 쓰기로 바꿨다. GA4 쿼리 자체는 비싸니(과금·레이트리밋) 서버 메모리에 60초 캐시해서
// 여러 방문자의 요청이 몰려도 실제 GA4 호출은 인스턴스당 1분에 1번만 나가게 한다.
//
// 환경변수(GA_SA_CLIENT_EMAIL / GA_SA_PRIVATE_KEY / GA_PROPERTY_ID) 없으면 count:null
// (기존과 동일한 "숫자 없으면 화면에서 숨김" 규칙 유지).
import { NextResponse } from 'next/server';
import { fetchActiveUsersNow } from '@/lib/ga';

// crypto로 JWT를 직접 서명하므로 Edge 런타임이 아니라 Node 런타임이 필요하다
export const runtime = 'nodejs';

const CACHE_MS = 60_000; // 60초 — 이 시간 안에 들어온 요청은 캐시된 값을 그대로 돌려준다

// 서버리스 인스턴스가 살아있는 동안만 유지되는 메모리 캐시(인스턴스별 — 여러 인스턴스가 떠도
// 서로 공유하지 않는다, 그래도 각 인스턴스가 1분에 1번만 GA4를 부르면 충분히 안전한 수준이다)
let cached: { count: number | null; at: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) {
    return NextResponse.json({ count: cached.count });
  }
  const count = await fetchActiveUsersNow();
  cached = { count, at: now };
  return NextResponse.json({ count });
}
