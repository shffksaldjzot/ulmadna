// 광고 가격·기간·그림 검사 시험 (2026년 10월 29일)
import { describe, expect, it } from 'vitest';
import { calcOrder, checkBanner, expiringSoon, imageSize, isHttpsUrl } from '../pricing';

/** 가로·세로만 담은 가짜 PNG 머리말 (extra 만큼 뒤에 덧붙여 파일 크기를 키움) */
function fakePng(w: number, h: number, extra = 0): Uint8Array {
  const b = new Uint8Array(33 + extra);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, w);
  dv.setUint32(20, h);
  return b;
}

describe('주문 계산', () => {
  it('30일 단위 마지막 날과 부가세', () => {
    const r = calcOrder('AD-H', '2026-11-01', 1);
    expect(r.endDate).toBe('2026-11-30');
    expect(r.amount).toBe(100000);
    expect(r.vat).toBe(10000);
  });
  it('3단위와 금액 직접 지정(무료 체험)', () => {
    expect(calcOrder('AD-P', '2026-11-01', 3).amount).toBe(150000);
    const free = calcOrder('AD-P', '2026-11-01', 1, 0);
    expect(free.amount).toBe(0);
    expect(free.vat).toBe(0);
  });
});

describe('만료 임박·주소·그림', () => {
  it('만료 7일 이내', () => {
    expect(expiringSoon('2026-11-08', '2026-11-01')).toBe(true);
    expect(expiringSoon('2026-11-09', '2026-11-01')).toBe(false);
    expect(expiringSoon('2026-10-31', '2026-11-01')).toBe(false);
  });
  it('https 만 허용', () => {
    expect(isHttpsUrl('https://ulmadna.com/sponsor')).toBe(true);
    expect(isHttpsUrl('http://a.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
  });
  it('그림 크기는 1배와 2배만', () => {
    expect(imageSize(fakePng(640, 200))).toEqual({ type: 'png', width: 640, height: 200 });
    expect(checkBanner('AD-H', fakePng(640, 200))).toBeNull();
    expect(checkBanner('AD-H', fakePng(320, 100))).toBeNull();
    expect(checkBanner('AD-H', fakePng(300, 100))).toMatch(/크기/);
    expect(checkBanner('AD-H', new Uint8Array(40))).toMatch(/PNG/);
    expect(checkBanner('AD-H', fakePng(640, 200, 400 * 1024))).toMatch(/KB/);
  });
});
