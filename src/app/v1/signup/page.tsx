// ──────────────────────────────────────────────
// v1 허브 — 가입 화면
// 디자인 가이드 v4 아트보드 03 "로그인·가입" 기준.
// 백엔드 회원가입이 아직 없어 UI만(제출 시 "준비 중" 토스트).
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';
import TopNav from '@/components/v1/TopNav';
import TextField from '@/components/v1/TextField';
import Checkbox from '@/components/v1/Checkbox';
import Button from '@/components/v1/Button';
import Toast, { showToast } from '@/components/v1/Toast';

export default function V1SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [agree, setAgree] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agree) {
      showToast(setToast, '이용약관에 동의해 주세요');
      return;
    }
    showToast(setToast, '가입은 준비 중이에요');
  }

  return (
    <>
      <TopNav title="가입" backHref="/v1/login" />

      <div className="px-4 pt-8 pb-8 flex flex-col gap-4 max-w-[420px] mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <TextField type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <TextField
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <TextField placeholder="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} />

          <Checkbox checked={agree} onChange={setAgree} label="이용약관 · 개인정보처리방침 동의" />

          <Button type="submit" fullWidth>
            가입하기
          </Button>
        </form>

        <p className="text-center text-[16px] text-v1-text-secondary">
          업체이신가요?{' '}
          <span className="text-brown font-semibold underline underline-offset-4">업체 가입</span>
        </p>
      </div>

      <Toast message={toast} />
    </>
  );
}
