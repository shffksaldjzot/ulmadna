// ─────────────────────────────────────────────────────────────
// 광고주 셀프 화면 순수 함수 시험 — 사업자번호·이메일·비밀번호·금액·배지 (2026년 10월 31일)
// ─────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { SLOT_INFO } from '@/lib/ads/pricing';
import {
  PARTNER_SLOTS, badgeOf, ctr, formatBizNo, isBizNo, isEmail, isPartnerRegion, lastDays, newPaymentId,
  normalizeBizNo, normalizeEmail, passwordProblem, quote, remainDays, won,
} from './rules';

describe('사업자번호 형식', () => {
  it('검증 숫자가 맞는 번호는 통과(하이픈 있어도)', () => {
    expect(isBizNo('124-81-00998')).toBe(true);
    expect(isBizNo('2208162517')).toBe(true);
  });
  it('끝자리가 틀리면 거절', () => {
    expect(isBizNo('1234567890')).toBe(false);
    expect(isBizNo('124-81-00997')).toBe(false);
  });
  it('자리 수가 다르거나 글자가 섞이면 거절', () => {
    expect(isBizNo('12481009')).toBe(false);
    expect(isBizNo('12481009981')).toBe(false);
    expect(isBizNo('')).toBe(false);
    expect(isBizNo(null)).toBe(false);
  });
  it('숫자만 남기기·보기 좋게', () => {
    expect(normalizeBizNo('124-81-00998')).toBe('1248100998');
    expect(formatBizNo('1248100998')).toBe('124-81-00998');
  });
});

describe('이메일·비밀번호', () => {
  it('이메일 정리와 형식', () => {
    expect(normalizeEmail('  A@B.Com ')).toBe('a@b.com');
    expect(isEmail('a@b.com')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.com')).toBe(false);
  });
  it('비밀번호 규칙: 8자 이상, 영문+숫자', () => {
    expect(passwordProblem('abc12345')).toBeNull();
    expect(passwordProblem('abc123')).not.toBeNull();
    expect(passwordProblem('abcdefgh')).not.toBeNull();
    expect(passwordProblem('12345678')).not.toBeNull();
    expect(passwordProblem('a1'.repeat(40))).not.toBeNull();
  });
});

describe('결제 금액(부가세 포함)', () => {
  it('헤더 가로 30일 = 10만 + 1만 = 11만 원', () => {
    expect(quote('AD-H', 1)).toEqual({ units: 1, amount: 100000, vat: 10000, total: 110000 });
  });
  it('공정 스폰서 90일 = 정본 가격 × 3', () => {
    const q = quote('AD-P', 3);
    expect(q.amount).toBe(SLOT_INFO['AD-P'].price * 3);
    expect(q.vat).toBe(Math.round(q.amount * 0.1));
    expect(q.total).toBe(q.amount + q.vat);
  });
  it('단위는 1~24 로 자른다', () => {
    expect(quote('AD-F', 0).units).toBe(1);
    expect(quote('AD-F', 99).units).toBe(24);
  });
  it('원 표기', () => {
    expect(won(110000)).toBe('110,000원');
  });
});

describe('광고 카드 표시', () => {
  const base = { run_status: 'live', pay_status: 'paid', start_date: '2026-10-01', end_date: '2026-10-30' };
  it('상태 배지', () => {
    expect(badgeOf(base, '2026-10-15')).toBe('live');
    expect(badgeOf({ ...base, run_status: 'review' }, '2026-10-15')).toBe('review');
    expect(badgeOf(base, '2026-10-31')).toBe('expired');
    expect(badgeOf({ ...base, pay_status: 'refunded' }, '2026-10-15')).toBe('refunded');
    expect(badgeOf({ ...base, start_date: '2026-10-20' }, '2026-10-15')).toBe('waiting');
  });
  it('남은 날(마지막 날 포함)·클릭률', () => {
    expect(remainDays('2026-10-30', '2026-10-30')).toBe(1);
    expect(remainDays('2026-10-30', '2026-11-05')).toBe(0);
    expect(ctr(1000, 25)).toBe(2.5);
    expect(ctr(0, 0)).toBe(0);
  });
  it('최근 14일 목록과 지역·결제 번호', () => {
    const d = lastDays('2026-10-31', 14);
    expect(d).toHaveLength(14);
    expect(d[0]).toBe('2026-10-18');
    expect(d[13]).toBe('2026-10-31');
    expect(isPartnerRegion('11')).toBe(true);
    expect(isPartnerRegion('ALL')).toBe(false);
    expect(newPaymentId('ab-cd_ef')).toMatch(/^ulm-[a-z0-9]+-abcdef$/);
  });
});

describe('토탈 인테리어 스폰서(AD-T)', () => {
  it('신청 목록에 있고 15만 원 + 부가세', () => {
    expect(PARTNER_SLOTS).toContain('AD-T');
    expect(quote('AD-T', 1)).toEqual({ units: 1, amount: 150000, vat: 15000, total: 165000 });
  });
});
