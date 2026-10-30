// ─────────────────────────────────────────────────────────────
// 광고 운영 공용 순수 함수 — 가격·기간·규격·그림 크기 검사 (2026년 10월 29일)
//
// [무슨 기능인가]
//   광고 주문을 만들 때 필요한 계산(30일 단위 기간·금액·부가세)과, 올린 배너 그림이
//   규격(1배 또는 2배)에 맞는지 검사하는 함수를 모았다. 서버 전용 코드가 없어서
//   관리자 화면(브라우저)과 서버, 시험(vitest)에서 모두 쓴다.
//   가격 정본은 계획안 7-9(형아 확정 2026-10-27). "독점"이라는 말은 쓰지 않는다.
// ─────────────────────────────────────────────────────────────

/** 광고 자리 종류 */
export type SlotKind = 'AD-H' | 'AD-R' | 'AD-P' | 'AD-T' | 'AD-F' | 'AD-PDF';

export const SLOT_KINDS: SlotKind[] = ['AD-H', 'AD-R', 'AD-P', 'AD-T', 'AD-F', 'AD-PDF'];

/**
 * 자리 안내(이름·규격·30일 요금·동시 업체 수 한도). capacity=null 은 제한 없음
 *  - width/height 는 휴대폰(기본) 규격. desktop 은 PC 전용 규격(2026-10-29 형아 결정: AD-H·AD-F 만 728×90)
 *  - desktop 이 있는 자리만 주문에 "PC 그림"(선택)을 따로 올릴 수 있다. 없으면 PC 에서도 휴대폰 그림을 가운데 보여 준다
 */
// 2026-10-30 형아 결정: GA 노출 기준으로 순서 조정 — 맨 위 10만 · 견적 결과 10만 · 올수리 10만 · 공정 5만 · 맨 아래 3만 · 견적서 줄 2만
//   여기 price 는 1단계(서울·경기) 정가. 지역별 값은 아래 slotPrice(kind, sido)로 계산한다.
export const SLOT_INFO: Record<SlotKind, { name: string; width: number; height: number; price: number; capacity: number | null; maxKB: number; desktop?: { width: number; height: number } }> = {
  'AD-H': { name: '맨 위 띠 배너', width: 320, height: 100, price: 100000, capacity: 3, maxKB: 300, desktop: { width: 728, height: 90 } },
  'AD-R': { name: '견적 결과 옆 큰 배너', width: 300, height: 250, price: 100000, capacity: 3, maxKB: 400 },
  // 공정 스폰서: 2026-10-29 형아 결정으로 5만 → 7만 원/30일 (노출 3곳: 홈 공정 목록 + 그 공정 계산기 + 그 공정 블로그 글)
  'AD-P': { name: '공정 전문 배너', width: 320, height: 50, price: 50000, capacity: 3, maxKB: 200 },
  // 토탈 인테리어 스폰서: 2026-10-29 형아 결정 30일 15만 원, 지역당 3곳, 전 지역 판매
  //  (노출 4곳: 홈 견적 결과 카드 아래 + 계산기 결과 공유 페이지 + 총론 블로그 글 본문 중간 + 견적서 PDF 추천 줄)
  'AD-T': { name: '올수리 업체 배너', width: 320, height: 50, price: 100000, capacity: 3, maxKB: 200 },
  // 푸터 가격은 계획안에 따로 없어 견적서 추천과 같은 2만 원으로 둠(주문 만들 때 금액을 직접 고칠 수 있다)
  'AD-F': { name: '맨 아래 띠 배너', width: 320, height: 50, price: 30000, capacity: 3, maxKB: 200, desktop: { width: 728, height: 90 } },
  'AD-PDF': { name: '견적서 추천 업체 줄', width: 0, height: 0, price: 20000, capacity: null, maxKB: 0 },
};

/**
 * 지역 '전국' 값(2026-10-29 준비만 — 판매하지 않는다).
 *  - 주문의 sido 칸에 이 값이 있으면 방문자 지역과 상관없이 매칭된다.
 *  - 관리자 주문 화면 지역 선택지 맨 끝에만 보인다. DB 제약은 20261030_ads_desktop_banner.sql 초안에서 푼다.
 */
export const SIDO_ALL = 'ALL';

// ─────────────────────────────────────────────────────────────
// 지역 가격 단계 (2026-10-30 형아 확정, GA 지역 비중 기준)
//   1단계(정가 100%): 서울 11 · 경기 41
//   2단계(70%): 부산 26 · 대구 27 · 인천 28 · 광주 29 · 대전 30 · 울산 31 · 세종 36
//   3단계(50%): 그 외 시·도
//   견적서 추천 업체 줄(AD-PDF)은 단계 없이 고정가. 전국(ALL)은 판매하지 않아 1단계 값으로만 계산한다.
// ─────────────────────────────────────────────────────────────
export type RegionTier = 1 | 2 | 3;

