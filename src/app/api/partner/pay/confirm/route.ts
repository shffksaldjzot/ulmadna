// ─────────────────────────────────────────────────────────────
// 결제 확인 — POST /api/partner/pay/confirm { paymentId } (2026년 10월 31일)
//   결제창이 끝난 뒤 브라우저가 부른다. 서버가 포트원 API 로 상태(PAID)·금액을 다시 확인하고
//   새 광고면 주문을 '배너 검토 중'으로 만들고, 연장이면 기간을 늘린다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { finalizePayment, paymentOrderId } from '@/server/partner/pay';
import { fail, partnerOr401 } from '../../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const raw = (await req.json().catch(() => null)) as { paymentId?: unknown } | null;
  const paymentId = typeof raw?.paymentId === 'string' ? raw.paymentId : '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(paymentId)) return fail(400, '결제 번호가 달라요');
  const r = await finalizePayment(paymentId, me.id);
  // 새 광고면 완료 안내용 주문 번호도 같이 준다(2026-10-30)
  const orderId = r.ok && r.data === 'done' ? await paymentOrderId(paymentId, me.id) : null;
  return r.ok ? NextResponse.json({ ok: true, state: r.data, orderId }) : fail(400, r.error);
}
