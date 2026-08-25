// ──────────────────────────────────────────────
// 카테고리 칩 줄 — "진짜 링크" 판
//
// 목록 페이지 안쪽(BlogListClient)의 칩은 버튼으로 화면만 거르지만,
// 여기 칩은 <a> 링크라서 검색엔진이 따라 들어가 허브 8장을 전부 찾아냅니다.
// 허브 페이지끼리 서로 오갈 때도 이 줄을 씁니다.
// ──────────────────────────────────────────────

import Link from "next/link";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";

export function CategoryChips({ activeId }: { activeId?: string }) {
  return (
    <div className="blog-chips" role="group" aria-label="카테고리">
      {/* 전체 = 블로그 목록으로 돌아가기 */}
      <Link href="/blog" className={`blog-chip${activeId ? "" : " on"}`}>
        전체
      </Link>
      {BLOG_CATEGORIES.map((c) => (
        <Link
          key={c.id}
          href={`/blog/category/${c.id}`}
          className={`blog-chip${activeId === c.id ? " on" : ""}`}
          aria-current={activeId === c.id ? "page" : undefined}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}
