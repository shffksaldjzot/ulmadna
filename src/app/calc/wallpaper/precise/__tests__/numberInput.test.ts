// ──────────────────────────────────────────────
// v1 허브 — 숫자 입력칸(NumberField)의 글자 해석 테스트
//
// 이 테스트가 지키는 것:
//   높이 2.3을 치면 23이 되던 사고를 막는다.
//   "3."처럼 아직 다 치지 않은 상태는 null(= 입력 중)이라 바깥 값을 건드리지 않아야 하고,
//   "3.6"은 3.6, "1,000"은 1000, 빈 칸은 ''(값 없음)이어야 한다.
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { parseNumberInput } from '@/components/v1/NumberField';

describe('숫자 입력칸 글자 해석', () => {
  it('소수점을 막 찍은 "3."은 입력 중(null)이라 바깥 값을 바꾸지 않는다', () => {
    expect(parseNumberInput('3.')).toBeNull();
    // 소수점만 있거나 두 번 찍힌 것도 아직 숫자가 아니다
    expect(parseNumberInput('.')).toBeNull();
    expect(parseNumberInput('1.2.3')).toBeNull();
  });

  it('소수를 끝까지 치면 그 숫자가 된다', () => {
    expect(parseNumberInput('3.6')).toBe(3.6);
    expect(parseNumberInput('2.3')).toBe(2.3);
    expect(parseNumberInput('18')).toBe(18);
    // 앞자리 0을 생략하고 ".9"로 쳐도 0.9로 받는다
    expect(parseNumberInput('.9')).toBe(0.9);
  });

  it('쉼표는 자릿수 구분으로 보고, 빈 칸은 값 없음이다', () => {
    expect(parseNumberInput('1,000')).toBe(1000);
    expect(parseNumberInput('44,000')).toBe(44000);
    expect(parseNumberInput('')).toBe('');
  });
});
