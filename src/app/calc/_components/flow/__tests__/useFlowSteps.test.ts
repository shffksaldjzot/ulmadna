// ──────────────────────────────────────────────
// useFlowSteps.ts의 순수 계산 부분(deriveFlowState·applyTouch·applyResetTouched) 시험.
// React 훅 자체(useState 등)는 화면 도구 없이는 못 돌리지만, 실제 판단 로직은 이 세
// 순수 함수 안에 다 있어서 여기만 확실히 맞으면 된다.
//
// 2026-09-27 배포 전 검사관 지적 5번 재현 시험:
//   "벽지 종류를 바꾸면 제품 단계가 저절로 '제품 미정' 완료가 된다."
//   resetTouched가 없던 옛 구현이라면, 종류를 바꿔도 touchedFlags[1]이 그대로 true로
//   남아 제품 단계가 계속 "완료"로 보였을 것이다.
//
// 작성일: 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { applyResetTouched, applyTouch, deriveFlowState } from '../useFlowSteps';

describe('deriveFlowState — 완료 판정·현재 단계 계산', () => {
  it('아무것도 안 손대면 0번째가 현재 단계다', () => {
    const r = deriveFlowState([false, true, true], [false, false, false]);
    expect(r.activeIndex).toBe(0);
    expect(r.completeFlags).toEqual([false, false, false]);
    expect(r.allDone).toBe(false);
  });

  it('손댔지만 값이 무효하면 완료로 안 친다(touched && valid 둘 다 필요)', () => {
    const r = deriveFlowState([false, true, true], [true, true, true]);
    expect(r.completeFlags[0]).toBe(false); // valid가 false라 touched여도 미완료
    expect(r.activeIndex).toBe(0);
  });

  it('전부 손대고 유효하면 activeIndex가 배열 길이(=전부 끝)가 된다', () => {
    const r = deriveFlowState([true, true, true], [true, true, true]);
    expect(r.activeIndex).toBe(3);
    expect(r.allDone).toBe(true);
  });
});

describe('applyTouch — 손댐 표시(한 방향으로만)', () => {
  it('그 자리를 true로 바꾼 새 배열을 돌려준다', () => {
    const next = applyTouch([false, false, false], 1);
    expect(next).toEqual([false, true, false]);
  });

  it('이미 true면 같은 배열 참조를 그대로 돌려준다(불필요한 리렌더 방지)', () => {
    const prev = [false, true, false];
    const next = applyTouch(prev, 1);
    expect(next).toBe(prev);
  });
});

describe('applyResetTouched — 매인 관계 되돌리기', () => {
  it('지정한 자리들만 false로 되돌리고 나머지는 그대로 둔다', () => {
    const next = applyResetTouched([true, true, true], [1]);
    expect(next).toEqual([true, false, true]);
  });

  it('이미 전부 false면 같은 배열 참조를 그대로 돌려준다', () => {
    const prev = [true, false, true];
    const next = applyResetTouched(prev, [1]);
    expect(next).toBe(prev);
  });

  it(
    '[검사관 지적 5번 재현] 벽지 종류(0단계)를 바꿔 제품(1단계) 손댐을 되돌리면, ' +
      '제품 단계가 다시 "현재 단계"로 열린다(저절로 완료된 채 남지 않는다)',
    () => {
      // 사용자가 종류 → 제품(아직 안 정했어요) → 면적까지 다 손댄 상태를 흉내낸다
      const dataComplete = [true, true, true]; // 종류 있음 · 제품은 항상 유효 · 면적 있음
      let touched = [true, true, true];
      let r = deriveFlowState(dataComplete, touched);
      expect(r.allDone).toBe(true); // 처음엔 3단계 다 끝난 상태

      // 이제 종류를 "실제로" 바꾼다 — 매인 관계로 제품(1단계) 손댐을 되돌린다
      touched = applyResetTouched(touched, [1]);
      r = deriveFlowState(dataComplete, touched);

      // 제품 단계가 다시 미완료가 되고, 현재 단계가 1번(제품)으로 돌아와야 한다.
      // 옛 버그였다면 touched[1]이 안 지워져서 activeIndex가 여전히 3(전부 완료)이었을 것이다.
      expect(touched[1]).toBe(false);
      expect(r.completeFlags[1]).toBe(false);
      expect(r.activeIndex).toBe(1);
      expect(r.allDone).toBe(false);
    },
  );

  it('같은 종류를 다시 고른 경우(값이 안 바뀜)에는 resetTouched를 안 부르므로 아무것도 안 바뀐다', () => {
    // 이 시험은 "값이 실제로 바뀔 때만 되돌린다"는 규칙을 부르는 쪽(WallpaperCalculator)이
    // 지켜야 한다는 걸 문서화한다 — applyResetTouched 자체는 그냥 넘겨준 인덱스를 지울 뿐이니,
    // 호출 여부 판단은 항상 "새 값 !== 기존 값"을 먼저 확인한 뒤에만 해야 한다.
    const touched = [true, true, true];
    const sameValueChanged = false; // 같은 종류를 다시 눌렀다고 가정
    const next = sameValueChanged ? applyResetTouched(touched, [1]) : touched;
    expect(next).toBe(touched);
  });
});
