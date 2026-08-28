// ──────────────────────────────────────────────
// v1 허브 — 로그인 화면
// 디자인 가이드 v4 아트보드 03 "로그인·가입" 기준.
// 이메일·비밀번호 로그인은 아직 백엔드가 없어 UI만(제출 시 "준비 중" 토스트).
// 카카오 로그인은 기존 NextAuth 설정(src/lib/auth.ts)에 그대로 연결한다.
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import TopNav from '@/components/v1/TopNav';
import TextField from '@/components/v1/TextField';
import Button from '@/components/v1/Button';
import Toast, { showToast } from '@/components/v1/Toast';

export default function V1LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 이메일·비밀번호 로그인 백엔드는 아직 없다 — 폼만 완성해 두고 안내만 띄운다
    showToast(setToast, '이메일 로그인은 준비 중이에요');
  }

  return (
    <>
      {/* 로그인 화면 자체에서는 상단 우측에 "로그인" 링크를 또 보여줄 필요가 없다 */}
      <TopNav rightSlot={<></>} />

      <div className="px-4 pt-8 pb-8 flex flex-col gap-4 max-w-[420px] mx-auto">
        <h1 className="text-[24px] font-bold text-foreground">로그인</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TextField
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <TextField
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <Button type="submit" fullWidth>
            로그인
          </Button>
        </form>

        <Button variant="secondary" fullWidth onClick={() => signIn('kakao', { callbackUrl: '/v1' })}>
          카카오로 로그인
        </Button>

        <div className="flex justify-center gap-5 pt-2">
          <button
            type="button"
            onClick={() => showToast(setToast, '비밀번호 찾기는 준비 중이에요')}
            className="text-[16px] text-v1-text-secondary underline underline-offset-4"
          >
            비밀번호 찾기
          </button>
          <Link href="/v1/signup" className="text-[16px] font-semibold text-brown underline underline-offset-4">
            가입하기
          </Link>
        </div>
      </div>

      <Toast message={toast} />
    </>
  );
}
