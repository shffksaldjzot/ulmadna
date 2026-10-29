'use client';
// ─────────────────────────────────────────────────────────────
// /partner/login — 광고주 로그인 (이메일 + 비밀번호) (2026년 10월 31일)
//   5번 틀리면 15분 잠금(서버). 성공하면 내 광고(/partner)로.
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthShell, inputCls, primaryBtn } from '../_ui';

export default function PartnerLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // 보내기: 성공하면 화면 전체를 새로 열어 쿠키가 바로 적용되게
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/partner/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        location.href = '/partner';
        return;
      }
      setErr(d.error || '로그인하지 못했어요');
    } catch {
      setErr('연결이 끊겼어요');
    }
    setBusy(false);
  };

  return (
    <AuthShell title="로그인">
      <form onSubmit={submit} className="space-y-3">
        <input className={inputCls} type="email" inputMode="email" autoComplete="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="이메일" />
        <input className={inputCls} type="password" autoComplete="current-password" placeholder="비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="비밀번호" />
        {err && <p className="text-[14px] text-danger" role="alert">{err}</p>}
        <button className={primaryBtn} disabled={busy || !email || !pw}>{busy ? '확인 중…' : '로그인'}</button>
      </form>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        처음이신가요?{' '}
        <Link href="/partner/signup" className="inline-block h-11 leading-[44px] font-semibold text-brown underline underline-offset-4">광고주 가입</Link>
      </p>
    </AuthShell>
  );
}
