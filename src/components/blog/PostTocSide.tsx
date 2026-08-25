"use client";

// ──────────────────────────────────────────────
// 목차 — 큰 화면(1100px 이상)에서 본문 오른쪽에 붙어 따라다니는 판
//
// [하는 일]
// 스크롤을 내리면 지금 읽고 있는 소제목(H2)에 색이 들어옵니다.
// 화면 폭이 좁으면 CSS가 이 판을 통째로 감춥니다(모바일은 본문 위 접이식 목차를 씀).
//
// [어떻게 알아내나]
// IntersectionObserver로 "소제목이 화면에 걸쳤다"는 신호가 올 때마다
// 소제목들의 실제 위치를 다시 재서, 화면 위쪽 기준선(100px)을 이미 지난 것 중
// 가장 마지막 것을 "지금 읽는 곳"으로 봅니다.
// (스크롤 이벤트를 매번 받는 방식보다 훨씬 덜 돕니다)
// ──────────────────────────────────────────────

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/blog";

/** 화면 위쪽에서 이 높이(px)를 지난 소제목을 "읽는 중"으로 봄 — 상단 고정 헤더(66px) 감안 */
const TOP_LINE = 100;

export function PostTocSide({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");

  useEffect(() => {
    // 본문에 실제로 박혀 있는 소제목 요소들을 모음
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    // 지금 읽는 소제목 다시 계산
    const recalc = () => {
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= TOP_LINE) current = el.id;
        else break; // 소제목은 문서 순서대로라 하나 넘어가면 뒤는 볼 필요 없음
      }
      setActiveId(current);
    };

    const io = new IntersectionObserver(recalc, {
      // 위 100px / 아래 60%를 잘라낸 띠 안에서만 신호를 받음
      rootMargin: `-${TOP_LINE}px 0px -60% 0px`,
      threshold: 0,
    });
    els.forEach((el) => io.observe(el));
    recalc(); // 처음 들어왔을 때(중간 앵커로 진입한 경우 포함) 한 번

    return () => io.disconnect();
  }, [headings]);

  return (
    <aside className="blog-toc-side" aria-label="목차">
      <div className="blog-toc-side-in">
        <p className="blog-toc-title">이 글의 목차</p>
        <ol>
          {headings.map((h) => (
            <li key={h.id} className={activeId === h.id ? "on" : undefined}>
              <a href={`#${h.id}`}>{h.text}</a>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
