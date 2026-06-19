import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getAllSlugs, getAllPostMeta } from "@/lib/blog";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import { PostEngagement } from "@/components/blog/PostEngagement";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { AdsenseUnit } from "@/components/ads/AdsenseUnit";
import { ADSENSE_SLOTS } from "@/lib/ads/adsense";
import "../blog.css";

const SITE = "https://ulmadna.com";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "글을 찾을 수 없어요 — 얼마드나" };

  return {
    title: `${post.title} — 얼마드나`,
    description: post.description,
    alternates: { canonical: `${SITE}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${SITE}/blog/${post.slug}`,
      type: "article",
      images: post.thumbnail ? [{ url: post.thumbnail }] : undefined,
    },
  };
}

function fmtDate(d: string) {
  if (!d) return "";
  return d.replaceAll("-", ".");
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // 관련글 — 공유 태그 많은 순, 없으면 최신, 최대 3
  const related = getAllPostMeta()
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, shared: p.tags.filter((t) => post.tags.includes(t)).length }))
    .sort((a, b) => b.shared - a.shared || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, 3)
    .map((x) => x.p);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    image: post.thumbnail ? `${SITE}${post.thumbnail}` : undefined,
    author: { "@type": "Organization", name: "얼마드나" },
    publisher: { "@type": "Organization", name: "얼마드나" },
    mainEntityOfPage: `${SITE}/blog/${post.slug}`,
  };

  const faqLd =
    post.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <div className="blog-scope">
      <BlogHeader />

      <article className="wrap blog-article">
        <Link href="/blog" className="blog-back">← 목록으로</Link>

        <header className="blog-post-head">
          {post.tags.length > 0 && (
            <div className="blog-post-tags">
              {post.tags.slice(0, 3).map((t) => (
                <span key={t} className="blog-post-tag">{t}</span>
              ))}
            </div>
          )}
          <h1>{post.title}</h1>
          <p className="blog-post-meta">
            {post.postNo != null && <>No.{post.postNo} · </>}
            {fmtDate(post.date)}
            <span className="blog-readtime-badge">⏱ 읽는 데 {post.readingTime}분</span>
          </p>
        </header>

        {post.thumbnail && (
          <div className="blog-post-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.thumbnail} alt={post.title} />
          </div>
        )}

        {post.headings.length >= 3 && (
          <nav className="blog-toc" aria-label="목차">
            <p className="blog-toc-title">이 글의 목차</p>
            <ol>
              {post.headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        <div className="blog-body" dangerouslySetInnerHTML={{ __html: post.html }} />

        {ADSENSE_SLOTS.blogInArticle && (
          <div className="blog-ad">
            <AdsenseUnit slot={ADSENSE_SLOTS.blogInArticle} />
          </div>
        )}

        <PostEngagement slug={post.slug} />

        <ShareButtons url={`${SITE}/blog/${post.slug}`} title={post.title} />

        {post.faq.length > 0 && (
          <section className="blog-faq">
            <h2>자주 묻는 질문</h2>
            {post.faq.map((f, i) => (
              <details key={i} className="blog-faq-item">
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>
        )}

        <aside className="blog-cta">
          <div className="blog-cta-txt">
            <strong>우리집은 얼마 들까?</strong>
            <span>로그인·개인정보 없이 1분 만에 공정별 예상 견적을 확인하세요.</span>
          </div>
          <Link href="/" className="blog-cta-btn">무료 견적 내보기 →</Link>
        </aside>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
        />
        {faqLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
          />
        )}

        {related.length > 0 && (
          <section className="blog-related">
            <h2>이런 글도 있어요</h2>
            <div className="blog-related-list">
              {related.map((r) => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="blog-related-card">
                  {r.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail} alt={r.title} />
                  )}
                  <span className="blog-related-title">{r.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <SiteFooter />
    </div>
  );
}
