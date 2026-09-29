// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 단계 상태 훅
//
// 옛 useStepFlow.ts(바닥재·미장이 아직 씀)와 하는 일은 같다 — "이 단계 값이 유효한지"
// 배열만 받아서 "지금 몇 번째를 현재 단계로 열어 둘지"를 계산해 준다. 이 새 버전은
// 2026-09-27 지시서를 따르려고 두 가지를 더한다:
//
//   1) touchedMap을 밖으로도 내보낸다 — 새로 고침 복원(sessionStorage)에 "어느 단계까지
//      실제로 손댔는지"를 같이 저장해야 하기 때문(옛 훅은 이 값을 안 내보냈다).
//   2) 초기 touched 값을 밖에서 주입할 수 있다(initialTouched) — 새로 고침 복원 시
//      "이미 손댔던 단계"를 그대로 살려서 시작하기 위해서다.
//
// 2026-09-27 배포 전 검사관 지적 5번 반영 — "매인 관계" 되돌리기 추가:
//   벽지 종류(paperType)를 바꾸면 제품(product)도 다시 골라야 하는데, 예전엔 "손댔다"는
//   표시가 그대로 남아서 제품 단계가 저절로 완료 처리(잘못된 값 "제품 미정"으로) 돼
//   버렸다. resetTouched(keys)를 새로 내보내서, 매인 단계 값이 바뀔 때 그 뒤 단계의
//   손댐 표시를 되돌릴 수 있게 했다.
//
// 2026-09-27 형아 결정(끝낸 단계를 접지 않기) 반영 — "바꾸기로 강제로 다시 연다"는
// 개념 자체가 없어졌다. activeIndex는 순수하게 touched·valid에서만 나온다(맨 앞부터
// 봐서 처음으로 안 끝난 단계).
//
// 2026-09-29 지휘관 전달 — 세 계산기 공통 결함 수리(검사관 발견): "손댐 표시를 자리
// 번호(index)가 아니라 단계의 정체(key)로 묶는다."
//   [문제] 예전엔 touchedFlags가 순전히 "몇 번째 자리인지"로만 손댐을 기록했다. 그런데
//   도배·바닥재의 3번째 단계는 간단 모드에선 "면적", 정확 모드에선 "실측"으로 서로
//   다른 뜻인데 같은 자리(index 2)를 썼다(미장은 2번째 자리가 "면적"/"구역"). 그래서
//   정확 모드를 끝까지 하고 간단 모드로 돌아오면, 정확 모드에서 손댄 자리(2번)가 그대로
//   남아 있어서 간단 모드의 면적 단계도 "손댔다"고 잘못 판정됐다 — 사용자가 실제로는
//   간단 모드의 면적 칩을 누른 적이 없는데도 폼 기본값(34평)으로 "완료"가 되고,
//   가정 표시 없이 결과 공유 버튼까지 보이는 사고였다(기본값은 완료로 치지 않는다는
//   원칙 위반).
//   [해법] touchedMap을 배열이 아니라 "단계 이름(key) → 손댔는지" 사전(Record)으로
//   바꿨다. 모드가 달라도 같은 뜻인 단계(벽지 종류·제품, 용도, 두께 등)는 같은 key를
//   쓰게 해서 손댐 기록이 모드를 넘나들며 그대로 이어지고, 모드마다 뜻이 다른 단계
//   (간단 "면적" vs 정확 "실측"/"구역")는 서로 다른 key를 쓰게 해서 한쪽을 손대도
//   다른 쪽 key는 전혀 건드리지 않는다 — 계산기 파일에서 모드 전환마다 손으로 되돌리는
//   땜질 없이, 이 훅 하나가 자연스럽게 두 모드를 독립적으로 추적한다.
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
// 손댐 표시를 자리 번호에서 단계 이름(key)로 바꿈(모드 전환 오판정 수리): 2026년 09월 29일
// ──────────────────────────────────────────────

'use client';

import { useState } from 'react';

/** 단계 하나의 "완료 판정용" 최소 정보 — 화면 내용(content)은 필요 없다 */
export interface FlowStepValidity {
  /** 단계 고유 이름. 모드가 달라도 같은 뜻이면 같은 key, 다른 뜻이면 다른 key를 쓴다 */
  key: string;
  /** 지금 폼 값이 이 단계 기준으로 유효한지(손댔는지와 별개, 순수 값 검증) */
  valid: boolean;
}

export interface UseFlowStepsOptions {
  /** 지금 화면에 보이는 단계들 — 순서·key가 FlowShell에 넘기는 steps 배열과 같아야 한다 */
  steps: FlowStepValidity[];
  /** true면 지금 보이는 단계들을 전부 "손댄 것"으로 본다(공유 링크로 들어온 경우) */
  allTouched: boolean;
  /**
   * 세션 복원용 — 이미 손댔던 단계들을 이름(key) 기준으로 그대로 복원할 때 넘긴다.
   * 주면 allTouched는 무시하고 이 사전을 그대로 초기값으로 쓴다. 여기 없는 key는
   * "아직 손 안 댐"으로 본다 — 모드를 아직 한 번도 열어 본 적 없는 단계가 이런 경우다.
   */
  initialTouched?: Record<string, boolean>;
}

