// ──────────────────────────────────────────────
// 비밀번호 찾기 1단계 — POST /api/auth/hint { username }
//   → { hint, hasEmail, mailEnabled }  (없는 아이디면 404)
//
// 익명 아이디라 계정이 있는지 드러나는 건 허용(지휘관 결정). 대신 아이디당 10분 5회로 막는다.
// 이메일 주소 자체는 돌려주지 않고 "있음/없음"만.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { fail } from '@/lib/ask/session';
import { findUserByLogin } from '@/lib/account/users';
import { hit } from '@/lib/account/rateLimit';
import { mailEnabled } from '@/lib/account/mail';
import { normalizeUsername, usernameProblem } from '@/lib/account/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const username = typeof raw.username === 'string' ? normalizeUsername(raw.username) : '';
  if (usernameProblem(username)) return fail(400, '아이디를 확인해 주세요');
  if ((await hit(`hint:${username}`, 10 * 60)) > 5) return fail(429, '잠시 뒤 다시 시도해 주세요(10분에 5번까지)');

  const user = await findUserByLogin(username);
  if (!user || user.status !== 'active') return fail(404, '없는 아이디예요');
  return NextResponse.json(
    { hint: user.hint, hasEmail: !!user.email, mailEnabled: mailEnabled() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
