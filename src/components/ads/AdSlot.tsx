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

// 슬롯별 상자 크기 Tailwind 클래스 (purge 안전 — 정적 문자열).
//  - base: 휴대폰 규격(최대 폭 + 최소 높이). PC 전용 규격이 없는 자리는 PC 에서도 이 크기로 가운데 정렬.
//  - desktop: lg(1024px) 이상에서 바뀌는 PC 전용 규격(2026-10-29 형아 결정: AD-H·AD-F 만 728×90).
//    AD_SLOT_SIZES(config.ts)의 desktop 값과 같은 숫자를 쓴다.
//  - min-height 는 CLS(레이아웃 시프트) 방지용.
const SLOT_BOX: Record<AdSlotId, { base: string; desktop?: string }> = {
  'AD-H': { base: 'max-w-[320px] min-h-[100px]', desktop: 'lg:max-w-[728px] lg:min-h-[90px]' },
  'AD-P': { base: 'max-w-[320px] min-h-[50px]' },
  'AD-T': { base: 'max-w-[320px] min-h-[50px]' },
  'AD-R': { base: 'max-w-[300px] min-h-[250px]' },
  'AD-F': { base: 'max-w-[320px] min-h-[50px]', desktop: 'lg:max-w-[728px] lg:min-h-[90px]' },
};

/** 상자 크기 클래스: usePc=true 면 PC 규격까지(있을 때만) 붙인다 */
function boxClass(id: AdSlotId, usePc: boolean): string {
  const b = SLOT_BOX[id];
  return usePc && b.desktop ? `${b.base} ${b.desktop}` : b.base;
}

/** 표시판 글자에 쓸 "만원" 표기 */
const manwon = (won: number) => `${(won / 10000).toLocaleString('ko-KR')}만원`;

interface AdSlotProps {
  id: AdSlotId;
  // AD-P 전용 — 바로 위 공정 카테고리 라벨 (예: "철거", "창호")
  //  - 광고-공정 매칭에 사용 (§6.2)
  processGroup?: string;
  // AD-P 전용 — 페이지 내 등장 순서 (0부터). 노출 캡 판정용 (§6.3)
  adPPageIndex?: number;
  // 추가 클래스 (정렬·여백 조정 등 부모에서 필요할 때)
  className?: string;
  // PC(lg 이상) 전용 자리 — 휴대폰에선 숨긴다(2026-10-29 형아 결정: 계산기 AD-H 는 PC 에만)
  desktopOnly?: boolean;
}

export default function AdSlot({
  id,
  processGroup,
  adPPageIndex,
  className = '',
  desktopOnly = false,
}: AdSlotProps) {
  // PC 전용 자리면 휴대폰에선 숨김(hidden), lg 이상에서만 보이게(flex)
  const showClass = desktopOnly ? 'hidden lg:flex' : 'flex';
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
    ? {
        kind: 'banner',
        bannerImageUrl: served.imageUrl,
        bannerDesktopImageUrl: served.desktopImageUrl ?? undefined,
        bannerLinkUrl: served.href,
        bannerAdvertiserName: served.name,
      }
    : resolveAdContent(key, { adPPageIndex });

  // 자리 전체 표시 모드(?ad_preview=all + 관리자): 접히는 자리도 펼쳐서 점선 표시판으로 그린다
  //  - PC 전용 규격이 있는 자리(AD-H·AD-F)는 PC 에서 728×90 상자로 그리고 글자에 두 규격을 함께 적는다
  const mapMode = useAdMapMode();
  if (mapMode) {
    const info = SLOT_INFO[id];
    const sz = AD_SLOT_SIZES[id];
    const sizeText = sz.desktop
      ? `PC ${sz.desktop.width}×${sz.desktop.height} · 휴대폰 ${sz.width}×${sz.height}`
      : `${sz.width}×${sz.height}`;
    const title =
      id === 'AD-P'
        ? `${info.name} · ${processGroup ?? ''} · ${sizeText} · ${manwon(info.price)}부터${capped ? ' (한 화면 4곳까지만 노출)' : ''}`
        : `${info.name} · ${sizeText} · 30일 ${manwon(info.price)}부터 · 지역당 ${info.capacity}곳`;
    return (
      <div
        className={`relative w-full ${boxClass(id, true)} mx-auto my-3 ${showClass} items-center justify-center text-center`}
        style={{ border: '2px dashed #f97316', background: 'rgba(249,115,22,0.08)', borderRadius: 6, padding: 4 }}
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

  const showLabel = SHOW_SPONSORED_LABEL_FOR.includes(content.kind);
  // PC 규격 상자를 쓸지: 유료 배너는 PC 그림이 있을 때만(없으면 휴대폰 그림 크기 그대로 가운데),
  // House Ad·애드센스는 PC 규격 상자를 그대로 쓴다
  const usePc = content.kind === 'banner' ? !!content.bannerDesktopImageUrl : true;

  return (
    <div
      // 컨테이너 — 휴대폰 규격을 기본으로, PC(lg 이상)에선 PC 전용 규격(있을 때만)으로 바뀐다.
      //  - 상자 크기(최대 폭·최소 높이)는 SLOT_BOX 정적 클래스로 준다(CLS 방지 최소 높이 포함).
      className={`relative w-full ${boxClass(id, usePc)} mx-auto my-3 ${showClass} items-stretch justify-center ${className}`}
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
          {/* 화면 폭에 따라 그림을 고른다: PC(1024px 이상)에 PC 그림이 있으면 그것, 아니면 휴대폰 그림 */}
          <picture className="block w-full h-full">
            {content.bannerDesktopImageUrl && (
              <source media="(min-width: 1024px)" srcSet={content.bannerDesktopImageUrl} />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.bannerImageUrl}
              alt={content.bannerAdvertiserName ?? ''}
              className="w-full h-full object-cover rounded-md"
            />
          </picture>
        </a>
      )}

      {/* 애드센스 — 슬롯ID 설정 시 구글 광고 게재 */}
      {content.kind === 'adsense' && content.adsenseSlot && (
        <AdsenseUnit slot={content.adsenseSlot} className="w-full" />
      )}
    </div>
  );
}
