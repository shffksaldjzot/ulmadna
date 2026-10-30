// ─────────────────────────────────────────────────────────────
// 관리자 · 광고주 관리 데이터 (서버 전용) — 2026년 10월 30일
//
// [무슨 기능인가]
//   광고주 셀프 가입(partner_accounts)이 생겨서, 관리자가 광고주를 한눈에 보고 다루는 데이터 층.
//   - 목록: 광고주 한 줄(계정·주문 수·결제 합계·상태·메모 앞부분)
//   - 상세: 계정 정보 + 주문 + 결제·환불 내역
//   - 쓰기: 메모 고치기 · 정지/활성 · 임시 비밀번호 발급 · 주문 반려(환불)
//   비밀번호 해시는 어디서도 밖으로 내보내지 않는다.
//   표가 없거나 연결이 안 되면 예외 대신 null / 오류 문구를 돌려준다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import crypto from 'crypto';
import { adminOrNull } from '@/lib/ask/server';
import { fromDbSlot } from '@/lib/ads/pricing';
import { hashPassword } from '@/server/partner/crypto';
import { refundPayment } from '@/server/partner/pay';
import { setPayStatus } from '@/server/ads/store';

// ── 타입 ─────────────────────────────────────
/** 목록 한 줄 */
export interface AdvRow {
  id: number;
  name: string;
  email: string;
  bizNo: string; // 000-00-00000 모양(없으면 '')
  bizStatus: string | null; // 사업자 상태(칸이 없거나 비면 null → 화면 '-')
  region: string; // 시도 번호(없으면 '')
  createdAt: string;
  lastLoginAt: string | null;
  orders: { review: number; live: number; ended: number; total: number };
  paidTotal: number; // 결제 합계(공급가+부가세, 환불 제외)
  status: 'active' | 'blocked' | 'none'; // none = 계정 없음(관리자가 손으로 등록한 광고주)
  memo: string;
}

export interface AdvOrderRow {
  id: number;
  slot_kind: string;
  sido: string;
  process: string | null;
  start_date: string;
  end_date: string;
  total: number; // 공급가 + 부가세
  pay_status: string;
  pay_method: string;
  run_status: string;
  impressions: number;
  clicks: number;
  /** 이 주문의 카드 결제 번호(반려 때 환불에 쓴다). 계좌이체 주문이면 null */
  paymentId: string | null;
}

export interface AdvPaymentRow {
  payment_id: string;
  kind: string;
  order_id: number | null;
  total: number;
  status: string;
  paid_at: string | null;
  refunded_at: string | null;
  tax_invoice_requested_at: string | null;
  created_at: string;
}

export interface AdvDetail extends AdvRow {
  ceo: string | null;
  phone: string | null;
  agreedAt: string | null;
  orderList: AdvOrderRow[];
  payments: AdvPaymentRow[];
}

type Res<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** 숫자 10자리 → 000-00-00000 */
function fmtBiz(v: unknown): string {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : String(v ?? '');
}

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

