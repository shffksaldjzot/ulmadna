// 관리자: 회원 차단/해제 (POST {id, blocked}) — 2026-10-28
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { setMemberBlocked } from '@/server/admin/stats';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; blocked?: unknown } | null;
  if (!body || typeof body.id !== 'string' || typeof body.blocked !== 'boolean') {
    return NextResponse.json({ error: '요청 형식이 달라요' }, { status: 400 });
  }
  const ok = await setMemberBlocked(body.id, body.blocked);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 });
}
