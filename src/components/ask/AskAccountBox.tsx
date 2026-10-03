// ──────────────────────────────────────────────
// 내 질문 화면 아래 — 비밀번호 바꾸기(아이디 회원만) · 회원 탈퇴(작은 글자 링크)
//
// 비밀번호 바꾸기: 지금 비밀번호 · 새 비밀번호 · 확인 → POST /api/auth/password
// 회원 탈퇴: 한 번 확인 → DELETE /api/auth/account → 로그아웃 → 홈
//   (올린 질문·댓글은 쓸 때의 닉네임으로 남는다고 확인 창에 적어 둔다)
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useState, type FormEvent } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { isIdUser, passwordProblem } from '@/lib/account/validate';
import { showAskToast } from './AskToast';

export default function AskAccountBox() {
  const { data: session } = useSession();
  const idUser = isIdUser(session?.user?.id);
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePw(e: FormEvent) {
    e.preventDefault();
    const p = passwordProblem(pw) ?? (pw !== pw2 ? '새 비밀번호가 서로 달라요' : null);
    if (p) return setErr(p);
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: cur, password: pw, password2: pw2 }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error || '바꾸지 못했어요');
      setCur('');
      setPw('');
      setPw2('');
      setOpen(false);
      showAskToast('비밀번호를 바꿨어요');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '바꾸지 못했어요');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!window.confirm('정말 탈퇴할까요?\n아이디·닉네임이 지워지고 되돌릴 수 없어요.\n올린 질문·댓글은 그때 이름으로 남아요.')) return;
    try {
      const r = await fetch('/api/auth/account', { method: 'DELETE' });
      if (!r.ok) throw new Error();
      await signOut({ callbackUrl: '/' });
    } catch {
      showAskToast('탈퇴하지 못했어요 · 문의로 도와드릴게요');
    }
  }

  if (!session?.user) return null;
  return (
    <section className="related">
      {idUser && (
        <div className="card">
          <button type="button" className="ttl" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ width: '100%', textAlign: 'left' }}>
            비밀번호 바꾸기
          </button>
          {open && (
            <form className="f" onSubmit={changePw} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="지금 비밀번호" autoComplete="current-password" aria-label="지금 비밀번호" />
              <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="새 비밀번호(영문+숫자 8자 이상)" autoComplete="new-password" aria-label="새 비밀번호" />
              <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="새 비밀번호 확인" autoComplete="new-password" aria-label="새 비밀번호 확인" />
              {err && <div className="err">{err}</div>}
              <button type="submit" className="btn p" disabled={busy}>
                {busy ? '바꾸는 중…' : '바꾸기'}
              </button>
            </form>
          )}
        </div>
      )}
      <p style={{ margin: '14px 2px 0', fontSize: 13 }}>
        <button type="button" onClick={withdraw} style={{ color: 'var(--ink-3)', textDecoration: 'underline' }}>
          회원 탈퇴
        </button>
      </p>
    </section>
  );
}
