// ─────────────────────────────────────────────────────────────
// 형아 결정(2026년 11월 24일 밤) 시험 — 연장 90일 규칙 · 게재 전 다시 그리기 · 제작 무료 포함
//   포트원·DB·보관함은 가짜(실제 결제·운영 DB 쓰기 없음). 다시 그리기는 진짜 그리기 코드를 쓴다.
// ─────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '@/server/test-stubs/fakeSupabase';

let fake = makeFakeSupabase();
vi.mock('@/lib/ask/server', () => ({ adminOrNull: () => fake.client }));
const portone = { paidAt: '2026-11-24T05:00:00Z', total: 110000, cancelled: [] as string[] };
vi.mock('@/server/partner/portone', () => ({
  payConfig: () => ({ ready: true, storeId: 's', channelKey: 'c' }),
  fetchPayment: async () => ({ status: 'PAID', total: portone.total, failReason: '', paidAt: portone.paidAt }),
  cancelPayment: async (id: string) => { portone.cancelled.push(id); return true; },
}));
vi.mock('@/server/notify/adminTelegram', () => ({ notifyAdminTelegram: async () => true }));

/** 게재 중 30일·90일 광고 한 줄 */
function order(over: Record<string, unknown> = {}) {
  return {
    id: 1, advertiser_id: 7, slot_kind: 'AD-H', sido: '11', process: null, start_date: '2026-11-24', end_date: '2027-02-21',
    units: 3, amount: 270000, vat: 27000, pay_status: 'paid', run_status: 'live', banner_path: '1/x.png', ...over,
  };
}

beforeEach(() => {
  vi.useRealTimers();
  portone.cancelled = [];
});

describe('연장 90일 규칙', () => {
  it('90일 광고를 결제 다음 날 연장하려 하면 준비 단계에서 거절', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T03:00:00Z'));
    fake = makeFakeSupabase({ tables: { ad_orders: [order()], partner_payments: [] } });
    const { prepareExtend } = await import('@/server/partner/pay');
    const r = await prepareExtend(7, 1);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('60일 이하');
    expect(fake.tables.partner_payments).toHaveLength(0);
  });

  it('남은 60일이면 30일 연장 준비가 된다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T03:00:00Z'));
    // 오늘 11-24, 끝 2027-01-22(남은 60일, 오늘 포함)
    fake = makeFakeSupabase({ tables: { ad_orders: [order({ end_date: '2027-01-22' })], partner_payments: [] } });
    const { prepareExtend } = await import('@/server/partner/pay');
    const r = await prepareExtend(7, 1);
    expect(r.ok).toBe(true);
    expect(fake.tables.partner_payments).toHaveLength(1);
  });

  it('연장 결제가 쌓여 확정 때 90일을 넘으면 카드 결제를 취소하고 기간은 그대로', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T06:00:00Z'));
    // 끝 2027-01-22 인 광고에 연장 결제 두 건을 미리 만들어 두었다 → 첫 건 확정(끝 02-21, 90일) → 둘째 건은 120일이라 취소
    const ext = (id: string) => ({ payment_id: id, advertiser_id: 7, kind: 'extend', order_id: 1, slot_kind: 'AD-H', sido: '11', process: null, units: 1, amount: 100000, vat: 10000, total: 110000, status: 'ready' });
    fake = makeFakeSupabase({ tables: { ad_orders: [order({ end_date: '2027-01-22' })], partner_payments: [ext('ulm-e1'), ext('ulm-e2')] } });
    portone.paidAt = '2026-11-24T05:00:00Z';
    const { finalizePayment } = await import('@/server/partner/pay');
    expect(await finalizePayment('ulm-e1', null)).toEqual({ ok: true, data: 'done' });
    expect(fake.tables.ad_orders[0].end_date).toBe('2027-02-21');
    const r2 = await finalizePayment('ulm-e2', null);
    expect(r2.ok).toBe(false);
    expect(portone.cancelled).toEqual(['ulm-e2']);
    expect(fake.tables.ad_orders[0].end_date).toBe('2027-02-21'); // 더 늘지 않음
    expect(fake.tables.partner_payments[1]).toMatchObject({ status: 'refunded', fail_reason: 'extend_over_90' });
  });
});

