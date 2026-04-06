'use client';

import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useCalculator } from '@/hooks/useCalculator';
import InputPanel from '@/components/calculator/InputPanel';
import ResultPanel from '@/components/calculator/ResultPanel';

export default function Home() {
  const { data: session } = useSession();
  const { state, dispatch } = useCalculator();

  return (
    <>
      {/* ───── 헤더 ───── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/">
              <Image
                src="/ulmadna_logo.png"
                alt="얼마드나"
                width={130}
                height={44}
                priority
                className="cursor-pointer"
              />
            </a>
            <span className="hidden md:inline-block text-[10px] text-gray-400 border border-gray-200 rounded-full px-3 py-1">
              완전 무료 · 회원가입 없음 · 전화번호 없음
            </span>
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <a
                  href="/my-estimates"
                  className="text-xs text-gray-500 hover:text-brown border border-gray-200 px-4 py-2 rounded-full transition-colors"
                >
                  내 견적서
                </a>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-xs text-gray-400 hover:text-brown transition-colors"
                >
                  로그아웃
                </button>
                <span className="text-xs text-brown font-medium">
                  {session.user.name}님
                </span>
              </>
            ) : (
              <>
                <span className="hidden sm:block text-xs text-gray-400">
                  완전 무료 · 개인정보 없음
                </span>
                <button
                  onClick={() => window.location.href = '/login'}
                  className="text-xs text-gray-500 hover:text-brown border border-gray-200 px-4 py-2 rounded-full transition-colors"
                >
                  로그인
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ───── 히어로 섹션 ───── */}
      <section className="bg-cream">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 lg:py-16 flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="text-xs text-gold font-medium tracking-widest mb-3">
              무료 인테리어 견적 계산기
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-brown leading-tight">
              우리 집 인테리어,<br />얼마 드나?
            </h1>
            <p className="text-sm text-gray-500 mt-3 leading-relaxed">
              회원가입과 개인정보 없이 누구나 쉽게!
            </p>
          </div>
{/* 인테리어 이미지 제거됨 */}
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
      <section className="bg-cream py-16 px-4 lg:px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 max-w-lg">
            <p className="text-[10px] text-gold tracking-widest mb-4">얼마드나를 만든 이유</p>
            <h2 className="text-2xl font-bold text-brown leading-snug mb-4">
              실제 견적 데이터로<br />만든 계산기
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              인테리어 커뮤니티에서 수집한 실제 견적서 데이터를 분석하여
              공정별 시장 평균 단가를 산출했습니다.
              무료이고, 개인정보를 받지 않고, 숫자의 근거를
              투명하게 공개합니다.
            </p>
            <div className="mt-4 bg-amber/5 border border-amber/20 rounded-lg p-3">
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="text-amber font-medium">참고 안내 ·</span> 얼마드나의 견적 정보는 시장 평균 기반의 <strong>참고용 예상 금액</strong>입니다.
                실제 비용은 현장 상황, 자재 수급, 지역에 따라 달라질 수 있으니 반드시 인테리어 전문 업체와 상의하세요.
              </p>
            </div>
          </div>
{/* 시공 사례 이미지 제거됨 */}
        </div>

        {/* 통계 */}
        <div className="max-w-[1400px] mx-auto mt-12 flex justify-center gap-12 lg:gap-20">
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">35건+</p>
            <p className="text-xs text-gray-400 mt-1">실제 견적서 분석</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">19개</p>
            <p className="text-xs text-gray-400 mt-1">세부 공정 데이터</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">100%</p>
            <p className="text-xs text-gray-400 mt-1">완전 무료</p>
          </div>
        </div>
      </section>

      {/* ───── 푸터 ───── */}
      <footer className="bg-brown text-cream/80 py-10 px-4 lg:px-8">
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
