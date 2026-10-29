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
export type SlotKind = 'AD-H' | 'AD-R' | 'AD-P' | 'AD-F' | 'AD-PDF';

export const SLOT_KINDS: SlotKind[] = ['AD-H', 'AD-R', 'AD-P', 'AD-F', 'AD-PDF'];

/**
 * 자리 안내(이름·규격·30일 요금·동시 업체 수 한도). capacity=null 은 제한 없음
 *  - width/height 는 휴대폰(기본) 규격. desktop 은 PC 전용 규격(2026-10-29 형아 결정: AD-H·AD-F 만 728×90)
 *  - desktop 이 있는 자리만 주문에 "PC 그림"(선택)을 따로 올릴 수 있다. 없으면 PC 에서도 휴대폰 그림을 가운데 보여 준다
 */
export const SLOT_INFO: Record<SlotKind, { name: string; width: number; height: number; price: number; capacity: number | null; maxKB: number; desktop?: { width: number; height: number } }> = {
  'AD-H': { name: '헤더 가로', width: 320, height: 100, price: 100000, capacity: 3, maxKB: 300, desktop: { width: 728, height: 90 } },
  'AD-R': { name: '결과 옆 네모', width: 300, height: 250, price: 100000, capacity: 3, maxKB: 400 },
  'AD-P': { name: '공정 스폰서', width: 320, height: 50, price: 50000, capacity: 3, maxKB: 200 },
  // 푸터 가격은 계획안에 따로 없어 견적서 추천과 같은 2만 원으로 둠(주문 만들 때 금액을 직접 고칠 수 있다)
  'AD-F': { name: '푸터 로테이션', width: 320, height: 50, price: 20000, capacity: 3, maxKB: 200, desktop: { width: 728, height: 90 } },
  'AD-PDF': { name: '견적서 추천(글자)', width: 0, height: 0, price: 20000, capacity: null, maxKB: 0 },
};

/** 공정 스폰서(AD-P) 공정 이름 — ProcessToggles.tsx 의 PROCESS_GROUPS 라벨과 같아야 한다(맞춰서 수정) */
export const AD_PROCESS_GROUPS = [
  '철거', '확장·설비', '전기·조명', '에어컨', '목공', '창호', '도배·바닥', '도장·필름', '타일', '욕실', '주방', '가구', '부대비용',
];

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
 *   - 금액은 override 가 있으면 그 값(무료 체험 0원 등), 없으면 자리 요금 × 단위
 *   - 부가세 = 공급가의 10% 반올림
 */
export function calcOrder(kind: SlotKind, start: string, units: number, amountOverride?: number | null) {
  const u = Math.max(1, Math.min(24, Math.floor(units) || 1));
  const amount = amountOverride != null && Number.isFinite(amountOverride) && amountOverride >= 0
    ? Math.round(amountOverride)
    : SLOT_INFO[kind].price * u;
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
