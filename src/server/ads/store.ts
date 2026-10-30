// ─────────────────────────────────────────────────────────────
// 광고 운영 데이터 읽기·쓰기 (서버 전용) — 2026년 10월 29일
//
// [무슨 기능인가]
//   광고주·주문·일별 노출/클릭 표(supabase/migrations/20261029_ads_ops.sql)를 서비스 롤로
//   읽고 쓴다. 관리자 화면·관리자 API·사이트 광고 자리(serve)·클릭 경유(ad-click)가 쓴다.
//   - 서비스 롤 열쇠는 이 파일(서버)에서만 쓴다. 'server-only' 로 브라우저 번들 유입을 막는다.
//   - 표가 아직 없거나 연결이 안 돼도 예외를 던지지 않는다(읽기는 빈 값·null, 쓰기는 오류 문구).
//   - 사이트 광고 자리는 "광고가 없으면 아무 변화 없음"이 원칙이라, 실패하면 항상 null 을 돌려준다.
// ─────────────────────────────────────────────────────────────
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminOrNull } from '@/lib/ask/server';
import {
  SLOT_INFO,
  SLOT_KINDS,
  calcOrder,
  isDay,
  isHttpsUrl,
  isOrderSido,
  kstToday,
  SIDO_ALL,
  TOTAL_PROCESS,
  fromDbSlot,
  toDbSlot,
  type SlotKind,
} from '@/lib/ads/pricing';

const BUCKET = 'ad-banners';

// ── 타입 ─────────────────────────────────────
export interface Advertiser {
  id: number;
  name: string;
  ceo: string | null;
  biz_no: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
  created_at: string;
}

export interface AdOrder {
  id: number;
  advertiser_id: number;
  slot_kind: SlotKind;
  sido: string;
  process: string | null;
  start_date: string;
  end_date: string;
  units: number;
  amount: number;
  vat: number;
  pay_method: 'bank' | 'card';
  pay_status: 'pending' | 'paid' | 'refunded';
  paid_at: string | null;
  pay_ref: string | null;
  run_status: 'review' | 'live' | 'ended' | 'stopped';
  banner_path: string | null;
  /** PC 전용 그림 경로(AD-H·AD-F, 선택). 20261030_ads_desktop_banner.sql 실행 전엔 칸 자체가 없어 undefined */
  banner_desktop_path?: string | null;
  click_url: string | null;
  phone: string | null;
  note: string | null;
  created_at: string;
  /** 배너 제작 대행(2026-10-29) — 20261101_ads_design.sql 실행 전엔 칸이 없어 undefined */
  design_requested?: boolean;
  /** 제작 대행 입력 내용 {name, phone, intro, headline, logo_path} */
  design_brief?: { name?: string; phone?: string | null; intro?: string; headline?: string; logo_path?: string | null } | null;
  /** 제작비 공급가(원). amount 에 이미 더해져 있다 */
  design_fee?: number;
}

/** 주문 + 광고주 이름 + 노출·클릭 합계(화면용) */
export interface OrderRow extends AdOrder {
  advertiser_name: string;
  impressions: number;
  clicks: number;
}

/** 배너 파일 경로 → 공개 주소(네트워크 호출 없이 문자열만 만든다) */
export function bannerUrl(sb: SupabaseClient, path: string | null): string | null {
  if (!path) return null;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ── 읽기 (관리자 화면) ─────────────────────────
/** 광고주 목록. 실패하면 null */
export async function listAdvertisers(): Promise<Advertiser[] | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb.from('advertisers').select('*').order('id', { ascending: false }).limit(500);
  if (error) return null;
  return (data ?? []) as Advertiser[];
}

