// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 페이지 (서버 컴포넌트)
//
// 화면(폼·결과)은 TileCalculator(클라이언트)가 그린다. 이 파일은 검색 노출을 맡는다:
//   제목·설명·og, 검색엔진용 H1(sr-only — 상단바 제목은 as="p"라 H1은 이것 하나),
//   아래 접힘 칸(쓰는 법·규격별 박스당 장 수 표·패턴별 로스율 표)·FAQ 6개,
//   WebApplication + FAQPage + BreadcrumbList 구조화 데이터.
//
// 로스율 표는 서버 계수(LOSS_RATE)를 그 자리에서 읽어 그린다 — 계산기 결과와 같은 숫자가 나오고
// 손으로 옮겨 적지 않는다. 이 파일은 서버 컴포넌트라 브라우저 묶음에 들어가지 않는다
// (몰탈 계산기 page.tsx가 제품 마스터를 읽는 것과 같은 예외). 단가는 읽지 않는다.
//
// 작성일: 2026년 10월 03일
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import TileCalculator from './TileCalculator';
import { LOSS_RATE } from '@/server/calc/schema/tile-coefficients';
import { TILE_SIZES, TILE_PATTERNS } from '@/lib/v1/tilePresets';
import CalcSeoSection, { type CalcFaqItem, type CalcRelatedLink, type CalcSeoExtraSection } from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';

const PAGE_URL = `${SITE_URL}/calc/tile`;

/** 검색 결과 제목 */
const TITLE = '타일 계산기 — 욕실·거실 타일 수량(박스)·시공 비용 바로 계산 | 얼마드나';
/** 검색 결과 설명(150자 안) */
const DESCRIPTION =
  '타일 계산기 — 공간만 고르면 타일 몇 박스, 덧방·철거 시공비 범위가 바로 나와요. 줄눈재·압착시멘트 포 수와 로스율까지, 실제 견적서 기준. 로그인 없이 무료.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: '타일 계산기 — 욕실·거실 타일 수량(박스)·시공 비용 바로 계산',
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: '얼마드나',
    locale: 'ko_KR',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: '얼마드나 — 무료 인테리어 견적 계산기' }],
    type: 'website',
  },
};

/** 로스율(%) — 계산기와 같은 서버 계수에서 읽는다 */
const pct = (v: number) => Math.round(v * 100);

/** 계산 근거(200~300자) */
const INTRO =
  '욕실은 둘레×높이에서 문·창·욕조를 뺀 벽 면적과 바닥 면적을, 거실은 평형별 평면도 비율로 바닥 면적을 구해요. 여기에 패턴별 로스율을 더해 장 수를 내고, 박스당 장 수로 나눠 박스 수를 올림해요. 줄눈재는 타일 규격과 줄눈 폭으로 줄눈 길이를 구해 계산하고, 압착시멘트는 바름 두께 기준 소요량을 써요. 시공비는 실제 견적서에서 뽑은 자재·인건·철거·방수 단가 범위로 계산해 범위로 보여 줘요.';

// 자주 묻는 질문 6개 — 수량·로스율·덧방·박스당 장 수·줄눈·비용
const FAQS: CalcFaqItem[] = [
  {
    q: '타일 수량은 어떻게 계산하나요?',
    a: '시공 면적(㎡)에 로스율을 더한 뒤 타일 한 장 면적으로 나눠 장 수를 구하고, 박스당 장 수로 나눠 올림하면 박스 수예요. 예를 들어 벽 15㎡에 300×600 타일(장당 0.18㎡, 8장/박스)을 정배열로 붙이면 15×1.05÷0.18 ≈ 88장, 11박스예요. 위 계산기에 공간만 골라도 같은 방식으로 바로 나와요.',
  },
  {
    q: '타일 로스율은 몇 %로 잡나요?',
    a: `이 계산기 기본값은 정배열 벽 ${pct(LOSS_RATE.straight.wall)}%·바닥 ${pct(LOSS_RATE.straight.floor)}%, 엇배열 ${pct(LOSS_RATE.offset.wall)}%, 대각 ${pct(LOSS_RATE.diagonal.wall)}%, 헤링본 ${pct(LOSS_RATE.herringbone.wall)}%예요. 자를 일이 많을수록(대각·헤링본, 모서리 많은 욕실, 대형 타일) 여유분이 더 필요해요. 표준품셈 재료 할증은 3%지만 현장에서는 깨짐·재단 때문에 그보다 넉넉히 잡아요.`,
  },
  {
    q: '욕실 타일 덧방해도 되나요?',
    a: '기존 방수층이 멀쩡하고, 기존 타일에 들뜸·금이 없고, 이미 한 번 덧방한 면이 아니면 덧방을 많이 해요. 600×600 이상 대형 타일은 무거워서 덧방 뒤 떨어질 위험이 있어 현장 확인이 꼭 필요해요. 계산기는 덧방 가능 여부를 판정하지 않고 확인할 항목만 보여 줘요.',
  },
  {
    q: '타일 한 박스에 몇 장 들어 있나요?',
    a: '국산 300×600은 보통 8장, 600×600은 4장으로 한 박스가 1.44㎡ 정도예요. 300×300·250×400은 약 1㎡ 안팎, 600×1200·800×800 같은 대형은 제품마다 달라요. 정확하게 모드에서 상자에 적힌 장 수로 고치면 박스 수가 다시 계산돼요.',
  },
  {
    q: '줄눈재는 얼마나 필요한가요?',
    a: '줄눈 길이는 ㎡당 1000÷(가로+줄눈폭) + 1000÷(세로+줄눈폭) m로 구하고, 여기에 줄눈 폭·깊이를 곱해 양을 내요. 300×600 타일에 줄눈 2mm면 ㎡당 0.13kg 정도라 욕실 1칸이면 2kg 포로 2포 안팎이에요. 계산기에 줄눈재·압착시멘트 포 수가 함께 나와요.',
  },
  {
    q: '욕실 타일 시공 비용은 얼마인가요?',
    a: '공법(덧방/철거 후 새로)·타일 규격·등급에 따라 크게 달라요. 철거 후 새로 하면 철거·방수가 더해져 덧방보다 비싸요. 이 계산기는 실제 견적서에서 뽑은 자재·인건·철거·방수 단가 범위로 금액을 보여 주고, 비슷한 견적서 건수와 범위를 함께 적어 둬요. 셀프로 하면 자재비만 볼 수 있어요.',
  },
];

