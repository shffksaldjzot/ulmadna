// ──────────────────────────────────────────────
// v1 허브 — 바닥재 계산기 페이지 (서버 컴포넌트, 도배 page.tsx를 그대로 본떠 만듦)
//
// 하는 일: 서버 전용 제품 마스터(FLOORING_PRODUCTS)를 읽어 화면에 필요한 칸만 골라
// 클라이언트 컴포넌트에 props로 내려준다. 이 파일이 "src/server/** import 금지" 규칙의
// 유일한 예외다(제품 판매가는 이미 공개된 소비자가라 단가 유출 규칙과 무관하다).
//
// 실제 폼·결과 화면은 FlooringCalculator(클라이언트)가 그린다.
// useSearchParams(공유 링크 ?d= 복원)를 쓰는 클라이언트 컴포넌트라 Suspense로 감싼다.
//
// 2026년 09월 14일: SEO 보강 — 도배 계산기 page.tsx와 같은 이유(실제 폼은 searchParams를
// 쓰는 클라이언트 컴포넌트라 Suspense fallback(null)이 정적 HTML로 굳어 검색엔진이 받는
// 페이지가 사실상 빈 껍데기였음, 진단: 본문 34자·H1 0개·JSON-LD 0개)로 서버 컴포넌트인
// 이 자리에 진짜 H1·JSON-LD·SEO 본문 섹션을 심는다.
//
// 작성일: 2026년 09월 10일
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import FlooringCalculator from './FlooringCalculator';
import { FLOORING_PRODUCTS } from '@/server/calc/data/flooring-products';
import { toFlooringProductOptions } from '@/lib/v1/flooringProductOptions';
import CalcSeoSection, { type CalcFaqItem, type CalcRelatedLink } from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

const PAGE_URL = `${SITE_URL}/calc/flooring`;
const H1_TEXT = '바닥재 계산기 — 장판·강마루 몇 평, 비용 얼마';

export const metadata: Metadata = {
  title: '바닥재 계산기 — 장판·강마루 몇 평, 비용 얼마 | 얼마드나',
  description: '평형 하나만 넣어도 바닥재 물량과 비용 범위가 바로 나와요. 실측을 더하면 더 정확해집니다. 로그인·개인정보 없이 무료.',
  alternates: { canonical: PAGE_URL },
};

// 계산 근거 설명 — 표준품셈·제조사 규격·2026년 노임단가 기준(200~300자)
const INTRO =
  '평형을 입력하면 62건 실측 평면 비율표로 방마다 바닥 면적을 추정하고, 마루·장판 규격(폭·길이·두께)에 맞춰 깔아보기 또는 방향 비교로 박스·롤 수와 로스를 계산해요. 걸레받이 같은 부자재 물량은 표준품셈 기준으로 자동 산출하고, 2026년 노임단가로 시공 품수를 매겨 합산합니다. 실측 치수를 직접 넣으면 평형 추정 대신 그 값을 그대로 써서 더 정확해져요.';

const FAQS: CalcFaqItem[] = [
  {
    q: '34평 바닥재 시공하면 얼마나 필요한가요?',
    a: '평형·베이·시공 범위에 따라 달라지는데, 34평(84타입) 전체 시공이면 실제 바닥 면적은 평형보다 좁은 20평 안팎이 나와요. 계산기에 평형만 넣어도 바로 범위로 나옵니다.',
  },
  {
    q: '강마루와 장판은 뭐가 다른가요?',
    a: '강마루는 나무 질감의 단단한 마루로 내구성이 좋고, 장판(비닐 바닥재)은 시공이 간단하고 저렴한 대신 상대적으로 수명이 짧아요.',
  },
  {
    q: '기존 바닥재 철거 비용도 포함되나요?',
    a: '철거 여부를 선택할 수 있고, 켜면 철거 비용이 결과에 합산돼서 나와요.',
  },
  {
    q: '걸레받이도 같이 계산되나요?',
    a: '네, 부자재로 걸레받이 물량과 비용이 함께 나와요.',
  },
  {
    q: '결과 금액에 부가세가 포함되나요?',
    a: '화면에 나오는 금액은 부가세 포함 소비자가 기준의 범위 견적이에요. 실제 견적은 시공사마다 다를 수 있어요.',
  },
];

const RELATED: CalcRelatedLink[] = [
  { href: '/blog/flooring-cost', label: '강마루 장판 가격 — 평당 실제 시세 공개' },
  { href: '/blog/vinyl-flooring-cost', label: '장판 시공 비용 — 두께·등급별 실제 단가표 공개' },
  { href: '/blog/jangpan-brand-comparison', label: '장판 브랜드 비교 — 등급별 품번과 실제 가격 공개' },
];

export default function FlooringCalcPage() {
  // 제품 마스터(src/server/calc/data/flooring-products.ts, E 에이전트 작업)에서 화면이
  // 실제로 쓰는 칸만 뽑아 내려준다. usable=false·kind=null인 제품은 toFlooringProductOptions가 거른다.
  const products = toFlooringProductOptions(FLOORING_PRODUCTS);

  return (
    <>
      {/* 검색엔진용 진짜 H1 — 화면 자리는 안 차지하되(sr-only) 글자는 그대로 존재 */}
      <h1 className="sr-only">{H1_TEXT}</h1>

      <Suspense fallback={null}>
        <FlooringCalculator products={products} />
      </Suspense>

      <CalcSeoSection intro={INTRO} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={softwareApplicationLd({
          name: '바닥재 계산기',
          description: metadata.description as string,
          url: PAGE_URL,
        })}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '바닥재 계산기' },
        ])}
      />
    </>
  );
}
