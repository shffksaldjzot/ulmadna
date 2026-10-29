// ─────────────────────────────────────────────────────────────
// 광고주 로그아웃 — POST /api/partner/logout (2026년 10월 31일)
//   DB 세션을 지우고 쿠키도 비운다.
// ─────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/server/partner/crypto';
import { dropSession } from '@/server/partner/store';

export const dynamic = 'force-dynamic';

export async function POST() {
  const jar = await cookies();
  await dropSession(jar.get(SESSION_COOKIE)?.value).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' });
  return res;
}
