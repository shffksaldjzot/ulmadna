"use client";
// 글 방문 기록 — 화면엔 아무것도 안 그리고, 마운트되는 순간 "최근 본 글"에 slug만 조용히 남긴다.
// 서버 렌더링(빌드 결과)에는 전혀 영향이 없다 — 브라우저에서만 동작.
import { useEffect } from "react";
import { addViewed } from "@/lib/blog-my";

export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    addViewed(slug);
  }, [slug]);
  return null;
}
