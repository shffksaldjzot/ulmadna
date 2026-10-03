'use client';

// ──────────────────────────────────────────────
// /reset-password?token=… — 메일 링크로 들어와 새 비밀번호 정하기
// 새 비밀번호 · 확인 → POST /api/auth/reset-password → 성공하면 로그인 화면으로 안내.
// 링크는 30분 · 1회용(서버가 확인). 메일 키가 없는 동안엔 이 화면에 올 링크 자체가 안 나간다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthPage, Field, PasswordInput, primaryBtnCls } from '@/components/account/AuthUi';
import { passwordProblem } from '@/lib/account/validate';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // 주소창의 열쇠(token)를 화면이 뜬 뒤 읽는다
  useEffect(() => {
    void Promise.resolve().then(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const p = passwordProblem(pw) ?? (pw !== pw2 ? '비밀번호가 서로 달라요' : null);
    if (p) return setErr(p);
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw, password2: pw2 }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || '바꾸지 못했어요');
      setDone(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '바꾸지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage>
      <AuthCard>
        <h1 className="t-page text-ink mb-1 text-center">새 비밀번호</h1>
        {done ? (
          <>
            <p className="t-sub text-safe my-5 text-center">비밀번호를 바꿨어요</p>
            <Link href="/login" className={primaryBtnCls}>
              로그인하기
            </Link>
          </>
        ) : !token ? (
          <p className="t-sub text-ink-2 mt-4 text-center">
            링크가 올바르지 않아요 ·{' '}
            <Link href="/find-password" className="font-semibold text-accent">
              다시 요청
            </Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-5">
            <Field label="새 비밀번호" hint="영문과 숫자를 섞어 8자 이상">
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" maxLength={64} aria-label="새 비밀번호" />
            </Field>
            <Field label="새 비밀번호 확인" error={err || null}>
              <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" maxLength={64} aria-label="새 비밀번호 확인" />
            </Field>
            <button type="submit" className={primaryBtnCls} disabled={busy}>
              {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
            </button>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}
