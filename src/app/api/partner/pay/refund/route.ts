// ─────────────────────────────────────────────────────────────
// 카드 환불(관리자 전용) — POST /api/partner/pay/refund { paymentId, reason } (뼈대, 2026년 10월 31일)
//   광고 반려 때 관리자가 부른다. 포트원 결제 전액 취소 → 결제 기록 환불 → 주문 중지.
//   관리자 로그인 쿠키(admin-auth)가 있어야 한다. 관리자 화면 단추 연결은 관리자 화면 작업 때.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { refundPayment } from '@/server/partner/pay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = (await req.json().catch(() => null)) as { paymentId?: unknown; reason?: unknown } | null;
  const paymentId = typeof raw?.paymentId === 'string' ? raw.paymentId : '';
  const reason = typeof raw?.reason === 'string' ? raw.reason : '광고 반려';
  if (!paymentId) return NextResponse.json({ error: '결제 번호가 필요해요' }, { status: 400 });
  const r = await refundPayment(paymentId, reason);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
}
