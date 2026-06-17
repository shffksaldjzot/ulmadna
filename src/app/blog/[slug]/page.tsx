import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getAllSlugs } from "@/lib/blog";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import { PostEngagement } from "@/components/blog/PostEngagement";
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
              {post.tags.map((t) => (
                <span key={t} className="blog-card-tag">{t}</span>
              ))}
            </div>
          )}
          <h1>{post.title}</h1>
          <p className="blog-post-meta">
            {post.postNo != null && <>No.{post.postNo} · </>}
            {fmtDate(post.date)}
          </p>
        </header>

        {post.thumbnail && (
          <div className="blog-post-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.thumbnail} alt={post.title} />
          </div>
        )}

        <div className="blog-body" dangerouslySetInnerHTML={{ __html: post.html }} />

        <PostEngagement slug={post.slug} />

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
      </article>

      <SiteFooter />
    </div>
  );
}
