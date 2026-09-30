// ──────────────────────────────────────────────
// useLastValidNumber.ts 순수 함수 시험 — 2026-09-30 지휘관 긴급 전달(중요 3 수리).
//
// 예전 판(직전 유효값을 기억)은 배송비 칸에 "20000000"을 한 글자씩 치는 동안 잠깐
// 거쳐 간 값(예: 200만원)을 그대로 계산에 써 버렸다 — 사용자가 뜻한 적 없는 값이다.
// 고친 판은 이제 순수 함수라 useRef·useState 없이 화면 없이 바로 시험할 수 있다.
//
// 여기서 확인하는 것:
//   · 범위 안 값은 그대로 돌려준다
//   · 범위 밖 값은 "직전값"이 아니라 undefined(안 넣은 것)를 돌려준다
//   · 빈 값(undefined)은 그대로 undefined
//   · 경계값(min·max) 자체는 통과한다
//
// 작성일: 2026년 09월 30일
// ──────────────────────────────────────────────

import { describe, expect, it } from 'vitest';
import { useLastValidNumber } from '../useLastValidNumber';

describe('useLastValidNumber — 범위 밖이면 "안 넣은 것"(undefined)으로 계산한다', () => {
  const MIN = 0;
  const MAX = 10_000_000; // 미장 세부 조정 금액 칸 상한(1,000만원)과 같은 값

  it('범위 안 값은 그대로 돌려준다', () => {
    expect(useLastValidNumber(500_000, MIN, MAX)).toBe(500_000);
    expect(useLastValidNumber(0, MIN, MAX)).toBe(0);
  });

  it('[검사관 재현] 범위를 넘는 값은 undefined — "치는 도중 거쳐 간 값"을 계산에 안 쓴다', () => {
    // 배송비 칸에 20000000을 치는 도중 마지막으로 유효했던 값이 200만원이었더라도,
    // 최종 값(2000만원)이 범위 밖이면 그 200만원을 계산에 쓰지 않고 undefined(0원 취급)여야 한다.
    expect(useLastValidNumber(20_000_000, MIN, MAX)).toBeUndefined();
  });

  it('직전에 유효한 값이 있었어도(호출을 여러 번 흉내 내도) 범위 밖이면 그 직전값을 되살리지 않는다', () => {
    // 예전 훅은 useRef로 "직전 유효값"을 기억해서 범위 밖일 때 그 값을 돌려줬다.
    // 새 훅은 순수 함수라 호출마다 독립적이다 — 직전 호출 결과와 무관하게 항상
    // "지금 값" 하나만 보고 판단한다는 것을 확인한다.
    const first = useLastValidNumber(2_000_000, MIN, MAX); // 범위 안 — 200만원
    expect(first).toBe(2_000_000);
    const second = useLastValidNumber(20_000_000, MIN, MAX); // 범위 밖 — 2000만원
    expect(second).toBeUndefined(); // 200만원을 대신 돌려주지 않는다
  });

  it('빈 값(undefined)은 "아직 안 넣음"이라 그대로 undefined', () => {
    expect(useLastValidNumber(undefined, MIN, MAX)).toBeUndefined();
  });

  it('경계값(min·max) 자체는 범위 안이라 통과한다', () => {
    expect(useLastValidNumber(MIN, MIN, MAX)).toBe(MIN);
    expect(useLastValidNumber(MAX, MIN, MAX)).toBe(MAX);
  });

  it('경계값을 1이라도 넘으면 undefined', () => {
    expect(useLastValidNumber(MAX + 1, MIN, MAX)).toBeUndefined();
  });
});
