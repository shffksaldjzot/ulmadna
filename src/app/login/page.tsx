'use client';

// ──────────────────────────────────────────────
// /login — 로그인 화면
//
// 2026-09-15 디자인 통일 작업: 공용 틀(SiteHeader·Container·SiteFooter)로 교체.
// 2026년 10월 03일: 물어보기에서 넘어오면 /login?callbackUrl=/ask/new 처럼 돌아올 곳을 달고 온다
//   (우리 사이트 안 주소만 받아들임 — 바깥 사이트로 튕기는 장난 방지). 없으면 홈.
// 2026년 10월 03일(형아 결정): 카카오 아래에 "아이디로 로그인" 추가(익명 가입 — 실명·전화번호 없음).
//   아이디 대신 등록한 이메일로도 로그인된다. 실패하면 어느 쪽이 틀렸는지 구분하지 않고 한 줄만 보여 준다.
//   "비밀번호를 잊었어요" → /find-password(힌트·메일 재설정·문의), "처음이에요" → /signup.
// ──────────────────────────────────────────────
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthPage, Field, PasswordInput, inputCls, primaryBtnCls, readCallbackUrl } from '@/components/account/AuthUi';

export default function LoginPage() {
  // 카카오 로그인 실패 시 NextAuth가 /login?error=... 로 되돌려 보낸다 (주소창을 직접 읽어 Suspense 없이 처리)
  const [errCode, setErrCode] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('/');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');

  useEffect(() => {
    // 화면이 뜬 뒤 한 박자 늦게 주소창을 읽는다(서버 그림과 어긋나지 않게)
    void Promise.resolve().then(() => {
      const code = new URLSearchParams(window.location.search).get('error');
      // 아이디 로그인 실패(CredentialsSignin)는 아래 칸에서 한 줄로 따로 보여 주므로 위 상자엔 안 띄움
      if (code && code !== 'CredentialsSignin') setErrCode(code);
      setCallbackUrl(readCallbackUrl('/'));
    });
  }, []);

  /** 아이디(또는 이메일) + 비밀번호 로그인 */
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!login.trim() || !password || busy) return;
    setBusy(true);
    setFail('');
    const r = await signIn('credentials', { login: login.trim(), password, redirect: false });
    if (r && !r.error) {
      window.location.href = callbackUrl;
      return;
    }
    setFail('아이디 또는 비밀번호를 확인해 주세요');
    setBusy(false);
  }

  const q = callbackUrl !== '/' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';

  return (
    <AuthPage>
      <AuthCard className="text-center">
        <h1 className="t-page text-ink mb-1">간편 로그인</h1>
        <p className="t-sub text-ink-2 mb-6">실명 · 전화번호는 받지 않아요</p>

        {/* 카카오 로그인 실패 안내 — 한 줄만, 오류코드는 작게(문의용) */}
        {errCode && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 t-sub text-danger">
            로그인에 실패했어요. 다시 시도해 주세요.
            <span className="block text-[10px] text-danger/60 mt-0.5">{errCode}</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => signIn('kakao', { callbackUrl })}
          className="w-full h-[52px] flex items-center justify-center gap-2.5 rounded-chip text-[16px] font-bold"
          style={{ backgroundColor: '#FEE500', color: '#191919' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 0.5C4.029 0.5 0 3.588 0 7.392c0 2.442 1.633 4.587 4.085 5.792-.13.488-.837 3.14-.864 3.338 0 0-.018.147.078.203.096.056.208.013.208.013.274-.038 3.175-2.076 3.674-2.432.264.037.534.056.81.056 4.971 0 9-3.088 9-6.892S13.971.5 9 .5"
              fill="#191919"
            />
          </svg>
          카카오로 1초 로그인
        </button>

        {/* 가르는 선 */}
        <div className="flex items-center gap-3 my-6 t-sub text-v1-text-disabled" aria-hidden="true">
          <span className="flex-1 border-t border-line" />
          또는 아이디로
          <span className="flex-1 border-t border-line" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 text-left">
          <Field label="아이디">
            <input
              className={inputCls}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              placeholder="아이디 또는 등록한 이메일"
              aria-label="아이디"
            />
          </Field>
          <Field label="비밀번호" error={fail || null}>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-label="비밀번호" />
          </Field>
          <button type="submit" className={`${primaryBtnCls} mt-1`} disabled={busy || !login.trim() || !password}>
            {busy ? '확인 중…' : '로그인'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-4 t-sub">
          <Link href="/find-password" className="text-ink-2 hover:text-accent">
            비밀번호를 잊었어요
          </Link>
          <span className="text-line" aria-hidden="true">|</span>
          <Link href={`/signup${q}`} className="font-semibold text-accent">
            처음이에요 · 회원가입
          </Link>
        </div>
      </AuthCard>
      <p className="text-center text-[12px] text-ink-2/70">
        카카오는 고유 번호만, 아이디 가입은 아이디 · 암호화된 비밀번호만 저장해요 ·{' '}
        <Link href="/privacy" className="underline">
          개인정보처리방침
        </Link>
      </p>
    </AuthPage>
  );
}
