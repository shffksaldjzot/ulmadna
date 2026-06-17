"use client";
// 글 조회수(자동 +1) + 좋아요 버튼(로그인 없이, 브라우저당 1회)
import { useEffect, useState } from "react";

export function PostEngagement({ slug }: { slug: string }) {
  const [views, setViews] = useState<number | null>(null);
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setLiked(localStorage.getItem(`liked_${slug}`) === "1");
    // 조회수 +1 (글 볼 때 1회)
    fetch(`/api/engagement?slug=${slug}&hit=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setViews(typeof d.views === "number" ? d.views : null);
        setLikes(typeof d.likes === "number" ? d.likes : null);
      })
      .catch(() => {});
  }, [slug]);

  const onLike = async () => {
    if (liked) return; // 이미 누름
    setLiked(true);
    localStorage.setItem(`liked_${slug}`, "1");
    setLikes((n) => (n ?? 0) + 1); // 낙관적 갱신
    try {
      const r = await fetch(`/api/engagement?slug=${slug}`, { method: "POST" });
      const d = await r.json();
      if (typeof d.likes === "number") setLikes(d.likes);
    } catch {
      /* 무시 */
    }
  };

  // Upstash 미설정(둘 다 null)이면 숨김
  if (views == null && likes == null) return null;

  return (
    <div className="post-engage">
      {views != null && <span className="pe-views">조회 {views.toLocaleString()}</span>}
      <button
        className={"pe-like" + (liked ? " on" : "")}
        onClick={onLike}
        aria-pressed={liked}
        title="로그인 없이 좋아요"
      >
        <span className="pe-heart">{liked ? "❤️" : "🤍"}</span>
        도움됐어요 {likes != null ? likes.toLocaleString() : ""}
      </button>
    </div>
  );
}
