"use client";
// ──────────────────────────────────────────────
// "이어서 볼 만한 글" — 본문을 다 읽고 스크롤이 이 지점(뷰포트)에 들어오면 한 번만 나타남
//
// 후보 6~8편은 서버(글 페이지, [slug]/page.tsx)가 미리 "같은 카테고리·태그 우선"으로
// 골라서 내려준다. 여기서 하는 일은 딱 하나 — 그중에서 "이미 본 글(viewed)"을 빼고
// 앞에서 3편만 잘라 보여주는 것. viewed 목록은 브라우저(localStorage)에만 있어서
// 서버는 알 수가 없기 때문에 이 판단은 클라이언트에서 해야 한다.
//
// IntersectionObserver로 "화면에 들어왔는지"만 감지하고, 한 번 나타나면 다시 숨기지 않는다.
//
// [검사관 지적 반영 — 2026-09-15]
// 1) 조기 노출 버그: 예전엔 "picks가 비었고 calculatorCard도 없을 때만" 빈 자리를 그렸는데,
//    calculatorCard가 있으면 스크롤 전(visible=false)에도 섹션이 그대로 그려져 버렸다(정적
//    HTML에도 "이어서 볼 만한 글" 글자가 미리 박혀버림). 이제는 visible을 직접 조건에 넣어서,
//    "화면에 실제로 들어왔을 때"만 그린다 — 서버가 만드는 정적 HTML에는 아예 안 나온다.
// 2) 계산기 카드 제거: 이 섹션 바로 아래(계산기가 매치된 글이면)에 이미 CalculatorCta가
//    같은 계산기 카드를 보여주고 있어서, 여기서도 또 넣으면 같은 계산기 CTA가 두 번
//    연속으로 나오는 꼴이었다. 그래서 계산기 카드는 완전히 뺐다 — 이제 후보 글만 보여준다.
// ──────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getViewed } from "@/lib/blog-my";
import { track } from "@/lib/analytics";

export interface ReadMoreCandidate {
  slug: string;
  title: string;
  thumbnail: string | null;
  category: string; // GA 이벤트용(카테고리 이름만, slug는 안 보냄)
}

export function ReadMoreAtEnd({ candidates }: { candidates: ReadMoreCandidate[] }) {
  // 관찰 대상 엘리먼트에 붙이는 ref. "안 보이는 동안"과 "보인 뒤"가 같은 위치를 가리켜야
  // 스크롤 위치가 안 튀므로, 바깥 컨테이너 자체에 항상 이 ref를 붙인다.
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [picks, setPicks] = useState<ReadMoreCandidate[]>([]);

  // 스크롤이 이 위치에 닿는지 감시 — 한 번 닿으면 감시를 끈다(계속 감시할 필요 없음)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 화면에 들어온 순간에만 "이미 본 글"을 걸러낸다(그 전엔 계산할 필요가 없음)
  useEffect(() => {
    if (!visible) return;
    const viewedSlugs = new Set(getViewed().map((v) => v.slug));
    setPicks(candidates.filter((c) => !viewedSlugs.has(c.slug)).slice(0, 3));
  }, [visible, candidates]);

  const onClickCard = (category: string) => {
    track("blog_readmore_click", { category: category || "none" });
  };

  // 아직 스크롤이 안 닿았거나(visible=false), 닿았는데 보여줄 후보가 하나도 없으면
  // 관찰용 빈 자리만 남긴다(레이아웃엔 영향 없음, 서버가 만드는 정적 HTML엔 이 자리만 있음)
  if (!visible || picks.length === 0) {
    return <div ref={ref} aria-hidden="true" />;
  }

  return (
    <section className="blog-readmore" ref={ref}>
      <h2>이어서 볼 만한 글</h2>
      <div className="blog-readmore-list">
        {picks.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="blog-readmore-card"
            onClick={() => onClickCard(p.category)}
          >
            {p.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumbnail} alt={p.title} />
            ) : (
              <span className="blog-readmore-noimg" aria-hidden="true">얼마드나</span>
            )}
            <span>{p.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
