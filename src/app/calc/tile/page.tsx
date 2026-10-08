// ──────────────────────────────────────────────
// v1 허브 — 타일 계산기 페이지 (서버 컴포넌트)
//
// 화면(폼·결과)은 TileCalculator(클라이언트)가 그린다. 이 파일은 검색 노출을 맡는다:
//   제목·설명·og, 검색엔진용 H1(sr-only — 상단바 제목은 as="p"라 H1은 이것 하나),
//   아래 접힘 칸(쓰는 법·규격별 박스당 장 수 표·패턴별 로스율 표)·FAQ 5개(2026-10-08 개편),
//   WebApplication + FAQPage + BreadcrumbList 구조화 데이터.
//
// 로스율 표는 서버 계수(LOSS_RATE)를 그 자리에서 읽어 그린다 — 계산기 결과와 같은 숫자가 나오고
// 손으로 옮겨 적지 않는다. 이 파일은 서버 컴포넌트라 브라우저 묶음에 들어가지 않는다
// (몰탈 계산기 page.tsx가 제품 마스터를 읽는 것과 같은 예외). 단가는 읽지 않는다.
//
// FAQ 금액은 서버에서 계산기를 그 자리에서 돌려 얻은 총액만 쓴다(단가는 안 쓴다 — 브라우저 묶음에도 안 들어감).
//
// 작성일: 2026년 10월 03일
// 개편(제목 "타일 시공 견적 계산기"·FAQ 5문항): 2026년 10월 08일
// ──────────────────────────────────────────────

import { Suspense } from 'react';
import type { Metadata } from 'next';
import TileCalculator from './TileCalculator';
import { LOSS_RATE } from '@/server/calc/schema/tile-coefficients';
import { calcTile } from '@/server/calc/tile';
import { TILE_SIZES, TILE_PATTERNS } from '@/lib/v1/tilePresets';
import { toMan } from '@/lib/v1/money';
import CalcSeoSection, { type CalcFaqItem, type CalcRelatedLink, type CalcSeoExtraSection } from '../_components/CalcSeoSection';
import { JsonLd, softwareApplicationLd, faqLd, breadcrumbLd, SITE_URL } from '@/lib/seo/jsonld';
import { TILE_RELATED_POSTS } from './relatedPosts';

const PAGE_URL = `${SITE_URL}/calc/tile`;

/** 검색 결과 제목 */
const TITLE = '타일 시공 견적 계산기 — 욕실·주방 타일 비용 | 얼마드나';
/** 검색 결과 설명(150자 안) */
const DESCRIPTION =
  '타일 시공 견적 계산기 — 욕실·주방·현관·거실 타일 비용을 바로 계산해요. 도기질·자기질·포세린 종류와 압착·떠붙임 공법, 박스 수·기공 일수·철거·방수까지 실제 견적서 기준. 로그인 없이 무료.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: '타일 시공 견적 계산기 — 욕실·주방 타일 비용',
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
/** "120~180만원" */
const manRange = (min: number, max: number) => `${toMan(min).toLocaleString('ko-KR')}~${toMan(max).toLocaleString('ko-KR')}만원`;

// FAQ 숫자는 손으로 적지 않고 계산기를 그 자리에서 돌려 얻는다(서버 컴포넌트 — 총액만 쓰고 단가는 안 쓴다).
// 단가표가 바뀌어도 FAQ와 계산기 결과가 어긋나지 않는다.
const BATH1 = calcTile({ mode: 'simple', scope: 'bath1', grade: 'mid' });
const BATH1_OVERLAY = calcTile({ mode: 'simple', scope: 'bath1', grade: 'mid', method: 'overlay' });
const KITCHEN = calcTile({ mode: 'simple', scope: 'kitchen', grade: 'mid' });
const BATH_SQM = (BATH1.quantity.wall?.netSqm ?? 0) + (BATH1.quantity.floor?.netSqm ?? 0);

/** 계산 근거(200~300자) */
const INTRO =
  '욕실 벽은 둘레×높이에서 문·창·욕조를 뺀 면적을, 바닥은 가로×세로를, 거실은 평형별 평면도 비율로 면적을 구해요. 패턴별 로스율을 더해 장 수를 내고 박스당 장 수로 나눠 박스 수를 올림해요. 타일 종류(도기질·자기질·포세린·대형 포세린)와 붙임 공법(압착·떠붙임·본드)에 따라 접착 자재와 기공·조공 일수가 달라지고, 철거·방수·줄눈·양중까지 실제 견적서에서 뽑은 범위로 계산해 보급·중급·고급 세 가지 금액으로 보여 줘요.';

