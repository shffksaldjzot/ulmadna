"use client";
// ──────────────────────────────────────────────
// 글 액션 — 저장(북마크) / 좋아요 아이콘 두 개, 라벨 없이 아이콘+숫자만
//
// 같은 글 페이지 안에 이 컴포넌트가 두 번(글 위 · 글 끝) 그려지는데, 하나를 누르면
// 다른 하나도 즉시 바뀌어야 해서 blog-my.ts의 커스텀 이벤트를 구독해 상태를 맞춘다.
//
// 저장은 이 브라우저(localStorage)만 기억하면 되지만, 좋아요는 "전체 몇 명이 눌렀는지"도
// 보여줘야 해서 서버(Supabase) 숫자를 함께 쓴다. 화면은 먼저 낙관적으로 숫자를 바꾸고,
// 서버 응답이 오면 정확한 숫자로 다시 맞춘다(실패해도 낙관적 값이 남아 있어 자연스러움).
//
// [초기 좋아요 수 — 2026-10-27 바뀜]
// 예전엔 글 위·글 끝 두 컴포넌트가 각각 GET /api/blog/like 를 불러(글 1회 열람 = 2번) Upstash 를
// 읽었다. 이제 글 화면이 서버에서 Supabase 숫자를 60초 캐시로 한 번 읽어 initialLikes 로 넘겨주므로
// 여기서는 따로 묻지 않는다(호출 0번).
//
// 작성일: 2026년 09월 15일
// 2026년 10월 27일: 초기 숫자를 props(initialLikes)로 받음 — 마운트 때 GET 호출 제거
// ──────────────────────────────────────────────

import { useEffect, useState } from "react";
import { isLiked, isSaved, subscribeMyChange, toggleLiked, toggleSaved } from "@/lib/blog-my";
import { track } from "@/lib/analytics";

// 좋아요 "숫자"는 서버(Supabase) 값이라 blog-my.ts(localStorage 목록) 이벤트로는 안 흘러온다.
// 글 위/끝 두 컴포넌트가 숫자까지 서로 맞추도록, 숫자가 바뀔 때만 쏘는 전용 이벤트를 하나 둔다.
const LIKE_COUNT_EVENT = "ulmadna:blog-like-count";
interface LikeCountDetail {
  slug: string;
  count: number;
}

export function PostActions({
  slug,
  category,
  initialLikes = 0,
}: {
  slug: string;
  /** GA 이벤트에 실을 카테고리 — 개인정보 최소화를 위해 slug는 절대 안 보냄 */
  category?: string;
  /** 글 화면이 서버에서 읽어 넣어 준 좋아요 수(60초 캐시). 못 읽었으면 0 */
  initialLikes?: number;
}) {
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes);

  // 마운트 시 + 다른 액션 버튼(글 끝 쪽 등)이 눌려서 바뀔 때마다 로컬 상태를 다시 읽어 동기화
  useEffect(() => {
    const sync = () => {
      setSaved(isSaved(slug));
      setLiked(isLiked(slug));
    };
    sync();
    return subscribeMyChange(sync);
  }, [slug]);

  // 같은 페이지의 다른 액션 줄(글 위 ↔ 글 끝)이 좋아요 숫자를 바꾸면 이쪽도 즉시 따라간다
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<LikeCountDetail>).detail;
      if (detail?.slug === slug) setLikeCount(detail.count);
    };
    window.addEventListener(LIKE_COUNT_EVENT, handler);
    return () => window.removeEventListener(LIKE_COUNT_EVENT, handler);
  }, [slug]);

  const onSave = () => {
    const next = toggleSaved(slug);
    setSaved(next);
    track("blog_save", { category: category ?? "none", on: next });
  };

  const onLike = async () => {
    const next = toggleLiked(slug);
    setLiked(next);
    // 서버 응답 오기 전 낙관적 갱신 — 이 페이지의 다른 액션 줄에도 곧바로 알림
    const optimistic = Math.max(0, likeCount + (next ? 1 : -1));
    setLikeCount(optimistic);
    window.dispatchEvent(new CustomEvent(LIKE_COUNT_EVENT, { detail: { slug, count: optimistic } }));
    track("blog_like", { category: category ?? "none", on: next });
    try {
      const res = await fetch("/api/blog/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, on: next }),
      });
      const data = await res.json();
      if (typeof data?.count === "number") {
        setLikeCount(data.count); // 정확한 숫자로 보정
        window.dispatchEvent(new CustomEvent(LIKE_COUNT_EVENT, { detail: { slug, count: data.count } }));
      }
    } catch {
      /* 실패해도 낙관적으로 바꿔둔 숫자가 그대로 남아 화면은 자연스럽다 */
    }
  };

  return (
    <div className="blog-actions">
      <button
        type="button"
        className={"blog-action-btn" + (saved ? " on" : "")}
        onClick={onSave}
        aria-pressed={saved}
        aria-label={saved ? "저장 취소" : "글 저장"}
      >
        <span aria-hidden="true">🔖</span>
      </button>
      <button
        type="button"
        className={"blog-action-btn" + (liked ? " on" : "")}
        onClick={onLike}
        aria-pressed={liked}
        aria-label={liked ? "좋아요 취소" : "좋아요"}
      >
        <span aria-hidden="true">{liked ? "❤️" : "🤍"}</span>
        {likeCount > 0 && <span className="blog-action-count">{likeCount.toLocaleString()}</span>}
      </button>
    </div>
  );
}
