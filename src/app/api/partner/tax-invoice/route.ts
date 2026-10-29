// ─────────────────────────────────────────────────────────────
// 세금계산서 요청 — POST /api/partner/tax-invoice { paymentId } (2026년 10월 31일)
//   결제 완료 건에 요청 시각만 기록한다. 관리자 알림·발행은 나중 작업.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { requestTaxInvoice } from '@/server/partner/store';
import { fail, partnerOr401 } from '../_util';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const raw = (await req.json().catch(() => null)) as { paymentId?: unknown } | null;
  const paymentId = typeof raw?.paymentId === 'string' ? raw.paymentId : '';
  if (!paymentId) return fail(400, '결제 번호가 필요해요');
  const r = await requestTaxInvoice(me.id, paymentId);
  return r.ok ? NextResponse.json({ ok: true }) : fail(400, r.error);
}
