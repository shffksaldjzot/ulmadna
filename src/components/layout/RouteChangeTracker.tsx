// ──────────────────────────────────────────────
// 라우트(페이지) 이동 추적기 — GA4 page_view 수동 전송
//
// 왜 필요한가:
//   layout.tsx의 gtag 스크립트는 맨 처음 페이지가 열릴 때 "config" 호출과 함께
//   자동으로 page_view 1번을 보내준다. 하지만 이 서비스는 App Router의
//   클라이언트 내비게이션(예: 계산기 화면 안에서 링크 클릭으로 이동)이라 페이지가
//   실제로는 새로고침 없이 바뀌는데, gtag는 그걸 모른다 — 그래서 두 번째 페이지
//   부터는 page_view가 안 잡힌다. 이 컴포넌트가 경로가 바뀔 때마다 수동으로
//   page_view 이벤트를 보내 이 구멍을 메운다.
//
//   최초 로드는 gtag 스크립트 자체가 이미 1번 세어주므로, 이 컴포넌트는 "그 다음
//   부터"의 이동만 센다(중복 방지 — 첫 렌더는 건너뛴다).
//
// layout.tsx(루트) 한 곳에만 마운트한다. 화면에는 아무것도 그리지 않는다.
//
// 작성일: 2026년 09월 14일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

export default function RouteChangeTracker() {
  const pathname = usePathname();
  // 최초 렌더인지 표시 — 최초 로드는 gtag 스크립트가 이미 1번 세어주므로 건너뛴다
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // 검사관 권고(2026-09-14): 쿼리스트링은 빼고 pathname만 보낸다. 결과 공유 링크의
    // ?d=... 값은 폼 상태(평형·치수 등)를 통째로 인코딩한 값이라, 공개된 URL이라도
    // GA4 리포트 화면에 원문처럼 계속 남는 건 불필요하게 노출 범위를 넓히는 일이다.
    track('page_view', { page_path: pathname });
  }, [pathname]);

  return null; // 화면에 아무것도 그리지 않는 추적 전용 컴포넌트
}
