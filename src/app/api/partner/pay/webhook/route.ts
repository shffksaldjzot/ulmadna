// ─────────────────────────────────────────────────────────────
// 포트원 웹훅 수신 — POST /api/partner/pay/webhook (뼈대, 2026년 10월 31일)
//
// [무슨 기능인가]
//   휴대폰에서 결제 뒤 화면이 닫히는 등 브라우저 확인이 안 와도, 포트원이 결제 완료를
//   직접 알려 주면(Transaction.Paid) 같은 확인 함수(finalizePayment)를 돌린다.
//   웹훅 내용은 믿지 않고 paymentId 만 꺼내 포트원 API 로 다시 확인하므로,
//   가짜 웹훅이 와도 실제 결제가 없으면 아무 일도 안 생긴다.
//
//   TODO: 포트원 콘솔에서 웹훅 시크릿(PORTONE_WEBHOOK_SECRET)을 받으면
//         Standard Webhooks 서명 검증(@portone/server-sdk 의 Webhook.verify)을 더한다.
//   포트원은 실패 응답이면 다시 보낸다 — 처리 오류여도 200 을 돌려 반복을 막는다(이미 처리된 건은 그대로 done).
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { finalizePayment } from '@/server/partner/pay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { type?: unknown; data?: { paymentId?: unknown } } | null;
  const paymentId = typeof body?.data?.paymentId === 'string' ? body.data.paymentId : '';
  // 우리 결제 번호 모양(ulm-...)이고 결제 완료 알림일 때만 처리. 모르는 종류는 무시
  if (body?.type === 'Transaction.Paid' && /^ulm-[A-Za-z0-9-]{4,60}$/.test(paymentId)) {
    const r = await finalizePayment(paymentId, null);
    if (!r.ok) console.warn(`[partner-webhook] ${paymentId}: ${r.error}`);
  }
  return NextResponse.json({ ok: true });
}
