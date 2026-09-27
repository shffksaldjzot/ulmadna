// ──────────────────────────────────────────────
// useFlowBackNav.ts의 순수 판단 함수(shouldPushForModeChosen·computeStepPushTarget) 시험.
// 실제 훅(useEffect 등)은 화면 도구 없이는 못 돌리지만, "언제 쌓고 언제 안 쌓는지"
// 판단은 이 두 순수 함수 안에 전부 있다.
//
// 2026-09-27 배포 전 검사관 지적 3번 재현 시험:
//   "누를 때 아무 반응 없는 뒤로 가기가 쌓인다" — 원인 중 하나가 마지막(keepOpen) 단계가
//   "손 안 댐 → 완료"로 바뀌는 전이까지 기록에 쌓았던 것이었다. 이 전이는 되돌려도(reopen)
//   화면이 똑같아 보여서(keepOpen 단계는 완료 전후로 카드가 계속 펼쳐져 있다) 뒤로 가기를
//   눌러도 아무 변화가 없었다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { computeStepPushTarget, shouldPushForModeChosen } from '../useFlowBackNav';

describe('shouldPushForModeChosen', () => {
  it('모드를 처음 고른 전환에서만 true(false→true)', () => {
    expect(shouldPushForModeChosen(true, false)).toBe(true);
  });

  it('공유 링크처럼 처음부터 true였으면(전환이 아님) false', () => {
    expect(shouldPushForModeChosen(true, true)).toBe(false);
  });

  it('모드가 아직 false면 false', () => {
    expect(shouldPushForModeChosen(false, false)).toBe(false);
  });
});

describe('computeStepPushTarget', () => {
  const noKeepOpen = () => false;

  it('아직 모드를 안 골랐으면(단계 개념이 없으면) null', () => {
    const target = computeStepPushTarget({ modeChosen: false, activeIndex: 1, prevActiveIndex: 0, isKeepOpen: noKeepOpen });
    expect(target).toBeNull();
  });

  it('단계 번호가 줄거나 그대로면(이미 뒤로 가는 변화) null', () => {
    expect(computeStepPushTarget({ modeChosen: true, activeIndex: 0, prevActiveIndex: 1, isKeepOpen: noKeepOpen })).toBeNull();
    expect(computeStepPushTarget({ modeChosen: true, activeIndex: 1, prevActiveIndex: 1, isKeepOpen: noKeepOpen })).toBeNull();
  });

  it('단계가 앞으로(늘어남) 나아가면 직전 인덱스를 되돌릴 대상으로 준다', () => {
    const target = computeStepPushTarget({ modeChosen: true, activeIndex: 1, prevActiveIndex: 0, isKeepOpen: noKeepOpen });
    expect(target).toBe(0);
  });

  it(
    '[검사관 지적 3번 재현] 방금 떠난 단계가 keepOpen(마지막, 계속 펼침)이면 쌓지 않는다 — ' +
      '그 전이는 되돌려도 화면이 똑같아 보여 "무반응 뒤로 가기"가 되기 때문',
    () => {
      // 도배 계산기: 0=종류, 1=제품, 2=면적(keepOpen). 2번이 "손 안 댐 → 완료"로 바뀌는 순간
      // activeIndex가 2→3(steps.length)으로 늘어난다 — 이때 isKeepOpen(2)가 true다.
      const isKeepOpenAt2 = (i: number) => i === 2;
      const target = computeStepPushTarget({
        modeChosen: true,
        activeIndex: 3,
        prevActiveIndex: 2,
        isKeepOpen: isKeepOpenAt2,
      });
      expect(target).toBeNull();
    },
  );

  it('keepOpen이 아닌 일반 단계가 늘어나는 경우는 평소처럼 쌓는다', () => {
    const isKeepOpenAt2 = (i: number) => i === 2;
    // 1(제품) → 2(면적)로 넘어가는 전이는 keepOpen 여부와 무관(이건 "면적 단계로 처음 들어가는"
    // 전이라 prevActiveIndex=1이 keepOpen이 아니므로 정상적으로 쌓여야 한다)
    const target = computeStepPushTarget({ modeChosen: true, activeIndex: 2, prevActiveIndex: 1, isKeepOpen: isKeepOpenAt2 });
    expect(target).toBe(1);
  });
});
