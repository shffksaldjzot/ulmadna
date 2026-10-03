// ──────────────────────────────────────────────
// 비밀번호 바꾸기(로그인한 아이디 회원) — POST /api/auth/password { current, password, password2 }
// 카카오 회원은 비밀번호가 없어 400.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { currentUserId, fail } from '@/lib/ask/session';
import { adminOrNull } from '@/lib/ask/server';
import { checkPassword, findUserById, hashPassword, uuidOf } from '@/lib/account/users';
import { passwordProblem } from '@/lib/account/validate';
import { hit, sleep } from '@/lib/account/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const sid = await currentUserId();
  if (!sid) return fail(401, '로그인이 필요해요');
  const uuid = uuidOf(sid);
  if (!uuid) return fail(400, '카카오 회원은 비밀번호가 없어요');
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return fail(400, '보낸 내용을 읽지 못했어요');
  }
  const current = typeof raw.current === 'string' ? raw.current : '';
  const password = typeof raw.password === 'string' ? raw.password : '';
  const password2 = typeof raw.password2 === 'string' ? raw.password2 : '';
  const p = passwordProblem(password);
  if (p) return fail(400, p);
  if (password !== password2) return fail(400, '새 비밀번호가 서로 달라요');
  if ((await hit(`pwchange:${uuid}`, 10 * 60)) > 5) return fail(429, '잠시 뒤 다시 시도해 주세요');

  const user = await findUserById(uuid);
  const sb = adminOrNull();
  if (!user || !sb) return fail(503, '잠시 뒤 다시 시도해 주세요');
  if (!(await checkPassword(current, user.password_hash))) {
    await sleep(800);
    return fail(400, '지금 비밀번호가 맞지 않아요');
  }
  const { error } = await sb.from('ask_users').update({ password_hash: await hashPassword(password) }).eq('id', uuid);
  if (error) return fail(500, '바꾸지 못했어요');
  return NextResponse.json({ ok: true });
}