// 자주 묻는 질문 5개 — ㎡당 시공비·욕실 비용·박스 수·종류·공법
const FAQS: CalcFaqItem[] = [
  {
    q: '타일 시공비는 ㎡당 얼마인가요?',
    a: `자재+시공을 합쳐 실제 견적서 기준 ㎡당 대략 5만~16만 원대예요(견적DB 타일 시공 80건, 욕실 1칸 ㎡ 환산 하위 25%~상위 25%). 좁고 자를 곳이 많은 욕실은 비싸고, 넓은 거실 바닥은 싸요. 철거·방수는 따로 붙어요. 예를 들어 공용 욕실 1칸(벽+바닥 약 ${BATH_SQM.toFixed(0)}㎡)을 덧방하면 ${manRange(BATH1_OVERLAY.cost.min, BATH1_OVERLAY.cost.max)}이 나와요.`,
  },
  {
    q: '욕실 타일 비용은 얼마인가요?',
    a: `공용 욕실 1칸(1.6×2.1m, 높이 2.3m)을 도기질 300×600으로 철거 후 새로 붙이고 방수까지 하면 이 계산기 기준 ${manRange(BATH1.cost.min, BATH1.cost.max)}이에요. 기존 타일이 멀쩡해 덧방하면 철거·방수가 빠져 ${manRange(BATH1_OVERLAY.cost.min, BATH1_OVERLAY.cost.max)}로 내려가요. 주방 벽(상부장 아래 약 2.4㎡) 덧방은 ${manRange(KITCHEN.cost.min, KITCHEN.cost.max)}이에요. 도기·천장·욕실장은 들어 있지 않아요.`,
  },
  {
    q: '타일 몇 박스 사야 하나요?',
    a: `시공 면적(㎡)에 로스율을 더해 타일 한 장 면적으로 나누면 장 수, 박스당 장 수로 나눠 올림하면 박스 수예요. 벽 15㎡에 300×600(장당 0.18㎡, 8장/박스)을 정배열로 붙이면 15×1.05÷0.18 ≈ 88장, 11박스예요. 로스는 정배열 벽 ${pct(LOSS_RATE.straight.wall)}%·바닥 ${pct(LOSS_RATE.straight.floor)}%, 대각 ${pct(LOSS_RATE.diagonal.wall)}%, 헤링본 ${pct(LOSS_RATE.herringbone.wall)}%로 잡고, 600×1200 같은 대형은 10% 이상 잡아요.`,
  },
  {
    q: '도기질·자기질·포세린 타일은 뭐가 다른가요?',
    a: '도기질은 물을 먹는 벽 전용 타일로 가볍고 자르기 쉬워 욕실·주방 벽에 많이 써요. 자기질은 더 단단해 욕실 바닥·베란다에 쓰고, 포세린은 물을 거의 안 먹어 벽·바닥 모두 쓰며 값이 더 나가요. 600×1200 같은 대형 포세린은 줄눈이 적어 넓어 보이지만 자재·시공비가 모두 올라요. 계산기에서 종류를 바꾸면 금액 차이를 바로 볼 수 있어요.',
  },
  {
    q: '압착·떠붙임·본드 공법은 언제 쓰나요?',
    a: '벽 도기질은 압착시멘트를 얇게 바르는 압착이 표준이에요. 바닥은 몰탈을 깔아 물매·수평을 잡는 떠붙임을 많이 하고, 포세린·대형 타일 벽은 처짐이 적은 본드를 써요. 떠붙임은 몰탈 비빔·운반 때문에 조공 일수가 늘어요. 계산기 정확하게 모드에서 공간·종류를 고르면 공법을 자동으로 추천하고, 바꾸면 금액이 다시 나와요.',
  },
];

// 아래 접힘 칸 — 쓰는 법·규격별 박스당 장 수·패턴별 로스율
const EXTRA_SECTIONS: CalcSeoExtraSection[] = [
  {
    title: '타일 계산기 쓰는 법',
    content: (
      <ol className="list-decimal pl-5 flex flex-col gap-1">
        <li>공간을 고르면 바로 금액이 나와요.</li>
        <li>타일 종류·규격을 고르면 금액이 좁혀져요. 철거·방수·줄눈은 결과 위 칩으로 바꿔요.</li>
        <li>직접 잰 치수와 공법까지 넣으려면 &quot;정확하게&quot;로 바꾸세요.</li>
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

// 관련 글 — 결과 카드 ⑨와 같은 목록
const RELATED: CalcRelatedLink[] = TILE_RELATED_POSTS.map((p) => ({ href: p.href, label: p.label }));

export default function TileCalcPage() {
  return (
    <>
      {/* 검색엔진용 진짜 H1 — 상단바 제목줄은 as="p"라 페이지 H1은 이것 하나 */}
      <h1 className="sr-only">타일 시공 견적 계산기 — 욕실·주방 타일 비용</h1>

      <Suspense fallback={null}>
        <TileCalculator />
      </Suspense>

      <CalcSeoSection intro={INTRO} sections={EXTRA_SECTIONS} faqs={FAQS} related={RELATED} />

      <JsonLd
        data={{
          ...softwareApplicationLd({ name: '타일 시공 견적 계산기', description: DESCRIPTION, url: PAGE_URL }),
          '@type': 'WebApplication',
          alternateName: ['타일 계산기', '타일 시공비 계산기', '욕실 타일 비용 계산기', '타일 수량 계산기', '타일 박스 계산기'],
          inLanguage: 'ko-KR',
          browserRequirements: 'JavaScript 필요',
        }}
      />
      <JsonLd data={faqLd(FAQS)} />
      <JsonLd
        data={breadcrumbLd([
          { name: '얼마드나', href: '/' },
          { name: '계산기', href: '/calc' },
          { name: '타일 시공 견적 계산기', href: '/calc/tile' },
        ])}
      />
    </>
  );
}
