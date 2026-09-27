// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 단계 상태 훅
//
// 옛 useStepFlow.ts(바닥재·미장이 아직 씀)와 하는 일은 같다 — "이 단계 값이 유효한지"
// 배열만 받아서 "지금 몇 번째를 현재 단계로 열어 둘지"를 계산해 준다. 이 새 버전은
// 2026-09-27 지시서를 따르려고 두 가지를 더한다:
//
//   1) touchedFlags를 밖으로도 내보낸다 — 새로 고침 복원(sessionStorage)에 "어느 단계까지
//      실제로 손댔는지"를 같이 저장해야 하기 때문(옛 훅은 이 값을 안 내보냈다).
//   2) 초기 touched 값을 밖에서 주입할 수 있다(initialTouched) — 새로 고침 복원 시
//      "이미 손댔던 단계"를 그대로 살려서 시작하기 위해서다.
//
// 나머지 규칙은 옛 훅과 동일하다:
//   · 완료 = touched(실제로 손댐) && valid(값이 유효함) 둘 다 true.
//   · 맨 앞부터 봐서 처음으로 안 끝난 단계가 "현재 단계". 전부 끝났으면 배열 길이.
//   · reopen(i): 완료 단계 행의 "바꾸기"를 누르면 그 단계를 강제로 "현재"로 연다.
//     그 안에서 실제로 값이 바뀌면(version이 오르면) 강제 열림을 풀고 자동 계산으로 돌아간다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseFlowStepsOptions {
  /** 단계 순서대로 "지금 값이 유효한지" 배열 */
  dataComplete: boolean[];
  /** 폼 값이 바뀔 때마다 하나씩 올라가는 숫자 — 강제 열림(reopen)을 풀 때 쓴다 */
  version: number;
  /** true면 처음부터 모든 단계를 "손댄 것"으로 본다(공유 링크로 들어온 경우) */
  allTouched: boolean;
  /**
   * 세션 복원용 — 이미 손댔던 단계를 그대로 복원할 때 넘긴다. 주면 allTouched는 무시하고
   * 이 배열을 그대로 초기값으로 쓴다(길이가 dataComplete와 다르면 안전하게 무시한다).
   */
  initialTouched?: boolean[];
}

export interface FlowStepsState {
  /** 지금 "현재 단계"로 열어야 하는 인덱스. dataComplete.length면 전부 끝났다는 뜻 */
  activeIndex: number;
  /** 단계 전부가 끝났는지 */
  allDone: boolean;
  /** 각 단계의 "진짜" 완료 여부(touched && valid) */
  completeFlags: boolean[];
  /** 각 단계를 사용자가 실제로 손댔는지 — 세션 저장용으로 그대로 내보낸다 */
  touchedFlags: boolean[];
  /** 완료된 단계를 다시 열고 싶을 때("바꾸기") 부르는 함수 */
  reopen: (index: number) => void;
  /** 이 단계에서 실제로 뭔가 손댔다는 표시. 각 입력 핸들러 안에서 불러 준다 */
  touch: (index: number) => void;
}

export function useFlowSteps({ dataComplete, version, allTouched, initialTouched }: UseFlowStepsOptions): FlowStepsState {
  // "바꾸기"로 강제로 열어 둔 단계 인덱스. null이면 강제 열림이 없다
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  // 단계별 "실제로 손댔는지" — 세션 복원 값이 있고 길이가 맞으면 그걸 쓰고, 아니면 allTouched로 채운다
  const [touchedFlags, setTouchedFlags] = useState<boolean[]>(() => {
    if (initialTouched && initialTouched.length === dataComplete.length) return initialTouched;
    return dataComplete.map(() => allTouched);
  });
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

  // 진짜 완료 = 손댔고(touched) + 값도 유효함(valid) 둘 다일 때만
  const completeFlags = dataComplete.map((valid, i) => (touchedFlags[i] ?? false) && valid);

  // 맨 앞부터 봐서 처음으로 안 끝난 단계 — 없으면(전부 끝) 배열 길이
  const firstIncomplete = completeFlags.findIndex((done) => !done);
  const derivedIndex = firstIncomplete === -1 ? completeFlags.length : firstIncomplete;

  return {
    activeIndex: overrideIndex ?? derivedIndex,
    allDone: derivedIndex === completeFlags.length,
    completeFlags,
    touchedFlags,
    reopen: (index: number) => setOverrideIndex(index),
    touch,
  };
}
