"use client";
// ──────────────────────────────────────────────
// 내 글 — 로그인 없이 이 브라우저(localStorage)에 남은 "본 글 / 저장 / 좋아요" 목록
//
// 목록에는 slug만 들어 있어서, 제목·카테고리·날짜·썸네일을 보여주려면 전체 글 메타(posts)에서
// 찾아 붙여야 한다. posts는 서버(page.tsx)가 168편 전체를 가벼운 필드만 추려 내려준다.
//
// "링크로 저장" — 저장·좋아요 목록을 짧은 링크로 만들어 클립보드에 복사한다(+가능하면 공유창도).
// 그 링크를 다른 기기에서 열면(?d=...) 그 기기의 기존 기록에 합쳐진다.
//
// 작성일: 2026년 09월 15일
// ──────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  exportToLink,
  getLiked,
  getSaved,
  getViewed,
  importFromLink,
  removeLiked,
  removeSaved,
  removeViewed,
  subscribeMyChange,
  type MyItem,
} from "@/lib/blog-my";

type Tab = "viewed" | "saved" | "liked";

export interface MyPostMeta {
  slug: string;
  title: string;
  date: string;
  thumbnail: string | null;
  category: string;
}

const TAB_LABEL: Record<Tab, string> = { viewed: "본 글", saved: "저장", liked: "좋아요" };
const TAB_EMPTY: Record<Tab, string> = {
  viewed: "아직 본 글이 없어요",
  saved: "아직 저장한 글이 없어요",
  liked: "아직 좋아요한 글이 없어요",
};

export function MyPosts({ posts }: { posts: MyPostMeta[] }) {
  const [tab, setTab] = useState<Tab>("viewed");
  const [viewed, setViewed] = useState<MyItem[]>([]);
  const [saved, setSaved] = useState<MyItem[]>([]);
  const [liked, setLiked] = useState<MyItem[]>([]);
  const [importedNote, setImportedNote] = useState("");
  const [copied, setCopied] = useState(false);

  // slug → 메타 조회용 맵 (posts가 안 바뀌는 한 다시 만들 필요 없음)
  const bySlug = useMemo(() => {
    const m = new Map<string, MyPostMeta>();
    posts.forEach((p) => m.set(p.slug, p));
    return m;
  }, [posts]);

  const reload = () => {
    setViewed(getViewed());
    setSaved(getSaved());
    setLiked(getLiked());
  };

  // 처음 마운트 시 한 번 읽고, 이후 다른 곳(글 페이지 등)에서 목록이 바뀔 때마다 다시 읽는다
  useEffect(() => {
    reload();
    return subscribeMyChange(reload);
  }, []);

  // 주소에 ?d=... 로 들어오면(다른 기기에서 만든 "링크로 저장" 링크) 이 브라우저 기록에 합친다
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const d = sp.get("d");
    if (!d) return;
    const result = importFromLink(d);
    if (result && (result.savedAdded > 0 || result.likedAdded > 0)) {
      setImportedNote(`${result.savedAdded + result.likedAdded}개 가져왔어요`);
      setTab("saved");
      reload();
    }
    // 새로고침해도 다시 가져오기가 반복되지 않도록 주소에서 ?d= 를 지운다
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = tab === "viewed" ? viewed : tab === "saved" ? saved : liked;
  const removeFn = tab === "viewed" ? removeViewed : tab === "saved" ? removeSaved : removeLiked;

  const onExport = async () => {
    const link = exportToLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* 클립보드 차단 환경이면 복사만 건너뜀 */
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "얼마드나 — 내 글", url: link });
      } catch {
        /* 사용자가 공유를 취소하면 무시 */
      }
    }
  };

  const hasExportable = saved.length > 0 || liked.length > 0;

  return (
    <div className="mypost-wrap">
      <div className="mypost-tabs">
        {(["viewed", "saved", "liked"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={"mypost-tab" + (tab === t ? " on" : "")}
            onClick={() => setTab(t)}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
        <button
          type="button"
          className="mypost-export"
          onClick={onExport}
          disabled={!hasExportable}
        >
          {copied ? "복사됨!" : "링크로 저장"}
        </button>
      </div>

      {importedNote && <p className="mypost-note">{importedNote}</p>}

      {list.length === 0 ? (
        <p className="mypost-empty">{TAB_EMPTY[tab]}</p>
      ) : (
        <ul className="mypost-list">
          {list.map((item) => {
            const meta = bySlug.get(item.slug);
            return (
              <li key={item.slug} className="mypost-item">
                <Link href={`/blog/${item.slug}`} className="mypost-item-link">
                  {meta?.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={meta.thumbnail} alt={meta.title} />
                  ) : (
                    <span className="mypost-item-noimg" aria-hidden="true">얼마드나</span>
                  )}
                  <span className="mypost-item-body">
                    <span className="mypost-item-title">{meta?.title ?? item.slug}</span>
                    {meta && (
                      <span className="mypost-item-sub">
                        {meta.category && <>{meta.category} · </>}
                        {meta.date.replaceAll("-", ".")}
                      </span>
                    )}
                  </span>
                </Link>
                <button
                  type="button"
                  className="mypost-item-del"
                  onClick={() => {
                    removeFn(item.slug);
                    reload();
                  }}
                  aria-label="목록에서 지우기"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
