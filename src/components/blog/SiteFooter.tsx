// 블로그 푸터 — 이제는 공용 푸터(SiteFooter, 하단 탭 포함)를 그대로 감싸기만 하는 얇은 래퍼.
//
// 2026-09-15 디자인 통일 작업 A: 블로그만 따로 갖고 있던 푸터(동시 접속자·링크·면책)를
// 없애고 홈·계산기와 똑같은 공용 푸터를 쓴다. 이 컴포넌트가 하단 탭(BottomTabs)도 같이
// 렌더하므로, 블로그 목록·글·본 글·카테고리 페이지는 파일을 안 고쳐도 하단 탭이 새로 생긴다.
import SharedSiteFooter from "@/components/layout/SiteFooter";

export function SiteFooter() {
  return <SharedSiteFooter />;
}
