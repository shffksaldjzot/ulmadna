// ─────────────────────────────────────────────────────────────
// 광고 슬롯 시스템 타입 정의
//  - v2 명세 §4~§5 + 단종업체 광고시스템 명세 §6.1 기반
//  - 견적 데이터(input/output) 타입은 절대 import하지 않는다:
//    광고 슬롯이 견적 결과와 연동되면 "추천"이 되어 책임 사슬 발생 (§6.1)
// ─────────────────────────────────────────────────────────────

// 광고 슬롯 ID — v2 명세 §4 표 기준 4종 + 토탈 인테리어 스폰서(AD-T, 2026-10-29)
export type AdSlotId = 'AD-H' | 'AD-P' | 'AD-T' | 'AD-R' | 'AD-F';

// 슬롯 인스턴스 식별 키
//  - AD-H/AD-R/AD-F: 페이지에 1개씩 (id 단독으로 식별)
//  - AD-P: 13개 공정 카테고리별로 잠재적 슬롯 → processGroup으로 인스턴스 구분
export type AdSlotKey =
  | { id: 'AD-H' }
  | { id: 'AD-R' }
  | { id: 'AD-T' }
  | { id: 'AD-F' }
  | { id: 'AD-P'; processGroup: string };

// 슬롯 결정 시 부가 정보 (resolveAdContent에 함께 넘김)
//  - adPPageIndex: AD-P가 페이지 내에서 몇 번째로 등장하는지 (캡 판정용, v2 §6.3)
export interface AdResolveContext {
  adPPageIndex?: number;
}

// 슬롯 컨테이너 안에 들어갈 콘텐츠 종류 (v2 명세 §5.1)
//  - banner: 자체 광고 (광고주가 직접 구매한 배너) — 광고주 발생 시
//  - adsense: 구글 애드센스 — 트래픽 쌓여 승인된 후
//  - house: 자사 콘텐츠 (운영자가 직접 채우는 안내/팁)
//  - collapse: 슬롯이 화면에서 사라짐 (DOM에서 제거 또는 height 0)
export type AdContentKind = 'banner' | 'adsense' | 'house' | 'collapse';

// 슬롯 규격 — IAB / 구글 애드센스 표준 (v2 명세 §4)
export interface AdSlotSize {
  width: number;
  height: number;
  responsive?: boolean;
  // PC 전용 규격(2026-10-29부터 AD-H·AD-F = 728×90).
  //  - 미설정 시 모바일 규격(width/height)을 PC에서도 그대로 가운데 정렬해 노출.
  //  - AdSlot 컴포넌트가 lg: Tailwind 클래스로 상자 폭·높이를 바꾼다.
  desktop?: { width: number; height: number };
}

// 슬롯 결정 결과 — provider가 폴백 체인 적용 후 반환
//  - banner/adsense 필드는 향후 광고주·애드센스 발생 시 채워질 자리.
//    현재(런칭 초기) 단계는 house 또는 collapse만 반환됨.
export interface ResolvedAdContent {
  kind: AdContentKind;
  // banner 콘텐츠용 (향후 확장)
  bannerImageUrl?: string;
  // PC 전용 그림(선택, AD-H·AD-F). 없으면 PC 에서도 bannerImageUrl 을 가운데 보여 준다
  bannerDesktopImageUrl?: string;
  bannerLinkUrl?: string;
  bannerAdvertiserName?: string;
  // adsense 콘텐츠용 — 광고단위 슬롯ID
  adsenseSlot?: string;
}