const TIER1_SIDO = ['11', '41'];
const TIER2_SIDO = ['26', '27', '28', '29', '30', '31', '36'];
/** 단계별 가격 비율 */
export const TIER_RATE: Record<RegionTier, number> = { 1: 1, 2: 0.7, 3: 0.5 };

/** 시·도 번호 → 가격 단계 (전국·빈 값은 1단계) */
export function regionTier(sido?: string | null): RegionTier {
  if (!sido || sido === SIDO_ALL) return 1;
  if (TIER1_SIDO.includes(sido)) return 1;
  if (TIER2_SIDO.includes(sido)) return 2;
  return 3;
}

/** 자리 30일 요금(부가세 별도) — 지역 단계 비율을 곱해 100원 단위로 반올림. AD-PDF 는 고정가 */
export function slotPrice(kind: SlotKind, sido?: string | null): number {
  const base = SLOT_INFO[kind].price;
  if (kind === 'AD-PDF') return base;
  return Math.round((base * TIER_RATE[regionTier(sido)]) / 100) * 100;
}

/** 주문 지역 값 검사: 시도 두 자리 번호 또는 '전국'(ALL) */
export function isOrderSido(v: unknown): v is string {
  return typeof v === 'string' && (/^\d{2}$/.test(v) || v === SIDO_ALL);
}

// ─────────────────────────────────────────────────────────────
// 토탈 인테리어 스폰서(AD-T) ↔ DB 저장 방식 (2026-10-29)
//
//   DB(ad_orders)에는 새 자리 종류를 만들지 않고 "공정 스폰서(AD-P) + 공정 이름 '토탈 인테리어'"로 저장한다.
//   이유: ad_orders.slot_kind 검사 제약·자리 수 검사 함수(ads_slot_used — 종류·시도·공정이 같으면 같은 칸)를
//   그대로 쓸 수 있어 SQL 을 고칠 필요가 없다(지역당 3곳 한도도 AD-P 와 같은 3).
//   화면·주문·서빙 코드에서는 'AD-T' 로 다루고, DB 를 읽고 쓰는 경계(server/ads/store.ts)에서만 바꾼다.
//   가격만 다르므로 금액은 SLOT_INFO['AD-T'](15만 원)로 계산해 주문에 적는다.
// ─────────────────────────────────────────────────────────────
export const TOTAL_PROCESS = '토탈 인테리어';

/** 화면 자리 종류 → DB 에 적을 (slot_kind, process) */
export function toDbSlot(kind: SlotKind, process: string | null): { slot_kind: SlotKind; process: string | null } {
  if (kind === 'AD-T') return { slot_kind: 'AD-P', process: TOTAL_PROCESS };
  return { slot_kind: kind, process };
}

/** DB 의 (slot_kind, process) → 화면 자리 종류 (AD-P + '토탈 인테리어' 는 AD-T) */
export function fromDbSlot(slotKind: string, process: string | null | undefined): SlotKind {
  if (slotKind === 'AD-P' && process === TOTAL_PROCESS) return 'AD-T';
  return slotKind as SlotKind;
}

/** 공정 스폰서(AD-P) 공정 이름 — ProcessToggles.tsx 의 PROCESS_GROUPS 라벨과 같아야 한다(맞춰서 수정) */
export const AD_PROCESS_GROUPS = [
  '철거', '확장·설비', '전기·조명', '에어컨', '목공', '창호', '도배·바닥', '도장·필름', '타일', '욕실', '주방', '가구', '부대비용',
  // 미장: 홈 공정 목록엔 없는 공정 — 미장 계산기와 그 공정 블로그 글 2곳에만 나온다(2026-10-29)
  '미장',
];

/**
 * 공정 계산기 → 공정 스폰서(AD-P) 공정 이름 (2026-10-29)
 *  - 홈 공정 목록(ProcessToggles)과 같은 글자를 써야 같은 광고주가 잡힌다.
 *    홈은 도배와 바닥재를 '도배·바닥' 한 묶음으로 쓰므로 두 계산기 모두 '도배·바닥'.
 *  - 미장은 홈 목록에 없어 '미장' 을 따로 둔다.
 */
export const CALC_AD_PROCESS = {
  wallpaper: '도배·바닥',
  flooring: '도배·바닥',
  tile: '타일',
  mortar: '확장·설비', // 2026-10-29: 홈 공정 목록에 미장이 없어 블로그 판정(blog-process)과 같은 '확장·설비'로 통일 — 홈·계산기·블로그 세 곳이 같은 광고주
} as const;

