import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // /admin 경로 보호
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const authCookie = request.cookies.get('admin-auth');

    const token = process.env.NEXTAUTH_SECRET || 'fallback-token';
    if (authCookie?.value !== token) {
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
