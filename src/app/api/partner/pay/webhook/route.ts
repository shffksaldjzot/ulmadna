// ─────────────────────────────────────────────────────────────
// 포트원 웹훅 수신 — POST /api/partner/pay/webhook (2026년 10월 31일, 서명 검증 10월 29일 추가)
//
// [무슨 기능인가]
//   휴대폰에서 결제 뒤 화면이 닫히는 등 브라우저 확인이 안 와도, 포트원이 결제 완료를
//   직접 알려 주면(Transaction.Paid) 같은 확인 함수(finalizePayment)를 돌린다.
//   웹훅 내용은 믿지 않고 paymentId 만 꺼내 포트원 API 로 다시 확인하므로,
//   가짜 웹훅이 와도 실제 결제가 없으면 아무 일도 안 생긴다.
//
// [서명 검증 — Standard Webhooks 방식]
//   포트원 콘솔에서 발급한 웹훅 시크릿(PORTONE_WEBHOOK_SECRET, "whsec_" + base64)으로
//   "webhook-id.webhook-timestamp.본문" 을 HMAC-SHA256 한 값을 webhook-signature 머리글("v1,<base64>" 여러 개 가능)과 비교한다.
//   시각이 5분 넘게 어긋나면 거부. 시크릿 환경변수가 없으면 검증을 건너뛰고(기존 동작) 경고만 남긴다.
//   포트원은 실패 응답이면 다시 보낸다 — 처리 오류여도 200 을 돌려 반복을 막는다(이미 처리된 건은 그대로 done).
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { finalizePayment } from '@/server/partner/pay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 서명이 맞는지. 시크릿이 없으면 null(검증 안 함) */
function verifySignature(req: Request, rawBody: string): boolean | null {
  const secret = process.env.PORTONE_WEBHOOK_SECRET?.trim();
  if (!secret) return null;
  const id = req.headers.get('webhook-id') ?? '';
  const ts = req.headers.get('webhook-timestamp') ?? '';
  const sigHeader = req.headers.get('webhook-signature') ?? '';
  if (!id || !ts || !sigHeader) return false;
  // 시각 검사(초 단위, 앞뒤 5분)
  const skew = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(skew) || skew > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest();
  // 머리글은 "v1,서명 v1,서명" 처럼 여러 개일 수 있다 — 하나라도 맞으면 통과(시간 안전 비교)
  return sigHeader.split(' ').some((part) => {
    const [ver, sig] = part.split(',');
    if (ver !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifySignature(req, raw);
  if (ok === false) return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  if (ok === null) console.warn('[partner-webhook] PORTONE_WEBHOOK_SECRET 없음 — 서명 검증 건너뜀');
  let body: { type?: unknown; data?: { paymentId?: unknown } } | null = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  const paymentId = typeof body?.data?.paymentId === 'string' ? body.data.paymentId : '';
  // 우리 결제 번호 모양(ulm-...)이고 결제 완료 알림일 때만 처리. 모르는 종류는 무시
  if (body?.type === 'Transaction.Paid' && /^ulm-[A-Za-z0-9-]{4,60}$/.test(paymentId)) {
    const r = await finalizePayment(paymentId, null);
    if (!r.ok) console.warn(`[partner-webhook] ${paymentId}: ${r.error}`);
  }
  return NextResponse.json({ ok: true });
}
