// ──────────────────────────────────────────────
// 사이트 광고 자리용 배너 조회 — GET /api/ads/serve?q=AD-H;AD-P:창호&preview=12  (2026년 10월 29일)
//
// [무슨 기능인가]
//   한 화면의 광고 자리들이 한 번에 묶어서 부른다(q = 자리를 ; 로 이은 목록, AD-P 는 AD-P:공정이름).
//   방문자 시도(Vercel 머리글)와 맞는 게재 중 배너를 자리마다 하나씩 골라 돌려준다.
//   여러 개면 매번 무작위로 골라 돌아가며 보인다. 없으면 그 자리는 null — 화면은 그대로.
//   - 봇은 노출을 세지 않도록 전부 null 로 응답한다.
//   - 미리보기: preview=<주문번호> 가 있으면 지역·게재 상태와 상관없이 그 주문의 배너를 그 자리에
//     보여 주고 노출은 세지 않는다(시험용). 주문번호를 모르면 볼 수 없다.
//   - 응답은 방문자마다 달라서 공유 캐시를 쓰지 않는다(Cache-Control: private).
// 응답: { ads: { "AD-H": {id,imageUrl,href,name} | null, "AD-P:창호": null, ... } }
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { regionFromHeaders, isBotUA } from '@/server/metrics/requestInfo';
import { serveAd, type ServedAd } from '@/server/ads/store';
import { SLOT_KINDS, type SlotKind } from '@/lib/ads/pricing';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const u = new URL(req.url);
  // 요청 목록 해석: "AD-H;AD-P:창호" → [{key, kind, process}] (최대 16개, 허용 종류만)
  const wants = (u.searchParams.get('q') ?? '')
    .split(';')
    .slice(0, 16)
    .map((key) => {
      const [k, ...rest] = key.split(':');
      return { key, kind: k as SlotKind, process: rest.length ? rest.join(':').slice(0, 30) : null };
    })
    .filter((w) => SLOT_KINDS.includes(w.kind));
  const ads: Record<string, ServedAd | null> = {};
  for (const w of wants) ads[w.key] = null;
  if (!wants.length) return NextResponse.json({ ads }, { headers: HEADERS });

  const previewRaw = u.searchParams.get('preview');
  const preview = previewRaw && /^\d{1,9}$/.test(previewRaw) ? Number(previewRaw) : null;

  if (preview) {
    // 미리보기: 같은 주문이 맞는 자리 종류에만 나온다
    for (const w of wants) ads[w.key] = await serveAd(w.kind, '', w.process, preview);
    return NextResponse.json({ ads }, { headers: HEADERS });
  }

  if (isBotUA(req.headers.get('user-agent'))) return NextResponse.json({ ads }, { headers: HEADERS });
  const region = regionFromHeaders(req.headers);
  // 한국 시도로 판별되지 않으면(해외·모름) 지역 광고를 보여 주지 않는다
  if (!/^\d{2}$/.test(region)) return NextResponse.json({ ads }, { headers: HEADERS });
  for (const w of wants) ads[w.key] = await serveAd(w.kind, region, w.process, null);
  return NextResponse.json({ ads }, { headers: HEADERS });
}
