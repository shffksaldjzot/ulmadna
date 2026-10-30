// ─────────────────────────────────────────────────────────────
// 광고주 셀프 화면(/partner) 공용 순수 함수 — 2026년 10월 31일
//
// [무슨 기능인가]
//   가입 칸 검사(이메일·비밀번호·사업자번호), 결제 금액 계산(부가세 포함),
//   광고 카드의 상태 배지·남은 날·클릭률처럼 서버·화면·시험이 함께 쓰는 계산을 모았다.
//   서버 전용 코드가 없어서 브라우저에서도 불러 쓸 수 있다.
//   가격·자리 정보는 광고 정본(src/lib/ads/pricing.ts)을 그대로 읽는다(복사하지 않음).
// ─────────────────────────────────────────────────────────────
import { DESIGN_FEE, VAT_RATE, priceOf, daysBetween, type SlotKind } from '@/lib/ads/pricing';
import { REGION_NAMES, SIDO_CODES } from '@/server/admin/format';

/** 광고주가 직접 살 수 있는 자리(견적서 추천 글자 광고 AD-PDF 는 관리자 상담으로만). AD-T 는 DB 에 AD-P+'토탈 인테리어'로 저장 */
export const PARTNER_SLOTS: SlotKind[] = ['AD-H', 'AD-R', 'AD-P', 'AD-T', 'AD-F'];

/** 한 번에 고를 수 있는 기간(30일 단위 개수) */
// 2026-10-29: 180일(6단위)은 뺌 — PG 심사에서 "비실물 장기 서비스(6개월)"가 위험 업종으로 잡혀서 최대 90일로 둔다
export const PARTNER_UNITS = [1, 3] as const;

/** 시도 17곳 [번호, 이름] — 관리자 자리판과 같은 순서 */
export const PARTNER_REGIONS: [string, string][] = SIDO_CODES.map((c) => [c, REGION_NAMES[c] ?? c]);

/** 시도 번호 → 이름 */
export function regionName(code: string): string {
  return REGION_NAMES[code] ?? code;
}

/** 시도 번호가 17곳 안에 있는가(전국 ALL 은 판매하지 않음) */
export function isPartnerRegion(v: unknown): v is string {
  return typeof v === 'string' && SIDO_CODES.includes(v);
}

// ── 가입 칸 검사 ─────────────────────────────

/** 이메일 정리(앞뒤 빈칸 제거 + 소문자) */
export function normalizeEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/** 이메일 형식(간단 검사: 무엇@무엇.무엇, 100자 이하) */
export function isEmail(v: string): boolean {
  return v.length >= 5 && v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

/** 비밀번호 문제를 한 줄로(괜찮으면 null): 8~64자, 영문과 숫자 모두 포함 */
export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return '비밀번호는 8자 이상이에요';
  if (pw.length > 64) return '비밀번호는 64자 이하예요';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return '영문과 숫자를 섞어 주세요';
  return null;
}

/** 사업자번호에서 숫자만 남긴다(000-00-00000 → 0000000000) */
export function normalizeBizNo(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\D/g, '') : '';
}

/**
 * 사업자번호 형식 검사 — 숫자 10자리 + 끝자리 검증 숫자 계산이 맞는가.
 *   검증 숫자 계산: 앞 9자리에 1,3,7,1,3,7,1,3,5 를 곱해 더하고,
 *   9번째 자리×5 를 10으로 나눈 몫을 한 번 더 더한 뒤, (10 - 합%10)%10 이 끝자리와 같아야 한다.
 *   TODO: 국세청 사업자 상태 조회(진위 확인) API 열쇠가 생기면 서버에서 실제 등록 여부도 확인한다.
 */
