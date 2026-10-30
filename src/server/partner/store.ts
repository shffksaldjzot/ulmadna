// ─────────────────────────────────────────────────────────────
// 광고주 셀프 화면 데이터 읽기·쓰기 (서버 전용) — 2026년 10월 31일
//
// [무슨 기능인가]
//   업체 계정(partner_accounts)·세션(partner_sessions)·카드 결제(partner_payments) 표와
//   기존 광고 표(advertisers·ad_orders·ad_events)를 서비스 역할 열쇠로 읽고 쓴다.
//   표 정의: supabase/migrations/20261031_partner_accounts.sql (형아 OK 뒤 실행)
//
// [안전 규칙]
//   - 모든 조회에 .eq('advertiser_id', 로그인한 업체) 를 넣어 "내 것만" 보게 한다.
//   - 표가 없거나 연결이 안 되면 예외 대신 null / 오류 문구를 돌려준다(화면은 "준비 중" 한 줄).
// ─────────────────────────────────────────────────────────────
import 'server-only';
import { adminOrNull } from '@/lib/ask/server';
import { bannerUrl } from '@/server/ads/store';
import { lastDays } from '@/lib/partner/rules';
import { fromDbSlot, type SlotKind } from '@/lib/ads/pricing';
import { firstFreeLeft, isFirstFreeEligible } from '@/lib/ads/promo';
import { hashToken, isTokenShape } from './crypto';

/** 배너 보관함 이름(관리자 업로드와 같은 곳) */
export const BUCKET = 'ad-banners';

/** 로그인한 업체 정보(화면용) */
export interface Partner {
  advertiserId: number;
  name: string;
  email: string;
  region: string;
  bizNo: string;
}

/** 제작 요청 내용(주문에 JSON 으로 저장됨) */
export interface DesignBrief {
  name?: string;
  phone?: string | null;
  intro?: string;
  headline?: string;
  mood?: string;
  logo_path?: string | null;
}

/** 내 주문 한 줄(화면용) */
export interface MyOrder {
  id: number;
  slot_kind: SlotKind;
  sido: string;
  process: string | null;
  start_date: string;
  end_date: string;
  units: number;
  amount: number;
  vat: number;
  pay_status: string;
  run_status: string;
  note: string | null;
  bannerUrl: string | null;
  /** 제작 대행 주문인지(SQL 20261101 실행 전엔 항상 false) */
  design_requested: boolean;
  /** 배너 그림이 있는지(배지 '배너 제작 중' 판정용) */
  has_banner: boolean;
  /** 제작 요청 내용(제작 대행 주문만, 2026-10-30) */
  design_brief: DesignBrief | null;
  impressions: number;
  clicks: number;
}

/** 결제 한 줄(화면용) */
export interface MyPayment {
  payment_id: string;
  kind: 'new' | 'extend';
  order_id: number | null;
  slot_kind: SlotKind;
  sido: string;
  process: string | null;
  units: number;
  amount: number;
  vat: number;
  total: number;
  status: 'ready' | 'paid' | 'failed' | 'refunded';
  paid_at: string | null;
  refunded_at: string | null;
  tax_invoice_requested_at: string | null;
  created_at: string;
}

type Res<T = undefined> = { ok: true; data: T } | { ok: false; error: string; code?: string };

// ── 계정 ─────────────────────────────────────

