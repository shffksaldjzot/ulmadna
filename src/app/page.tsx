'use client';

import { useEffect, useState } from 'react';
import { useCalculator } from '@/hooks/useCalculator';
import InputPanel from '@/components/calculator/InputPanel';
import ResultPanel from '@/components/calculator/ResultPanel';
import AdSlot from '@/components/ads/AdSlot';
import InteriorResourceLinks from '@/components/common/InteriorResourceLinks';
import ProcessTiles from '@/app/calc/ProcessTiles';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import Container from '@/components/layout/Container';

export default function Home() {
  const { state, dispatch } = useCalculator();

  // 결과 카드 가시성 추적 — 결과부 도달 시 모바일 하단 고정바 숨김 (v2 명세 §7.2)
  // ResultPanel.tsx의 #result-card 견적 카드가 뷰포트 10% 이상 보이면 hide, 위로 가면 다시 show
  const [isResultVisible, setIsResultVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById('result-card');
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsResultVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [state.output.total]); // 결과 카드가 새로 mount될 때(첫 견적 입력 시점)마다 재연결

  // 맨위로(↑) 버튼 — 부드러운 스크롤 (v2 명세 §2.4 · §7.1)
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <>
      {/* ───── 헤더 — 홈·계산기·블로그 공용 상단바 (2026-09-15 디자인 통일 작업 A) ───── */}
      <SiteHeader />

      {/* AD-H: 헤더 ↔ 계산기 사이. 광고 전역 스위치가 꺼져 있는 동안은 collapse */}
      <AdSlot id="AD-H" />

      {/* ───── 한 줄 약속 + 살아있는 계산기 카드 ─────
          공용 컨테이너(Container)로 감싸서 왼쪽 시작선을 상단바 로고와 정확히 맞춘다. */}
      <Container className="pt-6 pb-2 lg:pt-8 lg:pb-4 flex flex-col gap-4">
        <p className="t-body text-ink-2">인테리어, 얼마 드나. 견적서 없이 바로 계산</p>
        <ProcessTiles />
      </Container>

      {/* ───── 메인: 타일 + 입력 (55~60%) + 결과 (40~45%) ─────
          2026-09-15 형아 지시(추가): 흰 배경 띠는 풀블리드로 두되, 안의 제목·패널은
          공용 Container 안에 넣어서 좌우 가장자리가 위 카드들(로고·계산기 카드)과
          정확히 같은 x(모바일 20 / 데스크톱 112)에 오게 한다. InputPanel의 자체 내부
          여백(p-4/lg:p-8)은 그대로 두고(형아 지시: 안쪽 디자인은 손대지 않음), 바깥
          여백만 걷어낸다(아래 InputPanel.tsx의 lg:m-2 제거와 짝) — Container의 padding이
          곧 카드 바깥 가장자리가 되도록. */}
      <main className="bg-white overflow-hidden">
        <Container>
          {/* 견적 계산기 제목 — 타일 제목과 같은 정렬, 글자 단계만 새 정본(t-section) 적용 */}
          <div className="w-full lg:w-[58%] pt-2 pb-1">
            <h2 className="t-section text-ink">인테리어 견적 계산기</h2>
          </div>

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
        </Container>
      </main>

      {/* 절약 팁 섹션 제거됨 */}

      {/* 모바일 하단 고정바 — 1줄 압축 + 결과부 도달 시 숨김 (v2 명세 §7.1 · §7.2)
          * 표시 조건: 견적 있고(total>0) AND 결과 카드 미노출(스크롤이 입력부에 있음)
          * 라벨/평당가는 작게(10~11px), 금액(text-lg)만 큰 글씨로 가독성 유지
          * 우측 ↑ 버튼은 페이지 최상단으로 부드럽게 이동 (§2.4) */}
      {state.output.total > 0 && !isResultVisible && (
        <div
          className="lg:hidden fixed left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 py-2.5"
          // bottom-0 대신 공용 하단 탭(BottomTabs, 56px + 세이프에어리어) 위에 얹는다 — 겹침 방지
          style={{ bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between gap-3 max-w-[600px] mx-auto">
            {/* 좌측: 라벨(작게) + 금액(큰 글씨) 인라인 배치 */}
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-[10px] text-gray-400 shrink-0">예상 총 비용</span>
              <span className="text-lg font-bold text-brown truncate">
                {Math.round(state.output.total / 10000).toLocaleString()}만원
              </span>
            </div>
            {/* 우측: 평당가 + 맨위로(↑) 버튼 */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-gold font-medium">
                평당 {Math.round(state.output.perPyeong / 10000).toLocaleString()}만
              </span>
              <button
                onClick={scrollTop}
                aria-label="맨 위로"
                className="w-8 h-8 rounded-full bg-cream hover:bg-gold/10 text-brown flex items-center justify-center transition-colors text-sm"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 하단바 높이만큼 여백 — 하단바(~52px) + 공용 하단 탭(56px) 노출 중에만 */}
      {state.output.total > 0 && !isResultVisible && <div className="lg:hidden h-28" />}

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
              실제 인테리어 현장에서 수집한 견적서 데이터를 분석하여
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
            <p className="text-3xl font-bold text-brown">1,000건+</p>
            <p className="text-xs text-gray-400 mt-1">실제 견적서 분석</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">1,000건+</p>
            <p className="text-xs text-gray-400 mt-1">세부 공정 데이터</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-brown">100%</p>
            <p className="text-xs text-gray-400 mt-1">완전 무료</p>
          </div>
        </div>
      </section>

      {/* ───── 인테리어 공사 자료실 (광고 자리 대체 — 2026년 06월 29일) ─────
          표준계약서·키스콘·건축물대장·하자분쟁·소비자원 등 공식 사이트 바로가기 */}
      <InteriorResourceLinks />

      {/* AD-F: 신뢰 섹션 ↔ 푸터 사이. 광고 전역 스위치가 꺼져 있는 동안은 collapse */}
      <AdSlot id="AD-F" />

      {/* ───── 푸터 — 공용 푸터(하단 탭 포함), 모든 페이지 동일 ─────
          사업자등록번호 등 상세 정보는 /about·/contact·/privacy·/terms에 있고
          공용 푸터가 그 페이지들로 링크한다(중복 대신 한 곳에서 관리). */}
      <SiteFooter />
    </>
  );
}
