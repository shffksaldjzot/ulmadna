// ─────────────────────────────────────────────────────────────
// 광고주 비밀번호 변경 — POST { current, next } (2026-10-30)
//   현재 비밀번호가 맞아야 바뀌고, 지금 기기 말고 다른 기기 로그인은 전부 끊는다.
//   현재 비밀번호를 5번 틀리면 15분 잠근다(로그인과 같은 방식).
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { passwordProblem } from '@/lib/partner/rules';
import { clearFails, hashPassword, lockedFor, recordFail, SESSION_COOKIE, verifyPassword } from '@/server/partner/crypto';
import { changePassword, passwordHashOf } from '@/server/partner/store';
import { fail, partnerOr401 } from '../../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const me = await partnerOr401();
  if ('res' in me) return me.res;
  const key = `pw:${me.id}`;
  const wait = lockedFor(key);
  if (wait) return fail(429, `${Math.ceil(wait / 60)}분 뒤에 다시 시도해 주세요`);
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const current = typeof raw?.current === 'string' ? raw.current : '';
  const next = typeof raw?.next === 'string' ? raw.next : '';
  if (!current) return fail(400, '현재 비밀번호를 적어 주세요');
  const bad = passwordProblem(next);
  if (bad) return fail(400, bad);
  if (current === next) return fail(400, '현재와 다른 비밀번호로 정해 주세요');
  const hash = await passwordHashOf(me.id);
  if (!hash) return fail(503, '준비 중이에요');
  if (!(await verifyPassword(current, hash))) {
    recordFail(key);
    return fail(401, '현재 비밀번호가 맞지 않아요');
  }
  clearFails(key);
  const jar = await cookies();
  const r = await changePassword(me.id, await hashPassword(next), jar.get(SESSION_COOKIE)?.value);
  if (!r.ok) return fail(503, r.error);
  return NextResponse.json({ ok: true });
}
