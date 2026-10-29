import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// 유입 경로(직접·검색·공유·그 밖) 판정 — 순수 함수라 미들웨어에서도 쓸 수 있다 (2026-10-27)
import { classifySource, SRC_COOKIE } from '@/server/metrics/requestInfo';

/**
 * 유입 경로 쿠키 심기 (2026-10-27, 자체 집계의 src 칸용)
 *
 * 사람이 화면 주소를 처음 열 때(문서 요청) Referer(직전 사이트)와 ?ref=share 표식을 보고
 * "이번 방문은 어디서 왔나"를 한 단어(direct/search/share/other)로 정해 세션 쿠키에 담는다.
 * 그 뒤 같은 방문 동안의 조회수·계산기 실행은 이 쿠키 값으로 유입 칸을 채운다
 * (계산 API 요청의 Referer 는 항상 우리 사이트라서 첫 화면에서 정해 둬야 한다).
 *   - 쿠키가 이미 있으면 그대로 둔다(사이트 안 이동이 첫 유입 경로를 덮지 않게).
 *     단, 공유 링크(?ref=share)로 들어오면 share 로 바꾼다.
 *   - 쿠키에는 그 한 단어만 — IP·주소·브라우저 정보는 안 담는다. 브라우저를 닫으면 사라진다.
 *   - Next 내부 요청(미리 불러오기·화면 조각 요청)은 Referer 가 의미 없어서 건너뛴다.
 */
function withSourceCookie(request: NextRequest, res: NextResponse): NextResponse {
  try {
    const hdr = request.headers;
    // 미리 불러오기(prefetch)·화면 조각(RSC) 요청은 사람이 주소를 연 게 아니므로 건너뜀
    if (hdr.get('rsc') || hdr.get('next-router-prefetch') || hdr.get('purpose') === 'prefetch') return res;
    const dest = hdr.get('sec-fetch-dest');
    if (dest && dest !== 'document') return res;
    const ref = request.nextUrl.searchParams.get('ref');
    const existing = request.cookies.get(SRC_COOKIE)?.value;
    if (existing && ref !== 'share') return res;
    const src = classifySource(ref, hdr.get('referer'), hdr.get('host'));
    // 사이트 안 이동(null)인데 쿠키가 없으면(예: 쿠키 차단·만료) 직접 유입으로 본다
    const value = src ?? 'direct';
    if (existing === value) return res;
    res.cookies.set(SRC_COOKIE, value, {
      path: '/',
      httpOnly: true, // 화면 스크립트는 못 읽음(서버 집계만 씀)
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      // 만료일 없음 = 브라우저를 닫으면 사라지는 세션 쿠키
    });
  } catch {
    // 쿠키 심기에 실패해도 화면은 그대로 보여준다
  }
  return res;
}

export function middleware(request: NextRequest) {
  // /admin 경로 보호
  // 2026-10-29 수리: '/admin-login' 도 '/admin' 으로 시작해서 로그인 페이지까지 막혀 무한 이동이 났다
  //   (10-27 유입 쿠키 작업으로 미들웨어가 모든 주소에서 돌게 된 뒤부터). /admin 과 /admin/... 만 보호한다.
  const path = request.nextUrl.pathname;
  if (path === '/admin' || path.startsWith('/admin/')) {
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

  return withSourceCookie(request, NextResponse.next());
}

export const config = {
  // 2026-10-27: /admin 보호 + 모든 화면 주소에서 유입 쿠키 심기.
  // API·Next 내부 파일·이미지·확장자 있는 파일(robots.txt 등)은 미들웨어를 안 거친다.
  matcher: ['/((?!api/|_next/|favicon\\.ico|.*\\..*).*)'],
};
