// ─────────────────────────────────────────────────────────────
// /partner 광고주 화면 머리 정보 — 검색에 넣지 않음 (2026년 10월 31일)
// ─────────────────────────────────────────────────────────────
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '광고주 — 얼마드나',
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return children;
}
