// ──────────────────────────────────────────────
// v1 허브 — "범위를 벗어나면 직전 유효값을 그대로 쓴다" 공용 훅
//
// 2026-09-29 검사관 다듬기 지적 2번: 미장 세부 조정의 배송비·지게차 하차비·양중비는
// 면적·두께처럼 "필수 입력"이 아니라 안 건드려도 되는 선택 항목이다. 그래서 면적·두께
// 처럼 범위 밖일 때 가정값(assumed)으로 되돌리는 게 아니라 — 애초에 "가정"이라는 개념
// 자체가 없는 값이라 — 그냥 "직전에 사용자가 넣었던 정상 값"을 그대로 계산에 쓴다.
// 0원으로 계산하지도 않고, 가정 표시도 하지 않는다(선택 항목이므로 "가정"할 게 없다).
//
// 화면에 보이는 값(NumberField가 그리는 값)은 이 훅과 무관하게 그대로 form의 값을
// 쓴다 — 사용자가 999999999를 쳤으면 칸에는 999999999가 그대로 보인다(적은 값을
// 지우지 않는다). 이 훅이 돌려주는 값은 "계산에 실제로 넣을 값"에만 쓴다.
//
// 작성일: 2026년 09월 29일
// ──────────────────────────────────────────────

'use client';

import { useRef } from 'react';
import { isWithinRange } from './inputRanges';

/**
 * value가 [min,max] 범위 안이면 그 값을 그대로 돌려주고(직전 유효값도 그걸로 갱신),
 * 범위를 벗어나면 직전에 있었던 유효한 값을 그대로 돌려준다(0원으로 떨어지지 않는다).
 * 빈 값(undefined)은 "아직 안 넣음"이라 그 자체로 유효하다(0원 취급과 같다 — 배송비
 * 등은 안 넣으면 0원 계산이 맞다).
 */
export function useLastValidNumber(value: number | undefined, min: number, max: number): number | undefined {
  const lastValidRef = useRef<number | undefined>(value);
  const valid = isWithinRange(value, min, max);
  if (valid) {
    lastValidRef.current = value;
    return value;
  }
  return lastValidRef.current;
}
