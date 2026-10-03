// ──────────────────────────────────────────────
// v1 허브 — 몰탈(레미탈)·셀프레벨링 계산기 페이지 (서버 컴포넌트)
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
// 2026-10-03 검색 노출(SEO) 작업:
//   - 사람들이 실제로 치는 말은 "몰탈 계산기"인데 제목·H1이 "레미탈 계산기"로 시작해서
//     핵심어가 뒤로 밀려 있었다. 제목·설명·H1·og 태그 맨 앞에 "몰탈 계산기"를 둔다.
//   - 구글은 "몰탈"을 "몰 농도(화학)"로도 읽는다 — 그래서 제목에 "레미탈 포 수·방통 미장"을
//     바로 붙여 "건축 몰탈"이라는 걸 분명히 한다.
//   - 본문 아래 접힘 칸에 "쓰는 법"·"40kg 한 포로 몇 ㎡"·"두께별 포 수 표"를 추가했다.
//     표 숫자는 계산기가 쓰는 같은 함수(calcMortarBags)로 그 자리에서 뽑는다 — 계산기 결과와
//     항상 같은 숫자가 나오고, 단가·계수는 화면에 적지 않는다(포 수만).
//
// 작성일: 2026년 09월 14일 · 개정: 2026년 09월 14일(검사관 1라운드) · 2026년 10월 03일(검색 노출)
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import MortarCalculator from './MortarCalculator';
import { MORTAR_PRODUCTS } from '@/server/calc/data/mortar-products';
import { toMortarProductOptions } from '@/lib/v1/mortarProductOptions';
import {
  calcMortarBags,
  MORTAR_LOSS_RATE_DEFAULT,
  REMICON_KG_PER_MM_SQM,
  REMICON_BAG_KG,
} from '@/lib/v1/mortarQuantity';
import CalcSeoSection, {
  type CalcFaqItem,
  type CalcRelatedLink,
  type CalcSeoExtraSection,
} from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

const PAGE_URL = `${SITE_URL}/calc/mortar`;

/** 검색엔진용 H1 본문 — 화면 상단 제목줄(TopNav)과 같은 이름 */
const H1_TEXT = '몰탈(레미탈) 계산기';
/** H1 옆 작은 캡션 — 허브 카드·하단 탭의 이름 "미장"과 이어지게 */
const H1_CAPTION = '미장 · 방통 · 셀프레벨링';

/** 검색 결과 제목 — 핵심어(몰탈 계산기·레미탈 포 수·방통 미장 비용)를 앞에 */
const TITLE = '몰탈 계산기 — 레미탈 포 수·방통 미장 비용 바로 계산 | 얼마드나';
/** 검색 결과 설명 — 150자 안 */
const DESCRIPTION =
  '몰탈(레미탈) 계산기 — 평형이나 면적, 두께만 넣으면 레미탈 40kg 몇 포, 방통 미장 비용 범위가 바로 나와요. 셀프레벨링 포 수도 함께, 로그인 없이 무료.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  // 카톡·네이버 공유 미리보기에도 같은 핵심어가 나가게 og 제목·설명을 맞춘다
  // (루트 레이아웃의 og 이미지 등 나머지 값은 그대로 물려받는다)
  openGraph: {
    title: '몰탈 계산기 — 레미탈 포 수·방통 미장 비용 바로 계산',
    description: DESCRIPTION,
    url: PAGE_URL,
    // 자식 페이지가 openGraph를 주면 부모 값이 통째로 바뀌므로 사이트 이름·언어도 다시 적는다
    siteName: '얼마드나',
    locale: 'ko_KR',
    // openGraph를 직접 주면 루트의 opengraph-image.png 자동 첨부가 빠진다(빌드 후 확인) — 같은 그림을 직접 건다
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '얼마드나 — 무료 인테리어 견적 계산기' }],
    type: 'website',
  },
};

// 계산 근거 설명 — 표준품셈·제조사 규격·2026년 노임단가 기준(200~300자)
const INTRO =
  '면적×두께로 몰탈 부피를 구하고, 제품 규격(포당 시공면적)으로 포 수를 뽑아요. 레미탈은 표준품셈 제9장 미장공사와 제조사 공식 스펙을 함께 봤고, 셀프레벨링은 한일시멘트·마페이 등 제조사 스펙을 기준으로 잡았어요. 인건은 용도에 따라 손미장 또는 장비 타설 공식으로 나눠 계산하고 미장공·보통인부 노임단가를 곱해요. 두께는 용도별 관행 범위 안에서 자유롭게 조정할 수 있어요.';

