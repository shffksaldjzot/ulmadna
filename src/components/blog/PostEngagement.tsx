"use client";
// 글 조회수 표시(자동 +1)
// 2026-09-15: 좋아요 버튼은 PostActions(저장 아이콘과 함께 글 위·끝에 반복 배치)로 옮겼다.
// 여기서 조회수 API(/api/engagement)는 그대로 재사용한다 — 좋아요와 조회수가 같은 파이프라인에
// 얹혀 있던 것뿐이라 조회수 쪽만 남겨도 문제없다.
import { useEffect, useState } from "react";

export function PostEngagement({ slug }: { slug: string }) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    // 조회수 +1 (글 볼 때 1회)
    fetch(`/api/engagement?slug=${slug}&hit=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setViews(typeof d.views === "number" ? d.views : null))
      .catch(() => {});
  }, [slug]);

  if (views == null) return null; // Upstash 미설정 등이면 조용히 숨김

  return (
    <div className="post-engage">
      <span className="pe-views">조회 {views.toLocaleString()}</span>
    </div>
  );
}