describe('게재 전 다시 그리기', () => {
  /** 자동 배너가 붙은 검토 단계 제작 대행 주문 */
  const designOrder = (over: Record<string, unknown> = {}) => ({
    id: 5, advertiser_id: 7, slot_kind: 'AD-P', sido: '11', process: '타일', phone: '010-0234-5678', run_status: 'review', pay_status: 'paid',
    design_requested: true, design_brief: { name: '올데이타일', intro: '욕실 타일', headline: '타일 깔끔하게', style: 'modern' },
    banner_path: '5/auto-320x50.png', ...over,
  });

  it('문구를 고치면 새 판 이름으로 다시 그린다(횟수 제한 없음)', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [designOrder()] } });
    const { updateBriefAndRedraw } = await import('@/server/partner/brief');
    for (let i = 1; i <= 3; i++) {
      const r = await updateBriefAndRedraw(7, 5, { intro: '욕실·주방 타일', headline: `타일 ${i}번째 수정`, style: 'pop' });
      expect(r).toEqual({ ok: true, data: { redrawn: true } });
      expect(fake.tables.ad_orders[0].banner_path).toBe(`5/auto-320x50-r${i}.png`);
    }
    const brief = fake.tables.ad_orders[0].design_brief as Record<string, unknown>;
    expect(brief).toMatchObject({ headline: '타일 3번째 수정', style: 'pop', redraws: 3 });
    expect(fake.tables.ad_orders[0].run_status).toBe('review'); // 검토 단계 그대로
  }, 30_000);

  it('게재가 시작되면 막는다', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [designOrder({ run_status: 'live' })] } });
    const { updateBriefAndRedraw } = await import('@/server/partner/brief');
    const r = await updateBriefAndRedraw(7, 5, { intro: 'a', headline: 'b' });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(fake.tables.ad_orders[0].banner_path).toBe('5/auto-320x50.png');
  });

  it('손으로 올린 배너는 덮지 않는다', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [designOrder({ banner_path: '5/1700000000.png' })] } });
    const { updateBriefAndRedraw } = await import('@/server/partner/brief');
    const r = await updateBriefAndRedraw(7, 5, { intro: 'a', headline: 'b' });
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(fake.tables.ad_orders[0].banner_path).toBe('5/1700000000.png');
    expect(fake.uploads).toHaveLength(0);
  });

  it('남의 주문은 못 고친다', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [designOrder()] } });
    const { updateBriefAndRedraw } = await import('@/server/partner/brief');
    expect(await updateBriefAndRedraw(99, 5, { intro: 'a', headline: 'b' })).toMatchObject({ ok: false, status: 404 });
  });
});

describe('제작 무료 포함', () => {
  it('제작 대행 새 광고 결제 기록에 제작비 0, 결제 금액은 광고비만', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-24T06:00:00Z'));
    // 이미 결제한 광고주가 3곳 넘게 있어 첫 달 무료 대상 아님 → 카드 결제 준비
    const paid = [1, 2, 3, 4].map((i) => ({ id: 100 + i, advertiser_id: 50 + i, pay_status: 'paid' }));
    fake = makeFakeSupabase({ tables: { ad_orders: paid, partner_payments: [] } });
    const { prepareNew } = await import('@/server/partner/pay');
    const r = await prepareNew(7, { kind: 'AD-H', sido: '11', process: null, units: 1, clickUrl: '', phone: '010-0234-5678', file: null, design: { intro: '도배 전문', headline: '정직하게', logo: null } }, '한결도배');
    expect(r.ok).toBe(true);
    expect(fake.tables.partner_payments[0]).toMatchObject({ amount: 100000, vat: 10000, total: 110000, design_requested: true, design_fee: 0 });
  });
});
