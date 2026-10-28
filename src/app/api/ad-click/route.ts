// ──────────────────────────────────────────────
// 배너 클릭 경유 — GET /api/ad-click?o=<주문번호>  (2026년 10월 29일)
//
// [무슨 기능인가]
//   배너를 누르면 여기를 거쳐 광고주 주소(https)로 이동한다. 이때 클릭 수를 +1 한다
//   (게재 중인 주문만, 봇은 세지 않음). 주문이 없거나 주소가 https 가 아니면 홈으로 보낸다.
//   이동 주소는 DB 에 저장된 값만 쓴다(주소를 쿼리로 받지 않아 열린 리다이렉트 불가).
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isBotUA } from '@/server/metrics/requestInfo';
import { clickAd } from '@/server/ads/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = u.searchParams.get('o');
  const id = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  const dest = id ? await clickAd(id, !isBotUA(req.headers.get('user-agent'))) : null;
  const res = NextResponse.redirect(dest ?? new URL('/', u.origin), 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
