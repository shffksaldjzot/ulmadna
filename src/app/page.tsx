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
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/ulmadna_logo.png"
              alt="얼마드나"
              width={130}
              height={44}
              priority
            />
            <span className="hidden md:inline-block text-[10px] text-gray-400 border border-gray-200 rounded-full px-3 py-1">
              완전 무료 · 회원가입 없음 · 전화번호 없음
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-gray-400">
              완전 무료 · 개인정보 없음
            </span>
            <button
              onClick={() => window.location.href = '/api/auth/signin'}
              className="text-xs text-gray-500 hover:text-brown border border-gray-200 px-4 py-2 rounded-full transition-colors"
            >
              로그인
            </button>
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
              회원가입과 개인정보 없이 누구나 쉽게! 10년 노하우를 담은 현장 경험을 토대로 견적서를 뽑아드립니다.
            </p>
          </div>
{/* 인테리어 이미지 제거됨 */}
        </div>
      </section>

      {/* ───── 메인: 입력 (55~60%) + 결과 (40~45%) ───── */}
      <main className="max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row">
          {/* 좌측: 입력 패널 (55~60%) */}
          <div className="lg:w-[58%]">
            <InputPanel input={state.input} output={state.output} dispatch={dispatch} />
          </div>

          {/* 우측: 결과 패널 (40~45%) — sticky */}
          <div className="lg:w-[42%] lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:overflow-y-auto">
            <ResultPanel input={state.input} output={state.output} dispatch={dispatch} />
          </div>
        </div>
      </main>

      {/* ───── 절약 팁 & 현장 가격 카드 ───── */}
      {state.output.savingTips.length > 0 && (
        <section className="bg-cream py-10 px-4 lg:px-8">
          <div className="max-w-[1400px] mx-auto grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-safe/10 flex items-center justify-center text-safe text-sm">&#9660;</span>
                <h3 className="text-sm font-bold text-brown">절약 포인트</h3>
              </div>
              <div className="space-y-2">
                {state.output.savingTips.map((tip, i) => (
                  <p key={i} className="text-sm text-gray-600">{tip.text}</p>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-full bg-amber/10 flex items-center justify-center text-amber text-sm">&#9888;</span>
                <h3 className="text-sm font-bold text-brown">현장 가격 안내</h3>
              </div>
              <p className="text-sm text-gray-600">
                이 견적은 시장 평균 기반 예상치입니다. 현장 상황(누수, 석면, 구조 변경 등)에 따라 실제 비용은 달라질 수 있어요. 정확한 비용은 현장 실측 후 확인하세요.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ───── 파트너 배너 ───── */}
      <section className="bg-cream py-8 px-4 lg:px-8">
        <p className="text-center text-[10px] text-gray-300 tracking-wider mb-4">
          이 서비스는 파트너 브랜드의 후원으로 무료 운영됩니다
        </p>
        <div className="max-w-[1400px] mx-auto flex justify-center gap-4">
          <div className="w-[320px] h-[90px] bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">
            파트너 배너
          </div>
          <div className="hidden md:flex w-[320px] h-[90px] bg-gray-50 rounded-xl border border-dashed border-gray-200 items-center justify-center text-xs text-gray-300">
            파트너 배너
          </div>
        </div>
      </section>

      {/* ───── 브랜드 스토리 + 통계 ───── */}
      <section className="bg-cream py-16 px-4 lg:px-8">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 max-w-lg">
            <p className="text-[10px] text-gold tracking-widest mb-4">얼마드나를 만든 이유</p>
            <h2 className="text-2xl font-bold text-brown leading-snug mb-4">
              거품 없는 견적,<br />숫자로 증명하는 신뢰
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              10년간 1,240건이 넘는 현장을 봐왔고, 매번 같은 질문을 받았습니다.
              &ldquo;이거 적정 가격 맞아요?&rdquo; 그 질문에 제대로 답하고 싶어서
              이 계산기를 만들었습니다. 무료이고, 개인정보를 받지 않고, 숫자의 근거를
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
            <p className="text-3xl font-bold text-brown">1,240+</p>
            <p className="text-xs text-gray-400 mt-1">시공 완료 프로젝트</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">10년</p>
            <p className="text-xs text-gray-400 mt-1">인테리어 실무 경력</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">98%</p>
            <p className="text-xs text-gray-400 mt-1">고객 만족도</p>
          </div>
        </div>
      </section>

      {/* ───── 푸터 ───── */}
      <footer className="bg-brown text-cream/60 py-10 px-4 lg:px-8">
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
