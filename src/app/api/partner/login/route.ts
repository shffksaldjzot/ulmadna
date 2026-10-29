// ─────────────────────────────────────────────────────────────
// 광고주 로그인 — POST /api/partner/login { email, password } (2026년 10월 31일)
//   같은 IP 또는 같은 이메일이 15분 안에 5번 틀리면 잠근다(관리자 로그인과 같은 방식, 서버 메모리).
//   성공하면 랜덤 세션 값을 httpOnly 쿠키(partner-session, 30일)로 준다. DB 엔 그 해시만.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { normalizeEmail } from '@/lib/partner/rules';
import { clearFails, lockedFor, newSession, recordFail, SESSION_COOKIE, verifyPassword } from '@/server/partner/crypto';
import { findAccount, saveSession } from '@/server/partner/store';
import { clientIp, sessionCookieOptions } from '@/server/partner/session';
import { fail } from '../_util';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeEmail(raw?.email);
  const password = typeof raw?.password === 'string' ? raw.password : '';
  const ipKey = `ip:${clientIp(req)}`;
  const emKey = `em:${email}`;
  // 잠겨 있으면 남은 시간 안내
  const wait = Math.max(lockedFor(ipKey), lockedFor(emKey));
  if (wait) {
    return NextResponse.json({ error: `${Math.ceil(wait / 60)}분 뒤에 다시 시도해 주세요` }, { status: 429, headers: { 'Retry-After': String(wait) } });
  }
  if (!email || !password) return fail(400, '이메일과 비밀번호를 적어 주세요');

  const acc = await findAccount(email);
  if (!acc.ok) return fail(503, '지금은 로그인할 수 없어요(준비 중)');
  const found = acc.data;
  const ok = !!found && found.status === 'active' && (await verifyPassword(password, found.passwordHash));
  if (!ok || !found) {
    recordFail(ipKey);
    recordFail(emKey);
    return fail(401, '이메일 또는 비밀번호가 맞지 않아요');
  }
  clearFails(ipKey);
  clearFails(emKey);
  const s = newSession();
  if (!(await saveSession(found.advertiserId, s.hash, s.expiresAt))) return fail(503, '지금은 로그인할 수 없어요(준비 중)');
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, s.token, sessionCookieOptions());
  return res;
}
