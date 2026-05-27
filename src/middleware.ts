import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // /admin 경로 보호
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const sessionToken = process.env.NEXTAUTH_SECRET;

    // NEXTAUTH_SECRET 미설정 시 admin 접근 무조건 차단
    // (예전엔 'fallback-token' 폴백이 있어서 환경변수만 빠지면 누구나 우회 가능했음)
    if (!sessionToken) {
      console.error('[middleware] NEXTAUTH_SECRET 미설정 — admin 접근 차단');
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('error', 'misconfig');
      return NextResponse.redirect(loginUrl);
    }

    const authCookie = request.cookies.get('admin-auth');
    if (authCookie?.value !== sessionToken) {
      // 로그인 페이지로 리다이렉트
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('from', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