// ── 목록 ─────────────────────────────────────
/** 광고주 목록(가입일 최신순). 실패하면 null */
export async function listAdminAdvertisers(): Promise<AdvRow[] | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const [advR, accR, ordR, payR] = await Promise.all([
    sb.from('advertisers').select('*').order('id', { ascending: false }).limit(2000),
    // 계정 표: biz_status 칸이 아직 없을 수 있어 * 로 읽는다(비밀번호 해시는 아래에서 쓰지 않는다)
    sb.from('partner_accounts').select('*').limit(2000),
    sb.from('ad_orders').select('advertiser_id,run_status,pay_status,pay_method,amount,vat').limit(20000),
    sb.from('partner_payments').select('advertiser_id,status,total').limit(20000),
  ]);
  if (advR.error) return null;
  // 계정·결제 표가 없어도(SQL 미실행) 광고주 목록 자체는 보여 준다
  const accs = new Map<number, Record<string, unknown>>();
  for (const a of accR.data ?? []) accs.set(num(a.advertiser_id), a);
  const ords = new Map<number, AdvRow['orders']>();
  const paid = new Map<number, number>();
  for (const o of ordR.data ?? []) {
    const k = num(o.advertiser_id);
    const c = ords.get(k) ?? { review: 0, live: 0, ended: 0, total: 0 };
    c.total += 1;
    if (o.run_status === 'review') c.review += 1;
    else if (o.run_status === 'live') c.live += 1;
    else c.ended += 1; // 종료·중지
    ords.set(k, c);
    // 카드 결제는 아래 결제 표에서 센다. 계좌이체 입금 확인분만 주문에서 더한다
    if (o.pay_method === 'bank' && o.pay_status === 'paid') paid.set(k, (paid.get(k) ?? 0) + num(o.amount) + num(o.vat));
  }
  for (const p of payR.data ?? []) {
    // 환불된 결제는 상태가 refunded 로 바뀌므로 paid 만 더하면 "결제 − 환불"이 된다
    if (p.status === 'paid') paid.set(num(p.advertiser_id), (paid.get(num(p.advertiser_id)) ?? 0) + num(p.total));
  }
  const rows: AdvRow[] = (advR.data ?? []).map((a) => {
    const id = num(a.id);
    const acc = accs.get(id);
    const bs = acc?.biz_status;
    return {
      id,
      name: String(a.name ?? ''),
      email: String(acc?.email ?? a.email ?? ''),
      bizNo: fmtBiz(acc?.biz_no ?? a.biz_no),
      bizStatus: typeof bs === 'string' && bs ? bs : null,
      region: String(acc?.region ?? ''),
      createdAt: String(acc?.created_at ?? a.created_at ?? ''),
      lastLoginAt: acc?.last_login_at ? String(acc.last_login_at) : null,
      orders: ords.get(id) ?? { review: 0, live: 0, ended: 0, total: 0 },
      paidTotal: paid.get(id) ?? 0,
      status: acc ? (acc.status === 'blocked' ? 'blocked' : 'active') : 'none',
      memo: String(a.memo ?? ''),
    };
  });
  // 가입일 최신순
  rows.sort((x, y) => (y.createdAt > x.createdAt ? 1 : y.createdAt < x.createdAt ? -1 : y.id - x.id));
  return rows;
}

// ── 상세 ─────────────────────────────────────
/** 광고주 한 곳의 상세. 없거나 실패하면 null */
export async function getAdminAdvertiser(id: number): Promise<AdvDetail | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const list = await listAdminAdvertisers();
  const base = list?.find((r) => r.id === id);
  if (!base) return null;
  const [advR, accR, ordR, payR] = await Promise.all([
    sb.from('advertisers').select('ceo,phone').eq('id', id).maybeSingle(),
    sb.from('partner_accounts').select('agreed_at').eq('advertiser_id', id).maybeSingle(),
    sb.from('ad_orders').select('*').eq('advertiser_id', id).order('id', { ascending: false }).limit(300),
    sb
      .from('partner_payments')
      .select('payment_id,kind,order_id,total,status,paid_at,refunded_at,tax_invoice_requested_at,created_at')
      .eq('advertiser_id', id)
      .neq('status', 'ready') // 결제창만 열고 닫은 건은 뺀다
      .order('created_at', { ascending: false })
      .limit(300),
  ]);
  const payments: AdvPaymentRow[] = (payR.data ?? []).map((p) => ({
    payment_id: String(p.payment_id),
    kind: String(p.kind),
    order_id: p.order_id == null ? null : num(p.order_id),
    total: num(p.total),
    status: String(p.status),
    paid_at: p.paid_at ? String(p.paid_at) : null,
    refunded_at: p.refunded_at ? String(p.refunded_at) : null,
    tax_invoice_requested_at: p.tax_invoice_requested_at ? String(p.tax_invoice_requested_at) : null,
    created_at: String(p.created_at),
  }));
  const ordRows = ordR.data ?? [];
  // 노출·클릭 합
  const imp = new Map<number, number>();
  const clk = new Map<number, number>();
  const ids = ordRows.map((o) => num(o.id));
  if (ids.length) {
    const { data: ev } = await sb.from('ad_events').select('order_id,impressions,clicks').in('order_id', ids).limit(20000);
    for (const e of ev ?? []) {
      const k = num(e.order_id);
      imp.set(k, (imp.get(k) ?? 0) + num(e.impressions));
      clk.set(k, (clk.get(k) ?? 0) + num(e.clicks));
    }
  }
  // 주문별 카드 결제 번호(새 광고 결제 중 paid 인 것)
  const payOf = new Map<number, string>();
  for (const p of payments) if (p.order_id != null && p.kind === 'new' && p.status === 'paid') payOf.set(p.order_id, p.payment_id);
  const orderList: AdvOrderRow[] = ordRows.map((o) => ({
    id: num(o.id),
    slot_kind: fromDbSlot(String(o.slot_kind), (o.process as string | null) ?? null),
    sido: String(o.sido),
    process: (o.process as string | null) ?? null,
    start_date: String(o.start_date),
    end_date: String(o.end_date),
    total: num(o.amount) + num(o.vat),
    pay_status: String(o.pay_status),
    pay_method: String(o.pay_method),
    run_status: String(o.run_status),
    impressions: imp.get(num(o.id)) ?? 0,
    clicks: clk.get(num(o.id)) ?? 0,
    paymentId: payOf.get(num(o.id)) ?? null,
  }));
  return {
    ...base,
    ceo: (advR.data?.ceo as string | null) ?? null,
    phone: (advR.data?.phone as string | null) ?? null,
    agreedAt: accR.data?.agreed_at ? String(accR.data.agreed_at) : null,
    orderList,
    payments,
  };
}

