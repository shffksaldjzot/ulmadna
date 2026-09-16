// ──────────────────────────────────────────────
// v1 허브 — 계산기 3종 공용 "단계 흐름" 상태 훅
//
// 하는 일:
//   각 단계가 "값은 유효한지(dataComplete)"만 배열로 받아서, 지금 화면에서 어느 단계를
//   "현재 단계"로 열어 보여줄지(activeIndex) 계산해 준다. 규칙은 단순하다 —
//     · 맨 앞에서부터 봐서 아직 안 끝난 첫 단계가 "현재 단계"다.
//     · 전부 끝났으면 activeIndex는 배열 길이(steps.length)가 된다(= 더 열 단계 없음 = 결과만 보여주면 됨).
//
//   완료된 단계를 다시 열고 싶을 때(그 단계 행의 "바꾸기")는 reopen(index)을 부른다.
//   이러면 그 단계가 "현재"로 강제로 열리고, 그 안에서 실제로 뭔가 값을 바꿔서 폼 상태가
//   바뀌는 순간(version이 바뀌는 순간) 다시 자동 계산 결과(activeIndex)로 돌아간다 —
//   "탭하면 다시 열리고, 값을 바꾸면 재계산되며 원래 흐름으로 돌아간다"는 지시를 그대로 구현.
//
// 2026-09-16 형아 피드백(보완): 기본값이 이미 채워진 단계(예: 미장 용도=방통, 면적=10평)가
//   화면에 들어오자마자 "완료"로 접혀버려 정작 봐야 할 첫 단계가 안 보이는 문제 — dataComplete
//   (값이 유효한지)만으로 완료를 판정하면 기본값도 "값이 있다"로 쳐져 버린다. 그래서 이제
//   "이 단계에서 사용자가 실제로 뭔가 골랐는지(touched)"를 따로 들고, 둘 다(touched && dataComplete)
//   true일 때만 진짜 "완료"로 친다. 기본값은 칩에 선택 표시만 되고, 단계 자체는 사용자가
//   탭/입력하기 전까지 "현재"로 열려 있는다(탭하면 같은 값이라도 완료로 인정).
//   공유 링크(?d=)로 들어온 경우만 예외 — allTouched=true로 시작해 전부 완료 상태로 연다.
//
// 이 훅은 화면(계산 엔진)의 값 자체는 하나도 안 건드린다 — 각 계산기 컴포넌트가 자기
// 폼 상태를 보고 "이 단계는 값이 유효한가"만 boolean 배열로 넘겨주면, 그 배열 + touched
// 배열만 보고 "지금 몇 번째를 열어 둘지"만 계산해 돌려주는 순수 UI 상태 훅이다.
//
// 작성일: 2026년 09월 16일
// touched 개념 도입: 2026년 09월 16일(보완)
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';

export interface StepFlowState {
  /** 지금 "현재 단계"로 열어야 하는 인덱스. completeFlags.length면 전부 끝났다는 뜻(더 열 단계 없음) */
  activeIndex: number;
  /** 단계 전부가 끝났는지(=결과를 보여줘도 되는 상태인지) */
  allDone: boolean;
  /**
   * 각 단계의 "진짜" 완료 여부 — touched(사용자가 실제로 손댐) && dataComplete(값이 유효함)
   * 둘 다 true일 때만 true. StepFlow의 complete prop에 그대로 넘기면 된다.
   */
  completeFlags: boolean[];
  /** 완료된 단계를 다시 열고 싶을 때(그 단계 행의 "바꾸기") 부르는 함수 */
  reopen: (index: number) => void;
  /**
   * 이 단계에서 사용자가 실제로 뭔가 탭/입력했다는 걸 표시한다. 기본값이 이미 조건을
   * 만족해도 이걸 부르기 전까지는 단계가 "완료"로 접히지 않는다 — 각 계산기 컴포넌트가
   * 단계 안의 실제 입력 핸들러(칩 클릭·값 변경) 안에서 불러 준다.
   */
  touch: (index: number) => void;
}

/**
 * dataComplete: 단계 순서대로 "이 단계 값이 유효한지" 배열(기본값만으로도 true일 수 있다).
 * version: 폼 값이 바뀔 때마다 하나씩 올라가는 숫자(각 계산기 Calculator가 patch()할
 *   때마다 같이 올려 준다). reopen으로 강제로 열어 둔 단계가 있을 때, 이 값이 바뀌면
 *   "사용자가 방금 뭔가 골랐다"는 뜻이라 강제 열림을 풀고 다시 자동 계산으로 넘긴다.
 * allTouched: true면 처음부터 모든 단계를 "손댄 것"으로 본다 — 공유 링크(?d=)로 들어와
 *   이미 완성된 조건을 그대로 보여줄 때만 true로 준다.
 */
export function useStepFlow(dataComplete: boolean[], version: number, allTouched: boolean): StepFlowState {
  // "바꾸기"로 강제로 열어 둔 단계 인덱스. null이면 강제 열림이 없다(자동 계산값을 그대로 쓴다)
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  // 단계별로 "사용자가 실제로 손댔는지" — 공유 링크면 전부 손댄 것으로 시작한다
  const [touchedFlags, setTouchedFlags] = useState<boolean[]>(() => dataComplete.map(() => allTouched));
  // version이 바뀌는 "순간"만 잡아내려고 직전 값을 기억해 둔다
  const prevVersionRef = useRef(version);

  useEffect(() => {
    if (version !== prevVersionRef.current) {
      prevVersionRef.current = version;
      // 강제로 열어 둔 단계에서 실제로 값을 바꿨다 → 강제 열림을 풀고 자동 계산에 맡긴다
      setOverrideIndex(null);
    }
  }, [version]);

  /** 그 단계에서 실제로 뭔가 골랐다는 표시 — 이미 true면 다시 안 바꾼다(불필요한 리렌더 방지) */
  function touch(index: number) {
    setTouchedFlags((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }

  // 진짜 완료 = 손댔고(touched) + 값도 유효함(dataComplete) 둘 다일 때만
  const completeFlags = dataComplete.map((valid, i) => (touchedFlags[i] ?? false) && valid);

  // 맨 앞부터 봐서 처음으로 안 끝난 단계 — 없으면(전부 끝) 배열 길이
  const firstIncomplete = completeFlags.findIndex((done) => !done);
  const derivedIndex = firstIncomplete === -1 ? completeFlags.length : firstIncomplete;

  return {
    activeIndex: overrideIndex ?? derivedIndex,
    allDone: derivedIndex === completeFlags.length,
    completeFlags,
    reopen: (index: number) => setOverrideIndex(index),
    touch,
  };
}
