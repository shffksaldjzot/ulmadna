// ─────────────────────────────────────────────────────────────
// 광고주 카드 결제 흐름 (서버 전용) — 2026년 10월 31일
//
// [흐름]
//   1) 준비(prepare): 자리·지역·배너·금액을 서버가 검사하고 partner_payments 에 'ready' 한 줄을 넣는다.
//      금액은 서버가 SLOT_INFO 로 계산한다(브라우저가 보낸 금액은 쓰지 않음).
//   2) 브라우저가 포트원 결제창을 연다(@portone/browser-sdk, PortOne.requestPayment).
//   3) 확인(finalize): 포트원 API 로 결제 상태(PAID)·금액(amount.total)을 다시 확인한 뒤
//      - 새 광고면 ad_orders 에 주문을 만든다(카드·결제 완료·배너 검토 중)
//      - 연장이면 그 주문의 마지막 날을 30일 × 단위만큼 늘린다
//      결제 확인 API 와 웹훅이 동시에 와도 한 번만 처리되게, 'ready' → 'paid' 바꾸기에 성공한 쪽만 진행한다.
//   4) 환불(refund): 관리자가 반려하면 포트원 결제 취소 → 기록 'refunded' → 주문 중지.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import crypto from 'crypto';
import { adminOrNull } from '@/lib/ask/server';
import { AD_PROCESS_GROUPS, SLOT_INFO, addDaysStr, calcOrder, checkBanner, fromDbSlot, isHttpsUrl, kstToday, toDbSlot, UNIT_DAYS, type SlotKind } from '@/lib/ads/pricing';
import { PARTNER_SLOTS, PARTNER_UNITS, badgeOf, canManage, isPartnerRegion, newPaymentId, quote, regionName } from '@/lib/partner/rules';
import { cancelPayment, fetchPayment, payConfig } from './portone';
import { BUCKET, myOrder } from './store';

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

/** 결제창을 여는 데 필요한 값 */
export interface Prepared {
  paymentId: string;
  orderName: string;
  total: number;
}

/**
 * 자리 비었는지(DB 함수 ads_slot_available). 확인 실패면 null
 *   화면 자리 종류(AD-T 포함)를 받아 DB 저장 방식(toDbSlot)으로 바꿔 묻는다.
 */
async function slotFree(kind: SlotKind, sido: string, process: string | null, from: string, to: string, exclude?: number): Promise<boolean | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const db = toDbSlot(kind, process);
  const { data, error } = await sb.rpc('ads_slot_available', {
    p_kind: db.slot_kind, p_sido: sido, p_process: db.process, p_from: from, p_to: to, p_exclude: exclude ?? null,
  });
  if (error) return null;
  return data !== false;
}

/** 주문 이름(결제창·카드 명세에 보임) */
function orderNameOf(kind: SlotKind, sido: string, process: string | null, units: number, extend = false): string {
  const p = process ? ` ${process}` : '';
  return `얼마드나 광고 ${SLOT_INFO[kind].name}${p} ${regionName(sido)} ${units * UNIT_DAYS}일${extend ? ' 연장' : ''}`;
}

