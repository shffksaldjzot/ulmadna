'use client';

// ──────────────────────────────────────────────
// /signup — 아이디 회원가입(익명 가입)
//
// 칸: 아이디(영문·숫자 4~16자, 중복 확인) · 비밀번호(영문+숫자 8자 이상, 눈 아이콘) · 비밀번호 확인 ·
//     비밀번호 힌트(필수) · 이메일(선택, 비밀번호 찾기용) · 닉네임(2~12자, 중복 확인) · 약관 동의.
// 실명 · 전화번호는 받지 않는다.
// 보내기: POST /api/auth/signup → 성공하면 바로 signIn('credentials') → 돌아갈 곳(callbackUrl)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthPage, Field, PasswordInput, inputCls, primaryBtnCls, readCallbackUrl } from '@/components/account/AuthUi';
import { emailProblem, hintProblem, passwordProblem, signupProblem, usernameProblem, type SignupInput } from '@/lib/account/validate';
import { nicknameProblem } from '@/lib/ask/format';

type Check = { ok: boolean; msg: string } | null;

/** 칸 값이 바뀌면 0.4초 쉬었다가 서버에 중복 확인 */
function useRemoteCheck(value: string, localProblem: (v: string) => string | null, url: (v: string) => string, okMsg: string): Check {
  const [check, setCheck] = useState<Check>(null);
  useEffect(() => {
    const v = value.trim();
    let alive = true;
    const t = setTimeout(
      () => {
        if (!v) return alive && setCheck(null);
        const p = localProblem(v);
        if (p) return alive && setCheck({ ok: false, msg: p });
        fetch(url(v), { cache: 'no-store' })
          .then((r) => r.json())
          .then((d: { available?: boolean; problem?: string | null }) => {
            if (alive) setCheck(d.available ? { ok: true, msg: okMsg } : { ok: false, msg: d.problem || '쓸 수 없어요' });
          })
          .catch(() => alive && setCheck(null));
      },
      v ? 400 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return check;
}

export default function SignupPage() {
  const [f, setF] = useState<SignupInput>({ username: '', password: '', password2: '', hint: '', email: '', nickname: '', agree: false });
  const [touched, setTouched] = useState<Partial<Record<keyof SignupInput, boolean>>>({});
  const [serverErr, setServerErr] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof SignupInput>(k: K, v: SignupInput[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (serverErr?.field === k) setServerErr(null);
  };
  const touch = (k: keyof SignupInput) => setTouched((t) => ({ ...t, [k]: true }));

  const idCheck = useRemoteCheck(f.username, usernameProblem, (v) => `/api/auth/check-username?u=${encodeURIComponent(v)}`, '쓸 수 있는 아이디예요');
  const nickCheck = useRemoteCheck(f.nickname, nicknameProblem, (v) => `/api/ask/profile?check=${encodeURIComponent(v)}`, '쓸 수 있는 닉네임이에요');

  // 칸별 오류(한 번 건드린 칸만 보여 줌)
  const err = (k: keyof SignupInput, msg: string | null) => (serverErr?.field === k ? serverErr.message : touched[k] ? msg : null);
  // 아이디: 서버가 알려 준 문제 → 중복 확인 결과 → 비어 있음 순으로
  const idErr =
    serverErr?.field === 'username' ? serverErr.message : idCheck && !idCheck.ok ? idCheck.msg : touched.username && !f.username.trim() ? '아이디를 적어 주세요' : null;
  const pwErr = err('password', f.password ? passwordProblem(f.password) : '비밀번호를 적어 주세요');
  const pw2Err = err('password2', f.password2 && f.password2 !== f.password ? '비밀번호가 서로 달라요' : null);
  const hintErr = err('hint', hintProblem(f.hint, f.password));
  const emailErr = err('email', emailProblem(f.email));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ username: true, password: true, password2: true, hint: true, email: true, nickname: true, agree: true });
    const p = signupProblem(f);
    if (p) {
      setServerErr({ field: p.field, message: p.message });
      return;
    }
    if (idCheck && !idCheck.ok) return setServerErr({ field: 'username', message: idCheck.msg });
    if (nickCheck && !nickCheck.ok) return setServerErr({ field: 'nickname', message: nickCheck.msg });
    setBusy(true);
    try {
      const r = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; field?: string };
      if (!r.ok) throw Object.assign(new Error(d.error || '가입하지 못했어요'), { field: d.field });
      // 가입 즉시 로그인
      const s = await signIn('credentials', { login: f.username.trim(), password: f.password, redirect: false });
      window.location.href = s && !s.error ? readCallbackUrl('/ask') : '/login';
    } catch (e2) {
      const ex = e2 as Error & { field?: string };
      setServerErr({ field: ex.field, message: ex.message });
      setBusy(false);
    }
  }

  return (
    <AuthPage>
      <AuthCard>
        <h1 className="t-page text-ink mb-1 text-center">회원가입</h1>
        <p className="t-sub text-ink-2 mb-6 text-center">실명 · 전화번호 없이 아이디만으로 가입해요</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="아이디" error={idErr} ok={idCheck?.ok ? idCheck.msg : null} hint="영문 · 숫자 4~16자">
            <input
              className={inputCls}
              value={f.username}
              onChange={(e) => set('username', e.target.value)}
              onBlur={() => touch('username')}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={16}
              aria-label="아이디"
            />
          </Field>
          <Field label="비밀번호" error={pwErr} hint="영문과 숫자를 섞어 8자 이상">
            <PasswordInput value={f.password} onChange={(e) => set('password', e.target.value)} onBlur={() => touch('password')} autoComplete="new-password" maxLength={64} aria-label="비밀번호" />
          </Field>
          <Field label="비밀번호 확인" error={pw2Err} ok={f.password2 && f.password2 === f.password && !passwordProblem(f.password) ? '같아요' : null}>
            <PasswordInput value={f.password2} onChange={(e) => set('password2', e.target.value)} onBlur={() => touch('password2')} autoComplete="new-password" maxLength={64} aria-label="비밀번호 확인" />
          </Field>
          <Field label="비밀번호 힌트" error={hintErr} hint="잊었을 때 이 힌트를 보여 드려요">
            <input className={inputCls} value={f.hint} onChange={(e) => set('hint', e.target.value)} onBlur={() => touch('hint')} maxLength={30} placeholder="예: 첫 강아지 이름" aria-label="비밀번호 힌트" />
          </Field>
          <Field label="이메일" required={false} error={emailErr} hint="비밀번호를 잊었을 때 재설정 링크를 받을 곳">
            <input
              className={inputCls}
              type="email"
              value={f.email}
              onChange={(e) => set('email', e.target.value)}
              onBlur={() => touch('email')}
              autoComplete="email"
              autoCapitalize="none"
              aria-label="이메일(선택)"
            />
          </Field>
          <Field label="닉네임" error={serverErr?.field === 'nickname' ? serverErr.message : nickCheck && !nickCheck.ok ? nickCheck.msg : null} ok={nickCheck?.ok ? nickCheck.msg : null} hint="질문과 댓글에 보이는 이름 · 2~12자">
            <input className={inputCls} value={f.nickname} onChange={(e) => set('nickname', e.target.value)} onBlur={() => touch('nickname')} maxLength={12} aria-label="닉네임" />
          </Field>

          <label className="flex items-start gap-2.5 t-sub text-ink-2 cursor-pointer select-none">
            <input type="checkbox" checked={f.agree} onChange={(e) => set('agree', e.target.checked)} className="mt-0.5 w-5 h-5 accent-[var(--accent)] flex-none" />
            <span>
              <Link href="/terms" className="underline" target="_blank">
                이용약관
              </Link>
              과{' '}
              <Link href="/privacy" className="underline" target="_blank">
                개인정보처리방침
              </Link>
              에 동의해요
            </span>
          </label>

          {serverErr && !['username', 'password', 'password2', 'hint', 'email', 'nickname'].includes(serverErr.field ?? '') && (
            <p className="text-[14px] font-semibold text-accent" role="alert">
              {serverErr.message}
            </p>
          )}

          <button type="submit" className={primaryBtnCls} disabled={busy}>
            {busy ? '가입하는 중…' : '가입하고 시작하기'}
          </button>
        </form>

        <p className="mt-5 text-center t-sub text-ink-2">
          이미 아이디가 있어요 ·{' '}
          <Link href="/login" className="font-semibold text-accent">
            로그인
          </Link>
        </p>
      </AuthCard>
    </AuthPage>
  );
}
