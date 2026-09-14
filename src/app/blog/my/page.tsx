import type { Metadata } from "next";
import { getAllPostIndex } from "@/lib/blog";
import { getCategory } from "@/lib/blog-categories";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import { MyPosts } from "@/components/blog/MyPosts";
import "../blog.css";

// 사람마다 브라우저 기록이 다른 "내 것만 보이는" 페이지라서 검색엔진에는 노출하지 않는다
export const metadata: Metadata = {
  title: "내 글 — 얼마드나 블로그",
  robots: { index: false, follow: false },
};

// 서버 컴포넌트 — 전체 글(168편) 중 화면에 필요한 최소 필드만 추려서 클라이언트에 내려준다.
// 실제로 "어떤 글을 봤는지/저장했는지"는 브라우저(localStorage)만 알고 있어서
// 여기서는 "slug가 오면 제목·카테고리·날짜·썸네일을 찾아줄 사전"만 준비한다.
export default function MyBlogPage() {
  const posts = getAllPostIndex();
  const meta = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    thumbnail: p.thumbnail,
    category: p.cats.length > 0 ? getCategory(p.cats[0])?.label ?? "" : "",
  }));

  return (
    <div className="blog-scope">
      <BlogHeader />
      <div className="wrap">
        <div className="blog-hero blog-hero-my">
          <h1>내 글</h1>
        </div>
        <MyPosts posts={meta} />
      </div>
      <SiteFooter />
    </div>
  );
}
