// ──────────────────────────────────────────────
// v1 허브 — 전용 레이아웃
//
// 하는 일:
//   - Pretendard 폰트를 CDN link로 불러온다(목업과 동일 소스).
//     루트 layout.tsx는 블로그·라이브 계산기에 영향이 가므로 건드리지 않고,
//     이 파일에서 <link> 태그를 렌더링하면 Next.js가 자동으로 <head>에 올려 준다.
//   - v1 화면 전체에 크림 배경 + 기본 텍스트 색을 깐다.
//   - 공용 상단바(SiteHeader)를 여기서 한 번만 그린다 — /calc 밑 모든 화면
//     (허브·도배·미장·바닥재·결과)이 전부 이 레이아웃을 거치므로, 각 페이지가
//     따로 헤더를 그리던 예전 방식(TopNav가 헤더+제목줄을 둘 다 그림)을 없앴다.
//     하위 페이지의 "← 제목" 줄은 TopNav.tsx가 그대로 담당한다(이제는 그 줄만 그림).
//   - 하단 탭(BottomTabs)은 여기 넣지 않는다 — 계산기 입력·결과 화면은 자체 하단
//     고정 버튼(다음/공유)을 쓰기 때문에 겹친다. 허브(/calc)는 페이지 안에서
//     공용 푸터(SiteFooter, 하단 탭 포함)를 직접 붙인다.
//
// 작성일: 2026년 08월 28일
// 2026년 09월 15일: 공용 상단바를 레이아웃 레벨로 승격(디자인 통일 작업 A)
// ──────────────────────────────────────────────

import SiteHeader from '@/components/layout/SiteHeader';

export default function V1Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 목업(v4)과 동일한 Pretendard 웹폰트. 루트 layout과 별개로 v1 트리에만 적용 */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <div
        className="min-h-screen bg-bg text-foreground"
        style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        <SiteHeader />
        {children}
      </div>
    </>
  );
}
