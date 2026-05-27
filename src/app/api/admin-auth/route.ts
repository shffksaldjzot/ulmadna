import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// 어드민 비번 무차별 대입 방어용 메모리 레이트 리미터
//  - 같은 IP에서 15분 윈도우 동안 5회 실패하면 429 반환
//  - Vercel 인스턴스 단위 메모리라 분산 환경에선 완벽치 않지만
//    봇 brute force 1차 방어로는 충분
//  - 인스턴스 재시작 시 카운터 초기화됨 (의도된 동작)
// ─────────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAIL = 5;
const attemptLog = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(ip: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const entry = attemptLog.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attemptLog.set(ip, { count: 0, windowStart: now });
    return { ok: true };
  }
  if (entry.count >= RATE_LIMIT_MAX_FAIL) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000);
    return { ok: false, retryAfter };
  }
  return { ok: true };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = attemptLog.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attemptLog.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

function resetFailures(ip: string) {
  attemptLog.delete(ip);
}

export async function POST(req: Request) {
  // 환경변수 검증 — 미설정 시 'fallback-token' 같은 알려진 폴백으로 떨어지면
  // 누구나 admin 우회 가능. 따라서 미설정 시 폴백 없이 즉시 500.
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionToken = process.env.NEXTAUTH_SECRET;
  if (!adminPassword || !sessionToken) {
    console.error('[admin-auth] ADMIN_PASSWORD 또는 NEXTAUTH_SECRET 미설정');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // 클라이언트 IP 추출 (Vercel은 x-forwarded-for 헤더로 전달)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
          || req.headers.get('x-real-ip')
          || 'unknown';

  // 레이트 리밋 체크 — 윈도우 내 실패 누적 초과 시 차단
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  const { password } = await req.json();

  if (password !== adminPassword) {
    recordFailure(ip);
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }

  // 인증 성공 → 해당 IP 카운트 초기화
  resetFailures(ip);

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin-auth', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24시간
    path: '/',
  });

  return response;
}
