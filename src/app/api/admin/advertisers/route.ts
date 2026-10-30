// ──────────────────────────────────────────────
// 관리자 API: 광고주 목록 — GET /api/admin/advertisers?q=검색어  (2026년 10월 30일)
//   상호·이메일·사업자번호(하이픈 있어도 없어도)로 걸러 가입일 최신순으로 준다.
//   관리자 로그인 쿠키가 없으면 401.
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { listAdminAdvertisers } from '@/server/admin/advertisers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await listAdminAdvertisers();
  if (!rows) return NextResponse.json({ error: '광고주 표를 읽지 못했어요' }, { status: 503 });
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase();
  const qd = q.replace(/\D/g, '');
  const list = q
    ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || (qd.length >= 3 && r.bizNo.replace(/\D/g, '').includes(qd)))
    : rows;
  return NextResponse.json({ advertisers: list });
}
