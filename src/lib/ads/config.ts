// ─────────────────────────────────────────────────────────────
// 광고 슬롯 in-memory 설정 + 슬롯 결정 함수
//  - DB/Supabase 연동 없음 (Phase 3 보류). 광고주 0명 단계라 불필요.
//  - 향후 광고주 발생 시 resolveAdContent 함수만 교체하거나
//    이 파일을 DB 조회로 대체하면 됨 — 컨테이너 구조(§5.1)는 그대로 유지.
// ─────────────────────────────────────────────────────────────

import type {
  AdContentKind,
  AdSlotId,
  AdSlotKey,
  AdSlotSize,
  AdResolveContext,
  ResolvedAdContent,
} from './types';

// 슬롯별 규격 — 모바일 기준 (v2 명세 §4 표)
export const AD_SLOT_SIZES: Record<AdSlotId, AdSlotSize> = {
  'AD-H': { width: 320, height: 100 },
  'AD-P': { width: 320, height: 50 },
  'AD-R': { width: 300, height: 250, responsive: true },
  'AD-F': { width: 320, height: 50 },
};

// AD-P 노출 캡 — 한 페이지 로드당 최대 노출 슬롯 수 (v2 명세 §6.3)
// 사용자 결정: 4. 향후 관리자 설정값으로 빼야 함 (현재는 in-memory 상수).
export const AD_P_MAX_PER_PAGE = 4;

// "광고" 라벨 표기 대상 (v2 명세 §5.5: 매칭 오인 방지)
//  - banner/adsense 노출 시 라벨 표시
//  - house ad는 자사 콘텐츠라 라벨 X
export const SHOW_SPONSORED_LABEL_FOR: ReadonlyArray<AdContentKind> = ['banner', 'adsense'];

// ─────────────────────────────────────────────────────────────
// 슬롯 결정 로직 — 현재(런칭 초기) 상태:
//  - 자체 광고 0개 + 애드센스 미승인 (v2 명세 §5.4)
//  - AD-H, AD-R: house ad로 채움 (독점 슬롯은 절대 비거나 접히지 않음, §5.3)
//  - AD-P, AD-F: collapse (로테이션 슬롯은 광고 없으면 접힘, §5.3)
//  - AD-P 노출 캡 초과 시도 collapse
//
// 향후 단계별 확장 지점:
//  - 자체 광고 발생 시 → AD-H/AD-R/AD-P/AD-F에서 banner 반환 (광고-공정 매칭은 AD-P)
//  - 애드센스 승인 시 → AD-H/AD-R 폴백 체인에 adsense 추가
// ─────────────────────────────────────────────────────────────
export function resolveAdContent(
  key: AdSlotKey,
  context: AdResolveContext = {},
): ResolvedAdContent {
  switch (key.id) {
    case 'AD-H':
    case 'AD-R':
      // 독점 슬롯 — 광고 없어도 항상 house ad로 채움 (§5.3)
      return { kind: 'house' };

    case 'AD-F':
      // 로테이션 슬롯 — 광고주 0명이라 접힘 (§5.3)
      return { kind: 'collapse' };

    case 'AD-P': {
      // 노출 캡 초과 시 즉시 접힘 (§6.3)
      if (
        context.adPPageIndex !== undefined &&
        context.adPPageIndex >= AD_P_MAX_PER_PAGE
      ) {
        return { kind: 'collapse' };
      }
      // 광고주 0명 — 캡 안에서도 모두 접힘
      // 광고주 발생 시 여기서 공정-광고주 매칭 후 banner 반환 (§6.2)
      // 매칭 규칙: key.processGroup 라벨에 대응하는 단종업체 광고만 노출
      return { kind: 'collapse' };
    }
  }
}
