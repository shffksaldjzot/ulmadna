'use client';
// ─────────────────────────────────────────────────────────────
// /partner/signup — 광고주 가입 (2026년 10월 31일)
//   칸: 상호 · 사업자번호(형식 검사) · 주로 시공 지역 · 이메일 · 비밀번호 · 약관 동의
//   보내기: POST /api/partner/signup → 성공하면 바로 로그인된 상태로 /partner/new(새 광고 신청)
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { PARTNER_REGIONS, isBizNo, isEmail, normalizeBizNo, passwordProblem } from '@/lib/partner/rules';
import { AuthShell, inputCls, primaryBtn } from '../_ui';

/** 사업자번호 입력 중 자동 하이픈(000-00-00000) */
function dashBiz(v: string): string {
  const d = normalizeBizNo(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function PartnerSignup() {
  const [f, setF] = useState({ name: '', bizNo: '', region: '', email: '', password: '', agree: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  // 칸별 문제(다 채운 칸만 검사해 한 줄로)
  const bizBad = normalizeBizNo(f.bizNo).length === 10 && !isBizNo(f.bizNo);
  const emailBad = f.email.length > 3 && !isEmail(f.email.trim().toLowerCase());
  const pwBad = f.password ? passwordProblem(f.password) : null;
  const ready = f.name.trim() && isBizNo(f.bizNo) && f.region && isEmail(f.email.trim().toLowerCase()) && !passwordProblem(f.password) && f.agree;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/partner/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        location.href = '/partner/new';
        return;
      }
      setErr(d.error || '가입하지 못했어요');
    } catch {
      setErr('연결이 끊겼어요');
    }
    setBusy(false);
  };

  return (
    <AuthShell title="광고주 가입">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-ink">상호</span>
          <input className={inputCls} value={f.name} maxLength={80} onChange={(e) => set('name', e.target.value)} placeholder="예: 도토리인테리어" autoComplete="organization" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-ink">사업자번호</span>
          <input className={inputCls} value={f.bizNo} inputMode="numeric" onChange={(e) => set('bizNo', dashBiz(e.target.value))} placeholder="000-00-00000" />
          {bizBad && <span className="mt-1 block text-[13px] text-danger">번호를 다시 확인해 주세요</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-ink">주로 시공하는 지역</span>
          <select className={inputCls} value={f.region} onChange={(e) => set('region', e.target.value)}>
            <option value="">고르기</option>
            {PARTNER_REGIONS.map(([c, n]) => (
              <option key={c} value={c}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-ink">이메일</span>
          <input className={inputCls} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="로그인·세금계산서용" />
          {emailBad && <span className="mt-1 block text-[13px] text-danger">이메일 형식을 확인해 주세요</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-medium text-ink">비밀번호</span>
          <input className={inputCls} type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} placeholder="영문+숫자 8자 이상" />
          {pwBad && <span className="mt-1 block text-[13px] text-danger">{pwBad}</span>}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={f.agree} onChange={(e) => set('agree', e.target.checked)} />
          <span className="text-[14px] text-ink">
            <Link href="/ads-terms" className="underline underline-offset-4" target="_blank">광고 약관</Link>·
            <Link href="/privacy" className="underline underline-offset-4" target="_blank">개인정보 처리방침</Link> 동의
          </span>
        </label>
        {err && <p className="text-[14px] text-danger" role="alert">{err}</p>}
        <button className={primaryBtn} disabled={!ready || busy}>{busy ? '가입 중…' : '가입하고 광고 신청'}</button>
      </form>
      <p className="mt-6 text-center text-[14px] text-ink-2">
        이미 가입했나요?{' '}
        <Link href="/partner/login" className="inline-block h-11 leading-[44px] font-semibold text-brown underline underline-offset-4">로그인</Link>
      </p>
    </AuthShell>
  );
}