/** 주문 목록(최근 순) + 광고주 이름 + 노출·클릭 합계. 실패하면 null */
export async function listOrders(limit = 300): Promise<{ orders: OrderRow[]; bannerBase: (p: string | null) => string | null } | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data, error } = await sb.from('ad_orders').select('*').order('id', { ascending: false }).limit(limit);
  if (error) return null;
  const rows = (data ?? []) as AdOrder[];
  const ids = rows.map((r) => r.id);
  const advIds = [...new Set(rows.map((r) => r.advertiser_id))];
  const names = new Map<number, string>();
  if (advIds.length) {
    const { data: advs } = await sb.from('advertisers').select('id,name').in('id', advIds);
    for (const a of advs ?? []) names.set(Number(a.id), String(a.name));
  }
  const imp = new Map<number, number>();
  const clk = new Map<number, number>();
  if (ids.length) {
    const { data: ev } = await sb.from('ad_events').select('order_id,impressions,clicks').in('order_id', ids).limit(20000);
    for (const e of ev ?? []) {
      const k = Number(e.order_id);
      imp.set(k, (imp.get(k) ?? 0) + Number(e.impressions));
      clk.set(k, (clk.get(k) ?? 0) + Number(e.clicks));
    }
  }
  const orders: OrderRow[] = rows.map((r) => ({
    ...r,
    // DB 의 'AD-P + 토탈 인테리어' 주문은 화면에서 AD-T 로 보인다(pricing.ts toDbSlot 설명)
    slot_kind: fromDbSlot(r.slot_kind, r.process),
    advertiser_name: names.get(r.advertiser_id) ?? `#${r.advertiser_id}`,
    impressions: imp.get(r.id) ?? 0,
    clicks: clk.get(r.id) ?? 0,
  }));
  return { orders, bannerBase: (p) => bannerUrl(sb, p) };
}

/** 자리판 한 칸: 지금 차지한 업체 수 */
export type BoardMap = Record<string, Record<string, number>>; // [시도][자리종류] = 오늘 게재 기간에 걸친 주문 수

/**
 * 시도 x 자리 종류별 "오늘 걸쳐 있는" 주문 수(환불·중지·종료 제외, 결제 대기 포함 = 자리 잡힘).
 * 표가 없거나 실패하면 빈 판(= 전부 빈칸, 3/3)을 돌려준다.
 */
export async function getBoard(today: string = kstToday()): Promise<BoardMap> {
  const board: BoardMap = {};
  const sb = adminOrNull();
  if (!sb) return board;
  const { data, error } = await sb
    .from('ad_orders')
    .select('sido,slot_kind,process')
    .neq('pay_status', 'refunded')
    .in('run_status', ['review', 'live'])
    .lte('start_date', today)
    .gte('end_date', today)
    .limit(5000);
  if (error) return board;
  for (const r of data ?? []) {
    const s = String(r.sido);
    // 토탈 인테리어 스폰서(DB 에선 AD-P + 토탈 인테리어)는 AD-T 칸으로 센다
    const k = fromDbSlot(String(r.slot_kind), r.process as string | null);
    board[s] = board[s] ?? {};
    board[s][k] = (board[s][k] ?? 0) + 1;
  }
  return board;
}

/** 남은 자리 숫자(한도 - 사용, 0 아래로 안 내려감). 한도 없는 자리는 null */
export function remaining(used: number | undefined, kind: SlotKind): number | null {
  const cap = SLOT_INFO[kind].capacity;
  if (cap == null) return null;
  return Math.max(0, cap - (used ?? 0));
}

// ── 쓰기 (관리자 API) ─────────────────────────
type Res = { ok: true; id?: number } | { ok: false; error: string };
const clean = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, max);
  return t || null;
};

/** 광고주 등록 */
export async function createAdvertiser(input: Record<string, unknown>): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: '업체명을 적어 주세요' };
  const { data, error } = await sb
    .from('advertisers')
    .insert({ name, ceo: clean(input.ceo, 40), biz_no: clean(input.biz_no, 20), phone: clean(input.phone, 30), email: clean(input.email, 100), memo: clean(input.memo, 500) })
    .select('id')
    .single();
  if (error) return { ok: false, error: '광고주를 저장하지 못했어요' };
  return { ok: true, id: Number(data.id) };
}

