// ──────────────────────────────────────────────
// /ask/my — 내 질문 · 저장한 질문 · 이름 바꾸기 (시안 my.html)
// 로그인한 사람마다 내용이 달라서 전부 브라우저 부품(AskMyClient)이 그린다. noindex.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import AskShell from '@/components/ask/AskShell';
import AskMyClient from '@/components/ask/AskMyClient';

export const metadata: Metadata = {
  title: '내 질문 — 얼마드나 물어보기',
  robots: { index: false, follow: false },
};

export default function AskMyPage() {
  return (
    <AskShell>
      <AskMyClient />
    </AskShell>
  );
}