/**
 * 배너 제작 대행 요금(부가세 별도) — 2026-10-29 형아 결정
 *  - 시안 1개 + 수정 2회, 3영업일. 광고주는 상호·전화·강조 문구·로고(선택)만 준다.
 *  - 광고주당 첫 1회는 무료(이전 주문에 제작 대행이 한 번도 없으면 0원).
 */
export const DESIGN_FEE = 50000;

export const VAT_RATE = 0.1;
/** 기간 한 단위 = 30일(29일·31일이 아님) */
export const UNIT_DAYS = 30;

/** YYYY-MM-DD 에 일수를 더한다(UTC 날짜 계산이라 시간대 영향 없음) */
export function addDaysStr(day: string, delta: number): string {
  const t = new Date(`${day}T00:00:00Z`).getTime() + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** 한국 날짜 오늘(YYYY-MM-DD) */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

/** 두 날짜(YYYY-MM-DD) 사이 일수(b - a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000);
}

/** 날짜 형식 검사 */
export function isDay(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/**
 * 주문 계산: 시작일·단위 수 → 마지막 날(포함)·공급가·부가세.
 *   - 마지막 날 = 시작일 + 30*단위 - 1 (예: 11-01 시작 1단위 → 11-30)
 *   - 금액은 override 가 있으면 그 값(무료 체험 0원 등), 없으면 지역 단계 자리 요금(slotPrice) × 단위
 *   - 부가세 = 공급가의 10% 반올림
 */
export function calcOrder(kind: SlotKind, start: string, units: number, amountOverride?: number | null, sido?: string | null) {
  const u = Math.max(1, Math.min(24, Math.floor(units) || 1));
  const amount = amountOverride != null && Number.isFinite(amountOverride) && amountOverride >= 0
    ? Math.round(amountOverride)
    : slotPrice(kind, sido) * u;
  return {
    units: u,
    endDate: addDaysStr(start, u * UNIT_DAYS - 1),
    amount,
    vat: Math.round(amount * VAT_RATE),
  };
}

/** 만료까지 남은 일수(오늘 포함이 아니라 end - today). 음수면 이미 끝남 */
export function daysLeft(endDate: string, today: string): number {
  return daysBetween(today, endDate);
}

/** 만료 7일 이내(0~7)인가 */
export function expiringSoon(endDate: string, today: string): boolean {
  const d = daysLeft(endDate, today);
  return d >= 0 && d <= 7;
}

/** 클릭 주소는 https 만 허용 */
export function isHttpsUrl(s: unknown): s is string {
  if (typeof s !== 'string' || s.length > 500) return false;
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

/** PNG·JPEG 파일 머리말에서 가로·세로를 읽는다. 읽지 못하면 null */
export function imageSize(buf: Uint8Array): { type: 'png' | 'jpg'; width: number; height: number } | null {
  // PNG: 8바이트 서명 뒤 IHDR 에 가로(16~19)·세로(20~23)
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return { type: 'png', width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // JPEG: FFD8 뒤 마커를 건너뛰며 SOF(C0~CF, C4·C8·CC 제외)에서 세로·가로를 읽는다
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = (buf[i + 2] << 8) | buf[i + 3];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { type: 'jpg', height: (buf[i + 5] << 8) | buf[i + 6], width: (buf[i + 7] << 8) | buf[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

/**
 * 배너 그림 검사. 문제가 있으면 한국어 이유, 괜찮으면 null (1배·2배 크기만 허용)
 *  - target 'desktop' 은 PC 그림 검사(AD-H·AD-F 만 728×90 또는 2배 1456×180). 용량 한도는 같은 자리 기준.
 */
export function checkBanner(kind: SlotKind, buf: Uint8Array, target: 'mobile' | 'desktop' = 'mobile'): string | null {
  const info = SLOT_INFO[kind];
  if (!info.width) return '이 자리는 그림이 필요 없어요';
  // PC 그림은 PC 전용 규격이 있는 자리만 받는다
  const size = target === 'desktop' ? info.desktop : { width: info.width, height: info.height };
  if (!size) return '이 자리는 PC 그림을 따로 받지 않아요';
  if (buf.length > info.maxKB * 1024) return `그림은 ${info.maxKB}KB 이하여야 해요`;
  const s = imageSize(buf);
  if (!s) return 'PNG 또는 JPG 그림만 올릴 수 있어요';
  const ok = (s.width === size.width && s.height === size.height) || (s.width === size.width * 2 && s.height === size.height * 2);
  if (!ok) return `크기가 ${size.width}x${size.height}(또는 2배 ${size.width * 2}x${size.height * 2})여야 해요. 지금 ${s.width}x${s.height}`;
  return null;
}
