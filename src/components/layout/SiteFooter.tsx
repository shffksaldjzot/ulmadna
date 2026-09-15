// ──────────────────────────────────────────────
// 공용 푸터 — 홈·계산기 허브·블로그(목록·글·본 글) 전부 이 하나만 쓴다.
//
// 2026-09-15 형아 지시(디자인 통일 작업 A): 블로그 SiteFooter(소개·문의·개인정보처리방침·
// RSS·실접속자·면책 1줄)를 정본으로 삼아 통일. 홈·계산기에 있던 긴 면책 문단은 여기
// 한 줄로 줄여 흡수했다(법적 핵심만: 참고용 예상 금액·당사자 아님·업체 등록 확인).
//
// 하단 탭(BottomTabs)도 이 컴포넌트가 같이 렌더한다 — 이 푸터를 쓰는 페이지는 자동으로
// 하단 탭도 따라온다(블로그 글/본 글 페이지는 이 파일을 고치지 않고도 탭이 생기는 이유).
// 계산기 입력·결과 화면(자체 하단 고정 버튼이 있음)은 이 푸터를 쓰지 않는다.
// ──────────────────────────────────────────────

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Container from './Container';
import BottomTabs from './BottomTabs';

/** 지금 보고 있는 사람 수 — blog.css에 기대지 않고 이 컴포넌트 안에서 직접 그린다 */
function LiveNow() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let id = sessionStorage.getItem('ulm_sid');
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
      sessionStorage.setItem('ulm_sid', id);
    }
    const ping = async () => {
      try {
        const r = await fetch(`/api/presence?id=${id}`, { cache: 'no-store' });
        const d = await r.json();
        setCount(typeof d.count === 'number' ? d.count : null);
      } catch {
        /* 실패해도 화면엔 그냥 안 보이면 그만 — 조용히 무시 */
      }
    };
    ping();
    const t = setInterval(ping, 15000);
    return () => clearInterval(t);
  }, []);

  if (count == null) return null;
  return (
    <span className="inline-flex items-center gap-1.5 t-sub font-semibold text-ink-2">
      <span className="w-2 h-2 rounded-full bg-safe" aria-hidden="true" />
      지금 <b className="text-accent">{count.toLocaleString()}</b>명이 보고 있어요
    </span>
  );
}

export default function SiteFooter() {
  return (
    <>
      <footer className="border-t border-line bg-bg">
        <Container className="pt-8 pb-24 lg:pb-8 flex flex-col items-center gap-3 text-center">
          <LiveNow />
          <nav aria-label="바닥글 메뉴" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/calc" className="t-sub font-semibold text-ink-2 hover:text-accent">계산기</Link>
            <Link href="/blog" className="t-sub font-semibold text-ink-2 hover:text-accent">블로그</Link>
            <Link href="/about" className="t-sub font-semibold text-ink-2 hover:text-accent">소개</Link>
            <Link href="/contact" className="t-sub font-semibold text-ink-2 hover:text-accent">문의</Link>
            <Link href="/terms" className="t-sub font-semibold text-ink-2 hover:text-accent">이용약관</Link>
            <Link href="/privacy" className="t-sub font-semibold text-ink-2 hover:text-accent">개인정보처리방침</Link>
            <a href="/feed.xml" aria-label="RSS 구독" className="inline-flex items-center gap-1 t-sub font-semibold text-ink-2 hover:text-accent">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="w-3 h-3 fill-current">
                <circle cx="5" cy="19" r="2.6" />
                <path d="M3 10.6v3.1a7.3 7.3 0 0 1 7.3 7.3h3.1A10.4 10.4 0 0 0 3 10.6z" />
                <path d="M3 3v3.1c8.2 0 14.9 6.7 14.9 14.9H21C21 11.1 12.9 3 3 3z" />
              </svg>
              RSS
            </a>
          </nav>
          {/* 면책 — 법적 핵심 한 줄: 참고용 예상 금액 · 당사자 아님 · 업체 등록 확인 */}
          <p className="t-sub text-ink-2 max-w-[460px] leading-relaxed">
            얼마드나의 견적은 참고용 예상 금액이며 계약 당사자가 아닙니다. 시공 전 업체의 사업자·건설업 등록 여부를 꼭 확인하세요.
          </p>
          <p className="t-sub text-ink-2/70">© 2026 얼마드나</p>
        </Container>
      </footer>
      <BottomTabs />
    </>
  );
}
