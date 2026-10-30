// ─────────────────────────────────────────────────────────────
// 광고주 셀프 화면 순수 함수 시험 — 사업자번호·이메일·비밀번호·금액·배지 (2026년 10월 31일)
// ─────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { DESIGN_FEE, SLOT_INFO } from '@/lib/ads/pricing';
import {
  PARTNER_SLOTS, badgeOf, briefProblem, cleanBrief, quoteNew, ctr, formatBizNo, isBizNo, isEmail, isPartnerRegion, lastDays, newPaymentId,
  normalizeBizNo, normalizeEmail, passwordProblem, quote, remainDays, won, isPhoneOk, cleanPhone } from './rules';

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
    expect(quote('AD-H', 1)).toMatchObject({ units: 1, amount: 100000, vat: 10000, total: 110000, listAmount: 100000, discountPct: 0 });
  });
  it('공정 스폰서 90일 = 정본 가격 × 3 에서 10% 할인', () => {
    const q = quote('AD-P', 3);
    expect(q.listAmount).toBe(SLOT_INFO['AD-P'].price * 3);
    expect(q.discountPct).toBe(10);
    expect(q.amount).toBe(SLOT_INFO['AD-P'].price * 3 * 0.9);
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
    // 제작 대행: 배너가 없으면 '배너 제작 중', 관리자가 올리면 '배너 검토 중'
    const design = { ...base, run_status: 'review', design_requested: true };
    expect(badgeOf({ ...design, has_banner: false }, '2026-10-15')).toBe('design');
    expect(badgeOf({ ...design, has_banner: true }, '2026-10-15')).toBe('review');
    expect(badgeOf({ ...design, has_banner: false, pay_status: 'refunded' }, '2026-10-15')).toBe('refunded');
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

describe('지역 단계 결제 금액(2026-10-30)', () => {
  it('광역시 70%·그 외 50%', () => {
    expect(quote('AD-H', 1, '26').amount).toBe(70000);
    expect(quote('AD-H', 1, '51').total).toBe(55000);
    expect(quoteNew('AD-H', 1, null, '26').amount).toBe(70000);
  });
});

describe('토탈 인테리어 스폰서(AD-T)', () => {
  it('신청 목록에 있고 10만 원 + 부가세', () => {
    expect(PARTNER_SLOTS).toContain('AD-T');
    expect(quote('AD-T', 1)).toMatchObject({ units: 1, amount: 100000, vat: 10000, total: 110000 });
  });
});

describe('배너 제작 대행 금액(2026-10-29)', () => {
  it('직접 올리기면 제작비 없음 — 기존 금액과 같다', () => {
    const q = quoteNew('AD-H', 1, null);
    expect(q).toMatchObject({ units: 1, adAmount: 100000, designFee: 0, amount: 100000, vat: 10000, total: 110000 });
  });
  it('첫 제작은 무료(0원)', () => {
    const q = quoteNew('AD-P', 1, { firstFree: true });
    expect(q.designFee).toBe(0);
    expect(q.amount).toBe(SLOT_INFO['AD-P'].price);
    expect(q.total).toBe(55000);
  });
  it('두 번째부터 5만 원 + 부가세(광고비와 합쳐 계산)', () => {
    const q = quoteNew('AD-H', 3, { firstFree: false });
    expect(DESIGN_FEE).toBe(50000);
    expect(q.adAmount).toBe(270000); // 90일 10% 할인 뒤
    expect(q.designFee).toBe(50000);
    expect(q.amount).toBe(320000);
    expect(q.vat).toBe(32000);
    expect(q.total).toBe(352000);
  });
  it('입력 정리와 빈칸 검사', () => {
    expect(cleanBrief(' 남양주  올수리 \t전문 ', 60)).toBe('남양주 올수리 전문');
    expect(cleanBrief('가'.repeat(80), 40)).toHaveLength(40);
    expect(cleanBrief(3, 10)).toBe('');
    expect(briefProblem('', '무료 실측')).not.toBeNull();
    expect(briefProblem('올수리 전문', '')).not.toBeNull();
    expect(briefProblem('올수리 전문', '무료 실측')).toBeNull();
  });
});

describe('전화번호 검사 (2026-10-30)', () => {
  it('숫자 9자리 이상이면 통과(02 지역번호 포함)', () => {
    expect(isPhoneOk('010-1234-5678')).toBe(true);
    expect(isPhoneOk('02-123-4567')).toBe(true);
    expect(isPhoneOk('031 123 4567')).toBe(true);
  });
  it('모자라면 거절', () => {
    expect(isPhoneOk('')).toBe(false);
    expect(isPhoneOk('010-123')).toBe(false);
    expect(isPhoneOk(undefined)).toBe(false);
  });
  it('저장 값은 숫자와 하이픈만', () => {
    expect(cleanPhone('(010) 1234-5678 번')).toBe('0101234-5678');
    expect(cleanPhone('tel 010-1234-5678')).toBe('010-1234-5678');
  });
});

describe('장기 할인·첫 달 무료 결제 금액(2026-10-30)', () => {
  it('90일: 정가·할인율·할인 뒤 금액', () => {
    const q = quote('AD-H', 3);
    expect(q).toMatchObject({ listAmount: 300000, discountPct: 10, amount: 270000, vat: 27000, total: 297000, freeAmount: 0 });
  });
  it('첫 달 무료 30일: 0원', () => {
    expect(quote('AD-H', 1, null, true)).toMatchObject({ amount: 0, vat: 0, total: 0, freeAmount: 100000 });
  });
  it('첫 달 무료 90일: 첫 30일 단위만 빠진다(할인 뒤 2단위분)', () => {
    const q = quote('AD-H', 3, null, true);
    expect(q.freeAmount).toBe(90000);
    expect(q.amount).toBe(180000);
  });
  it('quoteNew 첫 달 무료 + 제작 대행 첫 회 무료면 합계 0원', () => {
    expect(quoteNew('AD-H', 1, { firstFree: true }, null, true).total).toBe(0);
    expect(quoteNew('AD-H', 1, { firstFree: false }, null, true).total).toBe(55000);
  });
});
