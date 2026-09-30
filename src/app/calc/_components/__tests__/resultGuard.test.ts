// ──────────────────────────────────────────────
// v1 허브 — 결과 화면 모양 검사(resultGuard) 테스트
//
// 2026-09-30 결함 수리(경미 결함 2번) — 공유 링크(?d=)를 조작해 preciseRooms 같은
// 배열 칸에 문자열·숫자·객체를 넣으면 결과 화면이 500이 나던 사고를 막는 함수들이다.
// 화면 없이(렌더 없이) 순수 함수만으로 "이상한 모양을 골라내는지"를 확인한다.
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { isArrayFieldOk, safeCalc } from '../resultGuard';

describe('isArrayFieldOk — 배열이어야 할 자리가 진짜 배열인지', () => {
  it('배열이면 OK(true)다', () => {
    expect(isArrayFieldOk([])).toBe(true);
    expect(isArrayFieldOk([{ areaSqm: 10 }])).toBe(true);
  });

  it('아예 없음(undefined·null)은 "아직 안 넣음"이라 OK(true)로 본다', () => {
    expect(isArrayFieldOk(undefined)).toBe(true);
    expect(isArrayFieldOk(null)).toBe(true);
  });

  it('값이 있는데 배열이 아니면(문자열·숫자·객체) 이상한 모양(false)이다', () => {
    // 검사관이 실제로 재현한 조작: preciseRooms를 문자열로 바꿔치기
    expect(isArrayFieldOk('abc')).toBe(false);
    // rooms를 숫자로 바꿔치기
    expect(isArrayFieldOk(123)).toBe(false);
    // openings를 배열이 아닌 객체로 바꿔치기
    expect(isArrayFieldOk({})).toBe(false);
    expect(isArrayFieldOk(true)).toBe(false);
  });
});

describe('safeCalc — 계산 중 무엇이 터져도 500 대신 대체 결과로', () => {
  it('정상적으로 끝나면 그 결과를 그대로 돌려준다', () => {
    expect(safeCalc(() => 42, () => -1)).toBe(42);
    type Outcome = { kind: 'ok' } | { kind: 'invalid' };
    expect(safeCalc<Outcome>(() => ({ kind: 'ok' }), () => ({ kind: 'invalid' }))).toEqual({ kind: 'ok' });
  });

  it('배열이 아닌 값에 .map·.some을 쓰다 TypeError가 나도 잡아서 대체 결과를 준다', () => {
    // preciseRooms.map is not a function / (preciseRooms ?? []).some is not a function
    // 실제 사고를 그대로 흉내낸다
    const boom = (): unknown => {
      const rooms: unknown = 'abc';
      return (rooms as unknown[]).map((r) => r); // 문자열엔 .map이 없어 TypeError
    };
    expect(safeCalc<unknown>(boom, () => 'invalid')).toBe('invalid');

    const boom2 = (): unknown => {
      const rooms: unknown = {};
      return (rooms as unknown[]).some((r) => Boolean(r)); // 객체엔 .some이 없어 TypeError
    };
    expect(safeCalc<unknown>(boom2, () => 'invalid')).toBe('invalid');
  });

  it('for...of로 배열 아닌 값을 돌다 나는 예외도 잡는다(openings: {} 같은 경우)', () => {
    const boom = () => {
      const openings: unknown = {};
      let count = 0;
      for (const _o of openings as unknown[]) count += 1;
      return count;
    };
    expect(safeCalc(boom, () => -1)).toBe(-1);
  });
});