/** 가입: advertisers 한 줄 + partner_accounts 한 줄. 두 번째가 실패하면 첫 줄을 지운다 */
export async function createAccount(input: {
  name: string;
  bizNo: string;
  region: string;
  email: string;
  passwordHash: string;
  /** 가입 때 국세청 상태조회 결과(2026-10-30). 'active' 확인됨 / 'unchecked' 국세청 장애로 통과 */
  bizStatus?: 'active' | 'unchecked';
}): Promise<Res<{ advertiserId: number }>> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '지금은 가입을 받을 수 없어요(준비 중)', code: 'down' };
  // 같은 이메일이 이미 있는지 먼저 본다
  const { data: dup, error: e0 } = await sb.from('partner_accounts').select('id').eq('email', input.email).maybeSingle();
  if (e0) return { ok: false, error: '지금은 가입을 받을 수 없어요(준비 중)', code: 'down' };
  if (dup) return { ok: false, error: '이미 가입된 이메일이에요', code: 'dup' };

  const { data: adv, error: e1 } = await sb
    .from('advertisers')
    .insert({ name: input.name, biz_no: input.bizNo, email: input.email, memo: '광고주 셀프 가입(/partner)' })
    .select('id')
    .single();
  if (e1 || !adv) return { ok: false, error: '가입을 저장하지 못했어요', code: 'down' };
  const advertiserId = Number(adv.id);
  const row = {
    advertiser_id: advertiserId,
    email: input.email,
    password_hash: input.passwordHash,
    biz_no: input.bizNo,
    region: input.region,
  };
  let { error: e2 } = await sb.from('partner_accounts').insert({ ...row, biz_status: input.bizStatus ?? 'unchecked' });
  // biz_status 칸이 아직 없으면(20261030_partner_biz_status.sql 실행 전) 그 칸 없이 다시 넣는다
  if (e2 && ['42703', 'PGRST204'].includes((e2 as { code?: string }).code ?? '')) {
    ({ error: e2 } = await sb.from('partner_accounts').insert(row));
  }
  if (e2) {
    await sb.from('advertisers').delete().eq('id', advertiserId); // 반쪽 가입을 남기지 않는다
    const dupErr = (e2 as { code?: string }).code === '23505';
    return { ok: false, error: dupErr ? '이미 가입된 이메일이에요' : '가입을 저장하지 못했어요', code: dupErr ? 'dup' : 'down' };
  }
  return { ok: true, data: { advertiserId } };
}

/** 로그인용: 이메일로 계정 찾기. 없으면 data=null, 연결 실패면 ok=false */
export async function findAccount(email: string): Promise<Res<{ advertiserId: number; passwordHash: string; status: string } | null>> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '준비 중' };
  const { data, error } = await sb.from('partner_accounts').select('advertiser_id,password_hash,status').eq('email', email).maybeSingle();
  if (error) return { ok: false, error: '준비 중' };
  if (!data) return { ok: true, data: null };
  return { ok: true, data: { advertiserId: Number(data.advertiser_id), passwordHash: String(data.password_hash), status: String(data.status) } };
}

/** 세션 저장 + 마지막 로그인 시각 기록 */
export async function saveSession(advertiserId: number, hash: string, expiresAt: Date): Promise<boolean> {
  const sb = adminOrNull();
  if (!sb) return false;
  const { error } = await sb.from('partner_sessions').insert({ token_hash: hash, advertiser_id: advertiserId, expires_at: expiresAt.toISOString() });
  if (error) return false;
  await sb.from('partner_accounts').update({ last_login_at: new Date().toISOString() }).eq('advertiser_id', advertiserId);
  // 만료된 세션은 이참에 지운다(실패해도 상관없음)
  await sb.from('partner_sessions').delete().lt('expires_at', new Date().toISOString());
  return true;
}

/** 로그아웃: 세션 지우기 */
export async function dropSession(token: string | undefined): Promise<void> {
  const sb = adminOrNull();
  if (!sb || !isTokenShape(token)) return;
  await sb.from('partner_sessions').delete().eq('token_hash', hashToken(token));
}

/** 세션 조회 결과 */
export type PartnerState = { state: 'ok'; partner: Partner } | { state: 'none' } | { state: 'down' };

/**
 * 쿠키 값 → 로그인한 업체.
 *   state 'ok'   : 로그인 됨
 *   state 'none' : 세션 없음·만료·차단(로그인 화면으로)
 *   state 'down' : DB 연결 실패·표 없음(화면에 "준비 중")
 */
export async function partnerFromToken(token: string | undefined): Promise<PartnerState> {
  if (!isTokenShape(token)) return { state: 'none' };
  const sb = adminOrNull();
  if (!sb) return { state: 'down' };
  const { data: s, error } = await sb.from('partner_sessions').select('advertiser_id,expires_at').eq('token_hash', hashToken(token)).maybeSingle();
  if (error) return { state: 'down' };
  if (!s || new Date(String(s.expires_at)).getTime() < Date.now()) return { state: 'none' };
  const advertiserId = Number(s.advertiser_id);
  const [{ data: acc, error: e1 }, { data: adv }] = await Promise.all([
    sb.from('partner_accounts').select('email,region,biz_no,status').eq('advertiser_id', advertiserId).maybeSingle(),
    sb.from('advertisers').select('name').eq('id', advertiserId).maybeSingle(),
  ]);
  if (e1) return { state: 'down' };
  if (!acc || acc.status !== 'active') return { state: 'none' };
  return {
    state: 'ok',
    partner: { advertiserId, name: String(adv?.name ?? ''), email: String(acc.email), region: String(acc.region), bizNo: String(acc.biz_no) },
  };
}