// ── 두께별 포 수 표 ─────────────────────────────
// 계산기와 같은 함수·같은 로스(5%)로 뽑는다. 숫자를 손으로 적지 않아서 계산기와 어긋날 일이 없다.
/** 표에 올릴 두께(mm)와 그 두께를 주로 쓰는 곳 */
const TABLE_ROWS: { mm: number; use: string }[] = [
  { mm: 18, use: '벽·얇은 바닥 미장' },
  { mm: 30, use: '확장부·욕실 바닥' },
  { mm: 45, use: '방통(난방배관 매립)' },
  { mm: 50, use: '방통(단열재 위)' },
  { mm: 100, use: '두꺼운 방통·채움' },
];
/** 표의 면적 열 — 10㎡, 20평(66㎡), 34평 바닥(84㎡) */
const TABLE_AREAS: { sqm: number; label: string }[] = [
  { sqm: 10, label: '10㎡' },
  { sqm: 66, label: '20평(66㎡)' },
  { sqm: 84, label: '34평(84㎡)' },
];

/** 레미탈 40kg 포 수 — 계산기와 같은 공식(로스 5% 포함, 올림) */
function remitarBags(areaSqm: number, thicknessMm: number): number {
  return calcMortarBags({
    areaSqm,
    thicknessMm,
    kgPerMmSqm: REMICON_KG_PER_MM_SQM,
    bagKg: REMICON_BAG_KG,
    lossRate: MORTAR_LOSS_RATE_DEFAULT,
  });
}

/** 40kg 한 포가 덮는 면적(㎡, 로스 포함) — 소수 둘째 자리 */
function sqmPerBag(thicknessMm: number): string {
  const sqm = REMICON_BAG_KG / (thicknessMm * REMICON_KG_PER_MM_SQM * (1 + MORTAR_LOSS_RATE_DEFAULT));
  return sqm.toFixed(2);
}

// 자주 묻는 질문 6개 — 화면 접힘 칸과 FAQPage 구조화 데이터에 같은 내용을 쓴다
const FAQS: CalcFaqItem[] = [
  {
    q: '몰탈과 레미탈은 뭐가 다른가요?',
    a: '몰탈(모르타르)은 시멘트·모래·물을 섞은 반죽을 통틀어 부르는 말이고, 레미탈은 시멘트와 모래를 미리 배합해 40kg 포대로 파는 기성 몰탈 제품을 부르는 이름이에요. 현장에서 시멘트와 모래를 직접 섞으면 "현장 배합", 포대째 물만 부어 쓰면 "레미탈"이라고 보면 돼요. 이 계산기는 레미탈 포 수와 함께 현장 배합(시멘트 포 수·모래 ㎥) 물량도 보여줘요.',
  },
  {
    q: `레미탈 40kg 한 포로 몇 ㎡를 바를 수 있나요?`,
    a: `두께 18mm면 한 포가 약 ${sqmPerBag(18)}㎡, 30mm면 약 ${sqmPerBag(30)}㎡, 방통 두께 45mm면 약 ${sqmPerBag(45)}㎡를 덮어요(로스 5% 포함). 두께가 두 배가 되면 한 포로 덮는 면적은 절반이 돼요. 정확한 포 수는 위 계산기에 면적과 두께를 넣으면 바로 나와요.`,
  },
  {
    q: '방통 두께는 보통 몇 mm이고, 몇 포나 드나요?',
    a: `배관을 완전히 덮어야 해서 보통 40~50mm를 쓰고, 단열재 위라면 50mm 이상을 권하는 경우가 많아요. 45mm 기준 20평(66㎡)이면 레미탈 약 ${remitarBags(66, 45)}포가 들어요. 현장에서는 50~150mm까지도 쓰는데, 50mm를 넘으면 2회 타설 등 현장 확인이 필요해요.`,
  },
  {
    q: '셀프레벨링과 레미탈은 어떻게 다른가요?',
    a: '셀프레벨링(자동수평몰탈)은 부으면 스스로 퍼져 수평이 잡히는 묽은 몰탈로, 마루·장판·타일 전에 바닥을 얇게(보통 3~20mm) 평평하게 만들 때 써요. 포장은 보통 25kg이에요. 레미탈은 흙손으로 바르는 된 몰탈이라 방통·확장부처럼 두껍게 채울 때 써요. 계산기 첫 화면에서 둘 중 하나를 고르면 그에 맞는 포 수가 나와요.',
  },
  {
    q: '운송비·양중비도 계산되나요?',
    a: '배송비·지게차 하차비·양중비(층으로 올리는 비용)는 현장마다 차이가 커서 자동으로 넣지 않아요. "정확하게" 모드의 세부 조정 칸에 받은 견적 금액을 직접 넣으면 총액에 더해지고, 비워두면 계산에서 빠져요. 엘리베이터 사용 가능 여부와 층수에 따라 크게 달라지니 자재상에 꼭 확인하세요.',
  },
  {
    q: '손미장과 장비 타설, 뭐가 다른가요?',
    a: '손미장은 미장공·보통인부가 흙손으로 바르는 방식이라 아파트·빌라처럼 레미콘차가 들어오기 어려운 현장에 맞고, 방통도 대부분 이 방식이에요. 장비 타설은 펌프로 넓게 뿌리는 방식이라 넓은 상가·건축 현장에 유리하지만 장비 임대료가 하루 단위로 따로 붙어요. 계산기 기본값은 손미장이고 "공법"에서 바꿀 수 있어요.',
  },
];

