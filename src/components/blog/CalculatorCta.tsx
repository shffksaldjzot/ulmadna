// ──────────────────────────────────────────────
// 블로그 글 안의 "공정 물량 계산기" 안내
//
// 두 가지 모양을 그린다.
//   variant="mini" — 목차 바로 아래 한 줄짜리 배너 (글 읽기 전에 계산기부터 열어 볼 사람용)
//   variant="card" — 본문이 끝난 자리의 큰 카드 (다 읽고 "그래서 우리 집은?" 할 때)
// 어느 계산기를 그릴지는 lib/blog-calculators.ts 의 판정 결과(post.calculator)를 받는다.
//
// 서버 컴포넌트다(상태 없음). 스타일은 blog.css 의 .blog-calc-* 를 쓴다.
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import Link from "next/link";
import { CALCULATORS, type CalculatorKey } from "@/lib/blog-calculators";

export default function CalculatorCta({
  calculator,
  variant,
}: {
  calculator: CalculatorKey;
  variant: "mini" | "card";
}) {
  const info = CALCULATORS[calculator];

  if (variant === "mini") {
    return (
      <Link href={info.href} className="blog-calc-mini" aria-label={`${info.label} 열기`}>
        <span className="blog-calc-mini-icon" aria-hidden="true">📐</span>
        <span className="blog-calc-mini-txt">
          <strong>{info.label}</strong>
          <span>{info.mini}</span>
        </span>
        <span className="blog-calc-mini-arrow" aria-hidden="true">→</span>
      </Link>
    );
  }

  return (
    <aside className="blog-calc-card">
      <div className="blog-calc-card-txt">
        <span className="blog-calc-card-badge">무료 · 로그인 없음</span>
        <strong>{info.headline}</strong>
        <span>{info.sub}</span>
      </div>
      <Link href={info.href} className="blog-calc-card-btn">
        {info.label} 열기 →
      </Link>
    </aside>
  );
}
