// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 뒤로·앞으로 가기 배선 훅
//
// backLayer.ts(쌓임 스택)를 실제 화면 상태(모드 선택 여부·현재 단계 번호)에 연결한다.
// 지시서 4-3절:
//   - 모드를 고르면(ModePicker → 단계 화면) 한 칸 쌓는다 → 뒤로 가기 누르면 모드 선택으로,
//     앞으로 가기 누르면 다시 그 모드 화면으로.
//   - 단계가 앞으로 넘어갈 때마다 한 칸 쌓는다 → 뒤로 가기 누르면 직전 단계가 다시 열린다
//     (reopen을 그대로 불러서 "값은 유지"한 채로 그 단계만 다시 편다). 앞으로 가기 누르면
//     그 전이가 도달했던 바로 그 단계로 다시 연다(reopen(그때의 activeIndex)).
//   - 뒤로(reopen)나 "바꾸기"로 인해 activeIndex가 줄어드는 건 쌓지 않는다.
//
// 2026-09-27 배포 전 검사관 지적 3번 반영(keepOpen 전이 스킵 + calcId + 언마운트 정리)에
// 이어, 배포 후 발견된 치명 회귀(주소 비교 폐기 + activateCalc 마운트/언마운트 배선)까지
// 반영돼 있던 판이다.
//
// 2026-09-27 검사관 4차 지적 — **앞으로 가기 지원 추가**. 실기기 검증 중 두 가지를 더 고쳤다:
//   1) 처음엔 "다시 하기"를 advance()(강제 열림을 완전히 풀어 자연 진행 상태로)로 배선했다.
//      그런데 3단계를 완료한 뒤 두 번 물러났다가 한 번만 앞으로 가면, 자연 진행 상태가
//      "이미 다 끝난 상태"라서 override를 그냥 풀어 버리면 중간 단계("제품 단계가 열린
//      상태")를 건너뛰고 곧장 "3단계 완료"로 튀어 버렸다(실기기 재현: 앞으로 1번 만에
//      끝까지 감). 고침: advance() 대신, 그 전이가 "도달했던 바로 그 activeIndex"를
//      기억해 뒀다가 reopen(그 값)으로 정확히 그 자리로만 한 칸 되돌린다.
//   2) 이 reopen()이 activeIndex를 "늘리는" 방향이라, 바로 아래 있는 "단계가 앞으로 늘면
//      쌓는다"는 감지 효과가 이걸 "사용자가 방금 진행한 것"으로 오인해서 새 칸을 또
//      쌓아버렸다(모드를 다시 고르는 onReenterMode도 마찬가지로 modeChosen을 true로
//      만들어 같은 사고를 냈다). 억제 표시(suppressXxxPushRef)를 세워 뒀다가 그 감지
//      효과가 한 번 보고 끄게 해서, "앞으로 가기가 만든 변화"는 새로 안 쌓는다.
//
// 판단 로직(어떤 전이를 쌓을지)은 React 없이 시험할 수 있게 순수 함수(shouldPushForMode·
// computeStepPushTarget)로 뺐다 — __tests__/useFlowBackNav.test.ts가 이 함수들만 부른다.
//
// 작성일: 2026년 09월 27일
// keepOpen 전이 스킵 + calcId + 언마운트 정리: 2026년 09월 27일
// 주소 비교 폐기 + activateCalc 배선(치명 회귀 수리): 2026년 09월 27일
// 앞으로 가기 지원(onForward·onForwardPastStart 배선 + 억제 표시로 재귀 push 방지): 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import { pushBackLayer, activateCalc } from './backLayer';

/** 모드(간단/정확)를 고르는 전환이 방금 일어났는지 — 쌓을지 말지 판정하는 순수 함수 */
export function shouldPushForModeChosen(modeChosen: boolean, prevModeChosen: boolean): boolean {
  return modeChosen && !prevModeChosen;
}

