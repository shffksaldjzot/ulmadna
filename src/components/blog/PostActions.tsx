"use client";
// ──────────────────────────────────────────────
// 글 액션 — 저장(북마크) / 좋아요 아이콘 두 개, 라벨 없이 아이콘+숫자만
//
// 같은 글 페이지 안에 이 컴포넌트가 두 번(글 위 · 글 끝) 그려지는데, 하나를 누르면
// 다른 하나도 즉시 바뀌어야 해서 blog-my.ts의 커스텀 이벤트를 구독해 상태를 맞춘다.
//
// 저장은 이 브라우저(localStorage)만 기억하면 되지만, 좋아요는 "전체 몇 명이 눌렀는지"도
// 보여줘야 해서 서버(Upstash) 숫자를 함께 쓴다. 화면은 먼저 낙관적으로 숫자를 바꾸고,
// 서버 응답이 오면 정확한 숫자로 다시 맞춘다(실패해도 낙관적 값이 남아 있어 자연스러움).
//
// [초기 좋아요 수는 왜 props가 아니라 마운트 후 fetch인가]
// 글 페이지는 정적으로 미리 만들어지는(SSG) 페이지라서, 서버 컴포넌트가 Upstash를 직접
// 불러버리면 그 글 페이지 전체가 "정적 생성 불가"로 바뀌어버린다(168편이 전부 느려짐).
// 그래서 초기 숫자는 조회수(PostEngagement)와 같은 방식으로, 화면이 뜬 뒤 브라우저가
// GET /api/blog/like로 한 번 가져온다.
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

import { useEffect, useState } from "react";
import { isLiked, isSaved, subscribeMyChange, toggleLiked, toggleSaved } from "@/lib/blog-my";
import { track } from "@/lib/analytics";

// 좋아요 "숫자"는 서버(Upstash) 값이라 blog-my.ts(localStorage 목록) 이벤트로는 안 흘러온다.
// 글 위/끝 두 컴포넌트가 숫자까지 서로 맞추도록, 숫자가 바뀔 때만 쏘는 전용 이벤트를 하나 둔다.
const LIKE_COUNT_EVENT = "ulmadna:blog-like-count";
interface LikeCountDetail {
  slug: string;
  count: number;
}

export function PostActions({
  slug,
  category,
}: {
  slug: string;
  /** GA 이벤트에 실을 카테고리 — 개인정보 최소화를 위해 slug는 절대 안 보냄 */
  category?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // 마운트 시 + 다른 액션 버튼(글 끝 쪽 등)이 눌려서 바뀔 때마다 로컬 상태를 다시 읽어 동기화
  useEffect(() => {
    const sync = () => {
      setSaved(isSaved(slug));
      setLiked(isLiked(slug));
    };
    sync();
    return subscribeMyChange(sync);
  }, [slug]);

  // 좋아요 초기 숫자 — 화면에 뜬 뒤 한 번만 가져온다 (실패해도 0으로 조용히 유지)
  useEffect(() => {
    fetch(`/api/blog/like?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.count === "number") setLikeCount(d.count);
      })
      .catch(() => {});
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
