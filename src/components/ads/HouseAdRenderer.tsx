// ─────────────────────────────────────────────────────────────
// 자사 콘텐츠(House Ad) 렌더러 — 빈 광고 자리 폴백
//  - AD-H, AD-R 슬롯에서 산 업체가 없을 때 노출 (v2 명세 §5.4)
//  - 광고 전역 스위치(ADS_ENABLED, src/lib/ads/config.ts)가 꺼져 있는 동안은
//    resolveAdContent가 항상 collapse를 반환하므로 이 컴포넌트는 실제로 렌더되지 않는다.
//
// 2026-10-29 형아 결정: 빈자리는 얼마드나 자체 안내 한 줄 —
//   "이 자리에 우리 업체 광고 · 30일 N만원부터 → 광고 안내"(/sponsor 로 이동).
//   다른 회사 상호·전화·서비스 안내는 넣지 않는다.
//   N 은 가격 정본(SLOT_INFO)의 가장 싼 상품 값에서 읽는다(가격이 바뀌면 같이 바뀜).
//   "광고" 라벨 없음(자사 안내라 라벨 대상 아님).
// ─────────────────────────────────────────────────────────────

import type { AdSlotId } from '@/lib/ads/types';
import { SLOT_INFO } from '@/lib/ads/pricing';

/** 30일 최저 요금(만원) — 0원(무료) 상품은 빼고 계산 */
const MIN_MANWON = Math.min(...Object.values(SLOT_INFO).map((s) => s.price).filter((p) => p > 0)) / 10000;

interface HouseAdRendererProps {
  slotId: AdSlotId;
}

export default function HouseAdRenderer({ slotId }: HouseAdRendererProps) {
  // house ad 대상이 아닌 슬롯 — 안전장치 (호출되지 않아야 정상)
  if (slotId !== 'AD-H' && slotId !== 'AD-R') return null;

  return (
    <a
      href="/sponsor"
      className="flex items-center justify-center gap-2 w-full h-full bg-surface border border-dashed border-line rounded-card px-4 py-3 text-center hover:border-accent transition-colors"
    >
      <span className="t-sub text-ink-2">
        이 자리에 우리 업체 광고 · 30일 {MIN_MANWON.toLocaleString('ko-KR')}만원부터
      </span>
      <span className="t-sub font-semibold text-accent whitespace-nowrap">광고 안내 →</span>
    </a>
  );
}
