// ─────────────────────────────────────────────────────────────
// "광고" 라벨 — 매칭 오인 방지 (v2 명세 §5.5)
//  - 자체 광고(banner) / 애드센스(adsense) 노출 시 컨테이너 우상단에 표시
//  - house ad에는 표시하지 않음 (자사 콘텐츠라 "광고" 표기 부적절)
//  - 표시 여부는 AdSlot에서 SHOW_SPONSORED_LABEL_FOR 기준으로 결정
// ─────────────────────────────────────────────────────────────

export default function SponsoredLabel() {
  return (
    <span
      className="absolute top-1 right-1 z-10 text-[9px] text-gray-400 bg-white/85 px-1.5 py-0.5 rounded leading-none"
      aria-label="광고"
    >
      광고
    </span>
  );
}
