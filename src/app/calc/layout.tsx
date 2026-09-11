// ──────────────────────────────────────────────
// v1 허브 — 전용 레이아웃
//
// 하는 일:
//   - Pretendard 폰트를 CDN link로 불러온다(목업과 동일 소스).
//     루트 layout.tsx는 블로그·라이브 계산기에 영향이 가므로 건드리지 않고,
//     이 파일에서 <link> 태그를 렌더링하면 Next.js가 자동으로 <head>에 올려 준다.
//   - v1 화면 전체에 크림 배경 + 기본 텍스트 색을 깐다.
//   - 상단 내비(TopNav)·하단 탭(BottomTab)은 화면마다 필요 여부·문구가 달라서
//     (홈만 하단 탭이 있고, 계산기 입력·결과·로그인 화면은 자체 하단 고정 버튼을 쓴다)
//     레이아웃에 고정으로 넣지 않고 각 페이지에서 직접 배치한다.
//
// 작성일: 2026년 08월 28일
// ──────────────────────────────────────────────

export default function V1Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 목업(v4)과 동일한 Pretendard 웹폰트. 루트 layout과 별개로 v1 트리에만 적용 */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
      />
      <div
        className="min-h-screen bg-cream text-foreground"
        style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
      >
        {children}
      </div>
    </>
  );
}
