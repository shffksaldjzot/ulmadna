import NextAuth from 'next-auth';
import Kakao from 'next-auth/providers/kakao';
import { captureAuthError } from './authDiag';

// 환경변수에서 카카오 열쇠를 읽어온다 (앞뒤 공백 제거 — 복붙 실수 방지)
const KAKAO_ID = (process.env.KAKAO_CLIENT_ID || '').trim();
const KAKAO_SECRET = (process.env.KAKAO_CLIENT_SECRET || '').trim();

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Kakao({
      clientId: KAKAO_ID,
      // 카카오 개발자 콘솔에서 "Client Secret 사용 안함"으로 둔 경우를 대비.
      // 값이 비어 있으면 client_secret 방식 자체를 끄고(none) 보낸다.
      // (빈 문자열을 그대로 넘기면 라이브러리가 콜백 단계에서 통째로 터진다)
      clientSecret: KAKAO_SECRET,
      checks: ['state'],
      ...(KAKAO_SECRET ? {} : { client: { token_endpoint_auth_method: 'none' as const } }),
    }),
  ],
  pages: {
    signIn: '/login',
    // 오류가 나면 영어 500 화면 대신 우리 한글 로그인 화면으로 보낸다
    error: '/login',
  },
  // 로그인 도중 오류가 나면 원인을 붙잡아둔다 (실제 저장은 라우트에서)
  logger: {
    error(error) {
      captureAuthError(error);
      console.error('[auth][error]', error);
    },
    warn() {},
    debug() {},
  },
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
