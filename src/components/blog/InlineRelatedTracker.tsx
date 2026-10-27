"use client";
// ──────────────────────────────────────────────
// 본문 중간 관련 글 링크 클릭 추적 (화면엔 아무것도 안 그림)
//
// 본문 중간 링크는 글 html 안에 문자열로 끼워 넣어져서(lib/blog-recommend.ts insertInlineRelated)
// 리액트 onClick 을 직접 달 수 없다. 그래서 문서 전체에 클릭 감시를 하나만 걸고,
// 눌린 곳이 data-inline-related 표시가 붙은 링크면 GA 이벤트를 보낸다.
// 이벤트 이름은 글 끝 추천과 같은 blog_readmore_click 을 그대로 쓰고, position 으로 구분한다.
// 작성일: 2026년 10월 27일 (조회수 확대 전략 E)
// ──────────────────────────────────────────────

import { useEffect } from "react";
import { track } from "@/lib/analytics";

export function InlineRelatedTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // 눌린 곳에서 가장 가까운 "본문 중간 관련 글" 링크를 찾는다(없으면 무시)
      const a = (e.target as HTMLElement | null)?.closest?.("a[data-inline-related]");
      if (!a) return;
      track("blog_readmore_click", { category: a.getAttribute("data-inline-related") || "none", position: "inline" });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
