// ──────────────────────────────────────────────
// 공용 컨테이너 — 상단바·본문·푸터·하단 탭이 전부 이 폭 규칙 하나만 쓴다.
// 최대 너비 1120px, 좌우 여백은 모바일 20px(px-5) / 데스크톱 32px(lg:px-8).
// 이걸로 감싸면 어느 화면이든 왼쪽 시작선이 항상 같은 자리에 맞는다.
//
// 작성일: 2026년 09월 15일 (디자인 통일 작업 A)
// ──────────────────────────────────────────────

import type { ElementType, ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  /** 감쌀 태그 — 기본은 div, 헤더/푸터/네비 안에서 쓸 때는 맞는 태그로 지정 */
  as?: ElementType;
}

export default function Container({ children, className = '', as }: ContainerProps) {
  const Tag: ElementType = as ?? 'div';
  return <Tag className={`mx-auto w-full max-w-[1120px] px-5 lg:px-8 ${className}`}>{children}</Tag>;
}