// ── 내 광고 ───────────────────────────────────

/** 일별 숫자 한 줄 */
export interface DayEvent {
  order_id: number;
  day: string;
  impressions: number;
  clicks: number;
}

/** 내 주문 목록 + 주문별 노출·클릭 합계 + 최근 14일 일별 숫자. 실패하면 null */
export async function myAds(advertiserId: number, today: string): Promise<{ orders: MyOrder[]; events: DayEvent[] } | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  // 제작 대행 칸(design_requested)까지 읽는다. 칸이 아직 없는 DB(SQL 20261101 실행 전)면 빼고 다시 읽는다
  const cols = 'id,slot_kind,sido,process,start_date,end_date,units,amount,vat,pay_status,run_status,note,banner_path';
  const read = (withDesign: boolean) =>
    sb
      .from('ad_orders')
      .select(withDesign ? `${cols},design_requested,design_brief` : cols)
      .eq('advertiser_id', advertiserId)
      .order('id', { ascending: false })
      .limit(200);
  let { data, error } = await read(true);
  if (error) ({ data, error } = await read(false));
  if (error) return null;
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const ids = rows.map((r) => Number(r.id));
  const from = lastDays(today, 14)[0];
  const events: DayEvent[] = [];
  const total = new Map<number, { i: number; c: number }>();
  if (ids.length) {
    const { data: ev } = await sb.from('ad_events').select('order_id,day,impressions,clicks').in('order_id', ids).limit(20000);
    for (const e of ev ?? []) {
      const k = Number(e.order_id);
      const t = total.get(k) ?? { i: 0, c: 0 };
      t.i += Number(e.impressions);
      t.c += Number(e.clicks);
      total.set(k, t);
      if (String(e.day) >= from) events.push({ order_id: k, day: String(e.day), impressions: Number(e.impressions), clicks: Number(e.clicks) });
    }
  }
  const orders: MyOrder[] = rows.map((r) => ({
    id: Number(r.id),
    // DB 의 'AD-P + 토탈 인테리어' 는 화면에서 AD-T(공정 칸은 비움)
    slot_kind: fromDbSlot(String(r.slot_kind), r.process as string | null),
    sido: String(r.sido),
    process: fromDbSlot(String(r.slot_kind), r.process as string | null) === 'AD-T' ? null : ((r.process as string | null) ?? null),
    start_date: String(r.start_date),
    end_date: String(r.end_date),
    units: Number(r.units),
    amount: Number(r.amount),
    vat: Number(r.vat),
    pay_status: String(r.pay_status),
    run_status: String(r.run_status),
    note: (r.note as string | null) ?? null,
    bannerUrl: bannerUrl(sb, (r.banner_path as string | null) ?? null),
    design_requested: r.design_requested === true,
    has_banner: !!r.banner_path,
    design_brief: r.design_requested === true && r.design_brief && typeof r.design_brief === 'object' ? (r.design_brief as DesignBrief) : null,
    impressions: total.get(Number(r.id))?.i ?? 0,
    clicks: total.get(Number(r.id))?.c ?? 0,
  }));
  return { orders, events };
}

/** 내 주문 한 건(본인 것만). 없거나 실패하면 null */
export async function myOrder(advertiserId: number, orderId: number): Promise<{
  id: number; slot_kind: SlotKind; sido: string; process: string | null; start_date: string; end_date: string;
  units: number; amount: number; vat: number; pay_status: string; run_status: string;
} | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data } = await sb
    .from('ad_orders')
    .select('id,slot_kind,sido,process,start_date,end_date,units,amount,vat,pay_status,run_status')
    .eq('id', orderId)
    .eq('advertiser_id', advertiserId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: Number(data.id),
    slot_kind: fromDbSlot(String(data.slot_kind), data.process as string | null),
    sido: String(data.sido),
    process: fromDbSlot(String(data.slot_kind), data.process as string | null) === 'AD-T' ? null : ((data.process as string | null) ?? null),
    start_date: String(data.start_date),
    end_date: String(data.end_date),
    units: Number(data.units),
    amount: Number(data.amount),
    vat: Number(data.vat),
    pay_status: String(data.pay_status),
    run_status: String(data.run_status),
  };
}