// ── 쓰기 ─────────────────────────────────────
/** 관리자 메모 저장(최대 500자) */
export async function saveMemo(id: number, memo: unknown): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const t = typeof memo === 'string' ? memo.trim().slice(0, 500) : '';
  const { error } = await sb.from('advertisers').update({ memo: t || null }).eq('id', id);
  return error ? { ok: false, error: '저장하지 못했어요' } : { ok: true, data: undefined };
}

/** 계정 정지(blocked)/활성(active). 정지하면 로그인 세션도 모두 지운다 */
export async function setAccountStatus(id: number, status: 'active' | 'blocked'): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const { data, error } = await sb.from('partner_accounts').update({ status }).eq('advertiser_id', id).select('id');
  if (error) return { ok: false, error: '저장하지 못했어요' };
  if (!data?.length) return { ok: false, error: '로그인 계정이 없는 광고주예요' };
  if (status === 'blocked') await sb.from('partner_sessions').delete().eq('advertiser_id', id);
  return { ok: true, data: undefined };
}

/** 임시 비밀번호 만들기(헷갈리는 글자 0·O·1·l·I 뺀 12자, 영문 대소문자+숫자) */
function makeTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const buf = crypto.randomBytes(12);
  return Array.from(buf, (b) => chars[b % chars.length]).join('');
}

/** 메일을 보낼 수 있는 상태인지(Resend 값 둘 다 있을 때) */
function mailReady(): boolean {
  return !!(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim());
}

/** 임시 비밀번호 메일(성공 여부만). 실패 이유에 주소·열쇠는 남기지 않는다 */
async function sendTempMail(to: string, name: string, pw: string): Promise<boolean> {
  if (!mailReady()) return false;
  const safe = name.replace(/[<>&"]/g, '');
  const text = [
    `${name} 님, 임시 비밀번호를 보내드려요.`,
    '',
    `임시 비밀번호: ${pw}`,
    '',
    '로그인 뒤 바로 새 비밀번호로 바꿔 주세요. 직접 요청하지 않았다면 문의 부탁드려요.',
    '— 얼마드나',
  ].join('\n');
  const html = `<div style="font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#2A2018">
<p style="font-size:16px;margin:0 0 12px"><b>${safe}</b> 님, 임시 비밀번호를 보내드려요.</p>
<p style="font-size:22px;letter-spacing:1px;font-weight:700;margin:0 0 16px">${pw}</p>
<p style="font-size:13px;color:#6B5D4F;margin:0">로그인 뒤 바로 새 비밀번호로 바꿔 주세요. — 얼마드나</p></div>`;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM!.trim(), to: [to], subject: '[얼마드나] 임시 비밀번호 안내', text, html }),
      cache: 'no-store',
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * 비밀번호 재설정: 임시 비밀번호를 만들어 해시 저장 + 로그인 세션 전부 삭제.
 *  메일 도구(Resend)가 켜져 있으면 메일로 보내고, 아니면 화면에 한 번 보여 준다(tempPassword).
 */
export async function resetPassword(id: number): Promise<Res<{ mailed: boolean; tempPassword?: string }>> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const { data: acc } = await sb.from('partner_accounts').select('email').eq('advertiser_id', id).maybeSingle();
  if (!acc) return { ok: false, error: '로그인 계정이 없는 광고주예요' };
  const { data: adv } = await sb.from('advertisers').select('name').eq('id', id).maybeSingle();
  const pw = makeTempPassword();
  const { error } = await sb.from('partner_accounts').update({ password_hash: await hashPassword(pw) }).eq('advertiser_id', id);
  if (error) return { ok: false, error: '저장하지 못했어요' };
  await sb.from('partner_sessions').delete().eq('advertiser_id', id); // 옛 로그인 모두 끊기
  const mailed = await sendTempMail(String(acc.email), String(adv?.name ?? '광고주'), pw);
  return { ok: true, data: mailed ? { mailed: true } : { mailed: false, tempPassword: pw } };
}

