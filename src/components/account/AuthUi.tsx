// ──────────────────────────────────────────────
// 로그인·회원가입·비밀번호 찾기 화면 공용 부품
//
// 라이브 /login 과 시안 login.html 결 그대로: 흰 카드(16px 둥글기) · 테두리 칸(50px, 12px 둥글기) ·
// 알약 단추(52px) · 강조색 하나. 색은 globals.css 정본 토큰만 쓴다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useState, type ReactNode, type InputHTMLAttributes } from 'react';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';

/** 화면 틀: 상단 바 + 가운데 카드 + 푸터 */
export function AuthPage({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <Container as="main" className="py-10 lg:py-14 flex justify-center flex-1">
        <div className="w-full max-w-[420px] flex flex-col gap-3">{children}</div>
      </Container>
      <SiteFooter />
    </>
  );
}

/** 흰 카드 */
export function AuthCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-surface rounded-card border border-line p-6 lg:p-7 ${className}`}>{children}</section>;
}

/** 칸 공통 모양 */
export const inputCls =
  'w-full h-[50px] rounded-xl border border-line bg-surface px-3.5 text-[16px] text-ink placeholder:text-v1-text-disabled outline-none focus:border-accent focus:ring-1 focus:ring-accent';

/** 주 단추(강조색 알약) */
export const primaryBtnCls =
  'w-full h-[52px] rounded-chip bg-accent hover:bg-accent-press text-white text-[16px] font-bold inline-flex items-center justify-center disabled:opacity-50 transition-colors';

/** 이름표 + 칸 + 안내/오류 한 줄 */
export function Field({
  label,
  required,
  hint,
  error,
  ok,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  ok?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[14px] font-medium text-ink-2">
        {label}
        {required === false && <b className="ml-1 text-[12.5px] font-semibold text-v1-text-disabled">선택</b>}
      </span>
      {children}
      {error ? (
        <span className="text-[13px] text-accent">{error}</span>
      ) : ok ? (
        <span className="text-[13px] text-safe">{ok}</span>
      ) : hint ? (
        <span className="text-[13px] text-v1-text-disabled">{hint}</span>
      ) : null}
    </div>
  );
}

/** 비밀번호 칸 — 오른쪽 눈 아이콘으로 보이기/숨기기 */
export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${inputCls} pr-12`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-ink-2"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {!show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}

/** 돌아갈 곳 읽기 — 우리 사이트 안 주소(/로 시작, //로 시작하지 않음)만, 없으면 기본값 */
export function readCallbackUrl(fallback = '/'): string {
  if (typeof window === 'undefined') return fallback;
  const cb = new URLSearchParams(window.location.search).get('callbackUrl');
  return cb && cb.startsWith('/') && !cb.startsWith('//') ? cb : fallback;
}
