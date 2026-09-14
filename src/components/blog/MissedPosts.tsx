// ──────────────────────────────────────────────
// "놓치기 쉬운 글" — 색인 우선 목록(구글에 덜 잡힌 글)을 홈/블로그 목록에서
// 작게 로테이션으로 보여주는 미니 섹션.
//
// [디자인 원칙] 설명글 금지 — 캡션 한 줄 + 링크 4개가 전부입니다.
// 이 섹션 자체가 "우리 사이트 안에서 그 글로 가는 링크"라서, 눈에 띄는 배너보다
// 목록 맨 아래에 조용히 있는 편이 검색엔진 입장에서도 자연스러운 내부 링크로 읽힙니다.
// ──────────────────────────────────────────────

import Link from "next/link";
import type { PostMeta } from "@/lib/blog";
import { pickIndexBoostRotation } from "@/lib/blog-index-boost";

export function MissedPosts({ posts }: { posts: PostMeta[] }) {
  const picks = pickIndexBoostRotation(posts, 4);
  if (picks.length === 0) return null; // 색인 우선 목록이 비었으면 아예 안 그림

  return (
    <section className="blog-missed">
      <p className="blog-missed-caption">놓치기 쉬운 글</p>
      <ul className="blog-missed-list">
        {picks.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`}>{p.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
