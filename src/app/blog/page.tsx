import type { Metadata } from "next";
import { getAllPostIndex } from "@/lib/blog";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import { BlogListClient } from "@/components/blog/BlogListClient";
import { AdsenseUnit } from "@/components/ads/AdsenseUnit";
import { ADSENSE_SLOTS } from "@/lib/ads/adsense";
import "./blog.css";

export const metadata: Metadata = {
  title: "인테리어 정보 블로그 — 얼마드나",
  description:
    "인테리어 비용·견적·자재·시공 꿀팁을 업체 말고 소비자 편에서 정리했어요. 우리집 인테리어, 똑똑하게 준비하세요.",
  alternates: {
    canonical: "https://ulmadna.com/blog",
    // 페이지가 alternates를 직접 쓰면 layout.tsx의 RSS 알림이 덮어써져서 여기도 같이 적음
    types: {
      "application/rss+xml": [{ url: "https://ulmadna.com/feed.xml", title: "얼마드나 블로그" }],
    },
  },
};

// 목록 페이지는 서버 컴포넌트 그대로(빌드 때 미리 만들어짐 = SSG).
// 글 목록을 읽어서 검색·필터·더보기를 맡은 클라이언트 컴포넌트에 넘겨줍니다.
export default function BlogIndex() {
  const posts = getAllPostIndex();

  return (
    <div className="blog-scope">
      <BlogHeader />

      <div className="wrap">
        <div className="blog-hero">
          <h1>인테리어 정보</h1>
          <p>업체 말고, 소비자 편에서 정리한 인테리어 비용·견적·자재 이야기</p>
        </div>

        {posts.length === 0 ? (
          <p className="blog-empty">첫 글을 준비하고 있어요. 곧 찾아올게요!</p>
        ) : (
          <>
            <BlogListClient posts={posts} />

            {ADSENSE_SLOTS.blogList && (
              <div className="blog-ad">
                <AdsenseUnit slot={ADSENSE_SLOTS.blogList} format="autorelaxed" />
              </div>
            )}
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