export interface ComputeStepPushTargetParams {
  /** 지금 모드가 이미 골라진 상태인지 — 아니면(ModePicker 화면) 단계 자체가 없으니 안 쌓는다 */
  modeChosen: boolean;
  /** 지금 활성 단계 번호 */
  activeIndex: number;
  /** 바로 전 렌더의 활성 단계 번호 */
  prevActiveIndex: number;
  /** 그 인덱스가 keepOpen(계속 펼쳐 두는 마지막) 단계인지 알려주는 함수 */
  isKeepOpen: (index: number) => boolean;
}

/**
 * 단계 번호가 늘어났을 때 "뒤로 가기 기록에 쌓을지, 쌓는다면 되돌릴 인덱스가 몇인지"를
 * 정하는 순수 함수. 쌓지 않아도 되면 null.
 */
export function computeStepPushTarget({
  modeChosen,
  activeIndex,
  prevActiveIndex,
  isKeepOpen,
}: ComputeStepPushTargetParams): number | null {
  if (!modeChosen) return null;
  if (activeIndex <= prevActiveIndex) return null;
  if (isKeepOpen(prevActiveIndex)) return null;
  return prevActiveIndex;
}

export interface UseFlowBackNavOptions {
  /** 이 계산기를 구분하는 값(예: 'wallpaper') — 언마운트 때 자기 몫 스택만 걷어가는 데 쓴다 */
  calcId: string;
  /** 지금 모드(간단/정확)를 고른 상태인지 — false면 아직 ModePicker 화면 */
  modeChosen: boolean;
  /** 뒤로 가기로 모드 선택 화면으로 돌아갈 때 부를 함수 */
  onExitToModePicker: () => void;
  /**
   * 앞으로 가기로 "모드를 다시 고른 것"처럼 되돌릴 때 부를 함수 — onExitToModePicker의
   * 정반대(같은 토글을 다시 켠다). 모드 선택 칸의 "다시 하기"에도 이 함수를 그대로 쓴다.
   */
  onReenterMode: () => void;
  /** 지금 열려 있는 단계 번호 */
  activeIndex: number;
  /** 뒤로 가기로 직전 단계를 다시 열 때(또는 앞으로 가기로 그 자리에 다시 돌아갈 때) 부를 함수 */
  reopen: (index: number) => void;
  /** 이 인덱스가 keepOpen(마지막, 계속 펼침) 단계인지 — 검사관 지적 3번 스킵 판정에 쓴다 */
  isKeepOpen: (index: number) => boolean;
}

