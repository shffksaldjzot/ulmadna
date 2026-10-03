// ──────────────────────────────────────────────
// /ask/nickname — 처음 한 번 닉네임 정하기 / 이름 바꾸기 (시안 login.html 아래쪽 .nickbox)
// 실제 움직임은 AskNicknameClient 가 한다. 검색 대상 아님(noindex).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import AskShell from '@/components/ask/AskShell';
import AskNicknameClient from '@/components/ask/AskNicknameClient';

export const metadata: Metadata = {
  title: '이름 정하기 — 얼마드나 물어보기',
  robots: { index: false, follow: false },
};

export default async function AskNicknamePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // 돌아갈 곳은 우리 사이트 안 주소만(바깥 주소로 튕기는 장난 방지)
  const safeNext = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/ask';
  return (
    <AskShell>
      <main className="app">
        <AskNicknameClient next={safeNext} />
        <aside className="aside" />
      </main>
    </AskShell>
  );
}
