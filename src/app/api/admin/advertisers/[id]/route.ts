// ──────────────────────────────────────────────
// 관리자 API: 광고주 한 곳 — /api/admin/advertisers/[id]  (2026년 10월 30일)
//   GET   상세(계정·주문·결제)
//   PATCH { memo } 메모 저장 / { status: 'active'|'blocked' } 정지·활성
//   POST  { action: 'reset' } 임시 비밀번호 발급 / { action: 'reject', orderId, reason } 주문 반려(환불)
//   게재·중지는 기존 /api/admin/ads 의 run 동작을 그대로 쓴다. 모두 관리자 쿠키 필요(없으면 401).
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { getAdminAdvertiser, rejectOrder, resetPassword, saveMemo, setAccountStatus } from '@/server/admin/advertisers';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const bad = (m = '요청 형식이 달라요') => NextResponse.json({ error: m }, { status: 400 });
const noAuth = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
/** 주소의 광고주 번호(양의 정수만) */
const idOf = async (c: Ctx) => {
  const n = Number((await c.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function GET(req: Request, ctx: Ctx) {
  if (!isAdminRequest(req)) return noAuth();
  const id = await idOf(ctx);
  if (!id) return bad();
  const d = await getAdminAdvertiser(id);
  if (!d) return NextResponse.json({ error: '광고주를 찾지 못했어요' }, { status: 404 });
  return NextResponse.json({ advertiser: d });
}

export async function PATCH(req: Request, ctx: Ctx) {
  if (!isAdminRequest(req)) return noAuth();
  const id = await idOf(ctx);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!id || !body) return bad();
  if ('memo' in body) {
    const r = await saveMemo(id, body.memo);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 500 });
  }
  if (body.status === 'active' || body.status === 'blocked') {
    const r = await setAccountStatus(id, body.status);
    return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  return bad();
}

export async function POST(req: Request, ctx: Ctx) {
  if (!isAdminRequest(req)) return noAuth();
  const id = await idOf(ctx);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!id || !body) return bad();
  if (body.action === 'reset') {
    const r = await resetPassword(id);
    return r.ok ? NextResponse.json({ ok: true, ...r.data }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (body.action === 'reject') {
    const orderId = Number(body.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) return bad();
    const r = await rejectOrder(id, orderId, typeof body.reason === 'string' ? body.reason : '');
    return r.ok ? NextResponse.json({ ok: true, ...r.data }) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  return bad();
}
