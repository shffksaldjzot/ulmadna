// ──────────────────────────────────────────────
// 아이디 중복 확인 — GET /api/auth/check-username?u=아이디 → { available, problem }
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { adminOrNull } from '@/lib/ask/server';
import { normalizeUsername, usernameProblem } from '@/lib/account/validate';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get('u') ?? '';
  const problem = usernameProblem(u);
  if (problem) return NextResponse.json({ available: false, problem }, { headers: NO_STORE });
  const sb = adminOrNull();
  if (!sb) return NextResponse.json({ available: false, problem: '잠시 뒤 다시 확인해 주세요' }, { headers: NO_STORE });
  const { data, error } = await sb.from('ask_users').select('id').eq('username', normalizeUsername(u)).maybeSingle();
  if (error) return NextResponse.json({ available: false, problem: '잠시 뒤 다시 확인해 주세요' }, { headers: NO_STORE });
  return NextResponse.json({ available: !data, problem: data ? '이미 있는 아이디예요' : null }, { headers: NO_STORE });
}
