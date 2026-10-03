'use client';

// ──────────────────────────────────────────────
// /find-password — 비밀번호 찾기
//
// 1) 아이디 입력 → 가입 때 적은 "비밀번호 힌트"를 보여 준다(아이디당 10분 5회).
// 2) 이메일이 등록된 아이디 + 메일 발송 키가 있으면 [이메일로 재설정 링크 받기].
//    키가 없으면 "메일 재설정은 준비 중이에요 · 문의로 도와드려요" 한 줄 + 문의 시트.
// 3) 둘 다 안 되면 "문의로 재설정"(문의 시트).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { AuthCard, AuthPage, Field, inputCls, primaryBtnCls } from '@/components/account/AuthUi';
import { openContactSheet } from '@/lib/contactSheet';

interface HintRes {
  hint: string;
  hasEmail: boolean;
  mailEnabled: boolean;
}

export default function FindPasswordPage() {
  const [username, setUsername] = useState('');
  const [res, setRes] = useState<HintRes | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mailState, setMailState] = useState<'idle' | 'sending' | 'sent' | 'fail'>('idle');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || busy) return;
    setBusy(true);
    setErr('');
    setRes(null);
    setMailState('idle');
    try {
      const r = await fetch('/api/auth/hint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const d = (await r.json().catch(() => ({}))) as HintRes & { error?: string };
      if (!r.ok) throw new Error(d.error || '확인하지 못했어요');
      setRes(d);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '확인하지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  async function sendMail() {
    setMailState('sending');
    try {
      const r = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean };
      setMailState(r.ok && d.ok ? 'sent' : 'fail');
    } catch {
      setMailState('fail');
    }
  }

  /** 문의로 재설정 — 공용 문의 시트(전화·카톡) */
  const contactLink = (
    <button type="button" onClick={() => openContactSheet('header')} className="font-semibold text-accent underline underline-offset-2">
      문의로 재설정
    </button>
  );

  return (
    <AuthPage>
      <AuthCard>
        <h1 className="t-page text-ink mb-1 text-center">비밀번호 찾기</h1>
        <p className="t-sub text-ink-2 mb-6 text-center">아이디를 적으면 가입 때 적은 힌트를 보여 드려요</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="아이디" error={err || null}>
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" maxLength={16} aria-label="아이디" />
          </Field>
          <button type="submit" className={primaryBtnCls} disabled={busy || !username.trim()}>
            {busy ? '확인 중…' : '힌트 보기'}
          </button>
        </form>

        {res && (
          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-xl bg-v1-card-soft border border-v1-line-2 px-4 py-3">
              <span className="t-sub text-ink-2">비밀번호 힌트</span>
              <p className="t-body font-bold text-ink mt-0.5">{res.hint}</p>
            </div>
            {res.hasEmail && res.mailEnabled ? (
              mailState === 'sent' ? (
                <p className="t-sub text-safe">등록한 이메일로 재설정 링크를 보냈어요 · 30분 안에 열어 주세요</p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={sendMail}
                    disabled={mailState === 'sending'}
                    className="w-full h-[52px] rounded-chip border border-line bg-surface text-ink text-[16px] font-bold disabled:opacity-50"
                  >
                    {mailState === 'sending' ? '보내는 중…' : '이메일로 재설정 링크 받기'}
                  </button>
                  {mailState === 'fail' && <p className="t-sub text-accent">메일을 보내지 못했어요 · {contactLink}</p>}
                </>
              )
            ) : res.hasEmail ? (
              <p className="t-sub text-ink-2">메일 재설정은 준비 중이에요 · {contactLink}</p>
            ) : (
              <p className="t-sub text-ink-2">등록한 이메일이 없어요 · 힌트로도 모르겠다면 {contactLink}</p>
            )}
          </div>
        )}

        <p className="mt-6 text-center t-sub text-ink-2">
          아이디도 기억나지 않으면 {contactLink} ·{' '}
          <Link href="/login" className="font-semibold text-accent">
            로그인
          </Link>
        </p>
      </AuthCard>
    </AuthPage>
  );
}
