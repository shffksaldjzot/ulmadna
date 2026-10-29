// ─────────────────────────────────────────────────────────────
// 배너 교체 — POST /api/partner/banner (multipart: orderId, file) (2026년 10월 31일)
//   내 주문인지 확인 → 관리자 업로드와 같은 규격 검사(checkBanner) → 보관함 ad-banners 저장.
//   저장은 광고 공용 함수(saveBanner)를 그대로 쓰고, 게재 중이었다면 '배너 검토 중'으로 되돌아간다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { checkBanner, kstToday } from '@/lib/ads/pricing';
import { badgeOf, canManage } from '@/lib/partner/rules';
import { saveBanner } from '@/server/ads/store';
import { myOrder } from '@/server/partner/store';
import { fail, partnerOr401 } from '../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const form = await req.formData().catch(() => null);
  const orderId = Number(form?.get('orderId'));
  const file = form?.get('file');
  if (!Number.isInteger(orderId) || !(file instanceof File)) return fail(400, '광고와 그림 파일이 필요해요');
  // 내 주문만
  const o = await myOrder(me.id, orderId);
  if (!o) return fail(404, '광고를 찾지 못했어요');
  if (!canManage(badgeOf(o, kstToday()))) return fail(400, '배너를 바꿀 수 없는 광고예요');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const why = checkBanner(o.slot_kind, bytes);
  if (why) return fail(400, why);
  const r = await saveBanner(orderId, bytes, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  return r.ok ? NextResponse.json({ ok: true }) : fail(500, r.error);
}
