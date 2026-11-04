'use client';
// ─────────────────────────────────────────────────────────────
// 전국 고정 슬롯(AD-N) — 도토리 인테리어 컨설팅 하우스 배너 — 2026년 11월 04일
//
// [무슨 기능인가]
//   지역 광고 3자리(시도별로 파는 AD-H·AD-P·AD-T·AD-R·AD-F)와 따로 노는 "전국 고정" 자리 1개.
//   어느 지역에서 들어와도 똑같이 "도토리 인테리어 컨설팅"(하자·셀프 인테리어 상담) 배너를 보여 준다.
//   - 광고주 배너와 똑같은 "그림 배너"로 보여 준다(2026-11-04 형아 피드백: 자동 배너 생성기 기준).
//     그림은 견본 생성기(scripts/sponsor-banners/make-style-banners.mjs --house incon)가 만든 2배 밀도 PNG.
//     public/house/incon/<스타일>/<규격>.png — 스타일은 config.ts 의 NATIONAL_HOUSE_STYLE(trust/wood) 한 줄로 바꾼다.
//   - 크기는 기존 맨 위 띠 자리(AD-H)와 같다: 휴대폰 320×100 그림 / PC(lg 이상) 728×90 그림.
//     그리는 방식(picture 로 폭에 따라 그림 고르기·둥근 모서리)은 AdSlot 의 광고주 그림 배너와 같다.
//   - 전화번호는 그림·링크 어디에도 없다. 배너 전체가 홈페이지 링크.
//   - 다른 회사(외부 브랜드) 안내라서 기존 유료 배너와 똑같이 오른쪽 위에 "광고" 표기를 붙인다.
//   - 지역 광고 조회(/api/ads/serve)를 부르지 않는다 → 지역 광고의 노출·순서·집계에 영향 0.
//   - 광고 전역 스위치(ADS_ENABLED)와 따로 논다. 끄려면 config.ts 의 NATIONAL_HOUSE_ENABLED=false.
//   - 누르면 /api/ad-click?h=incon 을 거쳐 클릭을 센 뒤 dtrs-incon.com(utm 붙은 고정 주소)으로 새 창 이동.
//     GA4 에도 house_ad_click 이벤트를 하나 보낸다(광고 차단기 쓰는 사람은 서버 집계로만 잡힘).
//   - 관리자 자리 표시 모드(?ad_preview=all)에서는 다른 자리처럼 점선 표시판으로 위치를 보여 준다.
//
// [문구 원칙] 컨설팅 업체라 "시공"을 약속하는 말은 절대 쓰지 않는다(상담만).
// ─────────────────────────────────────────────────────────────
import { NATIONAL_HOUSE_ENABLED, NATIONAL_HOUSE_STYLE } from '@/lib/ads/config';
import { useAdMapMode } from '@/lib/ads/useServedAd';
import { track } from '@/lib/analytics';
import SponsoredLabel from './SponsoredLabel';

/** 그림 주소(스타일별) — 휴대폰 320×100, PC 728×90 */
const IMG_MOBILE = `/house/incon/${NATIONAL_HOUSE_STYLE}/320x100.png`;
const IMG_PC = `/house/incon/${NATIONAL_HOUSE_STYLE}/728x90.png`;
/** 그림 대체 글자(화면 읽기 프로그램·그림 못 불러올 때) — 그림 속 문구와 같다 */
const ALT = '도토리 인테리어 컨설팅 — 하자·셀프 인테리어, 혼자 고민 말고 물어보세요. 전국 상담 · 시공 없이 컨설팅만. 상담 신청';

interface NationalHouseSlotProps {
  /** 어디에 붙은 자리인지(GA 이벤트 구분용, 예: 'blog', 'calc-wallpaper') */
  place: string;
  /** 부모에서 여백 등을 조정할 때 */
  className?: string;
  /**
   * PC(lg 이상)에서 728×90 넓은 그림을 쓸지 — 본문 폭이 넓은 블로그 글만 true.
   * 계산기는 PC 에서도 오른쪽 칸 폭(약 400px)이 좁아 넓은 그림이 작아지므로 320×100 그대로 가운데.
   */
  wide?: boolean;
}

export default function NationalHouseSlot({ place, className = '', wide = false }: NationalHouseSlotProps) {
  // 상자 크기: 휴대폰 320×100, wide 이면 PC 에서 728×90 (AD-H 와 같은 숫자)
  const box = wide ? 'max-w-[320px] min-h-[100px] lg:max-w-[728px] lg:min-h-[90px]' : 'max-w-[320px] min-h-[100px]';
  const mapMode = useAdMapMode();

  // 이 자리 스위치가 꺼져 있으면 자리 자체가 없다(공간 0)
  if (!NATIONAL_HOUSE_ENABLED) return null;

  // 관리자 자리 표시 모드 — 점선 표시판(지역 광고 자리와 구분되게 "전국 고정 슬롯"이라고 적는다)
  if (mapMode) {
    return (
      <div
        className={`relative w-full ${box} mx-auto my-3 flex items-center justify-center text-center ${className}`}
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
      className={`relative w-full ${box} mx-auto my-3 flex items-stretch justify-center ${className}`}
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
        onClick={() => track('house_ad_click', { slot: 'AD-N', brand: 'incon', style: NATIONAL_HOUSE_STYLE, place })}
        className="block w-full h-full"
        aria-label="도토리 인테리어 컨설팅 상담 신청(새 창)"
      >
        {/* 화면 폭에 따라 그림을 고른다: wide 자리의 PC(1024px 이상)는 728×90, 그 밖은 320×100 — AdSlot 광고주 배너와 같은 방식.
            그림 비율을 그대로 지켜(h-auto) 글자가 잘리지 않게 한다 */}
        <picture className="block w-full h-full">
          {wide && <source media="(min-width: 1024px)" srcSet={IMG_PC} />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG_MOBILE} alt={ALT} width={320} height={100} className="block w-full h-auto rounded-md" />
        </picture>
      </a>
    </div>
  );
}
