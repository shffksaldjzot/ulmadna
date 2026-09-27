// ──────────────────────────────────────────────
// useFlowBackNav.ts의 순수 판단 함수(shouldPushForModeChosen) 시험.
// 실제 훅(useEffect 등)은 화면 도구 없이는 못 돌리지만, "언제 쌓고 언제 안 쌓는지"
// 판단은 이 함수 안에 전부 있다.
//
// 2026-09-27 형아 결정(끝낸 단계를 접지 않기) 반영 — 단계 진행은 이제 방문 기록에
// 안 쌓으므로, computeStepPushTarget(언제 단계 층을 쌓을지 판단하던 순수 함수)와
// keepOpen 관련 시험을 전부 삭제했다. 이제 여기서 시험할 판단은 모드 선택 하나뿐이다.
//
// 작성일: 2026년 09월 27일
// 단계 층 관련 시험 삭제(끝낸 단계를 접지 않는 결정 반영): 2026년 09월 27일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { shouldPushForModeChosen } from '../useFlowBackNav';

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
