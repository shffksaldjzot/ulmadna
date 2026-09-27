// ──────────────────────────────────────────────
// v1 허브 — 계산기 "단계 흐름 2판" 뒤로·앞으로 가기 배선 훅
//
// backLayer.ts(쌓임 스택)를 실제 화면 상태(모드 선택 여부)에 연결한다. 지시서 4-3절:
//   - 모드를 고르면(ModePicker → 단계 화면) 한 칸 쌓는다 → 뒤로 가기 누르면 모드 선택으로,
//     앞으로 가기 누르면 다시 그 모드 화면으로.
//
// 2026-09-27 형아 결정(끝낸 단계를 접지 않기) 반영 — **단계 진행은 이제 방문 기록에
// 안 쌓는다.** 예전엔 단계가 넘어갈 때마다 한 칸 쌓아서 "뒤로 = 직전 단계 다시 열기"를
// 만들었는데, 이제 단계가 접히지 않으므로(전부 펼쳐진 채 유지) 그 "다시 열기"는 눈에
// 보이는 변화가 없다 — 그래서 단계용 층(되돌리기·다시 하기)·억제 표시
// (suppressStepPushRef)·"도달했던 위치 기억"(reachedIndex) 등 단계 전용 코드를 전부
// 걷어냈다(computeStepPushTarget 순수 함수도 같이 삭제). 기록에 쌓는 것은 이제 두
// 가지뿐이다 — 모드 선택(이 파일)과 제품 시트(ProductSheet.tsx가 따로 쌓는다).
//
// 2026-09-27 검사관 4차 지적(앞으로 가기 지원) 때 넣은 억제 표시(suppressModePushRef)는
// 그대로 남아 있다 — "다시 하기"(onReenterMode)로 modeChosen을 true로 만든 게 "사용자가
// 방금 모드를 고른 것"으로 오인돼 새 칸이 또 쌓이는 걸 막는다.
//
// 2026-09-27 검사관 6차 지적 — 억제 표시가 "다음 한 번의 감지"에서 못 쓰이고 남을 수
// 있다는 의심(재현은 안 됨): onReenterMode가 modeChosen을 이미 true인 상태에서 다시
// true로 세팅하면(짝 없는 칸 구역에서 앞으로를 여러 번 눌러도 계속 true→true) 값이
// 안 바뀌므로 React가 이 효과를 아예 다시 안 돌려서 표시가 계속 true로 남을 수 있다.
// 이 표시가 나중에 진짜 "뒤로 가서 모드 카드로"(onExitToModePicker) 전이가 왔을 때
// 소비되긴 하지만(그 전이도 이 효과를 태우므로), 혹시라도 그사이 진짜 push가 필요한
// 전이를 건너뛰지 않도록, onExitToModePicker 쪽에서도 억제 표시를 확실히 꺼 둔다(그
// 방향은 애초에 push 조건 자체를 안 타므로 여기서 꺼도 안전하다) — "쓰이지 않았어도
// 같은 처리 끝에서 반드시 풀리게" 만드는 안전장치.
//
// 판단 로직(언제 쌓을지)은 React 없이 시험할 수 있게 순수 함수(shouldPushForModeChosen)로
// 뺐다 — __tests__/useFlowBackNav.test.ts가 이 함수만 부른다.
//
// 작성일: 2026년 09월 27일
// keepOpen 전이 스킵 + calcId + 언마운트 정리: 2026년 09월 27일
// 주소 비교 폐기 + activateCalc 배선(치명 회귀 수리): 2026년 09월 27일
// 앞으로 가기 지원(onForward·onForwardPastStart 배선 + 억제 표시로 재귀 push 방지): 2026년 09월 27일
// 끝낸 단계를 접지 않는 결정 반영(단계 층 전부 삭제) + 억제 표시 안전장치: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import { pushBackLayer, activateCalc } from './backLayer';

/** 모드(간단/정확)를 고르는 전환이 방금 일어났는지 — 쌓을지 말지 판정하는 순수 함수 */
export function shouldPushForModeChosen(modeChosen: boolean, prevModeChosen: boolean): boolean {
  return modeChosen && !prevModeChosen;
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
}

export function useFlowBackNav({ calcId, modeChosen, onExitToModePicker, onReenterMode }: UseFlowBackNavOptions): void {
  // 콜백들은 매 렌더 새 함수일 수 있으니 ref로 최신 값을 들고 있다가, backLayer.ts에는
  // 그 ref를 참조하는 안정적인 함수만 넘긴다(activateCalc는 calcId가 안 바뀌면 다시 안
  // 불리므로, 안에서 부르는 콜백이 낡은 클로저가 되면 안 된다)
  const onExitToModePickerRef = useRef(onExitToModePicker);
  onExitToModePickerRef.current = onExitToModePicker;
  const onReenterModeRef = useRef(onReenterMode);
  onReenterModeRef.current = onReenterMode;

  // "앞으로 가기(다시 하기)가 지금 막 modeChosen을 true로 바꿨다"는 표시 — 이 값이 true인
  // 동안엔 바로 아래 감지 효과가 "사용자가 방금 모드를 고른 것"으로 보지 않고 지나간다.
  const suppressModePushRef = useRef(false);

  // 이 계산기가 "지금 화면에 떠 있다"고 backLayer.ts에 등록한다 — 이때부터만 popstate
  // 처리기가 이 calcId의 짝 없는 칸을 건너뛰거나 방향을 판단한다. 언마운트되면(정리 함수)
  // 등록을 뗀다 — 그래야 이 계산기를 떠난 뒤 다른 페이지의 뒤로·앞으로 가기에 전혀
  // 관여하지 않는다. 다른 효과(아래)보다 먼저 선언해서, 마운트 시 리스너가 먼저 붙은 뒤에
  // push가 일어나게 한다.
  useEffect(() => {
    const deactivate = activateCalc(
      calcId,
      () => {
        // 6차 지적 안전장치 — 뒤로 가서 모드 카드로 돌아갈 때마다 억제 표시를 확실히
        // 꺼 둔다(false→true 방향만 push 조건을 타므로 여기서 꺼도 안전하다).
        suppressModePushRef.current = false;
        onExitToModePickerRef.current();
      },
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
}
