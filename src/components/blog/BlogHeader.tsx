// 블로그 헤더 — 이제는 공용 상단바(SiteHeader)를 그대로 감싸기만 하는 얇은 래퍼.
//
// 2026-09-15 디자인 통일 작업 A: 블로그만 따로 갖고 있던 헤더(로고+견적계산기/블로그/🔖)를
// 없애고 홈·계산기와 똑같은 SiteHeader를 쓴다. 블로그 목록·글·카테고리·본 글 페이지가 전부
// 이 컴포넌트를 그대로 불러 쓰고 있어서, 이 파일만 바꾸면 그 화면들도 자동으로 통일된다
// (그 페이지 파일들은 건드리지 않음 — import 이름(BlogHeader)이 그대로라 코드 변경 불필요).
import SiteHeader from "@/components/layout/SiteHeader";

export function BlogHeader() {
  return <SiteHeader />;
}
