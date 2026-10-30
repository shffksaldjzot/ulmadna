// 오픈 기념 첫 광고주 무료 판정 시험 (2026-10-30)
import { describe, expect, it } from 'vitest';
import { FIRST_FREE_ADVERTISERS } from '../config';
import { firstFreeLeft, isFirstFreeEligible } from '../promo';

describe('첫 광고주 무료 판정', () => {
  it('한도 상수는 3', () => {
    expect(FIRST_FREE_ADVERTISERS).toBe(3);
  });
  it('남은 곳: 3 - 결제한 광고주 수(0 미만 없음)', () => {
    expect(firstFreeLeft(0)).toBe(3);
    expect(firstFreeLeft(2)).toBe(1);
    expect(firstFreeLeft(3)).toBe(0);
    expect(firstFreeLeft(9)).toBe(0);
  });
  it('3곳 미만 + 첫 주문이면 대상', () => {
    expect(isFirstFreeEligible(0, 0)).toBe(true);
    expect(isFirstFreeEligible(2, 0)).toBe(true);
  });
  it('3곳 채워지면 대상 아님', () => {
    expect(isFirstFreeEligible(3, 0)).toBe(false);
  });
  it('이미 주문이 있으면(첫 주문 아님) 대상 아님', () => {
    expect(isFirstFreeEligible(1, 1)).toBe(false);
  });
  it('한도 0 이면 프로모션 꺼짐', () => {
    expect(firstFreeLeft(0, 0)).toBe(0);
    expect(isFirstFreeEligible(0, 0, 0)).toBe(false);
  });
});
