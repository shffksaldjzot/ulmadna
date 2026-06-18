// ─────────────────────────────────────────────────────────────
// 자사 콘텐츠(House Ad) 렌더러
//  - AD-H, AD-R 슬롯에서 광고주 없을 때 노출 (v2 명세 §5.4)
//  - 실제 카피는 집사가 직접 작성 예정 — 여기는 슬롯/플레이스홀더만 제공
//  - 작성 후 HOUSE_AD_CONTENT의 해당 슬롯 객체를 채우면 자동 반영됨
// ─────────────────────────────────────────────────────────────

import type { AdSlotId } from '@/lib/ads/types';

// 자사 콘텐츠 데이터 구조
interface HouseAdContent {
  title: string;   // 굵은 한 줄 (브라운)
  body: string;    // 보조 설명 (회색)
  cta: string;     // 마무리 액션 문구 (gold)
  href: string;    // 클릭 시 이동할 URL (얼마드나 내부 경로 또는 mailto:)
}

// 슬롯 ID별 자사 콘텐츠
//  - null = 카피 미작성 (개발용 플레이스홀더 박스 노출)
//  - 객체 = 실제 자사 콘텐츠 렌더
// AD-P, AD-F는 house ad 대상 아님 (collapse 정책, §5.3)
const HOUSE_AD_CONTENT: Record<'AD-H' | 'AD-R', HouseAdContent | null> = {
  // 애드센스 승인 전까지 블로그 홍보로 채움 (슬롯ID 입력 시 애드센스가 우선 노출)
  'AD-H': {
    title: '인테리어 비용, 더 알고 싶다면?',
    body: '공정별 단가·후기·호구 안 당하는 법까지, 소비자 편에서 정리한 인테리어 정보.',
    cta: '블로그에서 보기',
    href: '/blog',
  },
  'AD-R': {
    title: '받은 견적, 적정한지 헷갈린다면',
    body: '업체 고르는 법·견적서 보는 법을 블로그에 정리해뒀어요.',
    cta: '인테리어 정보 보기',
    href: '/blog',
  },
};

interface HouseAdRendererProps {
  slotId: AdSlotId;
}

export default function HouseAdRenderer({ slotId }: HouseAdRendererProps) {
  // house ad 대상이 아닌 슬롯 — 안전장치 (호출되지 않아야 정상)
  if (slotId === 'AD-P' || slotId === 'AD-F') return null;

  const content = HOUSE_AD_CONTENT[slotId];

  // 카피 미작성 — 개발용 플레이스홀더 (집사 카피 작성 전 화면 확인용)
  if (!content) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-cream/60 border border-dashed border-gold/40 rounded-xl px-4 py-3 text-center">
        <p className="text-[10px] text-gold tracking-widest font-medium">
          {slotId} · House Ad
        </p>
        <p className="text-xs text-gray-500 mt-1">콘텐츠 작성 예정</p>
      </div>
    );
  }

  // 카피 작성 후 — 실제 자사 콘텐츠 렌더
  return (
    <a
      href={content.href}
      className="block w-full h-full bg-white border border-gold/20 rounded-xl px-4 py-3 hover:border-gold transition-colors"
    >
      <p className="text-xs font-semibold text-brown">{content.title}</p>
      <p className="text-[11px] text-gray-500 mt-1 leading-snug">{content.body}</p>
      <p className="text-[10px] text-gold mt-2">{content.cta} →</p>
    </a>
  );
}
