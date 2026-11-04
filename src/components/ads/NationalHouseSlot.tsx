'use client';
// ─────────────────────────────────────────────────────────────
// 전국 고정 슬롯(AD-N) — 도토리 인테리어 컨설팅 하우스 배너 — 2026년 11월 04일
//
// [무슨 기능인가]
//   지역 광고 3자리(시도별로 파는 AD-H·AD-P·AD-T·AD-R·AD-F)와 따로 노는 "전국 고정" 자리 1개.
//   어느 지역에서 들어와도 똑같이 "도토리 인테리어 컨설팅"(하자·셀프 인테리어 상담) 배너를 보여 준다.
//   - 그림 파일 없이 글자·상자(HTML/CSS)로만 그려서 어떤 화면에서도 선명하다.
//   - 크기는 기존 맨 위 띠 자리(AD-H)와 같다: 휴대폰 320×100 / PC(lg 이상) 728×90.
//   - 다른 회사(외부 브랜드) 안내라서 기존 유료 배너와 똑같이 오른쪽 위에 "광고" 표기를 붙인다.
//   - 지역 광고 조회(/api/ads/serve)를 부르지 않는다 → 지역 광고의 노출·순서·집계에 영향 0.
//   - 광고 전역 스위치(ADS_ENABLED)와 따로 논다. 끄려면 config.ts 의 NATIONAL_HOUSE_ENABLED=false.
//   - 누르면 /api/ad-click?h=incon 을 거쳐 클릭을 센 뒤 dtrs-incon.com(utm 붙은 고정 주소)으로 새 창 이동.
//     GA4 에도 house_ad_click 이벤트를 하나 보낸다(광고 차단기 쓰는 사람은 서버 집계로만 잡힘).
//   - 관리자 자리 표시 모드(?ad_preview=all)에서는 다른 자리처럼 점선 표시판으로 위치를 보여 준다.
//
// [문구 원칙] 컨설팅 업체라 "시공"을 약속하는 말은 절대 쓰지 않는다(상담만).
// ─────────────────────────────────────────────────────────────
import { NATIONAL_HOUSE_ENABLED } from '@/lib/ads/config';
import { useAdMapMode } from '@/lib/ads/useServedAd';
import { track } from '@/lib/analytics';
import SponsoredLabel from './SponsoredLabel';

/** 배너 문구(적용안) — 다른 후보 2안은 작업 보고에 있다 */
const COPY = {
  brand: '도토리 인테리어 컨설팅 · 전국 상담',
  headline: '하자·셀프 인테리어, 혼자 고민 말고 물어보세요',
  button: '상담 신청',
};

interface NationalHouseSlotProps {
  /** 어디에 붙은 자리인지(GA 이벤트 구분용, 예: 'blog', 'calc-wallpaper') */
  place: string;
  /** 부모에서 여백 등을 조정할 때 */
  className?: string;
}

export default function NationalHouseSlot({ place, className = '' }: NationalHouseSlotProps) {
  const mapMode = useAdMapMode();

  // 이 자리 스위치가 꺼져 있으면 자리 자체가 없다(공간 0)
  if (!NATIONAL_HOUSE_ENABLED) return null;

  // 관리자 자리 표시 모드 — 점선 표시판(지역 광고 자리와 구분되게 "전국 고정 슬롯"이라고 적는다)
  if (mapMode) {
    return (
      <div
        className={`relative w-full max-w-[320px] min-h-[100px] lg:max-w-[728px] lg:min-h-[90px] mx-auto my-3 flex items-center justify-center text-center ${className}`}
        style={{ border: '2px dashed #0f766e', background: 'rgba(15,118,110,0.08)', borderRadius: 6, padding: 4 }}
        data-ad-slot="AD-N"
        data-ad-kind="map"
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: '#0f766e', lineHeight: 1.3 }}>
          전국 고정 슬롯(AD-N) · 도토리 인테리어 컨설팅 · PC 728×90 · 휴대폰 320×100 · 지역 광고와 별개
        </span>
      </div>
    );
  }

  return (
    <div
      // 상자 크기는 AD-H 와 같은 숫자(휴대폰 320×100, PC 728×90). 최소 높이는 화면 밀림 방지용
      className={`relative w-full max-w-[320px] min-h-[100px] lg:max-w-[728px] lg:min-h-[90px] mx-auto my-3 flex ${className}`}
      data-ad-slot="AD-N"
      data-ad-kind="national-house"
    >
      <SponsoredLabel />
      <a
        // 서버 경유 주소: 클릭 수를 센 뒤 고정 주소(dtrs-incon.com + utm)로 보낸다.
        // noreferrer 를 빼야 서버가 "어느 화면에서 눌렀는지"(Referer 경로)를 셀 수 있다.
        // 바깥 사이트로 넘어갈 때는 서버가 Referrer-Policy: no-referrer 로 주소를 지운다.
        href="/api/ad-click?h=incon"
        target="_blank"
        rel="sponsored noopener"
        onClick={() => track('house_ad_click', { slot: 'AD-N', brand: 'incon', place })}
        className="flex w-full items-center gap-3 bg-surface border border-line rounded-card pl-4 pr-3 py-3 lg:px-6 hover:border-accent transition-colors"
        aria-label="도토리 인테리어 컨설팅 상담 신청(새 창)"
      >
        {/* 왼쪽 — 위: 업체 이름(작게), 아래: 한 줄 문구(휴대폰에선 두 줄로 접힐 수 있음) */}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[12px] lg:text-[13px] leading-tight text-ink-2">{COPY.brand}</span>
          <span className="text-[15px] lg:text-[17px] font-semibold leading-snug text-ink break-keep">
            {COPY.headline}
          </span>
        </span>
        {/* 오른쪽 — 단추 모양(실제로는 상자 전체가 링크) */}
        <span className="shrink-0 rounded-chip bg-accent px-3.5 py-2 text-[13px] lg:text-[14px] font-semibold text-white whitespace-nowrap">
          {COPY.button}
        </span>
      </a>
    </div>
  );
}
