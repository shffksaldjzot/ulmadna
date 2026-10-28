// ──────────────────────────────────────────────
// 사이트 광고 자리용 배너 조회 — GET /api/ads/serve?slot=AD-H&process=창호&preview=12  (2026년 10월 29일)
//
// [무슨 기능인가]
//   광고 자리(AdSlot)가 부르면 방문자 시도(Vercel 머리글)와 맞는 게재 중 배너 하나를 돌려준다.
//   여러 개면 매번 무작위로 골라 돌아가며 보인다. 없으면 { ad: null } — 화면은 그대로.
//   - 봇은 노출을 세지 않도록 null 로 응답한다.
//   - 미리보기: preview=<주문번호> 가 있으면 지역·게재 상태와 상관없이 그 주문의 배너를 보여 주고
//     노출은 세지 않는다(시험용). 주문번호를 모르면 볼 수 없다.
//   - 응답은 방문자마다 달라서 공유 캐시를 쓰지 않는다(Cache-Control: private).
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { regionFromHeaders, isBotUA } from '@/server/metrics/requestInfo';
import { serveAd } from '@/server/ads/store';
import { SLOT_KINDS, type SlotKind } from '@/lib/ads/pricing';

export const dynamic = 'force-dynamic';

const NONE = () => NextResponse.json({ ad: null }, { headers: { 'Cache-Control': 'private, no-store' } });

export async function GET(req: Request) {
  const u = new URL(req.url);
  const slot = u.searchParams.get('slot') as SlotKind | null;
  if (!slot || !SLOT_KINDS.includes(slot)) return NONE();
  const process = u.searchParams.get('process');
  const previewRaw = u.searchParams.get('preview');
  const preview = previewRaw && /^\d{1,9}$/.test(previewRaw) ? Number(previewRaw) : null;

  if (!preview) {
    if (isBotUA(req.headers.get('user-agent'))) return NONE();
    const region = regionFromHeaders(req.headers);
    // 한국 시도로 판별되지 않으면(해외·모름) 지역 광고를 보여 주지 않는다
    if (!/^\d{2}$/.test(region)) return NONE();
    const ad = await serveAd(slot, region, process, null);
    return NextResponse.json({ ad }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const ad = await serveAd(slot, '', process, preview);
  return NextResponse.json({ ad }, { headers: { 'Cache-Control': 'private, no-store' } });
}