export interface FlowStepsState {
  /** 지금 "현재 단계"(강조 카드)로 보여야 하는 인덱스. steps.length면 전부 끝났다는 뜻 */
  activeIndex: number;
  /** 단계 전부가 끝났는지 */
  allDone: boolean;
  /** steps와 같은 순서의 "진짜" 완료 여부(touched && valid) — true면 "끝낸 단계"로 펼쳐서 보여준다 */
  completeFlags: boolean[];
  /**
   * 단계 이름(key)별 손댐 기록 전체 — 지금 화면에 안 보이는(다른 모드) 단계의 몫도
   * 그대로 남아 있다. 세션 저장은 이 값을 통째로 쓴다(모드를 넘나든 기록이 사라지지
   * 않게). 계산 담당 훅에 넘기는 touched.area 같은 값도 여기서 `touchedMap['area']`처럼
   * 직접 꺼내 쓴다 — 반드시 "그 모드 자신의" key로 꺼내야 이번 수리가 뜻이 있다.
   */
  touchedMap: Record<string, boolean>;
  /** 이 단계(key)에서 실제로 뭔가 손댔다는 표시. 각 입력 핸들러 안에서 불러 준다 */
  touch: (key: string) => void;
  /**
   * "매인 관계" 되돌리기 — 앞 단계 값이 실제로 바뀌어서 뒤 단계를 다시 골라야 할 때,
   * 그 뒤 단계들(이름 기준)의 손댐 표시를 지운다(=다시 "현재 단계"로 열린다). 값 자체
   * (폼 상태)는 이 훅이 모르므로 안 건드린다 — 부르는 쪽이 폼 값도 같이 지워야 한다.
   */
  resetTouched: (keys: string[]) => void;
}

/**
 * 손댐 사전에 key 하나를 true로 표시한다(순수 함수). 이미 true면 같은 참조를 그대로
 * 돌려줘서 불필요한 리렌더를 막는다.
 */
export function applyTouch(touchedMap: Record<string, boolean>, key: string): Record<string, boolean> {
  if (touchedMap[key]) return touchedMap;
  return { ...touchedMap, [key]: true };
}

/** 손댐 사전에서 여러 key를 한 번에 지운다(순수 함수, 매인 관계 되돌리기) */
export function applyResetTouched(touchedMap: Record<string, boolean>, keys: string[]): Record<string, boolean> {
  if (keys.length === 0) return touchedMap;
  let changed = false;
  const next = { ...touchedMap };
  for (const k of keys) {
    if (next[k]) {
      delete next[k];
      changed = true;
    }
  }
  return changed ? next : touchedMap;
}

/**
 * "지금 값이 유효한지"(steps[i].valid) + "실제로 손댔는지"(touchedMap[steps[i].key])만
 * 보고 완료 여부·현재 단계·전부 끝났는지를 계산하는 순수 함수. React를 전혀 안 써서
 * 화면 없이(vitest) 그대로 시험할 수 있다.
 */
export function deriveFlowState(
  steps: FlowStepValidity[],
  touchedMap: Record<string, boolean>,
): { completeFlags: boolean[]; activeIndex: number; allDone: boolean } {
  // 진짜 완료 = 손댔고(touched) + 값도 유효함(valid) 둘 다일 때만
  const completeFlags = steps.map((s) => (touchedMap[s.key] ?? false) && s.valid);
  // 맨 앞부터 봐서 처음으로 안 끝난 단계 — 없으면(전부 끝) 배열 길이
  const firstIncomplete = completeFlags.findIndex((done) => !done);
  const activeIndex = firstIncomplete === -1 ? completeFlags.length : firstIncomplete;
  return { completeFlags, activeIndex, allDone: activeIndex === completeFlags.length };
}

export function useFlowSteps({ steps, allTouched, initialTouched }: UseFlowStepsOptions): FlowStepsState {
  // 단계 이름(key)별 "실제로 손댔는지" — 세션 복원 값이 있으면 그걸 그대로 쓰고, 없으면
  // allTouched 여부에 따라 지금 보이는 단계들을 전부 채우거나(공유 링크) 빈 사전으로 시작한다.
  const [touchedMap, setTouchedMap] = useState<Record<string, boolean>>(() => {
    if (initialTouched) return initialTouched;
    if (!allTouched) return {};
    const init: Record<string, boolean> = {};
    for (const s of steps) init[s.key] = true;
    return init;
  });

  /** 그 단계에서 실제로 뭔가 골랐다는 표시 — applyTouch(순수 함수)를 그대로 쓴다 */
  function touch(key: string) {
    setTouchedMap((prev) => applyTouch(prev, key));
  }

  /** 매인 단계 값이 바뀌어 뒤 단계를 다시 골라야 할 때 — applyResetTouched(순수 함수)를 쓴다 */
  function resetTouched(keys: string[]) {
    setTouchedMap((prev) => applyResetTouched(prev, keys));
  }

  const { completeFlags, activeIndex, allDone } = deriveFlowState(steps, touchedMap);

  return {
    activeIndex,
    allDone,
    completeFlags,
    touchedMap,
    touch,
    resetTouched,
  };
}
