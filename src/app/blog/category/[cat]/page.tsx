// ──────────────────────────────────────────────
// 카테고리 허브 페이지 — /blog/category/bath 같은 주제별 모음 페이지
//
// [왜 만드나]
// 지금까지 카테고리는 목록 페이지에서 칩을 눌러 화면만 거르는 방식이라
// 주소가 바뀌어도 검색엔진 입장에서는 "블로그 목록 한 장"뿐이었습니다.
// 주제마다 진짜 주소를 가진 페이지를 만들면
// "욕실 리모델링 비용" 같은 검색에 걸릴 문이 8개로 늘어납니다.
//
// [SSG]
// generateStaticParams로 8장을 빌드 때 미리 다 만들어 둡니다(서버 계산 없음).
// dynamicParams=false → 없는 카테고리 주소는 바로 404.
// ──────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPostIndex } from "@/lib/blog";
import { BLOG_CATEGORIES, getCategory, getCategoryCopy } from "@/lib/blog-categories";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { CategoryChips } from "@/components/blog/CategoryChips";
import { PostCard } from "@/components/blog/PostCard";
import { AdsenseUnit } from "@/components/ads/AdsenseUnit";
import { ADSENSE_SLOTS } from "@/lib/ads/adsense";
import "../../blog.css";

const SITE = "https://ulmadna.com";

/** 목록에 없는 카테고리 주소로 들어오면 만들지 않고 404 */
export const dynamicParams = false;

/** 빌드 때 미리 만들 주소 8개 */
export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ cat: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  const category = getCategory(cat);
  if (!category) return { title: "카테고리를 찾을 수 없어요 — 얼마드나" };
  const copy = getCategoryCopy(cat);

  return {
    title: copy.seoTitle,
    description: copy.seoDesc,
    alternates: {
      canonical: `${SITE}/blog/category/${cat}`,
      // 페이지가 alternates를 직접 쓰면 layout.tsx의 RSS 알림이 덮어써져서 여기도 같이 적음
      types: {
        "application/rss+xml": [{ url: `${SITE}/feed.xml`, title: "얼마드나 블로그" }],
      },
    },
    openGraph: {
      title: copy.seoTitle,
      description: copy.seoDesc,
      url: `${SITE}/blog/category/${cat}`,
      type: "website",
    },
  };
}

export default async function BlogCategoryHub({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  const category = getCategory(cat);
  if (!category) notFound();
  const copy = getCategoryCopy(cat);

  // 이 카테고리에 걸린 글만 (getAllPostIndex가 이미 글마다 cats를 계산해 둠, 최신순 정렬됨)
  const posts = getAllPostIndex().filter((p) => p.cats.includes(cat));

  // 구조화데이터 — "이 페이지는 글 모음이고, 안에 이런 글들이 순서대로 있다"
  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.seoTitle,
    description: copy.seoDesc,
    url: `${SITE}/blog/category/${cat}`,
    isPartOf: { "@type": "Blog", name: "얼마드나 블로그", url: `${SITE}/blog` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE}/blog/${p.slug}`,
        name: p.title,
      })),
    },
  };

  return (
    <div className="blog-scope">
      <BlogHeader />

      <div className="wrap">
        <Breadcrumbs
          items={[
            { name: "얼마드나", href: "/" },
            { name: "블로그", href: "/blog" },
            { name: category.label },
          ]}
        />

        <div className="blog-hero blog-hero-hub">
          <h1>{category.label}</h1>
          {/* SEO용 소개 문단 — 검색어를 자연스럽게 담은 카테고리별 고유 문안 */}
          <p className="blog-hub-intro">{copy.intro}</p>
        </div>

        {/* 다른 주제로 바로 건너가기 (허브끼리 연결 = 검색엔진이 8장을 다 훑음) */}
        <CategoryChips activeId={cat} />

        <p className="blog-filter-count">{posts.length}편</p>

        {posts.length === 0 ? (
          <p className="blog-search-empty">
            아직 이 주제의 글이 없어요.{" "}
            <Link href="/">견적 계산기에서 바로 계산해보세요 →</Link>
          </p>
        ) : (
          <div className="blog-grid">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        )}

        {/* 견적 계산기로 보내는 문 하나 */}
        <aside className="blog-cta blog-cta-hub">
          <div className="blog-cta-txt">
            <strong>{category.label}, 우리집은 얼마 들까?</strong>
            <span>로그인·개인정보 없이 1분 만에 공정별 예상 견적을 확인하세요.</span>
          </div>
          <Link href="/" className="blog-cta-btn">무료 견적 내보기 →</Link>
        </aside>

        {ADSENSE_SLOTS.blogList && (
          <div className="blog-ad">
            <AdsenseUnit slot={ADSENSE_SLOTS.blogList} format="autorelaxed" />
          </div>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
        />
      </div>

      <SiteFooter />
    </div>
  );
}
