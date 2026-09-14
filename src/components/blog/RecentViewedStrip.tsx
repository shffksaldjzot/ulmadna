"use client";
// ──────────────────────────────────────────────
// "내가 본 글" 가로 스크롤 줄 — 블로그 목록 맨 위, 최근 본 글이 있을 때만 나타난다.
// 서버가 만드는 정적 목록(SSG)에는 손대지 않고, 브라우저 localStorage만 보고 그린다.
// 본 글이 하나도 없으면 이 컴포넌트는 DOM에 아예 아무것도 안 남긴다(null 반환).
// ──────────────────────────────────────────────

import { useEffect, useState } from "react";
import Link from "next/link";
import { getViewed, subscribeMyChange } from "@/lib/blog-my";

interface SlimPost {
  slug: string;
  title: string;
  thumbnail: string | null;
}

export function RecentViewedStrip({ posts }: { posts: SlimPost[] }) {
  const [items, setItems] = useState<SlimPost[]>([]);

  useEffect(() => {
    const bySlug = new Map(posts.map((p) => [p.slug, p]));
    const sync = () => {
      const recent = getViewed()
        .slice(0, 5)
        .map((v) => bySlug.get(v.slug))
        .filter((p): p is SlimPost => !!p); // 목록에서 사라진 글(삭제 등)은 건너뜀
      setItems(recent);
    };
    sync();
    return subscribeMyChange(sync);
  }, [posts]);

  if (items.length === 0) return null; // 본 글이 없으면 아예 안 그림

  return (
    <div className="blog-recent">
      <p className="blog-recent-caption">내가 본 글</p>
      <div className="blog-recent-strip">
        {items.map((p) => (
          <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-recent-card">
            {p.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnail} alt={p.title} />
            ) : (
              <span className="blog-recent-noimg" aria-hidden="true">얼마드나</span>
            )}
            <span>{p.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