/** 새 광고 결제 준비 */
export async function prepareNew(advertiserId: number, input: {
  kind: unknown; sido: unknown; process: unknown; units: unknown; clickUrl: unknown; phone: unknown;
  file: { bytes: Uint8Array; type: string } | null;
}): Promise<Res<Prepared>> {
  if (!payConfig().ready) return { ok: false, error: '결제 준비 중이에요' };
  const kind = input.kind as SlotKind;
  if (!PARTNER_SLOTS.includes(kind)) return { ok: false, error: '자리를 골라 주세요' };
  if (!isPartnerRegion(input.sido)) return { ok: false, error: '지역을 골라 주세요' };
  const sido = input.sido;
  const process = kind === 'AD-P' && typeof input.process === 'string' && AD_PROCESS_GROUPS.includes(input.process) ? input.process : null;
  if (kind === 'AD-P' && !process) return { ok: false, error: '공정을 골라 주세요' };
  const units = Number(input.units);
  if (!(PARTNER_UNITS as readonly number[]).includes(units)) return { ok: false, error: '기간을 골라 주세요' };
  if (!isHttpsUrl(input.clickUrl)) return { ok: false, error: '연결 주소는 https 로 시작해야 해요' };
  if (!input.file) return { ok: false, error: '배너 그림을 올려 주세요' };
  const why = checkBanner(kind, input.file.bytes);
  if (why) return { ok: false, error: why };

  const today = kstToday();
  const c = calcOrder(kind, today, units);
  const free = await slotFree(kind, sido, process, today, c.endDate);
  if (free === null) return { ok: false, error: '지금은 신청을 받을 수 없어요(준비 중)' };
  if (!free) return { ok: false, error: '이 지역은 자리가 다 찼어요' };

  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '지금은 신청을 받을 수 없어요(준비 중)' };
  // 배너는 결제 전에 보관함에 먼저 둔다(결제가 끝나면 주문에 이 경로를 그대로 적는다)
  const ext = input.file.type === 'image/png' ? 'png' : 'jpg';
  const path = `partner/${advertiserId}/${Date.now()}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, input.file.bytes, { contentType: ext === 'png' ? 'image/png' : 'image/jpeg', upsert: false });
  if (up.error) return { ok: false, error: '그림을 올리지 못했어요' };

  const q = quote(kind, units);
  const paymentId = newPaymentId(crypto.randomUUID());
  const phone = typeof input.phone === 'string' ? input.phone.replace(/[^\d-]/g, '').slice(0, 20) || null : null;
  const db = toDbSlot(kind, process); // AD-T 는 AD-P + '토탈 인테리어' 로 적는다
  const { error } = await sb.from('partner_payments').insert({
    payment_id: paymentId, advertiser_id: advertiserId, kind: 'new', slot_kind: db.slot_kind, sido, process: db.process,
    units: q.units, amount: q.amount, vat: q.vat, total: q.total, banner_path: path, click_url: input.clickUrl, phone,
  });
  if (error) return { ok: false, error: '지금은 신청을 받을 수 없어요(준비 중)' };
  return { ok: true, data: { paymentId, orderName: orderNameOf(kind, sido, process, units), total: q.total } };
}

/** 30일 연장 결제 준비(내 주문, 아직 안 끝난 주문만) */
export async function prepareExtend(advertiserId: number, orderId: number): Promise<Res<Prepared>> {
  if (!payConfig().ready) return { ok: false, error: '결제 준비 중이에요' };
  const o = await myOrder(advertiserId, orderId);
  if (!o) return { ok: false, error: '광고를 찾지 못했어요' };
  const today = kstToday();
  const b = badgeOf(o, today);
  if (!canManage(b) || b === 'expired') return { ok: false, error: '연장할 수 없는 광고예요' };
  const from = addDaysStr(o.end_date, 1);
  const to = addDaysStr(o.end_date, UNIT_DAYS);
  const free = await slotFree(o.slot_kind, o.sido, o.process, from, to, o.id);
  if (free === null) return { ok: false, error: '지금은 연장을 받을 수 없어요(준비 중)' };
  if (!free) return { ok: false, error: '다음 30일은 자리가 다 찼어요' };
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '지금은 연장을 받을 수 없어요(준비 중)' };
  const q = quote(o.slot_kind, 1);
  const paymentId = newPaymentId(crypto.randomUUID());
  const db = toDbSlot(o.slot_kind, o.process);
  const { error } = await sb.from('partner_payments').insert({
    payment_id: paymentId, advertiser_id: advertiserId, kind: 'extend', order_id: o.id, slot_kind: db.slot_kind,
    sido: o.sido, process: db.process, units: 1, amount: q.amount, vat: q.vat, total: q.total,
  });
  if (error) return { ok: false, error: '지금은 연장을 받을 수 없어요(준비 중)' };
  return { ok: true, data: { paymentId, orderName: orderNameOf(o.slot_kind, o.sido, o.process, 1, true), total: q.total } };
}

/**
 * 결제 확인(결제 확인 API·웹훅 공용).
 *   advertiserId 가 있으면 그 업체 결제만(브라우저 확인), null 이면 업체 제한 없음(웹훅).
 *   돌려주는 값: done(처리 끝·이미 끝남) / wait(아직 결제 전) / 오류 문구
 */
export async function finalizePayment(paymentId: string, advertiserId: number | null): Promise<Res<'done' | 'wait'>> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '준비 중이에요' };
  const { data: row } = await sb.from('partner_payments').select('*').eq('payment_id', paymentId).maybeSingle();
  if (!row || (advertiserId != null && Number(row.advertiser_id) !== advertiserId)) return { ok: false, error: '결제를 찾지 못했어요' };
  if (row.status === 'paid') return { ok: true, data: 'done' };
  if (row.status !== 'ready') return { ok: false, error: '처리할 수 없는 결제예요' };

  // 포트원에 직접 다시 물어본다(브라우저·웹훅 내용은 믿지 않음)
  const p = await fetchPayment(paymentId);
  if (!p) return { ok: false, error: '결제 확인에 실패했어요. 잠시 뒤 결제 기록을 확인해 주세요' };
  if (p.status !== 'PAID') {
    if (p.status === 'FAILED' || p.status === 'CANCELLED') {
      await sb.from('partner_payments').update({ status: 'failed', fail_reason: p.status }).eq('payment_id', paymentId).eq('status', 'ready');
      return { ok: false, error: '결제가 완료되지 않았어요' };
    }
    return { ok: true, data: 'wait' };
  }
  // 금액이 다르면(위조 의심) 취소하고 실패 처리
  if (p.total !== Number(row.total)) {
    await cancelPayment(paymentId, '결제 금액 불일치');
    await sb.from('partner_payments').update({ status: 'failed', fail_reason: 'amount_mismatch' }).eq('payment_id', paymentId).eq('status', 'ready');
    return { ok: false, error: '결제 금액이 달라 취소했어요' };
  }

  // 'ready' → 'paid' 를 먼저 잡는다. 여기서 바뀐 줄이 없으면 다른 요청이 이미 처리한 것
  const nowIso = new Date().toISOString();
  const { data: claimed } = await sb
    .from('partner_payments')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('payment_id', paymentId)
    .eq('status', 'ready')
    .select('payment_id');
  if (!claimed?.length) return { ok: true, data: 'done' };

  // 결제 기록은 DB 저장 방식 → 화면 자리 종류(AD-T 가격·기간 계산용)
  const kind = fromDbSlot(String(row.slot_kind), row.process as string | null);
  const screenProcess = kind === 'AD-T' ? null : (row.process as string | null);
  const units = Number(row.units);
  if (row.kind === 'new') {
    const today = kstToday();
    const c = calcOrder(kind, today, units);
    // 결제하는 사이 자리가 찼으면 바로 카드 취소
    const free = await slotFree(kind, row.sido, screenProcess, today, c.endDate);
    if (free === false) {
      const ok = await cancelPayment(paymentId, '광고 자리 마감');
      await sb.from('partner_payments').update({ status: ok ? 'refunded' : 'paid', refunded_at: ok ? nowIso : null, fail_reason: 'slot_full' }).eq('payment_id', paymentId);
      return { ok: false, error: ok ? '방금 자리가 다 차서 카드 결제를 취소했어요' : '자리가 다 찼어요. 환불은 따로 처리해 드릴게요' };
    }
    const { data: ord, error } = await sb
      .from('ad_orders')
      .insert({
        advertiser_id: Number(row.advertiser_id), slot_kind: row.slot_kind, sido: row.sido, process: row.process, // 결제 기록에 이미 DB 저장 방식으로 들어 있음
        start_date: today, end_date: c.endDate, units: Number(row.units), amount: Number(row.amount), vat: Number(row.vat),
        pay_method: 'card', pay_status: 'paid', paid_at: nowIso, pay_ref: paymentId, run_status: 'review',
        banner_path: row.banner_path, click_url: row.click_url, phone: row.phone,
      })
      .select('id')
      .single();
    if (error || !ord) {
      // 돈은 받았는데 주문을 못 만든 경우 — 기록에 남겨 관리자가 처리
      await sb.from('partner_payments').update({ fail_reason: 'order_insert_failed' }).eq('payment_id', paymentId);
      return { ok: false, error: '결제는 됐지만 광고 등록에 실패했어요. 곧 연락드릴게요' };
    }
    await sb.from('partner_payments').update({ order_id: Number(ord.id) }).eq('payment_id', paymentId);
    return { ok: true, data: 'done' };
  }

  // 연장: 마지막 날·단위·금액을 늘린다
  const o = await myOrder(Number(row.advertiser_id), Number(row.order_id));
  if (!o) {
    await sb.from('partner_payments').update({ fail_reason: 'order_missing' }).eq('payment_id', paymentId);
    return { ok: false, error: '결제는 됐지만 연장할 광고를 찾지 못했어요. 곧 연락드릴게요' };
  }
  const { error } = await sb
    .from('ad_orders')
    .update({
      end_date: addDaysStr(o.end_date, units * UNIT_DAYS),
      units: Math.min(24, o.units + units),
      amount: o.amount + Number(row.amount),
      vat: o.vat + Number(row.vat),
    })
    .eq('id', o.id);
  if (error) {
    await sb.from('partner_payments').update({ fail_reason: 'extend_failed' }).eq('payment_id', paymentId);
    return { ok: false, error: '결제는 됐지만 연장 저장에 실패했어요. 곧 연락드릴게요' };
  }
  return { ok: true, data: 'done' };
}

/**
 * 환불(관리자가 반려할 때) — 뼈대.
 *   포트원 결제 전액 취소 → 결제 기록 'refunded' → 새 광고면 주문 환불·중지, 연장이면 늘린 기간을 되돌린다.
 *   TODO: 관리자 화면(광고 주문 반려 단추)에 연결은 관리자 화면 담당 작업자가 한다.
 */
export async function refundPayment(paymentId: string, reason: string): Promise<Res<null>> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '준비 중이에요' };
  const { data: row } = await sb.from('partner_payments').select('*').eq('payment_id', paymentId).maybeSingle();
  if (!row) return { ok: false, error: '결제를 찾지 못했어요' };
  if (row.status !== 'paid') return { ok: false, error: '결제 완료 건만 환불할 수 있어요' };
  const ok = await cancelPayment(paymentId, reason.slice(0, 200) || '광고 반려');
  if (!ok) return { ok: false, error: '포트원 결제 취소에 실패했어요' };
  const nowIso = new Date().toISOString();
  await sb.from('partner_payments').update({ status: 'refunded', refunded_at: nowIso }).eq('payment_id', paymentId);
  if (row.order_id) {
    if (row.kind === 'new') {
      await sb.from('ad_orders').update({ pay_status: 'refunded', run_status: 'stopped', note: `카드 환불: ${reason}`.slice(0, 300) }).eq('id', row.order_id);
    } else {
      const o = await myOrder(Number(row.advertiser_id), Number(row.order_id));
      if (o) {
        await sb.from('ad_orders').update({
          end_date: addDaysStr(o.end_date, -Number(row.units) * UNIT_DAYS),
          units: Math.max(1, o.units - Number(row.units)),
          amount: Math.max(0, o.amount - Number(row.amount)),
          vat: Math.max(0, o.vat - Number(row.vat)),
        }).eq('id', o.id);
      }
    }
  }
  return { ok: true, data: null };
}
