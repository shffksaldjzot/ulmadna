'use client';

import Image from 'next/image';
import { useCalculator } from '@/hooks/useCalculator';
import InputPanel from '@/components/calculator/InputPanel';
import ResultPanel from '@/components/calculator/ResultPanel';

export default function Home() {
  const { state, dispatch } = useCalculator();

  return (
    <>
      {/* ───── 헤더 ───── */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <Image
              src="/ulmadna_logo.png"
              alt="얼마드나"
              width={120}
              height={40}
              priority
            />
            <span className="hidden md:inline-block text-[10px] text-secondary border border-border rounded-full px-3 py-1 tracking-wide">
              완전 무료 · 회원가입 없음 · 개인정보 없음
            </span>
          </a>
          <button
            onClick={() => window.location.href = '/login'}
            className="text-xs text-secondary hover:text-brown border border-border hover:border-gold px-4 py-2 rounded-full"
          >
            로그인
          </button>
        </div>
      </header>

      {/* ───── 히어로 섹션 ───── */}
      <section className="bg-cream border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-12 lg:py-20">
          <p className="text-[11px] text-gold-muted font-medium tracking-[0.2em] uppercase mb-4">
            Interior Cost Calculator
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-brown-deep tracking-tight leading-[1.15]">
            우리 집 인테리어,<br />얼마 드나?
          </h1>
          <p className="text-sm text-secondary mt-4 leading-relaxed max-w-md">
            회원가입과 개인정보 없이 누구나 쉽게.
            실제 견적서 데이터 기반 예상 비용을 확인하세요.
          </p>
        </div>
      </section>

      {/* ───── 메인: 입력 (55~60%) + 결과 (40~45%) ───── */}
      <main className="max-w-[1400px] mx-auto overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* 좌측: 입력 패널 — 고정 너비 */}
          <div className="w-full lg:w-[58%] min-w-0 overflow-hidden">
            <InputPanel input={state.input} output={state.output} dispatch={dispatch} />
          </div>

          {/* 우측: 결과 패널 — 고정 너비, sticky */}
          <div className="w-full lg:w-[42%] min-w-0 overflow-hidden lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:overflow-y-auto">
            <ResultPanel input={state.input} output={state.output} dispatch={dispatch} />
          </div>
        </div>
      </main>

      {/* 절약 팁 섹션 제거됨 */}

      {/* 모바일 하단 플로팅 바 — 총액 항상 표시 */}
      {state.output.total > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-3">
          <div className="flex items-center justify-between max-w-[600px] mx-auto">
            <div>
              <p className="text-[10px] text-gray-400">예상 총 비용</p>
              <p className="text-xl font-bold text-brown">
                {Math.round(state.output.total / 10000).toLocaleString()}만원
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400">평당</p>
              <p className="text-sm font-semibold text-gold">
                {Math.round(state.output.perPyeong / 10000).toLocaleString()}만원
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 플로팅 바 높이만큼 여백 */}
      {state.output.total > 0 && <div className="lg:hidden h-16" />}

      {/* 파트너 배너: 실제 스폰서 등록 전까지 숨김 */}

      {/* ───── 브랜드 스토리 + 통계 ───── */}
      <section className="bg-cream border-t border-border py-16 lg:py-24 px-4 lg:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-xl">
            <p className="text-[11px] text-gold-muted font-medium tracking-[0.2em] uppercase mb-4">About</p>
            <h2 className="text-2xl lg:text-3xl font-bold text-brown-deep tracking-tight leading-snug mb-4">
              실제 견적 데이터로<br />만든 계산기
            </h2>
            <p className="text-sm text-secondary leading-relaxed">
              인테리어 커뮤니티에서 수집한 실제 견적서 데이터를 분석하여
              공정별 시장 평균 단가를 산출했습니다.
              무료이고, 개인정보를 받지 않고, 숫자의 근거를 투명하게 공개합니다.
            </p>
          </div>

          {/* 통계 */}
          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-brown tabular-nums">35+</p>
              <p className="text-[11px] text-secondary mt-1">실제 견적서 분석</p>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-brown tabular-nums">19</p>
              <p className="text-[11px] text-secondary mt-1">세부 공정 데이터</p>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-gold tabular-nums">0</p>
              <p className="text-[11px] text-secondary mt-1">원 이용 비용</p>
            </div>
          </div>

          <div className="mt-8 bg-cream-warm rounded-xl p-4 max-w-xl border border-border">
            <p className="text-xs text-secondary leading-relaxed">
              <span className="text-amber font-medium">참고 ·</span> 시장 평균 기반의 참고용 예상 금액입니다.
              실제 비용은 현장 상황, 자재 수급에 따라 달라질 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* ───── 푸터 ───── */}
      <footer className="bg-brown-deep text-cream/70 py-12 px-4 lg:px-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <Image
                src="/ulmadna_logo.png"
                alt="얼마드나"
                width={80}
                height={28}
                className="brightness-0 invert opacity-60 mb-3"
              />
              <p className="text-xs leading-relaxed">
                얼마드나 · 대표 김지환<br />
                사업자등록번호 565-58-00717<br />
                cs870@naver.com
              </p>
            </div>
            <div className="flex gap-8 text-xs">
              <div>
                <p className="text-cream/40 mb-2 font-medium">서비스</p>
                <p>견적 계산기</p>
                <p className="text-cream/30 mt-1">자재 소요량 (준비 중)</p>
                <p className="text-cream/30">견적서 비교 (준비 중)</p>
              </div>
              <div>
                <p className="text-cream/40 mb-2 font-medium">지원</p>
                <p><a href="/terms" className="hover:text-cream transition-colors">이용약관</a></p>
                <p><a href="/privacy" className="hover:text-cream transition-colors">개인정보처리방침</a></p>
              </div>
              <div>
                <p className="text-cream/40 mb-2 font-medium">광고/제휴</p>
                <p>스폰서 배너 문의</p>
                <p className="text-cream/30 mt-1">
                  <a href="mailto:cs870@naver.com?subject=[얼마드나] 스폰서 배너 문의" className="hover:text-cream transition-colors">
                    cs870@naver.com
                  </a>
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-cream/10 mt-8 pt-4 text-[10px] text-cream/30 flex flex-col sm:flex-row justify-between gap-2">
            <p>본 견적은 참고용 예상 금액이며, 실제 시공비는 현장 실측에 따라 달라질 수 있습니다.</p>
            <p>© 2026 얼마드나 · <a href="/privacy" className="hover:text-cream">개인정보처리방침</a> · <a href="/terms" className="hover:text-cream">이용약관</a></p>
          </div>
        </div>
      </footer>
    </>
  );
}
