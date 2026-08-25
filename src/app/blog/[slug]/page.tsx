import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getAllSlugs, getAllPostMeta } from "@/lib/blog";
import { detectCategories, getCategory } from "@/lib/blog-categories";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { SiteFooter } from "@/components/blog/SiteFooter";
import { PostEngagement } from "@/components/blog/PostEngagement";
import { BlogSpoilerInk } from "@/components/blog/BlogSpoilerInk";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { PostTocSide } from "@/components/blog/PostTocSide";
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
    alternates: {
      canonical: `${SITE}/blog/${post.slug}`,
      // 글 페이지에서도 RSS 구독 주소를 알림 (layout.tsx 설정이 덮어써지므로 여기도 명시)
      types: {
        "application/rss+xml": [{ url: `${SITE}/feed.xml`, title: "얼마드나 블로그" }],
      },
    },
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

/** "2026-07-01" → 숫자(밀리초). 날짜가 비었거나 이상하면 0 */
function toMs(d: string) {
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
}

const DAY = 24 * 60 * 60 * 1000;

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const allPosts = getAllPostMeta();

  // 이 글이 속한 카테고리들 — 목록 페이지 칩과 똑같은 판정 함수를 다시 씁니다
  const myCats = detectCategories(post.title, post.tags);
  // 길잡이(브레드크럼)와 "주제 더 보기" 링크에 쓸 대표 카테고리 = 첫 번째로 걸린 것
  const primaryCat = myCats.length > 0 ? getCategory(myCats[0]) : undefined;

  // 이전 글 / 다음 글 — 목록은 최신(글 번호 큰 것)이 앞이라
  // 배열에서 뒤쪽(+1)이 더 예전 글 = "이전 글", 앞쪽(-1)이 더 최신 글 = "다음 글"
  const myIdx = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = myIdx >= 0 ? allPosts[myIdx + 1] ?? null : null; // 더 예전 글
  const nextPost = myIdx > 0 ? allPosts[myIdx - 1] ?? null : null; // 더 최신 글

  // ──────────────────────────────────────────────
  // 관련글 — 점수를 매겨 위에서 4편
  //
  // [점수 재료]
  //  1) 태그 겹침 × 3   — 가장 확실한 신호. 같은 태그가 붙었으면 거의 같은 주제입니다.
  //  2) 카테고리 겹침 × 2 — 태그가 하나도 안 겹쳐도 "욕실끼리"는 묶여야 하니까.
  //  3) 최신 보너스 최대 1.5 — 점수가 비슷하면 최근 글을 먼저 보여줍니다.
  //
  // [최신 보너스를 "오늘"이 아니라 "가장 최근 글"을 기준으로 재는 이유]
  // 오늘 날짜를 쓰면 글 내용이 하나도 안 바뀌어도 빌드할 때마다 관련글이 흔들립니다.
  // 가장 최근 글을 0일로 두면, 새 글이 올라오기 전까지는 결과가 그대로입니다.
  //
  // [조회수는 왜 안 넣었나]
  // 조회수는 Upstash(외부 저장소)에 있고 이 페이지는 빌드 때 미리 만들어지는 정적 페이지라,
  // 빌드 순간의 숫자가 그대로 굳어버립니다. 게다가 빌드 기계에 열쇠(환경변수)가 없거나
  // 저장소가 잠깐 죽으면 빌드 자체가 흔들립니다. 얻는 것보다 잃는 게 커서 뺐습니다.
  // ──────────────────────────────────────────────
  const newestMs = allPosts.reduce((mx, p) => Math.max(mx, toMs(p.date)), 0);
  const related = allPosts
    .filter((p) => p.slug !== post.slug)
    .map((p) => {
      const sharedTags = p.tags.filter((t) => post.tags.includes(t)).length;
      const pCats = detectCategories(p.title, p.tags);
      const sharedCats = pCats.filter((c) => myCats.includes(c)).length;
      // 가장 최근 글로부터 며칠 지났나 → 180일이 지나면 보너스 0
      const ageDays = newestMs > 0 ? (newestMs - toMs(p.date)) / DAY : 0;
      const fresh = Math.max(0, 1.5 - ageDays / 120);
      return { p, score: sharedTags * 3 + sharedCats * 2 + fresh };
    })
    .sort((a, b) => b.score - a.score || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, 4)
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
    // 어느 주제 묶음에 속한 글인지 (카테고리 허브와 짝을 맞춤)
    articleSection: primaryCat?.label,
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

  // 목차는 소제목이 3개 이상일 때만 (짧은 글은 오히려 지저분함)
  const showToc = post.headings.length >= 3;

  return (
    <div className="blog-scope">
      <BlogHeader />

      <div className="wrap blog-article">
        {/* 홈 > 블로그 > (카테고리) > 글 — 카테고리가 안 잡히면 그 칸은 건너뜀 */}
        <Breadcrumbs
          items={[
            { name: "얼마드나", href: "/" },
            { name: "블로그", href: "/blog" },
            ...(primaryCat
              ? [{ name: primaryCat.label, href: `/blog/category/${primaryCat.id}` }]
              : []),
            { name: post.title },
          ]}
        />

        {/* 큰 화면에서는 [본문 720px | 목차 236px] 두 칸, 좁은 화면에서는 그냥 세로 한 줄 */}
        <div className="blog-layout">
          <article className="blog-main">
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

            {/* 모바일 목차 — 본문 위, 기본은 접힘(자리를 안 잡아먹게) */}
            {showToc && (
              <details className="blog-toc blog-toc-mobile">
                <summary className="blog-toc-title">이 글의 목차</summary>
                <ol>
                  {post.headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`}>{h.text}</a>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            <div className="blog-body" dangerouslySetInnerHTML={{ __html: post.html }} />
            {/* 스포일러 캔버스 효과(점진적 향상) — .blog-spoiler 강화 */}
            <BlogSpoilerInk />

            {ADSENSE_SLOTS.blogInArticle && (
              <div className="blog-ad">
                <AdsenseUnit slot={ADSENSE_SLOTS.blogInArticle} format="fluid" layout="in-article" />
              </div>
            )}

            <PostEngagement slug={post.slug} />

            <ShareButtons
              url={`${SITE}/blog/${post.slug}`}
              title={post.title}
              description={post.description}
              image={post.thumbnail ? `${SITE}${post.thumbnail}` : undefined}
            />

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
                {/* 같은 주제 글 전체로 가는 문 */}
                {primaryCat && (
                  <Link href={`/blog/category/${primaryCat.id}`} className="blog-related-more">
                    {primaryCat.label} 글 전체 보기 →
                  </Link>
                )}
              </section>
            )}

            {/* 이전 글 / 다음 글 — 다 읽고 바로 옆 글로 넘어가게 */}
            {(prevPost || nextPost) && (
              <nav className="blog-prevnext" aria-label="이전 글 다음 글">
                {prevPost ? (
                  <Link href={`/blog/${prevPost.slug}`} className="blog-pn blog-pn-prev">
                    <span className="blog-pn-label">← 이전 글</span>
                    <span className="blog-pn-title">{prevPost.title}</span>
                  </Link>
                ) : (
                  <span className="blog-pn blog-pn-blank" aria-hidden="true" />
                )}
                {nextPost ? (
                  <Link href={`/blog/${nextPost.slug}`} className="blog-pn blog-pn-next">
                    <span className="blog-pn-label">다음 글 →</span>
                    <span className="blog-pn-title">{nextPost.title}</span>
                  </Link>
                ) : (
                  <span className="blog-pn blog-pn-blank" aria-hidden="true" />
                )}
              </nav>
            )}
          </article>

          {/* PC 전용 따라다니는 목차 (1100px 미만에서는 CSS가 감춤) */}
          {showToc && <PostTocSide headings={post.headings} />}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
