// ─────────────────────────────────────────────────────────────
// 광고 슬롯 핵심 컨테이너 (v2 명세 §5.1 슬롯=컨테이너 원칙)
//  - 슬롯은 컨테이너만 제공. 안의 콘텐츠는 provider(config.resolveAdContent)가 결정.
//  - 향후 광고주/애드센스 발생 시 provider만 교체 → UI 코드 변경 없이 콘텐츠 전환.
//
// 절대 원칙 — props 시그니처에 반영:
//  - 견적 데이터(input/output)는 prop으로 받지 않는다.
//    (단종업체 광고시스템 명세 §6.1: 견적과 광고 연동 = "추천" = 책임 사슬)
//  - AD-P만 processGroup(어느 공정 직후인지) + adPPageIndex(노출 캡 판정) 받음.
// ─────────────────────────────────────────────────────────────

'use client';

import type { AdSlotId } from '@/lib/ads/types';
import {
  AD_SLOT_SIZES,
  SHOW_SPONSORED_LABEL_FOR,
  resolveAdContent,
} from '@/lib/ads/config';
import HouseAdRenderer from './HouseAdRenderer';
import SponsoredLabel from './SponsoredLabel';

interface AdSlotProps {
  id: AdSlotId;
  // AD-P 전용 — 바로 위 공정 카테고리 라벨 (예: "철거", "창호")
  //  - 광고-공정 매칭에 사용 (§6.2)
  processGroup?: string;
  // AD-P 전용 — 페이지 내 등장 순서 (0부터). 노출 캡 판정용 (§6.3)
  adPPageIndex?: number;
  // 추가 클래스 (정렬·여백 조정 등 부모에서 필요할 때)
  className?: string;
}

export default function AdSlot({
  id,
  processGroup,
  adPPageIndex,
  className = '',
}: AdSlotProps) {
  // 슬롯 인스턴스 키 구성
  const key =
    id === 'AD-P'
      ? { id: 'AD-P' as const, processGroup: processGroup ?? '' }
      : { id };

  // provider에 노출 캡 컨텍스트 전달
  const content = resolveAdContent(key, { adPPageIndex });

  // collapse — DOM에서 완전히 제거 (v2 명세 §5.3)
  if (content.kind === 'collapse') {
    return null;
  }

  const size = AD_SLOT_SIZES[id];
  const showLabel = SHOW_SPONSORED_LABEL_FOR.includes(content.kind);

  return (
    <div
      // 컨테이너 — 모바일 기준 폭, 슬롯 규격 최소 높이 보장
      className={`relative w-full mx-auto my-3 flex items-stretch justify-center ${className}`}
      style={{
        maxWidth: `${size.width}px`,
        minHeight: `${size.height}px`,
      }}
      data-ad-slot={id}
      data-ad-process={processGroup}
      data-ad-kind={content.kind}
    >
      {showLabel && <SponsoredLabel />}

      {content.kind === 'house' && <HouseAdRenderer slotId={id} />}

      {/* 향후 광고주/애드센스 발생 시 추가될 분기:
          {content.kind === 'banner' && <BannerRenderer ... />}
          {content.kind === 'adsense' && <AdSenseRenderer ... />}
      */}
    </div>
  );
}