/**
 * 주문 반려: 카드 결제 주문이면 결제 전액 취소(refundPayment), 계좌이체 주문이면 환불 처리만 한다.
 *  어느 쪽이든 주문은 환불·중지가 된다. 광고주 소유 주문인지 먼저 확인한다.
 */
export async function rejectOrder(advertiserId: number, orderId: number, reason: string): Promise<Res<{ card: boolean }>> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const { data: o } = await sb.from('ad_orders').select('id,pay_status,pay_method').eq('id', orderId).eq('advertiser_id', advertiserId).maybeSingle();
  if (!o) return { ok: false, error: '주문을 찾지 못했어요' };
  if (o.pay_status === 'refunded') return { ok: false, error: '이미 환불된 주문이에요' };
  const why = reason.trim().slice(0, 200) || '관리자 반려';
  const { data: p } = await sb.from('partner_payments').select('payment_id').eq('order_id', orderId).eq('kind', 'new').eq('status', 'paid').maybeSingle();
  if (p) {
    const r = await refundPayment(String(p.payment_id), why);
    return r.ok ? { ok: true, data: { card: true } } : { ok: false, error: r.error };
  }
  // 카드 결제 기록이 없으면(계좌이체·무료) 주문만 환불·중지 처리
  const r = await setPayStatus(orderId, 'refunded', undefined);
  if (!r.ok) return { ok: false, error: r.error };
  await sb.from('ad_orders').update({ note: `반려: ${why}`.slice(0, 300) }).eq('id', orderId);
  return { ok: true, data: { card: false } };
}

// ── 대시보드 숫자 ─────────────────────────────
export interface AdvSummary {
  advertisers: number;
  reviewOrders: number;
  monthPaid: number; // 이달 결제(카드 paid + 계좌이체 입금 확인, 공급가+부가세)
}

/** 대시보드 작은 칸용 숫자. 못 읽으면 null */
export async function getAdvSummary(): Promise<AdvSummary | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  // 이달 1일 0시(한국 시간) 이후
  const kst = new Date(Date.now() + 9 * 3600000);
  const from = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00+09:00`;
  const [a, r, pay, bank] = await Promise.all([
    sb.from('advertisers').select('id', { count: 'exact', head: true }),
    sb.from('ad_orders').select('id', { count: 'exact', head: true }).eq('run_status', 'review'),
    sb.from('partner_payments').select('total').eq('status', 'paid').gte('paid_at', from).limit(20000),
    sb.from('ad_orders').select('amount,vat').eq('pay_method', 'bank').eq('pay_status', 'paid').gte('paid_at', from).limit(20000),
  ]);
  if (a.error) return null;
  const sum = (rows: Record<string, unknown>[] | null, f: (x: Record<string, unknown>) => number) => (rows ?? []).reduce((s, x) => s + f(x), 0);
  return {
    advertisers: a.count ?? 0,
    reviewOrders: r.error ? 0 : (r.count ?? 0),
    monthPaid: sum(pay.data, (x) => num(x.total)) + sum(bank.data, (x) => num(x.amount) + num(x.vat)),
  };
}
