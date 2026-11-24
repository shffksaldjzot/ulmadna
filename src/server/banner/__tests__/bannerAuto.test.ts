// ─────────────────────────────────────────────────────────────
// 배너 자동 제작 ↔ 주문 연결 시험 (2026년 11월 24일)
//
// [무엇을 보나]
//   1) 제작 대행 주문을 결제 확정하면 배너가 바로 붙고, 검토(review) 상태는 그대로다.
//   2) 웹훅이 두 번 와도(두 번 그려도) 파일 하나·주문 칸 하나로 끝난다(멱등).
//   3) 관리자가 먼저 올린 배너는 덮어쓰지 않는다.
//   4) 그리기가 실패해도 결제·주문은 성공으로 남고, 주문은 배너 없는 '배너 제작 중'이다.
//   포트원·DB·보관함은 가짜(실제 결제·운영 DB 쓰기 없음). 그리기는 진짜 코드(글꼴 포함)를 쓴다.
// ─────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { makeFakeSupabase } from '@/server/test-stubs/fakeSupabase';

let fake = makeFakeSupabase();
vi.mock('@/lib/ask/server', () => ({ adminOrNull: () => fake.client }));
vi.mock('@/server/partner/portone', () => ({
  payConfig: () => ({ ready: true, storeId: 's', channelKey: 'c' }),
  fetchPayment: async () => ({ status: 'PAID', total: 165000, failReason: '', paidAt: new Date().toISOString() }),
  cancelPayment: async () => true,
}));
// 관리자 텔레그램 알림은 가짜로 받아 몇 번 보냈는지 센다(실제 전송 없음)
const sent: string[] = [];
vi.mock('@/server/notify/adminTelegram', () => ({ notifyAdminTelegram: async (t: string) => { sent.push(t); return true; } }));
// 그리기를 일부러 실패시킬 스위치(시험 4)
const breakRender = { on: false };
vi.mock('@/server/banner/bannerRender', async (orig) => {
  const real = await orig<typeof import('@/server/banner/bannerRender')>();
  return {
    ...real,
    renderBanner: async (...a: Parameters<typeof real.renderBanner>) => {
      if (breakRender.on) throw new Error('글꼴 읽기 실패(시험)');
      return real.renderBanner(...a);
    },
  };
});

/** 제작 대행 결제 대기 한 줄(맨 위 띠 = 휴대폰 320x100 + PC 728x90) */
function designPayment() {
  return {
    payment_id: 'ulm-design-1', advertiser_id: 9, kind: 'new', slot_kind: 'AD-H', sido: '11', process: null,
    units: 1, amount: 150000, vat: 15000, total: 165000, status: 'ready', banner_path: null,
    click_url: null, phone: '010-0234-5678', design_requested: true, design_fee: 50000,
    design_brief: { name: '한결도배', phone: '010-0234-5678', intro: '방 1개부터 전체 도배까지', headline: '벽지 한 장도 정직하게', mood: '', style: 'classic', logo_path: null },
  };
}

beforeEach(() => {
  breakRender.on = false;
  fake = makeFakeSupabase({ tables: { partner_payments: [designPayment()], ad_orders: [], advertisers: [{ id: 9, name: '한결도배' }] } });
});

