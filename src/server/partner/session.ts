// ─────────────────────────────────────────────────────────────
// 광고주 로그인 확인 (서버 전용) — 2026년 10월 31일
//
// [무슨 기능인가]
//   화면(서버 컴포넌트)과 API 가 "지금 로그인한 업체가 누구인가"를 알아내는 창구.
//   쿠키 partner-session 값을 읽어 DB 세션 표와 맞춰 본다.
//   미들웨어는 쿠키가 "있는지"만 보고, 진짜 확인은 여기서 한다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_DAYS } from './crypto';
import { partnerFromToken, type PartnerState } from './store';

/** 지금 요청의 로그인 상태 */
export async function currentPartner(): Promise<PartnerState> {
  const jar = await cookies();
  return partnerFromToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * 화면용: 로그인 안 됐으면 로그인 화면으로 보낸다.
 * DB 가 안 되면 'down' 을 그대로 돌려줘서 화면이 "준비 중" 한 줄을 그린다(무한 이동 방지).
 */
export async function requirePartnerPage(): Promise<PartnerState & { state: 'ok' | 'down' }> {
  const s = await currentPartner();
  if (s.state === 'none') redirect('/partner/login');
  return s as PartnerState & { state: 'ok' | 'down' };
}

/** 세션 쿠키 설정값(httpOnly·sameSite lax·30일) */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_DAYS * 86400,
    path: '/',
  };
}

/** 요청 IP(잠금 기록용) */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
