import type { Metadata } from "next";
import Link from "next/link";
import { getAllPostMeta } from "@/lib/blog";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import "./blog.css";

export const metadata: Metadata = {
  title: "인테리어 정보 블로그 — 얼마드나",
  description:
    "인테리어 비용·견적·자재·시공 꿀팁을 업체 말고 소비자 편에서 정리했어요. 우리집 인테리어, 똑똑하게 준비하세요.",
  alternates: { canonical: "https://ulmadna.com/blog" },
};

function fmtDate(d: string) {
  if (!d) return "";
  return d.replaceAll("-", ".");
}

export default function BlogIndex() {
  const posts = getAllPostMeta();

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
          <div className="blog-grid">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-card">
                <div className="blog-card-thumb">
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbnail} alt={p.title} />
                  ) : (
                    <span className="blog-card-noimg">얼마드나</span>
                  )}
                </div>
                <div className="blog-card-body">
                  {p.tags.length > 0 && <span className="blog-card-tag">{p.tags[0]}</span>}
                  <h2>{p.title}</h2>
                  <p className="blog-card-desc">{p.description}</p>
                  <span className="blog-card-date">{fmtDate(p.date)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
