'use client';
// ─────────────────────────────────────────────────────────────
// /sponsor 첫 화면 — "이번 주 {지역}에서 견적을 계산한 사람 {N}명" (2026년 10월 30일, 형아 확정 문구)
//
// [무슨 기능인가]
//   서버가 읽어 준 첫 값(방문자 지역·7일 계산 수)으로 먼저 그리고, 아래 "지역 바꿔 보기" 칩을
//   누르면 /api/sponsor/stats 를 불러 지역 글자와 숫자만 바꾼다. 공정별 숫자는 보여 주지 않는다.
// ─────────────────────────────────────────────────────────────
import Link from 'next/link';
import { useState } from 'react';

type Props = {
  /** 서버가 정한 처음 지역 글자·숫자·열쇠 */
  initial: { label: string; n: number; key: string };
  /** 지역 바꿔 보기 칩(서버 정본에서 받음) */
  chips: { key: string; label: string }[];
  /** 첫 달 무료 남은 곳(0이면 문구에서 숨김) */
  freeLeft: number;
};

export default function RegionHero({ initial, chips, freeLeft }: Props) {
  const [cur, setCur] = useState(initial);
  const [busy, setBusy] = useState(false);

  /** 칩을 눌러 그 지역 숫자를 불러온다(실패하면 그대로 둠) */
  async function pick(key: string) {
    if (busy || key === cur.key) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/sponsor/stats?sido=${encodeURIComponent(key)}`);
      if (r.ok) {
        const d = (await r.json()) as { label: string; n: number };
        setCur({ label: d.label, n: d.n, key });
      }
    } catch {
      /* 네트워크 실패는 무시 */
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-cream pt-8 pb-6 lg:pt-20 lg:pb-12 px-4">
      <div className="max-w-3xl mx-auto text-center">
        {/* 큰 글자 = 광고주가 돈을 내는 이유 한 문장(형아 확정 2026-10-30 저녁): 타이밍(견적 숫자를 본 직후) · 정액·문의 무제한 · 우리 동네 */}
        <h1 className="text-[21px] lg:text-4xl font-bold text-brown leading-snug break-keep" data-testid="hero-title">
          견적 숫자를 방금 본 우리 동네 고객의 전화,<br />몇 통이 와도 월 5만원.
        </h1>
        {/* 밑 줄 = 살아 있는 숫자(방문자 지역·이번 주 계산 수) */}
        <p className="mt-3 text-[15px] lg:text-lg text-brown/90 leading-snug break-keep">
          이번 주 <span data-testid="hero-region">{cur.label}</span>에서 견적을 계산한 사람{' '}
          <span className="whitespace-nowrap"><span className="tabular-nums font-semibold" data-testid="hero-n">{cur.n.toLocaleString('ko-KR')}</span>명.</span>{' '}
          그 화면 바로 옆이 광고주님 자리입니다.
        </p>
        <p className="mt-3 text-sm text-gray-600 leading-relaxed break-keep">
          평수·공정·등급까지 넣고 견적 숫자를 본 직후에만 보이는 자리. 문의가 몇 건이 와도 추가 요금은 없습니다.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <a href="#how-many" className="inline-flex items-center justify-center h-[46px] px-7 bg-brown text-white text-sm font-semibold rounded-full hover:bg-brown/90 transition-colors">
            내 지역 숫자 보기
          </a>
          <p className="text-xs text-gray-500">
            {freeLeft > 0 && <>첫 광고주 3곳 첫 달 무료 · </>}30일 5만원부터
          </p>
        </div>
        {/* 지역 바꿔 보기 칩 */}
        <div className="mt-5 flex flex-wrap justify-center items-center gap-1.5" role="group" aria-label="지역 바꿔 보기">
          <span className="text-[11px] text-gray-400 mr-1">지역 바꿔 보기</span>
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => pick(c.key)} aria-pressed={cur.key === c.key}
              className={`h-8 px-3 rounded-full text-xs border transition-colors ${cur.key === c.key ? 'bg-brown text-white border-brown' : 'bg-white text-gray-600 border-gray-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
        {/* 광고주가 사용자 입장에서 얼마드나를 먼저 훑어보게(형아 2026-10-30): 계산기·홈·블로그 새 탭 */}
        <p className="mt-4 text-xs text-gray-500 break-keep">
          사용자들이 왜 오는지 먼저 보세요 ·{' '}
          <a href="/calc" target="_blank" rel="noopener" className="underline underline-offset-2 text-brown">견적 계산기 써 보기</a> ·{' '}
          <a href="/" target="_blank" rel="noopener" className="underline underline-offset-2 text-brown">얼마드나 첫 화면</a> ·{' '}
          <a href="/blog" target="_blank" rel="noopener" className="underline underline-offset-2 text-brown">인테리어 글</a>
        </p>
        <p className="mt-2 text-[11px] text-gray-400">
          <Link href="/sponsor/preview" className="underline underline-offset-2">실제 자리 미리보기</Link>
        </p>
      </div>
    </section>
  );
}