/** 주문 만들기: 자리 한도(3개 업체)를 DB 함수로 검사한 뒤 넣는다 */
export async function createOrder(input: Record<string, unknown>): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const kind = input.slot_kind as SlotKind;
  if (!SLOT_KINDS.includes(kind)) return { ok: false, error: '자리 종류가 달라요' };
  // 지역: 시도 두 자리 번호 또는 '전국'(ALL, 준비만 — 판매 안 함)
  const sido = isOrderSido(input.sido) ? input.sido : null;
  if (!sido) return { ok: false, error: '지역을 골라 주세요' };
  const advertiserId = Number(input.advertiser_id);
  if (!Number.isInteger(advertiserId) || advertiserId <= 0) return { ok: false, error: '광고주를 골라 주세요' };
  if (!isDay(input.start_date)) return { ok: false, error: '시작일을 골라 주세요' };
  const process = kind === 'AD-P' ? clean(input.process, 30) : null;
  if (kind === 'AD-P' && !process) return { ok: false, error: '공정을 골라 주세요' };
  // 공정 스폰서(7만 원)로 '토탈 인테리어' 칸을 사는 것을 막는다 — 토탈은 AD-T(15만 원) 상품으로만
  if (kind === 'AD-P' && process === TOTAL_PROCESS) return { ok: false, error: '토탈 인테리어는 AD-T 로 주문해 주세요' };
  const override = input.amount === '' || input.amount == null ? null : Number(input.amount);
  // 금액은 화면 자리 종류(AD-T 면 15만 원) 기준으로 계산
  const c = calcOrder(kind, input.start_date, Number(input.units), override, sido);
  // DB 에 적을 값: AD-T → AD-P + '토탈 인테리어'
  const db = toDbSlot(kind, process);

  // 자리 검사: 겹치는 주문이 한도에 이르면 막는다
  const { data: ok, error: e1 } = await sb.rpc('ads_slot_available', {
    p_kind: db.slot_kind, p_sido: sido, p_process: db.process, p_from: input.start_date, p_to: c.endDate,
  });
  if (e1) return { ok: false, error: '자리 검사에 실패했어요(SQL 실행 여부 확인)' };
  if (ok === false) return { ok: false, error: '그 기간엔 자리가 다 찼어요(3개 업체)' };

  const { data, error } = await sb
    .from('ad_orders')
    .insert({
      advertiser_id: advertiserId, slot_kind: db.slot_kind, sido, process: db.process,
      start_date: input.start_date, end_date: c.endDate, units: c.units, amount: c.amount, vat: c.vat,
      pay_method: input.pay_method === 'card' ? 'card' : 'bank',
      phone: clean(input.phone, 30), click_url: isHttpsUrl(input.click_url) ? input.click_url : null,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: '주문을 저장하지 못했어요' };
  return { ok: true, id: Number(data.id) };
}

/** 입금 확인(paid) / 되돌리기(pending) / 환불(refunded). 환불이면 게재도 중지 */
export async function setPayStatus(id: number, status: 'pending' | 'paid' | 'refunded', ref?: string | null): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const patch: Record<string, unknown> = {
    pay_status: status,
    paid_at: status === 'paid' ? new Date().toISOString() : null,
  };
  if (ref !== undefined) patch.pay_ref = ref;
  if (status === 'refunded') patch.run_status = 'stopped';
  const { error } = await sb.from('ad_orders').update(patch).eq('id', id);
  return error ? { ok: false, error: '저장하지 못했어요' } : { ok: true };
}

/**
 * 게재 상태 바꾸기. 'live' 로 올리려면 배너·클릭 주소가 있어야 하고
 * 결제가 끝났어야 한다(무료 체험 0원 주문은 결제 대기여도 허용).
 */
export async function setRunStatus(id: number, status: 'review' | 'live' | 'ended' | 'stopped', note?: string | null): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  if (status === 'live') {
    const { data } = await sb.from('ad_orders').select('slot_kind,banner_path,click_url,pay_status,amount').eq('id', id).single();
    if (!data) return { ok: false, error: '주문을 찾지 못했어요' };
    if (data.slot_kind !== 'AD-PDF' && !data.banner_path) return { ok: false, error: '배너를 먼저 올려 주세요' };
    if (!data.click_url) return { ok: false, error: '클릭 주소(https)를 먼저 적어 주세요' };
    if (data.pay_status !== 'paid' && Number(data.amount) > 0) return { ok: false, error: '입금 확인 뒤에 게재할 수 있어요' };
  }
  const patch: Record<string, unknown> = { run_status: status };
  if (note !== undefined) patch.note = note;
  const { error } = await sb.from('ad_orders').update(patch).eq('id', id);
  return error ? { ok: false, error: '저장하지 못했어요' } : { ok: true };
}

