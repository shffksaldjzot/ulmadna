// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 뒤로 가기 배선 훅
//
// backLayer.ts(쌓임 스택)를 실제 화면 상태(모드 선택 여부·현재 단계 번호)에 연결한다.
// 지시서 4-3절:
//   - 모드를 고르면(ModePicker → 단계 화면) 한 칸 쌓는다 → 뒤로 가기 누르면 모드 선택으로.
//   - 단계가 앞으로 넘어갈 때마다 한 칸 쌓는다 → 뒤로 가기 누르면 직전 단계가 다시 열린다
//     (reopen을 그대로 불러서 "값은 유지"한 채로 그 단계만 다시 편다).
//   - 뒤로(reopen)나 "바꾸기"로 인해 activeIndex가 줄어드는 건 쌓지 않는다(그건 이미
//     "뒤로 가는" 동작이라 새로 쌓을 이유가 없다 — 안 그러면 뒤로 가기를 누를수록 오히려
//     단계가 늘어나는 이상한 스택이 된다).
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import { pushBackLayer } from './backLayer';

export interface UseFlowBackNavOptions {
  /** 지금 모드(간단/정확)를 고른 상태인지 — false면 아직 ModePicker 화면 */
  modeChosen: boolean;
  /** 뒤로 가기로 모드 선택 화면으로 돌아갈 때 부를 함수 */
  onExitToModePicker: () => void;
  /** 지금 열려 있는 단계 번호 */
  activeIndex: number;
  /** 뒤로 가기로 직전 단계를 다시 열 때 부를 함수 */
  reopen: (index: number) => void;
}

export function useFlowBackNav({ modeChosen, onExitToModePicker, activeIndex, reopen }: UseFlowBackNavOptions): void {
  // "모드를 골랐다"는 전환이 실제로 일어난 순간에만 쌓는다(공유 링크로 들어와 처음부터
  // modeChosen이 true인 경우는 전환이 아니므로 쌓지 않는다 — 이때 뒤로 가기는 그냥 페이지를 떠난다)
  const prevModeChosenRef = useRef(modeChosen);
  useEffect(() => {
    if (modeChosen && !prevModeChosenRef.current) {
      pushBackLayer(onExitToModePicker);
    }
    prevModeChosenRef.current = modeChosen;
    // onExitToModePicker는 매 렌더 새 함수일 수 있어 deps에서 뺀다(안정적인 setState 함수라 가정)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeChosen]);

  // 단계 번호가 "앞으로" 늘어난 순간에만 쌓는다. 줄어들 때(바꾸기·뒤로 가기로 인한 되돌림)는
  // 아무것도 하지 않는다 — 그 변화 자체가 이미 "뒤로 가는" 동작이기 때문.
  const prevActiveRef = useRef(activeIndex);
  useEffect(() => {
    if (modeChosen && activeIndex > prevActiveRef.current) {
      const target = prevActiveRef.current;
      pushBackLayer(() => reopen(target));
    }
    prevActiveRef.current = activeIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, modeChosen]);
}