// ── 배너 제작 대행 ─────────────────────────────

/**
 * 이 광고주의 제작 대행이 "첫 회 무료"인가(2026-10-29)
 *   이전 주문(ad_orders)에 design_requested=true 가 한 줄이라도 있으면 false.
 *   칸이 아직 없으면(20261101_ads_design.sql 실행 전, 오류 42703) 맡긴 적이 없는 것이므로 true.
 *   그 밖의 연결 실패는 null(판정 불가 — 결제 준비에서 막는다).
 */
export async function designFirstFree(advertiserId: number): Promise<boolean | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb
    .from('ad_orders')
    .select('id')
    .eq('advertiser_id', advertiserId)
    .eq('design_requested', true)
    .limit(1);
  if (error) return (error as { code?: string }).code === '42703' ? true : null;
  return !data?.length;
}

// ── 결제 기록 ─────────────────────────────────

/** 내 결제 목록(최근 순). 실패하면 null */
export async function myPayments(advertiserId: number): Promise<MyPayment[] | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb
    .from('partner_payments')
    .select('payment_id,kind,order_id,slot_kind,sido,process,units,amount,vat,total,status,paid_at,refunded_at,tax_invoice_requested_at,created_at')
    .eq('advertiser_id', advertiserId)
    .neq('status', 'ready') // 결제창만 열고 닫은 건은 기록에 안 보인다
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return null;
  // 결제 기록도 DB 저장 방식(AD-P + 토탈 인테리어)이라 화면용 AD-T 로 바꾼다
  return ((data ?? []) as MyPayment[]).map((p) => {
    const k = fromDbSlot(p.slot_kind, p.process);
    return { ...p, slot_kind: k, process: k === 'AD-T' ? null : p.process };
  });
}

/** 세금계산서 요청 기록(결제 완료 건만, 한 번만) */
export async function requestTaxInvoice(advertiserId: number, paymentId: string): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '준비 중이에요' };
  const { data, error } = await sb
    .from('partner_payments')
    .update({ tax_invoice_requested_at: new Date().toISOString() })
    .eq('payment_id', paymentId)
    .eq('advertiser_id', advertiserId)
    .eq('status', 'paid')
    .is('tax_invoice_requested_at', null)
    .select('payment_id');
  if (error) return { ok: false, error: '저장하지 못했어요' };
  if (!data?.length) return { ok: false, error: '이미 요청했거나 결제 완료 건이 아니에요' };
  return { ok: true, data: undefined };
}

// ── 오픈 기념 첫 광고주 무료(2026-10-30) ───────────────────

/** 결제한 적 있는 광고주 수(ad_orders 에 pay_status='paid' 주문이 있는 광고주). 읽기 실패면 null */
export async function paidAdvertiserCount(): Promise<number | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb.from('ad_orders').select('advertiser_id').eq('pay_status', 'paid').limit(5000);
  if (error) return null;
  return new Set((data ?? []).map((r) => Number(r.advertiser_id))).size;
}

/**
 * 무료 프로모션 상태: left=남은 곳(0이면 끝·꺼짐), eligible=이 광고주가 지금 첫 달 무료 대상인가.
 *   advertiserId 가 없으면(공개 화면) eligible 은 false. 읽기 실패면 null(결제 준비에서 막음, 공개 화면은 줄 숨김).
 */
export async function firstFreeInfo(advertiserId: number | null): Promise<{ left: number; eligible: boolean } | null> {
  const paid = await paidAdvertiserCount();
  if (paid === null) return null;
  let mine = 1; // 모르면 "이미 주문 있음"으로 둬 무료로 새지 않게
  if (advertiserId != null) {
    const sb = adminOrNull();
    if (!sb) return null;
    const { count, error } = await sb.from('ad_orders').select('id', { count: 'exact', head: true }).eq('advertiser_id', advertiserId);
    if (error) return null;
    mine = count ?? 0;
  }
  return { left: firstFreeLeft(paid), eligible: advertiserId != null && isFirstFreeEligible(paid, mine) };
}
