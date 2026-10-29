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

import type { AdSlotId, ResolvedAdContent } from '@/lib/ads/types';
import { useServedAd, useAdMapMode } from '@/lib/ads/useServedAd';
import {
  AD_P_MAX_PER_PAGE,
  AD_SLOT_SIZES,
  SHOW_SPONSORED_LABEL_FOR,
  resolveAdContent,
} from '@/lib/ads/config';
import HouseAdRenderer from './HouseAdRenderer';
import SponsoredLabel from './SponsoredLabel';
import { AdsenseUnit } from './AdsenseUnit';
import { SLOT_INFO } from '@/lib/ads/pricing';

// 슬롯별 max-width Tailwind 클래스 (purge 안전 — 정적 문자열).
//  - 현재는 모바일 규격을 PC에서도 그대로 사용 (콘텐츠 폭 안 가운데 정렬).
//  - 향후 PC 전용 규격(728×90 등) 도입 시 lg: prefix 추가
//    (예: 'max-w-[320px] lg:max-w-[728px]') — types.ts의 AdSlotSize.desktop도 함께 채움.
const SLOT_MAX_W_CLASS: Record<AdSlotId, string> = {
  'AD-H': 'max-w-[320px]',
  'AD-P': 'max-w-[320px]',
  'AD-R': 'max-w-[300px]',
  'AD-F': 'max-w-[320px]',
};

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

  // 유료 배너 조회(2026년 10월 29일): 방문자 시도와 맞는 게재 중 배너가 있으면 그것을 우선 보여 준다.
  //  - AD-P 는 페이지 노출 한도(AD_P_MAX_PER_PAGE) 밖이면 아예 묻지 않는다.
  //  - 배너가 없으면(대부분) 아래 기존 폴백(House Ad/접힘)이 그대로 동작해 화면 변화가 없다.
  const capped = id === 'AD-P' && adPPageIndex !== undefined && adPPageIndex >= AD_P_MAX_PER_PAGE;
  const served = useServedAd(id, processGroup, !capped);

  // provider에 노출 캡 컨텍스트 전달 — 유료 배너가 있으면 banner 로 바꿔 끼운다
  const content: ResolvedAdContent = served
    ? { kind: 'banner', bannerImageUrl: served.imageUrl, bannerLinkUrl: served.href, bannerAdvertiserName: served.name }
    : resolveAdContent(key, { adPPageIndex });

  // 자리 전체 표시 모드(?ad_preview=all + 관리자): 접히는 자리도 펼쳐서 점선 표시판으로 그린다
  const mapMode = useAdMapMode();
  if (mapMode) {
    const info = SLOT_INFO[id];
    const sz = AD_SLOT_SIZES[id];
    const title =
      id === 'AD-P'
        ? `AD-P 공정 스폰서 · ${processGroup ?? ''} · ${sz.width}×${sz.height} · ${(info.price / 10000).toLocaleString('ko-KR')}만원${capped ? ' (한 화면 4곳까지만 노출)' : ''}`
        : `${id} ${info.name} ${sz.width}×${sz.height} · 30일 ${(info.price / 10000).toLocaleString('ko-KR')}만원 · 지역당 ${info.capacity}곳`;
    return (
      <div
        className={`relative w-full ${SLOT_MAX_W_CLASS[id]} mx-auto my-3 flex items-center justify-center text-center`}
        style={{ minHeight: `${sz.height}px`, border: '2px dashed #f97316', background: 'rgba(249,115,22,0.08)', borderRadius: 6, padding: 4 }}
        data-ad-slot={id}
        data-ad-process={processGroup}
        data-ad-kind="map"
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#c2410c', lineHeight: 1.3 }}>{title}</span>
      </div>
    );
  }

  // collapse — DOM에서 완전히 제거 (v2 명세 §5.3)
  if (content.kind === 'collapse') {
    return null;
  }

  const size = AD_SLOT_SIZES[id];
  const showLabel = SHOW_SPONSORED_LABEL_FOR.includes(content.kind);
  const maxWClass = SLOT_MAX_W_CLASS[id];

  return (
    <div
      // 컨테이너 — 모바일 규격을 PC 콘텐츠 폭 안에 가운데 정렬.
      //  - 향후 PC 전용 규격 도입 시 SLOT_MAX_W_CLASS에 lg:max-w-[...] 추가.
      //  - min-height는 CLS(레이아웃 시프트) 방지용 inline 유지.
      className={`relative w-full ${maxWClass} mx-auto my-3 flex items-stretch justify-center ${className}`}
      style={{
        minHeight: `${size.height}px`,
      }}
      data-ad-slot={id}
      data-ad-process={processGroup}
      data-ad-kind={content.kind}
    >
      {showLabel && <SponsoredLabel />}

      {content.kind === 'house' && <HouseAdRenderer slotId={id} />}

      {/* 자체 광고 — 컨테이너 구조 §5.1 충족.
          광고주 발생 시 config.ts에서 banner 반환만 하면 활성화 (코드 수정 불필요). */}
      {content.kind === 'banner' && content.bannerImageUrl && (
        <a
          href={content.bannerLinkUrl ?? '#'}
          // 미리보기('#')는 새 창을 열지 않는다. 실제 배너는 서버 경유 주소(/api/ad-click)로 클릭을 센다
          target={content.bannerLinkUrl && content.bannerLinkUrl !== '#' ? '_blank' : undefined}
          rel="sponsored noopener noreferrer"
          className="block w-full h-full"
          aria-label={content.bannerAdvertiserName ?? '광고'}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.bannerImageUrl}
            alt={content.bannerAdvertiserName ?? ''}
            className="w-full h-full object-cover rounded-md"
          />
        </a>
      )}

      {/* 애드센스 — 슬롯ID 설정 시 구글 광고 게재 */}
      {content.kind === 'adsense' && content.adsenseSlot && (
        <AdsenseUnit slot={content.adsenseSlot} className="w-full" />
      )}
    </div>
  );
}
