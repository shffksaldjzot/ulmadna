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
// 2026-09-27 형아 결정(끝낸 단계를 접지 않기) 반영 — "바꾸기로 강제로 다시 연다"는
// 개념 자체가 없어졌다. 끝낸 단계도 항상 펼쳐진 채 그 자리에서 바로 고칠 수 있으므로,
// overrideIndex·reopen()·version(강제 열림을 풀 때 쓰던 것)을 전부 없앴다 — activeIndex는
// 이제 순수하게 touched·valid에서만 나온다(맨 앞부터 봐서 처음으로 안 끝난 단계). "지금
// 할 단계가 아닌 끝낸 단계의 값을 고치면 그 자리에서 바로 반영되고, activeIndex는 그
// 값이 실제로 그 단계를 미완료로 만들 때만(예: 매인 관계로 뒤 단계 resetTouched) 옮겨
// 간다" — 이것도 deriveFlowState가 touched·valid만 보고 그대로 계산해 준다.
//
// 계산 부분(진짜 로직)은 React 없이도 시험할 수 있게 순수 함수(deriveFlowState·applyTouch·
// applyResetTouched)로 따로 뺐다 — __tests__/useFlowSteps.test.ts가 이 함수들만 부른다.
//
// 나머지 규칙:
//   · 완료 = touched(실제로 손댐) && valid(값이 유효함) 둘 다 true.
//   · 맨 앞부터 봐서 처음으로 안 끝난 단계가 "현재 단계"(강조 카드). 전부 끝났으면 배열 길이.
//   · 한 번 완료됐던 단계는(그 단계 자신의 completeFlags가 true인 한) activeIndex가 그
//     단계보다 앞으로 되돌아가도 계속 "끝낸 단계" 모습으로 펼쳐져 보인다 — StepRow.tsx가
//     "완료 여부"만 보고 그리지 activeIndex와의 위치 비교로 숨기지 않기 때문이다.
//
// 작성일: 2026년 09월 27일
// 매인 관계(resetTouched) 추가: 2026년 09월 27일
// 끝낸 단계 접지 않기 결정 반영(overrideIndex·reopen·version 삭제): 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';

export interface UseFlowStepsOptions {
  /** 단계 순서대로 "지금 값이 유효한지" 배열 */
  dataComplete: boolean[];
  /** true면 처음부터 모든 단계를 "손댄 것"으로 본다(공유 링크로 들어온 경우) */
  allTouched: boolean;
  /**
   * 세션 복원용 — 이미 손댔던 단계를 그대로 복원할 때 넘긴다. 주면 allTouched는 무시하고
   * 이 배열을 그대로 초기값으로 쓴다(길이가 dataComplete와 다르면 안전하게 무시한다).
   */
  initialTouched?: boolean[];
}

export interface FlowStepsState {
  /** 지금 "현재 단계"(강조 카드)로 보여야 하는 인덱스. dataComplete.length면 전부 끝났다는 뜻 */
  activeIndex: number;
  /** 단계 전부가 끝났는지 */
  allDone: boolean;
  /** 각 단계의 "진짜" 완료 여부(touched && valid) — true면 "끝낸 단계"로 펼쳐서 보여준다 */
  completeFlags: boolean[];
  /** 각 단계를 사용자가 실제로 손댔는지 — 세션 저장용으로 그대로 내보낸다 */
  touchedFlags: boolean[];
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

export function useFlowSteps({ dataComplete, allTouched, initialTouched }: UseFlowStepsOptions): FlowStepsState {
  // 단계별 "실제로 손댔는지" — 세션 복원 값이 있고 길이가 맞으면 그걸 쓰고, 아니면 allTouched로 채운다
  const [touchedFlags, setTouchedFlags] = useState<boolean[]>(() => {
    if (initialTouched && initialTouched.length === dataComplete.length) return initialTouched;
    return dataComplete.map(() => allTouched);
  });

  /** 그 단계에서 실제로 뭔가 골랐다는 표시 — applyTouch(순수 함수)를 그대로 쓴다 */
  function touch(index: number) {
    setTouchedFlags((prev) => applyTouch(prev, index));
  }

  /** 매인 단계 값이 바뀌어 뒤 단계를 다시 골라야 할 때 — applyResetTouched(순수 함수)를 쓴다 */
  function resetTouched(indices: number[]) {
    setTouchedFlags((prev) => applyResetTouched(prev, indices));
  }

  const { completeFlags, activeIndex, allDone } = deriveFlowState(dataComplete, touchedFlags);

  return {
    activeIndex,
    allDone,
    completeFlags,
    touchedFlags,
    touch,
    resetTouched,
  };
}