// 본문 아래 추가 접힘 칸 — 쓰는 법·한 포 면적·두께별 포 수 표
const EXTRA_SECTIONS: CalcSeoExtraSection[] = [
  {
    title: '몰탈 계산기 쓰는 법',
    content: (
      <ol className="list-decimal pl-5 flex flex-col gap-1">
        <li>레미탈(일반 미장·방통)인지 셀프레벨링인지 고르세요.</li>
        <li>평형을 누르거나 면적(㎡)을 넣고, 용도 칩(방통·확장부 등)으로 두께를 채우세요.</li>
        <li>포 수와 비용 범위가 바로 나와요. 방마다 따로 재려면 "정확하게"로 바꾸세요.</li>
      </ol>
    ),
  },
  {
    title: '레미탈 40kg 한 포로 몇 ㎡?',
    content: (
      <p>
        두께 18mm 기준 약 {sqmPerBag(18)}㎡, 30mm 약 {sqmPerBag(30)}㎡, 45mm(방통) 약 {sqmPerBag(45)}㎡예요(로스
        5% 포함). 같은 포 수로 덮는 면적은 두께에 반비례해요.
      </p>
    ),
  },
  {
    title: '방통 미장 두께별 레미탈 포 수 표',
    content: (
      <>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <caption className="sr-only">레미탈 40kg 두께·면적별 필요 포 수 (로스 5% 포함)</caption>
            <thead>
              <tr className="border-b border-v1-line-2 text-left">
                <th scope="col" className="py-2 pr-3 font-semibold">두께</th>
                {TABLE_AREAS.map((a) => (
                  <th key={a.sqm} scope="col" className="py-2 pr-3 font-semibold text-right whitespace-nowrap">
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map((r) => (
                <tr key={r.mm} className="border-b border-v1-line-2">
                  <th scope="row" className="py-2 pr-3 font-normal text-left">
                    {r.mm}mm <span className="text-v1-text-disabled">{r.use}</span>
                  </th>
                  {TABLE_AREAS.map((a) => (
                    <td key={a.sqm} className="py-2 pr-3 text-right tabular-nums whitespace-nowrap">
                      {remitarBags(a.sqm, r.mm)}포
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-v1-text-disabled mt-2">40kg 포 기준, 로스 5% 포함·올림. 계산기 결과와 같은 공식이에요.</p>
      </>
    ),
  },
];

// 관련 글 — 몰탈 계산기를 붙여 둔 글(calculator: mortar) 중 바닥 미장과 가까운 3편
const RELATED: CalcRelatedLink[] = [
  { href: '/blog/plumbing-cost', label: '배관 교체 비용 — 방통까지 평형별 실제 단가' },
  { href: '/blog/balcony-expansion-cost', label: '발코니 확장 비용 — 평형별 실제 단가 공개' },
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
          페이지 안에 h1이 이거 하나만 남는다. 캡션은 허브 카드 이름 "미장"과 잇는 고리 */}
      <h1 className="sr-only">
        {H1_TEXT} <span>{H1_CAPTION}</span>
      </h1>

      <Suspense fallback={null}>
        <MortarCalculator products={products} />
      </Suspense>

      <CalcSeoSection intro={INTRO} sections={EXTRA_SECTIONS} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={{
          ...softwareApplicationLd({
            name: '몰탈(레미탈) 계산기',
            description: DESCRIPTION,
            url: PAGE_URL,
          }),
          // 웹 브라우저에서 바로 쓰는 계산기라는 걸 분명히 — WebApplication은 SoftwareApplication의 하위 유형
          '@type': 'WebApplication',
          alternateName: ['몰탈 계산기', '레미탈 계산기', '미장 계산기', '셀프레벨링 계산기'],
          inLanguage: 'ko-KR',
          browserRequirements: 'JavaScript 필요',
        }}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '몰탈 계산기', href: '/calc/mortar' },
        ])}
      />
    </>
  );
}
