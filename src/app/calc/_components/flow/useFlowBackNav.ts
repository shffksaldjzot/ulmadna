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
// 2026-09-27 배포 전 검사관 지적 3번 반영 — "원칙: 뒤로 가기 한 번 = 눈에 보이는 변화
// 한 번"을 지키려고 두 가지를 고쳤다:
//   1) 마지막 단계(keepOpen)가 "손 안 댐 → 완료"로 바뀌는 전이는 안 쌓는다. keepOpen
//      단계는 StepRow.tsx의 표시 규칙상 완료 전후로 "현재 단계 카드"인 채 그대로라
//      (배지·테두리 색만 바뀜, reopen()으로 되돌려도 complete 값 자체는 안 바뀌니 그마저
//      티가 안 남는다) — 이 칸을 뒤로 가기로 되돌려도 눈에 보이는 변화가 없었다(검사관
//      재현: "면적 완료 때 쌓는 칸은 되돌려도 보이는 변화 없음"). 이제 이 전이 자체를
//      기록에 안 쌓아서, 뒤로 가기를 누르면 그 앞의 진짜 변화(제품 단계 다시 열림)로
//      곧장 간다.
//   2) 계산기 화면이 사라질 때(언마운트) 그 계산기 몫 스택을 전부 걷어낸다
//      (clearBackLayers) — 안 그러면 모듈 전역 스택이 남아 있다가 허브로 돌아간 뒤
//      엉뚱한 시점에 팝된다(검사관 재현: "계산기 → 제목 줄 뒤로(허브) → 브라우저 뒤로로
//      복귀하면 그 뒤 무반응 뒤로가 2번").
//
// 판단 로직(어떤 전이를 쌓을지)은 React 없이 시험할 수 있게 순수 함수(shouldPushForMode·
// computeStepPushTarget)로 뺐다 — __tests__/useFlowBackNav.test.ts가 이 함수들만 부른다.
//
// 작성일: 2026년 09월 27일
// keepOpen 전이 스킵 + calcId + 언마운트 정리: 2026년 09월 27일
// ──────────────────────────────────────────────

'use client';

import { useEffect, useRef } from 'react';
import { pushBackLayer, clearBackLayers, activateCalc } from './backLayer';

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
 *   - 모드를 아직 안 골랐으면 단계 개념이 없으니 null.
 *   - 단계 번호가 줄거나 그대로면(이미 "뒤로 가는" 쪽 변화) null — 새로 쌓을 이유가 없다.
 *   - 방금 떠난 단계(prevActiveIndex)가 keepOpen이면 — 그 단계는 완료 전후로 화면이
 *     똑같아 보여서(검사관 지적 3번) 되돌려도 티가 안 난다 — null.
 *   - 그 외엔 prevActiveIndex를 되돌릴 대상으로 쌓는다(reopen(prevActiveIndex)).
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
  /** 지금 열려 있는 단계 번호 */
  activeIndex: number;
  /** 뒤로 가기로 직전 단계를 다시 열 때 부를 함수 */
  reopen: (index: number) => void;
  /** 이 인덱스가 keepOpen(마지막, 계속 펼침) 단계인지 — 검사관 지적 3번 스킵 판정에 쓴다 */
  isKeepOpen: (index: number) => boolean;
}

export function useFlowBackNav({
  calcId,
  modeChosen,
  onExitToModePicker,
  activeIndex,
  reopen,
  isKeepOpen,
}: UseFlowBackNavOptions): void {
  // onExitToModePicker는 매 렌더 새 함수일 수 있으니 ref로 최신 값을 들고 있다가,
  // backLayer.ts에는 그 ref를 참조하는 안정적인 함수 하나만 넘긴다(5번 재설계 — activateCalc는
  // calcId가 안 바뀌면 다시 안 불리므로, 안에서 부르는 콜백이 낡은 클로저가 되면 안 된다)
  const onExitToModePickerRef = useRef(onExitToModePicker);
  onExitToModePickerRef.current = onExitToModePicker;

  // (5번 재설계 핵심) 이 계산기가 "지금 화면에 떠 있다"고 backLayer.ts에 등록한다 — 이때부터만
  // popstate 처리기가 이 calcId의 짝 없는 칸을 건너뛴다. 언마운트되면(정리 함수) 등록을 뗀다
  // — 그래야 이 계산기를 떠난 뒤 다른 페이지(허브·바닥재·블로그 등)의 뒤로 가기에 전혀
  // 관여하지 않는다(배포 후 발견된 치명 회귀의 원인 중 하나 — 리스너가 영원히 안 떨어짐).
  // 다른 효과(아래 두 개)보다 먼저 선언해서, 마운트 시 리스너가 먼저 붙은 뒤에 push가 일어나게 한다.
  useEffect(() => {
    const deactivate = activateCalc(calcId, () => onExitToModePickerRef.current());
    return deactivate;
  }, [calcId]);

  // "모드를 골랐다"는 전환이 실제로 일어난 순간에만 쌓는다(공유 링크로 들어와 처음부터
  // modeChosen이 true인 경우는 전환이 아니므로 쌓지 않는다 — 이때 뒤로 가기는 그냥 페이지를 떠난다)
  const prevModeChosenRef = useRef(modeChosen);
  useEffect(() => {
    if (shouldPushForModeChosen(modeChosen, prevModeChosenRef.current)) {
      pushBackLayer(calcId, onExitToModePicker);
    }
    prevModeChosenRef.current = modeChosen;
    // onExitToModePicker는 매 렌더 새 함수일 수 있어 deps에서 뺀다(안정적인 setState 함수라 가정)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeChosen, calcId]);

  // 단계 번호가 "앞으로" 늘어난 순간에만 쌓는다(keepOpen 전이는 순수 함수가 걸러 준다)
  const prevActiveRef = useRef(activeIndex);
  useEffect(() => {
    const target = computeStepPushTarget({
      modeChosen,
      activeIndex,
      prevActiveIndex: prevActiveRef.current,
      isKeepOpen,
    });
    if (target !== null) {
      pushBackLayer(calcId, () => reopen(target));
    }
    prevActiveRef.current = activeIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, modeChosen, calcId]);

  // 이 계산기 화면이 사라질 때(다른 계산기·허브로 이동 등) 이 계산기 몫 스택을 전부 걷어낸다
  // — 안 그러면 모듈 전역 스택에 낡은 되돌리기가 남아서 나중에 엉뚱하게 실행된다(검사관 지적 3번)
  useEffect(() => {
    return () => {
      clearBackLayers(calcId);
    };
  }, [calcId]);
}
