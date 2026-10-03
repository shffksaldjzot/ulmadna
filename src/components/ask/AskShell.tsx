// ──────────────────────────────────────────────
// 물어보기 화면 공용 틀 — 라이브 상단 바 + 물어보기 본문 + 라이브 푸터(하단 탭 포함)
//
// 상단 바·하단 탭은 새로 만들지 않고 라이브 부품(SiteHeader, SiteFooter)을 그대로 쓴다.
// 본문은 .ask-scope 로 감싸서 물어보기 전용 꾸미기(ask.css)가 이 안에서만 먹게 한다.
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
import type { ReactNode } from 'react';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import AskToast from './AskToast';
import './ask.css';

export default function AskShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="ask-scope ask-page">{children}</div>
      <SiteFooter />
      {/* 짧은 알림(저장했어요 등) — 화면에 하나만 */}
      <AskToast />
    </>
  );
}
