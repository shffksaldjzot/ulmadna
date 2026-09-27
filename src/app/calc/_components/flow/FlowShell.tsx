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

  return (
    <div className="flex flex-col">
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
