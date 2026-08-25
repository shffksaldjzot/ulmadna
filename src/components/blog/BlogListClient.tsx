"use client";

// ──────────────────────────────────────────────
// 블로그 목록 — 검색 + 카테고리 칩 + 더보기
//
// 서버(page.tsx)에서 글 목록을 통째로 받아옵니다(65편, 본문은 없음).
// 그래서 검색·필터는 서버를 다시 부르지 않고 브라우저 안에서 즉시 끝납니다.
//
// 화면 규칙
//  - 아무것도 안 걸렀을 때: 맨 위 큰 카드(최신글) + 그 아래 18편씩 "더보기"
//  - 검색/칩을 쓴 순간: 큰 카드 없이 걸린 글 전부 한 번에 표시(더보기 없음)
// ──────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PostIndexItem } from "@/lib/blog";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";
import { matchesQuery, normalizeKo } from "@/lib/blog-search";
import { PostCard, fmtDate } from "./PostCard";

/** "더보기" 한 번에 더 나오는 글 수 */
const PAGE_SIZE = 18;

export function BlogListClient({ posts }: { posts: PostIndexItem[] }) {
  const [q, setQ] = useState(""); // 검색창에 친 글자
  const [cat, setCat] = useState(""); // 고른 카테고리 id (빈 값 = 전체)
  const [visible, setVisible] = useState(PAGE_SIZE); // 지금까지 펼친 글 수
  const [ready, setReady] = useState(false); // 주소창(URL) 값을 다 읽었는지

  // 주소창의 ?cat= / ?q= 를 화면에 반영.
  // 첫 진입 때 한 번 읽고, 뒤로가기(popstate) 때마다 다시 읽습니다.
  const readUrl = useCallback(() => {
    const sp = new URLSearchParams(window.location.search);
    setCat(sp.get("cat") ?? "");
    setQ(sp.get("q") ?? "");
  }, []);

  useEffect(() => {
    readUrl();
    setReady(true);
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, [readUrl]);

  // 검색어가 바뀌면 주소창만 조용히 갱신(replaceState).
  // 글자 한 자마다 방문기록을 쌓으면 뒤로가기가 지옥이 되므로 pushState는 안 씁니다.
  useEffect(() => {
    if (!ready) return;
    const sp = new URLSearchParams(window.location.search);
    const trimmed = q.trim();
    if (trimmed) sp.set("q", trimmed);
    else sp.delete("q");
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, ready]);

  // 칩을 누르면 방문기록에 남김(pushState) → 뒤로가기로 이전 카테고리로 돌아감
  const pickCat = (id: string) => {
    const next = cat === id ? "" : id; // 같은 칩 다시 누르면 해제
    setCat(next);
    setVisible(PAGE_SIZE);
    const sp = new URLSearchParams(window.location.search);
    if (next) sp.set("cat", next);
    else sp.delete("cat");
    const qs = sp.toString();
    window.history.pushState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  // 검색어를 치고 있는 중인가 (칩을 링크로 낼지 버튼으로 낼지 가르는 기준)
  const searching = q.trim().length > 0;
  // 검색어나 칩 중 하나라도 쓰고 있으면 "거르는 중"
  const filtering = searching || cat.length > 0;

  // 실제로 화면에 보여줄 글 목록
  const filtered = useMemo(() => {
    if (!filtering) return posts;
    const query = q.trim();
    const hits = posts.filter(
      (p) => (!cat || p.cats.includes(cat)) && (!query || matchesQuery(query, p.hay))
    );
    if (!query) return hits; // 칩만 눌렀으면 최신순 그대로

    // 검색 결과 정렬 — 제목에 들어간 글이 먼저(더 정확한 답), 그다음 최신순.
    // (제목에 없고 태그·소제목에만 있는 글은 뒤로)
    return hits
      .map((p) => ({ p, inTitle: matchesQuery(query, normalizeKo(p.title)) ? 1 : 0 }))
      .sort((a, b) => b.inTitle - a.inTitle)
      .map((x) => x.p);
  }, [posts, q, cat, filtering]);

  // 거를 때는 전부 보여주고, 평소엔 맨 위 큰 카드 1편을 뺀 나머지를 잘라서 보여줌
  const gridPosts = filtering ? filtered : posts.slice(1, 1 + visible);
  const hasMore = !filtering && posts.length > 1 + visible;

  return (
    <>
      {/* 검색창 — 안내문 없이 placeholder 한 줄로 */}
      <div className="blog-search">
        <span className="blog-search-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          className="blog-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="어떤 공사가 궁금하세요? (예: 욕실 비용)"
          aria-label="블로그 글 검색"
        />
        {q && (
          <button type="button" className="blog-search-clear" onClick={() => setQ("")} aria-label="검색어 지우기">
            ×
          </button>
        )}
      </div>

      {/*
        카테고리 칩 — 상황에 따라 성격이 바뀝니다.

        (1) 검색어를 안 쳤을 때  → 진짜 링크(<a>)로 카테고리 허브 페이지로 이동
            이유: 버튼으로 화면만 거르면 검색엔진은 링크가 없으니 허브 8장을 못 찾습니다.
                  첫 화면(검색어 없음)에서 링크로 그려야 크롤러가 그대로 따라 들어갑니다.
        (2) 검색어를 치는 중일 때 → 예전처럼 버튼(화면 안에서 거르기)
            이유: 애써 친 검색어를 두고 다른 페이지로 튕겨 보내면 흐름이 끊깁니다.
                  "욕실 + 34평"처럼 검색어와 주제를 겹쳐 좁히는 것도 이쪽이 자연스럽습니다.
      */}
      {searching ? (
        <div className="blog-chips" role="group" aria-label="카테고리">
          <button
            type="button"
            className={`blog-chip${cat === "" ? " on" : ""}`}
            aria-pressed={cat === ""}
            onClick={() => pickCat("")}
          >
            전체
          </button>
          {BLOG_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`blog-chip${cat === c.id ? " on" : ""}`}
              aria-pressed={cat === c.id}
              onClick={() => pickCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="blog-chips" role="group" aria-label="카테고리">
          <Link href="/blog" className={`blog-chip${cat === "" ? " on" : ""}`}>
            전체
          </Link>
          {BLOG_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/blog/category/${c.id}`}
              className={`blog-chip${cat === c.id ? " on" : ""}`}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}

      {/* 거르는 중엔 결과 수만 짧게 */}
      {filtering && filtered.length > 0 && <p className="blog-filter-count">{filtered.length}편</p>}

      {/* 결과 0건 — 견적 계산기로 안내 */}
      {filtering && filtered.length === 0 && (
        <p className="blog-search-empty">
          찾는 글이 없어요.{" "}
          <Link href="/">견적 계산기에서 바로 계산해보세요 →</Link>
        </p>
      )}

      {/* 피처 카드 — 최신글 크게 (거르는 중엔 숨김) */}
      {!filtering && posts.length > 0 && (
        <Link href={`/blog/${posts[0].slug}`} className="blog-featured">
          <div className="blog-featured-thumb">
            {posts[0].thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posts[0].thumbnail} alt={posts[0].title} />
            ) : (
              <span className="blog-card-noimg">얼마드나</span>
            )}
            {posts[0].postNo != null && <span className="blog-card-no">No.{posts[0].postNo}</span>}
          </div>
          <div className="blog-featured-body">
            <span className="blog-featured-badge">최신 글</span>
            {posts[0].tags.length > 0 && <span className="blog-card-tag">{posts[0].tags[0]}</span>}
            <h2>{posts[0].title}</h2>
            <p className="blog-featured-desc">{posts[0].description}</p>
            <span className="blog-card-date">
              {fmtDate(posts[0].date)} <span className="blog-readtime">· ⏱ {posts[0].readingTime}분</span>
            </span>
          </div>
        </Link>
      )}

      {gridPosts.length > 0 && (
        <div className={`blog-grid${hasMore ? " has-more" : ""}`}>
          {gridPosts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}

      {/* 더보기 — 18편씩 추가 */}
      {hasMore && (
        <div className="blog-more">
          <button type="button" className="blog-more-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            더보기 <span className="blog-more-left">{posts.length - 1 - visible}편 남음</span>
          </button>
        </div>
      )}
    </>
  );
}
