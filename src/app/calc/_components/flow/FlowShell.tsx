// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 공용 조립기
//
// 지시서 4-5절: "단계 정의는 목록 하나로" — 계산기 화면(WallpaperCalculator 등)은
// StepRow를 손으로 하나씩 늘어놓지 않고, 단계 정의 배열(FlowStepDef[]) 하나만 만들어
// 이 부품에 넘긴다. 이 부품이 배열을 돌며 StepRow를 그리고, "새 단계가 처음 나타날
// 때만" 화면을 스크롤해 준다(지시서 3-5절) + 화면 낭독기 알림(3-6절)까지 한 곳에서 처리한다.
//
// 2026-09-27 형아 결정(끝낸 단계를 접지 않기) 반영 — "바꾸기"(reopen) 개념이 없어져서
// props에서 뺐고, keepOpen 구분도 없어졌다(모든 단계가 완료되면 똑같이 "끝낸 단계"
// 모습이라 마지막 단계만 다르게 볼 이유가 없다) — isCardLikeAt이 훨씬 단순해졌다.
// 스크롤 판정도 "activeIndex가 조금이라도 바뀌면"이 아니라 "이번까지 도달한 가장 큰
// activeIndex보다 더 커질 때만"으로 바꿨다 — 매인 관계로 activeIndex가 뒤로 돌아가는
// 것(예: 종류를 바꿔 제품이 미완료로 돌아감)은 "새로 나타난 단계"가 아니므로 스크롤하면
// 안 된다(3-5절 "같은 단계 안 조작·끝낸 단계 수정으로는 움직이지 않음").
//
// 다음 계산기(줄눈·탄성코트 등)를 새로 붙일 때도 이 파일은 그대로 두고 steps 배열만
// 새로 만들면 된다.
//
// 2026-09-27 지휘관 지적(구분선 "웃는 입" 모양) 수리 — StepRow.tsx가 이제 구분선을
// 카드 테두리가 아니라 절대 위치의 곧은 줄로 따로 그린다. isLast(i)를 추가해서 마지막
// 단계 아래(조정 칩 위)에는 그 줄도 안 그리게 걸렀다(예전엔 다음 단계가 없어
// isCardLikeAt(i+1)이 그냥 false가 되어 구분선이 그려져 버렸다).
//
// 작성일: 2026년 09월 27일
// 끝낸 단계를 접지 않는 새 규칙으로 단순화: 2026년 09월 27일
// 마지막 단계 아래 구분선 억제 추가(구분선 모양 수리에 맞춰): 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import StepRow from './StepRow';
import type { FlowStepDef } from './types';
import { ensureFocusModalityTracking } from './focusModality';

export interface FlowShellProps {
  steps: FlowStepDef[];
  activeIndex: number;
  completeFlags: boolean[];
}

export default function FlowShell({ steps, activeIndex, completeFlags }: FlowShellProps) {
  // 각 단계 카드의 실제 DOM을 기억해 뒀다가, "새 단계가 처음 나타날 때"만 스크롤 대상으로 쓴다
  const stepEls = useRef<(HTMLDivElement | null)[]>([]);
  // "지금까지 도달했던 가장 큰 activeIndex" — 이 값보다 activeIndex가 더 커질 때만
  // "새 단계가 처음 나타났다"고 보고 스크롤한다. 매인 관계로 activeIndex가 뒤로 돌아가는
  // 건(이미 본 적 있는 단계로) 여기 포함 안 시킨다 — 절대 그 값을 줄이지 않는다.
  const maxReachedIndexRef = useRef(activeIndex);

  // 2026-09-27 재검수 추가 지적 5번: 새 틀 전용 초점 테두리 규칙이 쓸 "마지막 입력 방식"
  // 추적을 여기서 한 번 켠다(중복 호출은 안에서 알아서 막는다).
  useEffect(() => {
    ensureFocusModalityTracking();
  }, []);

  useEffect(() => {
    if (activeIndex <= maxReachedIndexRef.current) {
      // 뒤로 돌아가거나 제자리 — "새로 나타난 단계"가 아니므로 스크롤하지 않는다
      return;
    }
    maxReachedIndexRef.current = activeIndex;

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
   * i번째 단계가 지금 "카드처럼"(테두리 있는 상자) 보이는지 — StepRow 안의 isCardLike
   * 판정과 같은 규칙을 여기서도 계산한다(구분선 판정용). 이제 "지금 할 단계"만 카드다
   * (끝낸 단계도 같은 자리를 쓰지만 색만 달라서, 구분선 숨김 판정에서는 카드로 안 친다).
   */
  function isCardLikeAt(index: number): boolean {
    if (index < 0 || index >= steps.length) return false;
    return index === activeIndex;
  }

  /**
   * i번째 단계가 "마지막 단계"인지 — 마지막 단계 아래(조정 칩 위)에는 구분선을 안 그린다
   * (2026-09-27 지휘관 지적). i+1이 steps.length를 넘어가면(다음 단계 자체가 없으면)
   * isCardLikeAt(i+1)이 범위 밖이라 그냥 false를 주는데, 그러면 hideDivider도 false가
   * 되어 마지막 단계 밑에 구분선이 그려져 버렸다 — 여기서 따로 걸러 준다.
   */
  function isLast(index: number): boolean {
    return index === steps.length - 1;
  }

  return (
    // gap-2(8px): 단계 사이 세로 간격을 지시서 3-2절대로 8px로 통일한다.
    // flowFocusScope: 이 안(칩·세그먼트·버튼)에서만 새 초점 테두리 규칙(globals.css)이 적용된다
    <div className="flex flex-col gap-2 flowFocusScope">
      {steps.map((step, i) => (
        <StepRow
          key={step.key}
          ref={(el) => { stepEls.current[i] = el; }}
          index={i}
          activeIndex={activeIndex}
          title={step.title}
          complete={completeFlags[i] ?? false}
          hideDivider={isCardLikeAt(i + 1) || isLast(i)}
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