export function useFlowBackNav({
  calcId,
  modeChosen,
  onExitToModePicker,
  onReenterMode,
  activeIndex,
  reopen,
  isKeepOpen,
}: UseFlowBackNavOptions): void {
  // 콜백들은 매 렌더 새 함수일 수 있으니 ref로 최신 값을 들고 있다가, backLayer.ts에는
  // 그 ref를 참조하는 안정적인 함수만 넘긴다(activateCalc는 calcId가 안 바뀌면 다시 안
  // 불리므로, 안에서 부르는 콜백이 낡은 클로저가 되면 안 된다)
  const onExitToModePickerRef = useRef(onExitToModePicker);
  onExitToModePickerRef.current = onExitToModePicker;
  const onReenterModeRef = useRef(onReenterMode);
  onReenterModeRef.current = onReenterMode;
  const reopenRef = useRef(reopen);
  reopenRef.current = reopen;

  // "앞으로 가기(다시 하기) 콜백이 지금 막 activeIndex나 modeChosen을 바꿨다"는 표시.
  // 이 값이 true인 동안엔 바로 아래 두 감지 효과가 "새로 쌓을 대상"으로 보지 않고 그냥
  // 지나간다 — 안 그러면 앞으로 가기 자체가 "사용자가 방금 새로 진행한 것"으로 오인돼
  // 엉뚱한 새 칸이 쌓이는 사고가 난다(위 2번 설명 참고).
  const suppressModePushRef = useRef(false);
  const suppressStepPushRef = useRef(false);

  // 이 계산기가 "지금 화면에 떠 있다"고 backLayer.ts에 등록한다 — 이때부터만 popstate
  // 처리기가 이 calcId의 짝 없는 칸을 건너뛰거나 방향을 판단한다. 언마운트되면(정리 함수)
  // 등록을 뗀다 — 그래야 이 계산기를 떠난 뒤 다른 페이지의 뒤로·앞으로 가기에 전혀
  // 관여하지 않는다. 다른 효과(아래)보다 먼저 선언해서, 마운트 시 리스너가 먼저 붙은 뒤에
  // push가 일어나게 한다.
  useEffect(() => {
    const deactivate = activateCalc(
      calcId,
      () => onExitToModePickerRef.current(),
      () => {
        // 짝 없는 칸으로 앞으로 가서 멈출 때도 modeChosen이 true로 바뀌므로 똑같이 억제한다
        suppressModePushRef.current = true;
        onReenterModeRef.current();
      },
    );
    return deactivate;
  }, [calcId]);

  // "모드를 골랐다"는 전환이 실제로 일어난 순간에만 쌓는다(공유 링크로 들어와 처음부터
  // modeChosen이 true인 경우는 전환이 아니므로 쌓지 않는다 — 이때 뒤로 가기는 그냥 페이지를 떠난다)
  const prevModeChosenRef = useRef(modeChosen);
  useEffect(() => {
    if (suppressModePushRef.current) {
      // 앞으로 가기가 만든 변화 — 새로 쌓지 않고 그냥 지나간다
      suppressModePushRef.current = false;
      prevModeChosenRef.current = modeChosen;
      return;
    }
    if (shouldPushForModeChosen(modeChosen, prevModeChosenRef.current)) {
      // 되돌리기 = 모드 카드로. 다시 하기 = 골랐던 모드 화면으로(같은 토글을 다시 켠다) —
      // 이 다시 하기가 다시 이 효과를 태울 때도 위 suppressModePushRef로 걸러진다
      pushBackLayer(calcId, onExitToModePicker, () => {
        suppressModePushRef.current = true;
        onReenterMode();
      });
    }
    prevModeChosenRef.current = modeChosen;
    // 콜백들은 매 렌더 새 함수일 수 있어 deps에서 뺀다(안정적인 setState 함수라 가정)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeChosen, calcId]);

  // 단계 번호가 "앞으로" 늘어난 순간에만 쌓는다(keepOpen 전이는 순수 함수가 걸러 준다)
  const prevActiveRef = useRef(activeIndex);
  useEffect(() => {
    if (suppressStepPushRef.current) {
      // 앞으로 가기가 만든 변화 — 새로 쌓지 않고 그냥 지나간다
      suppressStepPushRef.current = false;
      prevActiveRef.current = activeIndex;
      return;
    }
    const target = computeStepPushTarget({
      modeChosen,
      activeIndex,
      prevActiveIndex: prevActiveRef.current,
      isKeepOpen,
    });
    if (target !== null) {
      // 이 전이가 "도달한" activeIndex를 그대로 기억해 둔다 — 다시 하기(앞으로 가기)는
      // 정확히 그 자리로만 돌아가야 한다(강제 열림을 통째로 풀어 자연 진행 상태를 그냥
      // 드러내면, 이미 더 뒤로 간 상태에서는 중간 단계를 건너뛰고 곧장 끝까지 튀어버린다
      // — 위 1번 설명 참고).
      const reachedIndex = activeIndex;
      pushBackLayer(
        calcId,
        () => reopenRef.current(target),
        () => {
          suppressStepPushRef.current = true;
          reopenRef.current(reachedIndex);
        },
      );
    }
    prevActiveRef.current = activeIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, modeChosen, calcId]);
}
