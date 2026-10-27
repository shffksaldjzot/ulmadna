"use client";
// 글 조회수 표시 + 조회수 +1 신호
// 2026-09-15: 좋아요 버튼은 PostActions(저장 아이콘과 함께 글 위·끝에 반복 배치)로 옮겼다.
// 2026-10-27: Upstash → Supabase 이전. 숫자는 글 화면이 서버에서 미리 넣어 준 값(initialViews,
//   60초 캐시)을 쓰고, 여기서는 "봤다"는 신호(POST /api/engagement)만 1번 보낸다.
//   응답을 기다리지 않으므로 화면이 느려지지 않는다. 내가 본 1회는 화면에서 바로 +1 해 보여준다.
import { useEffect } from "react";

export function PostEngagement({ slug, initialViews }: { slug: string; initialViews: number | null }) {
  // 서버 숫자를 못 읽었으면(null) 조회수 줄을 아예 숨긴다.
  // 방금 내가 본 1회를 화면 숫자에 더해 보여준다(서버 숫자는 60초 캐시라 아직 안 들어가 있음).
  const views = initialViews == null ? null : initialViews + 1;

  useEffect(() => {
    // 조회수 +1 신호 — keepalive 로 바로 다른 글로 넘어가도 요청이 살아남게
    fetch(`/api/engagement?slug=${encodeURIComponent(slug)}`, { method: "POST", keepalive: true }).catch(() => {});
  }, [slug]);

  if (views == null) return null;

  return (
    <div className="post-engage">
      <span className="pe-views">조회 {views.toLocaleString()}</span>
    </div>
  );
}
