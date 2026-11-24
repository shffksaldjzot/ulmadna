// ─────────────────────────────────────────────────────────────
// 배너 자동 제작 공용 규칙(순수 함수) — 2026년 11월 24일
//   결제 확정 때 그리기(server/banner/bannerAuto.ts), 미리 보기 API, 관리자 화면이 함께 쓴다.
//   그리기 코드(next/og·sharp·글꼴)를 끌고 오지 않도록 규칙만 따로 둔다(관리자 화면 번들이 무거워지지 않게).
// ─────────────────────────────────────────────────────────────
import { SLOT_INFO, TOTAL_PROCESS, type SlotKind } from './pricing';

/** 배너 규격(1배 가로x세로) */
export type BannerSize = '320x100' | '300x250' | '320x50' | '728x90';

/** 스타일을 안 골랐을 때(맡김) 쓰는 스타일 */
export const DEFAULT_AUTO_STYLE = 'classic';

/** 자리 종류 → 그릴 규격(휴대폰 그림 + PC 그림이 있는 자리면 728x90 도) */
export function autoSizesOf(kind: SlotKind): { mobile: BannerSize; desktop: BannerSize | null } {
  const info = SLOT_INFO[kind];
  return { mobile: `${info.width}x${info.height}` as BannerSize, desktop: info.desktop ? (`${info.desktop.width}x${info.desktop.height}` as BannerSize) : null };
}

/**
 * 자동 제작 배너 파일 경로(주문·판 번호마다 고정 — 두 번 그려도 같은 파일에 덮어써서 하나만 남는다)
 *   rev = 광고주가 게재 전에 문구를 고쳐 다시 그린 횟수(2026년 11월 24일). 판마다 파일 이름이 달라야
 *   보관함 공개 주소의 캐시 때문에 옛 그림이 보이는 일이 없다. 0 이면 예전과 같은 이름.
 */
export function autoBannerPath(orderId: number, size: BannerSize, rev = 0): string {
  return rev > 0 ? `${orderId}/auto-${size}-r${rev}.png` : `${orderId}/auto-${size}.png`;
}

/** 자동 제작 배너인가(관리자 화면 "자동" 표시용, 다시 그린 판 포함) */
export function isAutoBannerPath(p: string | null | undefined): boolean {
  return typeof p === 'string' && /\/auto-\d+x\d+(-r\d+)?\.png$/.test(p);
}

/** 꼬리표: 공정 전문 배너면 공정 이름, 올수리 배너면 "종합 인테리어", 그 밖엔 없음(광고주가 주지 않은 말은 지어내지 않음) */
export function autoTagOf(kind: SlotKind, process: string | null): string | null {
  if (kind === 'AD-T') return '종합 인테리어';
  if (kind === 'AD-P' && process && process !== TOTAL_PROCESS) return process;
  return null;
}
