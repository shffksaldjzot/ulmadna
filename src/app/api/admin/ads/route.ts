// ──────────────────────────────────────────────
// 관리자: 광고 운영 동작 모음 — POST /api/admin/ads  { action, ... }  (2026년 10월 29일)
//
// [무슨 기능인가]
//   광고주 등록 · 주문 만들기 · 입금 확인/되돌리기/환불 · 게재 승인/중지/종료 · 클릭 주소 수정을
//   action 값으로 나눠 처리한다. 관리자 로그인 쿠키가 없으면 401.
//   서비스 롤 열쇠는 store.ts(서버)에서만 쓰고 브라우저에는 결과만 보낸다.
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import {
  createAdvertiser,
  createOrder,
  setOrderLink,
  setPayStatus,
  setRunStatus,
} from '@/server/ads/store';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') return NextResponse.json({ error: '요청 형식이 달라요' }, { status: 400 });
  const id = Number(body.id);

  let r: { ok: boolean; id?: number; error?: string };
  switch (body.action) {
    case 'advertiser':
      r = await createAdvertiser(body);
      break;
    case 'order':
      r = await createOrder(body);
      break;
    case 'pay': {
      // 입금 확인(paid) · 되돌리기(pending) · 환불(refunded)
      const st = body.status;
      if (!Number.isInteger(id) || (st !== 'paid' && st !== 'pending' && st !== 'refunded')) {
        return NextResponse.json({ error: '요청 형식이 달라요' }, { status: 400 });
      }
      r = await setPayStatus(id, st, typeof body.ref === 'string' ? body.ref.slice(0, 100) : undefined);
      break;
    }
    case 'run': {
      // 게재(live) · 중지(stopped) · 종료(ended) · 심사중으로(review) · 반려 사유는 note
      const st = body.status;
      if (!Number.isInteger(id) || (st !== 'live' && st !== 'stopped' && st !== 'ended' && st !== 'review')) {
        return NextResponse.json({ error: '요청 형식이 달라요' }, { status: 400 });
      }
      r = await setRunStatus(id, st, typeof body.note === 'string' ? body.note.slice(0, 300) : undefined);
      break;
    }
    case 'link':
      if (!Number.isInteger(id)) return NextResponse.json({ error: '요청 형식이 달라요' }, { status: 400 });
      r = await setOrderLink(id, body.click_url, body.phone);
      break;
    default:
      return NextResponse.json({ error: '알 수 없는 동작이에요' }, { status: 400 });
  }
  return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.error }, { status: 400 });
}
