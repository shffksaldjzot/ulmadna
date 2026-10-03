// ──────────────────────────────────────────────
// /signup 화면 머리 정보 — 제목과 "검색에 넣지 않음"(noindex)만 정한다.
// 화면 자체는 브라우저 부품(page.tsx)이라 머리 정보를 여기 따로 둔다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '회원가입 — 얼마드나',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
