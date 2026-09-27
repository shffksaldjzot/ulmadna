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
// 2026-09-27 배포 전 검사관 지적 5번 반영 — "매인 관계" 되돌리기 추가:
//   벽지 종류(0단계)를 바꾸면 제품(1단계)도 다시 골라야 하는데, 예전엔 "손댔다"는 표시
//   (touchedFlags[1])가 그대로 남아서 제품 단계가 저절로 완료 처리(잘못된 값 "제품
//   미정"으로) 돼 버렸다. resetTouched(indices)를 새로 내보내서, 매인 단계 값이 바뀔 때
//   그 뒤 단계의 손댐 표시를 되돌릴 수 있게 했다 — 지금은 도배(종류→제품)만 쓰지만
//   바닥재(자재→제품) 등 다른 계산기도 같은 훅·같은 함수로 그대로 쓸 수 있다(일반화).
//
// 계산 부분(진짜 로직)은 React 없이도 시험할 수 있게 순수 함수(deriveFlowState·applyTouch·
// applyResetTouched)로 따로 뺐다 — __tests__/useFlowSteps.test.ts가 이 함수들만 부른다.
//
// 나머지 규칙은 옛 훅과 동일하다:
//   · 완료 = touched(실제로 손댐) && valid(값이 유효함) 둘 다 true.
//   · 맨 앞부터 봐서 처음으로 안 끝난 단계가 "현재 단계". 전부 끝났으면 배열 길이.
//   · reopen(i): 완료 단계 행의 "바꾸기"를 누르면 그 단계를 강제로 "현재"로 연다.
//     그 안에서 실제로 값이 바뀌면(version이 오르면) 강제 열림을 풀고 자동 계산으로 돌아간다.
//
// 작성일: 2026년 09월 27일
// 매인 관계(resetTouched) 추가: 2026년 09월 27일
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
  /** 완료된 단계를 다시 열고 싶을 때("바꾸기") 부르는 함수. 앞으로 가기로 그 자리에 다시
   * 돌아갈 때도 이 함수를 그대로 쓴다(useFlowBackNav.ts가 reopen(그 전이가 도달했던
   * activeIndex)로 부른다 — 2026-09-27 검사관 5차 지적으로 advance()는 삭제했다). */
  reopen: (index: number) => void;
  /** 이 단계에서 실제로 뭔가 손댔다는 표시. 각 입력 핸들러 안에서 불러 준다 */
  touch: (index: number) => void;
  /**
   * "매인 관계" 되돌리기 — 앞 단계 값이 실제로 바뀌어서 뒤 단계를 다시 골라야 할 때,
   * 그 뒤 단계들의 손댐 표시를 지운다(=다시 "현재 단계"로 열린다). 값 자체(폼 상태)는
   * 이 훅이 모르므로 안 건드린다 — 부르는 쪽이 폼 값도 같이 지워야 한다.
   */
  resetTouched: (indices: number[]) => void;
}

/**
 * 손댐 배열에 index 하나를 true로 표시한다(순수 함수). 이미 true면 같은 배열 참조를
 * 그대로 돌려줘서 불필요한 리렌더를 막는다.
 */
export function applyTouch(touchedFlags: boolean[], index: number): boolean[] {
  if (touchedFlags[index]) return touchedFlags;
  const next = [...touchedFlags];
  next[index] = true;
  return next;
}

/** 손댐 배열에서 여러 index를 한 번에 false로 되돌린다(순수 함수, 매인 관계 되돌리기) */
export function applyResetTouched(touchedFlags: boolean[], indices: number[]): boolean[] {
  if (indices.length === 0) return touchedFlags;
  const next = [...touchedFlags];
  let changed = false;
  for (const i of indices) {
    if (next[i]) {
      next[i] = false;
      changed = true;
    }
  }
  return changed ? next : touchedFlags;
}

/**
 * "지금 값이 유효한지"(dataComplete) + "실제로 손댔는지"(touchedFlags)만 보고
 * 완료 여부·현재 단계·전부 끝났는지를 계산하는 순수 함수. React를 전혀 안 써서
 * 화면 없이(vitest) 그대로 시험할 수 있다.
 */
export function deriveFlowState(
  dataComplete: boolean[],
  touchedFlags: boolean[],
): { completeFlags: boolean[]; activeIndex: number; allDone: boolean } {
  // 진짜 완료 = 손댔고(touched) + 값도 유효함(valid) 둘 다일 때만
  const completeFlags = dataComplete.map((valid, i) => (touchedFlags[i] ?? false) && valid);
  // 맨 앞부터 봐서 처음으로 안 끝난 단계 — 없으면(전부 끝) 배열 길이
  const firstIncomplete = completeFlags.findIndex((done) => !done);
  const activeIndex = firstIncomplete === -1 ? completeFlags.length : firstIncomplete;
  return { completeFlags, activeIndex, allDone: activeIndex === completeFlags.length };
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

  /** 그 단계에서 실제로 뭔가 골랐다는 표시 — applyTouch(순수 함수)를 그대로 쓴다 */
  function touch(index: number) {
    setTouchedFlags((prev) => applyTouch(prev, index));
  }

  /** 매인 단계 값이 바뀌어 뒤 단계를 다시 골라야 할 때 — applyResetTouched(순수 함수)를 쓴다 */
  function resetTouched(indices: number[]) {
    setTouchedFlags((prev) => applyResetTouched(prev, indices));
  }

  const { completeFlags, activeIndex: derivedIndex, allDone } = deriveFlowState(dataComplete, touchedFlags);

  return {
    activeIndex: overrideIndex ?? derivedIndex,
    allDone,
    completeFlags,
    touchedFlags,
    reopen: (index: number) => setOverrideIndex(index),
    touch,
    resetTouched,
  };
}
