// ─────────────────────────────────────────────────────────────
// 결제 실패 사유 기록 — POST /api/partner/pay/fail { paymentId, message } (2026년 10월 30일)
//   결제창이 거절·실패로 끝나면 브라우저가 PG 메시지를 알려 준다. 서버가 내 결제인지·정말 결제 전인지 확인한 뒤
//   partner_payments.fail_reason 에 기록한다(관리자가 원인을 볼 수 있게).
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { recordPayFail } from '@/server/partner/pay';
import { fail, partnerOr401 } from '../../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const raw = (await req.json().catch(() => null)) as { paymentId?: unknown; message?: unknown } | null;
  const paymentId = typeof raw?.paymentId === 'string' ? raw.paymentId : '';
  if (!/^[A-Za-z0-9-]{8,64}$/.test(paymentId)) return fail(400, '결제 번호가 달라요');
  const message = typeof raw?.message === 'string' ? raw.message.slice(0, 300) : '';
  await recordPayFail(paymentId, me.id, message);
  return NextResponse.json({ ok: true });
}
