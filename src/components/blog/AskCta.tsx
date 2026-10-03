// ──────────────────────────────────────────────
// 블로그 글 끝 "이 글 보고 궁금한 게 있나요?" 카드 + 떠 있는 작은 단추 (시안 blog-cta.html)
//
// - 카드: 아바타 · 한 줄 · 빅데이터 숫자(있을 때만) · [이 글의 조건으로 질문하기] ·
//         이 글에서 나온 질문 2개(있을 때만)
// - 작은 단추: 글을 60% 넘게 내려 읽으면 모바일 화면 아래쪽에 "이 글로 질문하기"가 뜬다.
//   카드가 화면에 보이는 동안은 겹치지 않게 숨긴다. PC에서는 안 보인다(시안과 같음).
//
// 블로그 글 화면은 빌드 때 미리 만드는 정적 화면이라, 숫자·질문은 화면에서
// /api/ask/cta 를 불러 채운다(못 불러오면 숫자·질문 줄만 빠지고 카드는 그대로).
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { askHref } from '@/lib/ask/format';
import '@/components/ask/ask.css';

interface CtaData {
  stats: { display: number; delta: number | null } | null;
  posts: { slug: string; title: string }[];
}

export default function AskCta({ slug }: { slug: string }) {
  const [data, setData] = useState<CtaData | null>(null);
  const [showMini, setShowMini] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const cardVisible = useRef(false);
  const href = `/ask/new?from=${encodeURIComponent(slug)}`;

  // 숫자·질문 불러오기
  useEffect(() => {
    let alive = true;
    fetch(`/api/ask/cta?from=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CtaData | null) => alive && d && setData(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  // 스크롤 60% 넘으면 작은 단추 보이기(카드가 보이는 동안은 숨김)
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      setShowMini(ratio >= 0.6 && !cardVisible.current);
    };
    const io = new IntersectionObserver(([e]) => {
      cardVisible.current = e.isIntersecting;
      onScroll();
    });
    if (cardRef.current) io.observe(cardRef.current);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
    };
  }, []);

  const stats = data?.stats;
  const posts = data?.posts ?? [];

  return (
    <div className="ask-scope ask-embed">
      <section className="ask" aria-label="질문하기" ref={cardRef}>
        <div className="av-ai" aria-hidden="true">
          얼마
          <br />
          드나
        </div>
        <b>이 글 보고 궁금한 게 있나요?</b>
        <small>
          {stats ? (
            <>
              빅데이터 견적서 <b>{stats.display.toLocaleString()}</b>건
              {stats.delta != null && stats.delta > 0 && <span className="up"> ▲ +{stats.delta.toLocaleString()}</span>} · 5~10분 걸려요
            </>
          ) : (
            '실제 견적서 자료로 AI가 답해요 · 5~10분 걸려요'
          )}
        </small>
        <Link className="btn p" href={href}>
          이 글의 조건으로 질문하기
        </Link>
        {posts.length > 0 && (
          <div className="recent">
            {posts.map((p) => (
              <Link key={p.slug} href={askHref(p.slug)}>
                <span>AI 답변</span>
                {p.title}
              </Link>
            ))}
          </div>
        )}
      </section>

      {showMini && (
        <Link className="mini-ask" href={href}>
          <svg className="i" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" />
          </svg>
          이 글로 질문하기
        </Link>
      )}
    </div>
  );
}
