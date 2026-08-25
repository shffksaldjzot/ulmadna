// ──────────────────────────────────────────────
// 글 카드 한 장 — 목록 페이지와 카테고리 허브 페이지가 같이 씁니다.
//
// "use client"를 일부러 안 붙였습니다.
//  - 허브 페이지(서버)에서 쓰면 서버에서 그대로 그려지고
//  - 목록(BlogListClient, 클라이언트)에서 쓰면 그쪽에 딸려 들어갑니다.
// 어차피 안에 상태나 이벤트가 없어서 양쪽 다 문제없이 돕니다.
// ──────────────────────────────────────────────

import Link from "next/link";
import type { PostMeta } from "@/lib/blog";

/** 2026-01-02 → 2026.01.02 (목록·허브가 같은 날짜 표기를 쓰게 한 곳에 모음) */
export function fmtDate(d: string) {
  if (!d) return "";
  return d.replaceAll("-", ".");
}

export function PostCard({ post }: { post: PostMeta }) {
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      <div className="blog-card-thumb">
        {post.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnail} alt={post.title} />
        ) : (
          <span className="blog-card-noimg">얼마드나</span>
        )}
        {post.postNo != null && <span className="blog-card-no">No.{post.postNo}</span>}
      </div>
      <div className="blog-card-body">
        {post.tags.length > 0 && <span className="blog-card-tag">{post.tags[0]}</span>}
        <h2>{post.title}</h2>
        <p className="blog-card-desc">{post.description}</p>
        <span className="blog-card-date">
          {fmtDate(post.date)} <span className="blog-readtime">· ⏱ {post.readingTime}분</span>
        </span>
      </div>
    </Link>
  );
}
