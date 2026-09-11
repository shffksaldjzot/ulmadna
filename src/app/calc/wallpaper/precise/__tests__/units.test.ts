// ──────────────────────────────────────────────
// v1 허브 — 정밀 폼 단위 변환 테스트 (순수 함수만, React 없음)
//
// 이 테스트가 지키는 것:
//   1) m ↔ mm 왕복해도 저장값이 그대로여야 한다(단위 토글을 눌러도 값이 흔들리면 안 됨)
//   2) 3456mm처럼 큰 값이 화면에 "3,456"으로 보여야 한다
//   3) 빈 칸은 숫자로 억지 변환하지 않고 빈 값으로 남아야 한다
//
// 작성일: 2026년 09월 09일
// ──────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { toDisplay, toMeters, cmToDisplay, displayToCm } from '../units';
import { formatDimension, num } from '@/lib/v1/wallpaperDefaults';

describe('정밀 폼 단위 변환', () => {
  it('m ↔ mm 왕복해도 저장값(m)이 그대로다', () => {
    // 2.3m를 mm로 보면 2300, 다시 m로 되돌리면 2.3
    expect(toDisplay(2.3, 'mm')).toBe(2300);
    expect(toMeters(2300, 'mm')).toBe(2.3);
    // 소수 셋째 자리까지 있는 값도 왕복에서 안 깨진다
    expect(toMeters(toDisplay(3.456, 'mm'), 'mm')).toBe(3.456);
    // m 단위는 그대로 통과
    expect(toDisplay(3.456, 'm')).toBe(3.456);
    expect(toMeters(3.456, 'm')).toBe(3.456);
  });

  it('3.456m를 mm로 보면 화면에 "3,456"으로 찍힌다', () => {
    const shown = toDisplay(3.456, 'mm');
    expect(shown).toBe(3456);
    expect(formatDimension(shown as number, 'mm')).toBe('3,456');
  });

  it('빈 값은 빈 값으로 남는다', () => {
    expect(toDisplay('', 'mm')).toBe('');
    expect(toDisplay(undefined, 'm')).toBe('');
    expect(toMeters('', 'mm')).toBe('');
    // 입력칸이 비면 숫자로 바꾸지 않고 undefined (wallpaperDefaults.num 규칙)
    expect(num('')).toBeUndefined();
    // 개구부(cm)도 0은 "아직 안 적음"이라 빈 칸으로 그리고, 빈 칸은 0으로 담는다
    expect(cmToDisplay(0)).toBe('');
    expect(displayToCm('')).toBe(0);
  });
});
