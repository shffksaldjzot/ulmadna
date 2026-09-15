// ─────────────────────────────────────────────────────────────
// 자사 콘텐츠(House Ad) 렌더러
//  - AD-H, AD-R 슬롯에서 광고주 없을 때 노출 (v2 명세 §5.4)
//  - 광고 전역 스위치(ADS_ENABLED, src/lib/ads/config.ts)가 꺼져 있는 동안은
//    resolveAdContent가 항상 collapse를 반환하므로 이 컴포넌트는 실제로 렌더되지 않는다.
//    (2026-09-15 기준 ADS_ENABLED=false — 광고 자체를 켤지는 별도의 사업 결정이라
//    이 작업에서는 건드리지 않았다. 스위치를 켜는 순간 아래 카드가 그대로 나타난다.)
//
// 2026-09-15 디자인 통일 작업 A: "애드센스 320×100" 같은 자리표시 문구 대신 실제로
// 눌리는 계산기 홍보 카드로 바꿨다. "광고" 라벨 없음(자사 콘텐츠라 원래도 라벨 대상 아님).
// 날짜 기준으로 카드를 돌려써서(진짜 랜덤이 아니라 오늘 하루는 서버·화면이 같은 카드를
// 보여주도록) 매번 렌더가 흔들리는 하이드레이션 불일치를 피했다.
// ─────────────────────────────────────────────────────────────

import type { AdSlotId } from '@/lib/ads/types';

// 계산기 홍보 카드 3종 — 실제로 켜져 있는 계산기만 넣는다(준비 중 공정은 안내하지 않음)
const CALC_PROMOS = [
  { title: '도배 계산기', body: '벽지 롤수와 비용 바로', href: '/calc/wallpaper' },
  { title: '미장 계산기', body: '레미탈 포대수와 비용 바로', href: '/calc/mortar' },
  { title: '바닥재 계산기', body: '바닥재 수량과 비용 바로', href: '/calc/flooring' },
] as const;

interface HouseAdRendererProps {
  slotId: AdSlotId;
}

export default function HouseAdRenderer({ slotId }: HouseAdRendererProps) {
  // house ad 대상이 아닌 슬롯 — 안전장치 (호출되지 않아야 정상)
  if (slotId === 'AD-P' || slotId === 'AD-F') return null;

  // 날짜(일)로 카드를 하나 고른다 — AD-H/AD-R이 한 화면에 같이 있어도 서로 다른 카드가
  // 나오도록 슬롯별로 한 칸씩 밀어서 고른다.
  const dayIndex = new Date().getDate();
  const offset = slotId === 'AD-R' ? 1 : 0;
  const promo = CALC_PROMOS[(dayIndex + offset) % CALC_PROMOS.length];

  return (
    <a
      href={promo.href}
      className="flex flex-col justify-center w-full h-full bg-surface border border-line rounded-card px-4 py-3 hover:border-accent transition-colors"
    >
      <p className="t-body font-bold text-ink">{promo.title}</p>
      <p className="t-sub text-ink-2 mt-1">{promo.body}</p>
      <p className="t-sub font-semibold text-accent mt-2">지금 계산하기 →</p>
    </a>
  );
}
