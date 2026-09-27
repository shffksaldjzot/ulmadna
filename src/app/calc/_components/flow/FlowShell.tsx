// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 공용 조립기
//
// 지시서 4-5절: "단계 정의는 목록 하나로" — 계산기 화면(WallpaperCalculator 등)은
// StepRow를 손으로 하나씩 늘어놓지 않고, 단계 정의 배열(FlowStepDef[]) 하나만 만들어
// 이 부품에 넘긴다. 이 부품이 배열을 돌며 StepRow를 그리고, "현재 단계 번호가 바뀔 때만"
// 화면을 스크롤해 준다(지시서 3-5절) + 화면 낭독기 알림(3-6절)까지 한 곳에서 처리한다.
//
// 다음 계산기(줄눈·탄성코트 등)를 새로 붙일 때도 이 파일은 그대로 두고 steps 배열만
// 새로 만들면 된다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import StepRow from './StepRow';
import type { FlowStepDef } from './types';

export interface FlowShellProps {
  steps: FlowStepDef[];
  activeIndex: number;
  completeFlags: boolean[];
  reopen: (index: number) => void;
}

export default function FlowShell({ steps, activeIndex, completeFlags, reopen }: FlowShellProps) {
  // 각 단계 카드의 실제 DOM을 기억해 뒀다가, activeIndex가 바뀔 때만 스크롤 대상으로 쓴다
  const stepEls = useRef<(HTMLDivElement | null)[]>([]);
  // "지난번" activeIndex를 기억해서, 칩·숫자만 바뀌고 단계 번호는 그대로인 경우엔
  // 스크롤을 절대 시키지 않는다(지시서 3-5절 핵심 규칙)
  const prevActiveIndexRef = useRef(activeIndex);

  useEffect(() => {
    if (activeIndex === prevActiveIndexRef.current) return;
    prevActiveIndexRef.current = activeIndex;

    const node = stepEls.current[activeIndex];
    if (!node) return;

    // 이미 화면 안에 전부 보이면(고정 헤더 아래까지 포함) 굳이 스크롤하지 않는다
    const rect = node.getBoundingClientRect();
    const headerOffset = 112; // 고정 헤더(모바일: 사이트헤더 56 + 제목줄 44) + 여백 12
    const fullyVisible = rect.top >= headerOffset && rect.bottom <= window.innerHeight;
    if (fullyVisible) return;

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [activeIndex]);

  /**
   * i+1번째 단계가 지금 "카드처럼"(테두리 있는 상자) 보이는지 — StepRow 안의 isCardLike
   * 판정과 같은 규칙을 여기서도 계산한다(2026-09-27 검수 지적 7번: 바로 아래가 카드면 그
   * 위 완료 줄의 구분선을 그리지 않으려고). keepOpen 단계는 "차례가 왔거나(현재) 이미
   * 끝났으면" 계속 카드로 보인다 — StepRow.tsx의 state 계산과 반드시 같은 조건이어야 한다.
   */
  function isCardLikeAt(index: number): boolean {
    if (index < 0 || index >= steps.length) return false;
    const step = steps[index];
    if (step.keepOpen) return index === activeIndex || (completeFlags[index] ?? false);
    return index === activeIndex;
  }

  return (
    // gap-2(8px): 단계 사이 세로 간격을 지시서 3-2절대로 8px로 통일한다(예전엔 간격이 0이라
    // 완료 줄 밑줄이 바로 아래 카드 윗선과 거의 붙어 보였다 — 검수 지적 7번)
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <StepRow
          key={step.key}
          ref={(el) => { stepEls.current[i] = el; }}
          index={i}
          activeIndex={activeIndex}
          title={step.title}
          summary={step.summary}
          complete={completeFlags[i] ?? false}
          keepOpen={step.keepOpen}
          onReopen={() => reopen(i)}
          hideDivider={isCardLikeAt(i + 1)}
        >
          {step.content}
        </StepRow>
      ))}

      {/* 화면 낭독기 알림 — 눈에는 안 보이고, 단계 번호가 바뀔 때만 "N단계 제목"을 읽어준다(3-6절) */}
      <span aria-live="polite" className="sr-only">
        {activeIndex < steps.length ? `${activeIndex + 1}단계 ${steps[activeIndex].title}` : '모든 단계 완료'}
      </span>
    </div>
  );
}
