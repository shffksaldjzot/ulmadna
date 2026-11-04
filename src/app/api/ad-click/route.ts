// ──────────────────────────────────────────────
// 배너 클릭 경유 — GET /api/ad-click?o=<주문번호>  (2026년 10월 29일)
//
// [무슨 기능인가]
//   배너를 누르면 여기를 거쳐 광고주 주소(https)로 이동한다. 이때 클릭 수를 +1 한다
//   (게재 중인 주문만, 봇은 세지 않음). 주문이 없거나 주소가 https 가 아니면 홈으로 보낸다.
//   이동 주소는 DB 에 저장된 값만 쓴다(주소를 쿼리로 받지 않아 열린 리다이렉트 불가).
//   2026년 11월 04일: ?h=incon = 전국 고정 슬롯(도토리 인테리어 컨설팅) 배너. 주문이 없는 자리라
//   클릭은 문의 클릭 표(종류 house_incon, 누른 화면·지역 함께)에 세고, 코드에 박힌 고정 주소로만 보낸다.
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isBotUA } from '@/server/metrics/requestInfo';
import { clickAd, countCallClick } from '@/server/ads/store';
import { NATIONAL_HOUSE_URL } from '@/lib/ads/config';
import { recordHouseClick } from '@/server/metrics/contactClick';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = u.searchParams.get('o');
  const id = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  // 전국 고정 슬롯 배너: 클릭 +1(봇은 안에서 거름) → 고정 주소로 이동
  if (u.searchParams.get('h') === 'incon') {
    recordHouseClick('house_incon', req.headers);
    const res = NextResponse.redirect(NATIONAL_HOUSE_URL, 302);
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Referrer-Policy', 'no-referrer');
    return res;
  }
  // 전화 걸기 광고: 브라우저가 클릭 수만 알리고(m=call) 이동은 스스로 한다 → 204
  if (id && u.searchParams.get('m') === 'call') {
    if (!isBotUA(req.headers.get('user-agent'))) await countCallClick(id);
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  }
  const dest = id ? await clickAd(id, !isBotUA(req.headers.get('user-agent'))) : null;
  const res = NextResponse.redirect(dest ?? new URL('/', u.origin), 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  return res;
}
