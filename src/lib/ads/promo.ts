// ─────────────────────────────────────────────────────────────
// 오픈 기념 "첫 광고주 3곳 첫 달 무료" 판정 (순수 함수) — 2026년 10월 30일
//
// [무슨 기능인가]
//   결제한 적 있는 광고주 수와 이 광고주의 지난 주문 수만 받아 무료 대상인지·남은 곳이 몇 곳인지 셈한다.
//   DB 를 읽는 일은 서버(server/partner/store.ts)가 하고, 여기는 계산만 해서 시험하기 쉽다.
//   한도는 config.ts 의 FIRST_FREE_ADVERTISERS(0 이면 꺼짐).
// ─────────────────────────────────────────────────────────────
import { FIRST_FREE_ADVERTISERS } from './config';

/** 남은 무료 자리 수(0 이상). limit 0 이면 프로모션 꺼짐 */
export function firstFreeLeft(paidAdvertisers: number, limit: number = FIRST_FREE_ADVERTISERS): number {
  return Math.max(0, limit - Math.max(0, Math.floor(paidAdvertisers) || 0));
}

/** 환불된 주문은 이행 안 된 것 — "첫 주문"·"제작 1회 무료" 셈에서 뺀다(2026-10-30). 셈에 들어가는 주문이면 true */
export function countsAsOrder(payStatus: string | null | undefined): boolean {
  return payStatus !== 'refunded';
}

/** 무료 대상이 아닌 이유: 'prior'=이전 주문 있음, 'full'=무료 자리 소진, null=대상(또는 프로모션 꺼짐) */
export function firstFreeWhy(paidAdvertisers: number, myOrderCount: number, limit: number = FIRST_FREE_ADVERTISERS): 'prior' | 'full' | null {
  if (limit <= 0) return null;
  if (firstFreeLeft(paidAdvertisers, limit) <= 0) return 'full';
  return myOrderCount > 0 ? 'prior' : null;
}

/** 이 광고주가 무료 대상인가 — 남은 자리가 있고, 지금까지 주문이 하나도 없어야 한다("첫 주문") */
export function isFirstFreeEligible(paidAdvertisers: number, myOrderCount: number, limit: number = FIRST_FREE_ADVERTISERS): boolean {
  return firstFreeLeft(paidAdvertisers, limit) > 0 && myOrderCount === 0;
}