// 아래 접힘 칸 — 쓰는 법·규격별 박스당 장 수·패턴별 로스율
const EXTRA_SECTIONS: CalcSeoExtraSection[] = [
  {
    title: '타일 계산기 쓰는 법',
    content: (
      <ol className="list-decimal pl-5 flex flex-col gap-1">
        <li>욕실·거실·현관·베란다 중 공간을 고르세요. 바로 박스 수와 비용이 나와요.</li>
        <li>공법(덧방/철거)과 타일 규격을 고르면 결과가 좁혀져요.</li>
        <li>치수를 직접 재서 넣으려면 &quot;정확하게&quot;로 바꾸세요.</li>
      </ol>
    ),
  },
  {
    title: '규격별 타일 박스당 장 수',
    content: (
      <>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <caption className="sr-only">타일 규격별 박스당 장 수와 박스당 면적</caption>
            <thead>
              <tr className="border-b border-v1-line-2 text-left">
                <th scope="col" className="py-2 pr-3 font-semibold">규격(mm)</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">박스당</th>
                <th scope="col" className="py-2 pr-3 font-semibold text-right">박스당 면적</th>
              </tr>
            </thead>
            <tbody>
              {TILE_SIZES.map((s) => (
                <tr key={s.code} className="border-b border-v1-line-2">
                  <th scope="row" className="py-2 pr-3 font-normal text-left">
                    {s.label}
                  </th>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {s.piecesPerBox}장{s.piecesEstimated ? '*' : ''}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{((s.widthMm * s.lengthMm * s.piecesPerBox) / 1e6).toFixed(2)}㎡</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-v1-text-disabled mt-2">* 제품마다 달라요. 상자 표기를 확인하세요.</p>
      </>
    ),
  },
  {
    title: '패턴별 타일 로스율',
    content: (
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <caption className="sr-only">타일 붙이는 패턴별 로스율</caption>
          <thead>
            <tr className="border-b border-v1-line-2 text-left">
              <th scope="col" className="py-2 pr-3 font-semibold">패턴</th>
              <th scope="col" className="py-2 pr-3 font-semibold text-right">벽</th>
              <th scope="col" className="py-2 pr-3 font-semibold text-right">바닥</th>
            </tr>
          </thead>
          <tbody>
            {TILE_PATTERNS.map((p) => (
              <tr key={p.value} className="border-b border-v1-line-2">
                <th scope="row" className="py-2 pr-3 font-normal text-left">
                  {p.label}
                </th>
                <td className="py-2 pr-3 text-right tabular-nums">{pct(LOSS_RATE[p.value].wall)}%</td>
                <td className="py-2 pr-3 text-right tabular-nums">{pct(LOSS_RATE[p.value].floor)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
];

// 관련 글 3편 — 계산기를 붙인 타일 글 중 비용·덧방·자재
const RELATED: CalcRelatedLink[] = [
  { href: '/blog/tile-construction-cost', label: '타일 시공 비용 — 욕실·주방·현관, 덧방·철거 차이' },
  { href: '/blog/bathroom-tile-overlay-vs-demolition-cost', label: '욕실 타일 덧방 비용 — 덧방 vs 올철거' },
  { href: '/blog/tile-type-size-price-comparison', label: '포세린 타일 가격 — 박스 수 계산법까지' },
];

export default function TileCalcPage() {
  return (
    <>
      {/* 검색엔진용 진짜 H1 — 상단바 제목줄은 as="p"라 페이지 H1은 이것 하나 */}
      <h1 className="sr-only">타일 계산기</h1>

      <Suspense fallback={null}>
        <TileCalculator />
      </Suspense>

      <CalcSeoSection intro={INTRO} sections={EXTRA_SECTIONS} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={{
          ...softwareApplicationLd({ name: '타일 계산기', description: DESCRIPTION, url: PAGE_URL }),
          '@type': 'WebApplication',
          alternateName: ['타일 수량 계산기', '타일 소요량 계산', '타일 박스 계산기', '욕실 타일 비용 계산기'],
          inLanguage: 'ko-KR',
          browserRequirements: 'JavaScript 필요',
        }}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '타일 계산기', href: '/calc/tile' },
        ])}
      />
    </>
  );
}
