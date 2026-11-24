// ─────────────────────────────────────────────────────────────
// 결제 주문 끝나는 날 고정 시험 (2026년 11월 24일)
//
// [무엇을 보나]
//   결제사 조건 "결제일부터 서비스 종료일까지 90일 이내" — 끝나는 날은 결제일 + 30 x 단위 - 1 을 넘으면 안 된다.
//   결제 확인(finalizePayment)이 자정을 넘겨 늦게 처리돼도 시작일이 결제한 날로 잡히는지,
//   같은 결제가 두 번 들어와도 주문이 한 번만 생기는지 본다.
//   포트원·DB 는 가짜로 바꾼다(실제 결제·운영 DB 쓰기 없음).
// ─────────────────────────────────────────────────────────────
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '@/server/test-stubs/fakeSupabase';
import { orderStartDay } from '@/lib/partner/rules';

// 가짜 DB 를 시험마다 새로 만들어 끼운다
let fake = makeFakeSupabase();
vi.mock('@/lib/ask/server', () => ({ adminOrNull: () => fake.client }));
// 포트원은 "결제됨" 답을 시험이 정한다
const portone = { paidAt: null as string | null, total: 110000 };
vi.mock('@/server/partner/portone', () => ({
  payConfig: () => ({ ready: true, storeId: 's', channelKey: 'c' }),
  fetchPayment: async () => ({ status: 'PAID', total: portone.total, failReason: '', paidAt: portone.paidAt }),
  cancelPayment: async () => true,
}));

/** 결제 대기 한 줄(맨 위 띠, 서울, 1단위, 공급가 10만 + 부가세 1만) */
function readyRow(over: Record<string, unknown> = {}) {
  return {
    payment_id: 'ulm-test-1', advertiser_id: 7, kind: 'new', slot_kind: 'AD-H', sido: '11', process: null,
    units: 1, amount: 100000, vat: 10000, total: 110000, status: 'ready', banner_path: 'partner/7/a.png',
    click_url: null, phone: '010-0000-0000', ...over,
  };
}

describe('orderStartDay — 결제 시각 → 시작일', () => {
  it('결제 시각의 한국 날짜를 쓴다(밤 11시 50분 결제, 다음 날 처리)', () => {
    // 2026-11-24 23:50 KST = 2026-11-24T14:50Z, 처리 시각은 다음 날 00:10 KST
    expect(orderStartDay('2026-11-24T14:50:00Z', new Date('2026-11-24T15:10:00Z'))).toBe('2026-11-24');
  });
  it('결제 시각이 없거나 깨졌으면 오늘', () => {
    const now = new Date('2026-11-24T03:00:00Z');
    expect(orderStartDay(null, now)).toBe('2026-11-24');
    expect(orderStartDay('엉터리', now)).toBe('2026-11-24');
  });
  it('시계 차이로 미래 시각이 와도 오늘보다 뒤로 가지 않는다', () => {
    expect(orderStartDay('2026-11-26T00:00:00Z', new Date('2026-11-24T03:00:00Z'))).toBe('2026-11-24');
  });
});

describe('finalizePayment — 끝나는 날 고정', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fake = makeFakeSupabase({ tables: { partner_payments: [readyRow()], ad_orders: [] } });
  });
  afterEach(() => vi.useRealTimers());

  it('웹훅이 이틀 뒤에 처리돼도 시작일은 결제일, 끝나는 날은 결제일 + 29', async () => {
    portone.paidAt = '2026-11-24T05:00:00Z'; // 2026-11-24 14:00 KST 결제
    vi.setSystemTime(new Date('2026-11-26T05:00:00Z')); // 처리는 11-26
    const { finalizePayment } = await import('@/server/partner/pay');
    const r = await finalizePayment('ulm-test-1', null);
    expect(r).toEqual({ ok: true, data: 'done' });
    const o = fake.tables.ad_orders[0];
    expect(o.start_date).toBe('2026-11-24');
    expect(o.end_date).toBe('2026-12-23');
  });

  it('90일(3단위)도 결제일 + 89 를 넘지 않는다', async () => {
    fake = makeFakeSupabase({ tables: { partner_payments: [readyRow({ units: 3, amount: 270000, vat: 27000, total: 297000 })], ad_orders: [] } });
    portone.paidAt = '2026-11-24T05:00:00Z';
    portone.total = 297000;
    vi.setSystemTime(new Date('2026-11-25T01:00:00Z'));
    const { finalizePayment } = await import('@/server/partner/pay');
    await finalizePayment('ulm-test-1', null);
    const o = fake.tables.ad_orders[0];
    expect(o.start_date).toBe('2026-11-24');
    expect(o.end_date).toBe('2027-02-21'); // 11-24 + 89일
    portone.total = 110000;
  });

  it('같은 결제가 두 번 들어와도 주문은 하나', async () => {
    portone.paidAt = '2026-11-24T05:00:00Z';
    vi.setSystemTime(new Date('2026-11-24T06:00:00Z'));
    const { finalizePayment } = await import('@/server/partner/pay');
    await finalizePayment('ulm-test-1', null);
    const again = await finalizePayment('ulm-test-1', null);
    expect(again).toEqual({ ok: true, data: 'done' });
    expect(fake.tables.ad_orders).toHaveLength(1);
  });
});
