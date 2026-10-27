// 관리자: 물어보기 글 숨김/표시 (POST {id, hidden}) — 2026-10-28
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { setAskHidden } from '@/server/admin/stats';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; hidden?: unknown } | null;
  const id = Number(body?.id);
  if (!body || !Number.isInteger(id) || typeof body.hidden !== 'boolean') {
    return NextResponse.json({ error: '요청 형식이 달라요' }, { status: 400 });
  }
  const ok = await setAskHidden(id, body.hidden);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: '저장하지 못했어요' }, { status: 500 });
}