/** 주문의 클릭 주소·전화번호 고치기 */
export async function setOrderLink(id: number, clickUrl: unknown, phone: unknown): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const url = typeof clickUrl === 'string' && clickUrl.trim() ? clickUrl.trim() : null;
  if (url && !isHttpsUrl(url)) return { ok: false, error: '주소는 https 로 시작해야 해요' };
  const { error } = await sb.from('ad_orders').update({ click_url: url, phone: clean(phone, 30) }).eq('id', id);
  return error ? { ok: false, error: '저장하지 못했어요' } : { ok: true };
}

/**
 * 배너 파일을 보관함에 올리고 주문에 경로 기록(게재 중이던 주문은 심사중으로 되돌려 다시 승인받게 함)
 *  - target 'desktop' 이면 PC 그림 칸(banner_desktop_path)에 기록한다(SQL 초안 실행 전이면 저장 실패 문구)
 */
export async function saveBanner(id: number, bytes: Uint8Array, contentType: string, target: 'mobile' | 'desktop' = 'mobile'): Promise<Res> {
  const sb = adminOrNull();
  if (!sb) return { ok: false, error: '저장소에 연결하지 못했어요' };
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  // PC 그림은 파일 이름 앞에 pc- 를 붙여 휴대폰 그림과 구분한다
  const path = `${id}/${target === 'desktop' ? 'pc-' : ''}${Date.now()}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (up.error) return { ok: false, error: '그림을 올리지 못했어요(보관함 ad-banners 확인)' };
  const { data: cur } = await sb.from('ad_orders').select('run_status').eq('id', id).single();
  const patch: Record<string, unknown> = target === 'desktop' ? { banner_desktop_path: path } : { banner_path: path };
  if (cur?.run_status === 'live') patch.run_status = 'review';
  const { error } = await sb.from('ad_orders').update(patch).eq('id', id);
  if (error) {
    return { ok: false, error: target === 'desktop' ? 'PC 그림 칸이 없어요(20261030_ads_desktop_banner.sql 실행 필요)' : '저장하지 못했어요' };
  }
  return { ok: true };
}

/** 주문 한 건의 종류(그림 검사용) */
export async function getOrderKind(id: number): Promise<SlotKind | null> {
  const sb = adminOrNull();
  if (!sb) return null;
  const { data } = await sb.from('ad_orders').select('slot_kind,process').eq('id', id).single();
  return data ? fromDbSlot(String(data.slot_kind), data.process as string | null) : null;
}

// ── 사이트 광고 자리 ─────────────────────────
export interface ServedAd {
  id: number;
  imageUrl: string;
  /** PC 전용 그림 주소(AD-H·AD-F, 선택). 없으면 null — 화면이 휴대폰 그림을 PC 에서도 가운데 보여 준다 */
  desktopImageUrl: string | null;
  href: string; // 서버 경유 클릭 주소
  name: string;
  /** 주문에 적힌 전화 번호(없으면 null) — 견적서 PDF 추천 줄(토탈 인테리어 스폰서)에 쓴다 */
  phone: string | null;
}

/** 게재 중 후보 목록을 60초 동안 서버 메모리에 담아 DB 부담을 줄인다 */
const cache = new Map<string, { at: number; list: { id: number; banner_path: string; desktop_path: string | null; name: string; phone: string | null }[] }>();
const CACHE_MS = 60_000;

/** 방문자 시도·자리에 맞는 게재 중 배너 한 개를 돌려 고른다. 없거나 실패하면 null(화면 변화 없음) */
export async function serveAd(kind: SlotKind, sido: string, process: string | null, previewId?: number | null): Promise<ServedAd | null> {
  try {
    const sb = adminOrNull();
    if (!sb) return null;
    // 미리보기: 주문 번호를 직접 지정하면 지역·게재 상태와 상관없이 그 주문의 배너를 보여 준다(자리 종류만 맞으면)
    if (previewId) {
      // select('*') — PC 그림 칸(banner_desktop_path)이 아직 없는 DB 에서도 실패하지 않게 전체 칸을 읽는다
      const { data } = await sb.from('ad_orders').select('*').eq('id', previewId).single();
      if (!data || fromDbSlot(String(data.slot_kind), data.process) !== kind || !data.banner_path) return null;
      const url = bannerUrl(sb, data.banner_path);
      const pc = bannerUrl(sb, (data as AdOrder).banner_desktop_path ?? null);
      return url ? { id: previewId, imageUrl: url, desktopImageUrl: pc, href: '#', name: '광고 미리보기', phone: (data as AdOrder).phone ?? null } : null;
    }
    const today = kstToday();
    // DB 조회 값: AD-T 는 AD-P + '토탈 인테리어'
    const db = toDbSlot(kind, process);
    const key = `${kind}|${sido}|${process ?? ''}|${today}`;
    let hit = cache.get(key);
    if (!hit || Date.now() - hit.at > CACHE_MS) {
      // 게재 중 후보 조회. withPc=false 는 PC 그림 칸이 아직 없는 DB(SQL 초안 실행 전)용 예비 조회
      const query = (withPc: boolean) => {
        let q = sb
          .from('ad_orders')
          .select(withPc ? 'id,banner_path,banner_desktop_path,phone,advertisers(name)' : 'id,banner_path,phone,advertisers(name)')
          .eq('slot_kind', db.slot_kind)
          // 방문자 시도 주문 + '전국'(ALL) 주문을 함께 후보로(전국은 지역과 상관없이 매칭)
          .in('sido', [sido, SIDO_ALL])
          .eq('run_status', 'live')
          .lte('start_date', today)
          .gte('end_date', today)
          .not('banner_path', 'is', null)
          .not('click_url', 'is', null)
          .limit(10);
        if (db.slot_kind === 'AD-P') q = q.eq('process', db.process ?? '');
        return q;
      };
      let { data, error } = await query(true);
      if (error) ({ data, error } = await query(false));
      if (error) return null;
      const list = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
        const adv = (r as unknown as { advertisers?: { name?: string } | { name?: string }[] }).advertisers;
        const name = Array.isArray(adv) ? adv[0]?.name : adv?.name;
        const pc = r.banner_desktop_path;
        return { id: Number(r.id), banner_path: String(r.banner_path), desktop_path: typeof pc === 'string' && pc ? pc : null, name: name ?? '광고', phone: typeof r.phone === 'string' && r.phone ? r.phone : null };
      });
      hit = { at: Date.now(), list };
      cache.set(key, hit);
      if (cache.size > 200) cache.clear();
    }
    if (!hit.list.length) return null;
    const pick = hit.list[Math.floor(Math.random() * hit.list.length)];
    const url = bannerUrl(sb, pick.banner_path);
    if (!url) return null;
    // 노출 +1 (실패해도 광고는 보여 준다)
    void sb.rpc('ads_bump', { p_order: pick.id, p_imp: 1, p_click: 0 }).then(() => undefined, () => undefined);
    return { id: pick.id, imageUrl: url, desktopImageUrl: bannerUrl(sb, pick.desktop_path), href: `/api/ad-click?o=${pick.id}`, name: pick.name, phone: pick.phone };
  } catch {
    return null;
  }
}

/** 클릭: 게재 중인 주문이면 클릭 +1 하고 이동할 https 주소를 돌려준다. 아니면 null */
export async function clickAd(id: number, count = true): Promise<string | null> {
  try {
    const sb = adminOrNull();
    if (!sb) return null;
    const { data } = await sb.from('ad_orders').select('click_url,run_status').eq('id', id).single();
    if (!data || !isHttpsUrl(data.click_url)) return null;
    if (count && data.run_status === 'live') {
      await sb.rpc('ads_bump', { p_order: id, p_imp: 0, p_click: 1 });
    }
    return data.click_url;
  } catch {
    return null;
  }
}
