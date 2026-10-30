// 국세청 상태코드 판정·분당 제한 시험 (2026-10-30)
import { describe, expect, it } from 'vitest';
import { allowHit } from '../crypto';
import { kindOfStatus } from '../ntsVerify';

describe('국세청 상태코드 판정', () => {
  it('01 계속사업자 · 02 휴업 · 03 폐업 · 빈 값은 미등록', () => {
    expect(kindOfStatus('01')).toBe('active');
    expect(kindOfStatus('02')).toBe('closed');
    expect(kindOfStatus('03')).toBe('closed');
    expect(kindOfStatus('')).toBe('unknown');
  });
});

describe('분당 호출 제한', () => {
  it('10회까지 통과, 11번째는 막고, 창이 지나면 다시 통과', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 10; i++) expect(allowHit('t1', 10, 60_000, t0 + i)).toBe(true);
    expect(allowHit('t1', 10, 60_000, t0 + 11)).toBe(false);
    expect(allowHit('t1', 10, 60_000, t0 + 61_000)).toBe(true);
  });
});