export function isBizNo(v: unknown): boolean {
  const d = normalizeBizNo(v);
  if (!/^\d{10}$/.test(d)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

/** 사업자번호 보기 좋게(0000000000 → 000-00-00000) */
export function formatBizNo(v: string): string {
  const d = normalizeBizNo(v);
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : v;
}

// ── 금액 ────────────────────────────────────

/**
 * 결제 금액: 정가(자리 요금 × 단위) → 장기 할인(90일 10%) → (첫 광고주 무료면) 첫 30일 단위 제외 = 공급가,
 * 부가세 10% 반올림, 합계 = 카드로 낼 돈. 계산은 광고 정본 priceOf 한 곳을 쓴다(2026-10-30).
 */
export function quote(kind: SlotKind, units: number, sido?: string | null, firstFree = false): {
  units: number; amount: number; vat: number; total: number; listAmount: number; discountPct: number; freeAmount: number;
} {
  const p = priceOf(kind, units, sido, firstFree);
  const vat = Math.round(p.amount * VAT_RATE);
  return { units: p.units, amount: p.amount, vat, total: p.amount + vat, listAmount: p.listAmount, discountPct: p.discountPct, freeAmount: p.freeAmount };
}

/**
 * 새 광고 결제 금액(배너 제작 대행 포함) — 2026-10-29
 *   design=null 이면 배너를 직접 올리는 경우(제작비 없음).
 *   design.firstFree=true 면 그 광고주의 첫 제작 대행이라 제작비 0원.
 *   amount(공급가) = 광고비 + 제작비, 부가세는 합친 공급가의 10% 반올림.
 *   서버는 첫 회 여부를 DB 로 다시 판정해서 이 함수로 다시 계산한다(브라우저 값을 믿지 않음).
 */
export function quoteNew(
  kind: SlotKind,
  units: number,
  design: { firstFree: boolean } | null,
  sido?: string | null,
  firstFreeAd = false, // 오픈 기념: 첫 광고주 첫 30일 단위 무료(서버가 DB 로 판정)
): { units: number; adAmount: number; designFee: number; amount: number; vat: number; total: number; listAmount: number; discountPct: number; freeAmount: number } {
  const base = quote(kind, units, sido, firstFreeAd);
  const designFee = design ? (design.firstFree ? 0 : DESIGN_FEE) : 0;
  const amount = base.amount + designFee;
  const vat = Math.round(amount * VAT_RATE);
  return { units: base.units, adAmount: base.amount, designFee, amount, vat, total: amount + vat, listAmount: base.listAmount, discountPct: base.discountPct, freeAmount: base.freeAmount };
}

/** 파일 앞머리로 PNG/JPG 판별(로고 검사용). 둘 다 아니면 null */
export function imageKind(b: Uint8Array): 'png' | 'jpg' | null {
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  return null;
}

/** 제작 대행 입력 글자 한도(업체 소개 한 줄·강조 문구) */
// mood = 원하는 느낌(선택, 2026-10-30)
export const BRIEF_MAX = { intro: 60, headline: 40, mood: 30 } as const;

/** 제작 대행 입력 정리: 앞뒤 빈칸 제거·줄바꿈 제거·길이 자르기 */
export function cleanBrief(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/** 제작 대행 입력 문제를 한 줄로(괜찮으면 null) */
export function briefProblem(intro: string, headline: string): string | null {
  if (!intro) return '업체 소개 한 줄을 적어 주세요';
  if (!headline) return '강조 문구를 적어 주세요';
  return null;
}

/** 원 단위 숫자 → "110,000원" */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

// ── 광고 카드 표시 ───────────────────────────

/** 배지 종류 */
export type BadgeKind = 'design' | 'review' | 'live' | 'waiting' | 'expired' | 'stopped' | 'refunded';

export const BADGE_TEXT: Record<BadgeKind, string> = {
  design: '시안 준비 중 · 3영업일', // 제작 대행 주문인데 아직 배너가 없을 때(2026-10-29)
  review: '배너 검토 중 · 1영업일',
  live: '게재 중',
  waiting: '게재 대기',
  expired: '만료',
  stopped: '중지',
  refunded: '환불됨',
};

/**
 * 주문 상태 → 배지 하나. 날짜가 지났으면 상태와 상관없이 만료
 *   제작 대행 주문(design_requested)이 검토 단계인데 배너가 아직 없으면 '배너 제작 중'.
 *   관리자가 배너를 올리면 같은 검토 단계라도 '배너 검토 중'으로 바뀐다.
 */
export function badgeOf(
  o: { run_status: string; pay_status: string; start_date: string; end_date: string; design_requested?: boolean | null; has_banner?: boolean },
  today: string,
): BadgeKind {
  if (o.pay_status === 'refunded') return 'refunded';
  if (o.run_status === 'stopped') return 'stopped';
  if (o.run_status === 'ended' || daysBetween(today, o.end_date) < 0) return 'expired';
  if (o.run_status === 'review' && o.design_requested && !o.has_banner) return 'design';
  if (o.run_status === 'review') return 'review';
  if (o.start_date > today) return 'waiting';
  return 'live';
}

/** 남은 날(마지막 날 포함). 끝났으면 0 */
export function remainDays(endDate: string, today: string): number {
  return Math.max(0, daysBetween(today, endDate) + 1);
}

/** 클릭률(%) 소수 한 자리. 노출 0이면 0 */
export function ctr(impressions: number, clicks: number): number {
  if (!impressions) return 0;
  return Math.round((clicks / impressions) * 1000) / 10;
}

/** 연장·배너 교체가 가능한 주문인가(환불·중지된 주문은 불가) */
export function canManage(b: BadgeKind): boolean {
  return b !== 'refunded' && b !== 'stopped';
}

/** 오늘 포함 최근 n일 날짜 목록(오래된 날부터) */
export function lastDays(today: string, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(`${today}T00:00:00Z`).getTime() - i * 86400000;
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** 포트원 결제 번호 만들기(영문·숫자·하이픈, 40자 안팎) */
export function newPaymentId(rand: string): string {
  return `ulm-${Date.now().toString(36)}-${rand.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;
}

/** 전화번호 검사(2026-10-30): 숫자만 세서 9자리 이상이면 통과(02 지역번호 9자리 포함) */
export function isPhoneOk(v: unknown): boolean {
  return typeof v === 'string' && v.replace(/\D/g, '').length >= 9;
}

/** 전화번호 저장 값: 숫자와 하이픈만 남김(최대 20자) */
export function cleanPhone(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[^\d-]/g, '').slice(0, 20) : '';
}