describe('결제 확정 → 배너 자동 제작', () => {
  it('결제 확정 처리 안에서 배너가 붙고 검토 상태는 그대로', async () => {
    const { finalizePayment } = await import('@/server/partner/pay');
    expect(await finalizePayment('ulm-design-1', null)).toEqual({ ok: true, data: 'done' });
    const o = fake.tables.ad_orders[0];
    expect(o.banner_path).toBe(`${o.id}/auto-320x100.png`);
    expect(o.banner_desktop_path).toBe(`${o.id}/auto-728x90.png`);
    expect(o.run_status).toBe('review'); // 검토를 건너뛰지 않는다
    const png = fake.files.get(`ad-banners/${o.banner_path}`) as Uint8Array;
    const m = await sharp(png).metadata();
    expect([m.width, m.height]).toEqual([640, 200]);
  }, 30_000);

  it('웹훅이 두 번 와도 파일·주문은 하나(멱등)', async () => {
    const { finalizePayment } = await import('@/server/partner/pay');
    const { ensureAutoBanner } = await import('@/server/banner/bannerAuto');
    await finalizePayment('ulm-design-1', null);
    await finalizePayment('ulm-design-1', null); // 웹훅 재시도
    const id = Number(fake.tables.ad_orders[0].id);
    expect(await ensureAutoBanner(id)).toEqual({ state: 'exists' }); // 관리자 [자동 제작 다시]도 아무 일 없음
    expect(fake.tables.ad_orders).toHaveLength(1);
    const keys = [...fake.files.keys()].filter((k) => k.startsWith(`ad-banners/${id}/`));
    expect(keys.sort()).toEqual([`ad-banners/${id}/auto-320x100.png`, `ad-banners/${id}/auto-728x90.png`]);
  }, 30_000);

  it('그리기가 실패해도 결제는 성공, 주문은 배너 없는 제작 중으로 남는다 → 다음 재시도에 그려진다', async () => {
    breakRender.on = true;
    const { finalizePayment } = await import('@/server/partner/pay');
    expect(await finalizePayment('ulm-design-1', null)).toEqual({ ok: true, data: 'done' });
    expect(fake.tables.partner_payments[0].status).toBe('paid');
    const o = fake.tables.ad_orders[0];
    expect(o.pay_status).toBe('paid');
    expect(o.banner_path ?? null).toBeNull();
    // 관리자에게 알림이 한 번 갔다
    expect(sent.filter((t) => t.includes(`주문 #${o.id}`))).toHaveLength(1);
    // 웹훅이 한 번 더 와도(여전히 실패) 알림은 더 가지 않는다
    await finalizePayment('ulm-design-1', null);
    expect(sent.filter((t) => t.includes(`주문 #${o.id}`))).toHaveLength(1);
    // 웹훅 재시도(이미 paid) 때 다시 그린다
    breakRender.on = false;
    expect(await finalizePayment('ulm-design-1', null)).toEqual({ ok: true, data: 'done' });
    expect(fake.tables.ad_orders[0].banner_path).toBe(`${o.id}/auto-320x100.png`);
  }, 30_000);

  it('보관함 올리기가 실패해도 결제는 성공', async () => {
    fake.fail.upload = true;
    const { finalizePayment } = await import('@/server/partner/pay');
    expect(await finalizePayment('ulm-design-1', null)).toEqual({ ok: true, data: 'done' });
    expect(fake.tables.ad_orders[0].banner_path ?? null).toBeNull();
  }, 30_000);
});

describe('ensureAutoBanner 단독', () => {
  it('관리자가 먼저 올린 배너는 덮어쓰지 않는다', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [{ id: 5, advertiser_id: 9, slot_kind: 'AD-R', sido: '11', process: null, design_requested: true, design_brief: { headline: '가' }, banner_path: '5/1700000000.png', run_status: 'review' }] } });
    const { ensureAutoBanner } = await import('@/server/banner/bannerAuto');
    expect(await ensureAutoBanner(5)).toEqual({ state: 'exists' });
    expect(fake.tables.ad_orders[0].banner_path).toBe('5/1700000000.png');
    expect(fake.uploads).toHaveLength(0);
  });

  it('직접 올리기 주문은 건드리지 않는다', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [{ id: 6, advertiser_id: 9, slot_kind: 'AD-P', sido: '11', process: '타일', design_requested: false, banner_path: null }] } });
    const { ensureAutoBanner } = await import('@/server/banner/bannerAuto');
    expect(await ensureAutoBanner(6)).toEqual({ state: 'skip' });
  });

  it('공정 전문 배너는 320x50 하나, 스타일 안 고르면 클래식', async () => {
    fake = makeFakeSupabase({ tables: { ad_orders: [{ id: 7, advertiser_id: 9, slot_kind: 'AD-P', sido: '11', process: '타일', phone: null, design_requested: true, design_brief: { name: '올데이타일', headline: '타일 깔끔하게', style: '' }, banner_path: null }] } });
    const { ensureAutoBanner } = await import('@/server/banner/bannerAuto');
    expect(await ensureAutoBanner(7)).toEqual({ state: 'made', path: '7/auto-320x50.png' });
    expect(fake.uploads.map((u) => u.path)).toEqual(['7/auto-320x50.png']);
    expect(fake.uploads[0].upsert).toBe(true);
  }, 30_000);
});
