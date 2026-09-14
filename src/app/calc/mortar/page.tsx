// ──────────────────────────────────────────────
// v1 허브 — 레미탈(몰탈)·셀프레벨링 계산기 페이지 (서버 컴포넌트)
//
// 하는 일: 서버 전용 제품 마스터(MORTAR_PRODUCTS)를 읽어 화면에 필요한 칸만 골라
// 클라이언트 컴포넌트에 props로 내려준다. 이 파일이 "src/server/** import 금지" 규칙의
// 유일한 예외다(제품 규격·포장 kg는 이미 공개된 제조사 스펙이라 단가 유출 규칙과 무관하다 —
// 단가 자체는 src/server/pricing/mortar.ts에만 있고 여기엔 없다).
//
// 실제 폼·결과 화면은 MortarCalculator(클라이언트)가 그린다.
// useSearchParams(공유 링크 ?d= 복원)를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다.
//
// 2026-09-14 검사관(opus) 지적 반영:
//   - 자체 SeoSection.tsx를 지우고 도배·바닥재 계산기와 같은 공용 부품
//     (../_components/CalcSeoSection.tsx · @/lib/seo/jsonld)으로 바꿨다.
//   - Suspense 밖에 검색엔진용 진짜 h1(sr-only)을 심었다 — 모바일 상단바 제목줄은
//     TopNav as="p"로 그려서(MortarCalculator.tsx) 페이지 h1이 정확히 1개만 남는다.
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드)
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import MortarCalculator from './MortarCalculator';
import { MORTAR_PRODUCTS } from '@/server/calc/data/mortar-products';
import { toMortarProductOptions } from '@/lib/v1/mortarProductOptions';
import CalcSeoSection, { type CalcFaqItem, type CalcRelatedLink } from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

const PAGE_URL = `${SITE_URL}/calc/mortar`;
const H1_TEXT = '레미탈 계산기 — 바닥 미장·방통 몰탈 몇 포, 몇 ㎥';

export const metadata: Metadata = {
  title: '레미탈 계산기 — 바닥 미장·방통 몰탈 몇 포, 셀프레벨링·수평몰탈 몇 포 | 얼마드나',
  description:
    '레미탈 40kg 몇 포, 방통 몰탈 몇 ㎥인지 면적과 두께만 넣으면 바로 나와요. 셀프레벨링(수평몰탈) 몰탈 물량 계산기와 시멘트+모래 현장 배합 대안까지 무료로 확인하세요.',
  alternates: { canonical: PAGE_URL },
};

// 계산 근거 설명 — 표준품셈·제조사 규격·2026년 노임단가 기준(200~300자)
const INTRO =
  '면적×두께로 몰탈 부피를 구하고, 여기에 제품 계수(kg/mm·㎡)를 곱해 포 수를 뽑아요. 레미탈은 표준품셈 제9장 미장공사와 제조사 공식 스펙(포당 시공면적)을 함께 봤고, 셀프레벨링은 한일시멘트·마페이 등 제조사 스펙을 기준으로 잡았어요. 인건은 용도에 따라 손미장 또는 장비 타설 공식으로 나눠 계산하고 미장공·보통인부 노임단가를 곱해요. 두께는 용도별 관행 범위 안에서 자유롭게 조정할 수 있어요.';

const FAQS: CalcFaqItem[] = [
  {
    q: '레미탈 1포로 몇 ㎡를 시공할 수 있나요?',
    a: '두께 18mm 기준으로 40kg 한 포가 약 1.3~1.4㎡를 덮어요. 두께가 두꺼워질수록 같은 포수로 덮는 면적은 줄어들어요 — 예를 들어 30mm면 로스 5% 포함 한 포당 약 0.77㎡ 정도예요. 정확한 포수는 위 계산기에 면적과 두께를 넣으면 바로 나와요.',
  },
  {
    q: '방통(난방배관 매립) 두께는 보통 몇 mm인가요?',
    a: '배관을 완전히 덮는 최소 두께를 고려해 보통 40~50mm를 씁니다. 단열재 위에 시공할 때는 균열·침하를 막기 위해 50mm 이상을 권장하는 경우가 많아요. 계산기 "방통 전체" 칩을 누르면 45mm가 기본값으로 채워지고, 공법도 자동으로 장비 타설로 맞춰져요.',
  },
  {
    q: '셀프레벨링은 몇 포나 필요한가요?',
    a: '25kg 한 포로 두께 1mm 기준 약 15.6㎡(로스 5% 포함하면 약 14.9㎡)를 시공할 수 있어요(계수 약 1.6kg/mm·㎡, 25÷1.6=15.6). 마루·장판 시공 전 평탄화는 보통 3~10mm, 타일 전에는 5~20mm 두께를 많이 써요. 계산기 두께 칩을 누르면 용도별 추천 두께가 채워져요.',
  },
  {
    q: '시멘트+모래 현장 배합과 레미탈(기성 몰탈), 뭐가 다른가요?',
    a: '레미탈은 시멘트·모래·혼화제가 이미 배합돼 포장된 제품이라 배합 품이 따로 안 들고 품질이 일정해요. 현장 배합(1:3 등)은 자재비가 더 저렴할 수 있지만 계량·비빔 품이 추가로 들고 현장 조건에 따라 강도 편차가 생길 수 있어요. 계산기는 레미탈 모드에서 두 방식의 물량을 같이 보여줘요.',
  },
  {
    q: '미장 인건비는 어떻게 계산하나요?',
    a: '용도에 따라 공법이 갈려요 — 방통처럼 바닥 전체를 붓는 공사는 장비 타설(체적 기준 품 + 일반기계운전사), 욕실·확장부처럼 좁은 곳은 손미장(면적 기준 품)으로 계산해요. 여기에 미장공·보통인부 노임단가를 곱하고, 장비 사용료는 현장 견적 별도예요. 셀프레벨링은 인건비 분리 근거가 없어 자재비만 계산하고 시공비는 현장 견적으로 안내해요.',
  },
];

const RELATED: CalcRelatedLink[] = [
  { href: '/blog/balcony-expansion-cost', label: '발코니 확장 비용 — 평형별 실제 단가 공개' },
  { href: '/blog/tile-construction-cost', label: '타일 시공 비용 — 욕실·주방·현관 평형별 가격' },
  { href: '/blog/bathroom-tile-construction-process-timeline', label: '욕실 타일 시공 과정 — 방수부터 완성까지' },
];

export default function MortarCalcPage() {
  // 제품 마스터(src/server/calc/data/mortar-products.ts, 06_미장.md 기반)에서 화면이
  // 실제로 쓰는 칸만 뽑아 내려준다.
  const products = toMortarProductOptions(MORTAR_PRODUCTS);

  return (
    <>
      {/* 검색엔진용 진짜 H1 — 화면 자리는 안 차지하되(sr-only) 글자는 그대로 존재.
          모바일 상단바 제목줄(TopNav)은 MortarCalculator.tsx에서 as="p"로 그려서
          페이지 안에 h1이 이거 하나만 남는다 */}
      <h1 className="sr-only">{H1_TEXT}</h1>

      <Suspense fallback={null}>
        <MortarCalculator products={products} />
      </Suspense>

      <CalcSeoSection intro={INTRO} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={softwareApplicationLd({
          name: '레미탈·셀프레벨링 계산기',
          description: metadata.description as string,
          url: PAGE_URL,
        })}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '레미탈 계산기' },
        ])}
      />
    </>
  );
}
