import NextAuth from 'next-auth';
import Kakao from 'next-auth/providers/kakao';
import Credentials from 'next-auth/providers/credentials';
import { captureAuthError } from './authDiag';
// 아이디 회원(익명 가입) 로그인 — 2026년 10월 03일 추가
import { adminOrNull } from './ask/server';
import { checkPassword, findUserByLogin, sessionIdOf } from './account/users';
import { clear, hit, peek, sleep } from './account/rateLimit';
import { normalizeEmail, normalizeUsername } from './account/validate';

// 로그인 실패 제한: 같은 아이디(또는 이메일)로 10분 동안 5번 틀리면 잠시 막는다
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_FAIL_WINDOW = 10 * 60;

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
    // ── 아이디(또는 이메일) + 비밀번호 로그인 ──
    // 세션 회원 번호는 "user:<uuid>" — 카카오 회원 번호(숫자)와 절대 섞이지 않게 앞에 user: 를 붙인다.
    // 실패 이유는 구분하지 않는다(아이디가 없든 비밀번호가 틀리든 똑같이 실패 → 화면도 한 줄 안내).
    Credentials({
      id: 'credentials',
      name: '아이디',
      credentials: { login: {}, password: {} },
      async authorize(raw) {
        const login = typeof raw?.login === 'string' ? raw.login.trim() : '';
        const password = typeof raw?.password === 'string' ? raw.password : '';
        if (!login || !password || password.length > 64) return null;
        const key = `login:${login.includes('@') ? normalizeEmail(login) : normalizeUsername(login)}`;
        // 이미 10분 안에 5번 틀렸으면 비밀번호를 보지도 않고 거절
        if ((await peek(key)) >= LOGIN_FAIL_LIMIT) {
          await sleep(800);
          return null;
        }
        const user = await findUserByLogin(login);
        const ok = !!user && user.status === 'active' && (await checkPassword(password, user.password_hash));
        if (!ok || !user) {
          await hit(key, LOGIN_FAIL_WINDOW);
          await sleep(800); // 틀리면 일부러 늦게 답한다(마구 맞혀 보기 방지)
          return null;
        }
        await clear(key);
        // 마지막 로그인 시각 기록(실패해도 로그인엔 영향 없음)
        try {
          await adminOrNull()?.from('ask_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
        } catch {
          /* 무시 */
        }
        return { id: sessionIdOf(user.id), name: user.nickname };
      },
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
